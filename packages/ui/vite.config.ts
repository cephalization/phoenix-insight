import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  
  // Use relative paths for assets - required for serving from CLI's HTTP server
  base: './',
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  
  build: {
    // Output to dist/ directory
    outDir: 'dist',
    
    // Generate source maps for debugging (can be disabled for smaller builds)
    sourcemap: true,
    
    // Increase warning limit - streamdown library is large but necessary for AI markdown streaming
    chunkSizeWarningLimit: 2000,
    
    // Asset chunking configuration
    rollupOptions: {
      output: {
        // Use content hash for cache busting
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        
        // Manual chunks for better caching
        manualChunks: {
          // Vendor chunk for React ecosystem
          'vendor-react': ['react', 'react-dom'],
          // Vendor chunk for UI libraries
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-tabs',
            'react-resizable-panels',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ],
          // Vendor chunk for state/data libraries
          'vendor-data': ['zustand', 'idb', 'zod'],
          // Vendor chunk for markdown/rendering
          'vendor-render': ['streamdown', '@json-render/core', '@json-render/react'],
        },
      },
    },
  },
})
