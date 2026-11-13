import { AlertTriangle, Leaf, Package, Users } from 'lucide-react';
import type { FridgeTelemetry, SummaryMetrics } from '../types/pantry';

interface SummaryMetricsProps {
  metrics: SummaryMetrics;
  telemetry: FridgeTelemetry;
  onFilterExpiringSoon: () => void;
  onJumpToRecipes: () => void;
  onJumpToDonate: () => void;
}

/**
 * Displays the HDB neighbourhood fridge hero introduction and the four
 * live summary metrics computed directly from data/inventory.json.
 */
export function SummaryMetrics({
  metrics,
  telemetry,
  onFilterExpiringSoon,
  onJumpToRecipes,
  onJumpToDonate,
}: SummaryMetricsProps) {
  return (
    <section id="top" className="border-b border-[#DCE5DF] bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-7 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#157A4C]">
              {telemetry.location} · {telemetry.grassrootsGroup}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[#13221A] sm:text-3xl [text-wrap:balance]">
              Fresh ingredients &amp; pantry staples, free for every neighbour.
            </h1>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#47554D] max-w-[65ch]">
              Check what is inside the void-deck community fridge right now, reserve items before
              they spoil, or turn today&apos;s surplus into Halal, senior-soft, and diabetic-friendly
              home meals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onJumpToRecipes}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#157A4C] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F5C38] whitespace-nowrap transition-colors cursor-pointer"
            >
              Cook with Today&apos;s Stock
            </button>
            <button
              type="button"
              onClick={onJumpToDonate}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#CBD6CE] bg-white px-5 py-2.5 text-sm font-semibold text-[#13221A] hover:bg-[#F1F5F2] whitespace-nowrap transition-colors cursor-pointer"
            >
              Log a Food Donation
            </button>
          </div>
        </div>

        {/* Four Grassroots & Resident Summary Cards */}
        <div
          aria-label="Kampung Pantry live summary metrics"
          className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <article className="senior-border rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-5">
            <div className="flex items-center justify-between text-[#47554D]">
              <span className="text-sm font-medium">Total Available Items</span>
              <Package className="h-4 w-4 text-[#157A4C]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-[#13221A] tabular-nums">
              {metrics.totalAvailableUnits}
            </p>
            <p className="mt-1 text-xs text-[#47554D] tabular-nums">
              Across {metrics.distinctItemCount} chilled &amp; dry pantry lines
            </p>
          </article>

          <article className="senior-border rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-5">
            <div className="flex items-center justify-between text-[#47554D]">
              <span className="text-sm font-medium">Saved from Spoilage</span>
              <Leaf className="h-4 w-4 text-[#157A4C]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-[#13221A] tabular-nums">
              {metrics.itemsSavedThisMonth}
            </p>
            <p className="mt-1 text-xs text-[#47554D]">
              Portions collected this month
            </p>
          </article>

          <article className="senior-border rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-5">
            <div className="flex items-center justify-between text-[#47554D]">
              <span className="text-sm font-medium">Active Kampung Donors</span>
              <Users className="h-4 w-4 text-[#157A4C]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-[#13221A] tabular-nums">
              {metrics.activeDonorsCount}
            </p>
            <p className="mt-1 text-xs text-[#47554D]">
              Residents, bakeries &amp; F&amp;B partners
            </p>
          </article>

          <button
            type="button"
            onClick={onFilterExpiringSoon}
            className="senior-border group rounded-xl border border-[#E7CFA6] bg-[#FFFBEB] p-5 text-left hover:border-[#B45309] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-[#92400E]">
              <span className="text-sm font-semibold">Expiring Soon (&lt; 48 hrs)</span>
              <AlertTriangle className="h-4 w-4 text-[#B45309]" aria-hidden="true" />
            </div>
            <p className="mt-2 font-display text-3xl font-bold text-[#78350F] tabular-nums">
              {metrics.expiringSoonCount}
            </p>
            <p className="mt-1 text-xs font-medium text-[#92400E] group-hover:underline underline-offset-2">
              Take these first · Click to filter
            </p>
          </button>
        </div>
      </div>
    </section>
  );
}
