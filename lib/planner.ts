export type Slot = "breakfast" | "lunch" | "dinner";
export type Energy = "exhausted" | "normal" | "energetic";

export type PlannerInput = {
  people: number;
  budgetInr: number;
  pantry: string;
  restrictions: string;
  appliances: string[];
  effort: "low" | "medium";
  energy: Energy;
  windows: Record<Slot, { at: string; minutes: number }>;
};

export type Meal = {
  slot: Slot;
  name: string;
  why: string;
  activeMinutes: number;
  reuseNote: string;
};

export type TimelineTask = {
  slot: Slot;
  offsetMinutesBeforeMeal: number;
  durationMinutes: number;
  task: string;
  parallelWith?: string;
  at?: string;
};

export type Grocery = {
  name: string;
  quantity: string;
  estimatedPriceInr: number;
  reason: string;
};

export type Substitution = {
  ingredient: string;
  swap: string;
  savingInr: number;
  reason: string;
};

export type Plan = {
  source: "gemini" | "demo";
  notice?: string;
  meals: Meal[];
  timeline: TimelineTask[];
  groceries: Grocery[];
  substitutions: Substitution[];
  leftoverPlan: string;
  summary: {
    estimatedAdditionalSpendInr: number;
    budgetInr: number;
    budgetStatus: "within" | "over" | "impossible";
    budgetGapInr: number;
    activeCookingMinutes: number;
    minutesSaved: number;
    reusedIngredients: number;
    pans: number;
    efficiencyScore: number;
    pricingNote: string;
  };
};

export const defaultInput: PlannerInput = {
  people: 1,
  budgetInr: 350,
  pantry:
    "poha, cooked rice, raw rice, moong dal, onion, tomato, curd, basic masalas, salt, cooking oil",
  restrictions: "Strict vegetarian; no eggs",
  appliances: ["Gas stove", "Microwave"],
  effort: "low",
  energy: "normal",
  windows: {
    breakfast: { at: "08:00", minutes: 15 },
    lunch: { at: "13:00", minutes: 10 },
    dinner: { at: "19:45", minutes: 35 },
  },
};

const blockedFoods = /\b(egg|eggs|chicken|mutton|fish|prawn|beef|pork|gelatin|meat|seafood)\b/i;
const slots: Slot[] = ["breakfast", "lunch", "dinner"];

function has(pantry: string, item: string) {
  return pantry.toLowerCase().includes(item.toLowerCase());
}

