import type { DomainErrorCode } from '../../domain';

export type AppErrorCode = DomainErrorCode | 'STORAGE_FAILURE' | 'UNSUPPORTED';

/**
 * Error de un caso de uso: un error de dominio (que encaja tal cual en este
 * tipo) o un fallo de infraestructura ya traducido.
 */
export interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
}

export const appError = (code: AppErrorCode, message: string): AppError => ({ code, message });

export const scriptNotFound = (): AppError => appError('NOT_FOUND', 'No existe ese guion.');
