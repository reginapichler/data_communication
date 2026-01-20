import { renderStep, renderHitDefinitionAppendix } from "./charts.js";

let __renderRaf = null;

function safeRenderStep(stepId, story) {
  if (__renderRaf) cancelAnimationFrame(__renderRaf);
  __renderRaf = requestAnimationFrame(() => {
    renderStep(stepId, story);
  });
}

const scroller = scrollama();
const chapterScroller = scrollama();
let dataset = null;

function getHitGate(story) {
  return (
    story?.hit_threshold ??
    story?.popularity_spectrum?.hit_threshold_top10 ??
    story?.hit_blueprint?.hit_threshold_top10 ??
    null
  );
}

function updateHitGateMotif(stepId, story) {
  const el = document.getElementById("hitGateMotif");
  if (!el) return;

  const hit = getHitGate(story);

  // show only from step 3 (popularity spectrum) onwards
  if (hit == null || stepId < 3) {
    el.style.display = "none";
    return;
  }

  el.style.display = "inline-flex";
  el.innerHTML = `<span class="label">Hit gate</span><span class="value">${Number(hit).toFixed(1)}+</span>`;
}

/**
 * Two “audience modes”:
 * - producer: actionable, punchy
 * - culture: narrative/interpretation
 * Charts stay the same; only text + rail labels change.
 */
