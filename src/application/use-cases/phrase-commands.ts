import {
  domainError,
  err,
  isEnergy,
  isSection,
  isShot,
  phraseId,
  SpokenText,
  VisualCue,
  type PhraseProps,
  type Result,
} from '../../domain';
import type { ScriptView } from '../dto/script-view';
import type { IdGenerator } from '../ports/system';
import { chainChanges, type Step } from '../services/chain-changes';
import type { ScriptWorkspace } from '../services/script-workspace';
import type { AppError } from '../shared/app-error';
import type { UseCase } from '../shared/use-case';

const invalid = (message: string) => err(domainError('INVALID_VALUE', message));

export interface AddPhraseInput {
  readonly scriptId: string;
  /** Por defecto, desarrollo. */
  readonly section?: string;
  readonly text?: string;
  /** Se inserta después de esta frase; si no, antes del cierre (o al final). */
  readonly afterId?: string;
}

/** Agrega una frase; hereda el plano sugerido del formato. */
export class AddPhrase implements UseCase<AddPhraseInput, ScriptView> {
  constructor(
    private readonly ids: IdGenerator,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: AddPhraseInput): Promise<Result<ScriptView, AppError>> {
    const section = input.section ?? 'BODY';
    if (!isSection(section)) return Promise.resolve(invalid(`Parte desconocida: ${section}.`));
    return this.workspace.mutate(input.scriptId, (script) => {
      const phrases = script.phrases;
      const after = input.afterId ? phrases.findIndex((p) => p.id === input.afterId) : -1;
      const closing = phrases.findIndex((p) => p.section === 'CLOSING');
      const at =
        after >= 0 ? after + 1 : section === 'BODY' && closing >= 0 ? closing : phrases.length;
      return script.addPhrase(
        phraseId(this.ids.next('fr')),
        section,
        { text: SpokenText.of(input.text ?? '') },
        at,
      );
    });
  }
}

export interface EditPhraseInput {
  readonly scriptId: string;
  readonly phraseId: string;
  readonly text?: string;
  readonly section?: string;
  /** `null` vuelve al plano sugerido. */
  readonly shot?: string | null;
  readonly energy?: string;
  readonly note?: string;
}

/** Edita lo que se dice y/o su plano, energía, nota o parte del video. */
export class EditPhrase implements UseCase<EditPhraseInput, ScriptView> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  execute(input: EditPhraseInput): Promise<Result<ScriptView, AppError>> {
    const id = phraseId(input.phraseId);
    const details: Partial<Pick<PhraseProps, 'section' | 'shot' | 'energy' | 'note'>> = {};
    const { section, shot, energy, note } = input;
    if (section !== undefined) {
      if (!isSection(section)) return Promise.resolve(invalid(`Parte desconocida: ${section}.`));
      Object.assign(details, { section });
    }
    if (shot !== undefined) {
      if (shot !== null && !isShot(shot))
        return Promise.resolve(invalid(`Plano desconocido: ${shot}.`));
      Object.assign(details, { shot });
    }
    if (energy !== undefined) {
      if (!isEnergy(energy)) return Promise.resolve(invalid(`Energía desconocida: ${energy}.`));
      Object.assign(details, { energy });
    }
    if (note !== undefined) {
      const cue = VisualCue.create(note);
      if (!cue.ok) return Promise.resolve(cue);
      Object.assign(details, { note: cue.value });
    }
    const steps: Step[] = [];
    if (input.text !== undefined) {
      const text = SpokenText.of(input.text);
      steps.push((s) => s.editText(id, text));
    }
    if (Object.keys(details).length > 0) steps.push((s) => s.updateDetails(id, details));
    return this.workspace.mutate(input.scriptId, (script) => chainChanges(script, steps));
  }
}

export interface PhraseRef {
  readonly scriptId: string;
  readonly phraseId: string;
}

/** Divide una frase larga en dos, en el mejor punto para respirar. */
export class SplitPhrase implements UseCase<PhraseRef, ScriptView> {
  constructor(
    private readonly ids: IdGenerator,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: PhraseRef): Promise<Result<ScriptView, AppError>> {
    return this.workspace.mutate(input.scriptId, (s) =>
      s.split(phraseId(input.phraseId), phraseId(this.ids.next('fr'))),
    );
  }
}

export class MovePhrase implements UseCase<PhraseRef & { readonly toIndex: number }, ScriptView> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  execute(input: PhraseRef & { readonly toIndex: number }): Promise<Result<ScriptView, AppError>> {
    return this.workspace.mutate(input.scriptId, (s) =>
      s.move(phraseId(input.phraseId), input.toIndex),
    );
  }
}

export class RemovePhrase implements UseCase<PhraseRef, ScriptView> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  execute(input: PhraseRef): Promise<Result<ScriptView, AppError>> {
    return this.workspace.mutate(input.scriptId, (s) => s.remove(phraseId(input.phraseId)));
  }
}
