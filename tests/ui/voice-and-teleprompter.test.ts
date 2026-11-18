import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpeechHandlers, SpeechToText } from '../../src/application';
import { audioId } from '../../src/domain';
import { CommandRunner } from '../../src/ui/presenters/command-runner';
import { DictationPresenter } from '../../src/ui/presenters/dictation-presenter';
import { PhrasesPresenter } from '../../src/ui/presenters/phrases-presenter';
import { ScriptsPresenter } from '../../src/ui/presenters/scripts-presenter';
import {
  prompterUnits,
  TeleprompterPresenter,
} from '../../src/ui/presenters/teleprompter-presenter';
import { VoicePresenter } from '../../src/ui/presenters/voice-presenter';
import { initialAppState, type AppState } from '../../src/ui/store/app-state';
import { Store } from '../../src/ui/store/store';
import { createHarness, value } from '../application/harness';
import { FakePlayer, FakeRecorder } from './media-fakes';

class FakeSpeech implements SpeechToText {
  available = true;
  handlers: SpeechHandlers | null = null;
  stopped = 0;
  isAvailable(): boolean {
    return this.available;
  }
  listen(handlers: SpeechHandlers) {
    this.handlers = handlers;
    return {
      stop: () => {
        this.stopped += 1;
      },
    };
  }
}

const setup = async () => {
  const harness = createHarness();
  const store = new Store<AppState>(initialAppState);
  const runner = new CommandRunner(store);
  const phrases = new PhrasesPresenter(harness.app, store, runner, 300);
  const recorder = new FakeRecorder();
  const player = new FakePlayer();
  const voice = new VoicePresenter(
    harness.app,
    store,
    runner,
    recorder,
    player,
    (id) => phrases.flush(id),
    {
      maxRecordingMs: 5_000,
      tickMs: 100,
    },
  );
  const speech = new FakeSpeech();
  const dictation = new DictationPresenter(store, speech, {
    currentText: (id) => store.get().current?.phrases.find((p) => p.id === id)?.text ?? '',
    write: (id, text) => {
      phrases.editText(id, text);
    },
    prepare: (id) => phrases.flush(id),
  });
  let time = 0;
  const teleprompter = new TeleprompterPresenter(
    harness.app,
    store,
    runner,
    new FakeRecorder(),
    player,
    () => time,
    () => phrases.flush(),
  );
  const scripts = new ScriptsPresenter(harness.app, store, runner, () => phrases.flush());
  await scripts.start();
  const current = () => store.get().current!;
  const id = current().phrases[1]!.id;
  value(
    await harness.app.editPhrase.execute({
      scriptId: current().id,
      phraseId: id,
      text: 'Uno dos tres cuatro cinco seis',
    }),
  );
  await scripts.open(current().id);
  return {
    ...harness,
    store,
    phrases,
    recorder,
    player,
    voice,
    speech,
    dictation,
    teleprompter,
    current,
    id,
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe('VoicePresenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('graba la frase, la guarda y la reproduce al instante', async () => {
    const t = await setup();
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().voice.recordingId).toBe(t.id);
    await vi.advanceTimersByTimeAsync(250);
    expect(t.store.get().voice.elapsedMs).toBeGreaterThan(0);
    const stopping = t.voice.toggleRecording(t.id);
    await vi.waitFor(() => {
      expect(t.store.get().voice.playingId).toBe(t.id);
    });
    t.player.end();
    await stopping;
    expect(t.current().phrases[1]?.take).not.toBeNull();
    expect(t.player.played).toHaveLength(1);
  });

  it('se corta sola, cambia de frase y avisa errores del micrófono', async () => {
    const t = await setup();
    await t.voice.toggleRecording(t.id);
    const other = t.current().phrases[0]!.id;
    // Corta la anterior (que se reproduce) y empieza a grabar la otra.
    const switching = t.voice.toggleRecording(other);
    await vi.waitFor(() => {
      expect(t.store.get().voice.playingId).toBe(t.id);
    });
    t.player.end();
    await switching;
    expect(t.store.get().voice.recordingId).toBe(other);
    // Pasado el tope de tiempo, la grabación se corta sola.
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => {
      expect(t.store.get().voice.playingId).toBe(other);
    });
    t.player.end();
    expect(t.store.get().voice.recordingId).toBeNull();

    t.recorder.failStart = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().notice?.message).toContain('Permite el uso del micrófono');
    t.recorder.failStart = Object.assign(new Error('no'), { name: 'NotFoundError' });
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().notice?.message).toContain('No se encontró');
    t.recorder.failStart = new Error('otro');
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().notice?.message).toBe('No se pudo usar el micrófono.');
    t.recorder.failStart = null;

    t.recorder.failStop = true;
    await t.voice.toggleRecording(t.id);
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().notice?.message).toContain('se interrumpió');
    t.voice.cancel();
  });

  it('reproduce, detiene y avisa si la grabación falta o falla', async () => {
    const t = await setup();
    await t.voice.play(t.id); // sin toma: nada
    value(
      await t.app.recordTake.execute({
        scriptId: t.current().id,
        phraseId: t.id,
        audio: new Blob(['x']),
      }),
    );
    const view = value(await t.app.getScript.execute({ scriptId: t.current().id }));
    t.store.update({ current: view });
    const playing = t.voice.play(t.id);
    await vi.waitFor(() => {
      expect(t.store.get().voice.playingId).toBe(t.id);
    });
    await t.voice.play(t.id); // segunda vez: detiene
    await playing;
    t.player.fail = true;
    await t.voice.play(t.id);
    expect(t.store.get().notice?.message).toContain('No se pudo reproducir');
    t.player.fail = false;
    await t.audio.delete(audioId(view.phrases[1]!.take!));
    await t.voice.play(t.id);
    expect(t.store.get().notice?.message).toContain('No se encontró la grabación');
  });

  it('sin soporte de grabación avisa', async () => {
    const t = await setup();
    t.store.update({ voice: { ...t.store.get().voice, supported: false } });
    await t.voice.toggleRecording(t.id);
    expect(t.store.get().notice?.message).toContain('no permite grabar');
  });
});