const COPY = {
  producer: {
    titles: [
      "The Opening Act",
      "The Pattern Revealed",
      "Cracking the Hit Code",
      "The Popularity Reality",
      "Audio Breakdown",
      "Vibe Tuning",
      "Structure Secrets",
      "The Profanity Factor",
      "Genre Blueprints",
      "Genre Winners",
      "Anatomy Explained",
      "Consistency Test",
      "Action Plan"
    ],
    bodies: [
      "Three songs. Three different worlds. Before we chase patterns and blueprints, let's meet the spectrum: a viral smash, a steady performer, and a buried gem.",
      "Less instrumental, louder, more danceable. These are the key separators. The numbers are small, but the impact is decisive.",
      "As a producer, you're chasing that elusive hit. Let's scan the data for clues in features and genres.",
      "Popularity follows a power law – most tracks flop, so aim for the tail, not the middle.",
      "Three features dominate: less instrumental, louder, more danceable. These are your leverage points.",
      "Dial in the vibe: Danceability, energy, valence shift as tracks climb the charts.",
      "Do shorter songs outperform longer ones in the streaming era? A little. Hits skew slightly shorter on average — but it's not a rulebook. Treat duration as a small lever; tempo is weaker context.",
      "Explicit tracks have 80% higher hit rates than clean ones (16.9% vs 9.5%). Profanity correlates with streaming success.",
      "Are genres converging? Check 5 representative genres to see if the \"streaming sound\" is real or myth.",
      "Some genres crush it in popularity and hits. Learn from their overperformance.",
      "Now the full breakdown: exact deltas, all features, sample songs. What Step 1 revealed, now explained in detail.",
      "Are hits more consistent than non-hits? Check how tight the feature spread gets.",
      "Synthesize it: Prioritize features, respect genres, iterate with data in mind."
    ],
    callouts: [
      "<strong>First impression:</strong> See how audio features shift across the popularity ladder – from chart-toppers to the long tail.",
      "<strong>Key insight:</strong> Instrumentalness (-0.11), loudness (+1.19 dB), danceability (+0.04). These are your primary levers.",
      "<strong>Producer takeaway:</strong> We'll define a clear hit threshold, then isolate the few features that most separate hits.",
      "<strong>Producer takeaway:</strong> Don't compare to the median — compare to the top tail (what you're trying to reach).",
      "<strong>Producer takeaway:</strong> Three levers: instrumentalness, loudness, danceability. Start here, not with 20 features.",
      "<strong>Producer takeaway:</strong> Treat this as a \"vibe target\" you can A/B test (energy + danceability + valence).",
      "<strong>Producer takeaway:</strong> Duration is the clearer \\\"TikTok brain\\\" signal — but it's incremental, not decisive. Tempo matters less than people think.",
      "<strong>Producer takeaway:</strong> Don't fear explicit content – data shows it helps, not hurts. But brand and audience matter too.",
      "<strong>Producer takeaway:</strong> If genres are distinct, honor that. If converging, lean into the universal patterns.",
      "<strong>Producer takeaway:</strong> Use the toggle (Popularity / Explicit / Hit share) to pick your reference targets.",
      "<strong>Producer takeaway:</strong> Full anatomy revealed: all features, precise values, contextual songs. Descriptive, not prescriptive.",
      "<strong>Producer takeaway:</strong> Consistency can signal a market \"sound\" — diversity can be a differentiator.",
      "<strong>Producer takeaway:</strong> Pick a genre target → tune the top separators → then refine structure."
    ]
  },

  culture: {
    titles: [
      "The Opening Act",
      "The Pattern Revealed",
      "The Mystery of a Hit",
      "The Uneven Spotlight",
      "Dissecting the Sound",
      "The Vibe Shift",
      "Myths of Structure",
      "Language & Taboo",
      "Genre DNA",
      "Chart Conquerors",
      "The Full Blueprint",
      "Homogeneity vs Diversity",
      "What It All Means"
    ],
    bodies: [
      "Three songs. Three different realities. One climbed to the top. One lives in the middle. One never broke through. What separates them?",
      "The pattern is clear: hits are less instrumental, louder, more danceable. The numbers reveal a sonic signature that defines modern success.",
      "Imagine scrolling through Spotify, wondering: What turns a song into a global sensation? Let's dive into the data and uncover the hidden patterns behind today's hits.",
      "Popularity isn't fair. Most tracks fade into obscurity, while a lucky few capture the world's ears. This long tail reveals the brutal reality of streaming culture.",
      "Yes, hits sound different. Three traits cluster: less instrumental, louder, more danceable. The sonic signature is real.",
      "As popularity rises, the music's vibe evolves. Danceability climbs, energy surges, valence dances – reflecting the moods that hook listeners.",
      "Do shorter songs outperform longer ones? Slightly — hits lean shorter, but there's no magic cutoff. Tempo is even less decisive than the mythology suggests.",
      "Profanity isn't a barrier — it's a magnet. Explicit tracks dominate: 16.9% hit rate vs 9.5% for clean tracks. Cultural norms and algorithms intertwine.",
      "The \"Pop Singularity\" question: are genres converging into one streaming sound? We compare 5 distinct genres to see if sonic identities survive or blur.",
      "Some genres dominate the charts far beyond their numbers. Pop and k-pop reign supreme, while others struggle to break through the algorithm's gate.",
      "Now, the full anatomy: exact deltas, all features, real hit songs plotted as context. What Step 1 revealed, now explained with numbers.",
      "Do hits converge on a narrow sound, or stay diverse? Variance shows whether success rewards conformity or variety.",
      "Beyond the charts, what does this say about us? Algorithms amplify trends, culture shapes sound, and in the quest for hits, diversity sometimes gets lost."
    ],
    callouts: [
      "<strong>Opening scene:</strong> The gulf between success and obscurity starts here. Let's explore what the numbers reveal.",
      "<strong>The signature:</strong> Less instrumental, louder, more danceable. This is the sonic DNA of streaming success.",
      "<strong>Opening scene:</strong> We're not predicting the future – just mapping the present. Correlation, not causation.",
      "<strong>Plot twist:</strong> Streaming funnels attention like a spotlight, leaving most in the dark.",
      "<strong>The signature:</strong> Three traits define hits—less instrumental, louder, more danceable. The pattern is consistent.",
      "<strong>Mood check:</strong> Hits mirror the zeitgeist – danceable energy that matches our fleeting emotions.",
      "<strong>Reality check:</strong> Shorter helps a bit — but it doesn't guarantee anything. The \\\"TikTok brain\\\" story is real… just not absolute.",
      "<strong>Cultural signal:</strong> Explicit content isn't censored by the algorithm — it's rewarded. What does that say about streaming culture?",
      "<strong>Pop Singularity check:</strong> The verdict reveals whether genres retain sonic identities or merge into algorithmic homogeneity.",
      "<strong>Power dynamics:</strong> Genre success mixes art, industry, and the invisible hand of recommendation engines.",
      "<strong>The anatomy explained:</strong> All features, exact deltas, contextual songs. Descriptive, not causal. This is what Step 1 meant.",
      "<strong>Tension point:</strong> If hits cluster tightly, the algorithm rewards sameness; if not, diversity still survives.",
      "<strong>Final reflection:</strong> In chasing hits, we glimpse the soul of modern music: optimized, yet yearning for variety."
    ]
  }
};

