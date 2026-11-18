import type { AppServices, AudioPlayer, AudioRecorder } from '../../application';
import { errorNotice, type AppState, type VoiceUiState } from '../store/app-state';
import type { Store } from '../store/store';
import type { CommandRunner } from './command-runner';

export interface VoiceOptions {
  /** Una frase se dice de un tirón: la grabación se corta sola pasado este tiempo. */
  readonly maxRecordingMs: number;
  readonly tickMs: number;
}

const DEFAULTS: VoiceOptions = { maxRecordingMs: 30_000, tickMs: 200 };

export const describeDeviceError = (error: unknown): string => {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Permite el uso del micrófono para grabar tu voz.';
  }
  if (name === 'NotFoundError') return 'No se encontró ningún micrófono.';
  return 'No se pudo usar el micrófono.';
};

/**
 * Decir la frase en voz alta: grabarse y escucharse al instante para ajustar
 * cómo está escrita. Antes de grabar guarda el texto pendiente, para que la
 * toma corresponda a lo escrito.
 */
export class VoicePresenter {
  private tick: ReturnType<typeof setInterval> | null = null;
  private autoStop: ReturnType<typeof setTimeout> | null = null;
  private startedAt = 0;
  private readonly options: VoiceOptions;

  constructor(
    private readonly app: AppServices,
    private readonly store: Store<AppState>,
    private readonly runner: CommandRunner,
    private readonly recorder: AudioRecorder,
    private readonly player: AudioPlayer,
    private readonly flushText: (phraseId: string) => Promise<void>,
    options: Partial<VoiceOptions> = {},
  ) {
    this.options = { ...DEFAULTS, ...options };
    this.patch({ supported: recorder.isSupported() });
  }

  /** Empieza a grabar o, si ya se graba esa frase, termina la toma. */
  async toggleRecording(phraseId: string): Promise<void> {
    const { recordingId } = this.voice();
    if (recordingId === phraseId) {
      await this.stopRecording();
      return;
    }
    if (recordingId) await this.stopRecording();
    await this.startRecording(phraseId);
  }

  async play(phraseId: string): Promise<void> {
    const take = this.store.get().current?.phrases.find((p) => p.id === phraseId)?.take;
    if (!take) return;
    if (this.voice().playingId === phraseId) {
      this.player.stop();
      return;
    }
    const audio = await this.app.getTake.execute({ audioId: take });
    if (!audio.ok || !audio.value) {
      this.store.update({ notice: errorNotice('No se encontró la grabación. Vuelve a grabar.') });
      return;
    }
    this.patch({ playingId: phraseId });
    try {
      await this.player.play(audio.value);
    } catch {
      this.store.update({ notice: errorNotice('No se pudo reproducir la grabación.') });
    } finally {
      if (this.voice().playingId === phraseId) this.patch({ playingId: null });
    }
  }

  /** Descarta la grabación en curso sin guardarla (p. ej. al cambiar de guion). */
  cancel(): void {
    this.clearTimers();
    this.recorder.cancel();
    this.player.stop();
    this.patch({ recordingId: null, elapsedMs: 0, playingId: null });
  }

  private async startRecording(phraseId: string): Promise<void> {
    if (!this.voice().supported) {
      this.store.update({ notice: errorNotice('Este navegador no permite grabar audio.') });
      return;
    }
    this.player.stop();
    await this.flushText(phraseId);
    try {
      await this.recorder.start();
    } catch (error) {
      this.store.update({ notice: errorNotice(describeDeviceError(error)) });
      return;
    }
    this.startedAt = Date.now();
    this.patch({ recordingId: phraseId, elapsedMs: 0, playingId: null });
    this.clearTimers(); // un doble clic arranca dos veces: que no quede un temporizador suelto
    this.tick = setInterval(() => {
      this.patch({ elapsedMs: Date.now() - this.startedAt });
    }, this.options.tickMs);
    this.autoStop = setTimeout(() => void this.stopRecording(), this.options.maxRecordingMs);
  }

  private async stopRecording(): Promise<void> {
    const phraseId = this.voice().recordingId;
    if (!phraseId) return;
    this.clearTimers();
    this.patch({ recordingId: null, elapsedMs: 0 });
    let audio: Blob;
    try {
      audio = await this.recorder.stop();
    } catch {
      this.store.update({ notice: errorNotice('La grabación se interrumpió. Intenta de nuevo.') });
      return;
    }
    const script = this.store.get().current;
    if (!script) return;
    const view = await this.runner.runView(() =>
      this.app.recordTake.execute({ scriptId: script.id, phraseId, audio }),
    );
    // Escuchar inmediatamente cómo sonó.
    if (view) await this.play(phraseId);
  }

  private clearTimers(): void {
    if (this.tick) clearInterval(this.tick);
    if (this.autoStop) clearTimeout(this.autoStop);
    this.tick = null;
    this.autoStop = null;
  }

  private voice(): VoiceUiState {
    return this.store.get().voice;
  }

  private patch(changes: Partial<VoiceUiState>): void {
    this.store.update((state) => ({ voice: { ...state.voice, ...changes } }));
  }
}
