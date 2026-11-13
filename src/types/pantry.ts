export type PantryCategory =
  | 'Fresh Produce'
  | 'Chilled & Protein'
  | 'Dried Staples'
  | 'Bakery Surplus';

export type ItemCondition = 'Fresh' | 'Good' | 'Use Today';

export type DonorType = 'Resident' | 'F&B Vendor' | 'Grassroots Bulk';

export type DietaryPreference =
  | 'Halal'
  | 'Vegetarian'
  | 'Diabetic-friendly'
  | 'Senior-soft meals'
  | 'Low-sodium';

export interface PantryItem {
  id: string;
  name: string;
  category: PantryCategory;
  quantity: number;
  unit: string;
  condition: ItemCondition;
  halal: boolean;
  vegetarian: boolean;
  donorName: string;
  donorType: DonorType;
  donatedAt: string;
  expiresAt: string;
  /** Relative hours used when seeding initial demo dates so countdowns stay live */
  seedExpiresInHours?: number;
  seedDonatedHoursAgo?: number;
  storageZone: 'Chiller Shelf' | 'Crisper Drawer' | 'Dry Pantry Rack' | 'Bakery Bin';
  notes?: string;
}

export interface DonorProfile {
  id: string;
  name: string;
  type: DonorType;
  blockOrUnit: string;
  points: number;
  contributions: number;
  lastDonatedAt: string;
}

export interface FridgeTelemetry {
  fridgeId: string;
  location: string;
  townCouncilPartner: string;
  grassrootsGroup: string;
  chillerTempC: number;
  crisperHumidityPct: number;
  dryPantryTempC: number;
  doorOpeningsToday: number;
  sensorStatus: 'Nominal' | 'Check Door Seal';
  lastMaintenanceCheck: string;
  nextScheduledCleanup: string;
  simulatedNote: string;
}

export interface QuarterlyCookout {
  title: string;
  dateLabel: string;
  location: string;
  featuredDishes: string[];
  rsvpCount: number;
}

export interface SummaryMetrics {
  totalAvailableUnits: number;
  distinctItemCount: number;
  itemsSavedThisMonth: number;
  activeDonorsCount: number;
  expiringSoonCount: number;
}

export interface InventoryResponse {
  telemetry: FridgeTelemetry;
  cookout: QuarterlyCookout;
  metrics: SummaryMetrics;
  items: PantryItem[];
  donors: DonorProfile[];
}

export interface RecipeSuggestion {
  id: string;
  title: string;
  source: 'TheMealDB + AI Adapted' | 'Kampung Pantry AI Chef';
  thumbnailUrl?: string;
  category?: string;
  area?: string;
  prepTimeMinutes: number;
  pantryMatchSummary: string;
  matchedIngredients: string[];
  missingIngredients: string[];
  smartSubstitutions: string[];
  dietaryAdaptationNotes: string;
  ingredientsWithMeasures: string[];
  instructions: string[];
}

export interface RecipeApiResponse {
  recipes: RecipeSuggestion[];
  usedFallback: boolean;
  queriedIngredients: string[];
  dietaryPreferences: DietaryPreference[];
  note: string;
}

export interface SmsDigestPreview {
  gatewayIntegrationHook: string;
  recipientCount: number;
  scheduledSendTime: string;
  messageBody: string;
  structuredPayload: {
    fridgeId: string;
    location: string;
    urgentItems: string[];
    newAdditions: string[];
    cookoutReminder: string;
  };
}
