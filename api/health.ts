import type { ServerResponse } from 'node:http';
import { getHealthStatus } from '../lib/pantryService.js';
import { sendJson, type ServerlessRequest } from './_http.js';

/**
 * Vercel Serverless Handler: GET /api/health
 * Returns API health status, inventory readiness, and configuration checks.
 */
export default function handler(req: ServerlessRequest, res: ServerResponse): void {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  sendJson(res, 200, getHealthStatus('vercel-serverless'));
}
