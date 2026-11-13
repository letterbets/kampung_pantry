import type { DonorType, PantryCategory } from '../types/pantry';

export interface ExpiryStatusInfo {
  label: string;
  hoursRemaining: number;
  urgency: 'urgent' | 'soon' | 'normal';
}

/**
 * Converts an ISO expiry timestamp into a plain-English countdown
 * and an urgency classification for residents and volunteers.
 */
export function getExpiryStatus(expiresAtIso: string): ExpiryStatusInfo {
  const diffMs = new Date(expiresAtIso).getTime() - Date.now();
  const hoursRemaining = Math.max(0, Math.round(diffMs / (3600 * 1000)));

  if (hoursRemaining <= 0) {
    return {
      label: 'Check condition now',
      hoursRemaining: 0,
      urgency: 'urgent',
    };
  }
  if (hoursRemaining < 24) {
    return {
      label: `${hoursRemaining}h left · Use today`,
      hoursRemaining,
      urgency: 'urgent',
    };
  }
  if (hoursRemaining <= 48) {
    return {
      label: `${hoursRemaining}h left · Expiring soon`,
      hoursRemaining,
      urgency: 'soon',
    };
  }

  const days = Math.floor(hoursRemaining / 24);
  if (days >= 30) {
    const months = Math.floor(days / 30);
    return {
      label: `${months} ${months === 1 ? 'month' : 'months'} shelf life`,
      hoursRemaining,
      urgency: 'normal',
    };
  }

  return {
    label: `${days} ${days === 1 ? 'day' : 'days'} left`,
    hoursRemaining,
    urgency: 'normal',
  };
}

/**
 * Formats an ISO donation timestamp into a friendly relative time label.
 */
export function formatRelativeDonationTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Mirrors server-side reward point rules so donors can preview
 * the Kampung Points they will earn before submitting.
 */
export function estimateDonationPoints(
  category: PantryCategory,
  donorType: DonorType,
  quantity: number,
): number {
  const basePoints =
    category === 'Fresh Produce' || category === 'Chilled & Protein'
      ? 25
      : category === 'Bakery Surplus'
        ? 20
        : 15;
  const vendorBonus = donorType === 'F&B Vendor' ? 15 : 0;
  const quantityBonus = Math.min(20, Math.max(0, Math.round(quantity) - 1) * 5);
  return basePoints + vendorBonus + quantityBonus;
}
