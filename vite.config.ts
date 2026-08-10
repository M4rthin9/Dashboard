import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  build: {
    // The Dashboard/Reports pages load ECharts in a lazy chunk (~580 kB minified,
    // ~197 kB gzip). It is tree-shaken and only fetched when those routes are visited,
    // so the threshold is raised for that lazy chunk.
    chunkSizeWarningLimit: 700,
  },
})
