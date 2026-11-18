import type { PracticeSessionReport } from '../../application';
import type { TeleprompterPresenter } from '../presenters/teleprompter-presenter';
import type { AppState, PrompterUnit, TeleprompterState } from '../store/app-state';
import { h, replaceChildren } from './dom';
import { icon } from './icons';
import { formatClock, formatSeconds as seconds } from './labels';

const darkButton = (
  label: string,
  onClick: () => void,
  options: { readonly primary?: boolean; readonly icon?: Parameters<typeof icon>[0] } = {},
): HTMLButtonElement =>
  h(
    'button',
    {
      class: `inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 ${
        options.primary
          ? 'bg-[#0071e3] text-white hover:bg-[#0071e3]/90'
          : 'bg-white/10 text-white hover:bg-white/20'
      }`,
      attrs: { type: 'button' },
      on: { click: onClick },
    },
    options.icon ? icon(options.icon, 'size-4') : null,
    label,
  );

/**
 * Teleprompter a pantalla completa, siempre en alto contraste (blanco sobre
 * negro) para leer de lejos. Atajos: espacio o → avanzan, ← retrocede, Esc cierra.
 */
export class TeleprompterView {
  readonly el: HTMLElement;
  private readonly modes = h('div', {
    class: 'grid grid-cols-2 gap-0.5 rounded-[9px] bg-white/10 p-0.5',
    attrs: { role: 'radiogroup', 'aria-label': 'Modo del teleprompter' },
  });
  private readonly totalTimer = h('span', { class: 'tabular-nums text-white/70' });
  private readonly counter = h('span', { class: 'tabular-nums text-white/70' });
  private readonly body = h('div', { class: 'min-h-0 flex-1 overflow-y-auto' });
  private readonly footer = h('div', {
    class: 'flex flex-wrap items-center justify-center gap-3 px-4 pt-3 pb-6',
  });
  private unitTimer: HTMLElement | null = null;
  private state: TeleprompterState | null = null;
  private renderedKey = '';
  private ticker: ReturnType<typeof setInterval> | null = null;
  private frame: number | null = null;
  private lastFrame = 0;

  constructor(
    private readonly presenter: TeleprompterPresenter,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.el = h(
      'div',
      {
        class: 'fixed inset-0 z-[60] flex flex-col bg-black text-white',
        attrs: {
          hidden: true,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': 'Teleprompter',
          tabindex: -1,
        },
        on: {
          keydown: (event) => {
            this.onKey(event);
          },
        },
      },
      h(
        'header',
        { class: 'flex flex-wrap items-center gap-3 px-4 pt-4 pb-2 sm:px-6' },
        h(
          'button',
          {
            class:
              'grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white',
            attrs: { type: 'button', 'aria-label': 'Cerrar teleprompter (Esc)' },
            on: {
              click: () => {
                presenter.close();
              },
            },
          },
          icon('close', 'size-5'),
        ),
        this.modes,
        h('span', { class: 'flex-1' }),
        this.totalTimer,
        this.counter,
      ),
      this.body,
      this.footer,
    );
  }

  render(state: AppState): void {
    const prompter = state.teleprompter;
    const wasHidden = this.el.hidden;
    this.el.hidden = prompter === null;
    this.state = prompter;
    this.syncTimers(prompter);
    if (!prompter || !state.current) {
      this.renderedKey = '';
      return;
    }
    const key = JSON.stringify([
      prompter.mode,
      prompter.index,
      prompter.report,
      prompter.recording,
      prompter.playing,
      prompter.unitStartedAt === null,
      prompter.hasFullTake,
      state.current.wordsPerMinute,
    ]);
    if (key !== this.renderedKey) {
      this.renderedKey = key;
      this.renderModes(prompter);
      if (prompter.report) this.renderReport(prompter, prompter.report);
      else if (prompter.mode === 'scroll') this.renderScroll(prompter);
      else this.renderPractice(prompter);
    }
    this.tick();
    if (wasHidden) this.el.focus();
  }

