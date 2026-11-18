declare const brand: unique symbol;

/** Tipo nominal: evita mezclar, por ejemplo, un BeatId con un HookId. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };
