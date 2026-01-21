function ensureChartRoot() {
  // Prefer the real #chart if it exists
  let chart = document.getElementById("chart");
  if (chart) return chart;

  // Otherwise, attach it to a stable container
  let wrap =
    document.querySelector(".chart-wrap") ||
    document.querySelector("figure.graphic") ||
    document.querySelector("main") ||
    document.body;

  // If we found a figure.graphic, prefer its .chart-wrap if it exists
  if (wrap && wrap.classList && wrap.classList.contains("graphic")) {
    wrap = wrap.querySelector(".chart-wrap") || wrap;
  }

  // Create #chart
  chart = document.createElement("div");
  chart.id = "chart";
  wrap.appendChild(chart);
  return chart;
}

/* ---------- Helpers ---------- */
function clearChart() {
  // Also hard-remove the leftover "Hit gate" motif if it exists anywhere
  const motif = document.getElementById("hitGateMotif");
  if (motif) motif.remove();

  const root = ensureChartRoot();
  d3.select(root).selectAll("*").remove();
}

function getSize() {
  const wrap = document.querySelector(".chart-wrap");
  if (!wrap) {
    return { width: 720, height: 520 };
  }

  const width = Math.max(520, wrap.clientWidth);
  const height = Math.max(520, wrap.clientHeight);

  return { width, height };
}

const AXIS_TICK_SIZE = 12;
const AXIS_LABEL_SIZE = 13;
const LEGEND_LABEL_SIZE = 12;

let __variancePromise = null;
let __varianceCache = null;
let __varianceRunId = 0;

function tooltip() {
  let tip = d3.select("body").select(".tooltip");
  if (tip.empty()) tip = d3.select("body").append("div").attr("class", "tooltip");
  return tip;
}

function showTip(html, x, y) {
  tooltip()
    .style("opacity", 1)
    .style("left", x + 14 + "px")
    .style("top", y + 14 + "px")
    .html(html);
}

function hideTip() {
  tooltip().style("opacity", 0);
}

function baseSvg(title, subtitle) {
  const { width, height } = getSize();

  // One consistent layout for all charts
  const margin = {
    top: 48,
    right: 24,
    bottom: 88,
    left: 90  // Slightly larger for clearer axis-label spacing
  };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  // Clear previous step content (SVG + any HTML callouts)
  const root = d3.select("#chart");
  root.selectAll("*").remove();

  // Wrapper so we can add HTML callouts below the SVG if needed
  const wrap = root
    .append("div")
    .attr("class", "chart-inner");

  // ---- Smooth enter animation (CSS-based, so it feels snappy) ----
  // Start slightly faded and shifted; then animate in on next frame.
  wrap
    .style("opacity", 0)
    .style("transform", "translateY(6px)")
    .style("transition", "opacity 220ms ease, transform 220ms ease");

  requestAnimationFrame(() => {
    wrap.style("opacity", 1).style("transform", "translateY(0px)");
  });

  const svg = wrap
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // Create defs for filters (shadows, etc.) - using callout boxes instead of arrows
  const defs = svg.append("defs");

  // Main drawing group
  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Title / subtitle inside chart area
  g.append("text")
    .attr("x", 0)
    .attr("y", -28)
    .attr("font-size", 15)
    .attr("font-weight", 800)
    .attr("fill", "#111")
    .text(title || "");

  if (subtitle) {
    g.append("text")
      .attr("x", 0)
      .attr("y", -8)
      .attr("font-size", 12)
      .attr("fill", "#555")
      .text(subtitle);
  }

  return { wrap, svg, g, w, h, width, height, margin };
}

// ========== ENHANCED TOOLTIP WITH INTERPRETATION ==========
function showEnhancedTip(title, value, interpretation, x, y) {
  const tip = tooltip();
  tip
    .html(`
      <div style="font-weight: 700; margin-bottom: 6px; color: #111; font-size: 14px;">
        ${title}
      </div>
      <div style="color: #444; margin-bottom: ${interpretation ? "8px" : "0"}; font-size: 13px;">
        ${value}
      </div>
      ${interpretation ? `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; color: #666; font-size: 12px; font-style: italic; line-height: 1.4;">
          💡 ${interpretation}
        </div>
      ` : ""}
    `)
    .style("opacity", 0)
    .style("left", `${x + 15}px`)
    .style("top", `${y - 10}px`)
    .transition()
    .duration(200)
    .style("opacity", 1);
}

// ========== FLOATING CALLOUT BOX (no arrows) ==========
function addAnnotation(g, x, y, text, delay = 0, position = "top-right") {
  const annotation = g.append("g")
    .attr("class", "annotation")
    .attr("opacity", 0);

  // Determine position offset based on position parameter
  let offsetX = 0, offsetY = 0;
  let anchor = "start";
  
  if (position === "top-right") {
    offsetX = 10;
    offsetY = -10;
    anchor = "start";
  } else if (position === "top-left") {
    offsetX = -10;
    offsetY = -10;
    anchor = "end";
  } else if (position === "bottom-right") {
    offsetX = 10;
    offsetY = 20;
    anchor = "start";
  } else if (position === "bottom-left") {
    offsetX = -10;
    offsetY = 20;
    anchor = "end";
  } else if (position === "top-center") {
    offsetX = 0;
    offsetY = -10;
    anchor = "middle";
  } else if (position === "bottom-center") {
    offsetX = 0;
    offsetY = 20;
    anchor = "middle";
  }

  // Text element first to measure
  const textBox = annotation.append("g");
  const textEl = textBox.append("text")
    .attr("x", x + offsetX)
    .attr("y", y + offsetY)
    .attr("text-anchor", anchor)
    .attr("font-size", "13px")
    .attr("font-weight", "600")
    .attr("fill", "#111")
    .attr("dy", "0.35em")
    .text(text);

  // Get bounding box for background
  const bbox = textEl.node().getBBox();
  
  // Background box with subtle shadow effect
  textBox.insert("rect", "text")
    .attr("x", bbox.x - 10)
    .attr("y", bbox.y - 6)
    .attr("width", bbox.width + 20)
    .attr("height", bbox.height + 12)
    .attr("rx", 8)
    .attr("fill", "rgba(255, 255, 255, 0.98)")
    .attr("stroke", "#6366f1")
    .attr("stroke-width", 2)
    .attr("filter", "url(#callout-shadow)");

  // Ensure shadow filter exists - get defs from svg (parent of g)
  const svgNode = g.node().ownerSVGElement || g.node().closest("svg");
  let defs = d3.select(svgNode).select("defs");
  if (defs.empty()) {
    defs = d3.select(svgNode).append("defs");
  }
  if (defs.select("#callout-shadow").empty()) {
    const filter = defs.append("filter")
      .attr("id", "callout-shadow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 3);
    
    filter.append("feOffset")
      .attr("dx", 2)
      .attr("dy", 2)
      .attr("result", "offsetblur");
    
    const feComponentTransfer = filter.append("feComponentTransfer");
    feComponentTransfer.append("feFuncA")
      .attr("type", "linear")
      .attr("slope", 0.3);
    
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");
  }

  // Animate in smoothly
  setTimeout(() => {
    annotation
      .transition()
      .duration(500)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);
  }, delay);

  return annotation;
}

function addGridY(g, y, w) {
  const grid = g
    .append("g")
    .attr("class", "grid-y")
    .call(d3.axisLeft(y).ticks(6).tickSize(-w).tickFormat(""));

  grid.selectAll("line").attr("stroke", "#eee");
  grid.select("path").remove();
}

/**
 * STEP 1: Early Hit Blueprint
 * Bold, early statement showing what separates hits from the rest
 * Clean horizontal bar chart with 6-8 key features
 */
function renderBlueprintEarly(story) {
  const deltas = story?.hit_blueprint?.deltas || {};
  const hitMeans = story?.hit_blueprint?.hit_means || {};
  const globalMeans = story?.hit_blueprint?.global_means || {};

  // HIGH-LEVEL REVEAL: Show the key differentiators (5-6 features)
  // More than a glimpse, less than full detail
  const keyFeatures = [
    "instrumentalness",
    "danceability",
    "loudness",
    "energy",
    "acousticness",
    "duration_min"
  ].filter((k) => deltas[k] != null);

  const rows = keyFeatures.map((k) => ({
    feature: k,
    delta: Number(deltas[k]),
    hit: Number(hitMeans[k]),
    overall: Number(globalMeans[k]),
  }));

  const { g, w, h, svg } = baseSvg("The Pattern Revealed", "");

  if (!rows.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No blueprint data found");
    return;
  }

  const maxAbsDelta = d3.max(rows, (d) => Math.abs(d.delta)) || 1;
  const domain = [-maxAbsDelta * 1.1, maxAbsDelta * 1.1];

  const x = d3.scaleLinear().domain(domain).range([0, w]);
  const y = d3.scaleBand().domain(rows.map((r) => r.feature)).range([0, h]).padding(0.3);

  // Zero line
  g.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", -10)
    .attr("y2", h + 10)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 2);

  // Y-axis (feature labels)
  g.append("g")
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll(".tick line").remove())
    .selectAll("text")
    .style("fill", "#333")
    .style("font-size", "14px")
    .style("font-weight", "600")
    .style("text-transform", "capitalize");

  // Bars with animation
  const bars = g
    .selectAll(".blueprint-bar")
    .data(rows)
    .enter()
    .append("rect")
    .attr("class", "blueprint-bar")
    .attr("y", (d) => y(d.feature))
    .attr("height", y.bandwidth())
    .attr("x", (d) => (d.delta >= 0 ? x(0) : x(d.delta)))
    .attr("width", 0) // Start at zero for animation
    .attr("fill", (d) => (d.delta >= 0 ? "#b1162a" : "#2563eb"))
    .attr("opacity", 0.85);

  // Animate bars in
  bars
    .transition()
    .duration(800)
    .delay((d, i) => i * 100)
    .ease(d3.easeCubicOut)
    .attr("width", (d) => Math.abs(x(d.delta) - x(0)));

  // Add value labels to show the actual differences
  const labels = g
    .selectAll(".blueprint-label")
    .data(rows)
    .enter()
    .append("text")
    .attr("class", "blueprint-label")
    .attr("y", (d) => y(d.feature) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("x", (d) => {
      const barEnd = d.delta >= 0 ? x(d.delta) : x(d.delta);
      return barEnd + (d.delta >= 0 ? 8 : -8);
    })
    .attr("text-anchor", (d) => (d.delta >= 0 ? "start" : "end"))
    .style("fill", "#333")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("opacity", 0)
    .text((d) => {
      const sign = d.delta >= 0 ? "+" : "";
      return `${sign}${d.delta.toFixed(2)}`;
    });

  labels
    .transition()
    .duration(400)
    .delay((d, i) => i * 100 + 700)
    .style("opacity", 1);

  // Add informative annotation
  setTimeout(() => {
    addAnnotation(
      svg,
      w * 0.7,
      h * 0.15,
      "These are the key separators between hits and the rest.",
      400,
      "top-right"
    );
  }, 1200);
}

/* ---------- STEP 0: INTRO ---------- */
function drawIntro(story) {
  const intro = story.intro || {};

  const wrap = d3.select("#chart").append("div").style("padding", "12px");

  wrap
    .append("div")
    .style("font-size", "14px")
    .style("font-weight", "800")
    .style("margin-bottom", "10px")
    .text("Dataset snapshot");

  const grid = wrap
    .append("div")
    .style("display", "grid")
    .style("grid-template-columns", "repeat(2, minmax(0, 1fr))")
    .style("gap", "10px")
    .style("margin-bottom", "12px");

  const card = (label, value) => {
    const c = grid
      .append("div")
      .style("border", "1px solid #eee")
      .style("border-radius", "14px")
      .style("padding", "12px")
      .style("background", "white");
    c.append("div").style("font-size", "12px").style("color", "#666").text(label);
    c.append("div").style("font-size", "20px").style("font-weight", "800").text(value);
  };

  card("Tracks", intro.tracks?.toLocaleString?.() ?? intro.tracks ?? "-");
  card("Unique genres", intro.unique_genres?.toLocaleString?.() ?? intro.unique_genres ?? "-");
  card("Unique artists", intro.unique_artists?.toLocaleString?.() ?? intro.unique_artists ?? "-");
  card(
    "Explicit rate",
    intro.explicit_rate == null ? "-" : `${Math.round(intro.explicit_rate * 100)}%`
  );

  wrap
    .append("div")
    .style("font-size", "14px")
    .style("font-weight", "800")
    .style("margin", "16px 0 8px")
    .text("Example top-popularity tracks");

  const list = wrap
    .append("div")
    .style("border", "1px solid #eee")
    .style("border-radius", "14px")
    .style("background", "white")
    .style("overflow", "visible");

  const rows = intro.example_hits || [];
  rows.slice(0, 8).forEach((r, i) => {
    const row = list
      .append("div")
      .style("display", "grid")
      .style("grid-template-columns", "36px 1fr 90px")
      .style("gap", "10px")
      .style("padding", "10px 12px")
      .style("border-top", i === 0 ? "0" : "1px solid #f0f0f0");

    row.append("div").style("font-weight", "800").style("color", "#444").text(`#${i + 1}`);

    const mid = row.append("div");
    mid.append("div").style("font-weight", "700").text(r.track_name || "-");
    mid.append("div")
      .style("font-size", "12px")
      .style("color", "#666")
      .text(`${r.artists || "-"} | ${r.track_genre || "-"}`);

    row.append("div").style("text-align", "right").style("font-weight", "800").text(r.popularity ?? "-");
  });
}

/* ---------- STEP 1: POPULARITY HIST ---------- */
/**
 * STEP 3: Popularity Spectrum with Animated Hit Threshold
 * Show histogram first, then reveal the hit threshold line and zone
 */
