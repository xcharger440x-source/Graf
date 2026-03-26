/**
 * Synthetic route: 150 km, elevation profile with gradient highlights,
 * 40 stops (10 clustered). Cílové kumulativní stoupání/klesání (před normalizací výšek)
 * škálují tvar profilu; v UI se zobrazí skutečné součty po normalizaci na min/max.
 */
(function (global) {
  const ROUTE_KM = 150;
  const N = 1501;
  const STEP_KM = ROUTE_KM / (N - 1);
  const STEP_M = STEP_KM * 1000;

  /** Kumulativní stoupání / klesání pro škálování tvaru (realistický řád pro ~150 km výlet). */
  const TARGET_ASCENT = 4400;
  const TARGET_DESCENT = 4200;
  const ELEV_MIN = 100;
  const ELEV_MAX = 1600;
  /** Osa Y grafu (m n.m.); křivka leží v [ELEV_MIN, ELEV_MAX]. */
  const ELEV_AXIS_MIN = 0;
  const ELEV_AXIS_MID = 1000;
  const ELEV_AXIS_MAX = 2000;

  /** @typedef {'easyUp' | 'steepUp' | 'medDown' | 'neutral'} SegmentKind */

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smooth3(arr) {
    const out = arr.slice();
    for (let i = 1; i < out.length - 1; i++) {
      out[i] = (arr[i - 1] + arr[i] * 2 + arr[i + 1]) / 4;
    }
    return out;
  }

  const MAX_GRADE_PCT = 13;

  /** Mírné stoupání ~6 %, prudké do 13 %, klesání do −13 % (oranžová zóna). */
  function gradeToKind(grade) {
    if (grade > 0 && Math.abs(grade - 6) <= 2.5) return "easyUp";
    if (grade > 0 && grade >= 8 && grade <= MAX_GRADE_PCT + 0.01) return "steepUp";
    if (grade < 0 && grade >= -(MAX_GRADE_PCT + 0.01) && grade <= -6) return "medDown";
    return "neutral";
  }

  /**
   * @returns {{ distKm: number[], elev: number[], kinds: SegmentKind[], stops: number[] }}
   */
  function generateRoute(seed) {
    const rnd = mulberry32(seed || 42);

    const m = N - 1;
    /** @type {number[]} */
    let diff = new Array(m);
    /** @type {SegmentKind[]} */
    const kinds = new Array(m).fill("neutral");

    for (let i = 0; i < m; i++) {
      diff[i] = (rnd() - 0.48) * 3.2;
    }
    for (let pass = 0; pass < 4; pass++) {
      diff = smooth3(diff);
    }

    function setSegment(startIdx, len, gradientPercent, kind) {
      const dh = (gradientPercent / 100) * STEP_M;
      for (let k = 0; k < len && startIdx + k < m; k++) {
        diff[startIdx + k] = dh;
        kinds[startIdx + k] = kind;
      }
    }

    const idx = (km) => Math.min(m - 1, Math.max(0, Math.round((km / ROUTE_KM) * (N - 1))));

    setSegment(idx(5), 35, 6, "easyUp");
    setSegment(idx(28), 18, 13, "steepUp");
    setSegment(idx(52), 28, -11, "medDown");
    setSegment(idx(88), 40, 6, "easyUp");
    setSegment(idx(118), 12, 13, "steepUp");
    setSegment(idx(132), 22, -11, "medDown");

    let posSum = 0;
    let negSum = 0;
    for (let i = 0; i < m; i++) {
      if (diff[i] > 0) posSum += diff[i];
      else negSum += -diff[i];
    }
    const sp = TARGET_ASCENT / posSum;
    const sn = TARGET_DESCENT / negSum;
    for (let i = 0; i < m; i++) {
      if (diff[i] > 0) diff[i] *= sp;
      else diff[i] *= sn;
    }

    /** Tvrdý strop sklonu: sp/sn jinak rozfouká nominální % (např. 13 % → 36 %). */
    const maxDh = (MAX_GRADE_PCT / 100) * STEP_M;
    for (let i = 0; i < m; i++) {
      if (diff[i] > maxDh) diff[i] = maxDh;
      if (diff[i] < -maxDh) diff[i] = -maxDh;
    }

    /** @type {number[]} */
    const elev = new Array(N);
    elev[0] = 400 + rnd() * 100;
    for (let i = 0; i < m; i++) {
      elev[i + 1] = elev[i] + diff[i];
    }

    let lo = elev[0];
    let hi = elev[0];
    for (let i = 1; i < N; i++) {
      if (elev[i] < lo) lo = elev[i];
      if (elev[i] > hi) hi = elev[i];
    }
    const span = hi - lo;
    let maxG = 0;
    for (let i = 0; i < m; i++) {
      const g = Math.abs((diff[i] / STEP_M) * 100);
      if (g > maxG) maxG = g;
    }
    if (span < 1e-9) {
      const mid = (ELEV_MIN + ELEV_MAX) / 2;
      for (let i = 0; i < N; i++) elev[i] = mid;
    } else {
      const K_target = (ELEV_MAX - ELEV_MIN) / span;
      const K_cap = maxG > 1e-9 ? MAX_GRADE_PCT / maxG : K_target;
      const K = Math.min(K_target, K_cap);
      for (let i = 0; i < N; i++) {
        elev[i] = ELEV_MIN + (elev[i] - lo) * K;
      }
    }

    /**
     * Sklon ≤ 13 % a přesné roztažení výšek na [ELEV_MIN, ELEV_MAX] (nejnižší/nejvyšší bod trasy).
     */
    {
      const maxDelta = (MAX_GRADE_PCT / 100) * STEP_M;
      for (let iter = 0; iter < 40; iter++) {
        for (let i = 0; i < m; i++) {
          let d = elev[i + 1] - elev[i];
          if (d > maxDelta) d = maxDelta;
          else if (d < -maxDelta) d = -maxDelta;
          elev[i + 1] = elev[i] + d;
        }
        let lo = elev[0];
        let hi = elev[0];
        for (let i = 1; i < N; i++) {
          if (elev[i] < lo) lo = elev[i];
          if (elev[i] > hi) hi = elev[i];
        }
        const span = hi - lo;
        if (span < 1e-12) break;
        for (let i = 0; i < N; i++) {
          elev[i] = ELEV_MIN + (elev[i] - lo) * (ELEV_MAX - ELEV_MIN) / span;
        }
        let allOk = true;
        for (let i = 0; i < m; i++) {
          if (Math.abs(elev[i + 1] - elev[i]) > maxDelta + 1e-7) {
            allOk = false;
            break;
          }
        }
        if (allOk) break;
      }
    }

    const distKm = [];
    for (let i = 0; i < N; i++) {
      distKm.push((i / (N - 1)) * ROUTE_KM);
    }

    let asc = 0;
    let dsc = 0;
    for (let i = 0; i < m; i++) {
      const d = elev[i + 1] - elev[i];
      if (d > 0) asc += d;
      else dsc += -d;
    }

    const kindsFinal = [];
    for (let i = 0; i < m; i++) {
      const dh = elev[i + 1] - elev[i];
      const g = (dh / STEP_M) * 100;
      kindsFinal.push(gradeToKind(g));
    }

    const stops = buildStops(N, rnd);
    let iMin = 0;
    let iMax = 0;
    for (let i = 1; i < N; i++) {
      if (elev[i] < elev[iMin]) iMin = i;
      if (elev[i] > elev[iMax]) iMax = i;
    }

    return {
      distKm,
      elev,
      kinds: kindsFinal,
      stops,
      iMin,
      iMax,
      ascentM: asc,
      descentM: dsc,
      stepKm: STEP_KM,
    };
  }

  function buildStops(n, rnd) {
    const out = new Set();
    const clusterStart = 200 + Math.floor(rnd() * 120);
    for (let j = 0; j < 10; j++) {
      out.add(Math.min(n - 2, Math.max(2, clusterStart + j)));
    }
    while (out.size < 40) {
      const i = 2 + Math.floor(rnd() * (n - 4));
      out.add(i);
    }
    return [...out].sort((a, b) => a - b);
  }

  global.RouteData = {
    generateRoute,
    ROUTE_KM,
    ELEV_MIN,
    ELEV_MAX,
    ELEV_AXIS_MIN,
    ELEV_AXIS_MID,
    ELEV_AXIS_MAX,
    TARGET_ASCENT,
    TARGET_DESCENT,
  };
})(typeof window !== "undefined" ? window : globalThis);
