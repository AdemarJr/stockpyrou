import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Rollup (Vite build) on some Linux/CI environments fails to resolve extensionless
 * relative imports inside @supabase/realtime-js (e.g. `./phoenix/socketAdapter`).
 * Point them explicitly at the `.js` files next to the importer.
 */
function resolveSupabaseRealtimePhoenixImports(): Plugin {
  return {
    name: 'resolve-supabase-realtime-phoenix-imports',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!importer || !id.startsWith('./phoenix/')) return null;
      if (path.extname(id)) return null;

      const cleanImporter = importer.split('?')[0].split('#')[0];
      if (!cleanImporter.includes(`${path.sep}@supabase${path.sep}realtime-js${path.sep}`)) {
        return null;
      }

      const base = path.basename(id); // e.g. socketAdapter
      if (!base || base.includes('..')) return null;

      const resolved = path.join(path.dirname(cleanImporter), 'phoenix', `${base}.js`);
      try {
        if (fs.existsSync(resolved)) return resolved;
      } catch {
        /* ignore */
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [resolveSupabaseRealtimePhoenixImports(), react(), tailwindcss()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    dedupe: ['@supabase/supabase-js', '@supabase/realtime-js'],
    alias: {
        'vaul@1.1.2': 'vaul',
        'sonner@2.0.3': 'sonner',
        'recharts@2.15.2': 'recharts',
        'react-resizable-panels@2.1.7': 'react-resizable-panels',
        'react-hook-form@7.55.0': 'react-hook-form',
        'react-day-picker@8.10.1': 'react-day-picker',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'input-otp@1.4.2': 'input-otp',
        'html5-qrcode@2.3.8': 'html5-qrcode',
        'figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png': path.resolve(__dirname, './src/assets/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png'),
        'figma:asset/e6773d54ec7685ec36adaaee57705c2d461a8da0.png': path.resolve(__dirname, './src/assets/e6773d54ec7685ec36adaaee57705c2d461a8da0.png'),
        'figma:asset/0a1edac33c22f30efd413c7ef8bd73eb4788f257.png': path.resolve(__dirname, './src/assets/0a1edac33c22f30efd413c7ef8bd73eb4788f257.png'),
        'embla-carousel-react@8.6.0': 'embla-carousel-react',
        'cmdk@1.1.1': 'cmdk',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-toggle@1.1.2': '@radix-ui/react-toggle',
        '@radix-ui/react-toggle-group@1.1.2': '@radix-ui/react-toggle-group',
        '@radix-ui/react-tabs@1.1.3': '@radix-ui/react-tabs',
        '@radix-ui/react-switch@1.1.3': '@radix-ui/react-switch',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-slider@1.2.3': '@radix-ui/react-slider',
        '@radix-ui/react-separator@1.1.2': '@radix-ui/react-separator',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-scroll-area@1.2.3': '@radix-ui/react-scroll-area',
        '@radix-ui/react-radio-group@1.2.3': '@radix-ui/react-radio-group',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@radix-ui/react-popover@1.1.6': '@radix-ui/react-popover',
        '@radix-ui/react-navigation-menu@1.2.5': '@radix-ui/react-navigation-menu',
        '@radix-ui/react-menubar@1.1.6': '@radix-ui/react-menubar',
        '@radix-ui/react-label@2.1.2': '@radix-ui/react-label',
        '@radix-ui/react-hover-card@1.1.6': '@radix-ui/react-hover-card',
        '@radix-ui/react-dropdown-menu@2.1.6': '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog@1.1.6': '@radix-ui/react-dialog',
        '@radix-ui/react-context-menu@2.2.6': '@radix-ui/react-context-menu',
        '@radix-ui/react-collapsible@1.1.3': '@radix-ui/react-collapsible',
        '@radix-ui/react-checkbox@1.1.4': '@radix-ui/react-checkbox',
        '@radix-ui/react-avatar@1.1.3': '@radix-ui/react-avatar',
        '@radix-ui/react-aspect-ratio@1.1.2': '@radix-ui/react-aspect-ratio',
        '@radix-ui/react-alert-dialog@1.1.6': '@radix-ui/react-alert-dialog',
        '@radix-ui/react-accordion@1.2.3': '@radix-ui/react-accordion',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'build',
    },
  server: {
    port: 3000,
    open: true,
  },
});