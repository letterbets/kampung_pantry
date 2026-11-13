import type { ServerResponse } from 'node:http';
import { buildInventoryResponse } from '../lib/pantryService.js';
import { sendJson, type ServerlessRequest } from './_http.js';

/**
 * Vercel Serverless Handler: GET /api/inventory
 * Returns live Kampung Pantry stock, donors, telemetry, and summary metrics.
 */
export default function handler(req: ServerlessRequest, res: ServerResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  sendJson(res, 200, buildInventoryResponse());
}
