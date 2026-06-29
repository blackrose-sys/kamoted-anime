import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_COMPUTER_NAME': JSON.stringify(process.env.USERNAME || process.env.USER || 'Anonymous Otaku')
  }
})

