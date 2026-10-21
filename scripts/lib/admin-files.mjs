/**
 * Files the content editor and Content history need that come from the app's data or build:
 * - /admin/history/items.json: the editable items with their current titles, for Content
 *   history's names and finder;
 * - /admin/app-style.css: the app's own stylesheet, so the editor's previews look like the app.
 * vite.config.ts serves both during `npm run dev` and writes them into dist/ at build time.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHAPTER_FILES, TREES_PATH } from '../../public/admin/lib/cms-format.js';

const PART_LABELS = {
  intro: 'Introductory Chapters',
  part1: 'Part 1: The Code',
  part2: 'Part 2: Complaint Handling',
  part3: 'Part 3: Annexes & Glossary',
  website: 'Website',
};

/** { items: [{ path, kind, label, context, url }] } in the Code's order, then the decision trees. */
export function buildHistoryIndex(root) {
  const items = CHAPTER_FILES.map((id) => {
    const path = `src/data/code/${id}.json`;
    const chapter = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    return {
      path,
      kind: chapter.part === 'website' ? 'Page' : 'Chapter',
      label: chapter.part === 'part1' ? `Chapter ${chapter.icon}: ${chapter.title}` : chapter.title,
      context: PART_LABELS[chapter.part] ?? '',
      url: `/code/${id}`,
    };
  });
  const trees = JSON.parse(readFileSync(resolve(root, TREES_PATH), 'utf8')).trees ?? [];
  items.push({
    path: TREES_PATH,
    kind: 'Decision trees',
    label: 'All decision trees',
    context: trees.map((tree) => tree.title).join(' · '),
    url: '/trees',
  });
  return { items };
}

/** Vite plugin: the two files above, in development and in the build. */
export function adminFiles(root) {
  return {
    name: 'mte-admin-files',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0];
        if (path === '/admin/history/items.json') {
          response.setHeader('Content-Type', 'application/json');
          response.end(JSON.stringify(buildHistoryIndex(root)));
          return;
        }
        // Content history's own page, not the app (the Worker does the same in production).
        if (path === '/admin/history' || path === '/admin/history/') request.url = '/admin/history/index.html';
        next();
      });
    },
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName: 'admin/history/items.json', source: JSON.stringify(buildHistoryIndex(root)) });
      const appCss = Object.values(bundle).find((file) => file.type === 'asset' && /^assets\/index-[^/]+\.css$/.test(file.fileName));
      if (appCss) this.emitFile({ type: 'asset', fileName: 'admin/app-style.css', source: appCss.source });
    },
  };
}