describe('DictationPresenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('agrega lo dictado a la frase y muestra lo provisional', async () => {
    const t = await setup();
    await t.dictation.toggle(t.id);
    expect(t.store.get().dictation.phraseId).toBe(t.id);
    t.speech.handlers!.onText('siete', false);
    expect(t.store.get().dictation.interim).toBe('siete');
    t.speech.handlers!.onText('siete ocho', true);
    await vi.advanceTimersByTimeAsync(300);
    expect(t.current().phrases[1]?.text).toBe('Uno dos tres cuatro cinco seis siete ocho');
    t.speech.handlers!.onError('Sin conexión');
    expect(t.store.get().notice?.message).toBe('Sin conexión');
    t.speech.handlers!.onEnd();
    expect(t.store.get().dictation.phraseId).toBeNull();
  });

  it('alternar en la misma frase la detiene; sin disponibilidad avisa', async () => {
    const t = await setup();
    await t.dictation.toggle(t.id);
    const old = t.speech.handlers!;
    await t.dictation.toggle(t.id);
    expect(t.store.get().dictation.phraseId).toBeNull();
    old.onText('tarde', true); // sesión vieja: se ignora
    old.onEnd();
    t.speech.available = false;
    t.dictation.refreshAvailability();
    await t.dictation.toggle(t.id);
    expect(t.store.get().notice?.message).toContain('dictado necesita');
  });
});

describe('TeleprompterPresenter', () => {
  it('sin nada escrito avisa en lugar de abrir', async () => {
    const t = await setup();
    t.store.update({ current: { ...t.current(), phrases: [] } });
    await t.teleprompter.open();
    expect(t.store.get().teleprompter).toBeNull();
    expect(t.store.get().notice?.message).toContain('al menos una frase');
  });

  it('arma las frases con su dirección de actuación', async () => {
    const t = await setup();
    expect(prompterUnits(t.current())).toEqual([
      expect.objectContaining({ id: t.id, direction: 'Desarrollo · Plano medio · energía normal' }),
    ]);
  });

  it('ensaya frase a frase, mide el ritmo y aplica la calibración', async () => {
    const t = await setup();
    value(
      await t.app.editPhrase.execute({
        scriptId: t.current().id,
        phraseId: t.current().phrases[2]!.id,
        text: 'Siete ocho nueve diez once doce',
      }),
    );
    t.store.update({ current: value(await t.app.getScript.execute({ scriptId: t.current().id })) });
    await t.teleprompter.open('scroll');
    t.teleprompter.setMode('practice');
    await t.teleprompter.next(); // empieza
    t.advance(2_000);
    t.teleprompter.pause();
    t.teleprompter.pause();
    t.teleprompter.toggleRunning();
    t.advance(250);
    await t.teleprompter.next();
    expect(t.store.get().teleprompter?.index).toBe(1);
    t.teleprompter.previous();
    t.advance(0);
    await t.teleprompter.next();
    t.advance(2_250);
    await t.teleprompter.next(); // termina
    const report = t.store.get().teleprompter!.report!;
    expect(report.phrases.map((p) => p.actualSec)).toEqual([2.3, 2.3]);
    expect(report.measuredWpm).toBe(160);
    await t.teleprompter.next(); // con informe: nada
    t.teleprompter.previous();

    t.store.update({
      teleprompter: { ...t.store.get().teleprompter!, report: { ...report, measuredWpm: 172 } },
    });
    await t.teleprompter.applyCalibration();
    expect(t.current().wordsPerMinute).toBe(172);
    t.teleprompter.restart();
    expect(t.store.get().teleprompter).toMatchObject({ index: 0, report: null });
    t.teleprompter.close();
    expect(t.store.get().teleprompter).toBeNull();
  });

  it('graba la toma completa en memoria y la reproduce', async () => {
    const t = await setup();
    await t.teleprompter.open();
    await t.teleprompter.playFullTake(); // sin toma: nada
    await t.teleprompter.toggleFullTake();
    expect(t.store.get().teleprompter?.recording).toBe(true);
    await t.teleprompter.toggleFullTake();
    expect(t.store.get().teleprompter).toMatchObject({ recording: false, hasFullTake: true });
    const playing = t.teleprompter.playFullTake();
    await vi.waitFor(() => {
      expect(t.store.get().teleprompter?.playing).toBe(true);
    });
    await t.teleprompter.playFullTake(); // detiene
    await playing;
    expect(t.store.get().teleprompter?.playing).toBe(false);
    t.player.fail = true;
    await t.teleprompter.playFullTake();
    expect(t.store.get().notice?.message).toContain('No se pudo reproducir');
    t.teleprompter.close();
  });
});
