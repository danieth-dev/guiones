import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import {
  IndexedDbAudioStore,
  IndexedDbScriptRepository,
  InMemoryAudioStore,
  InMemoryScriptRepository,
  openDatabase,
  STORES,
} from '../../src/infrastructure';
import { describeAudioStoreContract } from './audio-store.contract';
import { describeScriptRepositoryContract } from './script-repository.contract';

/** Cada test recibe una base nueva y aislada. */
const freshDb = () => openDatabase(new IDBFactory());

describeScriptRepositoryContract('memoria', () => Promise.resolve(new InMemoryScriptRepository()));
describeScriptRepositoryContract(
  'IndexedDB',
  async () => new IndexedDbScriptRepository(await freshDb()),
);

describeAudioStoreContract('memoria', () => Promise.resolve(new InMemoryAudioStore()));
describeAudioStoreContract('IndexedDB', async () => new IndexedDbAudioStore(await freshDb()));

const legacyDatabase = (factory: IDBFactory, version: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = factory.open('legacy', version);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(STORES.scripts, { keyPath: 'id' }).put({ id: 'viejo' });
      db.createObjectStore(STORES.audio, { keyPath: 'id' });
      if (version >= 2) db.createObjectStore('codex', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error('open'));
    };
  });

describe('Base de datos', () => {
  it('la v2 (con el Códice) se actualiza a v3 sin perder guiones', async () => {
    const factory = new IDBFactory();
    await legacyDatabase(factory, 2);
    const db = await openDatabase(factory, 'legacy');
    expect([...db.objectStoreNames]).toEqual([STORES.audio, STORES.scripts]);
    const kept = await new Promise((resolve) => {
      const get = db.transaction(STORES.scripts).objectStore(STORES.scripts).get('viejo');
      get.onsuccess = () => {
        resolve(get.result);
      };
    });
    expect(kept).toEqual({ id: 'viejo' });
  });

  it('omite (y avisa) los guiones con datos inválidos', async () => {
    const db = await freshDb();
    const tx = db.transaction(STORES.scripts, 'readwrite');
    tx.objectStore(STORES.scripts).put({ id: 'roto', schemaVersion: 5 });
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    const skipped: unknown[] = [];
    const repo = new IndexedDbScriptRepository(db, (id) => skipped.push(id));
    expect(await repo.findAll()).toEqual([]);
    expect(skipped).toEqual(['roto']);
  });
});
