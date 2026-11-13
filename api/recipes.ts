import type { ServerResponse } from 'node:http';
import { generateAdaptedRecipes } from '../lib/recipeService.js';
import { readJsonBody, sendJson, type ServerlessRequest } from './_http.js';

/**
 * Vercel Serverless Handler: POST /api/recipes
 * Queries TheMealDB and adapts recipes with Gemini on the server side.
 */
export default async function handler(req: ServerlessRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const body = await readJsonBody(req);
  const result = await generateAdaptedRecipes(body);
  sendJson(res, result.status, result.payload);
}
