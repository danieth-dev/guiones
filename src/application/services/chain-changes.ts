import { ok, type DomainEvent, type Mutation, type Result, type Script } from '../../domain';

export type Step = (script: Script) => Result<Mutation>;

/**
 * Aplica varios cambios del dominio en orden como uno solo: si alguno falla,
 * no se aplica ninguno; si todos funcionan, se acumulan sus eventos.
 */
export const chainChanges = (script: Script, steps: readonly Step[]): Result<Mutation> => {
  let current = script;
  const events: DomainEvent[] = [];
  for (const step of steps) {
    const result = step(current);
    if (!result.ok) return result;
    current = result.value.script;
    events.push(...result.value.events);
  }
  return ok({ script: current, events });
};
