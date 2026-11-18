import type { ExportFile, FormatView } from '../../../application';
import { VideoFormat } from '../../../domain';
import type { ScriptsPresenter } from '../../presenters/scripts-presenter';
import type { AppState } from '../../store/app-state';
import { downloadFile, h, replaceChildren } from '../dom';
import { icon } from '../icons';
import { statusChip } from './primitives';

const orientationIcon = (format: Pick<FormatView, 'orientation'>, size = 'size-4') =>
  icon(format.orientation === 'VERTICAL' ? 'vertical' : 'horizontal', size);

/**
 * Barra superior del guion: el formato de video (cambia la duración objetivo y
 * los planos sugeridos), el estado de guardado, exportar y Ensayar.
 */
export class TopBar {
  readonly el: HTMLElement;
  private readonly formatMenu: HTMLDetailsElement;
  private readonly formatLabel = h('span', { class: 'flex items-center gap-2' });
  private readonly formatOptions = h('div', { class: 'space-y-0.5' });
  private readonly exportMenu: HTMLDetailsElement;
  private readonly saveStatus = h('div', { class: 'hidden items-center sm:flex' });
  private renderedFormat = '';

  constructor(
    private readonly presenter: ScriptsPresenter,
    onRehearse: () => void,
  ) {
    this.formatMenu = h(
      'details',
      { class: 'relative min-w-0' },
      h(
        'summary',
        {
          class:
            '-ml-2.5 flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] whitespace-nowrap text-text transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
          attrs: { title: 'Tipo de video' },
        },
        this.formatLabel,
        icon('down', 'size-3.5 shrink-0 text-muted'),
      ),
      h(
        'div',
        {
          class:
            'absolute left-0 z-30 mt-2 w-80 max-w-[85vw] rounded-card bg-surface-raised p-1.5 shadow-lg ring-1 ring-line',
        },
        this.formatOptions,
      ),
    );

    const download = (load: () => Promise<ExportFile | null>) => () => {
      this.exportMenu.open = false;
      void load().then((file) => {
        if (file) downloadFile(file);
      });
    };
    const exportItem = (label: string, detail: string, onClick: () => void) =>
      h(
        'button',
        {
          class: 'block w-full rounded-md px-3 py-2 text-left transition hover:bg-surface',
          attrs: { type: 'button' },
          on: { click: onClick },
        },
        h('span', { class: 'block text-sm', text: label }),
        h('span', { class: 'block text-xs text-muted', text: detail }),
      );
    this.exportMenu = h(
      'details',
      { class: 'relative' },
      h(
        'summary',
        {
          class:
            'grid size-9 cursor-pointer list-none place-items-center rounded-lg text-primary transition hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary',
          attrs: { 'aria-label': 'Exportar', title: 'Exportar' },
        },
        icon('download', 'size-[18px]'),
      ),
      h(
        'div',
        {
          class:
            'absolute right-0 z-30 mt-2 w-64 space-y-0.5 rounded-card bg-surface-raised p-1 shadow-lg ring-1 ring-line',
        },
        exportItem(
          'Tabla de rodaje (.md)',
          'Para grabar: qué dices, plano y energía',
          download(() => presenter.exportCurrent('md')),
        ),
        exportItem(
          'Texto para leer (.txt)',
          'Para un teleprompter externo',
          download(() => presenter.exportCurrent('txt')),
        ),
        exportItem(
          'Guion editable (.md)',
          'Para Obsidian; se puede volver a importar',
          download(() => presenter.exportDocument()),
        ),
      ),
    );

    this.el = h(
      'div',
      {
        class:
          'sticky top-14 z-10 flex h-14 items-center gap-3 border-b border-line bg-surface-raised/95 px-5 backdrop-blur-xl lg:top-0 lg:px-6',
        attrs: { role: 'toolbar', 'aria-label': 'Barra del guion' },
      },
      this.formatMenu,
      h('span', { class: 'flex-1' }),
      this.saveStatus,
      this.exportMenu,
      h(
        'button',
        {
          class:
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-primary',
          attrs: { type: 'button', title: 'Leer el guion en voz alta con teleprompter' },
          on: { click: onRehearse },
        },
        icon('play', 'size-3'),
        'Ensayar',
      ),
    );
  }

  render(state: AppState): void {
    const current = state.current;
    if (current && this.renderedFormat !== current.format.id) {
      this.renderedFormat = current.format.id;
      replaceChildren(
        this.formatLabel,
        orientationIcon(current.format),
        current.format.label,
        // En el celular la duración ya se ve debajo del título.
        h('span', { class: 'hidden sm:inline', text: `· ${current.format.durationLabel}` }),
      );
      replaceChildren(
        this.formatOptions,
        ...VideoFormat.ALL.map((format) => {
          const active = format.id === current.format.id;
          return h(
            'button',
            {
              class: `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition hover:bg-surface ${active ? 'bg-primary-soft' : ''}`,
              attrs: { type: 'button', 'aria-pressed': String(active) },
              on: {
                click: () => {
                  this.formatMenu.open = false;
                  void this.presenter.changeFormat(format.id);
                },
              },
            },
            orientationIcon(format, 'size-5 shrink-0'),
            h(
              'span',
              {},
              h('span', {
                class: 'block text-sm font-medium',
                text: `${format.label} · ${format.durationLabel}`,
              }),
              h('span', { class: 'block text-xs text-muted', text: format.platforms }),
            ),
          );
        }),
      );
    }
    replaceChildren(
      this.saveStatus,
      state.saveStatus === 'saving'
        ? statusChip({ label: 'Guardando…', loading: true, variant: 'plain' })
        : state.saveStatus === 'saved'
          ? statusChip({ label: 'Guardado', variant: 'plain' })
          : state.saveStatus === 'error'
            ? statusChip({ label: 'Sin guardar', variant: 'danger', icon: 'alert' })
            : null,
    );
  }
}
