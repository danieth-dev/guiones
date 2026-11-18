import { h } from '../dom';
import { icon, type IconName } from '../icons';

export type ChipVariant = 'neutral' | 'plain' | 'primary' | 'ok' | 'warn' | 'danger';

const CHIP_COLORS: Readonly<Record<ChipVariant, string>> = {
  neutral: 'bg-surface text-muted',
  /** Solo texto gris, como los estados de la barra de macOS. */
  plain: 'px-0 text-muted font-normal',
  primary: 'bg-primary-soft text-primary',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

export interface StatusChipProps {
  readonly label: string;
  readonly variant?: ChipVariant;
  /** Muestra un spinner (p. ej. "Guardando…"). */
  readonly loading?: boolean;
  readonly icon?: IconName;
  readonly title?: string;
}

/** Píldora de estado ("Procesando · 6.0 s" en la referencia). */
export const statusChip = ({
  label,
  variant = 'neutral',
  loading = false,
  icon: iconName,
  title,
}: StatusChipProps): HTMLElement =>
  h(
    'span',
    {
      class: `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${CHIP_COLORS[variant]}`,
      attrs: { title },
    },
    loading
      ? h('span', {
          class: 'size-3.5 rounded-full border-2 border-current border-r-transparent animate-spin',
          attrs: { 'aria-hidden': 'true' },
        })
      : null,
    iconName ? icon(iconName, 'size-3.5') : null,
    label,
  );

export interface IconButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: (event: MouseEvent) => void;
  readonly variant?: 'ghost' | 'danger';
  readonly disabled?: boolean;
}

/** Botón de solo ícono, siempre con nombre accesible. */
export const iconButton = ({
  icon: name,
  label,
  onClick,
  variant = 'ghost',
  disabled = false,
}: IconButtonProps): HTMLButtonElement =>
  h(
    'button',
    {
      class: `grid size-8 place-items-center rounded-control text-muted transition hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40 disabled:pointer-events-none ${variant === 'danger' ? 'hover:text-danger' : ''}`,
      attrs: { type: 'button', 'aria-label': label, title: label, disabled },
      on: { click: onClick },
    },
    icon(name),
  );
