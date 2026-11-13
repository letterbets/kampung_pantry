import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  DietaryPreference,
  RecipeApiResponse,
  RecipeSuggestion,
} from '../src/types/pantry';
import { buildInventoryResponse, sanitizeText } from './pantryService.js';

const ALLOWED_DIETARY: DietaryPreference[] = [
  'Halal',
  'Vegetarian',
  'Diabetic-friendly',
  'Senior-soft meals',
  'Low-sodium',
];

function normalizeIngredientForMealDb(rawName: string): string[] {
  const lower = rawName.toLowerCase();
  const mappings: Array<[RegExp, string[]]> = [
    [/choy sum|bok choy|pak choi/, ['bok choy', 'spinach']],
    [/kangkong|water spinach/, ['spinach']],
    [/tofu|tau kwa/, ['tofu']],
    [/chicken/, ['chicken breast', 'chicken']],
    [/egg/, ['eggs', 'egg']],
    [/carrot/, ['carrots', 'carrot']],
    [/tomato/, ['tomatoes', 'tomato']],
    [/rice/, ['rice']],
    [/spaghetti|pasta/, ['spaghetti', 'pasta']],
    [/sardine/, ['sardines', 'salmon']],
    [/banana/, ['banana']],
    [/sweet potato/, ['sweet potato']],
    [/bread|loaf/, ['bread']],
  ];

  for (const [pattern, results] of mappings) {
    if (pattern.test(lower)) return results;
  }

  const cleaned = lower.replace(/\(.*?\)/g, '').replace(/[^a-z\s]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length > 0 ? [words[words.length - 1], cleaned] : [];
}

interface MealDbSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb?: string;
}

