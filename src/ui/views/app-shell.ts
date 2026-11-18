import type { ThemePreference } from '../../application';
import type { ScriptsPresenter } from '../presenters/scripts-presenter';
import type { AppState } from '../store/app-state';
import type { Store } from '../store/store';
import { iconButton } from './components/primitives';
import { h, replaceChildren } from './dom';
import { EditorView, type EditorPresenters } from './editor-view';
import { icon } from './icons';
import { NewScriptDialog } from './new-script-dialog';
import { SettingsView } from './settings-view';
import { SidebarView } from './sidebar-view';
import { TeleprompterView } from './teleprompter-view';

/**
 * Dos columnas en escritorio (tus guiones | el guion) que se apilan en móvil,
 * con la lista de guiones como cajón lateral.
 */
export class AppShell {
  private readonly sidebar: SidebarView;
  private readonly editor: EditorView;
  private readonly newScript: NewScriptDialog;
  private readonly settings: SettingsView;
  private readonly teleprompter: TeleprompterView;
  private readonly darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private theme: ThemePreference = 'light';
  private readonly overlay: HTMLElement;
  private readonly scripts: ScriptsPresenter;
  private readonly notice = h('div', {
    class: 'fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg',
    attrs: { role: 'alert', 'aria-live': 'assertive' },
  });
  private readonly loading = h(
    'div',
    { class: 'fixed inset-0 z-50 grid place-items-center bg-bg text-muted' },
    'Cargando tus guiones…',
  );

  constructor(root: HTMLElement, store: Store<AppState>, presenters: EditorPresenters) {
    const { scripts } = presenters;
    this.scripts = scripts;
    this.sidebar = new SidebarView(scripts, () => {
      presenters.settings.open();
    });
    this.editor = new EditorView(presenters);
    this.newScript = new NewScriptDialog(scripts);
    this.settings = new SettingsView(presenters.settings);
    this.teleprompter = new TeleprompterView(presenters.teleprompter);
    this.darkQuery.addEventListener('change', () => {
      this.applyTheme();
    });
    this.overlay = h('div', {
      class: 'fixed inset-0 z-30 bg-black/30 lg:hidden',
      on: {
        click: () => {
          scripts.setNavOpen(false);
        },
      },
    });

    const mobileBar = h(
      'header',
      {
        class:
          'sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-surface-raised/95 px-3 backdrop-blur-xl lg:hidden',
      },
      h(
        'button',
        {
          class:
            'flex h-11 items-center gap-0.5 rounded-control pr-2 text-[17px] text-primary focus-visible:outline-2 focus-visible:outline-primary',
          attrs: { type: 'button', 'aria-label': 'Abrir tus guiones' },
          on: {
            click: () => {
              scripts.setNavOpen(true);
            },
          },
        },
        icon('back', 'size-6'),
        'Guiones',
      ),
    );

    replaceChildren(
      root,
      h(
        'div',
        { class: 'min-h-dvh bg-bg text-text lg:grid lg:grid-cols-[240px_minmax(0,1fr)]' },
        mobileBar,
        this.sidebar.el,
        this.editor.el,
      ),
      this.overlay,
      this.newScript.el,
      this.settings.el,
      this.teleprompter.el,
      this.notice,
      this.loading,
    );

    store.subscribe((state) => {
      this.render(state);
    });
    this.render(store.get());
  }

  private render(state: AppState): void {
    this.loading.hidden = !state.loading;
    this.overlay.hidden = !state.navOpen;
    this.sidebar.render(state);
    this.editor.render(state);
    this.newScript.render(state);
    this.settings.render(state);
    this.teleprompter.render(state);
    if (state.settings && state.settings.theme !== this.theme) {
      this.theme = state.settings.theme;
      this.applyTheme();
    }
    this.renderNotice(state);
    document.title = state.current ? `${state.current.title} · Guiones` : 'Guiones';
  }

  /** Claro por defecto; "Sistema" sigue al dispositivo. */
  private applyTheme(): void {
    const dark = this.theme === 'dark' || (this.theme === 'system' && this.darkQuery.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#000000' : '#FFFFFF');
  }

  private renderNotice(state: AppState): void {
    const notice = state.notice;
    if (!notice) {
      replaceChildren(this.notice);
      return;
    }
    replaceChildren(
      this.notice,
      h(
        'div',
        {
          class: `flex items-start gap-3 rounded-card p-4 shadow-lg ring-1 ${
            notice.kind === 'error'
              ? 'bg-danger-soft text-danger ring-danger/20'
              : 'bg-surface-raised text-text ring-line'
          }`,
        },
        icon('alert', 'mt-0.5 size-5'),
        h('p', { class: 'flex-1 text-sm font-medium', text: notice.message }),
        iconButton({
          icon: 'close',
          label: 'Cerrar aviso',
          onClick: () => {
            this.scripts.dismissNotice();
          },
        }),
      ),
    );
  }
}
