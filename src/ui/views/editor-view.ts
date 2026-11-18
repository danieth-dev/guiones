import type { PhraseView, ScriptView } from '../../application';
import { ENERGIES, ENERGY_LABELS, Script, type Section } from '../../domain';
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
import { icon } from './icons';
import { formatClock, formatSeconds } from './labels';

export interface EditorPresenters {
  readonly scripts: ScriptsPresenter;
  readonly phrases: PhrasesPresenter;
  readonly voice: VoicePresenter;
  readonly dictation: DictationPresenter;
  readonly settings: SettingsPresenter;
  readonly teleprompter: TeleprompterPresenter;
}

/** Color de cada tramo de la barra de ritmo según la energía de la frase. */
const ENERGY_FILL: Readonly<Record<PhraseView['energy'], string>> = {
  CALM: 'bg-primary/40',
  NORMAL: 'bg-muted/35',
  HIGH: 'bg-warn-fill',
};

/** Cada parte del guion: su nombre, su color y qué debe lograr. */
const SECTION_HEAD: Readonly<
  Record<Section, { label: string; color: string; goal: (s: ScriptView) => string; add: string }>
> = {
  OPENING: {
    label: 'Inicio',
    color: 'text-primary',
    goal: (s) => `engancha en los primeros ${String(s.format.openingSeconds)} s`,
    add: 'al inicio',
  },
  BODY: {
    label: 'Desarrollo',
    color: 'text-text',
    goal: () => 'cuenta, muestra, sorprende',
    add: 'al desarrollo',
  },
  CLOSING: {
    label: 'Cierre',
    color: 'text-ok',
    goal: () => 'qué quieres que hagan',
    add: 'al cierre',
  },
};

const TIP_KEY = 'guiones.tip-oculto';

