import { beforeEach, describe, expect, it } from 'vitest';
import type { ScriptRepository } from '../../src/application';
import { audioId, scriptId, VisualCue } from '../../src/domain';
import { apply, ids, shortScript, unwrap } from '../domain/fixtures';

/**
 * Contrato que todo adaptador de `ScriptRepository` debe cumplir.
 * Se ejecuta igual contra la versión en memoria y contra IndexedDB.
 */
export const describeScriptRepositoryContract = (
  name: string,
  create: () => Promise<ScriptRepository>,
): void => {
  describe(`ScriptRepository · ${name}`, () => {
    let repo: ScriptRepository;

    beforeEach(async () => {
      repo = await create();
    });

    it('devuelve null si el guion no existe', async () => {
      expect(await repo.findById(scriptId('nope'))).toBeNull();
      expect(await repo.findAll()).toEqual([]);
    });

    it('guarda y recupera un guion completo sin perder datos', async () => {
      const original = apply(
        apply(
          shortScript().updateDetails(ids.body1, {
            shot: 'BROLL',
            energy: 'HIGH',
            note: unwrap(VisualCue.create('La cámara')),
          }),
        ).attachTake(ids.body2, audioId('au_1')),
      );
      await repo.save(original);
      const loaded = await repo.findById(original.id);
      expect(loaded?.title).toBe(original.title);
      expect(loaded?.format.id).toBe('SHORT_VERTICAL');
      const shape = (s: typeof original) =>
        s.phrases.map((p) => [
          p.id,
          p.section,
          p.text.value,
          p.shot,
          p.energy,
          p.note.value,
          p.take,
        ]);
      expect(loaded && shape(loaded)).toEqual(shape(original));
      expect(loaded?.createdAt).toBe(original.createdAt);
    });

    it('sobrescribe al guardar de nuevo y lista todos', async () => {
      const script = shortScript();
      await repo.save(script);
      await repo.save(apply(script.rename('Otro título')));
      const all = await repo.findAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.title).toBe('Otro título');
    });

    it('elimina guiones', async () => {
      const script = shortScript();
      await repo.save(script);
      await repo.delete(script.id);
      expect(await repo.findById(script.id)).toBeNull();
      await expect(repo.delete(script.id)).resolves.toBeUndefined();
    });
  });
};
