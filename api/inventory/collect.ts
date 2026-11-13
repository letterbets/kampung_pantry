import type { ServerResponse } from 'node:http';
import { collectFromPantry } from '../../lib/pantryService';
import { readJsonBody, sendJson, type ServerlessRequest } from '../_http';

/**
 * Vercel Serverless Handler: POST /api/inventory/collect
 * Decrements live stock when a resident collects an item.
 */
export default async function handler(req: ServerlessRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await readJsonBody(req);
  const result = collectFromPantry(body);
  sendJson(res, result.status, result.payload);
}
