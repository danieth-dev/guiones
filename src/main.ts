/**
 * Composition root: único punto que conoce los adaptadores concretos y conecta
 * dominio → aplicación → infraestructura → interfaz.
 */
import './ui/styles/app.css';
import {
  createAppServices,
  type AudioStore,
  type ScriptRepository,
  type SettingsStore,
} from './application';
import {
  CryptoIdGenerator,
  EXAMPLE_SCRIPT_MARKDOWN,
  HtmlAudioPlayer,
  IndexedDbAudioStore,
  IndexedDbScriptRepository,
  InMemoryAudioStore,
  InMemoryScriptRepository,
  InMemorySettingsStore,
  LocalStorageSettingsStore,
  MarkdownDocumentCodec,
  MarkdownExporter,
  MediaRecorderAdapter,
  openDatabase,
  SystemClock,
  TextExporter,
  WebSpeechAdapter,
} from './infrastructure';
import { CommandRunner } from './ui/presenters/command-runner';
import { DictationPresenter } from './ui/presenters/dictation-presenter';
import { PhrasesPresenter } from './ui/presenters/phrases-presenter';
import { ScriptsPresenter } from './ui/presenters/scripts-presenter';
import { SettingsPresenter } from './ui/presenters/settings-presenter';
import { TeleprompterPresenter } from './ui/presenters/teleprompter-presenter';
import { VoicePresenter } from './ui/presenters/voice-presenter';
import { initialAppState, infoNotice, type AppState } from './ui/store/app-state';
import { Store } from './ui/store/store';
import { AppShell } from './ui/views/app-shell';

interface Storage {
  readonly scripts: ScriptRepository;
  readonly audio: AudioStore;
  readonly persistent: boolean;
}

/** IndexedDB si está disponible; si no (modo privado, bloqueos), memoria con aviso. */
const openStorage = async (): Promise<Storage> => {
  try {
    const db = await openDatabase(indexedDB);
    // Pide al navegador que no borre los datos ante falta de espacio (best-effort).
    if ('storage' in navigator && 'persist' in navigator.storage) {
      void navigator.storage.persist();
    }
    return {
      scripts: new IndexedDbScriptRepository(db),
      audio: new IndexedDbAudioStore(db),
      persistent: true,
    };
  } catch (error) {
    console.error('IndexedDB no disponible; se usa memoria', error);
    return {
      scripts: new InMemoryScriptRepository(),
      audio: new InMemoryAudioStore(),
      persistent: false,
    };
  }
};

/** Preferencias por dispositivo; si `localStorage` está bloqueado, en memoria. */
const openSettingsStore = (): SettingsStore => {
  try {
    return new LocalStorageSettingsStore(window.localStorage);
  } catch {
    return new InMemorySettingsStore();
  }
};

const bootstrap = async (root: HTMLElement): Promise<void> => {
  const storage = await openStorage();
  const app = createAppServices({
    scripts: storage.scripts,
    audio: storage.audio,
    settings: openSettingsStore(),
    exporters: [new TextExporter(), new MarkdownExporter()],
    documents: new MarkdownDocumentCodec(),
    ids: new CryptoIdGenerator(),
    clock: new SystemClock(),
  });

  const store = new Store<AppState>(initialAppState);
  const runner = new CommandRunner(store);
  const phrases = new PhrasesPresenter(app, store, runner);
  const voice = new VoicePresenter(
    app,
    store,
    runner,
    new MediaRecorderAdapter(),
    new HtmlAudioPlayer(),
    (phraseId) => phrases.flush(phraseId),
  );
  const dictation = new DictationPresenter(store, new WebSpeechAdapter(), {
    currentText: (phraseId) =>
      store.get().current?.phrases.find((p) => p.id === phraseId)?.text ?? '',
    write: (phraseId, text) => {
      phrases.editText(phraseId, text);
    },
    prepare: (phraseId) => phrases.flush(phraseId),
  });
  // Al cambiar de guion: guardar lo pendiente y cortar micrófono y dictado.
  const flushAll = async (): Promise<void> => {
    voice.cancel();
    dictation.stop();
    await phrases.flush();
  };
  const scripts = new ScriptsPresenter(app, store, runner, flushAll, EXAMPLE_SCRIPT_MARKDOWN);
  const settings = new SettingsPresenter(app, store, runner);
  const teleprompter = new TeleprompterPresenter(
    app,
    store,
    runner,
    new MediaRecorderAdapter(),
    new HtmlAudioPlayer(),
    () => Date.now(),
    flushAll,
  );

  new AppShell(root, store, { scripts, phrases, voice, dictation, settings, teleprompter });

  // No perder lo último escrito al cambiar de pestaña o cerrar.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void phrases.flush();
  });
  // El dictado depende de la conexión: se oculta o reaparece según el estado de la red.
  window.addEventListener('online', () => {
    dictation.refreshAvailability();
  });
  window.addEventListener('offline', () => {
    dictation.refreshAvailability();
  });

  // Los ajustes primero: el primer guion nuevo usa su velocidad.
  await settings.load();
  await scripts.start();
  if (!storage.persistent) {
    store.update({
      notice: infoNotice(
        'Este navegador no permite guardar datos: tus cambios se perderán al cerrar.',
      ),
    });
  }
};

const root = document.querySelector<HTMLElement>('#app');
if (root) void bootstrap(root);
