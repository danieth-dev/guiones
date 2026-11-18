import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE_SCRIPT_MARKDOWN } from '../../src/infrastructure';
import { hintFor, matchShortcut } from '../../src/ui/keyboard/shortcuts';
import { CommandRunner } from '../../src/ui/presenters/command-runner';
import { PhrasesPresenter } from '../../src/ui/presenters/phrases-presenter';
import { ScriptsPresenter } from '../../src/ui/presenters/scripts-presenter';
import { SettingsPresenter } from '../../src/ui/presenters/settings-presenter';
import { initialAppState, type AppState } from '../../src/ui/store/app-state';
import { Store } from '../../src/ui/store/store';
import { createHarness } from '../application/harness';

const setup = async (example: string | null = null) => {
  const harness = createHarness();
  const store = new Store<AppState>(initialAppState);
  const runner = new CommandRunner(store);
  const phrases = new PhrasesPresenter(harness.app, store, runner, 300);
  const scripts = new ScriptsPresenter(harness.app, store, runner, () => phrases.flush(), example);
  const settings = new SettingsPresenter(harness.app, store, runner);
  await settings.load();
  await scripts.start();
  const current = () => store.get().current!;
  return { ...harness, store, runner, phrases, scripts, settings, current };
};

describe('Store', () => {
  it('notifica cambios con el estado anterior y permite desuscribirse', () => {
    const store = new Store({ a: 1, b: 'x' });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.update({ a: 2 });
    store.update((s) => ({ b: `${s.b}y` }));
    expect(store.get()).toEqual({ a: 2, b: 'xy' });
    expect(listener).toHaveBeenNthCalledWith(1, { a: 2, b: 'x' }, { a: 1, b: 'x' });
    unsubscribe();
    store.update({ a: 3 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('ScriptsPresenter', () => {
  it('el primer uso abre el guion de ejemplo; si falla, crea uno normal', async () => {
    const t = await setup(EXAMPLE_SCRIPT_MARKDOWN);
    expect(t.current().title).toContain('Ejemplo');
    expect(t.current().phrases[0]).toMatchObject({ section: 'OPENING', energy: 'HIGH' });
    expect(t.store.get().notice?.message).toContain('guion de ejemplo');
    expect(t.store.get().loading).toBe(false);

    const broken = await setup('## Notas');
    expect(broken.current().title).toBe('Guion sin título');
  });

  it('crea desde el diálogo con el formato elegido y la velocidad de los ajustes', async () => {
    const t = await setup();
    await t.settings.setDefaultWpm(150);
    t.scripts.setCreating(true);
    expect(t.store.get().creating).toBe(true);
    expect(await t.scripts.create({ title: 'Review', formatId: 'LONG_HORIZONTAL' })).toBe(true);
    expect(t.store.get().creating).toBe(false);
    expect(t.current()).toMatchObject({
      title: 'Review',
      wordsPerMinute: 150,
      format: { id: 'LONG_HORIZONTAL' },
    });
    expect(t.store.get().scripts).toHaveLength(2);
    expect(await t.scripts.create({ formatId: 'PODCAST' })).toBe(false);
    expect(t.store.get().notice?.kind).toBe('error');
  });

  it('abre, renombra, cambia formato y elimina', async () => {
    const t = await setup();
    const firstId = t.current().id;
    await t.scripts.create({});
    await t.scripts.rename('Luz natural');
    expect(t.current().title).toBe('Luz natural');
    await t.scripts.changeFormat('MEDIUM_VERTICAL');
    expect(t.current().format.label).toBe('Vertical medio');
    await t.scripts.open(firstId);
    expect(t.current().id).toBe(firstId);
    await t.scripts.remove(firstId);
    expect(t.store.get().scripts.map((s) => s.title)).toEqual(['Luz natural']);
    expect(t.current().title).toBe('Luz natural');
    await t.scripts.remove(t.current().id); // el último: crea uno nuevo
    expect(t.store.get().scripts).toHaveLength(1);
    t.scripts.setNavOpen(true);
    expect(t.store.get().navOpen).toBe(true);
    t.scripts.dismissNotice();
    expect(t.store.get().notice).toBeNull();
  });

  it('exporta e importa; sin guion abierto no exporta', async () => {
    const t = await setup();
    expect((await t.scripts.exportCurrent('md'))?.fileName).toMatch(/-rodaje\.md$/u);
    const file = await t.scripts.exportDocument();
    expect(await t.scripts.importDocument(file!.content)).toBe(true);
    expect(t.store.get().scripts).toHaveLength(2);
    expect(t.store.get().notice?.message).toContain('Guion importado');
    expect(await t.scripts.importDocument('## Notas')).toBe(false);
    t.store.update({ current: null });
    expect(await t.scripts.exportCurrent('txt')).toBeNull();
    expect(await t.scripts.exportDocument()).toBeNull();
    await t.scripts.rename('nada'); // sin guion: no hace nada
  });
});

describe('PhrasesPresenter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('autoguarda lo escrito con debounce y agrupa por frase', async () => {
    const t = await setup();
    const id = t.current().phrases[1]!.id;
    t.phrases.editText(id, 'Hola');
    t.phrases.editText(id, 'Hola mundo');
    t.phrases.editNote(id, 'Plano del escritorio');
    expect(t.store.get().saveStatus).toBe('saving');
    await vi.advanceTimersByTimeAsync(300);
    expect(t.current().phrases[1]).toMatchObject({
      text: 'Hola mundo',
      note: 'Plano del escritorio',
    });
    await t.phrases.flush(); // sin pendientes
  });

  it('plano, energía y parte se guardan al instante junto con lo pendiente', async () => {
    const t = await setup();
    const id = t.current().phrases[1]!.id;
    t.phrases.editText(id, 'Pendiente');
    await t.phrases.setShot(id, 'WIDE');
    expect(t.current().phrases[1]).toMatchObject({ text: 'Pendiente', shot: 'WIDE' });
    await t.phrases.setShot(id, null);
    await t.phrases.setEnergy(id, 'HIGH');
    await t.phrases.setSection(id, 'OPENING');
    expect(t.current().phrases[1]).toMatchObject({
      shot: null,
      energy: 'HIGH',
      section: 'OPENING',
    });
  });

  it('agrega, divide, mueve, elimina y pide foco', async () => {
    const t = await setup();
    const count = t.current().phrases.length;
    await t.phrases.add();
    expect(t.current().phrases).toHaveLength(count + 1);
    const created = t.store.get().focus!.phraseId;
    await t.phrases.add(created, 'BODY');
    const id = t.current().phrases[1]!.id;
    t.phrases.editText(id, 'Esto es clave, pero casi nadie lo aplica bien en sus videos cortos');
    await t.phrases.split(id);
    expect(t.current().phrases[1]?.text).toBe('Esto es clave');
    await t.phrases.moveBy(id, 1);
    expect(t.current().phrases[2]?.id).toBe(id);
    expect(t.store.get().focus?.phraseId).toBe(id);
    await t.phrases.moveBy('nada', 1);
    // Arrastrar y soltar: va directo a la posición, sin pedir foco.
    t.phrases.focus('otra');
    expect(await t.phrases.moveTo(id, 0)).toBe(true);
    expect(t.current().phrases[0]?.id).toBe(id);
    expect(t.store.get().focus?.phraseId).toBe('otra');
    await t.phrases.remove(id);
    expect(t.current().phrases.some((p) => p.id === id)).toBe(false);
    t.phrases.focus('x');
    expect(t.store.get().focus?.phraseId).toBe('x');
  });

  it('sin guion abierto no hace nada; si cambia de guion no publica lo viejo', async () => {
    const t = await setup();
    const firstId = t.current().id;
    const id = t.current().phrases[0]!.id;
    t.phrases.editText(id, 'Para el primero');
    await t.scripts.create({});
    await vi.advanceTimersByTimeAsync(300);
    expect(t.current().id).not.toBe(firstId);
    const saved = await t.app.getScript.execute({ scriptId: firstId });
    expect(saved.ok && saved.value.phrases[0]?.text).toBe('Para el primero');

    t.store.update({ current: null });
    t.phrases.editText(id, 'nada');
    await t.phrases.add();
    await t.phrases.split(id);
    await t.phrases.remove(id);
    await t.phrases.setEnergy(id, 'CALM');
  });
});

describe('SettingsPresenter', () => {
  it('abre, guarda velocidad y tema, y la aplica al guion abierto', async () => {
    const t = await setup();
    t.store.update({ navOpen: true });
    t.settings.open();
    expect(t.store.get()).toMatchObject({ settingsOpen: true, navOpen: false });
    expect(await t.settings.setDefaultWpm(150)).toBe(true);
    expect(await t.settings.setDefaultWpm(10)).toBe(false);
    expect(await t.settings.setTheme('dark')).toBe(true);
    expect(t.store.get().settings).toEqual({ defaultWpm: 150, theme: 'dark' });
    expect(await t.settings.applyWpmToCurrent(150)).toBe(true);
    expect(t.current().wordsPerMinute).toBe(150);
    t.settings.close();
    expect(t.store.get().settingsOpen).toBe(false);
    t.store.update({ current: null });
    expect(await t.settings.applyWpmToCurrent(150)).toBe(false);
  });
});

describe('Atajos de teclado', () => {
  const chord = (patch: Partial<Parameters<typeof matchShortcut>[0]>) => ({
    key: '',
    code: '',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...patch,
  });

  it('reconoce cada atajo y nada más', () => {
    expect(matchShortcut(chord({ key: 'ArrowUp', altKey: true }))).toBe('MOVE_UP');
    expect(matchShortcut(chord({ key: 'ArrowDown', altKey: true }))).toBe('MOVE_DOWN');
    expect(matchShortcut(chord({ key: 'Enter', ctrlKey: true }))).toBe('NEW_PHRASE_AFTER');
    expect(matchShortcut(chord({ key: 'Enter', metaKey: true, shiftKey: true }))).toBe('SPLIT');
    expect(matchShortcut(chord({ code: 'KeyR', altKey: true }))).toBe('RECORD');
    expect(matchShortcut(chord({ code: 'KeyP', altKey: true }))).toBe('PLAY');
    expect(matchShortcut(chord({ code: 'KeyD', altKey: true }))).toBe('DICTATE');
    expect(matchShortcut(chord({ key: 'a' }))).toBeNull();
    expect(hintFor('SPLIT')).toBe('Ctrl + Shift + Enter');
  });
});

describe('CommandRunner', () => {
  it('marca errores de almacenamiento y espera a quedar libre', async () => {
    const store = new Store<AppState>(initialAppState);
    const runner = new CommandRunner(store);
    await runner.run(() =>
      Promise.resolve({
        ok: false,
        error: { code: 'STORAGE_FAILURE', message: 'sin espacio' },
      } as const),
    );
    expect(store.get()).toMatchObject({
      saveStatus: 'error',
      notice: { kind: 'error', message: 'sin espacio' },
    });
    await runner.idle();
  });
});
