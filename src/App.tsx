import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { Header, type AppPage } from './components/Header';
import { SummaryMetrics } from './components/SummaryMetrics';
import { StockBoard, type CategoryFilter } from './components/StockBoard';
import { RecipeFinder } from './components/RecipeFinder';
import { DonorLogger } from './components/DonorLogger';
import { CommunityOperations } from './components/CommunityOperations';
import type { InventoryResponse, PantryItem } from './types/pantry';
import { getExpiryStatus } from './utils/formatters';

const DEFAULT_INVENTORY: InventoryResponse = {
  telemetry: {
    fridgeId: 'KP-TMP-412',
    location: 'Blk 412 Tampines St 41, Void Deck Pillar B',
    townCouncilPartner: 'Tampines Town Council Maintenance Crew',
    grassrootsGroup: 'Tampines North Zone 3 RN Volunteers',
    chillerTempC: 3.4,
    crisperHumidityPct: 82,
    dryPantryTempC: 24.5,
    doorOpeningsToday: 38,
    sensorStatus: 'Nominal',
    lastMaintenanceCheck: 'Today, 07:30 SGT',
    nextScheduledCleanup: 'Friday, 18:00 SGT',
    simulatedNote:
      'Simulated smart-fridge weight & temperature telemetry. Ready for Town Council IoT webhook integration.',
  },
  cookout: {
    title: 'Quarterly Kampung Community Cookout',
    dateLabel: 'Saturday, 28 Nov · 10:30 AM – 1:30 PM',
    location: 'Blk 412 Void Deck Multi-Purpose Hall',
    featuredDishes: [
      'Soft Vegetable & Tofu Porridge (Senior-friendly)',
      'One-Pot Tomato Herb Chicken Rice',
      'Banoffee Oat Cups from Rescued Bananas',
    ],
    rsvpCount: 42,
  },
  metrics: {
    totalAvailableUnits: 0,
    distinctItemCount: 0,
    itemsSavedThisMonth: 184,
    activeDonorsCount: 0,
    expiringSoonCount: 0,
  },
  items: [],
  donors: [],
};

const VALID_PAGES: AppPage[] = ['stock', 'recipes', 'donate', 'community'];

/** Reads initial active page from URL hash so page navigation supports deep links */
function getInitialPage(): AppPage {
  if (typeof window === 'undefined') return 'stock';
  const hash = window.location.hash.replace('#', '') as AppPage;
  return VALID_PAGES.includes(hash) ? hash : 'stock';
}

/**
 * Main Kampung Pantry application coordinating separated page views for
 * Stock Board, Recipe Finder, Donor Logger, and Community Operations.
 */
