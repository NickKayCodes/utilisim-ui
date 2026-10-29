import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  html: {
    title: 'UtiliSim',
  },
  server: {
    port: 3000,
    proxy: {
      // Same-origin calls in dev: the UI talks to /api and rsbuild forwards to Spring.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
