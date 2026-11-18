import type { AppServices, EditPhraseInput, ScriptView } from '../../application';
import type { Energy, Section, Shot } from '../../domain';
import type { AppState } from '../store/app-state';
import type { Store } from '../store/store';
import type { CommandRunner } from './command-runner';

type PendingEdit = Omit<EditPhraseInput, 'scriptId' | 'phraseId'>;

interface Pending {
  readonly scriptId: string;
  edit: PendingEdit;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Frases del guion: traduce lo que hace el usuario en casos de uso. Lo que se
 * escribe se guarda con debounce (autoguardado) y se agrupa por frase, para no
 * crear un cambio por cada tecla.
 */
export class PhrasesPresenter {
  private readonly pending = new Map<string, Pending>();
  private focusNonce = 0;

  constructor(
    private readonly app: AppServices,
    private readonly store: Store<AppState>,
    private readonly runner: CommandRunner,
    private readonly debounceMs = 400,
  ) {}

  // ───────────── Edición con autoguardado ─────────────

  editText(phraseId: string, text: string): void {
    this.schedule(phraseId, { text });
  }

  editNote(phraseId: string, note: string): void {
    this.schedule(phraseId, { note });
  }

  /** `null` vuelve al plano sugerido por el formato. */
  setShot(phraseId: string, shot: Shot | null): Promise<void> {
    return this.editNow(phraseId, { shot });
  }

  setEnergy(phraseId: string, energy: Energy): Promise<void> {
    return this.editNow(phraseId, { energy });
  }

  setSection(phraseId: string, section: Section): Promise<void> {
    return this.editNow(phraseId, { section });
  }

  /** Guarda ya los cambios pendientes de una frase (o de todas). */
  async flush(phraseId?: string): Promise<void> {
    const ids = phraseId === undefined ? [...this.pending.keys()] : [phraseId];
    await Promise.all(ids.map((id) => this.save(id)));
  }

  // ───────────── Estructura ─────────────

  /** Agrega una frase después de otra (o antes del cierre) y la enfoca. */
  async add(afterId?: string, section?: Section): Promise<void> {
    const script = this.current();
    if (!script) return;
    if (afterId) await this.flush(afterId);
    const view = await this.runner.runView(() =>
      this.app.addPhrase.execute({
        scriptId: script.id,
        ...(afterId ? { afterId } : {}),
        ...(section ? { section } : {}),
      }),
    );
    if (view) this.focusNew(script, view);
  }

  /** Divide la frase en dos respiraciones. */
  async split(phraseId: string): Promise<void> {
    await this.flush(phraseId);
    const script = this.current();
    if (!script) return;
    const view = await this.runner.runView(() =>
      this.app.splitPhrase.execute({ scriptId: script.id, phraseId }),
    );
    if (view) this.focusNew(script, view);
  }

  async moveBy(phraseId: string, delta: number): Promise<void> {
    const script = this.current();
    const index = script?.phrases.findIndex((p) => p.id === phraseId) ?? -1;
    if (!script || index < 0) return;
    await this.flush(phraseId);
    const view = await this.runner.runView(() =>
      this.app.movePhrase.execute({
        scriptId: script.id,
        phraseId,
        toIndex: Math.max(0, index + delta),
      }),
    );
    if (view) this.requestFocus(phraseId);
  }

  async remove(phraseId: string): Promise<void> {
    const script = this.current();
    if (!script) return;
    this.discard(phraseId);
    const index = script.phrases.findIndex((p) => p.id === phraseId);
    const view = await this.runner.runView(() =>
      this.app.removePhrase.execute({ scriptId: script.id, phraseId }),
    );
    const neighbor = view?.phrases[Math.min(index, view.phrases.length - 1)];
    if (neighbor) this.requestFocus(neighbor.id);
  }

  focus(phraseId: string): void {
    this.requestFocus(phraseId);
  }

  // ───────────── Internos ─────────────

  private current(): ScriptView | null {
    return this.store.get().current;
  }

  private discard(phraseId: string): void {
    const pending = this.pending.get(phraseId);
    if (pending) clearTimeout(pending.timer);
    this.pending.delete(phraseId);
  }

  private schedule(phraseId: string, edit: PendingEdit): void {
    const script = this.current();
    if (!script) return;
    const existing = this.pending.get(phraseId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => void this.save(phraseId), this.debounceMs);
    this.pending.set(phraseId, {
      scriptId: existing?.scriptId ?? script.id,
      edit: { ...existing?.edit, ...edit },
      timer,
    });
    this.store.update({ saveStatus: 'saving' });
  }

  private async editNow(phraseId: string, edit: PendingEdit): Promise<void> {
    const script = this.current();
    if (!script) return;
    const pending = this.pending.get(phraseId);
    this.discard(phraseId);
    await this.runner.runView(() =>
      this.app.editPhrase.execute({
        scriptId: pending?.scriptId ?? script.id,
        phraseId,
        ...pending?.edit,
        ...edit,
      }),
    );
  }

  private async save(phraseId: string): Promise<void> {
    const pending = this.pending.get(phraseId);
    if (!pending) return;
    this.discard(phraseId);
    const result = await this.runner.run(() =>
      this.app.editPhrase.execute({ scriptId: pending.scriptId, phraseId, ...pending.edit }),
    );
    // Solo se publica si el usuario sigue en ese guion.
    if (result.ok && this.current()?.id === pending.scriptId) this.runner.showScript(result.value);
  }

  private focusNew(before: ScriptView, after: ScriptView): void {
    const known = new Set(before.phrases.map((p) => p.id));
    const created = after.phrases.find((p) => !known.has(p.id));
    if (created) this.requestFocus(created.id);
  }

  private requestFocus(phraseId: string): void {
    this.store.update({ focus: { phraseId, nonce: ++this.focusNonce } });
  }
}
