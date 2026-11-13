import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import type {
  DietaryPreference,
  DonorType,
  InventoryResponse,
  ItemCondition,
  PantryCategory,
  PantryItem,
  RecipeApiResponse,
  RecipeSuggestion,
  SmsDigestPreview,
} from '../src/types/pantry';
import { FALLBACK_INVENTORY_SEED, type StoredInventoryFile } from './defaultInventory';

const DATA_FILE_PATH = path.resolve(process.cwd(), 'data', 'inventory.json');
const TMP_FILE_PATH = '/tmp/kampung-pantry-inventory.json';

const ALLOWED_CATEGORIES: PantryCategory[] = [
  'Fresh Produce',
  'Chilled & Protein',
  'Dried Staples',
  'Bakery Surplus',
];

const ALLOWED_CONDITIONS: ItemCondition[] = ['Fresh', 'Good', 'Use Today'];
const ALLOWED_DONOR_TYPES: DonorType[] = ['Resident', 'F&B Vendor', 'Grassroots Bulk'];
const ALLOWED_DIETARY: DietaryPreference[] = [
  'Halal',
  'Vegetarian',
  'Diabetic-friendly',
  'Senior-soft meals',
  'Low-sodium',
];

/**
 * Strips HTML tags and excessive whitespace from user text inputs
 * so saved donor names and food labels stay clean and safe.
 */
export function sanitizeText(input: unknown, maxLength = 80): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Hydrates relative seed hours into live ISO timestamps so expiry
 * countdowns remain realistic whenever the store initializes.
 */
function hydrateStore(parsed: StoredInventoryFile): StoredInventoryFile {
  const now = Date.now();
  return {
    ...parsed,
    items: parsed.items.map((item) => {
      const donatedHoursAgo = item.seedDonatedHoursAgo ?? 6;
      const expiresInHours = item.seedExpiresInHours ?? 48;
      return {
        ...item,
        donatedAt: item.donatedAt || new Date(now - donatedHoursAgo * 3600 * 1000).toISOString(),
        expiresAt: item.expiresAt || new Date(now + expiresInHours * 3600 * 1000).toISOString(),
      };
    }),
  };
}

/**
 * Loads the Kampung Pantry store from /tmp (warm serverless), data/inventory.json,
 * or the built-in seed fallback so live deployments never fail on file access.
 */
function loadStore(): StoredInventoryFile {
  const candidates = [TMP_FILE_PATH, DATA_FILE_PATH];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return hydrateStore(JSON.parse(raw) as StoredInventoryFile);
      }
    } catch {
      // Try next source
    }
  }
  return hydrateStore(structuredClone(FALLBACK_INVENTORY_SEED));
}

let memoryStore: StoredInventoryFile | null = null;

function getStore(): StoredInventoryFile {
  if (!memoryStore) {
    memoryStore = loadStore();
  }
  return memoryStore;
}

/**
 * Persists store mutations to data/inventory.json when writable,
 * or /tmp on read-only serverless platforms like Vercel.
 */
function persistStoreSafely(store: StoredInventoryFile): void {
  const serialized = JSON.stringify(store, null, 2);
  try {
    if (!process.env.VERCEL) {
      fs.writeFileSync(DATA_FILE_PATH, serialized, 'utf-8');
      return;
    }
  } catch {
    // Fall through to /tmp
  }
  try {
    fs.writeFileSync(TMP_FILE_PATH, serialized, 'utf-8');
  } catch {
    // Continue in memory
  }
}

/**
 * Computes the four Grassroots & Resident summary metrics directly
 * from the current inventory and donor list.
 */
