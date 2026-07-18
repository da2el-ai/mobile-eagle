import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// フロントエンドの Vite 設定。
// - dev: 0.0.0.0 で待ち受け、/api をプラグインの HTTP サーバー（:8000）へプロキシする。
//   xfwd で X-Forwarded-For を付与し、スマホ（:5173）からのアクセスに実機同様の認証を要求する
//   （backend/auth.md 4 章）。
// - build: プラグインの配信ディレクトリ（../plugin/public）へ直接出力する。
//   emptyOutDir は本ビルド切り替え（最終マイルストーン）でのみ実行する想定。
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
  build: {
    outDir: '../plugin/public',
    emptyOutDir: true,
  },
});
