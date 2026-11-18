import { beforeEach, describe, expect, it } from 'vitest';
import type { AudioStore } from '../../src/application';
import { audioId, scriptId } from '../../src/domain';

/** Contrato que todo adaptador de `AudioStore` debe cumplir. */
export const describeAudioStoreContract = (
  name: string,
  create: () => Promise<AudioStore>,
): void => {
  describe(`AudioStore · ${name}`, () => {
    let store: AudioStore;
    const owner = scriptId('sc_a');
    const other = scriptId('sc_b');

    beforeEach(async () => {
      store = await create();
    });

    it('guarda y recupera el audio con su tipo', async () => {
      await store.save({
        id: audioId('au_1'),
        ownerId: owner,
        audio: new Blob(['voz'], { type: 'audio/webm' }),
      });
      const blob = await store.load(audioId('au_1'));
      expect(blob?.type).toBe('audio/webm');
      expect(await blob?.text()).toBe('voz');
      expect(await store.load(audioId('nope'))).toBeNull();
    });

    it('borra una toma o todas las de un guion', async () => {
      const take = (id: string, ownerId = owner) => ({
        id: audioId(id),
        ownerId,
        audio: new Blob([id], { type: 'audio/webm' }),
      });
      await store.save(take('au_1'));
      await store.save(take('au_2'));
      await store.save(take('au_3', other));

      await store.delete(audioId('au_1'));
      expect(await store.load(audioId('au_1'))).toBeNull();

      await store.deleteByOwner(owner);
      expect(await store.load(audioId('au_2'))).toBeNull();
      expect(await store.load(audioId('au_3'))).not.toBeNull();
    });
  });
};