export function buildInventoryResponse(): InventoryResponse {
  const store = getStore();
  const now = Date.now();
  const fortyEightHoursMs = 48 * 3600 * 1000;

  const activeItems = store.items.filter((item) => item.quantity > 0);
  const totalAvailableUnits = activeItems.reduce((sum, item) => sum + item.quantity, 0);
  const expiringSoonCount = activeItems.filter((item) => {
    const msLeft = new Date(item.expiresAt).getTime() - now;
    return msLeft <= fortyEightHoursMs;
  }).length;

  return {
    telemetry: store.telemetry,
    cookout: store.cookout,
    metrics: {
      totalAvailableUnits,
      distinctItemCount: activeItems.length,
      itemsSavedThisMonth: store.itemsSavedThisMonth,
      activeDonorsCount: store.donors.length,
      expiringSoonCount,
    },
    items: [...activeItems].sort(
      (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
    ),
    donors: [...store.donors].sort((a, b) => b.points - a.points),
  };
}

/**
 * Validates and logs a food donation, awarding Kampung Points.
 */
export function donateToPantry(body: Record<string, unknown>): {
  status: number;
  payload: Record<string, unknown>;
} {
  const store = getStore();
  const name = sanitizeText(body?.name, 60);
  const category = body?.category as PantryCategory;
  const quantity = Number(body?.quantity);
  const unit = sanitizeText(body?.unit, 24) || 'packs';
  const expiryHours = Number(body?.expiryHours);
  const condition = (body?.condition as ItemCondition) || 'Fresh';
  const halal = Boolean(body?.halal);
  const vegetarian = Boolean(body?.vegetarian);
  const donorName = sanitizeText(body?.donorName, 50);
  const donorType = (body?.donorType as DonorType) || 'Resident';
  const donorUnit = sanitizeText(body?.donorUnit, 40) || 'Blk 412 Neighbourhood';
  const notes = sanitizeText(body?.notes, 120);

  if (!name || name.length < 2) {
    return {
      status: 400,
      payload: { error: 'Please enter a valid food item name (at least 2 characters).' },
    };
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return { status: 400, payload: { error: 'Please select a valid pantry category.' } };
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
    return { status: 400, payload: { error: 'Quantity must be between 1 and 100.' } };
  }
  if (!Number.isFinite(expiryHours) || expiryHours < 4 || expiryHours > 8760) {
    return {
      status: 400,
      payload: { error: 'Expiry window must be between 4 hours and 365 days.' },
    };
  }
  if (!ALLOWED_CONDITIONS.includes(condition)) {
    return { status: 400, payload: { error: 'Invalid food condition status.' } };
  }
  if (!donorName || donorName.length < 2) {
    return { status: 400, payload: { error: 'Please enter your name or vendor shop name.' } };
  }
  if (!ALLOWED_DONOR_TYPES.includes(donorType)) {
    return { status: 400, payload: { error: 'Invalid donor type.' } };
  }

  const storageZone =
    category === 'Fresh Produce'
      ? 'Crisper Drawer'
      : category === 'Chilled & Protein'
        ? 'Chiller Shelf'
        : category === 'Bakery Surplus'
          ? 'Bakery Bin'
          : 'Dry Pantry Rack';

  const now = Date.now();
  const newItem: PantryItem = {
    id: `item-${now}`,
    name,
    category,
    quantity: Math.round(quantity),
    unit,
    condition,
    halal,
    vegetarian,
    donorName,
    donorType,
    donatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + expiryHours * 3600 * 1000).toISOString(),
    storageZone,
    notes: notes || undefined,
  };

  const basePoints =
    category === 'Fresh Produce' || category === 'Chilled & Protein'
      ? 25
      : category === 'Bakery Surplus'
        ? 20
        : 15;
  const vendorBonus = donorType === 'F&B Vendor' ? 15 : 0;
  const quantityBonus = Math.min(20, (Math.round(quantity) - 1) * 5);
  const pointsAwarded = basePoints + vendorBonus + quantityBonus;

  store.items.unshift(newItem);

  const existingDonor = store.donors.find(
    (d) => d.name.toLowerCase() === donorName.toLowerCase(),
  );
  if (existingDonor) {
    existingDonor.points += pointsAwarded;
    existingDonor.contributions += 1;
    existingDonor.lastDonatedAt = 'Just now';
    if (donorUnit) existingDonor.blockOrUnit = donorUnit;
  } else {
    store.donors.push({
      id: `d-${now}`,
      name: donorName,
      type: donorType,
      blockOrUnit: donorUnit,
      points: pointsAwarded,
      contributions: 1,
      lastDonatedAt: 'Just now',
    });
  }

  persistStoreSafely(store);

  return {
    status: 201,
    payload: {
      message: `Thank you, ${donorName}! Logged ${newItem.quantity} ${newItem.unit} of ${newItem.name} (+${pointsAwarded} Kampung Points).`,
      pointsAwarded,
      item: newItem,
      inventory: buildInventoryResponse(),
    },
  };
}

