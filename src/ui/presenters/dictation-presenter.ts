import type { SpeechSession, SpeechToText } from '../../application';
import { errorNotice, type AppState, type DictationUiState } from '../store/app-state';
import type { Store } from '../store/store';

/** Dónde se escribe el texto dictado y de dónde se lee el texto previo. */
export interface DictationSinks {
  currentText(phraseId: string): string;
  write(phraseId: string, text: string): void;
  /** Guarda lo pendiente antes de dictar, para no perder lo último escrito. */
  prepare(phraseId: string): Promise<void>;
}

const join = (...parts: readonly string[]): string =>
  parts
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .join(' ');

/**
 * Dictado: decir la frase en vez de escribirla. Lo reconocido se agrega al
 * texto existente; lo provisional solo se muestra.
 */
export class DictationPresenter {
  private session: SpeechSession | null = null;
  /** Sube con cada stop(): un start() que esperaba y quedó atrás no abre otra sesión. */
  private generation = 0;

  constructor(
    private readonly store: Store<AppState>,
    private readonly speech: SpeechToText,
    private readonly sinks: DictationSinks,
  ) {
    this.patch({ available: speech.isAvailable() });
  }

  /** Revisa disponibilidad (p. ej. al recuperar o perder la conexión). */
  refreshAvailability(): void {
    const available = this.speech.isAvailable();
    if (!available) this.stop();
    this.patch({ available });
  }

  async toggle(phraseId: string): Promise<void> {
    const wasThis = this.dictation().phraseId === phraseId;
    this.stop();
    if (!wasThis) await this.start(phraseId);
  }

  stop(): void {
    this.generation += 1;
    this.session?.stop();
    this.session = null;
    this.patch({ phraseId: null, interim: '' });
  }

  /** Escribir a mano en la frase dictada corta el dictado: si no, lo dictado pisaría lo escrito. */
  typed(phraseId: string): void {
    if (this.dictation().phraseId === phraseId) this.stop();
  }

  private async start(phraseId: string): Promise<void> {
    if (!this.dictation().available) {
      this.store.update({ notice: errorNotice('El dictado necesita Chrome o Edge con conexión.') });
      return;
    }
    const generation = this.generation;
    await this.sinks.prepare(phraseId);
    if (generation !== this.generation) return;
    let text = this.sinks.currentText(phraseId);
    this.patch({ phraseId, interim: '' });

    const session = this.speech.listen({
      onText: (recognized, isFinal) => {
        if (this.session !== session) return;
        if (isFinal) {
          text = join(text, recognized);
          this.sinks.write(phraseId, text);
          this.patch({ interim: '' });
        } else {
          this.patch({ interim: recognized });
        }
      },
      onError: (message) => {
        this.store.update({ notice: errorNotice(message) });
      },
      onEnd: () => {
        if (this.session === session) {
          this.session = null;
          this.patch({ phraseId: null, interim: '' });
        }
      },
    });
    this.session = session;
  }

  private dictation(): DictationUiState {
    return this.store.get().dictation;
  }

  private patch(changes: Partial<DictationUiState>): void {
    this.store.update((state) => ({ dictation: { ...state.dictation, ...changes } }));
  }
}
