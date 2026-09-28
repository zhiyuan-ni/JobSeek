import { defineConfig } from 'vite';
import fileApi from './server/fileApi.js';

export default defineConfig({
  plugins: [fileApi({ dir: 'data' })],
  server: {
    port: 5173,
    // data/ 由接口读写，不需要触发热更新
    watch: { ignored: ['**/data/**'] },
  },
});
