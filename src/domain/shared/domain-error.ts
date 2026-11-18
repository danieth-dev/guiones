export type DomainErrorCode = 'INVALID_VALUE' | 'NOT_FOUND' | 'CANNOT_SPLIT';

/** Error esperado del dominio, con mensaje en español apto para mostrar al usuario. */
export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
}

export const domainError = (code: DomainErrorCode, message: string): DomainError => ({
  code,
  message,
});