function renderPopularitySpectrum(story) {
  const bins = story?.popularity_spectrum?.hist_5pt || [];
  const hitThreshold = story?.popularity_spectrum?.hit_threshold_top10;
  const { g, w, h, svg } = baseSvg("The Popularity Reality", "");

  if (!bins.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No popularity histogram data found");
    return;
  }

  // Scales
  const x = d3.scaleBand()
    .domain(bins.map((d) => d.bin))
    .range([0, w])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(bins, (d) => d.count) || 1])
    .nice()
    .range([h, 0]);

  // Helper to get bin midpoint value
  const getBinMid = (binStr) => {
    const parts = binStr.split("-");
    return (parseFloat(parts[0]) + parseFloat(parts[1] || parts[0])) / 2;
  };

  // Find the bin and x-position for hit threshold
  let hitBinIndex = -1;
  let hitLineX = w * 0.9; // fallback
  
  if (hitThreshold != null) {
    hitBinIndex = bins.findIndex((d) => {
      const mid = getBinMid(d.bin);
      return mid >= hitThreshold;
    });
    if (hitBinIndex >= 0) {
      hitLineX = x(bins[hitBinIndex].bin);
    }
  }

  // Grid
  addGridY(g, y, w);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(bins.map((d) => d.bin).filter((_, i) => i % 3 === 0)))
    .call((g) => g.select(".domain").attr("stroke", "#ddd"))
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end")
    .style("fill", "#555")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("fill", "#555")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 58)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Popularity Score");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Number of Tracks");

  // Bars (initially neutral color)
  const bars = g
    .selectAll(".spectrum-bar")
    .data(bins, (d) => d.bin)
    .enter()
    .append("rect")
    .attr("class", "spectrum-bar")
    .attr("x", (d) => x(d.bin))
    .attr("width", x.bandwidth())
    .attr("y", (d) => y(d.count))
    .attr("height", (d) => h - y(d.count))
    .attr("fill", "#888")
    .attr("opacity", 0.7);

  // Calculate total for percentage calculations
  const totalTracks = d3.sum(bins, (d) => d.count);

  // Hit zone shading (hidden initially)
  const hitZone = g
    .append("rect")
    .attr("class", "hit-zone-shade")
    .attr("x", hitLineX)
    .attr("y", 0)
    .attr("width", w - hitLineX)
    .attr("height", h)
    .attr("fill", "rgba(177, 22, 42, 0.15)")
    .attr("opacity", 0)
    .attr("pointer-events", "none");

  // Hit threshold line (hidden initially)
  const hitLine = g
    .append("line")
    .attr("class", "hit-threshold-line")
    .attr("x1", hitLineX)
    .attr("x2", hitLineX)
    .attr("y1", 0)
    .attr("y2", h)
    .attr("stroke", "#b1162a")
    .attr("stroke-width", 3)
    .attr("stroke-dasharray", "8,4")
    .attr("opacity", 0);

  // Hit threshold label (hidden initially)
  const hitLabel = g
    .append("text")
    .attr("class", "hit-threshold-label")
    .attr("x", hitLineX + 8)
    .attr("y", h * 0.2)
    .attr("text-anchor", "start")
    .style("fill", "#b1162a")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("opacity", 0)
    .text(`Hit threshold (top 10%): ${hitThreshold?.toFixed(0) || "?"}`);

  // Explanation label for the red area (hidden initially)
  const redAreaExplanation = g
    .append("text")
    .attr("class", "red-area-explanation")
    .attr("x", hitLineX + (w - hitLineX) / 2)
    .attr("y", h * 0.3)
    .attr("text-anchor", "middle")
    .style("fill", "#b1162a")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .style("opacity", 0);

  redAreaExplanation
    .append("tspan")
    .attr("x", hitLineX + (w - hitLineX) / 2)
    .attr("dy", "0")
    .text("Tracks in this red zone");

  redAreaExplanation
    .append("tspan")
    .attr("x", hitLineX + (w - hitLineX) / 2)
    .attr("dy", "1.2em")
    .text("are considered 'hits'");

  // Zone labels (hidden initially)
  const longTailLabel = g
    .append("text")
    .attr("class", "zone-label")
    .attr("x", hitLineX / 2)
    .attr("y", h * 0.1)
    .attr("text-anchor", "middle")
    .style("fill", "#666")
    .style("font-size", "14px")
    .style("font-weight", "600")
    .style("opacity", 0)
    .text("The long tail");

  // Calculate hit zone percentage
  const hitCount = d3.sum(bins.filter((d, i) => i >= hitBinIndex), (d) => d.count);
  const hitPercentage = ((hitCount / totalTracks) * 100).toFixed(1);

  const hitZoneLabel = g
    .append("text")
    .attr("class", "zone-label")
    .attr("x", hitLineX + (w - hitLineX) / 2)
    .attr("y", h * 0.1)
    .attr("text-anchor", "middle")
    .style("fill", "#b1162a")
    .style("font-size", "14px")
    .style("font-weight", "700")
    .style("opacity", 0)
    .text(`Hit zone (${hitPercentage}% of tracks)`);

  // Add long tail percentage
  const longTailCount = d3.sum(bins.filter((d, i) => i < hitBinIndex), (d) => d.count);
  const longTailPercentage = ((longTailCount / totalTracks) * 100).toFixed(1);
  
  longTailLabel.text(`The long tail (${longTailPercentage}% of tracks)`);

  // Animate threshold reveal after 800ms
  setTimeout(() => {
    // Animate hit zone shading
    hitZone
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);

    // Animate hit line
    hitLine
      .transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr("opacity", 1);

    // Animate labels
    hitLabel
      .transition()
      .duration(400)
      .delay(400)
      .attr("opacity", 1);

    redAreaExplanation
      .transition()
      .duration(400)
      .delay(600)
      .style("opacity", 1);

    longTailLabel
      .transition()
      .duration(400)
      .delay(500)
      .attr("opacity", 1);

    hitZoneLabel
      .transition()
      .duration(400)
      .delay(500)
      .attr("opacity", 1);

    // Color-code bars after threshold is revealed
    bars
      .transition()
      .duration(600)
      .delay(300)
      .attr("fill", (d, i) => (i >= hitBinIndex ? "#b1162a" : "#333"))
      .attr("opacity", (d, i) => (i >= hitBinIndex ? 0.9 : 0.6));
  }, 800);
}

function drawPopularityHist(story) {
  const bins = story?.popularity_spectrum?.hist_5pt || [];
  const hitThreshold = story?.popularity_spectrum?.hit_threshold_top10;
  const { g, w, h } = baseSvg("Popularity spectrum", "Counts per 5-point popularity bin");

  if (!bins.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No popularity histogram data found in story.json");
    return;
  }

  // NO padding - make bars as thick as possible for visibility
  const x = d3.scaleBand().domain(bins.map((d) => d.bin)).range([0, w]).padding(0);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(bins, (d) => d.count) || 1])
    .nice()
    .range([h, 0]);

  // Helper to get bin midpoint value
  const getBinMid = (binStr) => {
    const parts = binStr.split("-");
    return (parseFloat(parts[0]) + parseFloat(parts[1] || parts[0])) / 2;
  };

  // Find the bin that contains the hit threshold
  let hitBinIndex = -1;
  if (hitThreshold != null) {
    hitBinIndex = bins.findIndex((d) => {
      const mid = getBinMid(d.bin);
      return mid >= hitThreshold;
    });
  }

  // Add background shading zones BEFORE bars
  // Main cluster zone (long tail - low to medium popularity)
  const mainClusterEnd = hitBinIndex >= 0 ? hitBinIndex : bins.length * 0.9;
  const clusterStartX = 0;
  const clusterEndX = hitBinIndex >= 0 ? x(bins[Math.floor(mainClusterEnd)].bin) + x.bandwidth() : w * 0.9;
  
  g.append("rect")
    .attr("class", "pop-zone")
    .attr("x", clusterStartX)
    .attr("y", 0)
    .attr("width", clusterEndX - clusterStartX)
    .attr("height", h)
    .attr("fill", "rgba(99, 102, 241, 0.08)")
    .attr("opacity", 0.6);

  // Hit zone (high popularity)
  if (hitBinIndex >= 0 && hitBinIndex < bins.length) {
    const hitStartX = x(bins[hitBinIndex].bin);
    g.append("rect")
      .attr("class", "pop-zone")
      .attr("x", hitStartX)
      .attr("y", 0)
      .attr("width", w - hitStartX)
      .attr("height", h)
      .attr("fill", "rgba(177, 22, 42, 0.12)")
      .attr("opacity", 0.7);
  }

  addGridY(g, y, w);

  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(bins.map((d) => d.bin).filter((_, i) => i % 2 === 0)))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  // Axis labels - larger and more visible
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Popularity Bins");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Track Count");

  const bars = g
    .selectAll(".pop-bar")
    .data(bins, (d) => d.bin)
    .enter()
    .append("rect")
    .attr("class", "pop-bar")
    .attr("x", (d) => x(d.bin))
    .attr("width", (d) => {
      const bw = x.bandwidth();
      // Ensure bars are at least 8px wide, or use full bandwidth if larger
      return Math.max(8, bw);
    })
    .attr("y", y(0))
    .attr("height", 0)
    .attr("rx", 4)
    .attr("fill", "#111")
    .style("cursor", "pointer")
    .style("stroke", "none")
    .style("stroke-width", 0);

  // Color bars based on zone
  bars.attr("fill", (d, i) => {
    if (hitBinIndex >= 0 && i >= hitBinIndex) {
      return "#b1162a"; // Red for hit zone
    }
    return "#111"; // Black for main cluster
  });

  // Animate bars growing
  bars
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("y", (d) => y(d.count))
    .attr("height", (d) => h - y(d.count));

  // Enhanced tooltips with interpretation
  bars
    .on("mouseenter", function(event, d) {
      // Highlight this bar
      d3.select(this)
        .transition()
        .duration(200)
        .attr("fill", "#6366f1")
        .attr("opacity", 1);
      
      // Dim others slightly
      bars.filter((_, i, nodes) => nodes[i] !== this)
        .transition()
        .duration(200)
        .attr("opacity", 0.5);

      const binNum = parseInt(d.bin.split("-")[0]);
      let interpretation = "";
      if (binNum >= 90) {
        interpretation = "This is the hit zone – only 1 in 10 tracks reaches this level. Most songs never get here.";
      } else if (binNum >= 70) {
        interpretation = "Above average popularity – these tracks are doing well but haven't broken through.";
      } else if (binNum >= 50) {
        interpretation = "Middle of the pack – most tracks cluster here in the long tail.";
      } else {
        interpretation = "Low popularity – these tracks live in obscurity, never reaching mainstream attention.";
      }

      showEnhancedTip(
        `Popularity: ${d.bin}`,
        `Tracks: ${Number(d.count).toLocaleString()}`,
        interpretation,
        event.clientX,
        event.clientY
      );
    })
    .on("mouseleave", function() {
      bars
        .transition()
        .duration(200)
        .attr("fill", (d, i) => {
          if (hitBinIndex >= 0 && i >= hitBinIndex) {
            return "#b1162a"; // Red for hit zone
          }
          return "#111"; // Black for main cluster
        })
        .attr("opacity", 1);
      hideTip();
    });

  // Add hit threshold line if available
  if (hitThreshold != null && hitBinIndex >= 0) {
    const thresholdX = x(bins[hitBinIndex].bin);
    
    // Vertical line at threshold
    g.append("line")
      .attr("x1", thresholdX)
      .attr("x2", thresholdX)
      .attr("y1", 0)
      .attr("y2", h)
      .attr("stroke", "#b1162a")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "6,4")
      .attr("opacity", 0.8);

    // Label for hit threshold
    g.append("text")
      .attr("x", thresholdX)
      .attr("y", -8)
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("font-weight", "800")
      .style("fill", "#b1162a")
      .text(`Hit threshold: ${Number(hitThreshold).toFixed(1)}`);
  }

  // Zone labels
  const clusterLabelX = clusterEndX / 2;
  const clusterLabelY = h * 0.15;
  
  g.append("text")
    .attr("x", clusterLabelX)
    .attr("y", clusterLabelY)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "700")
    .style("fill", "#6366f1")
    .text("Main cluster (long tail)");

  if (hitBinIndex >= 0 && hitBinIndex < bins.length) {
    const hitLabelX = (x(bins[hitBinIndex].bin) + w) / 2;
    const hitLabelY = h * 0.15;
    
    g.append("text")
      .attr("x", hitLabelX)
      .attr("y", hitLabelY)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "700")
      .style("fill", "#b1162a")
      .text("Hit zone (top 10%)");
  }
}

