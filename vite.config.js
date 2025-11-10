import { defineConfig } from 'vite';

export default defineConfig({
  base: '',
  build: {
    outDir: 'dist',
    sourcemap: false,

    // produce ONE optimized file
    minify: 'terser',
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'bundle.js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },

    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});
