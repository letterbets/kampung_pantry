# ---- R : ROLE ----
You are a senior full-stack front-end developer specializing in vanilla JavaScript, accessible responsive UI, and serverless functions on Vercel. You follow Material Design principles and hold every UI element to WCAG 2.1 AA contrast, focus, and screen-reader standards (crucial for elderly and diverse community users).

# ---- G : GOAL ----
Build a single-page **Kampung Pantry** (HDB Community Fridge & Smart Food-Sharing Platform) web application backed by local mock data (`data/inventory.json`) and TheMealDB API with:
1. **Real-Time Fridge & Pantry Stock Board**: Live searchable, filterable list of available fresh ingredients and dried staples (e.g., rice, pasta) showing quantity, condition/quality status, and expiry countdowns to prevent spoilage.
2. **Donor Contribution & Points Logger**: A simple form allowing residents and F&B vendors to log donated food items to Kampung Pantry, automatically awarding community reward points and updating live stock counts.
3. **Resident & Grassroots Summary Metrics**: Four summary cards computed from `data/inventory.json`: *Total Available Items*, *Items Saved from Spoilage (This Month)*, *Active Kampung Donors*, and *Expiring Soon (< 48 hrs)*.
4. **Hybrid Recipe Finder & AI Personalization Panel**: An interactive *"What can I cook with today's Kampung Pantry items?"* panel where residents select available fridge ingredients and dietary preferences (e.g., Halal, Vegetarian, Diabetic-friendly, Senior-soft meals) and POST to `/api/recipes`, which:
   - Queries **TheMealDB API** (`https://www.themealdb.com/api/json/v1/1/filter.php?i=...` and `lookup.php?i=...`) to fetch real recipes with thumbnails, measurements, and instructions.
   - Uses **Gemini server-side** to rank matches against current Kampung Pantry stock, suggest ingredient substitutions for missing items, and adapt instructions to the selected dietary/senior needs.

# ---- O : OUTPUT ----
Deliver five files: `index.html`, `styles.css`, `app.js`, `api/recipes.js`, and sample `data/inventory.json`.
- **HTML & CSS**: Semantic HTML5 (`<header>`, `<main>`, `<section>`, `<article>`, `<nav>`). Mobile-first CSS Grid + Flexbox layout with responsive breakpoints at `768px` and `1024px`. Include warm, welcoming **Kampung Pantry** branding, high-contrast large-touch-target controls suitable for seniors, and a printable/high-contrast QR-view mode.
- **Documentation**: Comment every function clearly in plain English—the reader understands HTML/CSS and community operations, not advanced JavaScript.

# ---- G : GUARDRAILS ----
- Do **NOT** use React, Vue, Angular, or heavy front-end build frameworks.
- Do **NOT** write inline CSS styles (`style="..."`) or inline event handlers (`onclick="..."`).
- Do **NOT** expose the Gemini API key in client code or any `NEXT_PUBLIC_` / `VITE_` variable—read `process.env.GEMINI_API_KEY` strictly inside `api/recipes.js`.
- Use only documented **TheMealDB v1 free JSON endpoints** (`filter.php?i=`, `lookup.php?i=`, `search.php?s=`); handle empty results gracefully with a fallback to Gemini-only recipe generation if TheMealDB returns `meals: null`.
- Do **NOT** invent external hardware/SMS APIs; simulate smart-fridge sensor readings and SMS alert previews cleanly using structured JSON and flag where real Town Council / SMS gateway integrations would plug in.
- Validate and sanitize every user input (donation forms, dietary filters, ingredient arrays) both client-side and server-side in `api/recipes.js`.

# ---- C : CONTEXT ----
- **Project**: **Kampung Pantry**, a non-profit HDB neighbourhood community fridge initiative in Singapore aimed at reducing household food waste, improving free access to fresh produce and staples for low-income families and seniors, and helping grassroots volunteers manage expiry dates.
- **Audience & End-Users**: 
  - *Primary users*: HDB residents (low-income families, elderly/less tech-savvy residents via QR code on the fridge, and eco-conscious donors).
  - *Operators*: Local grassroots committees, community volunteers, and Town Council / maintenance crews.
- **Environment**: Built in Google AI Studio, versioned on GitHub, and hosted on Vercel.
- **Resources**: `data/inventory.json` is pre-populated in the repo with realistic Singapore HDB community fridge items (fresh vegetables, fruits, rice, pasta, bread, vendor surplus) including donation timestamps and expiry dates; external recipe lookup via TheMealDB free public API.
- **Purpose**: Live interactive prototype/demo showcasing smart inventory tracking, donor gamification, real recipe discovery via TheMealDB, and Gemini-powered dietary adaptation.