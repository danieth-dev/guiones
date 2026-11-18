import { VideoFormat } from '../../domain';
import type { ScriptsPresenter } from '../presenters/scripts-presenter';
import type { AppState } from '../store/app-state';
import { h } from './dom';
import { icon } from './icons';

/** Formato elegido en el formulario (o el de por defecto). */
const formatOf = (data: FormData): string => {
  const value = data.get('format');
  return typeof value === 'string' ? value : VideoFormat.DEFAULT.id;
};

/**
 * "Nuevo guion": de qué trata y qué tipo de video. El guion empieza con el
 * esqueleto de su formato (inicio, desarrollo y cierre).
 */
export class NewScriptDialog {
  readonly el: HTMLElement;
  private readonly title: HTMLInputElement;
  private readonly form: HTMLFormElement;

  constructor(private readonly presenter: ScriptsPresenter) {
    this.title = h('input', {
      class:
        'h-11 w-full rounded-control px-3 text-base ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/50',
      attrs: {
        type: 'text',
        name: 'title',
        maxlength: 120,
        placeholder: 'Ej.: Por qué tu primer video no despega',
      },
    });
    const options = VideoFormat.ALL.map((format, i) =>
      h(
        'label',
        {
          class:
            'flex cursor-pointer items-center gap-3.5 rounded-card p-3.5 ring-1 ring-line transition has-[:checked]:bg-primary-soft has-[:checked]:ring-2 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
        },
        h('input', {
          class: 'sr-only',
          attrs: { type: 'radio', name: 'format', value: format.id, checked: i === 0 },
        }),
        icon(
          format.orientation === 'VERTICAL' ? 'vertical' : 'horizontal',
          'size-8 shrink-0 text-text',
        ),
        h(
          'span',
          { class: 'flex-1' },
          h('span', { class: 'block font-semibold', text: format.label }),
          h('span', {
            class: 'block text-[13px] text-muted',
            text: `${format.durationLabel[0]?.toUpperCase() ?? ''}${format.durationLabel.slice(1)} · ${format.platforms}`,
          }),
        ),
      ),
    );
    this.form = h(
      'form',
      {
        class: 'flex h-full flex-col gap-5 overflow-y-auto p-5',
        on: {
          submit: (event) => {
            event.preventDefault();
            const data = new FormData(this.form);
            void this.presenter.create({
              title: this.title.value,
              formatId: formatOf(data),
            });
          },
        },
      },
      h(
        'header',
        { class: 'flex items-center justify-between' },
        h('h2', { class: 'text-[17px] font-semibold', text: 'Nuevo guion' }),
        h('button', {
          class: 'text-[15px] text-primary hover:underline',
          text: 'Cancelar',
          attrs: { type: 'button' },
          on: {
            click: () => {
              presenter.setCreating(false);
            },
          },
        }),
      ),
      h(
        'label',
        { class: 'block space-y-1.5' },
        h('span', { class: 'block text-xs font-semibold text-muted', text: '¿De qué trata?' }),
        this.title,
      ),
      h(
        'fieldset',
        { class: 'space-y-2.5' },
        h('legend', {
          class: 'mb-2 text-xs font-semibold text-muted',
          text: '¿Qué tipo de video?',
        }),
        ...options,
      ),
      h('p', {
        class: 'text-[13px] text-muted',
        text: 'Te armamos el esqueleto: un inicio que engancha, el desarrollo y un cierre. Solo escribe lo que dirías.',
      }),
      h('span', { class: 'flex-1' }),
      h('button', {
        class:
          'h-12 rounded-card bg-primary text-[17px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary',
        text: 'Crear guion',
        attrs: { type: 'submit' },
      }),
    );
    this.el = h(
      'div',
      {
        class: 'fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center',
        attrs: { hidden: true },
        on: {
          click: (event) => {
            if (event.target === this.el) presenter.setCreating(false);
          },
          keydown: (event) => {
            if (event.key === 'Escape') presenter.setCreating(false);
          },
        },
      },
      h(
        'div',
        {
          class:
            'h-[92dvh] w-full max-w-md rounded-t-[16px] bg-surface-raised shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:rounded-card',
          attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Nuevo guion' },
        },
        this.form,
      ),
    );
  }

  render(state: AppState): void {
    const wasHidden = this.el.hidden;
    this.el.hidden = !state.creating;
    if (state.creating && wasHidden) {
      this.form.reset();
      this.title.focus();
    }
  }
}
