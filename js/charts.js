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
    bottom: 72,
    left: 80  // Reduced left margin to give more space for bars
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
    .style("font-size", "13px")
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y).ticks(6))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", "13px")
    .style("font-weight", "600");

  // Axis labels - larger and more visible
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", "14px")
    .text("Popularity Bins");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "700")
    .style("font-size", "14px")
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

/* ---------- STEP 3: EFFECT SIZES ---------- */
function drawEffectSizes(story) {
  const mode = (localStorage.getItem("audienceMode") || "culture").toLowerCase();
  const { g, w, h } = baseSvg(
    "Feature anatomy",
    mode === "producer"
      ? "Which features separate hits vs non-hits the most?"
      : "Do hits “sound” different — and which features move most?"
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

  root.append("g").call(d3.axisLeft(y)).selectAll("text").style("fill", "#444").style("font-weight", 800);
  root
    .append("g")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-weight", 800)
    .style("font-size", "11px");

  // Axis labels
  root.append("text")
    .attr("text-anchor", "middle")
    .attr("x", innerW / 2)
    .attr("y", innerH + 35)
    .style("fill", "#444")
    .style("font-weight", "600")
    .style("font-size", "13px")
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
    .style("fill", "#444");

  g.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").style("fill", "#444");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Popularity Band");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
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
  const keys = ["tempo", "duration_min"].filter((k) => rows[0] && k in rows[0]);

  const { g, w, h } = baseSvg("Structure profile", "Tempo + duration across popularity bands");

  if (!rows.length || !keys.length) {
    g.append("text")
      .attr("x", w / 2)
      .attr("y", h / 2)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-weight", 800)
      .text("No structure (tempo/duration) data found in story.json");
    return;
  }

  const bands = rows.map((d) => d.pop_band);
  const x = d3.scalePoint().domain(bands).range([0, w]).padding(0.3);

  const series = keys.map((k) => {
    const vals = rows.map((r) => Number(r[k]));
    const min = d3.min(vals);
    const max = d3.max(vals);
    const norm = (v) => (max === min ? 0.5 : (v - min) / (max - min));
    return {
      key: k,
      pts: rows.map((r) => ({
        pop_band: r.pop_band,
        raw: Number(r[k]),
        value: norm(Number(r[k])),
      })),
    };
  });

  // Reduce chart height to make room for explanation text
  const chartH = h - 50; // Reduce by 50px for text space
  
  const y = d3.scaleLinear().domain([0, 1]).range([chartH, 0]);
  addGridY(g, y, w);

  g.append("g")
    .attr("transform", `translate(0,${chartH})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end")
    .style("fill", "#444");

  g.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").style("fill", "#444");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", chartH + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Popularity Band");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -chartH / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Normalized Value (0-1)");

  const color = d3.scaleOrdinal().domain(keys).range(["#111", "#777"]);

  const line = d3
    .line()
    .x((d) => x(d.pop_band))
    .y((d) => y(d.value))
    .curve(d3.curveMonotoneX);

  const structureLineGroup = g.append("g").attr("class", "structure-lines");
  
  series.forEach((s) => {
    const path = structureLineGroup
      .append("path")
      .datum(s.pts)
      .attr("fill", "none")
      .attr("stroke", color(s.key))
      .attr("stroke-width", 2.2)
      .attr("class", `line-${s.key}`)
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
        d3.select(this)
          .transition()
          .duration(200)
          .attr("stroke-width", 4)
          .attr("opacity", 1);
        
        structureLineGroup.selectAll("path")
          .filter((_, i, nodes) => nodes[i] !== this)
          .transition()
          .duration(200)
          .attr("opacity", 0.2);
      })
      .on("mouseleave", function() {
        structureLineGroup.selectAll("path")
          .transition()
          .duration(200)
          .attr("stroke-width", 2.2)
          .attr("opacity", 1);
      });

    const interpretations = {
      "tempo": "Tempo patterns vary by genre, but hits often cluster in the 120-130 BPM range – the 'sweet spot' for dancing and engagement.",
      "duration_min": "Shorter songs show a weak negative correlation with popularity – the 'TikTok brain' effect is subtle but real. Attention spans are shrinking."
    };

    g.selectAll(`circle.${s.key}`)
      .data(s.pts)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.pop_band))
      .attr("cy", (d) => y(d.value))
      .attr("r", 3.4)
      .attr("fill", color(s.key))
      .style("cursor", "pointer")
      .on("mouseenter", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 6);
        
        showEnhancedTip(
          s.key,
          `Band: ${d.pop_band} | Raw: ${d.raw.toFixed(2)} | Normalized: ${d.value.toFixed(3)}`,
          interpretations[s.key.toLowerCase()] || `This structural feature evolves across popularity bands.`,
          event.clientX,
          event.clientY
        );
      })
      .on("mouseleave", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 3.4);
        hideTip();
      });
  });

  // Calculate trend strength to highlight weak patterns
  const calculateTrendStrength = (pts) => {
    if (pts.length < 2) return 0;
    const first = pts[0].value;
    const last = pts[pts.length - 1].value;
    return Math.abs(last - first);
  };

  // Add explanation of normalization and highlight weak trends
  setTimeout(() => {
    // Normalization explanation - split into two lines for clarity
    g.append("text")
      .attr("x", w / 2)
      .attr("y", chartH + 65)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-size", "12px")
      .style("font-weight", 600)
      .style("font-style", "italic")
      .text("Note: Values are scaled to 0-1 to compare trends on the same scale.");
    
    g.append("text")
      .attr("x", w / 2)
      .attr("y", chartH + 85)
      .attr("text-anchor", "middle")
      .style("fill", "#666")
      .style("font-size", "12px")
      .style("font-weight", 600)
      .style("font-style", "italic")
      .text("This shows whether tempo or duration change with popularity, not their exact values.");

  }, 1500);
}

/* ---------- STEP 6: GENRE HEATMAP ---------- */
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

  g.append("g")
    .attr("transform", `translate(0,${gridH + 25})`) // Move x-axis ticks further down
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-25)")
    .style("text-anchor", "end")
    .style("fill", "#444")
    .style("font-size", "13px")
    .style("font-weight", "600");

  g.append("g")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("fill", "#444")
    .style("font-size", "13px")
    .style("font-weight", "600");

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
    .style("font-size", "14px")
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
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .style("font-weight", "600")
    .text("Lower than avg");
  
  g.append("text")
    .attr("x", legendX + legendW / 2)
    .attr("y", legendY - 6)
    .attr("text-anchor", "middle")
    .attr("font-size", "11px")
    .attr("fill", "#555")
    .style("font-weight", "600")
    .text("0");
  
  g.append("text")
    .attr("x", legendX + legendW)
    .attr("y", legendY - 6)
    .attr("text-anchor", "end")
    .attr("font-size", "11px")
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
    .style("font-size", "12px")
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
    .style("fill", "#444");

  g.append("g").call(d3.axisLeft(y)).selectAll("text").style("fill", "#444");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text(opt.label);

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Genre");

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

  const { g, w, h } = baseSvg("Hit blueprint", "Difference between hit average and overall average (hit - overall)");

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

  g.append("g").call(d3.axisLeft(y)).selectAll("text").style("fill", "#444");

  // Axis labels
  g.append("text")
    .attr("text-anchor", "middle")
    .attr("x", w / 2)
    .attr("y", h + 50)
    .style("fill", "#444")
    .style("font-weight", "600")
    .text("Delta (Hit - Overall)");

  g.append("text")
    .attr("text-anchor", "middle")
    .attr("transform", "rotate(-90)")
    .attr("x", -h / 2)
    .attr("y", -50)
    .style("fill", "#444")
    .style("font-weight", "600")
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
}

/* ---------- STEP 9: TAKEAWAY ---------- */
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

  // Add explicit analysis bar chart as a panel
  const p3 = panel("Explicit content analysis");
  const explicitData = [
    { label: "Explicit", value: story.takeaway.explicit_analysis.explicit_mean_pop },
    { label: "Non-Explicit", value: story.takeaway.explicit_analysis.non_explicit_mean_pop }
  ];
  const maxVal = d3.max(explicitData, d => d.value);
  explicitData.forEach((d, i) => {
    const barContainer = p3.append("div")
      .style("display", "flex")
      .style("align-items", "center")
      .style("margin-bottom", "8px");
    barContainer.append("span")
      .style("width", "120px")
      .style("font-weight", "700")
      .text(d.label);
    const bar = barContainer.append("div")
      .style("flex", "1")
      .style("height", "20px")
      .style("background", d.label === "Explicit" ? "#111" : "#777")
      .style("border-radius", "4px")
      .style("position", "relative");
    bar.append("div")
      .style("position", "absolute")
      .style("right", "8px")
      .style("top", "0")
      .style("color", "white")
      .style("font-weight", "800")
      .style("font-size", "12px")
      .text(d.value.toFixed(1));
    bar.style("width", `${(d.value / maxVal) * 100}%`);
  });
  p3.append("div")
    .style("font-size", "12px")
    .style("color", "#666")
    .text("Popularity scores (higher is better)");

  // Correlation text/callout
  const corr = story.takeaway.duration_pop_correlation;
  wrap.append("div")
    .style("font-size", "14px")
    .style("margin-top", "16px")
    .html(`
      <strong>Takeaway insight:</strong><br/>
      Duration and popularity have a correlation of <strong>${corr.toFixed(2)}</strong> (shorter songs tend to be ${corr > 0 ? 'more' : 'less'} popular).
    `);
}

/* ---------- Router ---------- */
export function renderStep(stepId, story) {
  clearChart();

  if (stepId === 0) return drawIntro(story);
  if (stepId === 1) return drawHitDefinition(story);
  if (stepId === 2) return drawPopularityHist(story);
  if (stepId === 3) return drawEffectSizes(story);
  if (stepId === 4) return drawFeatureLines01(story);
  if (stepId === 5) return drawStructureLines(story);
  if (stepId === 6) return drawGenreHeatmap(story);
  if (stepId === 7) return drawGenrePopularity(story);
  if (stepId === 8) return drawBlueprintDeltas(story);
  if (stepId === 9) return drawTakeaway(story);

  d3.select("#chart").append("p").text("Unknown step: " + stepId);
}
/* ===================== end block ===================== */