/* ---------- STEP 2: HIT THRESHOLD + QUANTILES (Audience-friendly) ---------- */
function drawHitDefinition(story) {
  const quantiles = story?.popularity_spectrum?.quantiles || {};
  const hit = story?.popularity_spectrum?.hit_threshold_top10;

  if (hit == null) {
    d3.select("#chart").append("p").text("No hit-threshold data found in story.json.");
    return;
  }

  const { wrap, svg, g, w, h } = baseSvg("Defining hit", "A simple \"gate\": top 10% by popularity (0–100)");

  const x = d3.scaleLinear().domain([0, 100]).range([0, w]);

  // Meter bar - Y position relative to chart height for better centering
  const barY = Math.max(60, h * 0.3);
  const barH = 18;

  // Background: non-hits (0 → hit threshold)
  g.append("rect")
    .attr("x", 0)
    .attr("y", barY)
    .attr("width", w)
    .attr("height", barH)
    .attr("rx", 9)
  .attr("fill", "#e9e9e9");

  // Hit zone (threshold → 100) segment to visually separate hits
  g.append("rect")
    .attr("x", x(hit))
    .attr("y", barY)
    .attr("width", Math.max(0, x(100) - x(hit)))
    .attr("height", barH)
    .attr("rx", 9)
    .attr("fill", "#111");

  // Threshold marker
  g.append("line")
    .attr("x1", x(hit))
    .attr("x2", x(hit))
    .attr("y1", barY - 14)
    .attr("y2", barY + barH + 14)
    .attr("stroke", "#111")
    .attr("stroke-width", 2);

  // Simple label
  g.append("text")
    .attr("x", x(hit))
    .attr("y", barY - 22)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", 900)
    .style("fill", "#111")
    .text(`Hit starts at ${Number(hit).toFixed(1)}+`);

  // Quantile ticks
  const tickData = [
    { label: "p10", v: quantiles.p10 },
    { label: "p25", v: quantiles.p25 },
    { label: "p50", v: quantiles.p50 },
    { label: "p75", v: quantiles.p75 },
  ].filter((d) => d.v != null);

  const ticks = g.append("g");

  ticks
    .selectAll("line.q")
    .data(tickData)
    .enter()
    .append("line")
    .attr("x1", (d) => x(d.v))
    .attr("x2", (d) => x(d.v))
    .attr("y1", barY + barH + 8)
    .attr("y2", barY + barH + 18)
    .attr("stroke", "#999")
    .attr("stroke-width", 1);

  ticks
    .selectAll("text.q")
    .data(tickData)
    .enter()
    .append("text")
    .attr("x", (d) => x(d.v))
    .attr("y", barY + barH + 35)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#777")
    .text((d) => d.label);

  // 10-dot pictogram - adjusted position for better centering
  const dots = g.append("g").attr("transform", `translate(0, 40)`);

  dots
    .append("text")
    .attr("x", 0)
    .attr("y", 0)
    .style("font-size", "12px")
    .style("fill", "#666")
    .text("Top 10% = 1 in 10 tracks");

  const dotY = 18;
  const dotR = 5;
  const gap = 14;

  const dotData = d3.range(10).map((i) => ({ i, filled: i === 9 }));
  dots
    .selectAll("circle")
    .data(dotData)
    .enter()
    .append("circle")
    .attr("cx", (d) => d.i * gap)
    .attr("cy", dotY)
    .attr("r", dotR)
    .attr("fill", (d) => (d.filled ? "#111" : "#d0d0d0"));

  // Text labels under the bar to separate hits vs non-hits
  const nonHitMid = x(hit) / 2;
  const hitMid = x(hit) + (x(100) - x(hit)) / 2;

  g.append("text")
    .attr("x", nonHitMid)
    .attr("y", barY + barH + 28)
    .attr("text-anchor", "middle")
    .style("font-size", 11)
    .style("fill", "#555")
    .text("Non-hits (~90% of tracks)");

  g.append("text")
    .attr("x", hitMid)
    .attr("y", barY + barH + 28)
    .attr("text-anchor", "middle")
    .style("font-size", 11)
    .style("fill", "#111")
    .style("font-weight", 700)
    .text("Hits (top 10%)");

  // Brief annotation explaining the gate
  // Position it centered or slightly left to avoid right-side clipping
  const annX = Math.min(w * 0.5, hitMid - 20); // Center or slightly left of hit zone center
  // Place below the bar to avoid clipping at the top
  const annY = barY + barH + 45;
  addAnnotation(
    g,
    annX,
    annY,
    "Only this slice – the top 10% by popularity – counts as \"hit\" in the rest of the story.",
    600,
    "bottom-center" // Center anchor so text spreads evenly
  );

}

/**
 * Appendix-only: small hit definition visual rendered into a footer container.
 * This does NOT touch the scrollytelling chart root (#chart).
 */
export function renderHitDefinitionAppendix(story, mountId = "hit-definition-appendix") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const hitThreshold = story?.hit_threshold ?? story?.popularity_spectrum?.hit_threshold_top10 ?? null;
  if (hitThreshold == null) return;

  // Clear mount
  d3.select(mount).selectAll("*").remove();

  const width = Math.max(320, mount.clientWidth || 520);
  const height = 140;
  const margin = { top: 14, right: 14, bottom: 34, left: 14 };
  const w = width - margin.left - margin.right;
  const h = height - margin.top - margin.bottom;

  const svg = d3
    .select(mount)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, 100]).range([0, w]);

  // Base track
  g.append("rect")
    .attr("x", 0)
    .attr("y", h / 2 - 10)
    .attr("width", w)
    .attr("height", 20)
    .attr("rx", 10)
    .attr("fill", "rgba(0,0,0,0.06)");

  // Hit zone (top 10%)
  const hitX = x(hitThreshold);
  const zone = g.append("rect")
    .attr("x", hitX)
    .attr("y", h / 2 - 10)
    .attr("width", w - hitX)
    .attr("height", 20)
    .attr("rx", 10)
    .attr("fill", "rgba(177, 22, 42, 0.18)")
    .attr("opacity", 0);

  // Threshold line
  const line = g.append("line")
    .attr("x1", hitX)
    .attr("x2", hitX)
    .attr("y1", h / 2 - 22)
    .attr("y2", h / 2 + 22)
    .attr("stroke", "#b1162a")
    .attr("stroke-width", 2.5)
    .attr("stroke-dasharray", "6,4")
    .attr("opacity", 0);

  g.append("text")
    .attr("x", 0)
    .attr("y", h + 22)
    .attr("text-anchor", "start")
    .style("fill", "#777")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .text("Popularity");

  const label = g.append("text")
    .attr("x", hitX)
    .attr("y", h / 2 - 28)
    .attr("text-anchor", "middle")
    .style("fill", "#b1162a")
    .style("font-size", "11px")
    .style("font-weight", "700")
    .attr("opacity", 0)
    .text(`Top 10% threshold (${hitThreshold.toFixed(0)}+)`);

  // Animate in
  zone.transition().duration(500).ease(d3.easeCubicOut).attr("opacity", 1);
  line.transition().duration(500).ease(d3.easeCubicOut).attr("opacity", 1);
  label.transition().duration(350).delay(250).attr("opacity", 1);
}

/* ---------- STEP 3: EFFECT SIZES ---------- */
/**
 * STEP 5: Feature Separation (Ranked by Effect Size)
 * Clean horizontal bar chart showing top 5 features that separate hits from non-hits
 * Centered on zero with Cohen's d effect sizes
 */
