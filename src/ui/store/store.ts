export type Listener<S> = (state: S, previous: S) => void;

/**
 * Patrón Observer: contenedor de estado de la interfaz. Inmutable por fuera:
 * solo se cambia con `update`, y cada cambio notifica a las vistas suscritas.
 */
export class Store<S extends object> {
  private readonly listeners = new Set<Listener<S>>();

  constructor(private state: S) {}

  get(): S {
    return this.state;
  }

  update(patch: Partial<S> | ((state: S) => Partial<S>)): void {
    const previous = this.state;
    const changes = typeof patch === 'function' ? patch(previous) : patch;
    this.state = { ...previous, ...changes };
    for (const listener of this.listeners) listener(this.state, previous);
  }

  /** Devuelve la función para cancelar la suscripción. */
  subscribe(listener: Listener<S>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
