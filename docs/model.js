/*
 * Social Force Model of a shopping-mall floor evacuation.
 * A plain-JavaScript port of the model in the notebook (Sections 2-3): same geometry, fast marching
 * distance map, forces, cell lists, Velocity-Verlet with a velocity predictor and per-step checks.
 *
 * No modules: in a browser this file defines the global `MallModel`; in Node it is exported with
 * module.exports, so the same code can be tested headless in Node.js, for example:
 *   node -e "const M = require('./docs/model.js'); console.log(M.selfTest());"
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- parameters (notebook 2.6, 3.3)
  const P = {
    FLOOR_W: 40.0, FLOOR_H: 30.0,          // floor size (m)
    SHOP_W: 8.0, SHOP_H: 5.0,              // shop block size (m)
    SHOP_COLS: 3, SHOP_ROWS: 2,
    EXIT_Y: 15.0,                          // both exits centred on the mid-line
    MASS: 80.0,                            // m (kg)                          [2]
    TAU: 0.5,                              // tau (s)                         [2]
    A: 2.0e3,                              // repulsion strength (N)          [2]
    B: 0.08,                               // repulsion range (m)             [2]
    K: 1.2e5,                              // body compression (kg s^-2)      [2]
    KAPPA: 2.4e5,                          // sliding friction (kg m^-1 s^-1) [2]
    R_CUT: 1.3,                            // interaction cut-off (m)
    V_MAX_FACTOR: 1.3,                     // v_max = 1.3 v0                  [1]
    R_MIN: 0.25, R_MAX: 0.35,              // body radius ~ U(R_MIN, R_MAX)   [2]
    V0_MEAN: 1.34, V0_SD: 0.26,            // desired speed ~ N(mean, sd^2), truncated at +-3 sd [1]
    REMOVE_DIST: 0.5,                      // evacuated 0.5 m beyond an exit line
    GRID_H: 0.1,                           // distance-map grid spacing (m)
    GRID_MARGIN: 1.0,                      // grid extends 1 m outside the west and east walls
    R_INFLATE: 0.35,                       // costly band along walls and shop edges (m)
    BAND_COST: 5.0,
    DENSITY_RADIUS: 2.0,                   // density measured in a 2 m half-disc inside each exit
    T_TARGET: 180.0,                       // evacuation target (s)
    T_MAX: 600.0,                          // time limit (s)
    REC_DT: 0.5,                           // recording interval (s)
  };
  P.DENSITY_AREA = 0.5 * Math.PI * P.DENSITY_RADIUS * P.DENSITY_RADIUS;
  P.CELL_X0 = -P.GRID_MARGIN;
  P.CELL_Y0 = 0.0;
  P.CELL_NX = Math.floor((P.FLOOR_W + 2 * P.GRID_MARGIN) / P.R_CUT);   // 32 columns
  P.CELL_NY = Math.floor(P.FLOOR_H / P.R_CUT);                         // 23 rows
  P.CELL_LX = (P.FLOOR_W + 2 * P.GRID_MARGIN) / P.CELL_NX;             // 1.3125 m
  P.CELL_LY = P.FLOOR_H / P.CELL_NY;                                   // 1.304 m

  /** Time step: 0.005 s up to 400 people, 0.0025 s above (notebook V5 and Section 5.3). */
  function dtFor(n) { return n <= 400 ? 0.005 : 0.0025; }

  // ---------------------------------------------------------------- random numbers
  /** Seeded generator (mulberry32): uniform numbers in [0, 1); the same seed gives the same run. */
  function makeRng(seed) {
    let a = seed >>> 0;
    let spare = null;
    const next = function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      uniform: function (lo, hi) { return lo + (hi - lo) * next(); },
      normal: function (mean, sd) {          // Box-Muller, the second value is kept for the next call
        if (spare !== null) { const z = spare; spare = null; return mean + sd * z; }
        let u = 0;
        while (u === 0) u = next();
        const v = next();
        const rad = Math.sqrt(-2 * Math.log(u));
        spare = rad * Math.sin(2 * Math.PI * v);
        return mean + sd * rad * Math.cos(2 * Math.PI * v);
      },
    };
  }

  // ---------------------------------------------------------------- geometry (notebook 3.1)
  /** Floor with two exits of width w in the west and east walls; blockEast closes the east exit. */
  function makeMall(w, blockEast) {
    const gapX = (P.FLOOR_W - P.SHOP_COLS * P.SHOP_W) / (P.SHOP_COLS + 1);   // 4.0 m
    const gapY = (P.FLOOR_H - P.SHOP_ROWS * P.SHOP_H) / (P.SHOP_ROWS + 1);   // 6.67 m
    if (!(w > 0 && w <= gapY)) throw new Error("exit width must be in (0, " + gapY.toFixed(2) + "] m");
    const shops = [];
    for (let r = 0; r < P.SHOP_ROWS; r++) {
      for (let c = 0; c < P.SHOP_COLS; c++) {
        const x0 = gapX + c * (P.SHOP_W + gapX), y0 = gapY + r * (P.SHOP_H + gapY);
        shops.push([x0, y0, x0 + P.SHOP_W, y0 + P.SHOP_H]);
      }
    }
    const yLo = P.EXIT_Y - w / 2, yHi = P.EXIT_Y + w / 2;
    const outer = [[0, 0, P.FLOOR_W, 0], [0, P.FLOOR_H, P.FLOOR_W, P.FLOOR_H]];
    const exitOpen = [true, !blockEast];                 // [west, east]
    [0, P.FLOOR_W].forEach(function (x, e) {
      if (exitOpen[e]) { outer.push([x, 0, x, yLo]); outer.push([x, yHi, x, P.FLOOR_H]); }
      else outer.push([x, 0, x, P.FLOOR_H]);
    });
    const allWalls = outer.slice();                      // the distance map also needs the shop edges
    shops.forEach(function (s) {
      allWalls.push([s[0], s[1], s[2], s[1]], [s[2], s[1], s[2], s[3]], [s[2], s[3], s[0], s[3]], [s[0], s[3], s[0], s[1]]);
    });
    const exitCentres = [];
    if (exitOpen[0]) exitCentres.push([0, P.EXIT_Y]);
    if (exitOpen[1]) exitCentres.push([P.FLOOR_W, P.EXIT_Y]);
    return { w: w, blockEast: !!blockEast, shops: shops, outerWalls: outer, allWalls: allWalls,
             exitOpen: exitOpen, exitCentres: exitCentres };
  }

  function distToShops(x, y, shops) {
    let d = Infinity;
    for (let s = 0; s < shops.length; s++) {
      const b = shops[s];
      const dx = Math.max(b[0] - x, x - b[2], 0), dy = Math.max(b[1] - y, y - b[3], 0);
      d = Math.min(d, Math.hypot(dx, dy));
    }
    return d;
  }

  function distToWalls(x, y, walls) {
    let d = Infinity;
    for (let k = 0; k < walls.length; k++) {
      const s = walls[k], sx = s[2] - s[0], sy = s[3] - s[1];
      const t = Math.min(Math.max(((x - s[0]) * sx + (y - s[1]) * sy) / (sx * sx + sy * sy), 0), 1);
      d = Math.min(d, Math.hypot(x - (s[0] + t * sx), y - (s[1] + t * sy)));
    }
    return d;
  }

  // ---------------------------------------------------------------- distance map (notebook 3.2)
  /** First-order fast marching for |grad T| = cost, T = 0 on the source nodes (padded grid, binary heap). */
  function fastMarch(cost, sources, nx, ny, h) {
    const NX = nx + 2, NY = ny + 2, size = NX * NY;
    const c = new Float64Array(size).fill(Infinity);
    const T = new Float64Array(size).fill(Infinity);
    const known = new Uint8Array(size);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) c[(j + 1) * NX + i + 1] = cost[j * nx + i];
    // Binary heap of (t, k), ordered by t then k (as Python's heapq orders tuples).
    let ht = new Float64Array(1024), hk = new Int32Array(1024), hn = 0;
    function less(a, b) { return ht[a] < ht[b] || (ht[a] === ht[b] && hk[a] < hk[b]); }
    function swap(a, b) { const t = ht[a]; ht[a] = ht[b]; ht[b] = t; const k = hk[a]; hk[a] = hk[b]; hk[b] = k; }
    function push(t, k) {
      if (hn === ht.length) {
        const t2 = new Float64Array(hn * 2); t2.set(ht); ht = t2;
        const k2 = new Int32Array(hn * 2); k2.set(hk); hk = k2;
      }
      let i = hn++; ht[i] = t; hk[i] = k;
      while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; swap(i, p); i = p; }
    }
    function pop() {
      const k = hk[0];
      hn--;
      if (hn > 0) {
        ht[0] = ht[hn]; hk[0] = hk[hn];
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < hn && less(l, m)) m = l;
          if (r < hn && less(r, m)) m = r;
          if (m === i) break;
          swap(i, m); i = m;
        }
      }
      return k;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (sources[j * nx + i]) { const k = (j + 1) * NX + i + 1; T[k] = 0; push(0, k); }
    }
    const nb = [-1, 1, -NX, NX];
    while (hn > 0) {
      const k = pop();
      if (known[k]) continue;
      known[k] = 1;
      for (let q = 0; q < 4; q++) {
        const n = k + nb[q];
        if (known[n] || c[n] === Infinity) continue;
        let a = Math.min(known[n - 1] ? T[n - 1] : Infinity, known[n + 1] ? T[n + 1] : Infinity);
        let b = Math.min(known[n - NX] ? T[n - NX] : Infinity, known[n + NX] ? T[n + NX] : Infinity);
        if (a > b) { const t = a; a = b; b = t; }
        const f = c[n] * h;
        const t = (b - a < f) ? 0.5 * (a + b + Math.sqrt(2 * f * f - (b - a) * (b - a))) : a + f;
        if (t < T[n]) { T[n] = t; push(t, n); }
      }
    }
    const D = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) D[j * nx + i] = T[(j + 1) * NX + i + 1];
    return D;
  }

  /** Walking distance D to the nearest open exit on a 0.1 m grid, and e0 = -grad D / |grad D|. */
  function makeDistanceMap(mall) {
    const h = P.GRID_H, W = P.FLOOR_W, eps = 1e-9;
    const nx = Math.round((W + 2 * P.GRID_MARGIN) / h) + 1;    // 421
    const ny = Math.round(P.FLOOR_H / h) + 1;                   // 301
    const x0 = -P.GRID_MARGIN, y0 = 0.0;
    const cost = new Float64Array(nx * ny), src = new Uint8Array(nx * ny);
    const half = Math.max(mall.w / 2 - P.R_INFLATE, 0);
    for (let j = 0; j < ny; j++) {
      const Y = y0 + h * j;
      for (let i = 0; i < nx; i++) {
        const X = x0 + h * i, k = j * nx + i;
        const onFloor = X >= -eps && X <= W + eps;
        let cst = distToWalls(X, Y, mall.allWalls) < P.R_INFLATE ? P.BAND_COST : 1.0;
        if (distToShops(X, Y, mall.shops) <= eps || !onFloor) cst = Infinity;
        cost[k] = cst;
        for (let e = 0; e < mall.exitCentres.length; e++) {
          const ce = mall.exitCentres[e];
          if (Math.abs(X - ce[0]) < h / 2 && Math.abs(Y - ce[1]) <= half + eps) src[k] = 1;
        }
      }
    }
    const D = fastMarch(cost, src, nx, ny, h);
    // Gradient by central differences, one-sided next to impassable nodes (as in the notebook).
    const ex = new Float64Array(nx * ny), ey = new Float64Array(nx * ny);
    const val = function (k) { return isFinite(D[k]) ? D[k] : NaN; };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const fx = i < nx - 1 ? (val(k + 1) - val(k)) / h : NaN, bx = i > 0 ? (val(k) - val(k - 1)) / h : NaN;
        const fy = j < ny - 1 ? (val(k + nx) - val(k)) / h : NaN, by = j > 0 ? (val(k) - val(k - nx)) / h : NaN;
        let gx = isNaN(fx) ? bx : (isNaN(bx) ? fx : 0.5 * (fx + bx));
        let gy = isNaN(fy) ? by : (isNaN(by) ? fy : 0.5 * (fy + by));
        if (isNaN(gx)) gx = 0;
        if (isNaN(gy)) gy = 0;
        const norm = Math.hypot(gx, gy);
        const X = x0 + h * i;
        if (X < -eps) { ex[k] = -1; ey[k] = 0; }
        else if (X > W + eps) { ex[k] = 1; ey[k] = 0; }
        else if (norm > 0) { ex[k] = -gx / norm; ey[k] = -gy / norm; }
      }
    }
    return { x0: x0, y0: y0, h: h, nx: nx, ny: ny, D: D, ex: ex, ey: ey, exitCentres: mall.exitCentres };
  }

  /** Mall + distance map for (w, blockEast), cached: the map takes a fraction of a second to build. */
  const geometryCache = new Map();
  function getGeometry(w, blockEast) {
    const key = w.toFixed(4) + (blockEast ? "|east-blocked" : "|both-open");
    if (!geometryCache.has(key)) {
      const mall = makeMall(w, blockEast);
      geometryCache.set(key, { mall: mall, dmap: makeDistanceMap(mall) });
    }
    return geometryCache.get(key);
  }

  // ---------------------------------------------------------------- initial crowd (notebook 3.5)
  /** Radii U(R_MIN, R_MAX); desired speeds N(mean, 0.26^2) truncated at +-3 sd; non-overlapping positions. */
  function sampleCrowd(n, mall, rng, v0Mean) {
    const r = new Float64Array(n), v0 = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n);
    for (let i = 0; i < n; i++) r[i] = rng.uniform(P.R_MIN, P.R_MAX);
    const lo = v0Mean - 3 * P.V0_SD, hi = v0Mean + 3 * P.V0_SD;
    for (let i = 0; i < n; i++) {
      let v;
      do { v = rng.normal(v0Mean, P.V0_SD); } while (v < lo || v > hi);
      v0[i] = v;
    }
    for (let i = 0; i < n; i++) {
      let placed = false;
      for (let tries = 0; tries < 20000 && !placed; tries++) {
        const px = rng.uniform(r[i], P.FLOOR_W - r[i]), py = rng.uniform(r[i], P.FLOOR_H - r[i]);
        if (distToShops(px, py, mall.shops) < r[i]) continue;
        let ok = true;
        for (let j = 0; j < i; j++) {
          if (Math.hypot(x[j] - px, y[j] - py) - r[j] < r[i]) { ok = false; break; }
        }
        if (ok) { x[i] = px; y[i] = py; placed = true; }
      }
      if (!placed) throw new Error("could not place person " + i + " of " + n + " without overlap");
    }
    return { x: x, y: y, r: r, v0: v0 };
  }

  // ---------------------------------------------------------------- simulation (notebook 3.4, 3.5)
  /**
   * One evacuation run. opts: {n, w, blockEast, v0Mean, seed, dt, tMax}, or opts.custom for tests:
   * {geometry, x, y, r, v0} to run given people on a given geometry.
   */
  function Simulation(opts) {
    const n = opts.n, dt = opts.dt || dtFor(n);
    const geo = opts.custom ? opts.custom.geometry : getGeometry(opts.w, opts.blockEast);
    let crowd;
    if (opts.custom) crowd = opts.custom;
    else crowd = sampleCrowd(n, geo.mall, makeRng(opts.seed), opts.v0Mean === undefined ? P.V0_MEAN : opts.v0Mean);
    this.opts = opts; this.n = n; this.dt = dt; this.geo = geo;
    this.tMax = opts.tMax || P.T_MAX;
    this.nSteps = Math.round(this.tMax / dt);
    this.recEvery = Math.max(1, Math.round(P.REC_DT / dt));
    this.x = Float64Array.from(crowd.x); this.y = Float64Array.from(crowd.y);
    this.r = Float64Array.from(crowd.r); this.v0 = Float64Array.from(crowd.v0);
    this.vx = new Float64Array(n); this.vy = new Float64Array(n);
    this.ax = new Float64Array(n); this.ay = new Float64Array(n);
    this.axn = new Float64Array(n); this.ayn = new Float64Array(n);
    this.vpx = new Float64Array(n); this.vpy = new Float64Array(n);
    this.alive = new Uint8Array(n).fill(1);
    this.exitTime = new Float64Array(n).fill(NaN);
    this.exitSide = new Int8Array(n).fill(-1);
    this.nSide = [0, 0];
    this.nOut = 0; this.step = 0; this.t = 0;
    this.status = "running";                 // running | cleared | timeout | failed
    this.error = null;
    this.rec = { t: [], outW: [], outE: [], densW: [], densE: [] };
    this.peakDensity = [0, 0];
    const NC = P.CELL_NX * P.CELL_NY;
    this._cell = new Int32Array(n); this._start = new Int32Array(NC + 1);
    this._fill = new Int32Array(NC); this._order = new Int32Array(n);
    this._accel(this.x, this.y, this.vx, this.vy, this.ax, this.ay);
    this._record();
  }

  /** Cell lists by counting sort: people in cell c are order[start[c] .. start[c + 1] - 1]. */
  Simulation.prototype._buildCells = function (x, y) {
    const n = this.n, NX = P.CELL_NX, NY = P.CELL_NY, NC = NX * NY;
    const cell = this._cell, start = this._start, fill = this._fill, order = this._order, alive = this.alive;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      if (alive[i]) {
        const cx = Math.min(Math.max(Math.floor((x[i] - P.CELL_X0) / P.CELL_LX), 0), NX - 1);
        const cy = Math.min(Math.max(Math.floor((y[i] - P.CELL_Y0) / P.CELL_LY), 0), NY - 1);
        cell[i] = cy * NX + cx;
        start[cell[i] + 1]++;
      } else cell[i] = -1;
    }
    for (let c = 0; c < NC; c++) start[c + 1] += start[c];
    for (let c = 0; c < NC; c++) fill[c] = start[c];
    for (let i = 0; i < n; i++) if (cell[i] >= 0) order[fill[cell[i]]++] = i;
  };

  /** Acceleration of every person: driving force + pedestrian, wall and shop forces, divided by m. */
  Simulation.prototype._accel = function (x, y, vx, vy, outAx, outAy) {
    const n = this.n, alive = this.alive, r = this.r, v0 = this.v0;
    const A = P.A, B = P.B, K = P.K, KAP = P.KAPPA, rc = P.R_CUT, rc2 = rc * rc, tau = P.TAU, mass = P.MASS;
    const walls = this.geo.mall.outerWalls, shops = this.geo.mall.shops, dm = this.geo.dmap;
    const NX = P.CELL_NX, NY = P.CELL_NY;
    this._buildCells(x, y);
    const cell = this._cell, start = this._start, order = this._order;
    for (let i = 0; i < n; i++) {
      if (!alive[i]) { outAx[i] = 0; outAy[i] = 0; continue; }
      const xi = x[i], yi = y[i], vxi = vx[i], vyi = vy[i], ri = r[i];
      let fx = 0, fy = 0;
      // Pedestrian-pedestrian forces (3 x 3 block of cells).
      const cx = cell[i] % NX, cy = (cell[i] - cx) / NX;
      for (let gy = Math.max(cy - 1, 0); gy < Math.min(cy + 2, NY); gy++) {
        for (let gx = Math.max(cx - 1, 0); gx < Math.min(cx + 2, NX); gx++) {
          const c = gy * NX + gx;
          for (let q = start[c]; q < start[c + 1]; q++) {
            const j = order[q];
            if (j === i) continue;
            const dx = xi - x[j], dy = yi - y[j], d2 = dx * dx + dy * dy;
            if (d2 >= rc2 || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, s = ri + r[j] - d;
            let f = A * Math.exp(s / B);
            if (s <= 0) { fx += f * nx; fy += f * ny; continue; }
            f += K * s;
            const tx = -ny, ty = nx;
            const ft = KAP * s * ((vx[j] - vxi) * tx + (vy[j] - vyi) * ty);
            fx += f * nx + ft * tx; fy += f * ny + ft * ty;
          }
        }
      }
      // Outer walls: closest point on each segment.
      for (let w = 0; w < walls.length; w++) {
        const s = walls[w], sx = s[2] - s[0], sy = s[3] - s[1];
        const t = Math.min(Math.max(((xi - s[0]) * sx + (yi - s[1]) * sy) / (sx * sx + sy * sy), 0), 1);
        const dx = xi - (s[0] + t * sx), dy = yi - (s[1] + t * sy), d = Math.hypot(dx, dy);
        if (d > 0 && d < rc) {
          const f = wallForce(d, dx / d, dy / d, vxi, vyi, ri);
          fx += f[0]; fy += f[1];
        }
      }
      // Shop blocks: closest point on the rectangle (one obstacle per shop).
      for (let k = 0; k < shops.length; k++) {
        const b = shops[k];
        const qx = Math.min(Math.max(xi, b[0]), b[2]), qy = Math.min(Math.max(yi, b[1]), b[3]);
        const dx = xi - qx, dy = yi - qy, d = Math.hypot(dx, dy);
        if (d > 0) {
          if (d < rc) { const f = wallForce(d, dx / d, dy / d, vxi, vyi, ri); fx += f[0]; fy += f[1]; }
        } else {
          // Centre inside a shop (only if something has gone badly wrong): push out through the nearest edge.
          const dl = xi - b[0], dr = b[2] - xi, db = yi - b[1], dt_ = b[3] - yi, m = Math.min(dl, dr, db, dt_);
          const nrm = m === dl ? [-1, 0] : m === dr ? [1, 0] : m === db ? [0, -1] : [0, 1];
          const f = wallForce(-m, nrm[0], nrm[1], vxi, vyi, ri);
          fx += f[0]; fy += f[1];
        }
      }
      // Driving force towards the nearest exit along the distance-map direction.
      const e = fieldDirection(dm, xi, yi);
      outAx[i] = (v0[i] * e[0] - vxi) / tau + fx / mass;
      outAy[i] = (v0[i] * e[1] - vyi) / tau + fy / mass;
    }
  };

  /** f_iW for a wall at distance d with unit normal (nx, ny) pointing towards the person. */
  function wallForce(d, nx, ny, vx, vy, ri) {
    const s = ri - d;
    let f = P.A * Math.exp(s / P.B);
    if (s <= 0) return [f * nx, f * ny];
    f += P.K * s;
    const tx = -ny, ty = nx, vt = vx * tx + vy * ty;
    return [f * nx - P.KAPPA * s * vt * tx, f * ny - P.KAPPA * s * vt * ty];
  }

  /** Bilinear interpolation of the direction field; nearest open exit where the field vanishes. */
  function fieldDirection(dm, px, py) {
    const nx = dm.nx, ny = dm.ny, fx = (px - dm.x0) / dm.h, fy = (py - dm.y0) / dm.h;
    const i = Math.min(Math.max(Math.floor(fx), 0), nx - 2), j = Math.min(Math.max(Math.floor(fy), 0), ny - 2);
    const tx = Math.min(Math.max(fx - i, 0), 1), ty = Math.min(Math.max(fy - j, 0), 1);
    const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
    const k = j * nx + i;
    let dx = w00 * dm.ex[k] + w10 * dm.ex[k + 1] + w01 * dm.ex[k + nx] + w11 * dm.ex[k + nx + 1];
    let dy = w00 * dm.ey[k] + w10 * dm.ey[k + 1] + w01 * dm.ey[k + nx] + w11 * dm.ey[k + nx + 1];
    let norm = Math.hypot(dx, dy);
    if (norm < 1e-6) {
      let best = Infinity;
      for (let e = 0; e < dm.exitCentres.length; e++) {
        const cx = dm.exitCentres[e][0] - px, cy = dm.exitCentres[e][1] - py, dd = Math.hypot(cx, cy);
        if (dd < best) { best = dd; dx = cx; dy = cy; }
      }
      norm = Math.hypot(dx, dy);
    }
    return [dx / norm, dy / norm];
  }

  /** Record the number out through each exit and the density in the half-disc inside each exit. */
  Simulation.prototype._record = function () {
    let dW = 0, dE = 0;
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const xi = this.x[i], yi = this.y[i];
      if (xi >= 0 && Math.hypot(xi, yi - P.EXIT_Y) < P.DENSITY_RADIUS) dW += 1 / P.DENSITY_AREA;
      if (xi <= P.FLOOR_W && Math.hypot(xi - P.FLOOR_W, yi - P.EXIT_Y) < P.DENSITY_RADIUS) dE += 1 / P.DENSITY_AREA;
    }
    this.rec.t.push(this.step * this.dt);
    this.rec.outW.push(this.nSide[0]); this.rec.outE.push(this.nSide[1]);
    this.rec.densW.push(dW); this.rec.densE.push(dE);
    this.peakDensity[0] = Math.max(this.peakDensity[0], dW);
    this.peakDensity[1] = Math.max(this.peakDensity[1], dE);
  };

  /** One Velocity-Verlet step with a velocity predictor, then removal at the exits and the per-step checks. */
  Simulation.prototype._step = function () {
    const n = this.n, dt = this.dt, x = this.x, y = this.y, vx = this.vx, vy = this.vy;
    const ax = this.ax, ay = this.ay, axn = this.axn, ayn = this.ayn, vpx = this.vpx, vpy = this.vpy;
    for (let i = 0; i < n; i++) {
      x[i] += vx[i] * dt + 0.5 * ax[i] * dt * dt;        // position update
      y[i] += vy[i] * dt + 0.5 * ay[i] * dt * dt;
      vpx[i] = vx[i] + ax[i] * dt;                       // Euler predictor keeps the scheme explicit
      vpy[i] = vy[i] + ay[i] * dt;
    }
    this._accel(x, y, vpx, vpy, axn, ayn);               // forces at the new position, predicted velocity
    for (let i = 0; i < n; i++) {
      let nvx = vx[i] + 0.5 * (ax[i] + axn[i]) * dt, nvy = vy[i] + 0.5 * (ay[i] + ayn[i]) * dt;
      const speed = Math.hypot(nvx, nvy), vmax = P.V_MAX_FACTOR * this.v0[i];
      if (speed > vmax) { const sc = vmax / Math.max(speed, 1e-12); nvx *= sc; nvy *= sc; }
      vx[i] = nvx; vy[i] = nvy;
    }
    this.ax = axn; this.ay = ayn; this.axn = ax; this.ayn = ay;   // reuse a_{n+1} as the next a_n
    this.step++;
    this.t = this.step * dt;
    // Remove anyone 0.5 m beyond an exit line.
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) continue;
      const side = x[i] < -P.REMOVE_DIST ? 0 : (x[i] > P.FLOOR_W + P.REMOVE_DIST ? 1 : -1);
      if (side >= 0) {
        this.alive[i] = 0; this.exitTime[i] = this.t; this.exitSide[i] = side;
        this.nSide[side]++; this.nOut++;
        vx[i] = vy[i] = this.ax[i] = this.ay[i] = 0;
      }
    }
    // Per-step checks: conservation (V2), finite positions, nobody through a wall or a closed exit.
    const halfW = this.geo.mall.w / 2, open = this.geo.mall.exitOpen;
    let inside = 0;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) continue;
      inside++;
      const xi = x[i], yi = y[i];
      if (!(isFinite(xi) && isFinite(yi))) throw new Error("non-finite position: the integration became unstable");
      if (yi < 0 || yi > P.FLOOR_H) throw new Error("a pedestrian crossed the north or south wall");
      if (xi < 0 || xi > P.FLOOR_W) {
        const e = xi < 0 ? 0 : 1;
        if (!open[e] || Math.abs(yi - P.EXIT_Y) > halfW + P.R_MAX) {
          throw new Error("a pedestrian left the floor outside an open exit gap");
        }
      }
    }
    if (inside + this.nOut !== n) throw new Error("conservation failed: inside + out != N");
    const done = this.nOut === n || this.step >= this.nSteps;
    if (this.step % this.recEvery === 0 || done) this._record();
    if (done) this.status = this.nOut === n ? "cleared" : "timeout";
  };

  /** Advance by up to maxSteps steps (or until done). A failed check sets status "failed" and error. */
  Simulation.prototype.advance = function (maxSteps) {
    for (let s = 0; s < maxSteps && this.status === "running"; s++) {
      try { this._step(); } catch (err) { this.status = "failed"; this.error = err.message; }
    }
    return this.status !== "running";
  };

  Simulation.prototype.done = function () { return this.status !== "running"; };

  /** T_evac, T_90, people per exit, specific flow J_s (20-80 % evacuated) and peak density. */
  Simulation.prototype.summary = function () {
    const n = this.n, times = [];
    for (let i = 0; i < n; i++) if (isFinite(this.exitTime[i])) times.push(this.exitTime[i]);
    times.sort(function (a, b) { return a - b; });
    const cleared = times.length === n;
    const k90 = Math.ceil(0.9 * n), i0 = Math.ceil(0.2 * n), i1 = Math.ceil(0.8 * n);
    const nExits = this.geo.mall.exitOpen[1] ? 2 : 1;
    return {
      tEvac: cleared ? times[n - 1] : NaN,
      t90: times.length >= k90 ? times[k90 - 1] : NaN,
      cleared: cleared, nLeft: n - times.length,
      nWest: this.nSide[0], nEast: this.nSide[1],
      Js: times.length >= i1 ? (i1 - i0) / ((times[i1 - 1] - times[i0 - 1]) * nExits * this.geo.mall.w) : NaN,
      peakDensity: Math.max(this.peakDensity[0], this.peakDensity[1]),
      dt: this.dt, steps: this.step, status: this.status, error: this.error,
    };
  };

  /** Run to the end; if a per-step check fails, repeat with the step halved (up to twice), as in the notebook. */
  function runEvacuation(opts) {
    let dt = opts.dt || dtFor(opts.n);
    for (let attempt = 0; attempt < 3; attempt++) {
      const sim = new Simulation(Object.assign({}, opts, { dt: dt }));
      sim.advance(Infinity);
      if (sim.status !== "failed") return sim.summary();
      dt /= 2;
    }
    throw new Error("run failed its per-step checks even at dt = " + dt * 2 + " s");
  }

  // ---------------------------------------------------------------- statistics (notebook 2.8)
  const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179,
                2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060,
                2.056, 2.052, 2.048, 2.045, 2.042];
  /** Mean and half-width of the t-based 95 % confidence interval. */
  function meanCI(values) {
    const R = values.length;
    const mean = values.reduce(function (s, v) { return s + v; }, 0) / R;
    if (R < 2) return { mean: mean, half: NaN };
    const sd = Math.sqrt(values.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / (R - 1));
    const t = R - 1 < T975.length ? T975[R - 1] : 1.96;
    return { mean: mean, half: t * sd / Math.sqrt(R) };
  }

  // ---------------------------------------------------------------- self-test (notebook V1 / V1b)
  /**
   * One person from rest in open space with a fixed desired direction (no walls, no shops), run with the
   * same step code as the crowd. Compares with v(t) = v0 (1 - exp(-t/tau)), x(t) = v0 [t - tau (1 - exp(-t/tau))].
   */
  function selfTest() {
    const v0 = 1.34, dt = 0.005, tEnd = 5.0, x0 = 5.0;
    const geometry = {
      mall: { w: 1.5, shops: [], outerWalls: [], exitOpen: [true, true], exitCentres: [[0, 15]] },
      dmap: { x0: -100, y0: -100, h: 1000, nx: 2, ny: 2, ex: Float64Array.of(1, 1, 1, 1),
              ey: new Float64Array(4), exitCentres: [[0, 15]] },
    };
    const sim = new Simulation({ n: 1, dt: dt, tMax: 100,
      custom: { geometry: geometry, x: [x0], y: [15], r: [0.3], v0: [v0] } });
    let errV = 0, errX = 0;
    while (sim.t < tEnd - 1e-9) {
      sim._step();
      const e = Math.exp(-sim.t / P.TAU);
      errV = Math.max(errV, Math.abs(Math.hypot(sim.vx[0], sim.vy[0]) - v0 * (1 - e)));
      errX = Math.max(errX, Math.abs(sim.x[0] - x0 - v0 * (sim.t - P.TAU * (1 - e))));
    }
    const tol = 2.5e-4;
    return { pass: errV < tol && errX < tol, errV: errV, errX: errX, tol: tol };
  }

  const api = { P: P, dtFor: dtFor, makeRng: makeRng, makeMall: makeMall, makeDistanceMap: makeDistanceMap,
                getGeometry: getGeometry, sampleCrowd: sampleCrowd, Simulation: Simulation,
                runEvacuation: runEvacuation, meanCI: meanCI, selfTest: selfTest, fieldDirection: fieldDirection };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node.js: require('./docs/model.js')
  else root.MallModel = api;                                                 // browser: global MallModel
})(this);
