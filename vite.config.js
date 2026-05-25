import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const app = process.env.VITE_APP || 'clockin'

export default defineConfig({
  plugins: [react()],
  base: `/${app}/`,
  resolve: {
    alias: {
      '@config': `/apps/${app}/config.js`,
    },
  },
})
