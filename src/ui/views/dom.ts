/** Utilidades mínimas de DOM para vistas pasivas (sin framework). */

type Child = Node | string | null | undefined | false;

type Handlers = {
  readonly [K in keyof HTMLElementEventMap]?: (event: HTMLElementEventMap[K]) => void;
};

export interface Props {
  readonly class?: string;
  readonly text?: string;
  /** Atributos HTML/ARIA/data-*. `false`, `null` y `undefined` los omiten. */
  readonly attrs?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  readonly on?: Handlers;
}

export const setAttr = (
  el: Element,
  name: string,
  value: string | number | boolean | null | undefined,
): void => {
  if (value === false || value === null || value === undefined) el.removeAttribute(name);
  else el.setAttribute(name, value === true ? '' : String(value));
};

/** Crea un elemento con clases, atributos, manejadores e hijos. */
export const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [name, value] of Object.entries(props.attrs ?? {})) setAttr(el, name, value);
  for (const [type, handler] of Object.entries(props.on ?? {})) {
    el.addEventListener(type, handler as EventListener);
  }
  for (const child of children) {
    if (child !== null && child !== undefined && child !== false) el.append(child);
  }
  return el;
};

/** Reemplaza todo el contenido de un elemento. */
export const replaceChildren = (el: Element, ...children: Child[]): void => {
  el.replaceChildren(
    ...children.filter((c): c is Node | string => c !== null && c !== undefined && c !== false),
  );
};

/** Ajusta la altura de un textarea a su contenido. */
export const autosize = (textarea: HTMLTextAreaElement): void => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

/** Actualiza el valor de un campo sin pisar lo que el usuario está escribiendo. */
export const syncValue = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void => {
  if (document.activeElement === field) return;
  if (field.value !== value) field.value = value;
};

/** Descarga un archivo de texto generado en el navegador. */
export const downloadFile = (file: {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: string;
}): void => {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = h('a', { attrs: { href: url, download: file.fileName } });
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};
