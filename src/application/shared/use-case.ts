import type { Result } from '../../domain';
import type { AppError } from './app-error';

/**
 * Patrón Command: cada caso de uso es un objeto con una única operación.
 * Nunca lanza: los fallos esperados y los de infraestructura llegan como `Result`.
 */
export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output, AppError>>;
}
