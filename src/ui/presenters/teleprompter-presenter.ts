import type { AppServices, AudioPlayer, AudioRecorder, ScriptView } from '../../application';
import {
  errorNotice,
  type AppState,
  type PrompterUnit,
  type TeleprompterMode,
  type TeleprompterState,
} from '../store/app-state';
import type { Store } from '../store/store';
import type { CommandRunner } from './command-runner';
import { describeDeviceError } from './voice-presenter';

/** Frases con texto, en orden de lectura, con su dirección de actuación. */
export const prompterUnits = (script: ScriptView): readonly PrompterUnit[] =>
  script.phrases
    .filter((p) => p.text !== '')
    .map((p) => ({
      id: p.id,
      text: p.text,
      direction: `${p.sectionLabel} · ${p.shotLabel} · energía ${p.energyLabel.toLowerCase()}`,
      note: p.note,
      estimatedSec: p.seconds,
    }));

/**
 * Ensayar el guion en voz alta:
 *  - Práctica: una frase a la vez, con cronómetro real frente al estimado y,
 *    al final, tu ritmo real para ajustar la duración.
 *  - Lectura: el texto sube solo a tu velocidad, para grabar el video.
 *  - Toma completa: te grabas de corrido y te escuchas para ajustar el texto.
 */
export class TeleprompterPresenter {
  /** La toma completa vive solo mientras el teleprompter está abierto. */
  private fullTake: Blob | null = null;

  constructor(
    private readonly app: AppServices,
    private readonly store: Store<AppState>,
    private readonly runner: CommandRunner,
    private readonly recorder: AudioRecorder,
    private readonly player: AudioPlayer,
    private readonly now: () => number,
    private readonly flushPending: () => Promise<void>,
  ) {}

  async open(mode: TeleprompterMode = 'practice'): Promise<void> {
    await this.flushPending();
    const script = this.store.get().current;
    if (!script) return;
    const units = prompterUnits(script);
    if (units.length === 0) {
      this.store.update({ notice: errorNotice('Escribe al menos una frase para ensayar.') });
      return;
    }
    this.fullTake = null;
    this.store.update({
      navOpen: false,
      teleprompter: {
        mode,
        units,
        index: 0,
        unitStartedAt: null,
        elapsed: {},
        report: null,
        recording: false,
        hasFullTake: false,
        playing: false,
      },
    });
  }

  close(): void {
    if (this.state()?.recording) this.recorder.cancel();
    this.player.stop();
    this.fullTake = null;
    this.store.update({ teleprompter: null });
  }

  setMode(mode: TeleprompterMode): void {
    this.patch({ mode, index: 0, unitStartedAt: null, elapsed: {}, report: null });
  }

  /** Empieza o reanuda el cronómetro de la frase actual. */
  start(): void {
    const state = this.state();
    if (!state || state.unitStartedAt !== null) return;
    this.patch({ unitStartedAt: this.now() });
  }

  pause(): void {
    const state = this.state();
    if (!state || state.unitStartedAt === null) return;
    this.patch({ elapsed: this.accumulate(state), unitStartedAt: null });
  }

  toggleRunning(): void {
    if (this.state()?.unitStartedAt === null) this.start();
    else this.pause();
  }

  /** Avanza a la siguiente frase (la primera vez arranca); después de la última, termina. */
  async next(): Promise<void> {
    const state = this.state();
    if (!state || state.report) return;
    if (state.unitStartedAt === null && Object.keys(state.elapsed).length === 0) {
      this.start();
      return;
    }
    const elapsed = this.accumulate(state);
    if (state.index >= state.units.length - 1) {
      this.patch({ elapsed, unitStartedAt: null });
      await this.finish();
      return;
    }
    this.patch({ elapsed, index: state.index + 1, unitStartedAt: this.now() });
  }

  previous(): void {
    const state = this.state();
    if (!state || state.report || state.index === 0) return;
    const running = state.unitStartedAt !== null;
    this.patch({
      elapsed: this.accumulate(state),
      index: state.index - 1,
      unitStartedAt: running ? this.now() : null,
    });
  }

  /** Cierra el ensayo: compara tiempos y mide tu ritmo real. */
  async finish(): Promise<void> {
    const state = this.state();
    const script = this.store.get().current;
    if (!state || !script) return;
    const elapsed = this.accumulate(state);
    const result = await this.runner.run(() =>
      this.app.recordPracticeSession.execute({
        scriptId: script.id,
        phrases: state.units.map((u) => ({ phraseId: u.id, elapsedMs: elapsed[u.id] ?? 0 })),
      }),
    );
    if (result.ok) this.patch({ elapsed, unitStartedAt: null, report: result.value });
  }

  restart(): void {
    this.patch({ index: 0, unitStartedAt: null, elapsed: {}, report: null });
  }

  /** "Hablas a 172 palabras por minuto": usa esa velocidad para estimar la duración. */
  async applyCalibration(): Promise<void> {
    const state = this.state();
    const script = this.store.get().current;
    const measured = state?.report?.measuredWpm;
    if (!state?.report || !script || measured == null) return;
    const view = await this.runner.runView(() =>
      this.app.configureScript.execute({ scriptId: script.id, wordsPerMinute: measured }),
    );
    if (view) this.patch({ report: { ...state.report, currentWpm: view.wordsPerMinute } });
  }

  /** Graba (o termina de grabar) el guion completo de corrido. */
  async toggleFullTake(): Promise<void> {
    const state = this.state();
    if (!state) return;
    if (state.recording) {
      this.patch({ recording: false });
      try {
        this.fullTake = await this.recorder.stop();
        this.patch({ hasFullTake: true });
      } catch {
        this.store.update({ notice: errorNotice('No se pudo guardar la toma completa.') });
      }
      return;
    }
    this.player.stop();
    try {
      await this.recorder.start();
      this.patch({ recording: true, playing: false });
    } catch (error) {
      this.store.update({ notice: errorNotice(describeDeviceError(error)) });
    }
  }

  async playFullTake(): Promise<void> {
    const state = this.state();
    if (!state || !this.fullTake) return;
    if (state.playing) {
      this.player.stop();
      return;
    }
    this.patch({ playing: true });
    try {
      await this.player.play(this.fullTake);
    } catch {
      this.store.update({ notice: errorNotice('No se pudo reproducir la toma completa.') });
    } finally {
      if (this.state()) this.patch({ playing: false });
    }
  }

  private accumulate(state: TeleprompterState): Readonly<Record<string, number>> {
    if (state.unitStartedAt === null) return state.elapsed;
    const unit = state.units[state.index];
    if (!unit) return state.elapsed;
    const spent = Math.max(0, this.now() - state.unitStartedAt);
    return { ...state.elapsed, [unit.id]: (state.elapsed[unit.id] ?? 0) + spent };
  }

  private state(): TeleprompterState | null {
    return this.store.get().teleprompter;
  }

  private patch(patch: Partial<TeleprompterState>): void {
    const state = this.state();
    if (state) this.store.update({ teleprompter: { ...state, ...patch } });
  }
}