/**
 * Records a resident collecting units of an item and updates Items Saved.
 */
export function collectFromPantry(body: Record<string, unknown>): {
  status: number;
  payload: Record<string, unknown>;
} {
  const store = getStore();
  const id = sanitizeText(body?.id, 60);
  const amount = Number(body?.amount ?? 1);

  if (!id) {
    return { status: 400, payload: { error: 'Item ID is required.' } };
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 20) {
    return { status: 400, payload: { error: 'Collection amount must be between 1 and 20.' } };
  }

  const target = store.items.find((item) => item.id === id);
  if (!target || target.quantity <= 0) {
    return { status: 404, payload: { error: 'Item is no longer available in the fridge.' } };
  }

  const taken = Math.min(target.quantity, Math.round(amount));
  target.quantity -= taken;
  store.itemsSavedThisMonth += taken;
  store.telemetry.doorOpeningsToday += 1;

  if (target.quantity <= 0) {
    store.items = store.items.filter((item) => item.id !== id);
  }

  persistStoreSafely(store);

  return {
    status: 200,
    payload: {
      message: `Collected ${taken} ${target.unit} of ${target.name}. Enjoy your meal!`,
      inventory: buildInventoryResponse(),
    },
  };
}

/**
 * Builds a structured SMS digest preview for elderly residents without smartphones.
 */
export function getSmsDigestPreview(): SmsDigestPreview {
  const snapshot = buildInventoryResponse();
  const now = Date.now();
  const urgent = snapshot.items
    .filter((i) => new Date(i.expiresAt).getTime() - now <= 48 * 3600 * 1000)
    .slice(0, 3)
    .map((i) => `${i.name} (${i.quantity} ${i.unit})`);

  const freshAdditions = snapshot.items
    .slice(0, 4)
    .map((i) => `${i.name} (${i.quantity} ${i.unit})`);

  return {
    gatewayIntegrationHook:
      'POST /hooks/sms-gateway (Ready for GovTech Postman.gov.sg or Twilio Singapore SMS API)',
    recipientCount: 64,
    scheduledSendTime: 'Daily 08:30 SGT',
    messageBody: [
      `[Kampung Pantry @ ${snapshot.telemetry.fridgeId}]`,
      `Good morning neighbours! Free food today at Blk 412 Void Deck:`,
      `Take First (Fresh/Use Today): ${urgent.length > 0 ? urgent.join(', ') : 'All items fresh'}.`,
      `Also stocked: ${freshAdditions.join(', ')}.`,
      `Next Cookout: ${snapshot.cookout.dateLabel}.`,
      `Reply HELP for volunteer assistance.`,
    ].join('\n'),
    structuredPayload: {
      fridgeId: snapshot.telemetry.fridgeId,
      location: snapshot.telemetry.location,
      urgentItems: urgent,
      newAdditions: freshAdditions,
      cookoutReminder: `${snapshot.cookout.title} on ${snapshot.cookout.dateLabel}`,
    },
  };
}

/**
 * Maps local Singapore ingredient names into clean search keywords
 * that TheMealDB v1 free API understands reliably.
 */
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

async function queryTheMealDbRecipes(selectedIngredients: string[]): Promise<MealDbDetail[]> {
  const candidateIds = new Set<string>();
  const keywords = Array.from(
    new Set(selectedIngredients.flatMap((item) => normalizeIngredientForMealDb(item))),
  ).slice(0, 4);

  for (const keyword of keywords) {
    const filterUrl = `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(keyword)}`;
    const data = await fetchJsonWithTimeout<{ meals: MealDbSummary[] | null }>(filterUrl);
    if (data?.meals) {
      for (const meal of data.meals.slice(0, 3)) {
        candidateIds.add(meal.idMeal);
      }
    }
    if (candidateIds.size >= 5) break;
  }

  if (candidateIds.size === 0 && keywords.length > 0) {
    const searchUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(keywords[0])}`;
    const data = await fetchJsonWithTimeout<{ meals: MealDbDetail[] | null }>(searchUrl);
    if (data?.meals) {
      return data.meals.slice(0, 3);
    }
  }

  const idsToLookup = Array.from(candidateIds).slice(0, 4);
  const details = await Promise.all(
    idsToLookup.map(async (id) => {
      const lookupUrl = `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(id)}`;
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
    const store = getStore();
    const currentStockNames = store.items
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