interface MealDbDetail extends MealDbSummary {
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  [key: string]: string | undefined;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds the TheMealDB v1 base URL from process.env.MEALDB_API_KEY when provided,
 * falling back to the free public v1/1 endpoint without hardcoding any private key.
 */
export function getMealDbBaseUrl(): string {
  const customKey = process.env.MEALDB_API_KEY?.trim();
  const keySegment = customKey ? encodeURIComponent(customKey) : '1';
  return `https://www.themealdb.com/api/json/v1/${keySegment}`;
}

export interface MealDbCategory {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

/**
 * Pulls recipe categories from TheMealDB categories.php endpoint,
 * plus optional category meal previews when a category name is supplied.
 */
export async function fetchMealDbCategoriesData(categoryFilter?: string): Promise<{
  status: number;
  payload: Record<string, unknown>;
}> {
  const baseUrl = getMealDbBaseUrl();
  const categoriesRes = await fetchJsonWithTimeout<{ categories: MealDbCategory[] | null }>(
    `${baseUrl}/categories.php`,
  );

  if (!categoriesRes?.categories) {
    return {
      status: 502,
      payload: {
        error: 'Unable to fetch categories from TheMealDB right now.',
        categories: [],
      },
    };
  }

  let mealsInCategory: MealDbSummary[] = [];
  const cleanCategory = sanitizeText(categoryFilter, 40);
  if (cleanCategory) {
    const mealsRes = await fetchJsonWithTimeout<{ meals: MealDbSummary[] | null }>(
      `${baseUrl}/filter.php?c=${encodeURIComponent(cleanCategory)}`,
    );
    mealsInCategory = (mealsRes?.meals ?? []).slice(0, 6);
  }

  return {
    status: 200,
    payload: {
      source: 'TheMealDB',
      endpoint: 'categories.php',
      customKeyConfigured: Boolean(process.env.MEALDB_API_KEY?.trim()),
      categories: categoriesRes.categories,
      selectedCategory: cleanCategory || null,
      mealsInCategory,
    },
  };
}

async function queryTheMealDbRecipes(selectedIngredients: string[]): Promise<MealDbDetail[]> {
  const baseUrl = getMealDbBaseUrl();
  const candidateIds = new Set<string>();
  const keywords = Array.from(
    new Set(selectedIngredients.flatMap((item) => normalizeIngredientForMealDb(item))),
  ).slice(0, 4);

  for (const keyword of keywords) {
    const filterUrl = `${baseUrl}/filter.php?i=${encodeURIComponent(keyword)}`;
    const data = await fetchJsonWithTimeout<{ meals: MealDbSummary[] | null }>(filterUrl);
    if (data?.meals) {
      for (const meal of data.meals.slice(0, 3)) {
        candidateIds.add(meal.idMeal);
      }
    }
    if (candidateIds.size >= 5) break;
  }

  if (candidateIds.size === 0 && keywords.length > 0) {
    const searchUrl = `${baseUrl}/search.php?s=${encodeURIComponent(keywords[0])}`;
    const data = await fetchJsonWithTimeout<{ meals: MealDbDetail[] | null }>(searchUrl);
    if (data?.meals) {
      return data.meals.slice(0, 3);
    }
  }

  const idsToLookup = Array.from(candidateIds).slice(0, 4);
  const details = await Promise.all(
    idsToLookup.map(async (id) => {
      const lookupUrl = `${baseUrl}/lookup.php?i=${encodeURIComponent(id)}`;
      const res = await fetchJsonWithTimeout<{ meals: MealDbDetail[] | null }>(lookupUrl);
      return res?.meals?.[0] ?? null;
    }),
  );

  return details.filter((meal): meal is MealDbDetail => meal !== null);
}

function extractMealDbIngredients(meal: MealDbDetail): string[] {
  const list: string[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const ing = meal[`strIngredient${i}`]?.trim();
    const meas = meal[`strMeasure${i}`]?.trim();
    if (ing) {
      list.push(meas ? `${meas} ${ing}` : ing);
    }
  }
  return list;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Queries TheMealDB v1 endpoints and uses Gemini server-side to rank matches,
 * suggest pantry substitutions, and adapt instructions for dietary/senior needs.
 */
export async function generateAdaptedRecipes(body: Record<string, unknown>): Promise<{
  status: number;
  payload: RecipeApiResponse | { error: string };
}> {
  const rawIngredients = Array.isArray(body?.ingredients) ? body.ingredients : [];
  const rawDietary = Array.isArray(body?.dietaryPreferences) ? body.dietaryPreferences : [];

  const selectedIngredients: string[] = rawIngredients
    .map((item: unknown) => sanitizeText(item, 60))
    .filter((item: string) => item.length > 0)
    .slice(0, 8);

  const dietaryPreferences: DietaryPreference[] = rawDietary.filter(
    (pref: unknown): pref is DietaryPreference =>
      typeof pref === 'string' && ALLOWED_DIETARY.includes(pref as DietaryPreference),
  );

  if (selectedIngredients.length === 0) {
    return {
      status: 400,
      payload: {
        error: 'Please select at least one ingredient from the Kampung Pantry stock list.',
      },
    };
  }

  try {
    const snapshot = buildInventoryResponse();
    const currentStockNames = snapshot.items
      .filter((i) => i.quantity > 0)
      .map((i) => `${i.name} (${i.quantity} ${i.unit}, Halal: ${i.halal ? 'Yes' : 'No'})`);

    const mealDbMeals = await queryTheMealDbRecipes(selectedIngredients);
    const usedFallback = mealDbMeals.length === 0;

    const ai = getGeminiClient();

    const mealDbContext = mealDbMeals.map((m) => ({
      id: m.idMeal,
      title: m.strMeal,
      category: m.strCategory || 'Home Style',
      area: m.strArea || 'International',
      thumbnailUrl: m.strMealThumb || '',
      ingredients: extractMealDbIngredients(m),
      rawInstructions: (m.strInstructions || '').slice(0, 1400),
    }));

    const prompt = usedFallback
      ? `You are the Kampung Pantry Community Chef helping Singapore HDB residents (including seniors and low-income families) cook nutritious, zero-waste meals.
TheMealDB returned no matching recipes for the selected ingredients, so create 3 practical, comforting, home-style recipes using the selected ingredients and today's Kampung Pantry stock.

Selected ingredients by resident: ${JSON.stringify(selectedIngredients)}
All available Kampung Pantry items today: ${JSON.stringify(currentStockNames)}
Dietary preferences requested: ${JSON.stringify(dietaryPreferences.length > 0 ? dietaryPreferences : ['Standard Balanced Home Meal'])}

Rules:
1. Respect ALL requested dietary preferences strictly (if Halal: zero pork, lard, mirin, or alcohol; if Vegetarian: no meat/fish; if Diabetic-friendly: lower GI, controlled refined carbs/sugar; if Senior-soft meals: tender textures, easy to chew and swallow, clear large-print steps; if Low-sodium: minimal salt/soy sauce, rely on herbs/aromatics).
2. Prioritize using the selected ingredients and other available Kampung Pantry items so residents spend $0 extra where possible.
3. Keep instructions warm, clear, numbered steps in plain English.`
      : `You are the Kampung Pantry Community Chef helping Singapore HDB residents (including seniors and low-income families) cook nutritious, zero-waste meals.
Below are real recipes fetched from TheMealDB API, along with the resident's selected ingredients and today's Kampung Pantry fridge stock.

Selected ingredients by resident: ${JSON.stringify(selectedIngredients)}
All available Kampung Pantry items today: ${JSON.stringify(currentStockNames)}
Dietary preferences requested: ${JSON.stringify(dietaryPreferences.length > 0 ? dietaryPreferences : ['Standard Balanced Home Meal'])}

TheMealDB candidate recipes:
${JSON.stringify(mealDbContext, null, 2)}

Tasks:
1. Rank and return the best 3 recipes (or all available if fewer than 3) that maximize use of today's Kampung Pantry stock.
2. Preserve each recipe's exact id, title, category, area, and thumbnailUrl from TheMealDB.
3. For any recipe ingredient missing from today's Kampung Pantry stock, suggest smart substitutions using available pantry items or affordable HDB kitchen staples.
4. Adapt the recipe instructions and notes to strictly satisfy ALL requested dietary preferences (e.g., Halal swaps for any non-Halal meat/alcohol, Vegetarian protein swaps like Tofu/Eggs, Diabetic-friendly lower-GI swaps, Senior-soft gentler cooking/smaller cuts, Low-sodium seasoning tips).
5. Write clear, encouraging, easy-to-follow step-by-step instructions.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  thumbnailUrl: { type: Type.STRING },
                  category: { type: Type.STRING },
                  area: { type: Type.STRING },
                  prepTimeMinutes: { type: Type.INTEGER },
                  pantryMatchSummary: { type: Type.STRING },
                  matchedIngredients: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  missingIngredients: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  smartSubstitutions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  dietaryAdaptationNotes: { type: Type.STRING },
                  ingredientsWithMeasures: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  instructions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'id',
                  'title',
                  'prepTimeMinutes',
                  'pantryMatchSummary',
                  'matchedIngredients',
                  'missingIngredients',
                  'smartSubstitutions',
                  'dietaryAdaptationNotes',
                  'ingredientsWithMeasures',
                  'instructions',
                ],
              },
            },
          },
          required: ['recipes'],
        },
      },
    });

    const parsedJson = JSON.parse((aiResponse.text ?? '{"recipes":[]}').trim()) as {
      recipes: Array<Omit<RecipeSuggestion, 'source'>>;
    };

    const recipes: RecipeSuggestion[] = (parsedJson.recipes || []).map((r, index) => {
      const matchedMealDb = mealDbContext.find((m) => m.id === r.id || m.title === r.title);
      return {
        ...r,
        id: r.id || `kp-recipe-${index + 1}`,
        thumbnailUrl: matchedMealDb?.thumbnailUrl || r.thumbnailUrl || undefined,
        source: usedFallback ? 'Kampung Pantry AI Chef' : 'TheMealDB + AI Adapted',
      };
    });

    return {
      status: 200,
      payload: {
        recipes,
        usedFallback,
        queriedIngredients: selectedIngredients,
        dietaryPreferences,
        note: usedFallback
          ? 'TheMealDB had no exact match for that combination, so Kampung Pantry AI Chef created tailored zero-waste recipes from your fridge items.'
          : `Matched ${recipes.length} real recipes from TheMealDB and adapted them to your Kampung Pantry stock and dietary preferences.`,
      },
    };
  } catch (error) {
    console.error('Recipe generation error:', error);
    return {
      status: 500,
      payload: {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach recipe service right now. Please try again shortly.',
      },
    };
  }
}
