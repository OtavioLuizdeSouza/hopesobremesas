import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const backendEnvDir = fileURLToPath(new URL('../backend', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, backendEnvDir, ''), ...process.env }
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY no backend/.env.')
  }

  return {
    plugins: [react()],
    base: '/admin/',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey)
    },
    server: {
      proxy: { '/api': 'http://localhost:3000' }
    }
  }
})