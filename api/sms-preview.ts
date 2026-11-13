import type { ServerResponse } from 'node:http';
import { getSmsDigestPreview } from '../lib/pantryService';
import { sendJson, type ServerlessRequest } from './_http';

/**
 * Vercel Serverless Handler: GET /api/sms-preview
 * Returns the daily elderly resident SMS morning digest preview.
 */
export default function handler(req: ServerlessRequest, res: ServerResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  sendJson(res, 200, getSmsDigestPreview());
}
