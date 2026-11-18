import type { SpeechHandlers, SpeechSession, SpeechToText } from '../../application';

/** Tipos mínimos de la Web Speech API (no forman parte de lib.dom en todos los TS). */
interface RecognitionAlternative {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly 0: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionConstructor = new () => Recognition;

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  'not-allowed': 'Permite el uso del micrófono para dictar.',
  'service-not-allowed': 'El navegador no permite el dictado en esta página.',
  network: 'El dictado necesita conexión a internet.',
  'no-speech': 'No se escuchó nada. Intenta de nuevo, más cerca del micrófono.',
  'audio-capture': 'No se encontró un micrófono.',
};

const findConstructor = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, RecognitionConstructor | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Dictado con Web Speech API. En Chrome/Edge el audio se envía a servidores
 * del navegador, por eso solo se ofrece con conexión.
 */
export class WebSpeechAdapter implements SpeechToText {
  constructor(private readonly lang: string = WebSpeechAdapter.defaultLang()) {}

  static defaultLang(): string {
    const browser = typeof navigator === 'undefined' ? '' : navigator.language;
    return browser.toLowerCase().startsWith('es') ? browser : 'es-ES';
  }

  isAvailable(): boolean {
    return findConstructor() !== null && navigator.onLine;
  }

  listen(handlers: SpeechHandlers): SpeechSession {
    const Ctor = findConstructor();
    if (!Ctor) {
      handlers.onError('Este navegador no permite dictar.');
      handlers.onEnd();
      return { stop: () => undefined };
    }
    const recognition = new Ctor();
    recognition.lang = this.lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result) handlers.onText(result[0].transcript.trim(), result.isFinal);
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        handlers.onError(ERROR_MESSAGES[event.error] ?? `Error de dictado: ${event.error}.`);
      }
    };
    recognition.onend = () => {
      handlers.onEnd();
    };
    recognition.start();
    return {
      stop: () => {
        recognition.stop();
      },
    };
  }
}
