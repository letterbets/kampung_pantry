import { useState, type FormEvent } from 'react';
import { Award, CheckCircle2, HeartHandshake } from 'lucide-react';
import type {
  DonorProfile,
  DonorType,
  InventoryResponse,
  ItemCondition,
  PantryCategory,
} from '../types/pantry';
import { estimateDonationPoints } from '../utils/formatters';

interface DonorLoggerProps {
  donors: DonorProfile[];
  onDonationLogged: (updatedInventory: InventoryResponse, message: string) => void;
}

const EXPIRY_PRESETS = [
  { label: '12 hours (Use Today)', hours: 12 },
  { label: '24 hours (1 day)', hours: 24 },
  { label: '48 hours (2 days)', hours: 48 },
  { label: '5 days (Fresh Chilled)', hours: 120 },
  { label: '60 days (Dried / Canned Staple)', hours: 1440 },
];

/**
 * Simple accessible form allowing residents and F&B vendors to log food donations
 * to Kampung Pantry, automatically awarding community reward points.
 */
export function DonorLogger({ donors, onDonationLogged }: DonorLoggerProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PantryCategory>('Fresh Produce');
  const [quantity, setQuantity] = useState(2);
  const [unit, setUnit] = useState('packs');
  const [expiryHours, setExpiryHours] = useState(48);
  const [condition, setCondition] = useState<ItemCondition>('Fresh');
  const [halal, setHalal] = useState(true);
  const [vegetarian, setVegetarian] = useState(true);
  const [donorName, setDonorName] = useState('');
  const [donorType, setDonorType] = useState<DonorType>('Resident');
  const [donorUnit, setDonorUnit] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const estimatedPoints = estimateDonationPoints(category, donorType, quantity);

  /** Validates form fields and posts new donation to /api/inventory/donate */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessBanner(null);

    if (name.trim().length < 2) {
      setError('Please enter the food item name (at least 2 characters).');
      return;
    }
    if (donorName.trim().length < 2) {
      setError('Please enter your name or F&B shop name.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/inventory/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          quantity,
          unit: unit.trim() || 'packs',
          expiryHours,
          condition,
          halal,
          vegetarian,
          donorName: donorName.trim(),
          donorType,
          donorUnit: donorUnit.trim() || 'Blk 412 Neighbourhood',
          notes: notes.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Could not log food donation.');
      }

      setSuccessBanner(data.message);
      onDonationLogged(data.inventory as InventoryResponse, data.message);

      // Reset item fields while preserving donor details for quick multi-item logging
      setName('');
      setNotes('');
      setQuantity(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error logging donation.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="donate-food"
      aria-labelledby="donate-food-heading"
      className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8"
    >
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-[#157A4C]">
          Residents, Hawkers &amp; F&amp;B Surplus Partners
        </p>
        <h2
          id="donate-food-heading"
          className="mt-1 font-display text-2xl font-bold tracking-tight text-[#13221A] sm:text-3xl"
        >
          Donor Contribution &amp; Kampung Points Logger
        </h2>
        <p className="mt-2 text-sm text-[#47554D]">
          Log surplus ingredients placed in the fridge or dry pantry rack. Every contribution earns
          Kampung Points recognized by Tampines North Zone 3 RN.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Donation Form */}
        <form
          onSubmit={handleSubmit}
          className="senior-border lg:col-span-7 rounded-xl border border-[#DCE5DF] bg-white p-5 sm:p-7"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="donor-item-name" className="block text-sm font-semibold text-[#13221A]">
                Food Item Name
              </label>
              <input
                id="donor-item-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fresh Kangkong, Jasmine Rice 1kg, Wholemeal Buns"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="donor-category" className="block text-sm font-semibold text-[#13221A]">
                Storage Category
              </label>
              <select
                id="donor-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as PantryCategory)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              >
                <option value="Fresh Produce">Fresh Produce (+25 pts)</option>
                <option value="Chilled & Protein">Chilled &amp; Protein (+25 pts)</option>
                <option value="Bakery Surplus">Bakery Surplus (+20 pts)</option>
                <option value="Dried Staples">Dried Staples (+15 pts)</option>
              </select>
            </div>

            <div>
              <label htmlFor="donor-condition" className="block text-sm font-semibold text-[#13221A]">
                Food Condition
              </label>
              <select
                id="donor-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              >
                <option value="Fresh">Fresh</option>
                <option value="Good">Good</option>
                <option value="Use Today">Use Today</option>
              </select>
            </div>

            <div>
              <label htmlFor="donor-qty" className="block text-sm font-semibold text-[#13221A]">
                Quantity
              </label>
              <input
                id="donor-qty"
                type="number"
                min={1}
                max={100}
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] tabular-nums focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="donor-unit" className="block text-sm font-semibold text-[#13221A]">
                Unit
              </label>
              <input
                id="donor-unit"
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="bunches, packs, loaves, cans"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="donor-expiry" className="block text-sm font-semibold text-[#13221A]">
                Best Consumed Within
              </label>
              <select
                id="donor-expiry"
                value={expiryHours}
                onChange={(e) => setExpiryHours(Number(e.target.value))}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              >
                {EXPIRY_PRESETS.map((preset) => (
                  <option key={preset.hours} value={preset.hours}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dietary Checkboxes */}
            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-1">
              <label className="inline-flex min-h-[44px] items-center gap-2.5 text-sm font-medium text-[#13221A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={halal}
                  onChange={(e) => setHalal(e.target.checked)}
                  className="h-5 w-5 rounded border-[#CBD6CE] accent-[#157A4C]"
                />
                <span>Halal-certified / Muslim-friendly</span>
              </label>
              <label className="inline-flex min-h-[44px] items-center gap-2.5 text-sm font-medium text-[#13221A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={vegetarian}
                  onChange={(e) => setVegetarian(e.target.checked)}
                  className="h-5 w-5 rounded border-[#CBD6CE] accent-[#157A4C]"
                />
                <span>Vegetarian</span>
              </label>
            </div>

            <div>
              <label htmlFor="donor-name" className="block text-sm font-semibold text-[#13221A]">
                Your Name or Shop Name
              </label>
              <input
                id="donor-name"
                type="text"
                required
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="e.g., Mdm Lim / Mei Hua Bakery"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="donor-type" className="block text-sm font-semibold text-[#13221A]">
                Contributor Role
              </label>
              <select
                id="donor-type"
                value={donorType}
                onChange={(e) => setDonorType(e.target.value as DonorType)}
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              >
                <option value="Resident">HDB Resident</option>
                <option value="F&B Vendor">F&amp;B Vendor Surplus (+15 bonus pts)</option>
                <option value="Grassroots Bulk">Grassroots Bulk Sponsor</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="donor-unit-num" className="block text-sm font-semibold text-[#13221A]">
                HDB Block / Unit or Shop Address (Optional)
              </label>
              <input
                id="donor-unit-num"
                type="text"
                value={donorUnit}
                onChange={(e) => setDonorUnit(e.target.value)}
                placeholder="e.g., Blk 412 #06-112"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="donor-notes" className="block text-sm font-semibold text-[#13221A]">
                Handling or Preparation Note (Optional)
              </label>
              <input
                id="donor-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Washed & packed, easy-open tin for seniors"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-[#CBD6CE] bg-[#F7F9F7] px-3.5 text-sm text-[#13221A] focus:border-[#157A4C] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-[#EDF2EE] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-[#13221A]">
              <Award className="h-5 w-5 text-[#157A4C]" aria-hidden="true" />
              <span>
                Estimated reward:{' '}
                <strong className="font-mono text-[#0E5A36] tabular-nums">
                  +{estimatedPoints} Kampung Points
                </strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#157A4C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0F5C38] disabled:opacity-60 whitespace-nowrap transition-colors cursor-pointer"
            >
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              <span>{submitting ? 'Logging Donation...' : 'Log Food Donation'}</span>
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-sm text-[#991B1B]"
            >
              {error}
            </div>
          )}

          {successBanner && (
            <div
              role="status"
              className="mt-4 flex items-start gap-2.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 text-sm font-medium text-[#065F46]"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{successBanner}</span>
            </div>
          )}
        </form>

        {/* Active Kampung Donors Leaderboard */}
        <aside className="senior-border lg:col-span-5 rounded-xl border border-[#DCE5DF] bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-[#EDF2EE] pb-4">
            <div>
              <h3 className="font-display text-lg font-bold text-[#13221A]">
                Active Kampung Donors
              </h3>
              <p className="text-xs text-[#47554D]">
                Points recognize neighbours &amp; F&amp;B partners reducing waste
              </p>
            </div>
            <Award className="h-5 w-5 text-[#157A4C]" aria-hidden="true" />
          </div>

          <ul className="divide-y divide-[#EDF2EE] mt-2">
            {donors.map((donor, idx) => (
              <li key={donor.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#13221A] truncate">
                    <span className="font-mono text-xs text-[#47554D] mr-2 tabular-nums">
                      #{idx + 1}
                    </span>
                    {donor.name}
                  </p>
                  <p className="mt-0.5 text-xs text-[#47554D] truncate">
                    {donor.type} · {donor.blockOrUnit} · {donor.contributions}{' '}
                    {donor.contributions === 1 ? 'drop-off' : 'drop-offs'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-semibold text-[#0E5A36] tabular-nums">
                    {donor.points} pts
                  </p>
                  <p className="text-xs text-[#47554D]">{donor.lastDonatedAt}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
