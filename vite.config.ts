import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Configurazione ottimizzata per macOS 27.2 (ARM64 Apple Silicon M1)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['three', 'zustand', 'lucide-react'],
  },
});

