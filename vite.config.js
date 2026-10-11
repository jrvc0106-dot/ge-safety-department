import {defineConfig} from 'vite';

export default defineConfig({
  build: {
    // PDF libraries are deferred until export; warn only when one lazy chunk
    // grows beyond the reviewed 850 kB budget.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/')) return;

          if (
            id.includes('/node_modules/html2canvas/') ||
            id.includes('/node_modules/css-line-break/') ||
            id.includes('/node_modules/text-segmentation/')
          ) {
            return 'pdf-canvas';
          }

          if (
            id.includes('/node_modules/jspdf/') ||
            id.includes('/node_modules/fflate/') ||
            id.includes('/node_modules/fast-png/') ||
            id.includes('/node_modules/canvg/')
          ) {
            return 'pdf-generator';
          }

          if (
            id.includes('/node_modules/html2pdf.js/') ||
            id.includes('/node_modules/dompurify/')
          ) {
            return 'pdf-export';
          }
        }
      }
    }
  }
});
