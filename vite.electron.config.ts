import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    ssr: true, // Targets Node/SSR environment
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['cjs'],
    },
    outDir: 'dist-electron',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'electron',
        'path',
        'fs',
        'url',
        'pdf-lib',
        'fontkit',
        '@pdf-lib/fontkit'
      ],
      output: {
        entryFileNames: '[name].js',
      }
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
