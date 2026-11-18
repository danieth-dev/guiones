import type { ScriptView } from '../../application';
import { matchShortcut } from '../keyboard/shortcuts';
import type { DictationPresenter } from '../presenters/dictation-presenter';
import type { PhrasesPresenter } from '../presenters/phrases-presenter';
import type { ScriptsPresenter } from '../presenters/scripts-presenter';
import type { SettingsPresenter } from '../presenters/settings-presenter';
import type { TeleprompterPresenter } from '../presenters/teleprompter-presenter';
import type { VoicePresenter } from '../presenters/voice-presenter';
import type { AppState } from '../store/app-state';
import { PhraseRow } from './components/phrase-row';
import { TopBar } from './components/top-bar';
import { autosize, h, replaceChildren } from './dom';
import { formatClock } from './labels';

export interface EditorPresenters {
  readonly scripts: ScriptsPresenter;
  readonly phrases: PhrasesPresenter;
  readonly voice: VoicePresenter;
  readonly dictation: DictationPresenter;
  readonly settings: SettingsPresenter;
  readonly teleprompter: TeleprompterPresenter;
}

const DURATION_BAR: Readonly<Record<ScriptView['durationStatus'], string>> = {
  EMPTY: 'bg-line',
  UNDER: 'bg-primary',
  IN_RANGE: 'bg-ok',
  OVER: 'bg-warn-fill',
};

/**
 * El guion como documento: título, cuánto dura frente a lo que pide el formato
 * y las frases (inicio, desarrollo, cierre). Las filas se reutilizan por id
 * para no perder el foco mientras se escribe.
 */
export class EditorView {
  readonly el: HTMLElement;
  private readonly topBar: TopBar;
  private readonly heading = h('h1', { class: 'sr-only' });
  private readonly title: HTMLTextAreaElement;
  private readonly duration = h('div', {
    class: 'mt-3.5 flex items-center gap-3 text-[13px] text-text',
  });
  private readonly list = h('div', { attrs: { role: 'list' } });
  private readonly rows = new Map<string, PhraseRow>();
  private script: ScriptView | null = null;
  private lastFocusNonce = 0;