/** Recuerda en este navegador que el consejo se cerró (si el almacenamiento falla, vuelve a salir). */
const tipHidden = (): boolean => {
  try {
    return localStorage.getItem(TIP_KEY) === '1';
  } catch {
    return false;
  }
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
  private readonly duration = h('div', { class: 'mt-4 space-y-2' });
  private readonly list = h('div', { attrs: { role: 'list' } });
  /** Títulos de parte y botones "Agregar frase", reutilizados por posición. */
  private readonly heads = new Map<string, { el: HTMLElement; add: HTMLButtonElement }>();
  private readonly rows = new Map<string, PhraseRow>();
  private script: ScriptView | null = null;
  private lastFocusNonce = 0;

  constructor(private readonly presenters: EditorPresenters) {
    const { scripts, phrases, voice, dictation } = presenters;
    this.topBar = new TopBar(scripts, () => void presenters.teleprompter.open());
    this.title = h('textarea', {
      class:
        'block w-full resize-none overflow-hidden bg-transparent text-[28px] leading-tight font-bold tracking-tight text-text caret-primary placeholder:text-muted/70 focus:outline-none sm:text-[34px]',
      attrs: {
        rows: 1,
        maxlength: 120,
        'aria-label': 'Título del guion',
        placeholder: 'Ponle un título…',
      },
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
      onDragStart: (id, event) => {
        this.drag(id, event);
      },
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
        this.tip(),
        h('div', { class: 'mt-7' }, this.list),
      ),
      // En el celular, lo que más se usa queda al alcance del pulgar.
      h(
        'nav',
        {
          class:
            'fixed inset-x-0 bottom-0 z-20 flex gap-2.5 border-t border-line bg-surface-raised/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden',
          attrs: { 'aria-label': 'Acciones del guion' },
        },
        h(
          'button',
          {
            class:
              'h-12 flex-1 rounded-xl bg-surface text-[15px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary',
            attrs: { type: 'button' },
            on: { click: () => void phrases.add() },
          },
          '+ Frase',
        ),
        h(
          'button',
          {
            class:
              'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            attrs: { type: 'button' },
            on: { click: () => void presenters.teleprompter.open() },
          },
          icon('play', 'size-3'),
          'Ensayar',
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
      // Sin título propio se ve la pista "Ponle un título…" en vez de un título falso.
      this.title.value = script.title === Script.DEFAULT_TITLE ? '' : script.title;
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

  /** Consejo de una línea; se cierra y no vuelve a salir en este navegador. */
  private tip(): HTMLElement {
    const el = h(
      'p',
      {
        class:
          'mt-5 flex items-center gap-2.5 rounded-[10px] bg-surface py-2 pr-2 pl-3.5 text-[13px] text-text',
        attrs: { hidden: tipHidden() },
      },
      h(
        'span',
        { class: 'flex-1' },
        'Una ',
        h('strong', { class: 'font-semibold', text: 'frase' }),
        ' es lo que dices de un tirón. Toca una para elegir su plano y energía o grabarte.',
      ),
      h(
        'button',
        {
          class:
            'grid size-8 shrink-0 place-items-center rounded-md text-muted transition hover:bg-surface-raised hover:text-text focus-visible:outline-2 focus-visible:outline-primary',
          attrs: { type: 'button', 'aria-label': 'Ocultar este consejo' },
          on: {
            click: () => {
              el.hidden = true;
              try {
                localStorage.setItem(TIP_KEY, '1');
              } catch {
                // Sin almacenamiento: solo se oculta hasta recargar.
              }
            },
          },
        },
        icon('close', 'size-3.5'),
      ),
    );
    return el;
  }

  /**
   * Una sola barra para duración y ritmo: cada tramo es una frase, de ancho
   * según lo que dura (sobre el máximo del formato) y de color según su
   * energía. La marca fina es la duración mínima.
   */
  private renderDuration(script: ScriptView): void {
    const { estimatedSec, durationStatus, format } = script;
    const spoken = script.phrases.filter((p) => p.seconds > 0);
    // Si se pasa del máximo, los tramos se reparten la barra entera.
    const scale = Math.max(format.maxSeconds, estimatedSec);
    const label = (p: PhraseView): string =>
      `Frase ${String(p.order)}: ${formatSeconds(p.seconds)}, energía ${p.energyLabel.toLowerCase()}`;
    const hint =
      durationStatus === 'OVER'
        ? 'Te pasaste: recorta o divide en dos videos'
        : durationStatus === 'UNDER'
          ? `Aún corto (mínimo ${formatClock(format.minSeconds)})`
          : durationStatus === 'EMPTY'
            ? 'Empieza por el inicio'
            : '';
    replaceChildren(
      this.duration,
      h(
        'div',
        {
          class: 'relative flex h-2 gap-0.5 overflow-hidden rounded-full bg-surface',
          attrs: {
            role: 'meter',
            'aria-label': `Duración estimada y ritmo. ${spoken.map(label).join('; ')}`,
            'aria-valuemin': 0,
            'aria-valuemax': format.maxSeconds,
            'aria-valuenow': Math.round(estimatedSec),
          },
        },
        ...spoken.map((p) =>
          h('span', {
            class: `shrink-0 ${ENERGY_FILL[p.energy]}`,
            attrs: { style: `width:${String((p.seconds / scale) * 100)}%`, title: label(p) },
          }),
        ),
        h('span', {
          class: 'absolute inset-y-0 w-px bg-muted/60',
          attrs: {
            style: `left:${String((format.minSeconds / scale) * 100)}%`,
            'aria-hidden': 'true',
          },
        }),
      ),
      h(
        'p',
        { class: 'flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted' },
        h(
          'span',
          { class: 'tabular-nums' },
          h('strong', { class: 'font-semibold text-text', text: formatClock(estimatedSec) }),
          ` de ${format.durationLabel}`,
        ),
        hint
          ? h('span', { class: durationStatus === 'OVER' ? 'text-warn' : '', text: hint })
          : null,
        spoken.length > 0
          ? h(
              'span',
              { class: 'ml-auto flex items-center gap-3', attrs: { 'aria-hidden': 'true' } },
              ...ENERGIES.map((energy) =>
                h(
                  'span',
                  { class: 'inline-flex items-center gap-1' },
                  h('span', { class: `size-2 rounded-full ${ENERGY_FILL[energy]}` }),
                  ENERGY_LABELS[energy].toLowerCase(),
                ),
              ),
            )
          : null,
      ),
    );
  }

  /**
   * Las frases en su orden real, con un título cada vez que cambia la parte
   * (inicio, desarrollo, cierre) y un "Agregar frase" al final de cada tramo.
   * Las filas se reutilizan y solo se mueven si cambió el orden, para no
   * perder el foco mientras se escribe.
   */
  private renderPhrases(state: AppState, script: ScriptView): void {
    const runs: PhraseView[][] = [];
    for (const phrase of script.phrases) {
      const run = runs.at(-1);
      if (run?.[0]?.section === phrase.section) run.push(phrase);
      else runs.push([phrase]);
    }
    const desired: HTMLElement[] = [];
    const seen = new Set<string>();
    runs.forEach((run, index) => {
      const head = this.sectionHead(String(index), script, run);
      desired.push(head.el);
      for (const phrase of run) {
        seen.add(phrase.id);
        let row = this.rows.get(phrase.id);
        if (!row) {
          row = new PhraseRow(phrase, this.rowHandlers);
          this.rows.set(phrase.id, row);
        }
        row.update(phrase, { voice: state.voice, dictation: state.dictation });
        desired.push(row.el);
      }
      desired.push(head.add);
    });
    // Guion sin frases: solo el botón para empezar.
    if (runs.length === 0) desired.push(this.sectionHead('vacio', script, []).add);

    desired.forEach((el, i) => {
      if (this.list.children[i] !== el) this.list.insertBefore(el, this.list.children[i] ?? null);
    });
    while (this.list.children.length > desired.length) this.list.lastElementChild?.remove();
    for (const id of this.rows.keys()) if (!seen.has(id)) this.rows.delete(id);
  }

  /** Título de un tramo de frases de la misma parte y su botón para agregar otra. */
  private sectionHead(
    key: string,
    script: ScriptView,
    run: readonly PhraseView[],
  ): { el: HTMLElement; add: HTMLButtonElement } {
    let head = this.heads.get(key);
    if (!head) {
      head = {
        el: h('h2', { class: 'mt-8 mb-1 flex items-baseline gap-2.5 first:mt-0' }),
        add: h('button', {
          class:
            'mt-1.5 flex items-center gap-2 rounded-md py-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary sm:ml-14',
          attrs: { type: 'button' },
        }),
      };
      this.heads.set(key, head);
    }
    const last = run.at(-1);
    const section = last?.section ?? 'BODY';
    const meta = SECTION_HEAD[section];
    const seconds = run.reduce((sum, p) => sum + p.seconds, 0);
    replaceChildren(
      head.el,
      h('span', {
        class: `text-[13px] font-semibold tracking-wide uppercase ${meta.color}`,
        text: meta.label,
      }),
      h('span', { class: 'text-[13px] text-muted', text: meta.goal(script) }),
      seconds > 0
        ? h('span', {
            class: 'ml-auto text-[13px] font-medium text-muted tabular-nums',
            text: formatClock(seconds),
          })
        : null,
    );
    replaceChildren(
      head.add,
      last ? `+ Agregar frase ${meta.add}` : '+ Agregar frase',
      h('span', { class: 'hidden text-xs font-normal text-muted sm:inline', text: 'Ctrl+Enter' }),
    );
    head.add.onclick = () => void this.presenters.phrases.add(last?.id, last?.section);
    return head;
  }

  /**
   * Arrastrar y soltar con eventos de puntero (ratón, dedo o lápiz): la frase
   * cae antes de la primera fila cuyo centro queda por debajo del puntero.
   */
  private drag(id: string, start: PointerEvent): void {
    const dragged = this.rows.get(id);
    const from = this.script?.phrases.findIndex((p) => p.id === id) ?? -1;
    if (!dragged || from < 0 || start.button !== 0) return;
    start.preventDefault();
    const handle = start.currentTarget as HTMLElement;
    handle.setPointerCapture(start.pointerId);
    const others = (this.script?.phrases ?? [])
      .map((p) => this.rows.get(p.id)?.el)
      .filter((el): el is HTMLElement => el !== undefined && el !== dragged.el);
    const above = 'shadow-[inset_0_2px_0_var(--primary)]';
    const below = 'shadow-[inset_0_-2px_0_var(--primary)]';
    let to = from;

    const move = (event: PointerEvent): void => {
      to = others.filter((el) => {
        const box = el.getBoundingClientRect();
        return box.top + box.height / 2 < event.clientY;
      }).length;
      others.forEach((el, i) => {
        el.classList.toggle(above, to !== from && i === to);
        el.classList.toggle(below, to !== from && to === others.length && i === to - 1);
      });
      // Cerca del borde de la ventana, desplaza para llegar a frases fuera de vista.
      if (event.clientY < 64) window.scrollBy(0, -12);
      else if (event.clientY > window.innerHeight - 64) window.scrollBy(0, 12);
    };
    const end = (event: PointerEvent): void => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      dragged.el.classList.remove('opacity-50');
      for (const el of others) el.classList.remove(above, below);
      if (event.type === 'pointerup' && to !== from) void this.presenters.phrases.moveTo(id, to);
    };

    dragged.el.classList.add('opacity-50');
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
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
