import type { ServerResponse } from 'node:http';
import { donateToPantry } from '../../lib/pantryService';
import { readJsonBody, sendJson, type ServerlessRequest } from '../_http';

/**
 * Vercel Serverless Handler: POST /api/inventory/donate
 * Logs a donated food item and awards Kampung Points.
 */
export default async function handler(req: ServerlessRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await readJsonBody(req);
  const result = donateToPantry(body);
  sendJson(res, result.status, result.payload);
}
