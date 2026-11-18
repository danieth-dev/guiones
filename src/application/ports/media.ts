/**
 * Puertos de los dispositivos del navegador (micrófono, altavoz, dictado).
 * Los adaptadores viven en `infrastructure/media`; los presentadores los
 * reciben por inyección y traducen sus excepciones a avisos para el usuario.
 */

/** Graba una toma corta de voz. Funciona sin conexión. */
export interface AudioRecorder {
  isSupported(): boolean;
  /** Pide el micrófono y empieza a grabar. Rechaza si el usuario no da permiso. */
  start(): Promise<void>;
  /** Detiene la grabación y devuelve el audio. */
  stop(): Promise<Blob>;
  /** Descarta la grabación en curso, si la hay. */
  cancel(): void;
}

/** Reproduce una toma para escucharla inmediatamente. */
export interface AudioPlayer {
  /** Resuelve cuando termina la reproducción (o cuando se detiene). */
  play(audio: Blob): Promise<void>;
  stop(): void;
}

export interface SpeechHandlers {
  /** Texto reconocido; `isFinal` indica que ya no cambiará. */
  onText(text: string, isFinal: boolean): void;
  onEnd(): void;
  onError(message: string): void;
}

export interface SpeechSession {
  stop(): void;
}

/**
 * Dictado ("hablar antes de escribir"). Es opcional: en Chrome/Edge el audio se
 * procesa en servidores externos y requiere conexión; sin soporte se oculta.
 */
export interface SpeechToText {
  isAvailable(): boolean;
  listen(handlers: SpeechHandlers): SpeechSession;
}
