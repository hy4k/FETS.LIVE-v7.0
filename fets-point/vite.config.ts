import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'node:fs'

// Silence Chrome DevTools' automatic /.well-known probe (returns 404 noise otherwise)
const devtoolsProbe = (): Plugin => ({
  name: 'devtools-probe-noop',
  configureServer(server) {
    server.middlewares.use('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.end('{}')
    })
  },
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const firebasePath = resolve(__dirname, 'android/app/google-services.json')
  let androidPushConfigured = false
  if (existsSync(firebasePath)) {
    const firebase = JSON.parse(readFileSync(firebasePath, 'utf8'))
    androidPushConfigured = firebase.client?.some(
      (client: any) => client.client_info?.android_client_info?.package_name === 'com.fets.staffapp'
    ) === true
    if (!androidPushConfigured) throw new Error('Firebase configuration must include com.fets.staffapp')
  }
  return {
    define: { __FETS_ANDROID_PUSH_CONFIGURED__: JSON.stringify(androidPushConfigured) },
    plugins: [react(), devtoolsProbe()],
    base: '/',
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@hooks': resolve(__dirname, './src/hooks'),
        '@utils': resolve(__dirname, './src/utils'),
        '@types': resolve(__dirname, './src/types'),
        '@lib': resolve(__dirname, './src/lib'),
        '@contexts': resolve(__dirname, './src/contexts'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            ui: ['lucide-react', 'framer-motion'],
            query: ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          },
        },
      },
    },
    server: {
      port: 3000,
      host: true,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 4173,
      host: true
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@supabase/supabase-js', '@tanstack/react-query'],
    }
  }
})