  // ───────────────────────────── Modos ─────────────────────────────

  private renderModes(state: TeleprompterState): void {
    const option = (mode: TeleprompterState['mode'], label: string, title: string) =>
      h('button', {
        class: `min-h-9 rounded-[7px] px-4 text-[13px] transition focus-visible:outline-2 focus-visible:outline-white ${
          state.mode === mode
            ? 'bg-white font-semibold text-black'
            : 'text-white/80 hover:text-white'
        }`,
        text: label,
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(state.mode === mode),
          title,
        },
        on: {
          click: () => {
            this.presenter.setMode(mode);
          },
        },
      });
    replaceChildren(
      this.modes,
      option('practice', 'Práctica', 'Una frase a la vez, con cronómetro'),
      option('scroll', 'Lectura', 'El texto sube solo a tu velocidad, para grabar'),
    );
  }

  private renderPractice(state: TeleprompterState): void {
    const unit = state.units[state.index];
    if (!unit) return;
    this.unitTimer = h('p', { class: 'mt-8 text-[15px] tabular-nums text-white/60' });
    replaceChildren(
      this.body,
      h(
        'div',
        { class: 'mx-auto flex min-h-full max-w-4xl flex-col justify-center px-6 py-8' },
        h('p', {
          class: 'text-[15px] font-semibold tracking-wide text-[#0a84ff]',
          text: unit.direction,
        }),
        h('p', {
          class: 'mt-4 text-[34px] leading-tight font-semibold sm:text-5xl sm:leading-tight',
          text: unit.text,
        }),
        unit.note
          ? h(
              'p',
              { class: 'mt-5 flex items-center gap-2 text-[17px] text-white/60' },
              icon('camera', 'size-5'),
              unit.note,
            )
          : null,
        this.unitTimer,
      ),
    );
    const running = state.unitStartedAt !== null;
    const started = running || Object.keys(state.elapsed).length > 0;
    const last = state.index === state.units.length - 1;
    const prev = darkButton(
      'Anterior',
      () => {
        this.presenter.previous();
      },
      { icon: 'back' },
    );
    prev.disabled = state.index === 0;
    replaceChildren(
      this.footer,
      prev,
      started
        ? darkButton(
            running ? 'Pausa' : 'Seguir',
            () => {
              this.presenter.toggleRunning();
            },
            { icon: running ? 'stop' : 'play' },
          )
        : null,
      darkButton(
        !started ? 'Empezar' : last ? 'Terminar' : 'Siguiente',
        () => void this.presenter.next(),
        { primary: true, icon: started ? 'forward' : 'play' },
      ),
      h('p', {
        class: 'w-full text-center text-[13px] text-white/50',
        text: 'Espacio o → avanzan · ← retrocede · Esc cierra',
      }),
    );
  }

  private renderScroll(state: TeleprompterState): void {
    replaceChildren(
      this.body,
      h(
        'div',
        { class: 'mx-auto max-w-4xl space-y-12 px-6 pt-[40vh] pb-[60vh]' },
        ...state.units.map((unit) =>
          h(
            'div',
            {},
            h('p', { class: 'text-[15px] font-semibold text-[#0a84ff]', text: unit.direction }),
            h('p', {
              class: 'mt-3 text-[34px] leading-tight font-semibold sm:text-5xl',
              text: unit.text,
            }),
          ),
        ),
      ),
    );
    const running = state.unitStartedAt !== null;
    replaceChildren(
      this.footer,
      darkButton(
        'Al inicio',
        () => {
          this.body.scrollTop = 0;
          this.presenter.restart();
        },
        { icon: 'retake' },
      ),
      darkButton(
        running ? 'Pausa' : 'Rodar',
        () => {
          this.presenter.toggleRunning();
        },
        { primary: true, icon: running ? 'stop' : 'play' },
      ),
      h('p', {
        class: 'w-full text-center text-[13px] text-white/50',
        text: 'El texto sube a tu velocidad de locución · Espacio pausa · Esc cierra',
      }),
    );
  }

  private renderReport(state: TeleprompterState, report: PracticeSessionReport): void {
    const label = (unitId: string): string => {
      const unit = state.units.find((u) => u.id === unitId);
      if (!unit) return '';
      const words = unit.text.split(' ');
      return `${words.slice(0, 5).join(' ')}${words.length > 5 ? '…' : ''}`;
    };
    const calibration =
      report.measuredWpm === null
        ? h('p', {
            class: 'text-white/70',
            text: 'El ensayo fue muy corto para medir tu ritmo. Repite con el guion completo.',
          })
        : h(
            'div',
            { class: 'space-y-3' },
            h('p', {
              class: 'text-[17px]',
              text: `Hablas a ${String(report.measuredWpm)} palabras por minuto; el guion usa ${String(report.currentWpm)}.`,
            }),
            report.measuredWpm !== report.currentWpm
              ? darkButton(
                  `Usar ${String(report.measuredWpm)} ppm en este guion`,
                  () => void this.presenter.applyCalibration(),
                  {
                    primary: true,
                    icon: 'check',
                  },
                )
              : h('p', { class: 'text-[#30d158]', text: 'Tu guion ya está calibrado a tu voz.' }),
          );

    const card = (title: string, ...children: (Node | null)[]) =>
      h(
        'section',
        { class: 'space-y-3 rounded-[14px] bg-white/[0.07] p-5' },
        h('h3', { class: 'text-[17px] font-semibold', text: title }),
        ...children,
      );

    replaceChildren(
      this.body,
      h(
        'div',
        { class: 'mx-auto max-w-2xl space-y-5 px-5 py-6' },
        h('h2', { class: 'text-[28px] font-bold tracking-tight', text: 'Ensayo terminado' }),
        card(
          'Estimado frente a real',
          h(
            'table',
            { class: 'w-full text-left text-[15px] tabular-nums' },
            h(
              'thead',
              { class: 'text-[13px] text-white/60' },
              h(
                'tr',
                {},
                h('th', { class: 'py-1 font-medium', text: 'Bloque' }),
                h('th', { class: 'py-1 text-right font-medium', text: 'Estimado' }),
                h('th', { class: 'py-1 text-right font-medium', text: 'Real' }),
              ),
            ),
            h(
              'tbody',
              { class: 'divide-y divide-white/10' },
              ...report.phrases.map((unit) =>
                h(
                  'tr',
                  {},
                  h('td', { class: 'py-2 pr-2', text: label(unit.phraseId) }),
                  h('td', {
                    class: 'py-2 text-right text-white/70',
                    text: seconds(unit.estimatedSec),
                  }),
                  h('td', {
                    class: `py-2 text-right ${unit.actualSec > unit.estimatedSec * 1.25 ? 'text-[#ff9f0a]' : ''}`,
                    text: seconds(unit.actualSec),
                  }),
                ),
              ),
            ),
            h(
              'tfoot',
              { class: 'font-semibold' },
              h(
                'tr',
                {},
                h('td', { class: 'pt-2', text: 'Total' }),
                h('td', { class: 'pt-2 text-right', text: seconds(report.totalEstimatedSec) }),
                h('td', { class: 'pt-2 text-right', text: seconds(report.totalActualSec) }),
              ),
            ),
          ),
        ),
        card('Tu ritmo real', calibration),
        card(
          'Toma completa',
          h('p', {
            class: 'text-[15px] text-white/70',
            text: 'Grábate diciendo todo de corrido y escúchalo como lo oiría tu audiencia. Si algo suena raro, vuelve al guion y ajústalo.',
          }),
          state.recording ? this.readingColumn(state.units) : null,
          h(
            'div',
            { class: 'flex flex-wrap gap-3' },
            darkButton(
              state.recording
                ? 'Detener'
                : state.hasFullTake
                  ? 'Grabar de nuevo'
                  : 'Grabar toma completa',
              () => void this.presenter.toggleFullTake(),
              {
                primary: state.recording || !state.hasFullTake,
                icon: state.recording ? 'stop' : 'record',
              },
            ),
            state.hasFullTake && !state.recording
              ? darkButton(
                  state.playing ? 'Detener' : 'Escuchar',
                  () => void this.presenter.playFullTake(),
                  {
                    icon: state.playing ? 'stop' : 'play',
                  },
                )
              : null,
          ),
        ),
      ),
    );
    replaceChildren(
      this.footer,
      darkButton(
        'Repetir ensayo',
        () => {
          this.presenter.restart();
        },
        { icon: 'retake' },
      ),
      darkButton(
        'Volver al guion',
        () => {
          this.presenter.close();
        },
        { primary: true },
      ),
    );
  }

  /** Texto para leer mientras se graba la toma completa. */
  private readingColumn(units: readonly PrompterUnit[]): HTMLElement {
    return h(
      'div',
      { class: 'max-h-[45vh] space-y-4 overflow-y-auto rounded-[10px] bg-black/40 p-4' },
      ...units.map((unit) =>
        h('p', { class: 'text-[22px] leading-snug font-semibold', text: unit.text }),
      ),
    );
  }

  // ───────────────────────────── Tiempo ─────────────────────────────

  /** Cronómetros en pantalla: solo mientras corre (la vista calcula, el presentador guarda marcas). */
  private syncTimers(state: TeleprompterState | null): void {
    const running = state !== null && state.unitStartedAt !== null && !state.report;
    if (running && this.ticker === null) {
      this.ticker = setInterval(() => {
        this.tick();
      }, 200);
    } else if (!running && this.ticker !== null) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
    const scrolling = running && state.mode === 'scroll';
    if (scrolling && this.frame === null) {
      this.lastFrame = performance.now();
      this.frame = requestAnimationFrame((t) => {
        this.scrollStep(t);
      });
    } else if (!scrolling && this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private tick(): void {
    const state = this.state;
    if (!state) return;
    const live = state.unitStartedAt === null ? 0 : Math.max(0, this.now() - state.unitStartedAt);
    const total = Object.values(state.elapsed).reduce((sum, ms) => sum + ms, 0) + live;
    this.totalTimer.textContent = formatClock(Math.floor(total / 1000));
    this.counter.textContent =
      state.mode === 'practice' && !state.report
        ? `${String(state.index + 1)}/${String(state.units.length)}`
        : '';
    const unit = state.units[state.index];
    if (this.unitTimer && unit) {
      const spent = ((state.elapsed[unit.id] ?? 0) + live) / 1000;
      this.unitTimer.textContent = `${seconds(Math.round(spent * 10) / 10)} de ${seconds(unit.estimatedSec)} estimados`;
      this.unitTimer.classList.toggle('text-[#ff9f0a]', spent > unit.estimatedSec * 1.25);
    }
  }

  /** Scroll automático: recorre todo el texto en la duración estimada del guion. */
  private scrollStep(time: number): void {
    const state = this.state;
    if (!state) return;
    const totalSec = state.units.reduce((sum, u) => sum + u.estimatedSec, 0) || 1;
    const distance = this.body.scrollHeight - this.body.clientHeight;
    const dt = (time - this.lastFrame) / 1000;
    this.lastFrame = time;
    this.body.scrollTop += (distance / totalSec) * dt;
    this.frame = requestAnimationFrame((t) => {
      this.scrollStep(t);
    });
  }

  private onKey(event: KeyboardEvent): void {
    const state = this.state;
    if (!state) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.presenter.close();
      return;
    }
    if (state.report || (event.target as HTMLElement).tagName === 'BUTTON') return;
    if (event.key === ' ' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (state.mode === 'scroll') this.presenter.toggleRunning();
      else void this.presenter.next();
    } else if (event.key === 'ArrowLeft' && state.mode === 'practice') {
      event.preventDefault();
      this.presenter.previous();
    }
  }
}
