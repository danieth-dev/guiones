import {
  domainError,
  err,
  isEnergy,
  isSection,
  isShot,
  ok,
  phraseId,
  Script,
  scriptId,
  SpeechRate,
  SpokenText,
  VideoFormat,
  VisualCue,
  type Result,
} from '../../domain';
import type { ScriptView } from '../dto/script-view';
import type { DocumentCodec, ScriptDocument } from '../ports/document-codec';
import type { ExportFile, ExportFormat, ScriptExporter } from '../ports/exporter';
import type { ScriptRepository } from '../ports/script-repository';
import type { Clock, IdGenerator } from '../ports/system';
import { chainChanges, type Step } from '../services/chain-changes';
import { slugify } from '../services/file-names';
import type { ScriptWorkspace } from '../services/script-workspace';
import { appError, type AppError } from '../shared/app-error';
import type { UseCase } from '../shared/use-case';

export interface ExportScriptInput {
  readonly scriptId: string;
  readonly format: ExportFormat;
}

/** Tabla de rodaje (.md) o texto plano (.txt) para grabar. */
export class ExportScript implements UseCase<ExportScriptInput, ExportFile> {
  private readonly exporters: ReadonlyMap<ExportFormat, ScriptExporter>;

  constructor(
    exporters: readonly ScriptExporter[],
    private readonly workspace: ScriptWorkspace,
  ) {
    this.exporters = new Map(exporters.map((e) => [e.format, e]));
  }

  async execute({
    scriptId: id,
    format,
  }: ExportScriptInput): Promise<Result<ExportFile, AppError>> {
    const exporter = this.exporters.get(format);
    if (!exporter)
      return err(appError('UNSUPPORTED', `Formato de exportación no disponible: ${format}.`));
    const script = await this.workspace.load(id);
    return script.ok ? ok(exporter.export(this.workspace.view(script.value))) : script;
  }
}

/** Dominio → documento portable. */
export const toScriptDocument = (script: Script): ScriptDocument => ({
  title: script.title,
  formatId: script.format.id,
  wordsPerMinute: script.rate.wordsPerMinute,
  phrases: script.phrases.map((p) => ({
    section: p.section,
    shot: p.shot,
    energy: p.energy,
    note: p.note.value,
    text: p.text.value,
  })),
});

/** Descarga el guion como Markdown editable (compatible con Obsidian). */
export class ExportScriptDocument implements UseCase<{ readonly scriptId: string }, ExportFile> {
  constructor(
    private readonly codec: DocumentCodec,
    private readonly workspace: ScriptWorkspace,
  ) {}

  async execute(input: { readonly scriptId: string }): Promise<Result<ExportFile, AppError>> {
    const script = await this.workspace.load(input.scriptId);
    if (!script.ok) return script;
    return ok({
      fileName: `${slugify(script.value.title)}.${this.codec.extension}`,
      mimeType: this.codec.mimeType,
      content: this.codec.serializeScript(toScriptDocument(script.value)),
    });
  }
}

const invalid = (message: string) => err(domainError('INVALID_VALUE', message));

/** Crea un guion nuevo desde un documento; todo pasa por las reglas del dominio. */
export class ImportScriptDocument implements UseCase<{ readonly text: string }, ScriptView> {
  constructor(
    private readonly codec: DocumentCodec,
    private readonly scripts: ScriptRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: { readonly text: string }): Promise<Result<ScriptView, AppError>> {
    return this.workspace.guard(async () => {
      const parsed = this.codec.parseScript(input.text);
      if (!parsed.ok) return parsed;
      const doc = parsed.value;
      const format = VideoFormat.byId(doc.formatId);
      if (!format.ok) return format;
      const rate = SpeechRate.create(doc.wordsPerMinute);
      if (!rate.ok) return rate;
      const created = Script.create({
        id: scriptId(this.ids.next('sc')),
        format: format.value,
        rate: rate.value,
        title: doc.title,
        now: this.clock.now(),
      });
      if (!created.ok) return created;

      const steps: Step[] = [];
      for (const phrase of doc.phrases) {
        const { section, shot, energy } = phrase;
        if (!isSection(section)) return invalid(`Parte desconocida: ${section}.`);
        if (shot !== null && !isShot(shot)) return invalid(`Plano desconocido: ${shot}.`);
        if (!isEnergy(energy)) return invalid(`Energía desconocida: ${energy}.`);
        const note = VisualCue.create(phrase.note);
        if (!note.ok) return note;
        const id = phraseId(this.ids.next('fr'));
        steps.push((s) =>
          s.addPhrase(id, section, {
            text: SpokenText.of(phrase.text),
            shot,
            energy,
            note: note.value,
          }),
        );
      }
      const filled = chainChanges(created.value, steps);
      if (!filled.ok) return filled;
      await this.scripts.save(filled.value.script);
      return ok(this.workspace.view(filled.value.script));
    });
  }
}
