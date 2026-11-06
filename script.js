const SCENARIOS = [
  { id: "ssp119", label: "SSP1–1.9", short: "Very low", color: "#2a9d8f" },
  { id: "ssp126", label: "SSP1–2.6", short: "Low", color: "#4f86c6" },
  { id: "ssp245", label: "SSP2–4.5", short: "Intermediate", color: "#7b6fd0" },
  { id: "ssp370", label: "SSP3–7.0", short: "High", color: "#e58a3a" },
  { id: "ssp585", label: "SSP5–8.5", short: "Very high", color: "#c84b3a" }
];

const PERIODS = ["2011-2020", "2021-2030", "2031-2040", "2041-2050", "2051-2060", "2061-2070", "2071-2080", "2081-2090", "2091-2100"];
const selected = new Set(SCENARIOS.map(d => d.id));
let focusIndex = PERIODS.length - 1;
let showRibbons = true;
let rawData = [];
let summary = [];

const controls = d3.select("#scenario-controls");
SCENARIOS.forEach(s => {
  const label = controls.append("label").attr("class", "scenario-toggle").style("--scenario", s.color);
  label.append("input")
    .attr("type", "checkbox")
    .attr("value", s.id)
    .property("checked", true)
    .on("change", function () {
      if (this.checked) selected.add(s.id); else selected.delete(s.id);
      if (!selected.size) { selected.add(s.id); this.checked = true; }
      renderAll();
    });
  label.append("span").html(`<i></i>${s.label}`);
});

d3.select("#ribbon-toggle").on("change", function () {
  showRibbons = this.checked;
  renderMainChart();
});
d3.select("#period-slider").on("input", function () {
  focusIndex = +this.value;
  renderAll();
});
d3.select("#reset-btn").on("click", () => {
  SCENARIOS.forEach(s => selected.add(s.id));
  controls.selectAll("input").property("checked", true);
  d3.select("#ribbon-toggle").property("checked", true);
  showRibbons = true;
  focusIndex = PERIODS.length - 1;
  d3.select("#period-slider").property("value", focusIndex);
  renderAll();
});

d3.csv("cmip6_temperatures.csv", d => ({
  model: d.model,
  scenario: d.exp,
  period: d.period,
  value: +d.mean
})).then(data => {
  rawData = data.filter(d => PERIODS.includes(d.period) && SCENARIOS.some(s => s.id === d.scenario));
  summary = Array.from(
    d3.group(rawData, d => d.scenario, d => d.period),
    ([scenario, byPeriod]) => Array.from(byPeriod, ([period, rows]) => {
      const values = rows.map(d => d.value).sort(d3.ascending);
      return {
        scenario,
        period,
        year: +period.slice(0, 4) + 4.5,
        median: d3.quantileSorted(values, .5),
        q10: d3.quantileSorted(values, .1),
        q90: d3.quantileSorted(values, .9),
        count: values.length
      };
    })
  ).flat().sort((a, b) => d3.ascending(a.year, b.year));
  renderAll();
}).catch(error => {
  console.error(error);
  d3.select("#main-chart").html(`<p class="error">The CMIP6 data could not be loaded. Run this project through a local web server rather than opening the HTML file directly.</p>`);
});

function dims(selector, ratio = .5, minHeight = 340) {
  const width = document.querySelector(selector).clientWidth || 800;
  return { width, height: Math.max(minHeight, width * ratio) };
}

function renderAll() {
  if (!summary.length) return;
  const period = PERIODS[focusIndex];
  d3.select("#period-output").text(period.replace("-", "–"));
  d3.select("#distribution-title").text(`Models in ${period.replace("-", "–")}`);
  renderMainChart();
  renderDistribution();
  renderStats();
  renderInsight();
}