// Step groups shown in the rail (upgrade #5)
const groups = [
  { label: "The Opening", start: 0, end: 0 },
  { label: "The Pattern", start: 1, end: 1 },
  { label: "The Quest", start: 2, end: 2 },
  { label: "The Spectrum", start: 3, end: 3 },
  { label: "The Anatomy", start: 4, end: 7 },
  { label: "The Genres", start: 8, end: 9 },
  { label: "The Blueprint", start: 10, end: 11 },
  { label: "The Meaning", start: 12, end: 12 }
];

let currentStep = 0;
let mode = localStorage.getItem("audienceMode") || "culture";

function getCopy() {
  return COPY[mode] || COPY.culture;
}

function applyMode(newMode) {
  mode = newMode;
  localStorage.setItem("audienceMode", mode);

  // Toggle button styles
  const bProd = document.getElementById("modeProducer");
  const bCult = document.getElementById("modeCulture");
  if (bProd) bProd.classList.toggle("is-active", mode === "producer");
  if (bCult) bCult.classList.toggle("is-active", mode === "culture");

  // Update step text + callouts
  const steps = Array.from(document.querySelectorAll(".step"));
  const copy = getCopy();

  steps.forEach((stepEl, i) => {
    const h2 = stepEl.querySelector("h2");
    const p = stepEl.querySelector("p");

    if (h2) h2.textContent = copy.titles[i] || h2.textContent;
    if (p) p.textContent = copy.bodies[i] || p.textContent;

    // Ensure callout exists
    let call = stepEl.querySelector(".step-callout");
    if (!call) {
      call = document.createElement("div");
      call.className = "step-callout";
      stepEl.appendChild(call);
    }
    call.innerHTML = copy.callouts[i] || "";
  });

  // Rebuild the rail so tooltips match this mode’s titles
  buildRail();
  setActiveDot(currentStep);
  if (dataset) safeRenderStep(currentStep, dataset);

}

// Render appendix visuals on demand (does not affect scrollytelling logic)
function initAppendix(story) {
  const details = document.querySelector(".methodology-details");
  if (!details) return;

  let rendered = false;
  details.addEventListener("toggle", () => {
    if (!details.open || rendered) return;
    renderHitDefinitionAppendix(story, "hit-definition-appendix");
    rendered = true;
  });
}

// Floating label next to the rail (upgrade #1)
function setNowLabel(stepIndex, dotEl) {
  const rail = document.getElementById("rail");
  if (!rail) return;

  let now = document.getElementById("railNow");
  if (!now) {
    now = document.createElement("div");
    now.id = "railNow";
    now.className = "rail-now";
    rail.appendChild(now);
  }

  const copy = getCopy();
  now.textContent = copy.titles[stepIndex] || `Step ${stepIndex + 1}`;

  if (dotEl) {
    const y = dotEl.offsetTop + dotEl.offsetHeight / 2;
    now.style.top = `${y}px`;
  }
}

