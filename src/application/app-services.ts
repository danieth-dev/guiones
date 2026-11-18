import type { AudioStore } from './ports/audio-store';
import type { DocumentCodec } from './ports/document-codec';
import type { ScriptExporter } from './ports/exporter';
import type { ScriptRepository } from './ports/script-repository';
import type { SettingsStore } from './ports/settings-store';
import type { Clock, IdGenerator } from './ports/system';
import { ScriptWorkspace } from './services/script-workspace';
import {
  ExportScript,
  ExportScriptDocument,
  ImportScriptDocument,
} from './use-cases/export-commands';
import {
  AddPhrase,
  EditPhrase,
  MovePhrase,
  RemovePhrase,
  SplitPhrase,
} from './use-cases/phrase-commands';
import {
  ConfigureScript,
  CreateScript,
  DeleteScript,
  GetScript,
  ListScripts,
} from './use-cases/script-commands';
import { GetSettings, UpdateSettings } from './use-cases/settings-commands';
import { GetTake, RecordPracticeSession, RecordTake } from './use-cases/take-commands';

/** Adaptadores que la composición (main.ts) entrega a la aplicación. */
export interface AppDependencies {
  readonly scripts: ScriptRepository;
  readonly audio: AudioStore;
  readonly settings: SettingsStore;
  readonly exporters: readonly ScriptExporter[];
  /** Formato de documento portable (Markdown de ida y vuelta). */
  readonly documents: DocumentCodec;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

/** Fachada de la aplicación: lo único que la interfaz necesita conocer. */
export interface AppServices {
  // Guiones
  readonly createScript: CreateScript;
  readonly listScripts: ListScripts;
  readonly getScript: GetScript;
  readonly deleteScript: DeleteScript;
  readonly configureScript: ConfigureScript;
  // Frases
  readonly addPhrase: AddPhrase;
  readonly editPhrase: EditPhrase;
  readonly splitPhrase: SplitPhrase;
  readonly movePhrase: MovePhrase;
  readonly removePhrase: RemovePhrase;
  // Decirlo en voz alta
  readonly recordTake: RecordTake;
  readonly getTake: GetTake;
  readonly recordPracticeSession: RecordPracticeSession;
  // Archivos
  readonly exportScript: ExportScript;
  readonly exportScriptDocument: ExportScriptDocument;
  readonly importScriptDocument: ImportScriptDocument;
  // Ajustes
  readonly getSettings: GetSettings;
  readonly updateSettings: UpdateSettings;
}

/** Arma todos los casos de uso con sus dependencias (inyección manual, sin contenedor). */
export const createAppServices = (deps: AppDependencies): AppServices => {
  const workspace = new ScriptWorkspace(deps.scripts, deps.audio, deps.clock);
  return {
    createScript: new CreateScript(deps.scripts, deps.ids, deps.clock, workspace),
    listScripts: new ListScripts(deps.scripts, workspace),
    getScript: new GetScript(workspace),
    deleteScript: new DeleteScript(deps.scripts, deps.audio, workspace),
    configureScript: new ConfigureScript(workspace),
    addPhrase: new AddPhrase(deps.ids, workspace),
    editPhrase: new EditPhrase(workspace),
    splitPhrase: new SplitPhrase(deps.ids, workspace),
    movePhrase: new MovePhrase(workspace),
    removePhrase: new RemovePhrase(workspace),
    recordTake: new RecordTake(deps.audio, deps.ids, workspace),
    getTake: new GetTake(deps.audio, workspace),
    recordPracticeSession: new RecordPracticeSession(workspace),
    exportScript: new ExportScript(deps.exporters, workspace),
    exportScriptDocument: new ExportScriptDocument(deps.documents, workspace),
    importScriptDocument: new ImportScriptDocument(
      deps.documents,
      deps.scripts,
      deps.ids,
      deps.clock,
      workspace,
    ),
    getSettings: new GetSettings(deps.settings, workspace),
    updateSettings: new UpdateSettings(deps.settings, workspace),
  };
};