function renderMainChart() {
  const host = d3.select("#main-chart");
  host.selectAll("*").remove();
  const { width, height } = dims("#main-chart", .47, 360);
  const mobile = width < 620;
  const margin = { top: 36, right: mobile ? 14 : 46, bottom: 48, left: mobile ? 46 : 60 };
  const svg = host.append("svg").attr("viewBox", [0, 0, width, height]);
  const x = d3.scaleLinear().domain([2015.5, 2095.5]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0.6, 7]).range([height - margin.bottom, margin.top]);
  const active = SCENARIOS.filter(s => selected.has(s.id));

  svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(7).tickSize(-(width - margin.left - margin.right)).tickFormat(""));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues([2020, 2040, 2060, 2080, 2100]).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(7).tickFormat(d => `${d}°`));

  [1.5, 2].forEach((threshold, i) => {
    svg.append("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", y(threshold)).attr("y2", y(threshold))
      .attr("stroke", "#bd7569").attr("stroke-dasharray", i ? "2,5" : "6,5").attr("opacity", .8);
    svg.append("text").attr("class", "threshold-label")
      .attr("x", margin.left + 7).attr("y", y(threshold) - 6).text(`${threshold}°C`);
  });

  const focusYear = +PERIODS[focusIndex].slice(0, 4) + 4.5;
  svg.append("line").attr("x1", x(focusYear)).attr("x2", x(focusYear))
    .attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#233e33").attr("stroke-width", 1).attr("opacity", .26);

  const area = d3.area().x(d => x(d.year)).y0(d => y(d.q10)).y1(d => y(d.q90)).curve(d3.curveMonotoneX);
  const line = d3.line().x(d => x(d.year)).y(d => y(d.median)).curve(d3.curveMonotoneX);

  active.forEach(s => {
    const points = summary.filter(d => d.scenario === s.id);
    if (showRibbons) svg.append("path").datum(points).attr("d", area).attr("fill", s.color).attr("opacity", .09);
    svg.append("path").datum(points).attr("d", line).attr("fill", "none").attr("stroke", s.color)
      .attr("stroke-width", 2.6).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
    svg.selectAll(`.dot-${s.id}`).data(points).join("circle")
      .attr("cx", d => x(d.year)).attr("cy", d => y(d.median)).attr("r", d => d.period === PERIODS[focusIndex] ? 5 : 2.5)
      .attr("fill", s.color).attr("stroke", "#f8f7f2").attr("stroke-width", 1.4)
      .style("cursor", "crosshair")
      .on("pointerenter", (event, d) => showTooltip(event, d, s))
      .on("pointermove", moveTooltip)
      .on("pointerleave", hideTooltip)
      .on("click", (_, d) => {
        focusIndex = PERIODS.indexOf(d.period);
        d3.select("#period-slider").property("value", focusIndex);
        renderAll();
      });
  });
}

function renderDistribution() {
  const host = d3.select("#distribution-chart");
  host.selectAll("*").remove();
  const { width } = dims("#distribution-chart", .25, 180);
  const height = 190;
  const margin = { top: 18, right: 18, bottom: 34, left: 34 };
  const svg = host.append("svg").attr("viewBox", [0, 0, width, height]);
  const period = PERIODS[focusIndex];
  const rows = rawData.filter(d => d.period === period && selected.has(d.scenario));
  const active = SCENARIOS.filter(s => selected.has(s.id));
  const x = d3.scaleLinear().domain([0, 7]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(active.map(d => d.id)).range([margin.top, height - margin.bottom]).padding(.32);

  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(width < 500 ? 4 : 7).tickFormat(d => `${d}°`));
  [1.5, 2].forEach(v => svg.append("line").attr("x1", x(v)).attr("x2", x(v)).attr("y1", margin.top).attr("y2", height - margin.bottom).attr("stroke", "#d9a39a").attr("stroke-dasharray", "3,4").attr("opacity", .55));

  const jitter = d => {
    let hash = 0;
    for (const c of d.model) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
    return ((Math.abs(hash) % 100) / 100 - .5) * Math.min(18, y.bandwidth() * .68);
  };
  svg.selectAll("circle").data(rows).join("circle")
    .attr("cx", d => x(d.value))
    .attr("cy", d => y(d.scenario) + y.bandwidth() / 2 + jitter(d))
    .attr("r", 3).attr("fill", d => SCENARIOS.find(s => s.id === d.scenario).color).attr("opacity", .66)
    .on("pointerenter", (event, d) => {
      const s = SCENARIOS.find(x => x.id === d.scenario);
      const tip = d3.select("#tooltip");
      tip.html(`<strong>${d.model}</strong>${s.label} · ${d.value.toFixed(2)}°C`).property("hidden", false);
      moveTooltip(event);
    }).on("pointermove", moveTooltip).on("pointerleave", hideTooltip);

  svg.selectAll(".scenario-label").data(active).join("text")
    .attr("x", margin.left).attr("y", d => y(d.id) + 2).attr("fill", d => d.color)
    .attr("font-size", 9).attr("font-weight", 700).text(d => d.label);
}

