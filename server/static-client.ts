import express, {type Express} from 'express';
import path from 'node:path';

export function mountStaticClient(app: Express, directory: string) {
  app.use(express.static(directory, {
    setHeaders: (res, file) => {
      const relative = path.relative(directory, file).split(path.sep).join('/');
      // Vite's generated /assets/name-[hash].js/css files change URL on rebuild.
      const immutable = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(js|css)$/.test(relative);
      res.setHeader('Cache-Control', immutable
        ? 'public, max-age=31536000, immutable'
        : 'no-cache');
    }
  }));
  // SPA deep links must revalidate the entry HTML too, including asset misses.
  app.get('*', (_req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(directory, 'index.html')));
}
