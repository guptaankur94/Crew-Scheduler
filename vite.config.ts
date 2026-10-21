import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {readFileSync} from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // GitHub Pages serves the app from /<repo-name>/; set via BASE_PATH in the deploy workflow.
    base: process.env.BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    // The app's version (package.json), shown in feedback messages
    define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'package.json'), 'utf8')).version) },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
