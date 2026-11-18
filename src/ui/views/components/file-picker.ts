import { h } from '../dom';

/**
 * Botón que abre el selector de archivos del sistema y entrega el texto del
 * archivo elegido. El `<input type="file">` queda oculto pero accesible.
 */
export const fileButton = (props: {
  readonly label: string;
  readonly accept: string;
  readonly className: string;
  readonly content: (string | Node)[];
  readonly onText: (text: string) => void;
}): HTMLElement => {
  const input = h('input', {
    class: 'sr-only',
    attrs: { type: 'file', accept: props.accept, tabindex: -1, 'aria-hidden': 'true' },
    on: {
      change: () => {
        const file = input.files?.[0];
        input.value = '';
        if (file) void file.text().then(props.onText);
      },
    },
  });
  return h(
    'span',
    { class: 'contents' },
    h(
      'button',
      {
        class: props.className,
        attrs: { type: 'button', 'aria-label': props.label, title: props.label },
        on: {
          click: () => {
            input.click();
          },
        },
      },
      ...props.content,
    ),
    input,
  );
};