function renderFeatureSeparation(story) {
  const { g, w, h, svg } = baseSvg("What Separates Hits", "");

  // Get feature effects data
  let rows = story?.feature_effects || story?.effect_sizes || null;

  if (!Array.isArray(rows)) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No feature effects data found");
    return;
  }

  // Normalize and extract Cohen's d (standardized effect size)
  const cleaned = rows
    .map((r) => {
      const feature = r.feature ?? r.name ?? r.col;
      const cohens_d = Number(r.cohen_d ?? r.cohens_d ?? r.d ?? r.effect_size);
      const delta = Number(r.delta ?? r.diff ?? 0);
      
      if (!feature || !Number.isFinite(cohens_d)) return null;
      return { feature, cohens_d, delta };
    })
    .filter(Boolean);

  // Sort by absolute effect size and take top 5
  cleaned.sort((a, b) => Math.abs(b.cohens_d) - Math.abs(a.cohens_d));
  const data = cleaned.slice(0, 5);

  if (data.length === 0) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .text("No valid effect size data");
    return;
  }

  // Scales
  const maxAbsEffect = d3.max(data, (d) => Math.abs(d.cohens_d)) || 0.5;
  const domain = [-maxAbsEffect * 1.15, maxAbsEffect * 1.15];

  const x = d3.scaleLinear()
    .domain(domain)
    .range([0, w]);

  const y = d3.scaleBand()
    .domain(data.map((d) => d.feature))
    .range([0, h])
    .padding(0.35);

  // Zero line (centered)
  g.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", -15)
    .attr("y2", h + 15)
    .attr("stroke", "#aaa")
    .attr("stroke-width", 2);

  // Axis labels at top
  g.append("text")
    .attr("x", x(domain[0]))
    .attr("y", -25)
    .attr("text-anchor", "start")
    .style("fill", "#2563eb")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .text("← Lower in hits");

  g.append("text")
    .attr("x", x(domain[1]))
    .attr("y", -25)
    .attr("text-anchor", "end")
    .style("fill", "#b1162a")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .text("Higher in hits →");

  // Y-axis (feature labels)
  g.append("g")
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll(".tick line").remove())
    .selectAll("text")
    .style("fill", "#333")
    .style("font-size", "15px")
    .style("font-weight", "700")
    .style("text-transform", "capitalize");

  // Bars
  const bars = g
    .selectAll(".separation-bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "separation-bar")
    .attr("y", (d) => y(d.feature))
    .attr("height", y.bandwidth())
    .attr("x", (d) => (d.cohens_d >= 0 ? x(0) : x(d.cohens_d)))
    .attr("width", (d) => Math.abs(x(d.cohens_d) - x(0)))
    .attr("fill", (d) => (d.cohens_d >= 0 ? "#b1162a" : "#2563eb"))
    .attr("opacity", 0.85)
    .attr("rx", 3);

  // Effect size labels (on bars)
  g.selectAll(".effect-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "effect-label")
    .attr("y", (d) => y(d.feature) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("x", (d) => {
      const barEnd = d.cohens_d >= 0 ? x(d.cohens_d) : x(d.cohens_d);
      return barEnd + (d.cohens_d >= 0 ? 8 : -8);
    })
    .attr("text-anchor", (d) => (d.cohens_d >= 0 ? "start" : "end"))
    .style("fill", "#333")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .text((d) => {
      const sign = d.cohens_d >= 0 ? "+" : "";
      return `${sign}${d.cohens_d.toFixed(2)}`;
    });

  // Footer explanation
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 48)
    .attr("text-anchor", "middle")
    .style("fill", "#666")
    .style("font-size", "12px")
    .style("font-style", "italic")
    .text("Effect size (Cohen's d): measures strength of difference between hits and non-hits");

  // Annotation highlighting strongest separator
  const strongest = data[0];
  const strongestX = strongest.cohens_d >= 0 ? x(strongest.cohens_d) + 20 : x(strongest.cohens_d) - 20;
  const strongestY = y(strongest.feature) + y.bandwidth() / 2;

  setTimeout(() => {
    addAnnotation(
      svg,
      strongestX + 60,
      strongestY - 30,
      `Strongest separator: ${strongest.feature}`,
      0,
      "top-right"
    );
  }, 600);
}

function drawEffectSizes(story) {
  const mode = (localStorage.getItem("audienceMode") || "culture").toLowerCase();
  const { g, w, h } = baseSvg(
    "Feature anatomy",
    mode === "producer"
      ? "Which features separate hits vs non-hits the most?"
      : "Do hits \"sound\" different — and which features move most?"
  );

  // Try to find a table
  let rows =
    story?.feature_effects ||
    story?.effect_sizes ||
    story?.feature_anatomy?.effect_sizes ||
    story?.feature_anatomy?.effects ||
    null;

  if (!Array.isArray(rows)) {
    // fallback: derive from hit blueprint if present
    const hb = story?.hit_blueprint?.feature_table || story?.hit_blueprint?.features || null;
    if (Array.isArray(hb)) {
      rows = hb
        .map((r) => {
          const feature = r.feature ?? r.name ?? r.col;
          const hit = Number(r.hit_mean ?? r.hit ?? r.hit_avg);
          const all = Number(r.all_mean ?? r.overall_mean ?? r.all ?? r.overall);
          if (!feature || !Number.isFinite(hit) || !Number.isFinite(all)) return null;
          return { feature, delta: hit - all };
        })
        .filter(Boolean);
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No feature anatomy data found in story.json");
    return;
  }

  // Normalize to {feature, delta}
  const cleaned = rows
    .map((r) => {
      const feature = r.feature ?? r.name ?? r.col ?? r.audio_feature;
      const delta = Number(r.delta ?? r.diff ?? r.effect ?? r.effect_size ?? r.value ?? r.abs_diff);
      if (!feature || !Number.isFinite(delta)) return null;
      return { feature, delta };
    })
    .filter(Boolean);

  // Sort by absolute impact so the most important features rise to the top
  cleaned.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Keep the top 10 strongest separators
  const data = cleaned.slice(0, 10);

  const margin = { top: 48, right: 120, bottom: 120, left: 140 }; // Increased right margin for labels
  const innerW = w - margin.left - margin.right;
  const innerH = h - margin.top - margin.bottom;

  const maxAbs = d3.max(data, (d) => Math.abs(d.delta)) || 1;
  const x = d3.scaleLinear().domain([-maxAbs, maxAbs]).nice().range([0, innerW]);
  const y = d3.scaleBand().domain(data.map((d) => d.feature)).range([0, innerH]).padding(0.25);

  const root = g.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  root
    .append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#111")
    .attr("stroke-opacity", 0.2)
    .attr("stroke-width", 2);

  const bars = root
    .selectAll("rect")
    .data(data)
    .enter()
    .append("rect")
    .attr("y", (d) => y(d.feature))
    .attr("height", y.bandwidth())
    .attr("x", (d) => x(Math.min(0, d.delta)))
    .attr("width", 0) // Start at 0 for animation
    .attr("rx", 10)
    .attr("fill", "#111")
    .attr("opacity", 0.9)
    .attr("class", "feature-bar");

  // Visually emphasize the most impactful features (top 3 by |Δ|)
  const topHighlightCount = Math.min(3, data.length);
  const topSet = new Set(data.slice(0, topHighlightCount).map((d) => d.feature));

  bars
    .attr("fill", (d) => (topSet.has(d.feature) ? "#b1162a" : "#111"))
    .attr("opacity", (d) => (topSet.has(d.feature) ? 1 : 0.7));

  // Animate bars growing
  bars
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("width", (d) => Math.abs(x(d.delta) - x(0)));

  // Enhanced tooltips with interpretation
  bars
    .on("mouseenter", function(event, d) {
      const isTop = topSet.has(d.feature);

      // Highlight this bar
      d3.select(this)
        .transition()
        .duration(200)
        .attr("opacity", 1)
        .attr("fill", isTop ? "#b1162a" : "#6366f1");

      // Dim others slightly
      bars
        .filter((_, i, nodes) => nodes[i] !== this)
        .transition()
        .duration(200)
        .attr("opacity", (d2) => (topSet.has(d2.feature) ? 0.6 : 0.25));

      // Show enhanced tooltip
      const interpretations = {
        "instrumentalness": "Hits are significantly less instrumental – they need vocals for emotional connection. This is the strongest separator between hits and non-hits.",
        "loudness": "Louder songs perform better – they survive compression in playlists and grab attention in crowded feeds.",
        "danceability": "Danceable songs outperform – they work in clubs, on TikTok, and in playlists. Movement drives engagement.",
        "energy": "Energetic tracks capture attention – perfect for short attention spans in the streaming era.",
        "valence": "Positive mood correlates with popularity – people seek uplift in their music, especially during tough times.",
        "acousticness": "Hits tend to be less acoustic – electronic production dominates the charts.",
        "speechiness": "Speech-heavy tracks (rap, spoken word) have unique patterns – genre matters more than overall trend.",
        "liveness": "Live recordings are rare in hits – studio polish wins in streaming.",
        "tempo": "Tempo varies by genre, but hits often cluster in the 120-130 BPM range – the 'sweet spot' for dancing.",
        "duration_min": "Shorter songs correlate weakly with popularity – the 'TikTok brain' effect is subtle but real."
      };
      
      showEnhancedTip(
        d.feature,
        `Difference (hits − average): ${d.delta.toFixed(3)}`,
        interpretations[d.feature.toLowerCase()] || `This feature separates hits from the average. The direction matters: positive means hits score higher.`,
        event.clientX,
        event.clientY
      );
    })
    .on("mouseleave", function() {
      // Restore all
      bars
        .transition()
        .duration(200)
        .attr("opacity", (d) => (topSet.has(d.feature) ? 1 : 0.7))
        .attr("fill", (d) => (topSet.has(d.feature) ? "#b1162a" : "#111"));
      hideTip();
    });

  // Short annotations + numeric labels for the top features
  if (data.length > 0) {
    const topFeature = data[0];
    const topY = y(topFeature.feature) + y.bandwidth() / 2;
    const topX = x(topFeature.delta) + (topFeature.delta > 0 ? 24 : -24); // Offset to side

    setTimeout(() => {
      addAnnotation(
        root,
        topX,
        topY,
        `Strongest separator: ${topFeature.feature}`,
        800,
        topFeature.delta > 0 ? "top-right" : "top-left"
      );
    }, 900); // Wait for bars to finish animating
  }

  // Numeric labels on the right side of each top-3 bar
  if (topHighlightCount > 0) {
    const labelData = data.slice(0, topHighlightCount);

    // Remove any existing labels first to prevent duplicates
    root.selectAll(".feature-delta-label").remove();

    root
      .selectAll(".feature-delta-label")
      .data(labelData)
      .enter()
      .append("text")
      .attr("class", "feature-delta-label")
      .attr("x", (d) => {
        // Position near the center (zero line) for better visibility
        const zeroX = x(0); // Center of chart
        const offset = d.delta > 0 ? 20 : -20; // Small offset from center
        return zeroX + offset;
      })
      .attr("y", (d) => y(d.feature) + y.bandwidth() / 2) // Vertically centered with the bar
      .attr("text-anchor", "middle") // Center-align since we're near the middle
      .attr("alignment-baseline", "middle")
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#b1162a")
      .text((d, i) => `${i + 1}. Difference: ${d.delta.toFixed(2)}`);
  }

  root.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-weight", 800)
    .style("font-size", `${AXIS_TICK_SIZE}px`);
  root
    .append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-weight", 800)
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  // Axis labels
  root.append("text")
    .attr("text-anchor", "middle")
    .attr("x", innerW / 2)
    .attr("y", innerH + 35)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Difference (Hits - Average)");

  root.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -120)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Audio Feature");

  // Footer explanation - positioned well below the chart (relative to root, which is already translated)
  root.append("text")
    .attr("text-anchor", "start")
    .attr("x", 0)
    .attr("y", innerH + 70)
    .style("fill", "#666")
    .style("font-size", "12px")
    .style("font-weight", 600)
    .text(
      mode === "producer"
        ? "Difference = hit average − overall average (positive = hits score higher)"
        : "Difference shows how the average hit compares to the overall average"
    );
}

/* ---------- STEP 4: FEATURE LINES (0..1) ---------- */
/**
 * STEP 6: The Vibe Shift
 * Animated line chart showing how danceability, energy, and valence
 * change across popularity bands. Dynamic and musical.
 */
function renderVibeShift(story) {
  const rows = story?.feature_anatomy?.means_by_pop_band || [];
  const features = ["danceability", "energy", "valence"];
  
  const { g, w, h, svg } = baseSvg("The Vibe Shift", "");

  if (!rows.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No feature profile data found");
    return;
  }

  // Validate data
  const validKeys = features.filter((k) => rows[0] && k in rows[0]);
  if (!validKeys.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .text("Missing feature data");
    return;
  }

  const bands = rows.map((d) => d.pop_band);
  
  // Scales
  const x = d3.scalePoint()
    .domain(bands)
    .range([0, w])
    .padding(0.15);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([h, 0]);

  // Highlight zone for highest popularity band
  const lastBandX = x(bands[bands.length - 1]);
  const bandWidth = w / bands.length;
  
  g.append("rect")
    .attr("class", "highlight-zone")
    .attr("x", lastBandX - bandWidth / 2)
    .attr("y", 0)
    .attr("width", bandWidth)
    .attr("height", h)
    .attr("fill", "rgba(177, 22, 42, 0.08)")
    .attr("opacity", 0)
    .transition()
    .duration(800)
    .delay(1400)
    .attr("opacity", 1);

  // Subtle grid
  addGridY(g, y, w);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(bands.filter((_, i) => i % 2 === 0)))
    .call((g) => g.select(".domain").attr("stroke", "#ddd"))
    .selectAll("text")
    .style("fill", "#555")
    .style("font-size", "11px")
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".1f")))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("fill", "#555")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  // Axis labels
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 40)
    .attr("text-anchor", "middle")
    .style("fill", "#444")
    .style("font-size", "12px")
    .style("font-weight", "600")
    .text("Popularity →");

  // Musical color palette (restrained but vibrant)
  const palette = {
    danceability: "#6366f1", // Indigo (rhythm)
    energy: "#b1162a",       // Red (intensity)
    valence: "#f59e0b"       // Amber (mood)
  };

  // Line generator with smooth curve
  const line = d3.line()
    .x((d) => x(d.pop_band))
    .y((d) => y(d.value))
    .curve(d3.curveCatmullRom.alpha(0.5));

  // Prepare line data for each feature
  const lineData = validKeys.map((key) => ({
    key,
    values: rows.map((d) => ({
      pop_band: d.pop_band,
      value: Number(d[key]) || 0
    }))
  }));

  // Draw lines (initially invisible for animation)
  lineData.forEach((series, idx) => {
    const path = g.append("path")
      .datum(series.values)
      .attr("class", `vibe-line vibe-line-${series.key}`)
      .attr("fill", "none")
      .attr("stroke", palette[series.key])
      .attr("stroke-width", 3.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .attr("d", line)
      .attr("opacity", 0);

    // Animate line drawing
    const totalLength = path.node().getTotalLength();
    
    path
      .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
      .attr("stroke-dashoffset", totalLength)
      .attr("opacity", 0.9)
      .transition()
      .duration(1200)
      .delay(idx * 200)
      .ease(d3.easeCubicInOut)
      .attr("stroke-dashoffset", 0);
  });

  // Add endpoint circles (appear after lines)
  setTimeout(() => {
    validKeys.forEach((key) => {
      const lastPoint = rows[rows.length - 1];
      const value = Number(lastPoint[key]) || 0;
      
      g.append("circle")
        .attr("class", `endpoint-${key}`)
        .attr("cx", x(lastPoint.pop_band))
        .attr("cy", y(value))
        .attr("r", 0)
        .attr("fill", palette[key])
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .transition()
        .duration(400)
        .attr("r", 6);
    });
  }, 1400);

  // Legend (fade in after lines)
  const legend = g.append("g")
    .attr("class", "vibe-legend")
    .attr("transform", `translate(${w - 120}, 20)`)
    .attr("opacity", 0);

  validKeys.forEach((key, i) => {
    const legendRow = legend.append("g")
      .attr("transform", `translate(0, ${i * 24})`);

    legendRow.append("line")
      .attr("x1", 0)
      .attr("x2", 20)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", palette[key])
      .attr("stroke-width", 3);

    legendRow.append("text")
      .attr("x", 28)
      .attr("y", 4)
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("fill", "#333")
      .style("text-transform", "capitalize")
      .text(key);
  });

  legend
    .transition()
    .duration(600)
    .delay(1600)
    .attr("opacity", 1);
}

