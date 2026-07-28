import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The glossary lives outside app/ so that the research documents remain the
  // single source of truth for terminology. Allow Vite to serve it in dev.
  server: { fs: { allow: ['..'] } },
});
