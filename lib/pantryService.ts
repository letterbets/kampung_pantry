import fs from 'node:fs';
import path from 'node:path';
import type {
  DonorType,
  InventoryResponse,
  ItemCondition,
  PantryCategory,
  PantryItem,
  SmsDigestPreview,
} from '../src/types/pantry';
import { FALLBACK_INVENTORY_SEED, type StoredInventoryFile } from './defaultInventory.js';

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
 * Reports API health, inventory store status, and whether Gemini is configured
 * without exposing any secret values.
 */
export function getHealthStatus(runtime: 'express' | 'vercel-serverless') {
  const snapshot = buildInventoryResponse();
  return {
    status: 'ok',
    service: 'Kampung Pantry API',
    runtime,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
    checks: {
      inventoryStore: snapshot.items.length > 0 ? 'ok' : 'empty',
      distinctItems: snapshot.metrics.distinctItemCount,
      totalAvailableUnits: snapshot.metrics.totalAvailableUnits,
      geminiApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
      mealDbEndpoint: '/api/mealdb',
      mealDbCustomKeyConfigured: Boolean(process.env.MEALDB_API_KEY?.trim()),
    },
  };
}

