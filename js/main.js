import { renderStep } from "./charts.js";

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

  // show only from step 1 (Defining hit) onwards
  if (hit == null || stepId < 1) {
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
      "Cracking the Hit Code",
      "Hit Threshold",
      "The Popularity Reality",
      "Audio Breakdown",
      "Vibe Tuning",
      "Structure Secrets",
      "Genre Blueprints",
      "Genre Winners",
      "Hit Checklist",
      "Consistency Test",
      "Action Plan"
    ],
    bodies: [
      "As a producer, you're chasing that elusive hit. Let's scan the data for clues in features and genres.",
      "Hits = top 10% popularity. Use this gate to benchmark your tracks consistently.",
      "Popularity follows a power law – most tracks flop, so aim for the tail, not the middle.",
      "Which features separate winners from the pack? Let's isolate the key differentiators.",
      "Dial in the vibe: Danceability, energy, valence shift as tracks climb the charts.",
      "Structure matters: Tempo, duration, loudness – tune for modern listening habits.",
      "Genres have their own audio signatures. Match or tweak to stand out.",
      "Some genres crush it in popularity and hits. Learn from their overperformance.",
      "The average hit profile: A practical delta from the norm for your next session.",
      "Are hits more consistent than non-hits? Check how tight the feature spread gets.",
      "Synthesize it: Prioritize features, respect genres, iterate with data in mind."
    ],
    callouts: [
      "<strong>Producer takeaway:</strong> We’ll define a clear hit threshold, then isolate the few features that most separate hits.",
      "<strong>Producer takeaway:</strong> Your “hit” rule is popularity ≥ p90 (top 10%). Simple and reusable.",
      "<strong>Producer takeaway:</strong> Don’t compare to the median — compare to the top tail (what you’re trying to reach).",
      "<strong>Producer takeaway:</strong> Focus on the 2–3 strongest separators, not 20 features at once.",
      "<strong>Producer takeaway:</strong> Treat this as a “vibe target” you can A/B test (energy + danceability + valence).",
      "<strong>Producer takeaway:</strong> Structure changes are often smaller, but can still be consistent at scale.",
      "<strong>Producer takeaway:</strong> Tune toward your genre’s fingerprint, not the global average.",
      "<strong>Producer takeaway:</strong> Use the toggle (Popularity / Explicit / Hit share) to pick your reference targets.",
      "<strong>Producer takeaway:</strong> Blueprint = targeting. It’s descriptive, not causal — use it to guide iteration.",
      "<strong>Producer takeaway:</strong> Consistency can signal a market “sound” — diversity can be a differentiator.",
      "<strong>Producer takeaway:</strong> Pick a genre target → tune the top separators → then refine structure."
    ]
  },

  culture: {
    titles: [
      "The Mystery of a Hit",
      "Setting the Bar",
      "The Uneven Spotlight",
      "Dissecting the Sound",
      "The Vibe Shift",
      "Myths of Structure",
      "Genre DNA",
      "Chart Conquerors",
      "The Hit Formula?",
      "Homogeneity vs Diversity",
      "What It All Means"
    ],
    bodies: [
      "Imagine scrolling through Spotify, wondering: What turns a song into a global sensation? Let's dive into the data and uncover the hidden patterns behind today's hits.",
      "To make sense of it, we draw a line: Hits are the top 10% by popularity. It's arbitrary, but it gives us a clear lens to compare apples to apples.",
      "Popularity isn't fair. Most tracks fade into obscurity, while a lucky few capture the world's ears. This long tail reveals the brutal reality of streaming culture.",
      "Do hits sound different? Let's break down the audio features one by one, seeing which traits separate the chart-toppers from the rest.",
      "As popularity rises, the music's vibe evolves. Danceability climbs, energy surges, valence dances – reflecting the moods that hook listeners.",
      "What about the basics? Are hits shorter, louder, faster? The data whispers truths about how we consume music in the age of short attention spans.",
      "Genres aren't just labels – they have sonic fingerprints. Z-scores reveal where they align with the crowd or stand apart in their uniqueness.",
      "Some genres dominate the charts far beyond their numbers. Pop and k-pop reign supreme, while others struggle to break through the algorithm's gate.",
      "Picture the average hit: a blueprint of deltas from the norm. Not a recipe, but a map of what tends to work in this wild landscape.",
      "Do hits converge on a narrow sound, or stay diverse? Variance shows whether success rewards conformity or variety.",
      "Beyond the charts, what does this say about us? Algorithms amplify trends, culture shapes sound, and in the quest for hits, diversity sometimes gets lost."
    ],
    callouts: [
      "<strong>Opening scene:</strong> We're not predicting the future – just mapping the present. Correlation, not causation.",
      "<strong>Ground rules:</strong> Top 10% popularity as our 'hit' threshold – transparent and repeatable.",
      "<strong>Plot twist:</strong> Streaming funnels attention like a spotlight, leaving most in the dark.",
      "<strong>Revelation:</strong> Small audio shifts can echo across millions of streams, turning whispers into roars.",
      "<strong>Mood check:</strong> Hits mirror the zeitgeist – danceable energy that matches our fleeting emotions.",
      "<strong>Reality check:</strong> Structure adapts to our habits: concise, punchy tracks in a distracted world.",
      "<strong>Identity crisis:</strong> Genres blend and diverge, showing how music evolves while holding onto roots.",
      "<strong>Power dynamics:</strong> Genre success mixes art, industry, and the invisible hand of recommendation engines.",
      "<strong>Cautionary tale:</strong> The 'average hit' is a ghost – inspiring, not prescriptive. Use it as a guide, not a cage.",
      "<strong>Tension point:</strong> If hits cluster tightly, the algorithm rewards sameness; if not, diversity still survives.",
      "<strong>Final reflection:</strong> In chasing hits, we glimpse the soul of modern music: optimized, yet yearning for variety."
    ]
  }
};

// Step groups shown in the rail (upgrade #5)
const groups = [
  { label: "The Quest", start: 0, end: 0 },
  { label: "The Spectrum", start: 1, end: 2 },
  { label: "The Anatomy", start: 3, end: 5 },
  { label: "The Genres", start: 6, end: 7 },
  { label: "The Blueprint", start: 8, end: 9 },
  { label: "The Meaning", start: 10, end: 10 }
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

  // Mode toggle events
  const bProd = document.getElementById("modeProducer");
  const bCult = document.getElementById("modeCulture");
  if (bProd) bProd.addEventListener("click", () => applyMode("producer"));
  if (bCult) bCult.addEventListener("click", () => applyMode("culture"));

  // Make scrollama reliable (fixes “only updates after scrolling back up”)
  window.addEventListener("resize", () => {
    scroller.resize();
    chapterScroller.resize();
  });
  requestAnimationFrame(() => {
    scroller.resize();
    chapterScroller.resize();
  });
  setTimeout(() => {
    scroller.resize();
    chapterScroller.resize();
  }, 300);
  setTimeout(() => {
    scroller.resize();
    chapterScroller.resize();
  }, 1200);
}

init();