export default function App() {
  const [activePage, setActivePage] = useState<AppPage>(getInitialPage);
  const [inventory, setInventory] = useState<InventoryResponse>(DEFAULT_INVENTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seniorMode, setSeniorMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  // Stock board filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [onlyExpiringSoon, setOnlyExpiringSoon] = useState(false);
  const [onlyHalal, setOnlyHalal] = useState(false);
  const [onlyVegetarian, setOnlyVegetarian] = useState(false);

  // Selected ingredients shared between Stock Board and Recipe Finder
  const [selectedRecipeIngredients, setSelectedRecipeIngredients] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/inventory')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load Kampung Pantry stock');
        return data as InventoryResponse;
      })
      .then((data) => {
        if (!active) return;
        setInventory(data);
        const urgentNames = data.items
          .filter((item) => getExpiryStatus(item.expiresAt).hoursRemaining <= 48)
          .slice(0, 2)
          .map((item) => item.name);
        setSelectedRecipeIngredients(urgentNames);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to fetch inventory');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** Syncs page state if the user presses browser Back/Forward */
  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.replace('#', '') as AppPage;
      if (VALID_PAGES.includes(hash)) {
        setActivePage(hash);
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  /** Switches active view cleanly and resets scroll to top */
  function navigateTo(page: AppPage) {
    setActivePage(page);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${page}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Computes the filtered list of stock items based on search, category, and dietary toggles */
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return inventory.items.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (onlyHalal && !item.halal) return false;
      if (onlyVegetarian && !item.vegetarian) return false;
      if (onlyExpiringSoon && getExpiryStatus(item.expiresAt).hoursRemaining > 48) return false;
      if (query) {
        const haystack = `${item.name} ${item.category} ${item.donorName} ${item.notes || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [inventory.items, searchQuery, selectedCategory, onlyExpiringSoon, onlyHalal, onlyVegetarian]);

  /** Toggles an ingredient in or out of the Recipe Finder selection */
  function handleToggleRecipeIngredient(itemName: string) {
    setSelectedRecipeIngredients((prev) =>
      prev.includes(itemName) ? prev.filter((name) => name !== itemName) : [...prev, itemName],
    );
  }

  /** Automatically selects all items expiring within 48 hours for recipe cooking */
  function handleSelectExpiringSoonForRecipe() {
    const urgent = inventory.items
      .filter((item) => getExpiryStatus(item.expiresAt).hoursRemaining <= 48)
      .slice(0, 5)
      .map((item) => item.name);

    if (urgent.length > 0) {
      setSelectedRecipeIngredients(urgent);
    } else if (inventory.items.length > 0) {
      setSelectedRecipeIngredients(inventory.items.slice(0, 3).map((item) => item.name));
    }
  }

  /** Records collection of 1 unit from the live fridge stock */
  async function handleCollectItem(item: PantryItem) {
    setCollectingId(item.id);
    setStatusMessage(null);
    try {
      const response = await fetch('/api/inventory/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, amount: 1 }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not update item stock.');
      }
      setInventory(data.inventory as InventoryResponse);
      setStatusMessage(data.message);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Unable to collect item right now.',
      );
    } finally {
      setCollectingId(null);
    }
  }

  /** Resets all stock filters back to default */
  function handleResetFilters() {
    setSearchQuery('');
    setSelectedCategory('All');
    setOnlyExpiringSoon(false);
    setOnlyHalal(false);
    setOnlyVegetarian(false);
  }

  return (
    <div className={`min-h-screen flex flex-col ${seniorMode ? 'senior-mode bg-white' : ''}`}>
      <Header
        activePage={activePage}
        onNavigate={navigateTo}
        seniorMode={seniorMode}
        onToggleSeniorMode={() => setSeniorMode((prev) => !prev)}
        selectedRecipeCount={selectedRecipeIngredients.length}
      />

      {/* Senior High-Contrast & Quick Print Toolbar when toggled on */}
      {seniorMode && (
        <div
          role="region"
          aria-label="Senior accessibility controls"
          className="border-b-2 border-[#13221A] bg-[#E8F5EE] px-4 py-3 sm:px-6"
        >
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#13221A]">
              Senior &amp; QR Mode Active: Enlarged text, high-contrast borders, and large touch
              buttons enabled.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#13221A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1F3529] cursor-pointer"
              >
                <Printer className="h-4 w-4" aria-hidden="true" />
                <span>Print Fridge Poster</span>
              </button>
              <button
                type="button"
                onClick={() => setSeniorMode(false)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border-2 border-[#13221A] bg-white px-4 py-2 text-sm font-semibold text-[#13221A] hover:bg-[#F1F5F2] cursor-pointer"
              >
                <span>Exit Senior Mode</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Feedback Toast Banner */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm font-medium text-[#065F46]"
        >
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              aria-label="Dismiss notification"
              className="rounded p-1 hover:bg-[#D1FAE5] cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {activePage === 'stock' && (
          <>
            <SummaryMetrics
              metrics={inventory.metrics}
              telemetry={inventory.telemetry}
              onFilterExpiringSoon={() => {
                setOnlyExpiringSoon(true);
                setSelectedCategory('All');
              }}
              onJumpToRecipes={() => navigateTo('recipes')}
              onJumpToDonate={() => navigateTo('donate')}
            />

            <StockBoard
              items={filteredItems}
              loading={loading}
              error={error}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              onlyExpiringSoon={onlyExpiringSoon}
              onToggleExpiringSoon={() => setOnlyExpiringSoon((prev) => !prev)}
              onlyHalal={onlyHalal}
              onToggleHalal={() => setOnlyHalal((prev) => !prev)}
              onlyVegetarian={onlyVegetarian}
              onToggleVegetarian={() => setOnlyVegetarian((prev) => !prev)}
              selectedRecipeIngredients={selectedRecipeIngredients}
              onToggleRecipeIngredient={handleToggleRecipeIngredient}
              onOpenRecipeFinder={() => navigateTo('recipes')}
              onCollectItem={handleCollectItem}
              collectingId={collectingId}
              onResetFilters={handleResetFilters}
            />
          </>
        )}

        {activePage === 'recipes' && (
          <RecipeFinder
            availableItems={inventory.items}
            selectedIngredients={selectedRecipeIngredients}
            onToggleIngredient={handleToggleRecipeIngredient}
            onSelectExpiringSoon={handleSelectExpiringSoonForRecipe}
            onClearIngredients={() => setSelectedRecipeIngredients([])}
          />
        )}

        {activePage === 'donate' && (
          <DonorLogger
            donors={inventory.donors}
            onDonationLogged={(updated, message) => {
              setInventory(updated);
              setStatusMessage(message);
            }}
          />
        )}

        {activePage === 'community' && (
          <CommunityOperations
            telemetry={inventory.telemetry}
            cookout={inventory.cookout}
          />
        )}
      </main>

      <footer className="border-t border-[#DCE5DF] bg-[#F7F9F7] py-6">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 text-sm text-[#47554D] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="font-display font-bold text-[#13221A]">Kampung Pantry</p>
            <p className="mt-0.5 text-xs">
              Non-profit HDB neighbourhood food-sharing initiative · Free for all residents,
              supported by Tampines North Zone 3 RN &amp; community staple sponsors.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium">
            <button
              type="button"
              onClick={() => navigateTo('stock')}
              className="hover:text-[#13221A] hover:underline cursor-pointer"
            >
              Stock Board
            </button>
            <button
              type="button"
              onClick={() => navigateTo('recipes')}
              className="hover:text-[#13221A] hover:underline cursor-pointer"
            >
              Recipes
            </button>
            <button
              type="button"
              onClick={() => navigateTo('donate')}
              className="hover:text-[#13221A] hover:underline cursor-pointer"
            >
              Donate
            </button>
            <button
              type="button"
              onClick={() => navigateTo('community')}
              className="hover:text-[#13221A] hover:underline cursor-pointer"
            >
              QR Poster &amp; SMS
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
