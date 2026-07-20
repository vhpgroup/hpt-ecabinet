import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build ra 1 file HTML duy nhất (dễ preview & phục vụ tĩnh qua nginx).
// Khi lên giai đoạn 2 có thể bỏ viteSingleFile để build nhiều chunk.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: 'es2018', chunkSizeWarningLimit: 4000 },
  // Dev/test: giữ frontend và API cùng origin để có thể đưa duy nhất cổng
  // Vite qua HTTPS tunnel. `ws: true` chuyển tiếp realtime WebSocket.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
