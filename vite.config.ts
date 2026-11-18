import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * Carpeta donde se publica la app. En GitHub Pages es /<repositorio>/; el
 * workflow la pasa con BASE_PATH. En desarrollo y en local, la raíz.
 */
// El config corre en Node; el proyecto no incluye los tipos de Node a propósito.
declare const process: { readonly env: Readonly<Record<string, string | undefined>> };
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    tailwindcss(),
    // PWA local-first: todo el código y los estilos quedan precargados, así la
    // app abre y funciona sin conexión (los datos ya viven en IndexedDB).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Guiones',
        short_name: 'Guiones',
        description: 'Escribe guiones de video frase a frase: plano, energía y tu voz en voz alta.',
        lang: 'es',
        // Relativos al manifiesto: funcionan en la raíz y en GitHub Pages.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#FFFFFF',
        theme_color: '#FFFFFF',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/application/**/*.ts',
        'src/infrastructure/**/*.ts',
        // De la UI se miden la lógica testeable sin DOM (store, presentadores, atajos).
        'src/ui/store/**/*.ts',
        'src/ui/presenters/**/*.ts',
        'src/ui/keyboard/**/*.ts',
      ],
      // Los puertos son solo tipos; los adaptadores de medios dependen del navegador.
      exclude: ['src/**/index.ts', 'src/application/ports/**', 'src/infrastructure/media/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
