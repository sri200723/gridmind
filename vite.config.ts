import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/d3-') || id.includes('d3-array') || id.includes('d3-scale') || id.includes('d3-shape') || id.includes('d3-time') || id.includes('d3-color') || id.includes('d3-interpolate') || id.includes('d3-ease') || id.includes('d3-format') || id.includes('d3-path') || id.includes('d3-timer')) {
            return 'd3-vendor';
          }

          if (id.includes('/recharts')) {
            return 'charts';
          }

          if (id.includes('/lucide-react')) {
            return 'icons';
          }

          if (id.includes('/react') || id.includes('/scheduler')) {
            return 'react-vendor';
          }

          return undefined;
        },
      },
    },
  },
});
