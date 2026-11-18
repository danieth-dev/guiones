import type { PhraseView } from '../../../application';
import {
  ENERGIES,
  ENERGY_LABELS,
  isShot,
  SECTION_LABELS,
  SECTIONS,
  SHOT_HINTS,
  SHOT_LABELS,
  SHOTS,
  type Energy,
  type Section,
  type Shot,
} from '../../../domain';
import { hintFor } from '../../keyboard/shortcuts';
import type { DictationUiState, VoiceUiState } from '../../store/app-state';
import { autosize, h, replaceChildren, syncValue } from '../dom';
import { icon } from '../icons';
import { formatSeconds } from '../labels';
import { VoiceControls, type VoiceHandlers } from './voice-controls';

export interface PhraseRowHandlers extends VoiceHandlers {
  onText(phraseId: string, text: string): void;
  onNote(phraseId: string, note: string): void;
  onShot(phraseId: string, shot: Shot | null): void;
  onEnergy(phraseId: string, energy: Energy): void;
  onSection(phraseId: string, section: Section): void;
  onSplit(phraseId: string): void;
  /** Empieza a arrastrar la frase desde su asa (la lista decide dónde cae). */
  onDragStart(phraseId: string, event: PointerEvent): void;
  onRemove(phraseId: string): void;
  onDictate(phraseId: string): void;
}

const menuItem = (label: string, onClick: () => void, extra = ''): HTMLButtonElement =>
  h('button', {
    class: `block w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-surface disabled:opacity-40 ${extra}`,
    text: label,
    attrs: { type: 'button' },
    on: { click: onClick },
  });

/**
 * Una frase del guion: lo que dices de un tirón. Debajo, en gris, su plano y
 * energía; al escribir en ella aparecen las opciones (plano, energía,
 * grabarse). Se actualiza en el lugar para no perder el foco ni el cursor.
 */
export class PhraseRow {
  readonly el: HTMLElement;
  private phrase: PhraseView;
  /** Número de la frase; la parte (inicio, desarrollo, cierre) la dice el título de arriba. */
  private readonly gutter = h('span', { class: 'pt-1 text-[13px] text-muted tabular-nums' });
  private readonly text: HTMLTextAreaElement;
  private readonly interim = h('p', { class: 'mt-1 text-lg italic leading-relaxed text-muted' });
  private readonly summary = h('p', { class: 'mt-1 text-xs text-muted group-focus-within:hidden' });
  private readonly longNote = h('p', { class: 'mt-1 text-xs text-warn' });
  private readonly rhythmNote = h('p', { class: 'mt-1 text-xs text-warn' });
  private readonly tools: HTMLElement;
  private readonly shot: HTMLSelectElement;
  private readonly energyGroup = h('span', {
    class: 'inline-flex rounded-lg bg-surface p-0.5',
    attrs: { role: 'radiogroup', 'aria-label': 'Energía' },
  });
  private readonly energyButtons = new Map<Energy, HTMLButtonElement>();
  private readonly seconds = h('span', { class: 'text-xs tabular-nums' });
  private readonly note: HTMLInputElement;
  private readonly section: HTMLSelectElement;
  private readonly menu: HTMLDetailsElement;
  private readonly splitButton: HTMLButtonElement;
  private readonly voice: VoiceControls;
  private readonly dictateButton: HTMLButtonElement;

