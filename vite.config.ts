import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // stellar-sdk库依赖node全局环境变量,需要插件兼容
    esbuildOptions: {
      define: {
          global: 'globalThis'
      },
      plugins: [
          NodeGlobalsPolyfillPlugin({
              buffer: true
          })
      ]
    }
  }
})
