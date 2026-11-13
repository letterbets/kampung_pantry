import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  buildInventoryResponse,
  collectFromPantry,
  donateToPantry,
  getSmsDigestPreview,
} from './lib/pantryService.js';
import { generateAdaptedRecipes } from './lib/recipeService.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/inventory', (_req: Request, res: Response) => {
    res.json(buildInventoryResponse());
  });

  app.post('/api/inventory/donate', (req: Request, res: Response) => {
    const result = donateToPantry((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
  });

  app.post('/api/inventory/collect', (req: Request, res: Response) => {
    const result = collectFromPantry((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
  });

  app.get('/api/sms-preview', (_req: Request, res: Response) => {
    res.json(getSmsDigestPreview());
  });

  app.post('/api/recipes', async (req: Request, res: Response) => {
    const result = await generateAdaptedRecipes((req.body ?? {}) as Record<string, unknown>);
    res.status(result.status).json(result.payload);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kampung Pantry server running at http://localhost:${PORT}`);
  });
}

startServer();
