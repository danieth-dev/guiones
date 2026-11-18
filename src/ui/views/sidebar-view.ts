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
  private readonly list = h('ul', { class: 'space-y-1' });
  private readonly count = h('span', { class: 'font-medium' });

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
        { class: 'relative flex h-[72px] shrink-0 items-center justify-center px-6' },
        h('span', {
          class: 'font-logo text-[27px] font-bold tracking-[-0.03em]',
          text: 'Guiones',
        }),
        h(
          'span',
          { class: 'absolute top-1/2 right-3 -translate-y-1/2 lg:hidden' },
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
        { class: 'flex flex-col gap-2 px-5 pt-2' },
        h(
          'button',
          {
            class:
              'flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-3 text-[15px] font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            attrs: { type: 'button' },
            on: {
              click: () => {
                presenter.setCreating(true);
              },
            },
          },
          icon('plus', 'size-[18px]'),
          'Nuevo guion',
        ),
        fileButton({
          label: 'Importar guion (.md)',
          accept: '.md,text/markdown,text/plain',
          className:
            'flex h-10 w-full items-center justify-center gap-2 rounded-[10px] text-sm text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-primary',
          content: [icon('share', 'size-4'), 'Importar guion (.md)'],
          onText: (text) => void presenter.importDocument(text),
        }),
      ),
      h(
        'section',
        { class: 'flex min-h-0 flex-1 flex-col gap-2 px-5 pt-7' },
        h(
          'h2',
          { class: 'flex justify-between px-3 text-[13px] font-semibold text-muted' },
          'Tus guiones',
          this.count,
        ),
        this.list,
      ),
      h(
        'div',
        { class: 'px-5 pt-4 pb-5' },
        h(
          'button',
          {
            class:
              'flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] text-text transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
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
    this.count.textContent = String(state.scripts.length);
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
              class: `flex w-full flex-col gap-1 rounded-xl p-3 pr-11 text-left transition ${active ? 'bg-primary-soft text-primary' : 'hover:bg-surface'}`,
              attrs: { type: 'button', 'aria-current': active ? 'true' : null },
              on: { click: () => void this.presenter.open(script.id) },
            },
            h('span', {
              class: `block truncate text-[15px] ${active ? 'font-semibold' : 'font-medium'}`,
              text: script.title,
            }),
            h('span', {
              class: 'block truncate text-[13px] text-muted',
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