  constructor(phrase: PhraseView, handlers: PhraseRowHandlers) {
    this.phrase = phrase;
    this.text = h('textarea', {
      class:
        'block w-full resize-none overflow-hidden bg-transparent text-[18px] leading-relaxed text-text placeholder:text-muted/80 focus:outline-none',
      attrs: { rows: 1, 'aria-label': 'Lo que dices', spellcheck: true },
      on: {
        input: () => {
          autosize(this.text);
          handlers.onText(this.phrase.id, this.text.value);
        },
      },
    });

    this.shot = h('select', {
      class:
        'h-8 cursor-pointer rounded-lg border-0 bg-surface pr-7 pl-2.5 text-xs text-text focus-visible:outline-2 focus-visible:outline-primary',
      attrs: { 'aria-label': 'Plano' },
      on: {
        change: () => {
          const value = this.shot.value;
          handlers.onShot(this.phrase.id, isShot(value) ? value : null);
        },
      },
    });
    for (const energy of ENERGIES) {
      const button = h('button', {
        class: 'rounded-md px-2.5 py-1 text-xs',
        text: ENERGY_LABELS[energy],
        attrs: { type: 'button', role: 'radio' },
        on: {
          click: () => {
            handlers.onEnergy(this.phrase.id, energy);
          },
        },
      });
      this.energyButtons.set(energy, button);
      this.energyGroup.append(button);
    }
    this.note = h('input', {
      class:
        'w-full min-w-0 bg-transparent text-sm text-muted placeholder:text-muted focus:text-text focus:outline-none',
      attrs: {
        type: 'text',
        maxlength: 160,
        placeholder: 'Detalle del plano (opcional): qué se ve',
        'aria-label': 'Detalle del plano',
      },
      on: {
        input: () => {
          handlers.onNote(this.phrase.id, this.note.value);
        },
      },
    });

    this.section = h('select', {
      class: 'rounded-md border-0 bg-surface px-2 py-1 text-sm',
      attrs: { 'aria-label': 'Parte del video' },
      on: {
        change: () => {
          const value = this.section.value as Section;
          handlers.onSection(this.phrase.id, value);
        },
      },
    });
    for (const s of SECTIONS)
      this.section.append(h('option', { text: SECTION_LABELS[s], attrs: { value: s } }));

    const close = () => {
      this.menu.open = false;
    };
    this.splitButton = menuItem(`Dividir en dos (${hintFor('SPLIT')})`, () => {
      close();
      handlers.onSplit(this.phrase.id);
    });
    this.menu = h(
      'details',
      { class: 'relative' },
      h(
        'summary',
        {
          class:
            'grid size-8 cursor-pointer list-none place-items-center rounded-lg text-text transition hover:bg-surface',
          attrs: { 'aria-label': 'Más opciones de la frase', title: 'Más opciones' },
        },
        h('span', { text: '···', attrs: { 'aria-hidden': 'true' } }),
      ),
      h(
        'div',
        {
          class:
            'absolute right-0 z-20 mt-1 w-56 space-y-0.5 rounded-card bg-surface-raised p-1 shadow-lg ring-1 ring-line',
        },
        h(
          'label',
          { class: 'flex items-center justify-between px-3 py-1.5 text-sm' },
          'Parte',
          this.section,
        ),
        this.splitButton,
        menuItem(
          'Eliminar frase',
          () => {
            close();
            handlers.onRemove(this.phrase.id);
          },
          'text-danger',
        ),
      ),
    );

    this.voice = new VoiceControls(handlers);
    this.dictateButton = h(
      'button',
      {
        class:
          'grid size-8 place-items-center rounded-lg text-primary transition hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary',
        attrs: {
          type: 'button',
          'aria-label': `Dictar (${hintFor('DICTATE')})`,
          title: `Dictar: di la frase y se escribe sola (${hintFor('DICTATE')})`,
        },
        on: {
          click: () => {
            handlers.onDictate(this.phrase.id);
          },
        },
      },
      icon('mic', 'size-4'),
    );

    this.tools = h(
      'div',
      { class: 'mt-2.5 hidden space-y-2 group-focus-within:block' },
      h(
        'div',
        { class: 'flex flex-wrap items-center gap-1.5' },
        h(
          'label',
          { class: 'flex items-center gap-1 text-muted' },
          icon('camera', 'size-4'),
          this.shot,
        ),
        this.energyGroup,
        h('span', { class: 'flex-1' }),
        this.seconds,
        this.voice.el,
        this.dictateButton,
        this.menu,
      ),
      h('div', { class: 'flex items-center gap-2' }, this.note),
    );

    this.el = h(
      'article',
      {
        class:
          'phrase-row group -mx-4 grid grid-cols-1 gap-x-2 gap-y-0.5 rounded-xl border-b border-line px-4 py-3.5 transition focus-within:border-transparent focus-within:bg-primary-soft/40 focus-within:ring-1 focus-within:ring-primary/20 sm:grid-cols-[48px_minmax(0,1fr)]',
        attrs: { 'data-phrase-id': phrase.id, role: 'listitem' },
      },
      h(
        'div',
        { class: 'flex items-start gap-0.5' },
        h(
          'button',
          {
            // touch-none: en el móvil el dedo arrastra la frase en vez de desplazar la página.
            class:
              'grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted transition hover:bg-surface hover:text-text active:cursor-grabbing',
            attrs: {
              type: 'button',
              'aria-label': `Arrastrar para mover (o ${hintFor('MOVE_UP')} / ${hintFor('MOVE_DOWN')})`,
              title: `Arrastra para mover la frase (${hintFor('MOVE_UP')} / ${hintFor('MOVE_DOWN')})`,
            },
            on: {
              pointerdown: (event) => {
                handlers.onDragStart(this.phrase.id, event);
              },
            },
          },
          icon('grip', 'size-4'),
        ),
        this.gutter,
      ),
      h(
        'div',
        { class: 'min-w-0' },
        this.text,
        this.interim,
        this.summary,
        this.longNote,
        this.rhythmNote,
        this.tools,
      ),
    );
  }

  get id(): string {
    return this.phrase.id;
  }

