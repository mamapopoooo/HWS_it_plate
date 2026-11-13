import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: '/pet-garden/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      // 与生产 nginx 的 `location /api/` 保持一致：前端一律请求 /api/*，
      // 不再 rewrite 去前缀，避免 dev 能跑、生产 404 的前缀分裂。
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
    // dev 不能设 immutable：源码路径（Login.vue 等）没有 hash，缓存一年等于改代码不生效
  },
  // 只有 preview / 生产才全是带 hash 的产物，可以放心 immutable
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  // 构建配置 - 静态资源添加 hash
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name)) {
            return `assets/images/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  }
})