import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Single-page app. All routes are handled in the browser, so the host must
// serve index.html for unknown paths (public/_redirects does this on Cloudflare Pages).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
