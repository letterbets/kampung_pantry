import { useEffect, useState } from 'react';
import { Check, ChefHat, Clock, Printer, Sparkles, UtensilsCrossed } from 'lucide-react';
import type {
  DietaryPreference,
  PantryItem,
  RecipeApiResponse,
  RecipeSuggestion,
} from '../types/pantry';
import { getExpiryStatus } from '../utils/formatters';
import { safeFetchJson } from '../utils/api';

interface RecipeFinderProps {
  availableItems: PantryItem[];
  selectedIngredients: string[];
  onToggleIngredient: (name: string) => void;
  onSelectExpiringSoon: () => void;
  onClearIngredients: () => void;
}

const DIETARY_OPTIONS: DietaryPreference[] = [
  'Halal',
  'Vegetarian',
  'Diabetic-friendly',
  'Senior-soft meals',
  'Low-sodium',
];

/**
 * Renders a resilient recipe thumbnail from TheMealDB with an automatic
 * fallback SVG dish illustration if an image is unavailable or blocked.
 */
function RecipeThumbnail({
  src,
  title,
}: {
  src?: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-label={`${title} dish illustration`}
        className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-[#EDF4EF] p-6 text-center"
      >
        <UtensilsCrossed className="h-10 w-10 text-[#157A4C]" aria-hidden="true" />
        <p className="mt-2 font-display text-sm font-semibold text-[#13221A]">{title}</p>
        <p className="mt-0.5 text-xs text-[#47554D]">Kampung Pantry Kitchen Card</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

/**
 * Interactive "What can I cook with today's Kampung Pantry items?" panel.
 * Posts selected fridge ingredients and dietary needs to /api/recipes
 * (TheMealDB lookup + server-side Gemini ranking and dietary adaptation).
 */
export function RecipeFinder({
  availableItems,
  selectedIngredients,
  onToggleIngredient,
  onSelectExpiringSoon,
  onClearIngredients,
}: RecipeFinderProps) {
  const [dietaryPreferences, setDietaryPreferences] = useState<DietaryPreference[]>(['Halal']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecipeApiResponse | null>(null);

  const [mealDbCategories, setMealDbCategories] = useState<
    Array<{ idCategory: string; strCategory: string; strCategoryThumb: string }>
  >([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categoryMeals, setCategoryMeals] = useState<
    Array<{ idMeal: string; strMeal: string; strMealThumb?: string }>
  >([]);

  useEffect(() => {
    safeFetchJson<{
      categories: Array<{ idCategory: string; strCategory: string; strCategoryThumb: string }>;
    }>('/api/mealdb')
      .then((data) => {
        setMealDbCategories((data.categories || []).slice(0, 8));
      })
      .catch(() => {});
  }, []);

  /** Loads sample recipes for a clicked TheMealDB category via /api/mealdb?category=... */
  async function handleSelectMealDbCategory(categoryName: string) {
    setActiveCategory(categoryName);
    try {
      const data = await safeFetchJson<{
        mealsInCategory: Array<{ idMeal: string; strMeal: string; strMealThumb?: string }>;
      }>(`/api/mealdb?category=${encodeURIComponent(categoryName)}`);
      setCategoryMeals(data.mealsInCategory || []);
    } catch {
      setCategoryMeals([]);
    }
  }

  /** Toggles a dietary requirement checkbox button cleanly */
  function toggleDietary(pref: DietaryPreference) {
    setDietaryPreferences((prev) =>
      prev.includes(pref) ? prev.filter((item) => item !== pref) : [...prev, pref],
    );
  }

  /** Sends selected ingredients & dietary needs to /api/recipes */
  async function handleGenerateRecipes() {
    if (selectedIngredients.length === 0) {
      setError('Please pick at least 1 ingredient from today’s fridge stock first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await safeFetchJson<RecipeApiResponse>('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredients: selectedIngredients,
          dietaryPreferences,
        }),
      });

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the recipe service right now. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="recipe-finder"
      aria-labelledby="recipe-finder-heading"
      className="bg-white py-8"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#157A4C]">
            TheMealDB + AI Dietary Personalization
          </p>
          <h2
            id="recipe-finder-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-[#13221A] sm:text-3xl [text-wrap:balance]"
          >
            What can I cook with today&apos;s Kampung Pantry items?
          </h2>
          <p className="mt-2 text-sm text-[#47554D] leading-relaxed">
            Pick ingredients currently in the fridge (prioritizing items expiring soon) and select
            household dietary needs. We fetch real recipes from TheMealDB and adapt substitutions
            and preparation steps for your family.
          </p>
        </div>

        {/* Ingredient & Dietary Selection Workspace */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="senior-border rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#13221A]">
                  1. Select Available Pantry Items ({selectedIngredients.length})
                </h3>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={onSelectExpiringSoon}
                    className="text-[#B45309] hover:underline underline-offset-2 cursor-pointer"
                  >
                    Auto-pick expiring soon
                  </button>
                  {selectedIngredients.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearIngredients}
                      className="text-[#47554D] hover:text-[#13221A] hover:underline underline-offset-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {availableItems.map((item) => {
                  const selected = selectedIngredients.includes(item.name);
                  const expiry = getExpiryStatus(item.expiresAt);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleIngredient(item.name)}
                      aria-pressed={selected}
                      className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#157A4C] bg-[#157A4C] text-white'
                          : expiry.urgency !== 'normal'
                            ? 'border-[#E7CFA6] bg-[#FFFBEB] text-[#78350F] hover:border-[#B45309]'
                            : 'border-[#CBD6CE] bg-white text-[#13221A] hover:bg-[#EDF2EE]'
                      }`}
                    >
                      {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-6 font-display text-base font-bold text-[#13221A]">
                2. Dietary &amp; Senior Preferences
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((pref) => {
                  const active = dietaryPreferences.includes(pref);
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => toggleDietary(pref)}
                      aria-pressed={active}
                      className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-[#13221A] bg-[#13221A] text-white'
                          : 'border-[#CBD6CE] bg-white text-[#47554D] hover:bg-[#EDF2EE]'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                      <span>{pref}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleGenerateRecipes}
                disabled={loading}
                className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#157A4C] px-5 py-3 text-base font-semibold text-white hover:bg-[#0F5C38] disabled:opacity-60 transition-colors cursor-pointer"
              >
                <ChefHat className="h-5 w-5" aria-hidden="true" />
                <span>{loading ? 'Finding & Adapting Recipes...' : 'Find Adapted Recipes'}</span>
              </button>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-sm text-[#991B1B]"
                >
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Recipe Results Panel */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-64 animate-pulse rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-6"
                  />
                ))}
              </div>
            ) : !result ? (
              <div className="flex h-full min-h-[320px] flex-col justify-between rounded-xl border border-[#DCE5DF] bg-[#F7F9F7] p-6 sm:p-8">
                <div className="text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-[#157A4C]" aria-hidden="true" />
                  <h3 className="mt-3 font-display text-xl font-bold text-[#13221A]">
                    Ready to turn pantry surplus into dinner
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-[#47554D]">
                    Select ingredients on the left (or click &ldquo;Cook This&rdquo; on any item in
                    the Stock Board), choose your dietary filters, and press{' '}
                    <strong className="text-[#13221A]">Find Adapted Recipes</strong>.
                  </p>
                </div>

                {mealDbCategories.length > 0 && (
                  <div className="mt-6 border-t border-[#DCE5DF] pt-5">
                    <p className="text-xs font-semibold text-[#47554D]">
                      Browse Live TheMealDB Categories (via /api/mealdb)
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {mealDbCategories.map((cat) => (
                        <button
                          key={cat.idCategory}
                          type="button"
                          onClick={() => handleSelectMealDbCategory(cat.strCategory)}
                          aria-pressed={activeCategory === cat.strCategory}
                          className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                            activeCategory === cat.strCategory
                              ? 'border-[#157A4C] bg-[#E8F5EE] text-[#0E5A36]'
                              : 'border-[#CBD6CE] bg-white text-[#13221A] hover:bg-[#EDF2EE]'
                          }`}
                        >
                          {cat.strCategory}
                        </button>
                      ))}
                    </div>

                    {activeCategory && categoryMeals.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {categoryMeals.slice(0, 4).map((meal) => (
                          <div
                            key={meal.idMeal}
                            className="flex items-center gap-3 rounded-lg border border-[#DCE5DF] bg-white p-2.5"
                          >
                            {meal.strMealThumb && (
                              <img
                                src={meal.strMealThumb}
                                alt={meal.strMeal}
                                referrerPolicy="no-referrer"
                                className="h-11 w-11 shrink-0 rounded object-cover"
                              />
                            )}
                            <p className="text-xs font-semibold text-[#13221A] line-clamp-2">
                              {meal.strMeal}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE5DF] pb-3">
                  <p className="text-sm font-medium text-[#47554D]">{result.note}</p>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#CBD6CE] bg-white px-3 py-1.5 text-xs font-semibold text-[#13221A] hover:bg-[#F1F5F2] cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Print Recipes</span>
                  </button>
                </div>

                {result.recipes.map((recipe: RecipeSuggestion) => (
                  <article
                    key={recipe.id}
                    className="senior-border overflow-hidden rounded-xl border border-[#DCE5DF] bg-white"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12">
                      <div className="md:col-span-4 bg-[#EDF4EF]">
                        <RecipeThumbnail src={recipe.thumbnailUrl} title={recipe.title} />
                      </div>

                      <div className="p-5 sm:p-6 md:col-span-8">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#47554D]">
                          <span className="text-[#157A4C] font-semibold">{recipe.source}</span>
                          {recipe.area && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{recipe.area}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {recipe.prepTimeMinutes} mins
                          </span>
                        </div>

                        <h3 className="mt-1.5 font-display text-xl font-bold text-[#13221A]">
                          {recipe.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-[#0E5A36]">
                          {recipe.pantryMatchSummary}
                        </p>

                        {/* Dietary Adaptation Summary */}
                        <div className="mt-3 rounded-lg border border-[#DCE5DF] bg-[#F7F9F7] p-3.5 text-sm text-[#13221A]">
                          <p className="font-semibold">Dietary &amp; Senior Adaptation</p>
                          <p className="mt-0.5 text-[#47554D]">{recipe.dietaryAdaptationNotes}</p>
                        </div>

                        {/* Smart Substitutions from Kampung Pantry */}
                        {recipe.smartSubstitutions.length > 0 && (
                          <div className="mt-3 text-sm">
                            <p className="font-semibold text-[#13221A]">
                              Smart Pantry Substitutions:
                            </p>
                            <ul className="mt-1 list-disc pl-5 text-[#47554D] space-y-0.5">
                              {recipe.smartSubstitutions.map((sub, idx) => (
                                <li key={idx}>{sub}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ingredients & Large-Print Instructions */}
                    <div className="grid grid-cols-1 gap-6 border-t border-[#EDF2EE] bg-[#FAFBF9] p-5 sm:grid-cols-12 sm:p-6">
                      <div className="sm:col-span-4">
                        <h4 className="font-display text-sm font-bold text-[#13221A]">
                          Ingredients Needed
                        </h4>
                        <ul className="mt-2 space-y-1.5 text-sm text-[#47554D]">
                          {recipe.ingredientsWithMeasures.map((ing, idx) => (
                            <li key={idx} className="leading-snug">
                              • {ing}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="sm:col-span-8">
                        <h4 className="font-display text-sm font-bold text-[#13221A]">
                          Step-by-Step Cooking Guide
                        </h4>
                        <ol className="mt-2 space-y-2 text-sm text-[#13221A]">
                          {recipe.instructions.map((step, idx) => (
                            <li key={idx} className="flex gap-2.5 leading-relaxed">
                              <span className="font-mono text-xs font-semibold text-[#157A4C] pt-0.5 tabular-nums">
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