function formatClock(value: string, offset = 0) {
  const [hours, minutes] = value.split(":").map(Number);
  const total = (hours * 60 + minutes - offset + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function addTimes(tasks: TimelineTask[], input: PlannerInput) {
  return tasks
    .filter((task) => slots.includes(task.slot) && Number.isFinite(task.offsetMinutesBeforeMeal) && Number.isFinite(task.durationMinutes))
    .map((task) => ({
      ...task,
      // ponytail: clamp model timing instead of maintaining a scheduling engine; upgrade to interval validation if tasks gain dependencies.
      offsetMinutesBeforeMeal: Math.max(0, Math.min(input.windows[task.slot].minutes, Math.round(task.offsetMinutesBeforeMeal))),
      durationMinutes: Math.max(1, Math.min(input.windows[task.slot].minutes, Math.round(task.durationMinutes))),
      at: formatClock(input.windows[task.slot].at, Math.max(0, Math.min(input.windows[task.slot].minutes, Math.round(task.offsetMinutesBeforeMeal)))),
    }))
    .sort((a, b) => {
      const slotOrder = slots.indexOf(a.slot) - slots.indexOf(b.slot);
      return slotOrder || b.offsetMinutesBeforeMeal - a.offsetMinutesBeforeMeal;
    });
}

function summaryFor(
  input: PlannerInput,
  meals: Meal[],
  groceries: Grocery[],
  timeline: TimelineTask[],
) {
  const spend = groceries.reduce((sum, item) => sum + item.estimatedPriceInr, 0);
  const gap = Math.max(0, spend - input.budgetInr);
  const pantryIsEmpty = input.pantry.trim().length < 3;
  const status = gap === 0 ? "within" : pantryIsEmpty && input.budgetInr < 80 ? "impossible" : "over";
  const active = meals.reduce((sum, meal) => sum + meal.activeMinutes, 0);
  const parallel = timeline.filter((task) => task.parallelWith).reduce((sum, task) => sum + task.durationMinutes, 0);
  const reused = meals.filter((meal) => /reuse|leftover|already|same/i.test(meal.reuseNote)).length;
  const score = Math.max(
    35,
    Math.min(98, 70 + parallel + reused * 5 + (status === "within" ? 8 : -15) - (active > 55 ? 6 : 0)),
  );

  return {
    estimatedAdditionalSpendInr: spend,
    budgetInr: input.budgetInr,
    budgetStatus: status as "within" | "over" | "impossible",
    budgetGapInr: gap,
    activeCookingMinutes: active,
    minutesSaved: parallel + reused * 3,
    reusedIngredients: reused,
    pans: input.appliances.includes("Microwave") ? 2 : 3,
    efficiencyScore: score,
    pricingNote: "Indicative India-wide prices, not live store quotes.",
  };
}

export function finalisePlan(
  input: PlannerInput,
  candidate: Omit<Plan, "summary">,
): Plan {
  const meals = slots.map((slot) => candidate.meals.find((meal) => meal.slot === slot)).filter(Boolean) as Meal[];
  if (meals.length !== 3 || blockedFoods.test(JSON.stringify(candidate))) {
    throw new Error("Plan failed vegetarian safety checks.");
  }
  if (meals.some((meal) => meal.activeMinutes > input.windows[meal.slot].minutes)) {
    throw new Error("Plan does not fit the available cooking windows.");
  }
  const groceries = candidate.groceries
    .filter((item) => !has(input.pantry, item.name))
    .map((item) => ({
      ...item,
      estimatedPriceInr: Math.max(0, Math.round(Number(item.estimatedPriceInr) || 0)),
    }));
  const timeline = addTimes(candidate.timeline, input);
  return {
    ...candidate,
    meals,
    timeline,
    groceries,
    substitutions: candidate.substitutions.map((item) => ({ ...item, savingInr: Math.max(0, Math.round(Number(item.savingInr) || 0)) })),
    summary: summaryFor(input, meals, groceries, timeline),
  };
}

export function createDemoPlan(input: PlannerInput = defaultInput, notice?: string): Plan {
  const exhausted = input.energy === "exhausted";
  const breakfastMinutes = Math.min(input.windows.breakfast.minutes, exhausted ? 8 : 13);
  const lunchMinutes = Math.min(input.windows.lunch.minutes, 8);
  const dinnerMinutes = Math.min(input.windows.dinner.minutes, exhausted ? 18 : 24);
  const peanutAllergy = /peanut|groundnut/i.test(input.restrictions);
  const hasMicrowave = input.appliances.includes("Microwave");

  const meals: Meal[] = [
    {
      slot: "breakfast",
      name: exhausted ? "No-chop lemon poha" : "Vegetable poha",
      why: exhausted
        ? "You marked today exhausting, so this uses one pan and almost no prep."
        : `It fits your ${input.windows.breakfast.minutes}-minute window and starts the day with pantry staples.`,
      activeMinutes: breakfastMinutes,
      reuseNote: "Chop extra onion and tomato now; reuse them at dinner.",
    },
    {
      slot: "lunch",
      name: "Tomato-curd rice bowl",
      why: `Your lunch window is only ${input.windows.lunch.minutes} minutes, so cooked rice beats a fresh stovetop meal.`,
      activeMinutes: lunchMinutes,
      reuseNote: "Uses already-cooked rice and the same tomato-curd base as dinner's raita.",
    },
    {
      slot: "dinner",
      name: exhausted ? "One-pot moong dal khichdi" : "Moong dal khichdi + cucumber raita",
      why: exhausted
        ? "One pot keeps both effort and washing up low after work."
        : "A hands-off simmer lets you make raita in parallel and stay inside the dinner window.",
      activeMinutes: dinnerMinutes,
      reuseNote: "Reuses breakfast's chopped onion and tomato; reserve one portion for tomorrow.",
    },
  ];

  const timeline: TimelineTask[] = [
    { slot: "breakfast", offsetMinutesBeforeMeal: breakfastMinutes, durationMinutes: 3, task: hasMicrowave ? "Rinse poha; microwave a splash of water." : "Rinse poha and drain it well." },
    { slot: "breakfast", offsetMinutesBeforeMeal: Math.max(5, breakfastMinutes - 3), durationMinutes: 4, task: exhausted ? "Temper masala and fold in poha." : "Chop extra onion and tomato; store half for dinner." },
    { slot: "breakfast", offsetMinutesBeforeMeal: 4, durationMinutes: 4, task: "Cook poha, finish with lemon, and plate." },
    { slot: "lunch", offsetMinutesBeforeMeal: lunchMinutes, durationMinutes: 3, task: hasMicrowave ? "Microwave cooked rice until steaming." : "Reheat cooked rice, covered, on the stove." },
    { slot: "lunch", offsetMinutesBeforeMeal: Math.max(3, lunchMinutes - 3), durationMinutes: 3, task: "Mix curd, tomato, salt, and masala." },
    { slot: "lunch", offsetMinutesBeforeMeal: 2, durationMinutes: 2, task: "Assemble the bowl and pack the spoon." },
    { slot: "dinner", offsetMinutesBeforeMeal: dinnerMinutes, durationMinutes: 6, task: "Rinse rice and moong dal; add stored vegetables." },
    { slot: "dinner", offsetMinutesBeforeMeal: Math.max(10, dinnerMinutes - 6), durationMinutes: 7, task: "Temper, add water, and bring the khichdi to a simmer." },
    { slot: "dinner", offsetMinutesBeforeMeal: 10, durationMinutes: exhausted ? 4 : 7, task: exhausted ? "Set out curd and clean the board." : "While khichdi simmers, grate cucumber and make raita.", parallelWith: "Khichdi simmer" },
    { slot: "dinner", offsetMinutesBeforeMeal: 3, durationMinutes: 3, task: "Season, portion dinner, and refrigerate one serving." },
  ];

  const wanted: Grocery[] = [
    { name: "peanuts", quantity: "100 g", estimatedPriceInr: 18, reason: "Breakfast crunch and protein" },
    { name: "cucumber", quantity: "1 medium", estimatedPriceInr: 20, reason: "Quick dinner raita" },
    { name: "lemon", quantity: "2", estimatedPriceInr: 12, reason: "Brightens breakfast and lunch" },
    { name: "coriander", quantity: "1 small bunch", estimatedPriceInr: 10, reason: "Fresh finish across meals" },
    { name: "poha", quantity: "500 g", estimatedPriceInr: 40, reason: "Breakfast staple" },
    { name: "rice", quantity: "1 kg", estimatedPriceInr: 65, reason: "Lunch and dinner base" },
    { name: "moong dal", quantity: "500 g", estimatedPriceInr: 75, reason: "Dinner protein" },
    { name: "onion", quantity: "500 g", estimatedPriceInr: 25, reason: "Shared prep" },
    { name: "tomato", quantity: "500 g", estimatedPriceInr: 30, reason: "Shared prep" },
    { name: "curd", quantity: "400 g", estimatedPriceInr: 40, reason: "Lunch and dinner" },
    { name: "cooking oil", quantity: "500 ml", estimatedPriceInr: 75, reason: "Cooking essential" },
  ];
  const groceries = wanted.filter((item) => !(peanutAllergy && item.name === "peanuts"));
  if (peanutAllergy && !has(input.pantry, "roasted chana")) {
    groceries.unshift({ name: "roasted chana", quantity: "100 g", estimatedPriceInr: 12, reason: "Peanut-free breakfast crunch" });
  }

  return finalisePlan(input, {
    source: "demo",
    notice,
    meals,
    timeline,
    groceries,
    substitutions: [
      { ingredient: "Peanuts", swap: "Roasted chana", savingInr: 6, reason: "Similar crunch; also handles peanut avoidance." },
      { ingredient: "Cucumber", swap: "Onion-tomato raita", savingInr: 20, reason: "Uses the prep already done at breakfast." },
      { ingredient: "Moong dal", swap: "Masoor dal", savingInr: 5, reason: "Usually cheaper and cooks quickly." },
    ],
    leftoverPlan: "Refrigerate one khichdi portion tonight; loosen with water for tomorrow's 6-minute breakfast.",
  });
}

export function validateInput(value: unknown): PlannerInput {
  if (!value || typeof value !== "object") throw new Error("Please complete the planner form.");
  const input = value as PlannerInput;
  if (!Number.isInteger(input.people) || input.people < 1 || input.people > 8) throw new Error("People must be between 1 and 8.");
  if (!Number.isFinite(input.budgetInr) || input.budgetInr < 0 || input.budgetInr > 5000) throw new Error("Budget must be between ₹0 and ₹5,000.");
  if (!input.windows || slots.some((slot) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.windows[slot]?.at) || !Number.isInteger(input.windows[slot].minutes) || input.windows[slot].minutes < 5 || input.windows[slot].minutes > 90)) throw new Error("Each meal needs a valid time and a 5–90 minute window.");
  if (typeof input.pantry !== "string" || input.pantry.length > 500 || typeof input.restrictions !== "string" || input.restrictions.length > 300) throw new Error("Pantry or restriction text is too long.");
  if (!Array.isArray(input.appliances) || input.appliances.length > 2 || input.appliances.some((item) => !["Gas stove", "Microwave"].includes(item))) throw new Error("Choose only supported appliances.");
  if (!["low", "medium"].includes(input.effort) || !["exhausted", "normal", "energetic"].includes(input.energy)) throw new Error("Choose a valid effort and energy level.");
  return input;
}
