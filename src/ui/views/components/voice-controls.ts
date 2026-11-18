import { hintFor } from '../../keyboard/shortcuts';
import type { VoiceUiState } from '../../store/app-state';
import { h, replaceChildren } from '../dom';
import { icon } from '../icons';

export interface VoiceHandlers {
  onRecord(phraseId: string): void;
  onPlay(phraseId: string): void;
}

export interface VoiceTarget {
  readonly id: string;
  readonly take: string | null;
  /** Sin texto no hay nada que decir en voz alta. */
  readonly hasText: boolean;
}

const seconds = (ms: number): string =>
  (ms / 1000).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40';

/**
 * Decir la frase: grabarse y escucharse. Al terminar de grabar se reproduce
 * sola, para oír cómo suena y ajustar el texto.
 */
export class VoiceControls {
  readonly el = h('div', { class: 'flex items-center gap-1.5' });
  /** Firma del último render: evita recrear botones (y perder clics) si nada cambió. */
  private renderedKey = '';
  private readonly stopLabel = h('span');

  constructor(private readonly handlers: VoiceHandlers) {}

  update(target: VoiceTarget, ui: VoiceUiState): void {
    const key = [
      ui.supported,
      target.id,
      target.take,
      target.hasText,
      ui.recordingId === target.id,
      ui.playingId === target.id,
    ].join('|');
    this.stopLabel.textContent = `Detener · ${seconds(ui.elapsedMs)} s`;
    if (key === this.renderedKey) return;
    this.renderedKey = key;
    this.render(target, ui);
  }

  private render(target: VoiceTarget, ui: VoiceUiState): void {
    if (!ui.supported) {
      replaceChildren(this.el);
      return;
    }
    const { id } = target;
    if (ui.recordingId === id) {
      replaceChildren(
        this.el,
        h(
          'button',
          {
            class: `${BUTTON} animate-pulse bg-danger text-white`,
            attrs: {
              type: 'button',
              'aria-pressed': 'true',
              title: `Terminar (${hintFor('RECORD')})`,
            },
            on: {
              click: () => {
                this.handlers.onRecord(id);
              },
            },
          },
          icon('stop', 'size-3.5'),
          this.stopLabel,
        ),
      );
      return;
    }
    const playing = ui.playingId === id;
    replaceChildren(
      this.el,
      target.take
        ? h(
            'button',
            {
              class: `${BUTTON} bg-surface text-text hover:bg-primary-soft hover:text-primary`,
              attrs: { type: 'button', title: `Escuchar cómo sonó (${hintFor('PLAY')})` },
              on: {
                click: () => {
                  this.handlers.onPlay(id);
                },
              },
            },
            icon(playing ? 'stop' : 'play', 'size-3.5'),
            playing ? 'Detener' : 'Escuchar',
          )
        : null,
      h(
        'button',
        {
          class: `${BUTTON} bg-danger-soft text-danger hover:bg-danger hover:text-white`,
          attrs: {
            type: 'button',
            disabled: !target.hasText,
            title: `Grabarte diciendo esta frase (${hintFor('RECORD')})`,
          },
          on: {
            click: () => {
              this.handlers.onRecord(id);
            },
          },
        },
        icon('record', 'size-3'),
        target.take ? 'Otra vez' : 'Decirla',
      ),
    );
  }
}
