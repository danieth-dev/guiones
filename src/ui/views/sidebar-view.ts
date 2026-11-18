import type { ScriptsPresenter } from '../presenters/scripts-presenter';
import type { AppState } from '../store/app-state';
import { fileButton } from './components/file-picker';
import { iconButton } from './components/primitives';
import { h, replaceChildren } from './dom';
import { icon } from './icons';
import { formatClock } from './labels';

/** Panel izquierdo: nuevo guion, tus guiones y ajustes. */
export class SidebarView {
  readonly el: HTMLElement;
  private readonly list = h('ul', { class: 'space-y-0.5' });

  constructor(
    private readonly presenter: ScriptsPresenter,
    onOpenSettings: () => void,
  ) {
    this.el = h(
      'aside',
      {
        class:
          'sidebar fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-sidebar transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:max-w-none lg:translate-x-0',
        attrs: { 'aria-label': 'Tus guiones' },
      },
      h(
        'div',
        { class: 'flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-5' },
        h('span', { class: 'text-[17px] font-semibold tracking-tight', text: 'Guiones' }),
        h('span', { class: 'flex-1' }),
        h(
          'span',
          { class: 'lg:hidden' },
          iconButton({
            icon: 'close',
            label: 'Cerrar menú',
            onClick: () => {
              presenter.setNavOpen(false);
            },
          }),
        ),
      ),
      h(
        'div',
        { class: 'flex items-center gap-1 px-3 pt-4' },
        h(
          'button',
          {
            class:
              'flex h-10 flex-1 items-center gap-2 rounded-control px-3 text-sm font-semibold text-primary ring-1 ring-line transition hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary',
            attrs: { type: 'button' },
            on: {
              click: () => {
                presenter.setCreating(true);
              },
            },
          },
          icon('plus', 'size-4'),
          'Nuevo guion',
        ),
        fileButton({
          label: 'Importar guion (.md)',
          accept: '.md,text/markdown,text/plain',
          className:
            'grid size-10 place-items-center rounded-control text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-primary',
          content: [icon('share', 'size-4')],
          onText: (text) => void presenter.importDocument(text),
        }),
      ),
      h(
        'section',
        { class: 'flex min-h-0 flex-1 flex-col gap-1 px-3 pt-5' },
        h('h2', { class: 'px-2.5 text-xs font-semibold text-muted', text: 'Tus guiones' }),
        this.list,
      ),
      h(
        'div',
        { class: 'border-t border-line px-3 py-2' },
        h(
          'button',
          {
            class:
              'flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[15px] text-text transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
            attrs: { type: 'button' },
            on: { click: onOpenSettings },
          },
          icon('sliders', 'size-[18px] text-muted'),
          'Ajustes',
        ),
      ),
    );
  }

  render(state: AppState): void {
    this.el.classList.toggle('-translate-x-full', !state.navOpen);
    replaceChildren(
      this.list,
      ...state.scripts.map((script) => {
        const active = script.id === state.current?.id;
        return h(
          'li',
          { class: 'group relative' },
          h(
            'button',
            {
              class: `w-full rounded-lg px-2.5 py-2 pr-10 text-left transition ${active ? 'bg-primary-soft text-primary' : 'hover:bg-surface'}`,
              attrs: { type: 'button', 'aria-current': active ? 'true' : null },
              on: { click: () => void this.presenter.open(script.id) },
            },
            h('span', {
              class: `block truncate text-sm ${active ? 'font-semibold' : ''}`,
              text: script.title,
            }),
            h('span', {
              class: 'block truncate text-xs text-muted',
              text: `${script.formatLabel} · ${formatClock(script.estimatedSec)}`,
            }),
          ),
          h(
            'span',
            {
              class:
                'absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100',
            },
            iconButton({
              icon: 'trash',
              label: `Eliminar «${script.title}»`,
              variant: 'danger',
              onClick: () => {
                if (
                  confirm(`¿Eliminar «${script.title}» y sus grabaciones? No se puede deshacer.`)
                ) {
                  void this.presenter.remove(script.id);
                }
              },
            }),
          ),
        );
      }),
    );
  }
}
