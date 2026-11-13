import { Eye, QrCode } from 'lucide-react';

export type AppPage = 'stock' | 'recipes' | 'donate' | 'community';

interface HeaderProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  seniorMode: boolean;
  onToggleSeniorMode: () => void;
  selectedRecipeCount: number;
}

const NAV_ITEMS: Array<{ id: AppPage; label: string }> = [
  { id: 'stock', label: 'Stock Board' },
  { id: 'recipes', label: 'Recipe Finder' },
  { id: 'donate', label: 'Donate Food' },
  { id: 'community', label: 'Community' },
];

/**
 * Top navigation bar following the 3-zone contract:
 * Zone 1: Brand wordmark | Zone 2: 4 concise page links | Zone 3: 1 primary action
 */
export function Header({
  activePage,
  onNavigate,
  seniorMode,
  onToggleSeniorMode,
  selectedRecipeCount,
}: HeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[#DCE5DF] bg-[#FFFFFF]/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => onNavigate('stock')}
            className="font-display text-xl font-bold tracking-tight text-[#13221A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Kampung Pantry
          </button>

          <nav
            aria-label="Primary page navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isActive
                      ? 'font-semibold text-[#157A4C] underline decoration-2 underline-offset-8'
                      : 'text-[#47554D] hover:text-[#13221A] hover:underline underline-offset-8'
                  }`}
                >
                  {item.id === 'recipes' && selectedRecipeCount > 0
                    ? `${item.label} (${selectedRecipeCount})`
                    : item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onToggleSeniorMode}
              aria-pressed={seniorMode}
              className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                seniorMode
                  ? 'bg-[#13221A] text-white hover:bg-[#1F3529]'
                  : 'bg-[#157A4C] text-white hover:bg-[#0F5C38]'
              }`}
            >
              {seniorMode ? (
                <QrCode className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{seniorMode ? 'Standard View' : 'Senior & QR Mode'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Non-sticky mobile page switcher so sticky header stays compact */}
      <nav
        aria-label="Mobile page navigation"
        className="no-print flex md:hidden items-center gap-1 overflow-x-auto border-b border-[#DCE5DF] bg-white px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`min-h-[40px] rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#E8F5EE] font-semibold text-[#0E5A36]'
                  : 'text-[#47554D] hover:bg-[#F1F5F2]'
              }`}
            >
              {item.id === 'recipes' && selectedRecipeCount > 0
                ? `${item.label} (${selectedRecipeCount})`
                : item.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
