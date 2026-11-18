import type { PracticeSessionReport, ScriptSummary, ScriptView, Settings } from '../../application';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Notice {
  readonly kind: 'error' | 'info';
  readonly message: string;
}

/** Pide a la vista que enfoque una frase (el nonce distingue pedidos repetidos). */
export interface FocusRequest {
  readonly phraseId: string;
  readonly nonce: number;
}

/** Decir la frase en voz alta: grabarse y escucharse. */
export interface VoiceUiState {
  readonly supported: boolean;
  /** Frase que se está grabando. */
  readonly recordingId: string | null;
  readonly elapsedMs: number;
  readonly playingId: string | null;
}

export interface DictationUiState {
  readonly available: boolean;
  /** Frase en la que se está dictando. */
  readonly phraseId: string | null;
  /** Texto provisional que todavía puede cambiar. */
  readonly interim: string;
}

/** Estado de la interfaz: solo datos de vista, nunca entidades del dominio. */
export interface AppState {
  readonly loading: boolean;
  readonly scripts: readonly ScriptSummary[];
  readonly current: ScriptView | null;
  readonly saveStatus: SaveStatus;
  readonly notice: Notice | null;
  readonly focus: FocusRequest | null;
  /** Panel lateral abierto en pantallas pequeñas. */
  readonly navOpen: boolean;
  /** Diálogo "Nuevo guion" abierto. */
  readonly creating: boolean;
  readonly voice: VoiceUiState;
  readonly dictation: DictationUiState;
  /** Preferencias de la app; null hasta cargarlas. */
  readonly settings: Settings | null;
  readonly settingsOpen: boolean;
  /** Teleprompter abierto, o null. */
  readonly teleprompter: TeleprompterState | null;
}

export type TeleprompterMode = 'practice' | 'scroll';

/** Una frase tal como se lee en el teleprompter. */
export interface PrompterUnit {
  readonly id: string;
  readonly text: string;
  /** "Inicio · Primer plano · energía alta". */
  readonly direction: string;
  readonly note: string;
  readonly estimatedSec: number;
}

/**
 * Ensayo con teleprompter. Los tiempos se guardan como marcas de reloj: la
 * vista calcula lo transcurrido; el presentador no necesita "ticks".
 */
export interface TeleprompterState {
  readonly mode: TeleprompterMode;
  readonly units: readonly PrompterUnit[];
  readonly index: number;
  /** Marca de inicio de la frase actual (null: en pausa o sin empezar). */
  readonly unitStartedAt: number | null;
  /** Milisegundos acumulados por frase. */
  readonly elapsed: Readonly<Record<string, number>>;
  /** Informe al terminar el ensayo (comparación y calibración). */
  readonly report: PracticeSessionReport | null;
  /** Se está grabando el guion completo de corrido. */
  readonly recording: boolean;
  /** Hay una toma completa en memoria para escuchar. */
  readonly hasFullTake: boolean;
  readonly playing: boolean;
}

export const initialAppState: AppState = {
  loading: true,
  scripts: [],
  current: null,
  saveStatus: 'idle',
  notice: null,
  focus: null,
  navOpen: false,
  creating: false,
  voice: { supported: false, recordingId: null, elapsedMs: 0, playingId: null },
  dictation: { available: false, phraseId: null, interim: '' },
  settings: null,
  settingsOpen: false,
  teleprompter: null,
};

export const errorNotice = (message: string): Notice => ({ kind: 'error', message });
export const infoNotice = (message: string): Notice => ({ kind: 'info', message });
