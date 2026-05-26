import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const app = process.env.VITE_APP || 'clockin'

export default defineConfig({
  plugins: [react()],
  base: `/${app === 'clockin' ? 'clockin' : 'derby-clockin'}/`,
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, `apps/${app}/config.js`),
    },
  },
  build: {
    outDir: `dist/${app}`,
  },
})