function renderStats() {
  const period = PERIODS[focusIndex];
  const data = SCENARIOS.map(s => ({ ...s, stat: summary.find(d => d.scenario === s.id && d.period === period) }));
  d3.select("#stat-cards").selectAll("article").data(data, d => d.id).join("article")
    .attr("class", d => `stat-card${selected.has(d.id) ? "" : " is-hidden"}`)
    .style("--scenario", d => d.color)
    .html(d => `<span class="scenario-name">${d.label} · ${d.short}</span><strong>${d.stat.median.toFixed(2)}°</strong><small>80% range ${d.stat.q10.toFixed(2)}–${d.stat.q90.toFixed(2)}°C · n=${d.stat.count}</small>`);
}

function renderInsight() {
  const period = PERIODS[focusIndex];
  const activeStats = SCENARIOS.filter(s => selected.has(s.id)).map(s => ({ s, d: summary.find(x => x.scenario === s.id && x.period === period) }));
  if (activeStats.length === 1) {
    const { s, d } = activeStats[0];
    d3.select("#insight-copy").html(`In <strong>${period.replace("-", "–")}</strong>, the ${s.short.toLowerCase()} pathway’s median is <strong>${d.median.toFixed(2)}°C</strong>, while 80% of models span ${d.q10.toFixed(2)}–${d.q90.toFixed(2)}°C.`);
    return;
  }
  const low = d3.least(activeStats, x => x.d.median);
  const high = d3.greatest(activeStats, x => x.d.median);
  const gap = high.d.median - low.d.median;
  const framing = focusIndex < 3 ? "The pathways are still tightly clustered" : focusIndex < 6 ? "The futures are beginning to pull apart" : "The emissions choice now dominates the outcome";
  d3.select("#insight-copy").html(`${framing}: the selected medians span <strong>${gap.toFixed(2)}°C</strong> in ${period.replace("-", "–")}, from ${low.s.label} to ${high.s.label}.`);
}

function showTooltip(event, d, s) {
  d3.select("#tooltip")
    .html(`<strong>${s.label} · ${d.period.replace("-", "–")}</strong>Median ${d.median.toFixed(2)}°C<br><span class="tip-range">80% of models: ${d.q10.toFixed(2)}–${d.q90.toFixed(2)}°C · n=${d.count}</span>`)
    .property("hidden", false);
  moveTooltip(event);
}
function moveTooltip(event) {
  const tip = d3.select("#tooltip");
  const node = tip.node();
  const left = Math.min(window.innerWidth - node.offsetWidth - 12, event.clientX + 14);
  const top = Math.max(12, event.clientY - node.offsetHeight - 12);
  tip.style("left", `${left}px`).style("top", `${top}px`);
}
function hideTooltip() { d3.select("#tooltip").property("hidden", true); }

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (summary.length) { renderMainChart(); renderDistribution(); } }, 120);
});