  update(
    phrase: PhraseView,
    ui: { readonly voice: VoiceUiState; readonly dictation: DictationUiState },
  ): void {
    this.phrase = phrase;
    this.el.dataset.phraseId = phrase.id;
    this.gutter.textContent = String(phrase.order);

    // Las pistas terminan en "…" para que no se confundan con algo ya escrito.
    this.text.placeholder = `${phrase.guide || 'Lo que dices de un tirón, como se lo contarías a un amigo'}…`;
    this.text.classList.toggle('text-[20px]', phrase.section === 'OPENING');
    this.text.classList.toggle('font-semibold', phrase.section === 'OPENING');
    syncValue(this.text, phrase.text);
    syncValue(this.note, phrase.note);
    queueMicrotask(() => {
      autosize(this.text);
    });

    this.renderShotOptions(phrase);
    for (const [energy, button] of this.energyButtons) {
      const active = energy === phrase.energy;
      button.setAttribute('aria-checked', String(active));
      button.className = `rounded-md px-2.5 py-1 text-xs transition focus-visible:outline-2 focus-visible:outline-primary ${
        active
          ? 'bg-surface-raised font-semibold text-text shadow-[0_0_0_1px_var(--line)]'
          : 'text-text hover:bg-surface-raised/60'
      }`;
    }
    this.section.value = phrase.section;

    const long = phrase.length === 'LONG';
    this.seconds.textContent = formatSeconds(phrase.seconds);
    this.seconds.className = `text-xs tabular-nums ${long ? 'text-warn' : 'text-ok'}`;
    this.longNote.hidden = !long;
    this.longNote.textContent = `${String(phrase.words)} palabras: suena a texto leído. Divídela en dos (${hintFor('SPLIT')}).`;

    this.rhythmNote.hidden = phrase.rhythm.length === 0;
    this.rhythmNote.textContent = phrase.rhythm
      .map((hint) => {
        const seconds = formatSeconds(hint.seconds);
        if (hint.kind === 'SLOW_OPENING') {
          return `El inicio tarda ${seconds} en llegar al punto: en este formato la gente decide en ${String(hint.limit)} s. Córtalo.`;
        }
        return hint.kind === 'SAME_SHOT'
          ? `Llevas ${seconds} con ${phrase.shotLabel.toLowerCase()}: cambia de plano aquí.`
          : `Llevas ${seconds} con energía ${phrase.energyLabel.toLowerCase()}: cambia la energía aquí para no aburrir.`;
      })
      .join(' ');

    const details = [phrase.shotLabel, `Energía ${phrase.energyLabel.toLowerCase()}`];
    if (phrase.note) details[0] = `${phrase.shotLabel}: ${phrase.note}`;
    replaceChildren(
      this.summary,
      phrase.text
        ? details.join(' · ')
        : `Sin escribir · plano sugerido: ${phrase.shotLabel.toLowerCase()}`,
      phrase.take ? h('span', { class: 'text-ok', text: ' · Grabada' }) : null,
    );

    this.voice.update({ id: phrase.id, take: phrase.take, hasText: phrase.text !== '' }, ui.voice);
    const listening = ui.dictation.phraseId === phrase.id;
    this.dictateButton.hidden = !ui.dictation.available;
    this.dictateButton.setAttribute('aria-pressed', String(listening));
    this.dictateButton.classList.toggle('bg-primary-soft', listening);
    this.interim.textContent = listening ? ui.dictation.interim : '';
    this.interim.hidden = !listening || ui.dictation.interim === '';
    const recording = ui.voice.recordingId === phrase.id;
    this.el.classList.toggle('bg-danger-soft/40', recording);
    this.tools.classList.toggle('block!', recording || listening);

    this.splitButton.disabled = phrase.words < 2;
  }

  focus(): void {
    this.text.focus();
    const end = this.text.value.length;
    this.text.setSelectionRange(end, end);
    this.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** La primera opción es el plano sugerido; elegirla deja que el formato decida. */
  private renderShotOptions(phrase: PhraseView): void {
    const key = `${phrase.suggestedShot}|${phrase.shot ?? ''}`;
    if (this.shot.dataset.key !== key) {
      this.shot.dataset.key = key;
      replaceChildren(
        this.shot,
        h('option', {
          text: `${SHOT_LABELS[phrase.suggestedShot]} (sugerido)`,
          attrs: { value: '' },
        }),
        ...SHOTS.filter((s) => s !== phrase.suggestedShot).map((s) =>
          h('option', { text: SHOT_LABELS[s], attrs: { value: s } }),
        ),
      );
    }
    this.shot.value = phrase.shot && phrase.shot !== phrase.suggestedShot ? phrase.shot : '';
    this.shot.title = SHOT_HINTS[phrase.shot ?? phrase.suggestedShot];
  }
}
