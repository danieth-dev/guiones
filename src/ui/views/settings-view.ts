import type { ThemePreference } from '../../application';
import type { SettingsPresenter } from '../presenters/settings-presenter';
import type { AppState } from '../store/app-state';
import { iconButton } from './components/primitives';
import { h, replaceChildren, syncValue } from './dom';
import { icon } from './icons';

const THEMES: readonly { readonly value: ThemePreference; readonly label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

/** Panel "Ajustes": palabras por minuto y tema. */
export class SettingsView {
  readonly el: HTMLElement;
  private readonly wpm: HTMLInputElement;
  private readonly applyButton: HTMLButtonElement;
  private readonly themes = h('div', {
    class: 'grid grid-cols-3 gap-0.5 rounded-[9px] bg-surface p-0.5',
    attrs: { role: 'radiogroup', 'aria-label': 'Tema' },
  });
  private renderedTheme: ThemePreference | null = null;

  constructor(private readonly presenter: SettingsPresenter) {
    this.wpm = h('input', {
      class:
        'w-24 rounded-control bg-bg px-3 py-2 text-right text-[15px] tabular-nums ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary/50',
      attrs: {
        type: 'number',
        min: 80,
        max: 260,
        step: 1,
        inputmode: 'numeric',
        'aria-label': 'Palabras por minuto para guiones nuevos',
      },
      on: {
        change: () => void presenter.setDefaultWpm(Number(this.wpm.value)),
      },
    });
    this.applyButton = h('button', {
      class:
        'text-[15px] text-primary hover:underline disabled:pointer-events-none disabled:opacity-40',
      attrs: { type: 'button' },
      on: {
        click: () => void presenter.applyWpmToCurrent(Number(this.wpm.value)),
      },
    });

    const group = (title: string, ...children: (Node | null)[]) =>
      h(
        'section',
        { class: 'space-y-1.5' },
        h('h3', { class: 'px-4 text-[13px] font-semibold text-muted', text: title }),
        h(
          'div',
          { class: 'space-y-3 rounded-card bg-surface-raised p-4 ring-1 ring-line' },
          ...children,
        ),
      );

    this.el = h(
      'div',
      {
        class: 'fixed inset-0 z-50 flex justify-end bg-black/30',
        attrs: { hidden: true },
        on: {
          click: (event) => {
            if (event.target === this.el) presenter.close();
          },
          keydown: (event) => {
            if (event.key === 'Escape') presenter.close();
          },
        },
      },
      h(
        'aside',
        {
          class: 'flex h-full w-full max-w-md flex-col bg-bg shadow-2xl',
          attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Ajustes' },
        },
        h(
          'header',
          { class: 'flex items-center gap-2 px-5 pt-5 pb-4' },
          icon('sliders', 'size-5 text-primary'),
          h('h2', { class: 'text-xl font-bold', text: 'Ajustes' }),
          h('span', { class: 'flex-1' }),
          iconButton({
            icon: 'close',
            label: 'Cerrar',
            onClick: () => {
              presenter.close();
            },
          }),
        ),
        h(
          'div',
          { class: 'flex-1 space-y-6 overflow-y-auto px-5 pb-8' },
          group(
            'Velocidad de locución',
            h(
              'label',
              { class: 'flex items-center justify-between gap-3 text-[15px]' },
              h('span', { text: 'Palabras por minuto (guiones nuevos)' }),
              this.wpm,
            ),
            h('p', {
              class: 'text-[13px] leading-relaxed text-muted',
              text: 'Con ella se estiman las duraciones. Lo más exacto es calibrarla: ensaya con el teleprompter y la app mide cuánto hablas de verdad.',
            }),
            this.applyButton,
          ),
          group(
            'Apariencia',
            this.themes,
            h('p', {
              class: 'text-[13px] text-muted',
              text: '"Sistema" sigue el modo claro u oscuro de tu dispositivo.',
            }),
          ),
        ),
      ),
    );
  }

  render(state: AppState): void {
    const wasHidden = this.el.hidden;
    this.el.hidden = !state.settingsOpen;
    const settings = state.settings;
    if (!state.settingsOpen || !settings) return;
    syncValue(this.wpm, String(settings.defaultWpm));
    const current = state.current;
    this.applyButton.disabled = !current || current.wordsPerMinute === settings.defaultWpm;
    this.applyButton.textContent = current
      ? `Usar ${String(settings.defaultWpm)} ppm en «${current.title}» (ahora ${String(current.wordsPerMinute)})`
      : 'Abre un guion para aplicarla';
    if (this.renderedTheme !== settings.theme) {
      this.renderedTheme = settings.theme;
      replaceChildren(
        this.themes,
        ...THEMES.map(({ value, label }) =>
          h('button', {
            class: `min-h-9 rounded-[7px] text-[13px] transition focus-visible:outline-2 focus-visible:outline-primary ${
              value === settings.theme
                ? 'bg-surface-raised font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-muted hover:text-text'
            }`,
            text: label,
            attrs: {
              type: 'button',
              role: 'radio',
              'aria-checked': String(value === settings.theme),
            },
            on: { click: () => void this.presenter.setTheme(value) },
          }),
        ),
      );
    }
    if (wasHidden) this.wpm.focus();
  }
}