function drawFeatureLines01(story) {
  const rows = story?.feature_anatomy?.means_by_pop_band || [];
  const keys = ["danceability", "energy", "valence"].filter((k) => rows[0] && k in rows[0]);

  const { g, w, h } = baseSvg(
    "Feature profile across popularity",
    "Averages by 10-point popularity band (0..1 features)"
  );

  if (!rows.length || !keys.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No feature profile data found in story.json");
    return;
  }

  const bands = rows.map((d) => d.pop_band);
  const x = d3.scalePoint().domain(bands).range([0, w]).padding(0.3);
  const y = d3.scaleLinear().domain([0, 1]).range([h, 0]);

  addGridY(g, y, w);

  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  g.append("g")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Popularity Band");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Feature Value (0-1)");

  // Special colors and emphasis for energy and danceability
  const getColor = (k) => {
    if (k === "energy") return "#b1162a"; // Red for energy
    if (k === "danceability") return "#6366f1"; // Blue for danceability
    return "#999"; // Grey for others
  };
  
  const getStrokeWidth = (k) => {
    if (k === "energy" || k === "danceability") return 3.5; // Thicker for emphasis
    return 2.2;
  };

  const line = d3
    .line()
    .x((d) => x(d.pop_band))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const lineGroup = g.append("g").attr("class", "feature-lines");
  
  keys.forEach((k) => {
    const pts = rows.map((r) => ({ pop_band: r.pop_band, value: Number(r[k]) }));

    const path = lineGroup
      .append("path")
      .datum(pts)
      .attr("fill", "none")
      .attr("stroke", getColor(k))
      .attr("stroke-width", getStrokeWidth(k))
      .attr("class", `line-${k}`)
      .attr("d", line)
      .style("cursor", "pointer");

    // Animate line drawing
    const n = path.node();
    if (n) {
      const len = n.getTotalLength();
      path
        .attr("stroke-dasharray", `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .transition()
        .duration(700)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    }

    // Add hover highlighting
    path
      .on("mouseenter", function() {
        // Highlight this line
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", 4)
          .attr("opacity", 1);
        
        // Dim others
        lineGroup.selectAll("path")
          .filter((_, i, nodes) => nodes[i] !== this)
          .transition()
          .duration(200)
          .attr("opacity", 0.2);
      })
      .on("mouseleave", function() {
        // Restore all
        lineGroup.selectAll("path")
          .transition()
          .duration(200)
          .attr("stroke-width", function() {
            const className = d3.select(this).attr("class");
            const key = className ? className.replace("line-", "") : "";
            return getStrokeWidth(key);
          })
          .attr("opacity", 1);
      });

    const interpretations = {
      "danceability": "Danceability rises with popularity – successful songs work in clubs and on TikTok. Movement drives engagement.",
      "energy": "Energetic tracks capture attention – perfect for short attention spans in the streaming era.",
      "valence": "Positive mood correlates with popularity – people seek uplift in their music, especially during tough times."
    };

    // Interactive circles with enhanced tooltips - larger for energy and danceability
    const isHighlight = k === "energy" || k === "danceability";
    const circleRadius = isHighlight ? 5 : 3.4;
    g.selectAll(`circle.${k}`)
      .data(pts)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.pop_band))
      .attr("cy", (d) => y(d.value))
      .attr("r", circleRadius)
      .attr("fill", getColor(k))
      .attr("stroke", isHighlight ? "#fff" : "none")
      .attr("stroke-width", isHighlight ? 1.5 : 0)
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isHighlight ? 8 : 6);
        
        showEnhancedTip(
          k,
          `Band: ${d.pop_band} | Value: ${d.value.toFixed(3)}`,
          interpretations[k.toLowerCase()] || `This feature evolves across popularity bands. Higher bands show different patterns.`,
          event.clientX,
          event.clientY
        );
      })
      .on("mouseleave", function() {
        const isHighlight = k === "energy" || k === "danceability";
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", isHighlight ? 5 : 3.4);
        hideTip();
      });
  });

  // Add callouts for energy and danceability showing the trend
  setTimeout(() => {
    ["energy", "danceability"].forEach((k) => {
      if (!keys.includes(k)) return;
      
      const pts = rows.map((r) => ({ pop_band: r.pop_band, value: Number(r[k]) }));
      const firstValue = pts[0].value;
      const lastValue = pts[pts.length - 1].value;
      const change = lastValue - firstValue;
      
      // Only add callout if there's a meaningful change
      if (Math.abs(change) > 0.05) {
        // Position callout in the middle of the chart for better visibility
        const midIndex = Math.floor(pts.length / 2);
        const midX = x(pts[midIndex].pop_band);
        const midY = y(pts[midIndex].value);
        
        const increaseText = change > 0 
          ? `Rises from ${firstValue.toFixed(2)} to ${lastValue.toFixed(2)} (+${change.toFixed(2)})`
          : `Drops from ${firstValue.toFixed(2)} to ${lastValue.toFixed(2)} (${change.toFixed(2)})`;
        
        // Single callout in the middle showing the full trend
        addAnnotation(
          g,
          midX,
          midY - 20,
          `${k.charAt(0).toUpperCase() + k.slice(1)} ${increaseText}`,
          1000 + (k === "danceability" ? 200 : 0),
          "top-center"
        );
      }
    });
  }, 1500); // Wait for lines to finish animating
}

/* ---------- STEP 5: STRUCTURE (tempo + duration) ---------- */
function drawStructureLines(story) {
  const rows = story?.feature_anatomy?.means_by_pop_band || [];

  const { g, w, h, svg } = baseSvg("Structure Profile: Duration vs Tempo", "");

  if (!rows.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No structure data found");
    return;
  }

  // Prepare data: each row represents a popularity band
  const data = rows.map((r) => ({
    band: r.pop_band,
    tempo: Number(r.tempo || 120),
    duration: Number(r.duration_min || 3.5),
    isHit: r.pop_band.startsWith("9") || r.pop_band.startsWith("8"), // top 20% bands
  }));

  // Scales
  const xExtent = d3.extent(data, (d) => d.tempo);
  const yExtent = d3.extent(data, (d) => d.duration);
  
  const x = d3.scaleLinear()
    .domain([xExtent[0] - 5, xExtent[1] + 5])
    .range([0, w])
    .nice();

  const y = d3.scaleLinear()
    .domain([yExtent[0] - 0.3, yExtent[1] + 0.3])
    .range([h, 0])
    .nice();

  // Grid
  addGridY(g, y, w);

  // Axes
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(8))
    .call((g) => g.select(".domain").attr("stroke", "#ddd"))
    .selectAll("text")
    .style("fill", "#555")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("fill", "#555")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  // Add axis break indicators (showing axes don't start at 0)
  // X-axis break
  const xBreak = g.append("g").attr("class", "axis-break");
  xBreak.append("line")
    .attr("x1", -8)
    .attr("y1", h - 5)
    .attr("x2", 8)
    .attr("y2", h + 5)
    .attr("stroke", "#999")
    .attr("stroke-width", 2);
  xBreak.append("line")
    .attr("x1", -8)
    .attr("y1", h + 5)
    .attr("x2", 8)
    .attr("y2", h - 5)
    .attr("stroke", "#999")
    .attr("stroke-width", 2);

  // Y-axis break
  const yBreak = g.append("g").attr("class", "axis-break");
  yBreak.append("line")
    .attr("x1", -5)
    .attr("y1", h + 8)
    .attr("x2", 5)
    .attr("y2", h - 8)
    .attr("stroke", "#999")
    .attr("stroke-width", 2);
  yBreak.append("line")
    .attr("x1", -5)
    .attr("y1", h - 8)
    .attr("x2", 5)
    .attr("y2", h + 8)
    .attr("stroke", "#999")
    .attr("stroke-width", 2);

  // Add note about non-zero axes
  g.append("text")
    .attr("x", -5)
    .attr("y", h + 30)
    .attr("text-anchor", "start")
    .style("fill", "#888")
    .style("font-size", "10px")
    .style("font-style", "italic")
    .text("⚠ Axes do not start at 0");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 45)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Tempo (BPM)");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -45)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Duration (minutes)");

  // Add tempo clustering annotation (shows the tight range)
  const tempoRange = xExtent[1] - xExtent[0];
  g.append("rect")
    .attr("x", x(xExtent[0]))
    .attr("y", 0)
    .attr("width", x(xExtent[1]) - x(xExtent[0]))
    .attr("height", h)
    .attr("fill", "#4682B4")  // Steel blue - neutral color
    .attr("opacity", 0.08)
    .attr("stroke", "#4682B4")
    .attr("stroke-width", 1.5)
    .attr("stroke-dasharray", "5,3");

  // Add explanatory label on the shaded area - moved lower for readability
  g.append("text")
    .attr("x", x(xExtent[0]) + (x(xExtent[1]) - x(xExtent[0])) / 2)
    .attr("y", h * 0.65)  // Moved from 50% to 65% down
    .attr("text-anchor", "middle")
    .style("fill", "#2E5C7A")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("font-style", "italic")
    .style("opacity", 0)
    .text(`↔ All bands cluster within ${tempoRange.toFixed(1)} BPM ↔`)
    .transition()
    .duration(600)
    .delay(1200)
    .style("opacity", 0.7);

  // Points
  const points = g
    .selectAll(".structure-point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "structure-point")
    .attr("cx", (d) => x(d.tempo))
    .attr("cy", (d) => y(d.duration))
    .attr("r", 0)
    .attr("fill", (d) => (d.isHit ? "#b1162a" : "#666"))
    .attr("opacity", (d) => (d.isHit ? 0.9 : 0.4))
    .attr("stroke", (d) => (d.isHit ? "#8b0000" : "none"))
    .attr("stroke-width", 2);

  // Animate points in
  points
    .transition()
    .duration(600)
    .delay((d, i) => i * 80)
    .ease(d3.easeCubicOut)
    .attr("r", (d) => (d.isHit ? 10 : 7));

  // Add labels for each point with smart positioning to avoid overlap
  const labels = g
    .selectAll(".band-label")
    .data(data)
    .enter()
    .append("text")
    .attr("class", "band-label")
    .attr("x", (d, i) => {
      // Offset labels slightly to the right for odd indices
      return x(d.tempo) + (i % 2 === 0 ? 0 : 8);
    })
    .attr("y", (d, i) => {
      // Alternate labels above and below to reduce overlap
      const offset = i % 2 === 0 ? -18 : -12;
      return y(d.duration) + offset;
    })
    .attr("text-anchor", (d, i) => i % 2 === 0 ? "middle" : "start")
    .style("fill", (d) => (d.isHit ? "#b1162a" : "#444"))
    .style("font-size", "10px")
    .style("font-weight", "700")
    .style("opacity", 0)
    .text((d) => d.band);

  labels
    .transition()
    .duration(400)
    .delay((d, i) => i * 80 + 400)
    .style("opacity", 0.9);

  // Add annotations in clear positions
  setTimeout(() => {
    // Tempo clustering annotation - more centered
    addAnnotation(
      svg,
      w * 0.50,
      h * 0.20,
      `Tempo clustering: ${tempoRange.toFixed(1)} BPM range`,
      400,
      "top-center"
    );

    // Duration variation annotation - moved more to center-right
    addAnnotation(
      svg,
      w * 0.70,
      h * 0.88,
      "Duration varies more than tempo",
      350,
      "bottom-right"
    );

    // Key insight annotation - moved further down below the title
    g.append("text")
      .attr("x", w / 2)
      .attr("y", -5)
      .attr("text-anchor", "middle")
      .style("fill", "#b1162a")
      .style("font-size", "12px")
      .style("font-weight", "700")
      .style("opacity", 0)
      .text("Red = top 20% popularity bands (hits)")
      .transition()
      .duration(400)
      .style("opacity", 1);
  }, 1000);
}

/* ---------- STEP 6: GENRE HEATMAP ---------- */
/**
 * STEP 8: Genre Fingerprint Heatmap
 * Clean z-score heatmap showing top 8 genres
 * Features on x-axis, genres on y-axis
 */
function renderGenreFingerprint(story) {
  const allZScores = story?.genre_fingerprints?.z_scores || [];
  const allGenres = story?.genre_fingerprints?.top_genres || [];
  const features = story?.genre_fingerprints?.features || [];

  const { g, w, h, svg } = baseSvg("Genre Fingerprints", "");

  if (!allZScores.length || !allGenres.length || !features.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No genre fingerprint data found");
    return;
  }

  // Select 5 most distinctive genres for clarity
  // Prioritize: pop (baseline), grunge, chill, hip-hop, progressive-house
  const targetGenres = ["pop", "grunge", "chill", "hip-hop", "progressive-house"];
  const genres = targetGenres.filter(g => allGenres.includes(g));
  
  // If any are missing, fill from top genres
  if (genres.length < 5) {
    for (const g of allGenres) {
      if (!genres.includes(g) && genres.length < 5) {
        genres.push(g);
      }
    }
  }
  
  // Filter z-scores to only include selected genres
  const zScores = allZScores.filter((d) => genres.includes(d.genre));

  // Scales
  const x = d3.scaleBand()
    .domain(features)
    .range([0, w])
    .padding(0.12);

  const y = d3.scaleBand()
    .domain(genres)
    .range([0, h])
    .padding(0.15);

  // Diverging color scale (blue = below average, red = above average)
  const maxAbs = d3.max(zScores, (d) => Math.abs(d.z)) || 2;
  const color = d3.scaleDiverging()
    .domain([-maxAbs, 0, maxAbs])
    .interpolator(d3.interpolateRdBu);

  // X-axis (features)
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("fill", "#444")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("text-transform", "capitalize");

  // Y-axis (genres)
  g.append("g")
    .call(d3.axisLeft(y))
    .call((g) => g.select(".domain").remove())
    .selectAll("text")
    .style("fill", "#333")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("text-transform", "capitalize");

  // Heatmap cells with visual emphasis on extremes
  const cells = g
    .selectAll(".fingerprint-cell")
    .data(zScores)
    .enter()
    .append("rect")
    .attr("class", "fingerprint-cell")
    .attr("x", (d) => x(d.feature))
    .attr("y", (d) => y(d.genre))
    .attr("width", x.bandwidth())
    .attr("height", y.bandwidth())
    .attr("rx", 3)
    .attr("fill", (d) => color(d.z))
    .attr("opacity", (d) => {
      // Emphasize extreme values (highly distinct)
      const absZ = Math.abs(d.z);
      if (absZ > 1.5) return 1.0;  // Strong distinctiveness
      if (absZ > 0.8) return 0.9;  // Moderate distinctiveness
      return 0.6;  // Low distinctiveness (convergence)
    })
    .style("cursor", "pointer")
    .attr("stroke", (d) => {
      // Border for highly distinctive cells
      return Math.abs(d.z) > 1.5 ? "#333" : "none";
    })
    .attr("stroke-width", (d) => Math.abs(d.z) > 1.5 ? 1.5 : 0);

  // Tooltip on hover
  cells
    .on("mouseover", function (event, d) {
      d3.select(this).attr("opacity", 1).attr("stroke", "#333").attr("stroke-width", 2);
      
      const direction = d.z > 0 ? "above" : "below";
      const absZ = Math.abs(d.z).toFixed(2);
      showTip(
        `<strong>${d.genre}</strong><br/>${d.feature}: ${absZ}σ ${direction} average`,
        event.pageX,
        event.pageY
      );
    })
    .on("mouseout", function () {
      d3.select(this).attr("opacity", 0.85).attr("stroke", "none");
      hideTip();
    });

  // Legend
  const legendWidth = 200;
  const legendHeight = 12;
  const legendX = w - legendWidth - 10;
  const legendY = -35;

  const legendScale = d3.scaleLinear()
    .domain([-maxAbs, maxAbs])
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat((d) => (d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)));

  // Gradient for legend
  const defs = svg.select("defs").empty() ? svg.append("defs") : svg.select("defs");
  
  const gradient = defs.append("linearGradient")
    .attr("id", "fingerprint-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%");

  const numStops = 20;
  for (let i = 0; i <= numStops; i++) {
    const t = i / numStops;
    const value = -maxAbs + t * (2 * maxAbs);
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", color(value));
  }

  const legend = g.append("g")
    .attr("class", "fingerprint-legend")
    .attr("transform", `translate(${legendX}, ${legendY})`);

  legend.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#fingerprint-gradient)")
    .attr("rx", 2);

  legend.append("g")
    .attr("transform", `translate(0, ${legendHeight})`)
    .call(legendAxis)
    .selectAll("text")
    .style("font-size", "10px")
    .style("fill", "#666");

  legend.append("text")
    .attr("x", legendWidth / 2)
    .attr("y", -8)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("font-weight", "600")
    .style("fill", "#444")
    .text("Z-score (σ from average)");

  // Calculate convergence metric: avg absolute z-score
  const avgAbsZ = d3.mean(zScores, (d) => Math.abs(d.z));
  
  // Verdict based on average deviation
  let verdict = "";
  if (avgAbsZ < 0.5) {
    verdict = "Genres are converging — sonic fingerprints are blurring.";
  } else if (avgAbsZ < 1.0) {
    verdict = "Genres remain partially distinct — overlapping, but identifiable.";
  } else {
    verdict = "Genres stay clearly distinct — sonic identities persist.";
  }

  // Add verdict text at the bottom
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 55)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .style("font-weight", "700")
    .style("font-style", "italic")
    .style("fill", "#b1162a")
    .text(verdict);

  // Add subtle context note
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h + 72)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "#666")
    .text(`(Avg deviation: ${avgAbsZ.toFixed(2)}σ across ${zScores.length} feature-genre pairs)`);
}

function drawGenreHeatmap(story) {
  const z = story?.genre_fingerprints?.z_scores || [];
  const genres = story?.genre_fingerprints?.top_genres || [];
  const features = story?.genre_fingerprints?.features || [];

  // Use baseSvg but make the heatmap moderately larger (not huge)
  const { g, w, h, svg } = baseSvg("Genre fingerprints", "Z-scores of feature means (selected top genres)");
  
  const gridH = h * 0.9;
  
  // Adjust SVG height to accommodate larger heatmap + legend
  // Make sure we have enough space for the grid + axis + labels + legend
  const currentHeight = +svg.attr("height");
  const extraSpaceNeeded = (gridH - h) + 120; // Space for bigger grid + axis labels + legend
  svg.attr("height", Math.max(currentHeight + extraSpaceNeeded, gridH + 150)); // Ensure enough height
  svg.style("overflow", "visible"); // Allow SVG to extend beyond container if needed

  if (!z.length || !genres.length || !features.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", gridH / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No genre fingerprint heatmap data found in story.json");
    return;
  }

  // Standard padding - normal size, shifted slightly to the right
  const xOffset = 40; // Shift heatmap a bit more to the right
  const x = d3.scaleBand().domain(features).range([xOffset, w]).padding(0.10);
  const y = d3.scaleBand().domain(genres).range([0, gridH]).padding(0.12);

  const maxAbs = d3.max(z, (d) => Math.abs(d.z)) || 1;

  const color = d3.scaleDiverging().domain([-maxAbs, 0, maxAbs]).interpolator(d3.interpolateRdBu);

  const normalizeGenre = (value) => String(value || "").toLowerCase();
  const keyGenreSet = new Set([
    "pop",
    "k-pop",
    "hip hop",
    "rap",
    "rock",
    "metal",
    "edm",
    "dance"
  ]);
  const keyGenres = genres.filter((genre) => keyGenreSet.has(normalizeGenre(genre)));
  const isKeyGenre = (genre) => keyGenreSet.has(normalizeGenre(genre));

  g.append("g")
    .attr("transform", `translate(0,${gridH + 25})`) // Move x-axis ticks further down
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600");

  const yAxis = g.append("g")
    .call(d3.axisLeft(y));

  yAxis.selectAll("text")
    .style("fill", (d) => (isKeyGenre(d) ? "#111" : "#444"))
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", (d) => (isKeyGenre(d) ? "800" : "600"));

  if (keyGenres.length) {
    yAxis.selectAll("circle.key-genre-dot")
      .data(keyGenres)
      .enter()
      .append("circle")
      .attr("class", "key-genre-dot")
      .attr("cx", -10)
      .attr("cy", (d) => y(d) + y.bandwidth() / 2)
      .attr("r", 3)
      .attr("fill", "#111")
      .attr("opacity", 0.7);
  }

  const cells = g
    .selectAll("rect.cell")
    .data(z.filter((d) => genres.includes(d.genre) && features.includes(d.feature)))
    .enter()
    .append("rect")
    .attr("class", "cell")
    .attr("x", (d) => x(d.feature))
    .attr("y", (d) => y(d.genre))
    .attr("width", (d) => Math.max(10, x.bandwidth())) // Minimum 10px width
    .attr("height", (d) => Math.max(18, y.bandwidth())) // Minimum 18px height
    .attr("rx", 4)
    .attr("fill", (d) => color(d.z))
    .style("cursor", "pointer")
    .style("opacity", 0.9);

  // Animate cells appearing
  cells
    .style("opacity", 0)
    .transition()
    .duration(300)
    .delay((d, i) => i * 10)
    .style("opacity", 0.9);

  cells
    .on("mouseenter", function(event, d) {
      // Highlight this cell
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#111")
        .attr("stroke-width", 3)
        .style("opacity", 1);
      
      // Dim others in same row/column
      cells.filter((cell) => 
        (cell.genre === d.genre || cell.feature === d.feature) && cell !== d
      )
        .transition()
        .duration(200)
        .style("opacity", 0.4);

      const interpretation = `Z-score of ${Number(d.z).toFixed(2)} means this genre is ${Math.abs(d.z).toFixed(1)} standard deviations ${d.z > 0 ? 'above' : 'below'} the average for ${d.feature}. ${d.z > 1 ? 'This is a defining characteristic of ' + d.genre + '. The genre' : d.z < -1 ? d.genre + ' tends to avoid this feature.' : 'This is close to average.'}`;

      showEnhancedTip(
        `${d.genre} - ${d.feature}`,
        `Z-score: ${Number(d.z).toFixed(2)}`,
        interpretation,
        event.clientX,
        event.clientY
      );
    })
    .on("mouseleave", function(event, d) {
      // Restore all
      cells
        .transition()
        .duration(200)
        .attr("stroke", null)
        .attr("stroke-width", null)
        .style("opacity", 0.9);
      hideTip();
    });

  // Axis labels - positioned FIRST so they're visible, moved further down
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", (w + xOffset) / 2) // Center adjusted for the shift
    .attr("y", gridH + 105) // Moved further down
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Audio Feature");

  // Legend - positioned BELOW the x-axis label, moved further down
  const legendW = Math.min(220, w * 0.55);
  const legendH = 10;
  const legendX = w - legendW; // Keep legend at right edge
  const legendY = gridH + 140; // Moved further down

  // Get existing defs from svg (created by baseSvg) or create new one
  const svgNode = svg.node();
  let defs = d3.select(svgNode).select("defs");
  if (defs.empty()) {
    defs = svg.append("defs");
  }
  const grad = defs
    .append("linearGradient")
    .attr("id", "zLegend")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  grad.append("stop").attr("offset", "0%").attr("stop-color", color(-maxAbs));
  grad.append("stop").attr("offset", "50%").attr("stop-color", color(0));
  grad.append("stop").attr("offset", "100%").attr("stop-color", color(maxAbs));

  g.append("rect")
    .attr("x", legendX)
    .attr("y", legendY)
    .attr("width", legendW)
    .attr("height", legendH)
    .attr("rx", 5)
    .attr("fill", "url(#zLegend)")
    .attr("stroke", "#eee");

  // Legend labels - positioned above the legend bar
  g.append("text")
    .attr("x", legendX)
    .attr("y", legendY - 6)
    .attr("font-size", `${LEGEND_LABEL_SIZE}px`)
    .attr("fill", "#555")
    .style("font-weight", "600")
    .text("Lower than avg");
  
  g.append("text")
    .attr("x", legendX + legendW / 2)
    .attr("y", legendY - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", `${LEGEND_LABEL_SIZE}px`)
    .attr("fill", "#555")
    .style("font-weight", "600")
    .text("0");
  
  g.append("text")
    .attr("x", legendX + legendW)
    .attr("y", legendY - 6)
    .attr("text-anchor", "end")
    .attr("font-size", `${LEGEND_LABEL_SIZE}px`)
    .attr("fill", "#555")
    .style("font-weight", "600")
    .text("Higher than avg");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -gridH / 2)
    .attr("y", -42)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Genre");
}

/* ---------- STEP 7: GENRE POPULARITY ---------- */
function drawGenrePopularity(story) {
  const rows = story?.genre_fingerprints?.genre_table || [];
  if (!rows.length) {
    d3.select("#chart").append("p").text("No genre table found in story.json");
    return;
  }

  const options = [
    {
      key: "popularity_mean",
      label: "Popularity",
      subtitle: "Average popularity (0–100)",
      domain: [0, d3.max(rows, (d) => d.popularity_mean ?? 0) || 1],
      tickFormat: d3.format(".0f"),
      valueFormat: (v) => Number(v).toFixed(1),
    },
    {
      key: "explicit_rate",
      label: "Explicit rate",
      subtitle: "Share of explicit tracks",
      domain: [0, 1],
      tickFormat: (v) => `${Math.round(v * 100)}%`,
      valueFormat: (v) => `${Math.round(v * 100)}%`,
    },
    {
      key: "hit_share",
      label: "Hit share",
      subtitle: "Share of hits (top 10% popularity)",
      domain: [0, 1],
      tickFormat: (v) => `${Math.round(v * 100)}%`,
      valueFormat: (v) => `${Math.round(v * 100)}%`,
    },
  ].filter((opt) => rows.some((r) => r[opt.key] != null));

  const saved = window.__genreMode;
  const mode = saved && options.some((o) => o.key === saved) ? saved : options[0].key;
  window.__genreMode = mode;

  // Toggle UI
  const toggle = d3.select("#chart").append("div").attr("class", "seg-toggle");
  toggle.append("span").attr("class", "seg-label").text("View:");

  toggle
    .selectAll("button")
    .data(options)
    .enter()
    .append("button")
    .attr("type", "button")
    .attr("class", (d) => (d.key === mode ? "is-active" : ""))
    .text((d) => d.label)
    .on("click", (event, d) => {
      window.__genreMode = d.key;
      clearChart();
      drawGenrePopularity(story);
    });

  const opt = options.find((o) => o.key === mode);
  const data = rows.slice().sort((a, b) => (b[opt.key] ?? 0) - (a[opt.key] ?? 0));

  const { g, w, h } = baseSvg(`Genres: ${opt.label}`, `${opt.subtitle} (top genres by count)`);

  const x = d3.scaleLinear().domain(opt.domain).nice().range([0, w]);
  const y = d3.scaleBand().domain(data.map((d) => d.genre)).range([0, h]).padding(0.25);

  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(opt.tickFormat))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text(opt.label);

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Genre");

  // Tie genre popularity to hit likelihood (visual cue)
  const linkText = opt.key === "hit_share"
    ? "Higher hit share = more likely to produce hits"
    : opt.key === "avg_popularity"
      ? "Higher average popularity often aligns with higher hit likelihood"
      : "Popularity can signal how often a genre breaks into hits";

  g.append("text")
    .attr("x", w)
    .attr("y", -4)
    .attr("text-anchor", "end")
    .style("fill", "#666")
    .style("font-size", `${AXIS_TICK_SIZE}px`)
    .style("font-weight", "600")
    .text(linkText);

  const bars = g
    .selectAll("rect")
    .data(data, (d) => d.genre)
    .enter()
    .append("rect")
    .attr("y", (d) => y(d.genre))
    .attr("x", 0)
    .attr("height", y.bandwidth())
    .attr("width", 0)
    .attr("rx", 8)
    .attr("fill", "#111")
    .style("cursor", "pointer");

  // Animate bars growing
  bars
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr("width", (d) => x(d[opt.key] ?? 0));

  // Enhanced tooltips with interpretation
  bars
    .on("mouseenter", function(event, d) {
      // Highlight this bar
      d3.select(this)
        .transition()
        .duration(200)
        .attr("fill", "#6366f1")
        .attr("opacity", 1);
      
      // Dim others
      bars.filter((_, i, nodes) => nodes[i] !== this)
        .transition()
        .duration(200)
        .attr("opacity", 0.4);

      let interpretation = "";
      if (opt.key === "popularity_mean") {
        interpretation = `${d.genre} averages ${opt.valueFormat(d[opt.key])} popularity. ${d[opt.key] > 50 ? 'This genre performs above average.' : 'This genre struggles to reach mainstream attention.'}`;
      } else if (opt.key === "explicit_rate") {
        interpretation = `${Math.round(d[opt.key] * 100)}% of ${d.genre} tracks are explicit. ${d[opt.key] > 0.3 ? 'This genre embraces explicit content as part of its identity.' : 'This genre tends to be more family-friendly.'}`;
      } else if (opt.key === "hit_share") {
        interpretation = `${Math.round(d[opt.key] * 100)}% of ${d.genre} tracks qualify as hits. ${d[opt.key] > 0.15 ? 'This genre punches above its weight in the charts.' : 'This genre struggles to break into the hit zone.'}`;
      }

      showEnhancedTip(
        d.genre,
        `${opt.label}: ${opt.valueFormat(d[opt.key] ?? 0)} | Tracks: ${Number(d.count ?? 0).toLocaleString()}`,
        interpretation,
        event.clientX,
        event.clientY
      );
    })
    .on("mouseleave", function() {
      bars
        .transition()
        .duration(200)
        .attr("fill", "#111")
        .attr("opacity", 1);
      hideTip();
    });
}

/* ---------- STEP 8: HIT BLUEPRINT DELTAS ---------- */
function drawBlueprintDeltas(story) {
  const deltas = story?.hit_blueprint?.deltas || {};
  const hitMeans = story?.hit_blueprint?.hit_means || {};
  const globalMeans = story?.hit_blueprint?.global_means || {};

  const pick = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "speechiness",
    "liveness",
    "instrumentalness",
    "tempo",
    "duration_min",
  ].filter((k) => deltas[k] != null);

  const rows = pick.map((k) => ({
    feature: k,
    delta: Number(deltas[k]),
    hit: Number(hitMeans[k]),
    overall: Number(globalMeans[k]),
  }));

  const { g, w, h } = baseSvg("Anatomy Explained", "Difference between hit average and overall average (hit - overall)");

  if (!rows.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No hit blueprint delta data found in story.json");
    return;
  }

  const min = d3.min(rows, (d) => Math.min(d.delta, 0)) ?? -1;
  const max = d3.max(rows, (d) => Math.max(d.delta, 0)) ?? 1;

  const x = d3.scaleLinear().domain([min, max]).nice().range([0, w]);
  const y = d3.scaleBand().domain(rows.map((r) => r.feature)).range([0, h]).padding(0.25);

  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", `${AXIS_TICK_SIZE}px`);

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Delta (Hit - Overall)");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", `${AXIS_LABEL_SIZE}px`)
    .text("Audio Feature");

  g.append("line")
    .attr("x1", x(0))
    .attr("x2", x(0))
    .attr("y1", 0)
    .attr("y2", h)
    .attr("stroke", "#ddd")
    .attr("stroke-width", 2);

  const bars = g
    .selectAll("rect")
    .data(rows)
    .enter()
    .append("rect")
    .attr("y", (d) => y(d.feature))
    .attr("height", y.bandwidth())
    .attr("x", x(0))
    .attr("width", 0)
    .attr("rx", 7)
    .attr("fill", (d) => (d.delta >= 0 ? "#111" : "#777"));

  bars
    .transition()
    .duration(650)
    .attr("x", (d) => (d.delta >= 0 ? x(0) : x(d.delta)))
    .attr("width", (d) => Math.abs(x(d.delta) - x(0)));

  bars
    .on("mousemove", (event, d) => {
      showTip(
        `<div style="font-weight:800;margin-bottom:4px;">${d.feature}</div>
         <div>Delta: ${d.delta.toFixed(3)}</div>
         <div>Hit mean: ${d.hit.toFixed(3)}</div>
         <div>Overall mean: ${d.overall.toFixed(3)}</div>`,
        event.clientX,
        event.clientY
      );
    })
    .on("mouseleave", hideTip);

  // Add precise value labels (this is the detailed view)
  const labels = g
    .selectAll(".blueprint-value-label")
    .data(rows)
    .enter()
    .append("text")
    .attr("class", "blueprint-value-label")
    .attr("y", (d) => y(d.feature) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("x", (d) => {
      const barEnd = d.delta >= 0 ? x(d.delta) : x(d.delta);
      return barEnd + (d.delta >= 0 ? 8 : -8);
    })
    .attr("text-anchor", (d) => (d.delta >= 0 ? "start" : "end"))
    .style("fill", "#333")
    .style("font-size", "12px")
    .style("font-weight", "700")
    .style("opacity", 0)
    .text((d) => {
      const sign = d.delta >= 0 ? "+" : "";
      return `${sign}${d.delta.toFixed(2)}`;
    });

  labels
    .transition()
    .duration(400)
    .delay(700)
    .style("opacity", 1);

  // === SONG OVERLAYS (moved from early blueprint) ===
  const exampleHits = story?.intro?.example_hits || [];
  
  if (exampleHits.length > 0) {
    const numSongs = Math.min(5, exampleHits.length);
    const step = Math.floor(exampleHits.length / numSongs);
    const selectedSongs = [];
    
    for (let i = 0; i < numSongs; i++) {
      const idx = Math.min(i * step, exampleHits.length - 1);
      selectedSongs.push(exampleHits[idx]);
    }

    const songPoints = [];
    selectedSongs.forEach((song, songIdx) => {
      rows.forEach((row) => {
        const feature = row.feature;
        const songValue = Number(song[feature]);
        
        if (Number.isFinite(songValue) && Number.isFinite(row.overall)) {
          const deviation = songValue - row.overall;
          songPoints.push({
            song,
            feature,
            value: songValue,
            deviation,
            songIdx,
            row
          });
        }
      });
    });

    const songColors = ["#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

    setTimeout(() => {
      if (songPoints.length === 0) return;

      const points = g
        .selectAll(".song-point")
        .data(songPoints)
        .enter()
        .append("circle")
        .attr("class", "song-point")
        .attr("cx", (d) => x(d.deviation))
        .attr("cy", (d) => y(d.feature) + y.bandwidth() / 2)
        .attr("r", 5)
        .attr("fill", (d) => songColors[d.songIdx % songColors.length])
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0)
        .style("cursor", "pointer");

      points
        .transition()
        .duration(600)
        .delay((d, i) => i * 10)
        .attr("opacity", 0.85);

      points
        .on("mouseover", function (event, d) {
          d3.select(this).transition().duration(200).attr("r", 8).attr("opacity", 1);
          const direction = d.deviation >= 0 ? "higher" : "lower";
          showTip(
            `<strong>${d.song.track_name}</strong><br/>
            <em>${d.song.artists}</em><br/>
            Popularity: ${d.song.popularity}<br/>
            <br/>
            ${d.feature}: ${Math.abs(d.deviation).toFixed(2)} ${direction}`,
            event.pageX,
            event.pageY
          );
        })
        .on("mouseout", function () {
          d3.select(this).transition().duration(200).attr("r", 5).attr("opacity", 0.85);
          hideTip();
        });

      // Song legend
      const songLegend = g
        .append("g")
        .attr("class", "song-legend")
        .attr("transform", `translate(10, ${h + 50})`);

      songLegend
        .append("text")
        .attr("x", 0)
        .attr("y", 0)
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("fill", "#666")
        .text("Sample hits:");

      selectedSongs.forEach((song, i) => {
        const item = songLegend.append("g").attr("transform", `translate(${i * 120}, 12)`);
        item.append("circle").attr("r", 3).attr("fill", songColors[i]).attr("stroke", "#fff");
        item.append("text")
          .attr("x", 6)
          .attr("y", 3)
          .style("font-size", "9px")
          .style("fill", "#444")
          .text(song.track_name.length > 15 ? song.track_name.substring(0, 12) + "..." : song.track_name);
      });
    }, 1000);
  }
}

/* ---------- STEP 8.1: FEATURE VARIANCE (Hits vs Non-hits) ---------- */
function loadFeatureVariance(story) {
  if (__varianceCache) return Promise.resolve(__varianceCache);
  if (__variancePromise) return __variancePromise;

  const threshold =
    story?.hit_threshold ??
    story?.popularity_spectrum?.hit_threshold_top10 ??
    story?.hit_blueprint?.hit_threshold_top10 ??
    63;

  const features = [
    "danceability",
    "energy",
    "valence",
    "acousticness",
    "instrumentalness",
    "speechiness",
    "loudness",
    "tempo",
    "duration_min",
    "liveness"
  ];

  __variancePromise = d3.csv("data/raw/spotify_tracks.csv", (d) => ({
    popularity: Number(d.popularity),
    danceability: Number(d.danceability),
    energy: Number(d.energy),
    valence: Number(d.valence),
    acousticness: Number(d.acousticness),
    instrumentalness: Number(d.instrumentalness),
    speechiness: Number(d.speechiness),
    loudness: Number(d.loudness),
    tempo: Number(d.tempo),
    duration_min: Number(d.duration_ms) / 60000,
    liveness: Number(d.liveness)
  })).then((rows) => {
    const totals = {};
    const totalsSq = {};
    const counts = {};

    features.forEach((f) => {
      totals[f] = 0;
      totalsSq[f] = 0;
      counts[f] = 0;
    });

    rows.forEach((r) => {
      features.forEach((f) => {
        const v = r[f];
        if (!Number.isFinite(v)) return;
        totals[f] += v;
        totalsSq[f] += v * v;
        counts[f] += 1;
      });
    });

    const means = {};
    const stds = {};
    features.forEach((f) => {
      const n = counts[f] || 1;
      const mean = totals[f] / n;
      const variance = Math.max(0, totalsSq[f] / n - mean * mean);
      means[f] = mean;
      stds[f] = Math.sqrt(variance) || 1;
    });

    const hitTotals = {};
    const hitTotalsSq = {};
    const hitCounts = {};
    const nonTotals = {};
    const nonTotalsSq = {};
    const nonCounts = {};

    features.forEach((f) => {
      hitTotals[f] = 0;
      hitTotalsSq[f] = 0;
      hitCounts[f] = 0;
      nonTotals[f] = 0;
      nonTotalsSq[f] = 0;
      nonCounts[f] = 0;
    });

    rows.forEach((r) => {
      const isHit = Number.isFinite(r.popularity) && r.popularity >= threshold;
      features.forEach((f) => {
        const v = r[f];
        if (!Number.isFinite(v)) return;
        const z = (v - means[f]) / stds[f];
        if (isHit) {
          hitTotals[f] += z;
          hitTotalsSq[f] += z * z;
          hitCounts[f] += 1;
        } else {
          nonTotals[f] += z;
          nonTotalsSq[f] += z * z;
          nonCounts[f] += 1;
        }
      });
    });

    const result = features.map((f) => {
      const hitN = hitCounts[f] || 1;
      const nonN = nonCounts[f] || 1;
      const hitMean = hitTotals[f] / hitN;
      const nonMean = nonTotals[f] / nonN;
      const hitVar = Math.max(0, hitTotalsSq[f] / hitN - hitMean * hitMean);
      const nonVar = Math.max(0, nonTotalsSq[f] / nonN - nonMean * nonMean);
      return {
        feature: f,
        hitStd: Math.sqrt(hitVar),
        nonStd: Math.sqrt(nonVar)
      };
    });

    __varianceCache = { threshold, rows: result };
    return __varianceCache;
  });

  return __variancePromise;
}

function drawFeatureVariance(story) {
  const { g, w, h } = baseSvg(
    "Hit consistency vs diversity",
    "Std dev of z-scored features (hits vs non-hits)"
  );

  const runId = ++__varianceRunId;

  g.append("text")
    .attr("class", "variance-loading")
    .attr("x", w / 2)
    .attr("y", h / 2)
    .attr("text-anchor", "middle")
    .style("fill", "#666")
    .style("font-weight", 700)
    .text("Computing feature variance…");

  loadFeatureVariance(story)
    .then((payload) => {
      if (runId !== __varianceRunId) return;
      const data = payload.rows;
      if (!data || !data.length) {
        g.selectAll(".variance-loading").text("No variance data available.");
        return;
      }

      g.selectAll(".variance-loading").remove();

      const labelMap = {
        danceability: "Danceability",
        energy: "Energy",
        valence: "Valence",
        acousticness: "Acousticness",
        instrumentalness: "Instrumentalness",
        speechiness: "Speechiness",
        loudness: "Loudness",
        tempo: "Tempo",
        duration_min: "Duration",
        liveness: "Liveness"
      };

      const features = data.map((d) => d.feature);
      const x0 = d3.scaleBand().domain(features).range([0, w]).padding(0.2);
      const x1 = d3.scaleBand().domain(["hits", "nonHits"]).range([0, x0.bandwidth()]).padding(0.18);
      const maxStd = d3.max(data, (d) => Math.max(d.hitStd, d.nonStd)) || 1;
      const y = d3.scaleLinear().domain([0, maxStd * 1.15]).range([h, 0]).nice();

      addGridY(g, y, w);

      g.append("g")
        .attr("transform", `translate(0,${h})`)
        .call(
          d3.axisBottom(x0).tickFormat((d) => labelMap[d] || d)
        )
        .selectAll("text")
        .attr("transform", "rotate(-28)")
        .style("text-anchor", "end")
        .style("fill", "#444")
        .style("font-size", `${AXIS_TICK_SIZE}px`);

      g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("fill", "#444")
        .style("font-size", `${AXIS_TICK_SIZE}px`);

      const group = g
        .selectAll("g.variance-group")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "variance-group")
        .attr("transform", (d) => `translate(${x0(d.feature)},0)`);

      group.append("rect")
        .attr("x", x1("hits"))
        .attr("y", (d) => y(d.hitStd))
        .attr("width", x1.bandwidth())
        .attr("height", (d) => h - y(d.hitStd))
        .attr("rx", 6)
        .attr("fill", "#111");

      group.append("rect")
        .attr("x", x1("nonHits"))
        .attr("y", (d) => y(d.nonStd))
        .attr("width", x1.bandwidth())
        .attr("height", (d) => h - y(d.nonStd))
        .attr("rx", 6)
        .attr("fill", "#777");

      const legend = g.append("g").attr("transform", `translate(${w - 180},${-6})`);
      legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", "#111");
      legend.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .style("font-size", `${AXIS_TICK_SIZE}px`)
        .style("fill", "#444")
        .text("Hits");

      legend.append("rect").attr("x", 90).attr("y", 0).attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", "#777");
      legend.append("text")
        .attr("x", 108)
        .attr("y", 10)
        .style("font-size", `${AXIS_TICK_SIZE}px`)
        .style("fill", "#444")
        .text("Non-hits");

      const avgHit = d3.mean(data, (d) => d.hitStd) || 0;
      const avgNon = d3.mean(data, (d) => d.nonStd) || 0;
      const homogeneity = avgHit < avgNon ? "more homogeneous" : "more diverse";

      g.append("text")
        .attr("x", 0)
        .attr("y", h + 60)
        .style("fill", "#444")
        .style("font-size", `${AXIS_LABEL_SIZE}px`)
        .style("font-weight", "600")
        .text(`On average, hits are ${homogeneity} than non-hits across these features.`);
    })
    .catch(() => {
      if (runId !== __varianceRunId) return;
      g.selectAll(".variance-loading").text("Could not load variance data.");
    });
}

/* ---------- STEP 9: TAKEAWAY ---------- */
/**
 * STEP 12: Editorial Close
 * Minimal visualization - faded blueprint in background, text emphasized
 * This is a reflective, editorial moment to end the story
 */
function renderEditorialClose(story) {
  const deltas = story?.hit_blueprint?.deltas || {};
  const hitMeans = story?.hit_blueprint?.hit_means || {};
  const globalMeans = story?.hit_blueprint?.global_means || {};

  const keyFeatures = [
    "danceability",
    "energy",
    "loudness",
    "instrumentalness",
    "acousticness",
    "duration_min"
  ].filter((k) => deltas[k] != null);

  const rows = keyFeatures.map((k) => ({
    feature: k,
    delta: Number(deltas[k]),
    hit: Number(hitMeans[k]),
    overall: Number(globalMeans[k]),
  }));

  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const { g, w, h, svg } = baseSvg("", "");

  // Remove title/subtitle for minimal look
  svg.select("text").remove();  // Remove any title

  if (rows.length > 0) {
    const maxAbsDelta = d3.max(rows, (d) => Math.abs(d.delta)) || 1;
    const domain = [-maxAbsDelta * 1.1, maxAbsDelta * 1.1];

    const x = d3.scaleLinear().domain(domain).range([0, w]);
    const y = d3.scaleBand().domain(rows.map((r) => r.feature)).range([0, h]).padding(0.3);

    // Faint zero line
    g.append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", 0)
      .attr("y2", h)
      .attr("stroke", "#e5e5e5")
      .attr("stroke-width", 1);

    // Faint y-axis labels
    g.append("g")
      .call(d3.axisLeft(y))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").remove())
      .selectAll("text")
      .style("fill", "#d0d0d0")
      .style("font-size", "12px")
      .style("font-weight", "400")
      .style("text-transform", "capitalize");

    // Very faint bars (background ghost)
    g.selectAll(".ghost-bar")
      .data(rows)
      .enter()
      .append("rect")
      .attr("class", "ghost-bar")
      .attr("y", (d) => y(d.feature))
      .attr("height", y.bandwidth())
      .attr("x", (d) => (d.delta >= 0 ? x(0) : x(d.delta)))
      .attr("width", (d) => Math.abs(x(d.delta) - x(0)))
      .attr("fill", (d) => (d.delta >= 0 ? "#b1162a" : "#2563eb"))
      .attr("opacity", 0.08)  // Very faint
      .attr("rx", 3);
  }

  // Text overlay (emphasized)
  const textOverlay = svg
    .append("foreignObject")
    .attr("x", 0)
    .attr("y", h * 0.25)
    .attr("width", w + 180)  // Include margins
    .attr("height", h * 0.6);

  const textDiv = textOverlay
    .append("xhtml:div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("height", "100%")
    .style("padding", "0 60px")
    .style("text-align", "center")
    .style("font-family", "ui-serif, Georgia, serif");

  // Main closing text
  textDiv
    .append("p")
    .style("font-size", "clamp(18px, 3vw, 24px)")
    .style("line-height", "1.6")
    .style("color", "#1a1a1a")
    .style("font-weight", "400")
    .style("margin", "0 0 20px")
    .style("max-width", "600px")
    .html(
      "The blueprint was never a recipe. <br/>It's a map of where we've been — <br/>and a question about where we're going."
    );

  // Secondary text
  textDiv
    .append("p")
    .style("font-size", "clamp(14px, 2vw, 16px)")
    .style("line-height", "1.7")
    .style("color", "#666")
    .style("font-weight", "400")
    .style("margin", "0")
    .style("max-width", "550px")
    .style("font-style", "italic")
    .html(
      "In streaming culture, patterns emerge — but the choice remains: follow the data, or challenge it."
    );
}

function drawTakeaway(story) {
  const effects = (story?.takeaway?.top_effects || []).slice(0, 6);
  const over = (story?.takeaway?.genre_overrepresentation || []).slice(0, 8);

  const wrap = d3
    .select("#chart")
    .append("div")
    .style("padding", "12px")
    .style("display", "grid")
    .style("grid-template-columns", "1fr 1fr")
    .style("gap", "12px")
    .style("overflow-y", "auto")
    .style("max-height", "100%");

  const panel = (title) =>
    wrap
      .append("div")
      .style("border", "1px solid #eee")
      .style("border-radius", "14px")
      .style("background", "white")
      .style("padding", "12px")
      .call((p) =>
        p.append("div").style("font-weight", "800").style("margin-bottom", "8px").text(title)
      );

  const p1 = panel("Top separating features (hits vs low popularity)");
  effects.forEach((d, i) => {
    p1.append("div")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("padding", "6px 0")
      .style("border-top", i === 0 ? "0" : "1px solid #f0f0f0")
      .html(
        `<span style="font-weight:700;">${d.feature}</span><span style="color:#444;font-weight:800;">d=${Number(d.cohen_d).toFixed(2)}</span>`
      );
  });

  const p2 = panel("Genres overrepresented among hits");
  over.forEach((d, i) => {
    p2.append("div")
      .style("display", "grid")
      .style("grid-template-columns", "1fr 90px")
      .style("gap", "10px")
      .style("padding", "6px 0")
      .style("border-top", i === 0 ? "0" : "1px solid #f0f0f0")
      .html(
        `<span style="font-weight:700;">${d.genre}</span><span style="text-align:right;font-weight:800;color:#444;">x${Number(d.ratio).toFixed(2)}</span>`
      );
  });

  wrap
    .append("div")
    .style("color", "#666")
    .style("font-size", "12px")
    .text("Ratios > 1 mean the genre appears among hits more often than expected from its overall share.");

  // Keep takeaway focused on the core synthesis panels only
}

/* ---------- Router ---------- */
/**
 * STEP 0: Cold Open — Song Cards
 * Show 3-4 example songs (top 1%, median, low popularity)
 * as magazine-style cards with key audio features
 */
function renderSongCards(story) {
  const intro = story.intro || {};
  const examples = intro.example_hits || [];
  
  if (examples.length === 0) {
    d3.select("#chart").append("p").text("No example songs available");
    return;
  }

  // Select representative songs
  const topSong = examples[0]; // Highest popularity
  const medianIdx = Math.floor(examples.length / 2);
  const medianSong = examples[medianIdx];
  const lowSong = examples[examples.length - 1]; // Lowest in top examples
  
  const selectedSongs = [topSong, medianSong, lowSong];

  // Create HTML container
  const root = d3.select("#chart");
  const container = root
    .append("div")
    .attr("class", "song-cards-container");

  // Add heading
  container
    .append("h3")
    .attr("class", "song-cards-heading")
    .text("Three songs. Three realities.");

  // Add subheading
  container
    .append("p")
    .attr("class", "song-cards-subheading")
    .text("What separates a viral hit from the long tail? Let's compare three tracks from our dataset.");

  // Create cards wrapper
  const cardsWrapper = container
    .append("div")
    .attr("class", "song-cards-wrapper");

  // Render each song card
  selectedSongs.forEach((song, idx) => {
    if (!song) return;

    const card = cardsWrapper
      .append("div")
      .attr("class", `song-card song-card-${idx}`);

    // Popularity badge
    let badge = "";
    if (idx === 0) badge = "Top 1%";
    else if (idx === 1) badge = "Median";
    else badge = "Long tail";

    card
      .append("div")
      .attr("class", "song-card-badge")
      .text(badge);

    // Track name
    card
      .append("div")
      .attr("class", "song-card-title")
      .text(song.track_name || "Unknown Track");

    // Artist
    card
      .append("div")
      .attr("class", "song-card-artist")
      .text(song.artists || "Unknown Artist");

    // Popularity score
    card
      .append("div")
      .attr("class", "song-card-popularity")
      .html(`<span class="label">Popularity</span> <span class="value">${song.popularity || 0}</span>`);

    // Audio features (danceability, energy, loudness)
    const features = [
      { name: "Danceability", value: song.danceability || 0, max: 1 },
      { name: "Energy", value: song.energy || 0, max: 1 },
      { name: "Loudness", value: (song.loudness || -30) + 30, max: 30 } // Normalize loudness from [-30, 0] to [0, 30]
    ];

    const featuresWrapper = card
      .append("div")
      .attr("class", "song-card-features");

    features.forEach(feature => {
      const featureRow = featuresWrapper
        .append("div")
        .attr("class", "feature-row");

      featureRow
        .append("div")
        .attr("class", "feature-label")
        .text(feature.name);

      const barContainer = featureRow
        .append("div")
        .attr("class", "feature-bar-container");

      const percentage = (feature.value / feature.max) * 100;
      barContainer
        .append("div")
        .attr("class", "feature-bar")
        .style("width", `${Math.max(0, Math.min(100, percentage))}%`);

      featureRow
        .append("div")
        .attr("class", "feature-value")
        .text(feature.value.toFixed(2));
    });
  });
}

/**
 * STEP 7: The Power of Profanity
 * Compare explicit vs non-explicit tracks
 */
function renderExplicitAnalysis(story) {
  const data = story?.explicit_analysis;
  
  if (!data) {
    d3.select("#chart").append("p").text("No explicit analysis data available");
    return;
  }

  const { g, w, h } = baseSvg("Explicit vs Clean", "");

  // Prepare data for visualization
  const comparisonData = [
    {
      label: "Hit Rate (%)",
      explicit: data.explicit_hit_rate * 100,
      nonExplicit: data.non_explicit_hit_rate * 100,
      format: (d) => `${d.toFixed(1)}%`
    },
    {
      label: "Average Popularity",
      explicit: data.explicit_mean_pop,
      nonExplicit: data.non_explicit_mean_pop,
      format: (d) => d.toFixed(1)
    }
  ];

  const margin = { top: 40, right: 120, bottom: 60, left: 140 };
  const chartW = w - margin.left - margin.right;
  const chartH = h - margin.top - margin.bottom;

  const chart = g.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Scales
  const y = d3.scaleBand()
    .domain(comparisonData.map(d => d.label))
    .range([0, chartH])
    .padding(0.3);

  const maxVal = d3.max(comparisonData.flatMap(d => [d.explicit, d.nonExplicit])) || 100;
  const x = d3.scaleLinear()
    .domain([0, maxVal * 1.1])
    .nice()
    .range([0, chartW]);

  // Grid
  chart.append("g")
    .attr("class", "grid")
    .selectAll("line")
    .data(x.ticks(6))
    .enter()
    .append("line")
    .attr("x1", d => x(d))
    .attr("x2", d => x(d))
    .attr("y1", 0)
    .attr("y2", chartH)
    .attr("stroke", "#eee")
    .attr("stroke-width", 1);

  // Y-axis labels
  chart.append("g")
    .selectAll("text")
    .data(comparisonData)
    .enter()
    .append("text")
    .attr("x", -10)
    .attr("y", d => y(d.label) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .style("font-size", "14px")
    .style("font-weight", "700")
    .style("fill", "#333")
    .text(d => d.label);

  // Bar groups
  const barHeight = y.bandwidth() / 2.5;
  const barGap = y.bandwidth() * 0.15;

  // Explicit bars (red)
  const explicitBars = chart.selectAll(".explicit-bar")
    .data(comparisonData)
    .enter()
    .append("g")
    .attr("class", "explicit-bar");

  explicitBars.append("rect")
    .attr("x", 0)
    .attr("y", d => y(d.label) - barGap)
    .attr("width", 0)
    .attr("height", barHeight)
    .attr("fill", "#b1162a")
    .attr("opacity", 0.9)
    .transition()
    .duration(800)
    .attr("width", d => x(d.explicit));

  explicitBars.append("text")
    .attr("x", d => x(d.explicit) + 5)
    .attr("y", d => y(d.label) - barGap + barHeight / 2)
    .attr("dy", "0.35em")
    .style("font-size", "13px")
    .style("font-weight", "700")
    .style("fill", "#b1162a")
    .style("opacity", 0)
    .text(d => d.format(d.explicit))
    .transition()
    .delay(600)
    .duration(400)
    .style("opacity", 1);

  // Non-explicit bars (gray)
  const nonExplicitBars = chart.selectAll(".non-explicit-bar")
    .data(comparisonData)
    .enter()
    .append("g")
    .attr("class", "non-explicit-bar");

  nonExplicitBars.append("rect")
    .attr("x", 0)
    .attr("y", d => y(d.label) + barGap)
    .attr("width", 0)
    .attr("height", barHeight)
    .attr("fill", "#666")
    .attr("opacity", 0.6)
    .transition()
    .duration(800)
    .delay(200)
    .attr("width", d => x(d.nonExplicit));

  nonExplicitBars.append("text")
    .attr("x", d => x(d.nonExplicit) + 5)
    .attr("y", d => y(d.label) + barGap + barHeight / 2)
    .attr("dy", "0.35em")
    .style("font-size", "13px")
    .style("font-weight", "600")
    .style("fill", "#666")
    .style("opacity", 0)
    .text(d => d.format(d.nonExplicit))
    .transition()
    .delay(800)
    .duration(400)
    .style("opacity", 1);

  // Legend
  const legend = chart.append("g")
    .attr("transform", `translate(${chartW + 20}, 20)`);

  const legendData = [
    { label: "Explicit", color: "#b1162a", opacity: 0.9 },
    { label: "Clean", color: "#666", opacity: 0.6 }
  ];

  legendData.forEach((item, i) => {
    const legendItem = legend.append("g")
      .attr("transform", `translate(0, ${i * 25})`);

    legendItem.append("rect")
      .attr("width", 18)
      .attr("height", 12)
      .attr("fill", item.color)
      .attr("opacity", item.opacity);

    legendItem.append("text")
      .attr("x", 24)
      .attr("y", 6)
      .attr("dy", "0.35em")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("fill", "#333")
      .text(item.label);
  });

  // Add footer note
  g.append("text")
    .attr("x", w / 2)
    .attr("y", h - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-style", "italic")
    .style("fill", "#666")
    .text(`Dataset: ${data.explicit_count.toLocaleString()} explicit tracks vs ${data.non_explicit_count.toLocaleString()} clean tracks`);
}

export function renderStep(stepId, story) {
  clearChart();

  if (stepId === 0) return renderSongCards(story);
  if (stepId === 1) return renderBlueprintEarly(story);
  if (stepId === 2) return drawIntro(story);
  if (stepId === 3) return renderPopularitySpectrum(story);
  if (stepId === 4) return renderFeatureSeparation(story);
  if (stepId === 5) return renderVibeShift(story);
  if (stepId === 6) return drawStructureLines(story);
  if (stepId === 7) return renderExplicitAnalysis(story);
  if (stepId === 8) return renderGenreFingerprint(story);
  if (stepId === 9) return drawGenrePopularity(story);
  if (stepId === 10) return drawBlueprintDeltas(story);
  if (stepId === 11) return drawFeatureVariance(story);
  if (stepId === 12) return renderEditorialClose(story);

  d3.select("#chart").append("p").text("Unknown step: " + stepId);
}
/* ===================== end block ===================== */
