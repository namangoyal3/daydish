# DayDish — AI Cooking Day Planner

DayDish turns a person’s real day into three Indian vegetarian meals, an executable cooking timeline, one grocery list, ingredient swaps, and a deterministic budget check. Its differentiator is schedule-aware shared prep: it plans around the minutes available before each meal instead of returning three unrelated recipes.

## Run locally

Requires Node.js 22.13+.

```bash
npm install
export GEMINI_API_KEY="your-key" # optional; validated demo fallback works without it
npm run dev
```

Open the shown local URL, adjust the day, then choose **Create my cooking day**.

## Quality checks

```bash
npm run lint
npm test
npx next build
```

Gemini proposes meals, reasons, shared prep, substitutions, and a structured timeline. Application code—not the model—validates the trust-boundary input, rejects non-vegetarian output and overlong meal plans, removes pantry items, calculates grocery spend and budget status, and falls back safely when AI output fails. Prices are clearly labelled indicative India-wide estimates, not live store quotes.

Built for Google PromptWars. Strictly Indian lacto-vegetarian; eggs are excluded.
