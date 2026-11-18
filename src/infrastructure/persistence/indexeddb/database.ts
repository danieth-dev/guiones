/**
 * Acceso mínimo a IndexedDB con promesas (sin dependencias externas).
 * El `IDBFactory` se inyecta: el navegador usa `indexedDB`, los tests `fake-indexeddb`.
 */
export const DB_NAME = 'scriptflow';
export const DB_VERSION = 3;

export const STORES = {
  scripts: 'scripts',
  audio: 'audio',
} as const;

/** Almacén del Códice de Voz Propia (v2), retirado en v3 al simplificar la app. */
const LEGACY_CODEX_STORE = 'codex';

export const AUDIO_BY_OWNER = 'byOwner';

/** Cambios de estructura por versión de la base (no confundir con la versión del registro). */
const upgrade = (db: IDBDatabase, oldVersion: number): void => {
  if (oldVersion < 1) {
    db.createObjectStore(STORES.scripts, { keyPath: 'id' });
    const audio = db.createObjectStore(STORES.audio, { keyPath: 'id' });
    audio.createIndex(AUDIO_BY_OWNER, 'ownerId', { unique: false });
  }
  if (oldVersion >= 2 && db.objectStoreNames.contains(LEGACY_CODEX_STORE)) {
    // v3: la app se simplificó y el Códice ya no existe.
    db.deleteObjectStore(LEGACY_CODEX_STORE);
  }
};

export const openDatabase = (factory: IDBFactory, name: string = DB_NAME): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = factory.open(name, DB_VERSION);
    request.onupgradeneeded = (event) => {
      upgrade(request.result, event.oldVersion);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('No se pudo abrir IndexedDB.'));
    };
    request.onblocked = () => {
      reject(new Error('IndexedDB está bloqueada por otra pestaña con una versión anterior.'));
    };
  });

export const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('Error de IndexedDB.'));
    };
  });

/** Resuelve cuando la transacción se confirma (los datos ya están escritos). */
export const committed = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error ?? new Error('Error en la transacción de IndexedDB.'));
    };
    tx.onabort = () => {
      reject(tx.error ?? new Error('Transacción de IndexedDB abortada.'));
    };
  });
