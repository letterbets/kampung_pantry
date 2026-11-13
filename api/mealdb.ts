import type { ServerResponse } from 'node:http';
import { fetchMealDbCategoriesData } from '../lib/recipeService.js';
import { sendJson, type ServerlessRequest } from './_http.js';

/**
 * Vercel Serverless Handler: GET /api/mealdb
 * Pulls live recipe categories from TheMealDB (categories.php) and optional
 * meals by category (?category=Seafood). Uses MEALDB_API_KEY env var when set.
 */
export default async function handler(req: ServerlessRequest, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const parsedUrl = new URL(req.url || '/api/mealdb', 'http://localhost');
  const category = parsedUrl.searchParams.get('category') || undefined;
  const result = await fetchMealDbCategoriesData(category);
  sendJson(res, result.status, result.payload);
}