function buildRail() {
  const rail = document.getElementById("rail");
  const steps = Array.from(document.querySelectorAll(".step"));
  if (!rail) return;

  rail.innerHTML = "";

  // Create floating “Now reading” label once
  const now = document.createElement("div");
  now.id = "railNow";
  now.className = "rail-now";
  rail.appendChild(now);

  const copy = getCopy();

  // Build grouped dots
  groups.forEach((g, gi) => {
    const lab = document.createElement("div");
    lab.className = "rail-group-label";
    lab.textContent = g.label;
    rail.appendChild(lab);

    for (let i = g.start; i <= g.end; i++) {
      const el = steps[i];
      if (!el) continue;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rail-dot" + (i === 0 ? " is-active" : "");
      btn.dataset.label = copy.titles[i] || `Step ${i + 1}`;
      btn.dataset.step = String(i);

      // click-to-jump
      btn.addEventListener("click", () => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      // hover preview: label follows the hovered dot
      btn.addEventListener("mouseenter", () => setNowLabel(i, btn));
      btn.addEventListener("mouseleave", () => {
        const dots = Array.from(document.querySelectorAll(".rail-dot"));
        setNowLabel(currentStep, dots[currentStep]);
      });

      rail.appendChild(btn);
    }

    if (gi < groups.length - 1) {
      const sp = document.createElement("div");
      sp.className = "rail-spacer";
      rail.appendChild(sp);
    }
  });

  // Initial label position
  const firstDot = rail.querySelector(".rail-dot");
  setNowLabel(0, firstDot);
}

// Smooth active animation (upgrade #3)
function setActiveDot(i) {
  currentStep = i;
  const dots = Array.from(document.querySelectorAll(".rail-dot"));

  dots.forEach((d, idx) => {
    d.classList.toggle("is-active", idx === i);
    d.classList.remove("just-activated");
  });

  const active = dots[i];
  if (active) {
    active.classList.add("just-activated");
    setTimeout(() => active.classList.remove("just-activated"), 260);
    setNowLabel(i, active);
  }
}

async function init() {
  dataset = await d3.json("data/processed/story.json");

  // Apply initial mode (this also builds rail + callouts)
  applyMode(mode);

  // Appendix visuals (render only when expanded)
  initAppendix(dataset);

  // Initial chart
  safeRenderStep(0, dataset);
  updateHitGateMotif(0, dataset);

scroller
  .setup({
    step: ".step",
    offset: 0.6
  })
  .onStepEnter((resp) => {
    document.querySelectorAll(".step").forEach((s) => s.classList.remove("is-active"));
    const graphic = document.querySelector(".graphic");
    if (graphic) graphic.classList.add("is-active");
    resp.element.classList.add("is-active");

    const stepId = Number(resp.element.dataset.step);
    if (!Number.isFinite(stepId)) return;

    setActiveDot(stepId);
    safeRenderStep(stepId, dataset);
    updateHitGateMotif(stepId, dataset);
  })
  .onStepExit(() => {
    const graphic = document.querySelector(".graphic");
    if (graphic) graphic.classList.remove("is-active");
  });

  // Chapter breaks (optional). If none exist, skip setting up the secondary scroller.
  const chapterEls = document.querySelectorAll(".chapter-break");
  if (chapterEls.length) {
    chapterScroller
      .setup({
        step: ".chapter-break",
        offset: 0.5
      })
      .onStepEnter((resp) => {
        document.body.classList.add("chapter-break-active");
        if (resp.element) {
          resp.element.classList.remove("is-exiting");
          resp.element.classList.add("is-active");
        }
      })
      .onStepExit((resp) => {
        document.body.classList.remove("chapter-break-active");
        if (resp.element) {
          resp.element.classList.remove("is-active");
          resp.element.classList.add("is-exiting");
          setTimeout(() => {
            resp.element.classList.remove("is-exiting");
          }, 420);
        }
      });
  }

  // Mode toggle events
  const bProd = document.getElementById("modeProducer");
  const bCult = document.getElementById("modeCulture");
  if (bProd) bProd.addEventListener("click", () => applyMode("producer"));
  if (bCult) bCult.addEventListener("click", () => applyMode("culture"));

  // Make scrollama reliable (fixes “only updates after scrolling back up”)
  window.addEventListener("resize", () => {
    scroller.resize();
    if (chapterEls.length) chapterScroller.resize();
  });
  requestAnimationFrame(() => {
    scroller.resize();
    if (chapterEls.length) chapterScroller.resize();
  });
  setTimeout(() => {
    scroller.resize();
    if (chapterEls.length) chapterScroller.resize();
  }, 300);
  setTimeout(() => {
    scroller.resize();
    if (chapterEls.length) chapterScroller.resize();
  }, 1200);
}

init();
