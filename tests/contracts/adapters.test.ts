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

describe('Base de datos', () => {
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
