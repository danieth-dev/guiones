import { splitBeatText } from '../services/beat-splitter';
import { domainError } from '../shared/domain-error';
import type { AudioId, PhraseId, ScriptId } from '../shared/ids';
import { err, ok, type Result } from '../shared/result';
import type { Duration } from './duration';
import { Phrase, type NewPhrase, type PhraseProps } from './phrase';
import type { Section, Shot } from './phrase-parts';
import { SpeechRate } from './speech-rate';
import type { SpokenText } from './spoken-text';
import type { VideoFormat } from './video-format';

/** Hechos que importan fuera del agregado (p. ej. borrar audios que ya no se usan). */
export type DomainEvent =
  { readonly type: 'Changed' } | { readonly type: 'AudioDiscarded'; readonly audioId: AudioId };

export interface Mutation {
  readonly script: Script;
  readonly events: readonly DomainEvent[];
}

export interface ScriptProps {
  readonly id: ScriptId;
  readonly title: string;
  readonly format: VideoFormat;
  readonly rate: SpeechRate;
  readonly phrases: readonly Phrase[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface NewScript {
  readonly id: ScriptId;
  readonly format: VideoFormat;
  readonly now: number;
  readonly title?: string;
  readonly rate?: SpeechRate;
  /** Si se da, el guion empieza con el esqueleto del formato (inicio, desarrollo, cierre). */
  readonly nextPhraseId?: () => PhraseId;
}

export type PhraseLength = 'OK' | 'LONG';

/**
 * Aviso de ritmo en una frase: llevas `seconds` con el mismo plano o la misma
 * energía, o el inicio tarda `seconds` en llegar al punto.
 */
export interface RhythmHint {
  readonly kind: 'SAME_SHOT' | 'SAME_ENERGY' | 'SLOW_OPENING';
  readonly seconds: number;
  /** Lo que el formato recomienda (segundos). */
  readonly limit: number;
}
export type DurationStatus = 'EMPTY' | 'UNDER' | 'IN_RANGE' | 'OVER';

/**
 * Guion: un título, un formato de video y una lista de frases en orden de
 * lectura. Inmutable: cada operación devuelve un `Result<Mutation>`.
 */
export class Script {
  static readonly MAX_TITLE_LENGTH = 120;
  static readonly DEFAULT_TITLE = 'Guion sin título';

  private constructor(private readonly props: ScriptProps) {}

  static create(params: NewScript): Result<Script> {
    const title = Script.normalizeTitle(params.title ?? '');
    if (!title.ok) return title;
    const next = params.nextPhraseId;
    const phrases = next
      ? params.format.skeleton.map((slot) =>
          Phrase.create(next(), slot.section, {
            guide: slot.guide,
            shot: slot.shot,
            energy: slot.energy,
          }),
        )
      : [];
    return ok(
      new Script({
        id: params.id,
        title: title.value,
        format: params.format,
        rate: params.rate ?? SpeechRate.DEFAULT,
        phrases,
        createdAt: params.now,
        updatedAt: params.now,
      }),
    );
  }

  static restore(props: ScriptProps): Script {
    return new Script(props);
  }

  // ───────────────────────────── Lectura ─────────────────────────────

  get id(): ScriptId {
    return this.props.id;
  }
  get title(): string {
    return this.props.title;
  }
  get format(): VideoFormat {
    return this.props.format;
  }
  get rate(): SpeechRate {
    return this.props.rate;
  }
  get phrases(): readonly Phrase[] {
    return this.props.phrases;
  }
  get createdAt(): number {
    return this.props.createdAt;
  }
  get updatedAt(): number {
    return this.props.updatedAt;
  }

  findPhrase(id: PhraseId): Phrase | null {
    return this.props.phrases.find((p) => p.id === id) ?? null;
  }

  durationOf(phrase: Phrase): Duration {
    return this.props.rate.durationOf(phrase.text.wordCount);
  }

  estimatedDuration(): Duration {
    return this.props.phrases.reduce(
      (total, phrase) => total.plus(this.durationOf(phrase)),
      this.props.rate.durationOf(0),
    );
  }

  durationStatus(): DurationStatus {
    const seconds = this.estimatedDuration().seconds;
    if (seconds === 0) return 'EMPTY';
    if (seconds < this.props.format.minSeconds) return 'UNDER';
    return seconds > this.props.format.maxSeconds ? 'OVER' : 'IN_RANGE';
  }

  /** Una frase larga se oye leída: conviene dividirla. */
  lengthOf(phrase: Phrase): PhraseLength {
    return phrase.text.wordCount > this.props.format.comfortableWords ? 'LONG' : 'OK';
  }

  /** Plano a usar: el elegido o, si no hay, el recomendado por el formato. */
  suggestedShot(phrase: Phrase): Shot {
    const bodyIndex = this.props.phrases
      .filter((p) => p.section === 'BODY')
      .findIndex((p) => p.id === phrase.id);
    return this.props.format.suggestShot(phrase.section, Math.max(0, bodyIndex));
  }

  /**
   * Dónde el guion se vuelve monótono: el aviso cae en la frase con la que
   * dos o más frases seguidas pasan del tiempo del formato con el mismo plano
   * o la misma energía. Las frases vacías no cuentan ni cortan la racha.
   * Además, si la primera frase dicha es el inicio y dura más de lo que el
   * formato permite, se avisa ahí.
   */
  rhythmHints(): ReadonlyMap<PhraseId, readonly RhythmHint[]> {
    const limits = this.props.format.changeEvery;
    const streaks = {
      SAME_SHOT: { value: '', seconds: 0, count: 0, limit: limits.shot },
      SAME_ENERGY: { value: '', seconds: 0, count: 0, limit: limits.energy },
    };
    const hints = new Map<PhraseId, RhythmHint[]>();
    const first = this.props.phrases.find((p) => !p.text.isEmpty);
    if (first?.section === 'OPENING') {
      const seconds = this.durationOf(first).rounded();
      const limit = this.props.format.openingSeconds;
      if (seconds > limit) {
        hints.set(first.id, [{ kind: 'SLOW_OPENING', seconds, limit }]);
      }
    }
    for (const phrase of this.props.phrases) {
      if (phrase.text.isEmpty) continue;
      const seconds = this.durationOf(phrase).seconds;
      const values = {
        SAME_SHOT: phrase.shot ?? this.suggestedShot(phrase),
        SAME_ENERGY: phrase.energy,
      };
      for (const kind of ['SAME_SHOT', 'SAME_ENERGY'] as const) {
        const streak = streaks[kind];
        if (streak.value === values[kind]) {
          streak.seconds += seconds;
          streak.count += 1;
        } else {
          Object.assign(streak, { value: values[kind], seconds, count: 1 });
        }
        if (streak.count >= 2 && streak.seconds > streak.limit) {
          const list = hints.get(phrase.id) ?? [];
          list.push({ kind, seconds: Math.round(streak.seconds), limit: streak.limit });
          hints.set(phrase.id, list);
          // Empieza a contar de nuevo: el próximo aviso, tras otro tramo igual de largo.
          Object.assign(streak, { seconds: 0, count: 0 });
        }
      }
    }
    return hints;
  }

  // ───────────────────────────── Datos generales ─────────────────────────────

  rename(title: string): Result<Mutation> {
    const normalized = Script.normalizeTitle(title);
    if (!normalized.ok) return normalized;
    if (normalized.value === this.props.title) return this.unchanged();
    return this.change({ title: normalized.value });
  }

  changeFormat(format: VideoFormat): Result<Mutation> {
    return format === this.props.format ? this.unchanged() : this.change({ format });
  }

  changeRate(rate: SpeechRate): Result<Mutation> {
    return rate.wordsPerMinute === this.props.rate.wordsPerMinute
      ? this.unchanged()
      : this.change({ rate });
  }

  // ───────────────────────────── Frases ─────────────────────────────

  addPhrase(
    id: PhraseId,
    section: Section,
    options: NewPhrase = {},
    at?: number,
  ): Result<Mutation> {
    if (this.findPhrase(id))
      return err(domainError('INVALID_VALUE', 'Ya existe una frase con ese id.'));
    const phrases = [...this.props.phrases];
    phrases.splice(
      Script.clamp(at ?? phrases.length, phrases.length),
      0,
      Phrase.create(id, section, options),
    );
    return this.change({ phrases });
  }

  editText(id: PhraseId, text: SpokenText): Result<Mutation> {
    return this.updatePhrase(id, (phrase) => phrase.withText(text));
  }

  updateDetails(
    id: PhraseId,
    patch: Partial<Pick<PhraseProps, 'section' | 'shot' | 'energy' | 'note'>>,
  ): Result<Mutation> {
    return this.updatePhrase(id, (phrase) => phrase.with(patch));
  }

  /** Te grabaste diciendo la frase: la toma anterior ya no sirve. */
  attachTake(id: PhraseId, take: AudioId): Result<Mutation> {
    return this.updatePhrase(id, (phrase) => phrase.with({ take }));
  }

  /** Divide una frase larga en dos respiraciones, en el mejor punto para respirar. */
  split(id: PhraseId, newId: PhraseId): Result<Mutation> {
    const index = this.index(id);
    const phrase = this.props.phrases[index];
    if (!phrase) return err(Script.notFound());
    const parts = splitBeatText(phrase.text);
    if (!parts.ok) return parts;
    const first = phrase.withText(parts.value.first);
    const second = Phrase.create(newId, phrase.section, {
      text: parts.value.second,
      shot: phrase.shot,
      energy: phrase.energy,
    });
    const phrases = [...this.props.phrases];
    phrases.splice(index, 1, first, second);
    return this.change({ phrases }, Script.discarded(phrase.take));
  }

  move(id: PhraseId, toIndex: number): Result<Mutation> {
    const from = this.index(id);
    if (from < 0) return err(Script.notFound());
    const phrases = [...this.props.phrases];
    const [phrase] = phrases.splice(from, 1);
    const to = Script.clamp(toIndex, phrases.length);
    if (!phrase || to === from) return this.unchanged();
    phrases.splice(to, 0, phrase);
    return this.change({ phrases });
  }

  remove(id: PhraseId): Result<Mutation> {
    const phrase = this.findPhrase(id);
    if (!phrase) return err(Script.notFound());
    return this.change(
      { phrases: this.props.phrases.filter((p) => p.id !== id) },
      Script.discarded(phrase.take),
    );
  }

  /** Copia con la fecha de modificación actualizada (lo usa la capa de aplicación al guardar). */
  touched(now: number): Script {
    return new Script({ ...this.props, updatedAt: now });
  }

  // ───────────────────────────── Internos ─────────────────────────────

  private updatePhrase(id: PhraseId, update: (phrase: Phrase) => Phrase): Result<Mutation> {
    const phrase = this.findPhrase(id);
    if (!phrase) return err(Script.notFound());
    const updated = update(phrase);
    if (updated === phrase) return this.unchanged();
    const lost = phrase.take !== updated.take ? phrase.take : null;
    return this.change(
      { phrases: this.props.phrases.map((p) => (p.id === id ? updated : p)) },
      Script.discarded(lost),
    );
  }

  private change(
    patch: Partial<ScriptProps>,
    extra: readonly DomainEvent[] = [],
  ): Result<Mutation> {
    return ok({
      script: new Script({ ...this.props, ...patch }),
      events: [{ type: 'Changed' }, ...extra],
    });
  }

  private unchanged(): Result<Mutation> {
    return ok({ script: this, events: [] });
  }

  private index(id: PhraseId): number {
    return this.props.phrases.findIndex((p) => p.id === id);
  }

  private static discarded(take: AudioId | null): readonly DomainEvent[] {
    return take ? [{ type: 'AudioDiscarded', audioId: take }] : [];
  }

  private static clamp(index: number, length: number): number {
    return Math.min(Math.max(0, Math.trunc(index)), length);
  }

  private static notFound() {
    return domainError('NOT_FOUND', 'No existe esa frase.');
  }

  private static normalizeTitle(raw: string): Result<string> {
    const title = raw.replace(/\s+/gu, ' ').trim();
    if (title.length > Script.MAX_TITLE_LENGTH) {
      return err(
        domainError(
          'INVALID_VALUE',
          `El título no puede superar ${String(Script.MAX_TITLE_LENGTH)} caracteres.`,
        ),
      );
    }
    return ok(title === '' ? Script.DEFAULT_TITLE : title);
  }
}
