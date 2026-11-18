import { audioId, measureWordsPerMinute, ok, phraseId, scriptId, type Result } from '../../domain';
import type { ScriptView } from '../dto/script-view';
import type { AudioStore } from '../ports/audio-store';
import type { IdGenerator } from '../ports/system';
import type { ScriptWorkspace } from '../services/script-workspace';
import type { AppError } from '../shared/app-error';
import type { UseCase } from '../shared/use-case';

export interface RecordTakeInput {
  readonly scriptId: string;
  readonly phraseId: string;
  readonly audio: Blob;
}

/** Guarda cómo sonó la frase al decirla (la toma anterior se descarta). */
export class RecordTake implements UseCase<RecordTakeInput, ScriptView> {
  constructor(
    private readonly audio: AudioStore,
    private readonly ids: IdGenerator,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: RecordTakeInput): Promise<Result<ScriptView, AppError>> {
    return this.workspace.guard(async () => {
      const take = audioId(this.ids.next('au'));
      await this.audio.save({ id: take, ownerId: scriptId(input.scriptId), audio: input.audio });
      const result = await this.workspace.mutate(input.scriptId, (s) =>
        s.attachTake(phraseId(input.phraseId), take),
      );
      // Si el guion rechazó la toma, no se deja el audio huérfano.
      if (!result.ok) await this.audio.delete(take);
      return result;
    });
  }
}

/** Recupera una grabación para escucharla. `null` si ya no existe. */
export class GetTake implements UseCase<{ readonly audioId: string }, Blob | null> {
  constructor(
    private readonly audio: AudioStore,
    private readonly workspace: ScriptWorkspace,
  ) {}

  execute(input: { readonly audioId: string }): Promise<Result<Blob | null, AppError>> {
    return this.workspace.guard(async () => ok(await this.audio.load(audioId(input.audioId))));
  }
}

export interface PracticeSessionInput {
  readonly scriptId: string;
  /** Tiempo real que tomó decir cada frase. */
  readonly phrases: readonly { readonly phraseId: string; readonly elapsedMs: number }[];
}

export interface PracticeSessionReport {
  readonly phrases: readonly {
    readonly phraseId: string;
    readonly estimatedSec: number;
    readonly actualSec: number;
  }[];
  readonly totalEstimatedSec: number;
  readonly totalActualSec: number;
  /** Palabras por minuto medidas en el ensayo (`null` si hubo muy pocos datos). */
  readonly measuredWpm: number | null;
  readonly currentWpm: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Cierra un ensayo con teleprompter: compara lo estimado con lo real y mide tu
 * ritmo. No cambia el guion: aplicar la velocidad medida lo decide el usuario.
 */
export class RecordPracticeSession implements UseCase<PracticeSessionInput, PracticeSessionReport> {
  constructor(private readonly workspace: ScriptWorkspace) {}

  execute(input: PracticeSessionInput): Promise<Result<PracticeSessionReport, AppError>> {
    return this.workspace.guard(async () => {
      const script = await this.workspace.load(input.scriptId);
      if (!script.ok) return script;
      const timed = input.phrases.flatMap((entry) => {
        const phrase = script.value.findPhrase(phraseId(entry.phraseId));
        return phrase ? [{ phrase, elapsedMs: Math.max(0, entry.elapsedMs) }] : [];
      });
      const phrases = timed.map(({ phrase, elapsedMs }) => ({
        phraseId: phrase.id,
        estimatedSec: script.value.durationOf(phrase).rounded(),
        actualSec: round1(elapsedMs / 1000),
      }));
      return ok({
        phrases,
        totalEstimatedSec: round1(phrases.reduce((sum, p) => sum + p.estimatedSec, 0)),
        totalActualSec: round1(phrases.reduce((sum, p) => sum + p.actualSec, 0)),
        measuredWpm: measureWordsPerMinute(
          timed.map(({ phrase, elapsedMs }) => ({ words: phrase.text.wordCount, elapsedMs })),
        ),
        currentWpm: script.value.rate.wordsPerMinute,
      });
    });
  }
}
