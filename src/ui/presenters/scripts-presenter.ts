import type { AppServices, ExportFile, ExportFormat } from '../../application';
import { infoNotice, type AppState } from '../store/app-state';
import type { Store } from '../store/store';
import type { CommandRunner } from './command-runner';

/**
 * Tus guiones y los datos generales del guion abierto (título, formato).
 * Antes de cambiar de guion guarda lo pendiente (`flushPending`).
 */
export class ScriptsPresenter {
  constructor(
    private readonly app: AppServices,
    private readonly store: Store<AppState>,
    private readonly runner: CommandRunner,
    private readonly flushPending: () => Promise<void>,
    /** Guion de ejemplo (Markdown) para el primer uso; sin él se crea uno vacío. */
    private readonly example: string | null = null,
  ) {}

  /** Abre el guion más reciente o, la primera vez, el de ejemplo. */
  async start(): Promise<void> {
    const list = await this.runner.run(() => this.app.listScripts.execute());
    const scripts = list.ok ? list.value : [];
    this.store.update({ scripts });
    const latest = scripts[0];
    if (latest) await this.open(latest.id);
    else if (!(await this.openExample())) await this.create({});
    this.store.update({ loading: false, saveStatus: 'idle' });
  }

  async open(scriptId: string): Promise<void> {
    await this.flushPending();
    await this.runner.runView(() => this.app.getScript.execute({ scriptId }));
    this.store.update({ navOpen: false });
  }

  /** Abre o cierra el diálogo "Nuevo guion". */
  setCreating(creating: boolean): void {
    this.store.update({ creating, navOpen: false });
  }

  /** Crea un guion con el esqueleto de su formato y lo abre. */
  async create(input: { readonly title?: string; readonly formatId?: string }): Promise<boolean> {
    await this.flushPending();
    const wordsPerMinute = this.store.get().settings?.defaultWpm;
    const view = await this.runner.runView(() =>
      this.app.createScript.execute({
        ...input,
        ...(wordsPerMinute ? { wordsPerMinute } : {}),
      }),
    );
    if (view) this.store.update({ creating: false, navOpen: false });
    return view !== null;
  }

  async rename(title: string): Promise<void> {
    await this.configure({ title });
  }

  async changeFormat(formatId: string): Promise<void> {
    await this.configure({ formatId });
  }

  /** Genera el archivo del guion abierto; la vista se encarga de descargarlo. */
  async exportCurrent(format: ExportFormat): Promise<ExportFile | null> {
    const current = this.store.get().current;
    if (!current) return null;
    await this.flushPending();
    const result = await this.runner.run(() =>
      this.app.exportScript.execute({ scriptId: current.id, format }),
    );
    return result.ok ? result.value : null;
  }

  /** Guion como Markdown editable (Obsidian). */
  async exportDocument(): Promise<ExportFile | null> {
    const current = this.store.get().current;
    if (!current) return null;
    await this.flushPending();
    const result = await this.runner.run(() =>
      this.app.exportScriptDocument.execute({ scriptId: current.id }),
    );
    return result.ok ? result.value : null;
  }

  /** Importa un guion desde Markdown como guion nuevo y lo abre. */
  async importDocument(text: string): Promise<boolean> {
    await this.flushPending();
    const view = await this.runner.runView(() => this.app.importScriptDocument.execute({ text }));
    if (!view) return false;
    this.store.update({ navOpen: false, notice: infoNotice(`Guion importado: «${view.title}».`) });
    return true;
  }

  async remove(scriptId: string): Promise<void> {
    await this.flushPending();
    const result = await this.runner.run(() => this.app.deleteScript.execute({ scriptId }));
    if (!result.ok) return;
    const scripts = this.store.get().scripts.filter((s) => s.id !== scriptId);
    this.store.update({ scripts });
    if (this.store.get().current?.id !== scriptId) return;
    const next = scripts[0];
    if (next) await this.open(next.id);
    else await this.create({});
  }

  setNavOpen(open: boolean): void {
    this.store.update({ navOpen: open });
  }

  dismissNotice(): void {
    this.store.update({ notice: null });
  }

  private async openExample(): Promise<boolean> {
    if (!this.example) return false;
    const example = this.example;
    const result = await this.app.importScriptDocument.execute({ text: example });
    if (!result.ok) return false;
    this.runner.showScript(result.value);
    this.store.update({
      notice: infoNotice(
        'Te dejamos un guion de ejemplo. Escribe una frase por línea y elige su plano y energía; crea el tuyo con «Nuevo guion».',
      ),
    });
    return true;
  }

  private async configure(input: { title?: string; formatId?: string }): Promise<void> {
    const current = this.store.get().current;
    if (!current) return;
    await this.runner.runView(() =>
      this.app.configureScript.execute({ scriptId: current.id, ...input }),
    );
  }
}
