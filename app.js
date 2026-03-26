(function () {
  const RD = window.RouteData;
  const route = RD.generateRoute(20250326);

  const MAP_VB = { w: 360, h: 400 };
  const CHART_W = 1500;
  const CHART_H = 100;
  /** Délka čárky a mezery mřížky v pixelech (konstantní při zoomu). */
  const GRID_DASH_PX = 3;
  const GRID_GAP_PX = 5;

  const COL = {
    neutral: "#1a6cff",
    easyUp: "#e6c200",
    steepUp: "#e53935",
    medDown: "#fb8c00",
    fill: "rgba(26,108,255,0.18)",
    /* Horizontály osy Y — #011E39, sytější než dřív */
    gridH: "#011E39",
    gridHOpacity: "0.26",
  };

  const pinMap = `
    <g class="stop-pin stop-pin--map">
      <path fill="#c62828" d="M12 2C8.1 2 5 5.2 5 9.1c0 5.5 7 10.9 7 10.9s7-5.4 7-10.9C19 5.2 15.9 2 12 2zm0 12.2c-2.1 0-3.8-1.7-3.8-3.8S9.9 6.6 12 6.6s3.8 1.7 3.8 3.8-1.7 3.8-3.8 3.8z"/>
      <circle cx="12" cy="9" r="2.2" fill="#fff"/>
    </g>`;

  const pinSheet = `
    <g class="stop-pin stop-pin--sheet">
      <circle cx="0" cy="0" r="7" fill="#1a6cff" stroke="#fff" stroke-width="2"/>
      <circle cx="0" cy="0" r="2.5" fill="#fff"/>
    </g>`;

  function elevToY(e) {
    const lo = RD.ELEV_MIN;
    const hi = RD.ELEV_AXIS_MAX;
    return CHART_H - ((e - lo) / (hi - lo)) * CHART_H;
  }

  function distToX(dKm) {
    return (dKm / RD.ROUTE_KM) * CHART_W;
  }

  function kindStroke(k) {
    if (k === "easyUp") return COL.easyUp;
    if (k === "steepUp") return COL.steepUp;
    if (k === "medDown") return COL.medDown;
    return COL.neutral;
  }

  function fmtKm(n) {
    return `${Math.round(n).toLocaleString("cs-CZ")} km`;
  }

  function mapPointAlongRoute(t) {
    const pts = [
      [32, 28],
      [72, 52],
      [120, 78],
      [168, 118],
      [210, 168],
      [248, 218],
      [278, 268],
      [300, 318],
    ];
    const seg = (pts.length - 1) * t;
    const i = Math.min(pts.length - 2, Math.floor(seg));
    const u = seg - i;
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u;
    const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
    return [x, y];
  }

  function buildMapSvg() {
    const { distKm, elev, stops } = route;
    const n = distKm.length;
    let d = "";
    for (let i = 0; i < n; i++) {
      const t = distKm[i] / RD.ROUTE_KM;
      const [x, y] = mapPointAlongRoute(t);
      d += (i === 0 ? "M" : "L") + ` ${x.toFixed(1)} ${y.toFixed(1)} `;
    }

    const bubble = mapPointAlongRoute(0.42);
    const endPt = mapPointAlongRoute(1);

    let markers = "";
    for (const si of stops) {
      const t = distKm[si] / RD.ROUTE_KM;
      const [mx, my] = mapPointAlongRoute(t);
      markers += `<g transform="translate(${(mx - 12).toFixed(1)},${(my - 20).toFixed(1)})">${pinMap}</g>`;
    }

    return `
      <svg viewBox="0 0 ${MAP_VB.w} ${MAP_VB.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path d="${d.trim()}" fill="none" stroke="${COL.neutral}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.25"/>
        <path d="${d.trim()}" fill="none" stroke="${COL.neutral}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14 10" filter="url(#routeGlow)"/>
        <g transform="translate(32,28)">
          <rect x="-14" y="-22" width="56" height="28" rx="6" fill="#fff" stroke="#c62828" stroke-width="2"/>
          <text x="14" y="-4" text-anchor="middle" font-size="11" fill="#011e39" font-family="Roboto,sans-serif">Start</text>
        </g>
        <g transform="translate(${endPt[0].toFixed(1)},${endPt[1].toFixed(1)})">
          <circle r="14" fill="#fff" stroke="#c62828" stroke-width="2"/>
          <path d="M-6 2 L0 -8 L6 2 Z" fill="#011e39"/>
        </g>
        ${markers}
        <g transform="translate(${bubble[0].toFixed(1)},${(bubble[1] - 36).toFixed(1)})">
          <rect x="-52" y="-36" width="104" height="40" rx="6" fill="${COL.neutral}"/>
          <text x="0" y="-18" text-anchor="middle" fill="#fff" font-size="11" font-family="Roboto,sans-serif">12:45 h</text>
          <text x="0" y="-4" text-anchor="middle" fill="#fff" font-size="11" font-family="Roboto,sans-serif">150 km</text>
          <polygon points="0,6 -6,-2 6,-2" fill="${COL.neutral}"/>
        </g>
      </svg>`;
  }

  function buildChartSvg() {
    const { distKm, elev, kinds, stops } = route;
    const n = distKm.length;

    const xs = (i) => distToX(distKm[i]);
    const ys = (i) => elevToY(elev[i]);

    let lines = "";
    for (let i = 0; i < n - 1; i++) {
      const c = kindStroke(kinds[i]);
      const sw = kinds[i] === "neutral" ? 3 : 3.8;
      lines += `<line x1="${xs(i).toFixed(2)}" y1="${ys(i).toFixed(2)}" x2="${xs(i + 1).toFixed(2)}" y2="${ys(i + 1).toFixed(2)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" shape-rendering="geometricPrecision"/>`;
    }

    let fillD = `M ${xs(0).toFixed(2)} ${CHART_H} L`;
    for (let i = 0; i < n; i++) {
      fillD += ` ${xs(i).toFixed(2)} ${ys(i).toFixed(2)}`;
    }
    fillD += ` L ${xs(n - 1).toFixed(2)} ${CHART_H} Z`;

    /* Tři horizontály — stroke-dasharray doplní updateGridLineDash (px konstantní při zoomu) */
    const yGrid = [0, CHART_H / 2, CHART_H].map((gy) => {
      return `<line class="chart-grid-line" x1="0" y1="${gy}" x2="${CHART_W}" y2="${gy}" stroke="${COL.gridH}" stroke-opacity="${COL.gridHOpacity}" stroke-width="0.75" stroke-linecap="round"/>`;
    });

    let stopG = "";
    for (const si of stops) {
      const sx = xs(si);
      const sy = ys(si);
      stopG += `<g class="chart-pin" data-cx="${sx.toFixed(2)}" data-cy="${sy.toFixed(2)}" transform="translate(${sx.toFixed(2)},${sy.toFixed(2)}) scale(1,1)">${pinSheet}</g>`;
    }

    return `
      <defs>
        <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(26,108,255,0.16)"/>
          <stop offset="55%" stop-color="rgba(26,108,255,0.06)"/>
          <stop offset="100%" stop-color="rgba(26,108,255,0.02)"/>
        </linearGradient>
      </defs>
      ${yGrid.join("")}
      <path d="${fillD}" fill="url(#chartFillGrad)"/>
      ${lines}
      ${stopG}
    `;
  }

  function buildSurfaceBar() {
    const { kinds } = route;
    const buckets = 8;
    const per = Math.floor(kinds.length / buckets);
    let html = "";
    for (let b = 0; b < buckets; b++) {
      const from = b * per;
      const to = b === buckets - 1 ? kinds.length : (b + 1) * per;
      const slice = kinds.slice(from, to);
      const counts = { easyUp: 0, steepUp: 0, medDown: 0, neutral: 0 };
      for (const k of slice) counts[k]++;
      let best = "neutral";
      let mv = 0;
      for (const k of Object.keys(counts)) {
        if (counts[k] > mv) {
          mv = counts[k];
          best = k;
        }
      }
      const bg =
        best === "easyUp"
          ? "#e6c200"
          : best === "steepUp"
            ? "#e53935"
            : best === "medDown"
              ? "#fb8c00"
              : "#c4a574";
      html += `<span style="background:${bg};flex:1"></span>`;
    }
    return html;
  }

  function updateStats() {
    const title = document.querySelector(".sheet-title");
    const sub = document.querySelector(".sheet-sub");
    const items = document.querySelectorAll(".info-item span");
    if (title) title.textContent = fmtKm(RD.ROUTE_KM);
    if (sub) sub.textContent = "12:45 h";
    if (items[0]) items[0].textContent = `${Math.round(RD.ELEV_MAX).toLocaleString("cs-CZ")} m n.m.`;
    if (items[1]) items[1].textContent = `${Math.round(RD.ELEV_MIN).toLocaleString("cs-CZ")} m n.m.`;
    if (items[2]) items[2].textContent = `${Math.round(RD.TARGET_ASCENT).toLocaleString("cs-CZ")} m`;
    if (items[3]) items[3].textContent = `${Math.round(RD.TARGET_DESCENT).toLocaleString("cs-CZ")} m`;
  }

  function updateYLabels() {
    const labels = document.querySelectorAll(".profile-y-labels span");
    const top = RD.ELEV_AXIS_MAX;
    const mid = (RD.ELEV_AXIS_MAX + RD.ELEV_MIN) / 2;
    const vals = [top, mid, RD.ELEV_MIN];
    labels.forEach((el, i) => {
      if (vals[i] != null) el.textContent = `${Math.round(vals[i])} m`;
    });
  }

  /** Čárkování horizontál v konstantních pixelech při jakémkoli viewBoxu. */
  function updateGridLineDash(svgEl) {
    if (!svgEl) return;
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    if (!vb || vb.width < 1) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width < 1) return;
    const sx = rect.width / vb.width;
    const dashU = GRID_DASH_PX / sx;
    const gapU = GRID_GAP_PX / sx;
    const pattern = `${dashU} ${gapU}`;
    svgEl.querySelectorAll(".chart-grid-line").forEach((el) => {
      el.setAttribute("stroke-dasharray", pattern);
    });
  }

  /** Kompensuje preserveAspectRatio="none" — špendlíky zůstanou kruhové při libovolném zoomu. */
  function updateChartPinTransforms(svgEl) {
    if (!svgEl) return;
    const vb = svgEl.viewBox && svgEl.viewBox.baseVal;
    if (!vb || vb.width < 1 || vb.height < 1) return;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const k = (rect.height * vb.width) / (rect.width * vb.height);
    svgEl.querySelectorAll(".chart-pin").forEach((g) => {
      const cx = parseFloat(g.getAttribute("data-cx"), 10);
      const cy = parseFloat(g.getAttribute("data-cy"), 10);
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        g.setAttribute("transform", `translate(${cx},${cy}) scale(${k},1)`);
      }
    });
  }

  function initChartZoom(svgEl) {
    let viewX = 0;
    let viewW = CHART_W;
    const minW = 80;
    const maxW = CHART_W;

    function apply() {
      viewW = Math.max(minW, Math.min(maxW, viewW));
      viewX = Math.max(0, Math.min(viewX, CHART_W - viewW));
      svgEl.setAttribute("viewBox", `${viewX} 0 ${viewW} ${CHART_H}`);
      updateXLabels();
      updateChartPinTransforms(svgEl);
      updateGridLineDash(svgEl);
    }

    function clientToWorldX(clientX, rect) {
      const rx = (clientX - rect.left) / rect.width;
      return viewX + rx * viewW;
    }

    let pinch0 = null;
    let pan0 = null;

    svgEl.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          const a = e.touches[0];
          const b = e.touches[1];
          pinch0 = {
            dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
            midX: (a.clientX + b.clientX) / 2,
            viewX,
            viewW,
          };
          pan0 = null;
        } else if (e.touches.length === 1) {
          pan0 = {
            x: e.touches[0].clientX,
            viewX,
            viewW,
          };
        }
      },
      { passive: true }
    );

    svgEl.addEventListener(
      "touchmove",
      (e) => {
        const rect = svgEl.getBoundingClientRect();
        if (e.touches.length === 2 && pinch0) {
          e.preventDefault();
          const a = e.touches[0];
          const b = e.touches[1];
          const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
          const midX = (a.clientX + b.clientX) / 2;
          const worldMid = pinch0.viewX + ((pinch0.midX - rect.left) / rect.width) * pinch0.viewW;
          const scale = dist / pinch0.dist;
          let newW = pinch0.viewW / scale;
          newW = Math.max(minW, Math.min(CHART_W, newW));
          let newX = worldMid - ((midX - rect.left) / rect.width) * newW;
          newX = Math.max(0, Math.min(CHART_W - newW, newX));
          viewW = newW;
          viewX = newX;
          apply();
        } else if (e.touches.length === 1 && pan0 && !pinch0) {
          e.preventDefault();
          const dxPx = e.touches[0].clientX - pan0.x;
          const dxWorld = (dxPx / rect.width) * pan0.viewW;
          viewX = pan0.viewX - dxWorld;
          apply();
        }
      },
      { passive: false }
    );

    svgEl.addEventListener(
      "touchend",
      (e) => {
        if (e.touches.length < 2) pinch0 = null;
        if (e.touches.length === 0) pan0 = null;
        if (e.touches.length === 1) {
          pan0 = {
            x: e.touches[0].clientX,
            viewX,
            viewW,
          };
        }
      },
      { passive: true }
    );

    let mousePan = null;
    svgEl.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      mousePan = { x: e.clientX, viewX, viewW };
    });
    window.addEventListener("mousemove", (e) => {
      if (!mousePan) return;
      const rect = svgEl.getBoundingClientRect();
      const dxWorld = ((e.clientX - mousePan.x) / rect.width) * mousePan.viewW;
      viewX = mousePan.viewX - dxWorld;
      apply();
    });
    window.addEventListener("mouseup", () => {
      mousePan = null;
    });

    svgEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = svgEl.getBoundingClientRect();
        const worldX = clientToWorldX(e.clientX, rect);
        const zoomFactor = e.deltaY > 0 ? 1.08 : 1 / 1.08;
        let newW = viewW * zoomFactor;
        newW = Math.max(minW, Math.min(CHART_W, newW));
        let newX = worldX - ((worldX - viewX) / viewW) * newW;
        newX = Math.max(0, Math.min(CHART_W - newW, newX));
        viewW = newW;
        viewX = newX;
        apply();
      },
      { passive: false }
    );

    const xLabelEl = document.querySelector(".profile-x-labels");
    function updateXLabels() {
      if (!xLabelEl) return;
      const km0 = (viewX / CHART_W) * RD.ROUTE_KM;
      const km1 = ((viewX + viewW) / CHART_W) * RD.ROUTE_KM;
      const L = km1 - km0;
      /* Čísla = konce třetin viditelného úseku (0 km je pod osou Y, ne u první čárky). */
      const t1 = km0 + L / 3;
      const t2 = km0 + (2 * L) / 3;
      const fmt = (k) => `${Math.round(k).toLocaleString("cs-CZ")} km`;
      xLabelEl.innerHTML = `<span>${fmt(t1)}</span><span>${fmt(t2)}</span><span>${fmt(km1)}</span>`;
    }

    apply();
  }

  document.querySelector(".map-route").innerHTML = buildMapSvg();
  document.querySelector(".scale-bar span:last-child").textContent = "50 km";

  const chartHost = document.querySelector(".profile-chart");
  chartHost.innerHTML = `<svg id="elevationChart" viewBox="0 0 ${CHART_W} ${CHART_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${buildChartSvg()}</svg>`;
  const chartSvg = document.getElementById("elevationChart");
  initChartZoom(chartSvg);
  if (chartHost && typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      updateChartPinTransforms(chartSvg);
      updateGridLineDash(chartSvg);
    });
    ro.observe(chartHost);
  }

  document.querySelector(".surface-bar").innerHTML = buildSurfaceBar();
  updateStats();
  updateYLabels();
})();
