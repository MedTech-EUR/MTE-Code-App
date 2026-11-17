import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { adminFiles } from './scripts/lib/admin-files.mjs';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * The date of the commit this build is made from (YYYY-MM-DD), shown as "Last updated" in the
 * footer (SiteFooter.jsx). The site is built from main, so this is the last change to main.
 * Empty when there is no Git history (the footer then leaves the line out).
 */
const lastCommitDate = (() => {
  try {
    return execSync('git log -1 --format=%cs', { cwd: projectRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
})();

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_LAST_UPDATED': JSON.stringify(lastCommitDate),
    },
    plugins: [
      react(), 
      tailwindcss(),
      // Content history's item list and the app stylesheet for the content editor's previews.
      adminFiles(projectRoot),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'logo.png',
          'icon-192.png',
          'icon-512.png',
          'maskable-icon-512x512.png',
          'code-assets/annex-iii-map-september-2024.png',
        ],
        workbox: {
          navigateFallbackDenylist: [/^\/admin/, /^\/api\//],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // The Latin subset of the bundled Inter font is precached so text keeps its typeface
          // offline; other subsets load on demand and fall back to system fonts offline.
          globPatterns: [
            '**/*.{js,css,html,ico,png,svg,webmanifest,pdf,csv}',
            '**/inter-latin-wght-*.woff2',
          ],
          globIgnores: [
            // The content editor and Content history are not part of the offline app.
            'admin/**',
            '**/TPPTContent-*.js',
            '**/tppt-*.js',
            '**/pdf.worker*.mjs',
          ],
        },
        manifest: {
          name: 'MedTech Europe: The Code App',
          short_name: 'TheCodeApp',
          description: 'The MedTech Europe Code of Ethical Business Practice',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // The local Worker (npm run dev:worker) serves the CVS lookup API.
        '/api/cvs': { target: 'http://127.0.0.1:8787' },
        '^/admin/?$': {
          target: 'http://localhost:3000',
          rewrite: () => '/admin/index.html'
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Rollup's shared CommonJS interop helper gets its own chunk. Otherwise it lands in
            // the lazy tppt-pdfmake chunk and every page downloads pdfmake to use it.
            if (id.includes('commonjsHelpers')) return 'commonjs-helpers';
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('pdfmake')) return 'tppt-pdfmake';
            if (id.includes('pdfjs-dist')) return 'tppt-pdfjs';
            if (
              id.includes('mammoth') ||
              id.includes('jszip') ||
              id.includes('pako') ||
              id.includes('sax') ||
              id.includes('underscore')
            ) {
              return 'tppt-docx';
            }
            return undefined;
          },
        },
      },
    },
  };
});