  constructor(private readonly presenters: EditorPresenters) {
    const { scripts, phrases, voice, dictation } = presenters;
    this.topBar = new TopBar(scripts, () => void presenters.teleprompter.open());
    this.title = h('textarea', {
      class:
        'block w-full resize-none overflow-hidden bg-transparent text-[28px] leading-tight font-bold tracking-tight text-text caret-primary placeholder:text-muted focus:outline-none sm:text-[32px]',
      attrs: { rows: 1, maxlength: 120, 'aria-label': 'Título del guion' },
      on: {
        input: () => {
          autosize(this.title);
        },
        change: () => void scripts.rename(this.title.value.replace(/\s+/gu, ' ')),
        keydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.title.blur();
          }
        },
      },
    });
    this.rowHandlers = {
      onText: (id, text) => {
        dictation.typed(id);
        phrases.editText(id, text);
      },
      onNote: (id, note) => {
        phrases.editNote(id, note);
      },
      onShot: (id, shot) => void phrases.setShot(id, shot),
      onEnergy: (id, energy) => void phrases.setEnergy(id, energy),
      onSection: (id, section) => void phrases.setSection(id, section),
      onSplit: (id) => void phrases.split(id),
      onMove: (id, delta) => void phrases.moveBy(id, delta),
      onRemove: (id) => void phrases.remove(id),
      onRecord: (id) => void voice.toggleRecording(id),
      onPlay: (id) => void voice.play(id),
      onDictate: (id) => void dictation.toggle(id),
    };

    this.el = h(
      'main',
      { class: 'min-w-0', attrs: { 'aria-label': 'Guion' } },
      this.topBar.el,
      h(
        'div',
        { class: 'mx-auto max-w-[680px] px-5 pt-6 pb-24 lg:px-8 lg:pt-8' },
        this.heading,
        this.title,
        this.duration,
        h(
          'p',
          { class: 'mt-5 rounded-control bg-surface px-3.5 py-3 text-[13px] text-text' },
          'Escribe una ',
          h('strong', { class: 'font-semibold', text: 'frase' }),
          ' por línea: lo que dices de un tirón, como se lo contarías a un amigo. Al escribir en ella eliges el plano y la energía, y puedes grabarte diciéndola.',
        ),
        h('div', { class: 'mt-5 border-t border-line' }, this.list),
        h(
          'button',
          {
            class:
              'mt-3 rounded-md py-1.5 text-[15px] text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary sm:ml-[72px]',
            attrs: { type: 'button' },
            on: { click: () => void phrases.add() },
          },
          '+ Agregar frase ',
          h('span', { class: 'text-xs text-muted', text: '(Ctrl+Enter)' }),
        ),
      ),
    );
    this.list.addEventListener('keydown', (event) => {
      this.onKeydown(event);
    });
  }

  private readonly rowHandlers: ConstructorParameters<typeof PhraseRow>[1];

  render(state: AppState): void {
    const script = state.current;
    if (!script) return;
    this.script = script;
    this.topBar.render(state);
    this.heading.textContent = script.title;
    if (document.activeElement !== this.title) {
      this.title.value = script.title;
      queueMicrotask(() => {
        autosize(this.title);
      });
    }
    this.renderDuration(script);
    this.renderPhrases(state, script);
    if (state.focus && state.focus.nonce !== this.lastFocusNonce) {
      this.lastFocusNonce = state.focus.nonce;
      this.rows.get(state.focus.phraseId)?.focus();
    }
  }

  /** Barra de duración: cuánto llevas frente al máximo del formato. */
  private renderDuration(script: ScriptView): void {
    const { estimatedSec, durationStatus, format } = script;
    const pct = Math.min(100, (estimatedSec / format.maxSeconds) * 100);
    const hint =
      durationStatus === 'OVER'
        ? ' · Te pasaste: recorta o divide en dos videos'
        : durationStatus === 'UNDER'
          ? ` · Aún corto (mínimo ${formatClock(format.minSeconds)})`
          : '';
    replaceChildren(
      this.duration,
      h(
        'div',
        {
          class: 'h-1.5 flex-1 overflow-hidden rounded-full bg-surface',
          attrs: {
            role: 'meter',
            'aria-label': 'Duración estimada',
            'aria-valuemin': 0,
            'aria-valuemax': format.maxSeconds,
            'aria-valuenow': Math.round(estimatedSec),
          },
        },
        h('div', {
          class: `h-full rounded-full ${DURATION_BAR[durationStatus]}`,
          attrs: { style: `width:${String(pct)}%` },
        }),
      ),
      h(
        'span',
        { class: 'tabular-nums' },
        h('strong', { class: 'font-semibold', text: formatClock(estimatedSec) }),
        ` de ${format.durationLabel}`,
        h('span', { class: durationStatus === 'OVER' ? 'text-warn' : 'text-muted', text: hint }),
      ),
    );
  }

  private renderPhrases(state: AppState, script: ScriptView): void {
    const seen = new Set<string>();
    script.phrases.forEach((phrase, index) => {
      seen.add(phrase.id);
      let row = this.rows.get(phrase.id);
      if (!row) {
        row = new PhraseRow(phrase, this.rowHandlers);
        this.rows.set(phrase.id, row);
      }
      row.update(
        phrase,
        { isFirst: index === 0, isLast: index === script.phrases.length - 1 },
        { voice: state.voice, dictation: state.dictation },
      );
      // Reubica solo si cambió de posición (moverla quitaría el foco).
      if (this.list.children[index] !== row.el) {
        this.list.insertBefore(row.el, this.list.children[index] ?? null);
      }
    });
    for (const [id, row] of this.rows) {
      if (!seen.has(id)) {
        row.el.remove();
        this.rows.delete(id);
      }
    }
  }

  private onKeydown(event: KeyboardEvent): void {
    const command = matchShortcut(event);
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-phrase-id]')?.dataset
      .phraseId;
    if (!command || !id) return;
    event.preventDefault();
    const { phrases, voice, dictation } = this.presenters;
    switch (command) {
      case 'MOVE_UP':
        void phrases.moveBy(id, -1);
        break;
      case 'MOVE_DOWN':
        void phrases.moveBy(id, 1);
        break;
      case 'SPLIT':
        void phrases.split(id);
        break;
      case 'NEW_PHRASE_AFTER': {
        const section = this.script?.phrases.find((p) => p.id === id)?.section;
        void phrases.add(
          id,
          section === 'OPENING' ? 'OPENING' : section === 'CLOSING' ? 'CLOSING' : 'BODY',
        );
        break;
      }
      case 'RECORD':
        void voice.toggleRecording(id);
        break;
      case 'PLAY':
        void voice.play(id);
        break;
      case 'DICTATE':
        void dictation.toggle(id);
        break;
    }
  }
}
