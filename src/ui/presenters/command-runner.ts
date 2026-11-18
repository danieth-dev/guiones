import type { AppError, ScriptSummary, ScriptView } from '../../application';
import type { Result } from '../../domain';
import { errorNotice, type AppState } from '../store/app-state';
import type { Store } from '../store/store';

/** Resumen de lista derivado de la vista completa (evita releer todos los guiones). */
export const summaryOf = (view: ScriptView): ScriptSummary => ({
  id: view.id,
  title: view.title,
  formatLabel: view.format.label,
  estimatedSec: view.estimatedSec,
  updatedAt: view.updatedAt,
});

/**
 * Ejecuta los casos de uso de a uno (cola FIFO). Cada comando carga, modifica y
 * guarda el guion: si dos corrieran a la vez, el segundo pisaría al primero.
 * También refleja el estado de guardado y los errores en el store.
 */
export class CommandRunner {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly store: Store<AppState>) {}

  run<T>(work: () => Promise<Result<T, AppError>>): Promise<Result<T, AppError>> {
    const task = this.tail.then(async () => {
      this.store.update({ saveStatus: 'saving' });
      const result = await work();
      if (result.ok) {
        this.store.update({ saveStatus: 'saved' });
      } else {
        this.store.update({
          saveStatus: result.error.code === 'STORAGE_FAILURE' ? 'error' : 'saved',
          notice: errorNotice(result.error.message),
        });
      }
      return result;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }

  /** Ejecuta un comando que devuelve el guion actualizado y lo publica en el store. */
  async runView(work: () => Promise<Result<ScriptView, AppError>>): Promise<ScriptView | null> {
    const result = await this.run(work);
    if (!result.ok) return null;
    this.showScript(result.value);
    return result.value;
  }

  showScript(view: ScriptView): void {
    this.store.update((state) => ({
      current: view,
      scripts: state.scripts.some((s) => s.id === view.id)
        ? state.scripts.map((s) => (s.id === view.id ? summaryOf(view) : s))
        : [summaryOf(view), ...state.scripts],
    }));
  }

  /** Espera a que terminen todos los comandos encolados. */
  idle(): Promise<void> {
    return this.tail.then(() => undefined);
  }
}
