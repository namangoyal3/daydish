"use client";

import { useEffect, useState } from "react";
import { createDemoPlan, defaultInput, type Plan, type PlannerInput, type Slot } from "@/lib/planner";

const mealLabels: Record<Slot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const slotIcons: Record<Slot, string> = { breakfast: "☀", lunch: "◐", dinner: "☾" };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function Home() {
  const [input, setInput] = useState<PlannerInput>(defaultInput);
  const [plan, setPlan] = useState<Plan>(() => createDemoPlan(defaultInput));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading) return;
    const stages = ["Finding the best meal fit…", "Overlapping kitchen tasks…", "Checking every rupee…"];
    let index = 0;
    const timer = window.setInterval(() => setMessage(stages[++index % stages.length]), 900);
    return () => window.clearInterval(timer);
  }, [loading]);

  function updateWindow(slot: Slot, key: "at" | "minutes", value: string) {
    setInput((current) => ({ ...current, windows: { ...current.windows, [slot]: { ...current.windows[slot], [key]: key === "minutes" ? Number(value) : value } } }));
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Finding the best meal fit…");
    setLoading(true);
    try {
      const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const data = await response.json() as Plan & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not create a plan.");
      setPlan(data);
      setMessage(data.notice || (data.source === "gemini" ? "Fresh plan created with Gemini." : "Plan ready."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create a plan.");
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = plan.summary.budgetStatus === "within" ? "Within budget" : plan.summary.budgetStatus === "over" ? `₹${plan.summary.budgetGapInr} over budget` : "Budget not feasible";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="DayDish home"><span className="brand-mark">D</span><span>DayDish<small>DAILY KITCHEN COPILOT</small></span></a>
        <div className="veg-badge"><span>●</span> 100% vegetarian</div>
      </header>

      <section className="hero" id="top">
        <div><p className="eyebrow">PLAN THE DAY, NOT JUST THE DISH</p><h1>Your meals, timed around <em>your life.</em></h1><p>Three Indian vegetarian meals. One optimized timeline. Every rupee checked.</p></div>
        <div className="hero-proof"><b>Today&apos;s promise</b><span>Less deciding</span><span>Less chopping</span><span>Less waste</span></div>
      </section>

      <div className="workspace">
        <aside className="planner-card">
          <div className="section-heading"><span>01</span><div><h2>Build my day</h2><p>Tell us what the kitchen is working with.</p></div></div>
          <form onSubmit={generate}>
            <div className="two-col">
              <Field label="Cooking for"><input type="number" min="1" max="8" value={input.people} onChange={(e) => setInput({ ...input, people: Number(e.target.value) })} /><i>people</i></Field>
              <Field label="Daily budget"><input type="number" min="0" max="5000" value={input.budgetInr} onChange={(e) => setInput({ ...input, budgetInr: Number(e.target.value) })} /><i>₹</i></Field>
            </div>

            <fieldset className="windows"><legend>Meal times & cooking windows</legend>{(["breakfast", "lunch", "dinner"] as Slot[]).map((slot) => <div className="window-row" key={slot}><span>{slotIcons[slot]}</span><b>{mealLabels[slot]}</b><input aria-label={`${mealLabels[slot]} serving time`} type="time" value={input.windows[slot].at} onChange={(e) => updateWindow(slot, "at", e.target.value)} /><label><input aria-label={`${mealLabels[slot]} available minutes`} type="number" min="5" max="90" value={input.windows[slot].minutes} onChange={(e) => updateWindow(slot, "minutes", e.target.value)} /> min</label></div>)}</fieldset>

            <Field label="Ingredients already at home" hint="Comma-separated is perfect."><textarea rows={3} value={input.pantry} maxLength={500} onChange={(e) => setInput({ ...input, pantry: e.target.value })} /></Field>
            <Field label="Dietary needs or allergies"><input value={input.restrictions} maxLength={300} onChange={(e) => setInput({ ...input, restrictions: e.target.value })} /></Field>

            <fieldset><legend>How are you feeling today?</legend><div className="segmented energy">{(["exhausted", "normal", "energetic"] as const).map((energy) => <label key={energy}><input type="radio" name="energy" value={energy} checked={input.energy === energy} onChange={() => setInput({ ...input, energy })} /><span>{energy === "exhausted" ? "😴" : energy === "normal" ? "😐" : "😊"} {energy[0].toUpperCase() + energy.slice(1)}</span></label>)}</div></fieldset>

            <div className="two-col">
              <fieldset><legend>Effort</legend><div className="segmented">{(["low", "medium"] as const).map((effort) => <label key={effort}><input type="radio" name="effort" checked={input.effort === effort} onChange={() => setInput({ ...input, effort })} /><span>{effort[0].toUpperCase() + effort.slice(1)}</span></label>)}</div></fieldset>
              <fieldset><legend>Appliances</legend><div className="checks">{["Gas stove", "Microwave"].map((appliance) => <label key={appliance}><input type="checkbox" checked={input.appliances.includes(appliance)} onChange={(e) => setInput({ ...input, appliances: e.target.checked ? [...input.appliances, appliance] : input.appliances.filter((item) => item !== appliance) })} /> {appliance}</label>)}</div></fieldset>
            </div>

            <button className="generate" disabled={loading}>{loading ? <><span className="spinner" /> Optimizing your kitchen…</> : <>Create my cooking day <span>→</span></>}</button>
            <p className="form-note">Prices are indicative estimates. Diet, time, and budget are checked by the app.</p>
          </form>
        </aside>

        <section className={`results ${loading ? "is-loading" : ""}`} aria-live="polite" aria-busy={loading}>
          {message && <div className={`notice ${plan.notice ? "demo" : ""}`}>{message}</div>}
          <div className="result-title"><div><p className="eyebrow">YOUR OPTIMIZED DAY</p><h2>Today at a glance</h2></div><span className="date-pill">AI plan • India</span></div>

          <div className="meal-grid">{plan.meals.map((meal) => <article className="meal-card" key={meal.slot}><div className="meal-top"><span>{slotIcons[meal.slot]}</span><div><small>{mealLabels[meal.slot]} • {input.windows[meal.slot].at}</small><h3>{meal.name}</h3></div></div><p>{meal.why}</p><div className="meal-meta"><span>◷ {meal.activeMinutes} min active</span><span>↻ {meal.reuseNote}</span></div></article>)}</div>

          <div className="metrics">
            <div className="score" style={{ "--score": `${plan.summary.efficiencyScore * 3.6}deg` } as React.CSSProperties}><div><strong>{plan.summary.efficiencyScore}</strong><small>/100</small></div></div>
            <div className="metric-copy"><p className="eyebrow">COOKING EFFICIENCY</p><h3>A smoother kitchen day</h3><div className="metric-list"><span><b>₹{plan.substitutions.reduce((sum, item) => sum + item.savingInr, 0)}</b> potential savings</span><span><b>{plan.summary.minutesSaved} min</b> saved by reuse</span><span><b>{plan.summary.reusedIngredients}</b> cross-meal reuses</span><span><b>{plan.summary.pans}</b> pans to wash</span></div></div>
            <div className={`budget-status ${plan.summary.budgetStatus}`}><small>ESTIMATED SPEND</small><strong>₹{plan.summary.estimatedAdditionalSpendInr}</strong><span>{statusLabel}</span><p>of ₹{plan.summary.budgetInr} budget</p></div>
          </div>

          <section className="content-card timeline-card">
            <div className="card-heading"><div><p className="eyebrow">THE WOW MOMENT</p><h2>Cooking optimization graph</h2></div><span>{plan.summary.activeCookingMinutes} min active</span></div>
            <div className="timeline">{plan.timeline.map((task, index) => <div className="timeline-item" key={`${task.slot}-${index}`}><div className="time">{task.at}</div><div className="node">{task.parallelWith ? "↯" : index + 1}</div><div><small>{mealLabels[task.slot]}</small><p>{task.task}</p>{task.parallelWith && <span className="parallel">While {task.parallelWith.toLowerCase()} • {task.durationMinutes} min overlapped</span>}</div></div>)}</div>
          </section>

          <div className="bottom-grid">
            <section className="content-card"><div className="card-heading"><div><p className="eyebrow">ONE CONSOLIDATED LIST</p><h2>Buy once</h2></div><span>{plan.groceries.length} items</span></div>{plan.groceries.length ? <div className="grocery-list">{plan.groceries.map((item) => <div key={item.name}><span className="check-box">✓</span><div><b>{item.name}</b><small>{item.quantity} • {item.reason}</small></div><strong>₹{item.estimatedPriceInr}</strong></div>)}</div> : <p className="empty">Your pantry already covers today&apos;s plan.</p>}<div className="total"><span>Estimated total</span><strong>₹{plan.summary.estimatedAdditionalSpendInr}</strong></div><small className="price-note">{plan.summary.pricingNote}</small></section>

            <section className="content-card"><div className="card-heading"><div><p className="eyebrow">BACKUP OPTIONS</p><h2>Smart swaps</h2></div></div><div className="swap-list">{plan.substitutions.map((item) => <div key={item.ingredient}><div><b>{item.ingredient}</b><span>→</span><b>{item.swap}</b></div><small>{item.reason}</small><strong>Save ~₹{item.savingInr}</strong></div>)}</div><div className="leftover"><span>↻</span><div><b>Tomorrow is already easier</b><p>{plan.leftoverPlan}</p></div></div></section>
          </div>
        </section>
      </div>
      <footer><span>DayDish</span><p>Gemini suggests. DayDish verifies. You cook.</p><span>Built for PromptWars</span></footer>
    </main>
  );
}
