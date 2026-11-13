import { AlertTriangle, Check, Clock, Search, ShoppingBag, Utensils, X } from 'lucide-react';
import type { PantryCategory, PantryItem } from '../types/pantry';
import { formatRelativeDonationTime, getExpiryStatus } from '../utils/formatters';

export type CategoryFilter = 'All' | PantryCategory;

interface StockBoardProps {
  items: PantryItem[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onlyExpiringSoon: boolean;
  onToggleExpiringSoon: () => void;
  onlyHalal: boolean;
  onToggleHalal: () => void;
  onlyVegetarian: boolean;
  onToggleVegetarian: () => void;
  selectedRecipeIngredients: string[];
  onToggleRecipeIngredient: (itemName: string) => void;
  onOpenRecipeFinder: () => void;
  onCollectItem: (item: PantryItem) => void;
  collectingId: string | null;
  onResetFilters: () => void;
}

const CATEGORIES: CategoryFilter[] = [
  'All',
  'Fresh Produce',
  'Chilled & Protein',
  'Dried Staples',
  'Bakery Surplus',
];

/**
 * Displays the live searchable, filterable Kampung Pantry fridge & dry-rack stock.
 * Residents can filter by category or dietary need, reserve/collect 1 unit,
 * or select ingredients directly for the AI Recipe Finder.
 */
export function StockBoard({
  items,
  loading,
  error,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  onlyExpiringSoon,
  onToggleExpiringSoon,
  onlyHalal,
  onToggleHalal,
  onlyVegetarian,
  onToggleVegetarian,
  selectedRecipeIngredients,
  onToggleRecipeIngredient,
  onOpenRecipeFinder,
  onCollectItem,
  collectingId,
  onResetFilters,
}: StockBoardProps) {
  return (
    <section
      id="stock-board"
      aria-labelledby="stock-board-heading"
      className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="stock-board-heading"
            className="font-display text-2xl font-bold tracking-tight text-[#13221A] sm:text-3xl"
          >
            Real-Time Fridge &amp; Pantry Stock Board
          </h2>
          <p className="mt-1 text-sm text-[#47554D]">
            Sorted by earliest expiry first so perishable greens, bakery bread, and chilled proteins
            are shared before they spoil.
          </p>
        </div>

        <p className="text-sm font-medium text-[#47554D] tabular-nums">
          Showing {items.length} {items.length === 1 ? 'item' : 'items'}
        </p>
      </div>

      {/* Search & Filter Controls */}
      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-[#DCE5DF] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <label htmlFor="pantry-search" className="sr-only">
              Search available ingredients
            </label>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#47554D]"
              aria-hidden="true"
            />
            <input
              id="pantry-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search rice, tofu, choy sum, bananas..."
              className="min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] pl-10 pr-10 text-sm text-[#13221A] placeholder:text-[#64746B] focus:border-[#157A4C] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[#47554D] hover:bg-[#E7EEE9] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Dietary & Urgency Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleExpiringSoon}
              aria-pressed={onlyExpiringSoon}
              className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                onlyExpiringSoon
                  ? 'border-[#B45309] bg-[#FEF3C7] text-[#78350F]'
                  : 'border-[#CBD6CE] bg-white text-[#47554D] hover:bg-[#F1F5F2]'
              }`}
            >
              Expiring &lt; 48h
            </button>
            <button
              type="button"
              onClick={onToggleHalal}
              aria-pressed={onlyHalal}
              className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                onlyHalal
                  ? 'border-[#157A4C] bg-[#E8F5EE] text-[#0E5A36]'
                  : 'border-[#CBD6CE] bg-white text-[#47554D] hover:bg-[#F1F5F2]'
              }`}
            >
              Halal Only
            </button>
            <button
              type="button"
              onClick={onToggleVegetarian}
              aria-pressed={onlyVegetarian}
              className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                onlyVegetarian
                  ? 'border-[#157A4C] bg-[#E8F5EE] text-[#0E5A36]'
                  : 'border-[#CBD6CE] bg-white text-[#47554D] hover:bg-[#F1F5F2]'
              }`}
            >
              Vegetarian
            </button>
          </div>
        </div>

        {/* Category Segmented Strip */}
        <div
          role="group"
          aria-label="Filter by food category"
          className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[#F1F5F2] p-1"
        >
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => onCategoryChange(category)}
                aria-pressed={active}
                className={`min-h-[40px] rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-[#13221A] shadow-xs'
                    : 'text-[#47554D] hover:text-[#13221A]'
                }`}
              >
                {category === 'All' ? 'All Categories' : category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Jump to Recipe Finder when ingredients are selected */}
      {selectedRecipeIngredients.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm text-[#065F46]">
          <p className="font-medium">
            <strong className="tabular-nums">{selectedRecipeIngredients.length}</strong>{' '}
            {selectedRecipeIngredients.length === 1 ? 'ingredient' : 'ingredients'} selected for
            cooking: {selectedRecipeIngredients.join(', ')}
          </p>
          <button
            type="button"
            onClick={onOpenRecipeFinder}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#157A4C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F5C38] whitespace-nowrap cursor-pointer"
          >
            <Utensils className="h-4 w-4" aria-hidden="true" />
            <span>Open Recipe Finder</span>
          </button>
        </div>
      )}

      {/* Stock Grid / States */}
      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-52 animate-pulse rounded-xl border border-[#DCE5DF] bg-white p-5"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#991B1B]"
        >
          <p className="font-semibold">Unable to load live pantry stock</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-xl border border-[#DCE5DF] bg-white p-10 text-center">
          <p className="font-display text-lg font-semibold text-[#13221A]">
            No matching food items found
          </p>
          <p className="mt-1 text-sm text-[#47554D]">
            Try clearing your search or switching back to all food categories.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-[#157A4C] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0F5C38] cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const expiry = getExpiryStatus(item.expiresAt);
            const isSelectedForRecipe = selectedRecipeIngredients.includes(item.name);
            const isCollecting = collectingId === item.id;

            return (
              <article
                key={item.id}
                className="senior-border flex flex-col justify-between rounded-xl border border-[#DCE5DF] bg-white p-5 transition-colors hover:border-[#B8C7BD]"
              >
                <div>
                  {/* Quiet 1-line unboxed category & zone kicker */}
                  <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#47554D]">
                    <span>
                      {item.category} · {item.storageZone}
                    </span>
                    <span className="tabular-nums">
                      Added {formatRelativeDonationTime(item.donatedAt)}
                    </span>
                  </div>

                  {/* Primary Item Name */}
                  <h3 className="mt-2 font-display text-lg font-bold text-[#13221A]">
                    {item.name}
                  </h3>

                  {/* Clean Unboxed Metadata Line */}
                  <p className="mt-1.5 text-sm font-medium text-[#13221A] tabular-nums">
                    {item.quantity} {item.unit}
                    <span className="mx-1.5 text-[#94A39B]" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#47554D]">{item.condition}</span>
                    {item.halal && (
                      <>
                        <span className="mx-1.5 text-[#94A39B]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[#0E5A36]">Halal</span>
                      </>
                    )}
                    {item.vegetarian && (
                      <>
                        <span className="mx-1.5 text-[#94A39B]" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[#47554D]">Vegetarian</span>
                      </>
                    )}
                  </p>

                  {/* Expiry Countdown (Icon + Explicit Text, Never Hue Alone) */}
                  <div
                    className={`mt-3 flex items-center gap-2 text-sm font-semibold tabular-nums ${
                      expiry.urgency === 'urgent'
                        ? 'text-[#B91C1C]'
                        : expiry.urgency === 'soon'
                          ? 'text-[#B45309]'
                          : 'text-[#157A4C]'
                    }`}
                  >
                    {expiry.urgency === 'normal' ? (
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{expiry.label}</span>
                  </div>

                  {item.notes && (
                    <p className="mt-2 text-sm text-[#47554D] line-clamp-2">{item.notes}</p>
                  )}

                  <p className="mt-3 border-t border-[#EDF2EE] pt-3 text-xs text-[#47554D]">
                    Shared by <span className="font-medium text-[#13221A]">{item.donorName}</span> (
                    {item.donorType})
                  </p>
                </div>

                {/* Accessible Large Touch-Target Action Row */}
                <div className="mt-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleRecipeIngredient(item.name)}
                    aria-pressed={isSelectedForRecipe}
                    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      isSelectedForRecipe
                        ? 'border-[#157A4C] bg-[#E8F5EE] text-[#0E5A36]'
                        : 'border-[#CBD6CE] bg-white text-[#13221A] hover:bg-[#F1F5F2]'
                    }`}
                  >
                    {isSelectedForRecipe ? (
                      <>
                        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>In Recipe</span>
                      </>
                    ) : (
                      <>
                        <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>Cook This</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onCollectItem(item)}
                    disabled={isCollecting}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#157A4C] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0F5C38] disabled:opacity-60 whitespace-nowrap transition-colors cursor-pointer"
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{isCollecting ? 'Updating...' : 'Collect 1'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
