/* User interface of the evacuation demo: controls, live drawing, chart and the 10-seed batch.
 * The model itself is in model.js (global MallModel). */
(function () {
  "use strict";
  const M = window.MallModel, P = M.P;
  const $ = function (id) { return document.getElementById(id); };

  // Notebook results, mean T_evac (s) and 95 % CI half-width over 20 seeds (1000-1019), for every case in
  // which all 20 runs cleared: [N, w (m), east exit blocked (0/1), mean desired speed (m/s), mean, half, section].
  const REFERENCES = [
    [100, 1.05, 0, 1.34, 73.2, 2.7, "5.3"], [100, 1.10, 0, 1.34, 66.4, 2.9, "5.3"], [100, 1.20, 0, 1.34, 56.7, 1.2, "5.6"],
    [100, 1.20, 1, 1.34, 87.6, 1.8, "5.6"], [100, 1.50, 0, 1.34, 38.8, 0.9, "5.6"], [100, 1.50, 1, 1.34, 60.7, 1.5, "5.6"],
    [100, 2.00, 0, 1.34, 30.3, 1.4, "5.6"], [100, 2.00, 1, 1.34, 50.3, 2.6, "5.6"], [200, 1.05, 0, 1.34, 109.1, 3.4, "5.3"],
    [200, 1.10, 0, 1.34, 101.4, 3.1, "5.3"], [200, 1.20, 0, 1.34, 85.1, 2.2, "5.3"], [200, 1.20, 1, 1.34, 134.0, 2.0, "5.6"],
    [200, 1.50, 0, 1.34, 57.2, 1.2, "5.6"], [200, 1.50, 1, 1.34, 91.1, 1.2, "5.6"], [200, 2.00, 0, 1.34, 40.0, 0.7, "5.6"],
    [200, 2.00, 1, 1.34, 64.3, 0.7, "5.6"], [300, 1.05, 0, 1.34, 146.9, 3.0, "5.3"], [300, 1.10, 0, 1.34, 131.6, 2.7, "5.3"],
    [300, 1.20, 0, 1.34, 110.0, 2.7, "5.3"], [300, 1.20, 1, 1.34, 184.5, 2.6, "5.6"], [300, 1.50, 0, 1.34, 73.5, 1.1, "5.6"],
    [300, 1.50, 1, 1.34, 122.7, 1.2, "5.6"], [300, 2.00, 0, 1.34, 50.6, 0.8, "5.6"], [300, 2.00, 1, 1.34, 83.4, 0.8, "5.6"],
    [400, 1.10, 0, 1.34, 160.0, 2.8, "5.3"], [400, 1.20, 0, 1.34, 134.8, 1.8, "5.3"], [400, 1.30, 0, 1.34, 114.3, 1.7, "5.3"],
    [500, 1.05, 0, 1.34, 216.1, 3.0, "5.3"], [500, 1.10, 0, 1.34, 192.0, 3.6, "5.3"], [500, 1.15, 0, 1.34, 178.9, 2.1, "5.3"],
    [500, 1.20, 0, 1.34, 160.4, 1.6, "5.3"], [500, 1.30, 0, 1.34, 137.2, 2.2, "5.3"], [600, 1.10, 0, 1.34, 225.5, 2.7, "5.3"],
    [600, 1.15, 0, 1.34, 206.6, 2.6, "5.3"], [600, 1.20, 0, 1.34, 188.5, 3.4, "5.3"], [600, 1.25, 0, 1.00, 241.2, 4.5, "5.7"],
    [600, 1.25, 0, 1.34, 173.6, 2.6, "5.7"], [600, 1.25, 0, 1.60, 156.4, 2.1, "5.7"], [600, 1.30, 0, 1.34, 159.8, 1.8, "5.3"],
    [600, 1.40, 0, 1.34, 138.2, 1.2, "5.3"], [700, 1.15, 0, 1.34, 245.7, 2.4, "5.3"], [700, 1.20, 0, 1.34, 217.3, 2.5, "5.3"],
    [700, 1.25, 0, 1.34, 201.9, 2.6, "5.3"], [700, 1.30, 0, 1.34, 184.6, 2.6, "5.3"], [700, 1.35, 0, 1.34, 173.1, 2.3, "5.3"],
    [700, 1.40, 0, 1.34, 162.3, 2.1, "5.3"], [800, 1.20, 0, 1.34, 250.2, 3.5, "5.3"], [800, 1.30, 0, 1.34, 211.6, 2.2, "5.3"],
    [800, 1.35, 0, 1.34, 196.8, 2.5, "5.3"], [800, 1.40, 0, 1.34, 185.1, 2.5, "5.3"], [800, 1.50, 0, 1.34, 163.4, 2.2, "5.3"],
    [800, 1.60, 0, 1.34, 146.9, 2.0, "5.3"],
  ];
  const BATCH_SIZE = 10;
  const FLOW_WINDOW = 5.0;                       // s, for the live flow per exit
  const FRAME_BUDGET_MS = 25;                    // compute time per animation frame

  let sim = null, running = false, frame = null, simClock = 0, lastWall = 0;
  let batch = null;                              // {seeds, results, curves, sim, dt, attempt, timer}
  let batchCurves = [];

  // ---------------------------------------------------------------- settings
  function settings() {
    return {
      n: +$("nPeople").value,
      w: Math.round(+$("exitWidth").value * 100) / 100,
      v0Mean: Math.round(+$("v0Mean").value * 100) / 100,
      blockEast: $("blockEast").checked,
      seed: Math.max(1, Math.floor(+$("seed").value) || 1),
      speed: +$("speed").value,
    };
  }

  function showSettings() {
    const s = settings();
    $("nPeopleVal").textContent = s.n;
    $("exitWidthVal").textContent = s.w.toFixed(2) + " m";
    $("v0MeanVal").textContent = s.v0Mean.toFixed(2) + " m/s";
    $("seedRange").textContent = s.seed + "–" + (s.seed + BATCH_SIZE - 1);
  }

  function findReference(s) {
    for (let k = 0; k < REFERENCES.length; k++) {
      const r = REFERENCES[k];
      if (r[0] === s.n && Math.abs(r[1] - s.w) < 1e-6 && r[2] === (s.blockEast ? 1 : 0) && Math.abs(r[3] - s.v0Mean) < 1e-6) {
        return { mean: r[4], half: r[5], section: r[6] };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- drawing
  const view = $("view"), vctx = view.getContext("2d");
  const chart = $("chart"), cctx = chart.getContext("2d");
  const WORLD = { x0: -2, x1: 42, y0: -0.75, y1: 30.75 };   // metres shown in the view

  function fitCanvas(c, ctx) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  function speedColour(s) {                       // 0 m/s red -> 0.7 amber -> 1.4+ blue
    const stops = [[0, [180, 35, 24]], [0.7, [224, 161, 0]], [1.4, [31, 111, 139]]];
    if (s >= 1.4) return "rgb(31,111,139)";
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1];
      if (s <= b[0]) {
        const t = (s - a[0]) / (b[0] - a[0]);
        return "rgb(" + a[1].map(function (c, i) { return Math.round(c + t * (b[1][i] - c)); }).join(",") + ")";
      }
    }
    return "rgb(31,111,139)";
  }

  function drawView() {
    const size = fitCanvas(view, vctx), sc = size.w / (WORLD.x1 - WORLD.x0);
    const X = function (x) { return (x - WORLD.x0) * sc; }, Y = function (y) { return (WORLD.y1 - y) * sc; };
    const s = settings(), mall = sim ? sim.geo.mall : M.makeMall(s.w, s.blockEast);
    vctx.fillStyle = "#eef1f4"; vctx.fillRect(0, 0, size.w, size.h);
    vctx.fillStyle = "#ffffff"; vctx.fillRect(X(0), Y(P.FLOOR_H), P.FLOOR_W * sc, P.FLOOR_H * sc);
    vctx.fillStyle = "#c9d1da";
    mall.shops.forEach(function (b) { vctx.fillRect(X(b[0]), Y(b[3]), (b[2] - b[0]) * sc, (b[3] - b[1]) * sc); });
    vctx.fillStyle = "#5d6876"; vctx.font = Math.max(9, 0.9 * sc) + "px system-ui, sans-serif";
    vctx.textAlign = "center"; vctx.textBaseline = "middle";
    mall.shops.forEach(function (b) { vctx.fillText("shop", X((b[0] + b[2]) / 2), Y((b[1] + b[3]) / 2)); });
    // Density areas (2 m half-discs inside each exit).
    vctx.setLineDash([4, 4]); vctx.strokeStyle = "#9aa5b1"; vctx.lineWidth = 1;
    vctx.beginPath(); vctx.arc(X(0), Y(P.EXIT_Y), P.DENSITY_RADIUS * sc, -Math.PI / 2, Math.PI / 2); vctx.stroke();
    vctx.beginPath(); vctx.arc(X(P.FLOOR_W), Y(P.EXIT_Y), P.DENSITY_RADIUS * sc, Math.PI / 2, 3 * Math.PI / 2); vctx.stroke();
    vctx.setLineDash([]);
    // Walls and exits.
    vctx.strokeStyle = "#1b2430"; vctx.lineWidth = Math.max(2, 0.15 * sc); vctx.lineCap = "butt";
    mall.outerWalls.forEach(function (w) { vctx.beginPath(); vctx.moveTo(X(w[0]), Y(w[1])); vctx.lineTo(X(w[2]), Y(w[3])); vctx.stroke(); });
    [0, P.FLOOR_W].forEach(function (x, e) {
      const open = mall.exitOpen[e];
      vctx.strokeStyle = open ? "rgba(26,127,55,0.55)" : "#b42318";
      vctx.lineWidth = Math.max(4, 0.35 * sc);
      vctx.beginPath(); vctx.moveTo(X(x), Y(P.EXIT_Y - mall.w / 2)); vctx.lineTo(X(x), Y(P.EXIT_Y + mall.w / 2)); vctx.stroke();
      vctx.fillStyle = open ? "#1a7f37" : "#b42318"; vctx.font = Math.max(9, 0.8 * sc) + "px system-ui, sans-serif";
      vctx.save(); vctx.translate(X(x) + (e === 0 ? -0.55 : 0.55) * sc, Y(P.EXIT_Y + 3.2)); vctx.rotate(-Math.PI / 2);
      vctx.fillText(open ? (e === 0 ? "west exit" : "east exit") : "blocked", 0, 0); vctx.restore();
    });
    // People.
    if (sim) {
      for (let i = 0; i < sim.n; i++) {
        if (!sim.alive[i]) continue;
        vctx.fillStyle = speedColour(Math.hypot(sim.vx[i], sim.vy[i]));
        vctx.beginPath(); vctx.arc(X(sim.x[i]), Y(sim.y[i]), sim.r[i] * sc, 0, 2 * Math.PI); vctx.fill();
      }
    }
  }

  function drawChart() {
    const size = fitCanvas(chart, cctx), W = size.w, H = size.h;
    const pad = { l: 42, r: 10, t: 10, b: 26 };
    const n = sim ? sim.n : settings().n;
    let tEnd = 200;
    if (sim) tEnd = Math.max(tEnd, sim.t * 1.1);
    batchCurves.forEach(function (c) { tEnd = Math.max(tEnd, c.t[c.t.length - 1] * 1.05); });
    tEnd = Math.min(tEnd, P.T_MAX);
    const X = function (t) { return pad.l + (W - pad.l - pad.r) * t / tEnd; };
    const Y = function (v) { return pad.t + (H - pad.t - pad.b) * (1 - v / n); };
    cctx.fillStyle = "#fff"; cctx.fillRect(0, 0, W, H);
    cctx.strokeStyle = "#d8dee6"; cctx.lineWidth = 1; cctx.fillStyle = "#5d6876";
    cctx.font = "11px system-ui, sans-serif"; cctx.textAlign = "center"; cctx.textBaseline = "top";
    const step = tEnd > 400 ? 100 : tEnd > 200 ? 50 : 30;
    for (let t = 0; t <= tEnd; t += step) {
      cctx.beginPath(); cctx.moveTo(X(t), pad.t); cctx.lineTo(X(t), H - pad.b); cctx.stroke();
      cctx.fillText(t + " s", X(t), H - pad.b + 5);
    }
    cctx.textAlign = "right"; cctx.textBaseline = "middle";
    [0, 0.5, 1].forEach(function (f) {
      cctx.beginPath(); cctx.moveTo(pad.l, Y(f * n)); cctx.lineTo(W - pad.r, Y(f * n)); cctx.stroke();
      cctx.fillText(String(Math.round(f * n)), pad.l - 5, Y(f * n));
    });
    cctx.save(); cctx.translate(10, (pad.t + H - pad.b) / 2); cctx.rotate(-Math.PI / 2);
    cctx.textAlign = "center"; cctx.fillText("inside", 0, 0); cctx.restore();
    // Target line.
    cctx.strokeStyle = "#b35900"; cctx.setLineDash([5, 4]);
    cctx.beginPath(); cctx.moveTo(X(P.T_TARGET), pad.t); cctx.lineTo(X(P.T_TARGET), H - pad.b); cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = "#b35900"; cctx.textAlign = "left"; cctx.textBaseline = "top";
    cctx.fillText("180 s target", X(P.T_TARGET) + 4, pad.t + 2);
    const curve = function (rec, colour, width) {
      cctx.strokeStyle = colour; cctx.lineWidth = width; cctx.beginPath();
      for (let k = 0; k < rec.t.length; k++) {
        const inside = n - rec.outW[k] - rec.outE[k];
        if (k === 0) cctx.moveTo(X(rec.t[k]), Y(inside)); else cctx.lineTo(X(rec.t[k]), Y(inside));
      }
      cctx.stroke();
    };
    batchCurves.forEach(function (c) { if (c.n === n) curve(c, "rgba(93,104,118,0.35)", 1); });
    if (sim) curve(sim.rec, "#1f6f8b", 2);
  }

  // ---------------------------------------------------------------- outputs
  function fmt(v, d) { return isFinite(v) ? v.toFixed(d) : "–"; }

  function setStatus(text, kind) { $("status").textContent = text || ""; $("status").className = "status" + (kind ? " " + kind : ""); }

  function showOutputs() {
    if (!sim) return;
    const inside = sim.n - sim.nOut, rec = sim.rec, k = rec.t.length - 1;
    $("outTime").textContent = sim.t.toFixed(1) + " s";
    $("outInside").textContent = inside + " of " + sim.n;
    $("outOut").textContent = sim.nSide[0] + " | " + sim.nSide[1];
    let k0 = k;
    while (k0 > 0 && rec.t[k] - rec.t[k0 - 1] <= FLOW_WINDOW + 1e-9) k0--;
    const span = rec.t[k] - rec.t[k0];
    $("outFlow").textContent = span > 0
      ? fmt((rec.outW[k] - rec.outW[k0]) / span, 1) + " | " + fmt((rec.outE[k] - rec.outE[k0]) / span, 1) + " /s" : "–";
    $("outDensity").textContent = fmt(Math.max(sim.peakDensity[0], sim.peakDensity[1]), 2) + " /m²";
    const ev = $("outEvac");
    if (sim.status === "cleared") {
      const s = sim.summary(), ok = s.tEvac <= P.T_TARGET;
      ev.textContent = s.tEvac.toFixed(1) + " s " + (ok ? "✓" : "✗");
      ev.className = "v " + (ok ? "ok" : "warn");
    } else if (sim.status === "timeout") {
      ev.textContent = "not cleared by " + P.T_MAX + " s"; ev.className = "v warn";
    } else { ev.textContent = "–"; ev.className = "v"; }
  }

  function finishMessage() {
    const s = sim.summary();
    if (sim.status === "cleared") {
      setStatus("Everyone is out after " + s.tEvac.toFixed(1) + " s (90 % after " + s.t90.toFixed(1) + " s). Specific flow while 20–80 % left: "
        + fmt(s.Js, 2) + " people per metre per second. " + (s.tEvac <= P.T_TARGET ? "The 180 s target is met." : "The 180 s target is missed."),
        s.tEvac <= P.T_TARGET ? "" : "warn");
    } else if (sim.status === "timeout") {
      setStatus(s.nLeft + " people were still inside after " + P.T_MAX + " s. At narrow exits the slowest people can stop at the door edges and never pass.", "warn");
    } else if (sim.status === "failed") {
      setStatus("The run stopped because a per-step check failed (" + sim.error + "). The time step is too large for this crowd; the batch run repeats such runs with half the step.", "bad");
    }
  }

  // ---------------------------------------------------------------- live run
  function reset() {
    stop();
    const s = settings();
    try {
      sim = new M.Simulation({ n: s.n, w: s.w, blockEast: s.blockEast, v0Mean: s.v0Mean, seed: s.seed });
    } catch (err) { sim = null; setStatus("Could not set up the run: " + err.message, "bad"); }
    simClock = 0;
    $("startBtn").textContent = "Start"; $("startBtn").disabled = !sim;
    if (sim) {
      setStatus(s.w < 1.0 ? "Exits narrower than about 1.0 m may never clear in this model: the slowest people stop at the door edges." : "",
                s.w < 1.0 ? "warn" : "");
      $("outEvac").textContent = "–"; $("outEvac").className = "v";
    }
    showReference();
    showOutputs(); drawView(); drawChart();
  }

  function loop(now) {
    const speed = settings().speed, wallDt = Math.min((now - lastWall) / 1000, 0.1);
    lastWall = now;
    simClock += speed * wallDt;
    const t0 = performance.now();
    while (!sim.done() && (speed === Infinity || sim.t < simClock) && performance.now() - t0 < FRAME_BUDGET_MS) {
      sim.advance(Math.max(1, Math.round(0.05 / sim.dt)));
    }
    if (sim.t < simClock - 1) simClock = sim.t;          // the computer cannot keep up: do not build a backlog
    showOutputs(); drawView(); drawChart();
    if (sim.done()) {
      running = false; $("startBtn").textContent = "Start"; $("startBtn").disabled = true;
      finishMessage(); return;
    }
    frame = requestAnimationFrame(loop);
  }

  function start() {
    if (!sim || sim.done()) return;
    running = true; $("startBtn").textContent = "Pause";
    simClock = sim.t; lastWall = performance.now();
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
    if (sim && !sim.done()) $("startBtn").textContent = "Start";
  }

  // ---------------------------------------------------------------- batch of 10 seeds
  function showReference() {
    const ref = findReference(settings());
    $("outRef").textContent = ref ? ref.mean.toFixed(1) + " ± " + ref.half.toFixed(1) + " s (Section " + ref.section + ")"
                                  : "no notebook case";
    if (!batch) { $("outBatch").textContent = "–"; $("outCheck").textContent = "–"; $("outCheck").className = "v check"; $("outSeeds").textContent = ""; }
    batchCurves = [];
  }

  function startBatch() {
    stop();
    const s = settings(), seeds = [];
    for (let k = 0; k < BATCH_SIZE; k++) seeds.push(s.seed + k);
    batch = { s: s, seeds: seeds, results: [], halved: 0, sim: null, dt: M.dtFor(s.n), timer: null };
    batchCurves = [];
    $("batchBtn").textContent = "Cancel batch";
    ["startBtn", "resetBtn"].forEach(function (id) { $(id).disabled = true; });
    setControlsDisabled(true);
    $("outCheck").textContent = "–"; $("outCheck").className = "v check"; $("outSeeds").textContent = "";
    batchStep();
  }

  function setControlsDisabled(d) {
    ["nPeople", "exitWidth", "v0Mean", "blockEast", "seed"].forEach(function (id) { $(id).disabled = d; });
  }

  function batchStep() {
    const b = batch;
    if (!b) return;
    const k = b.results.length;
    if (!b.sim) {
      b.sim = new M.Simulation({ n: b.s.n, w: b.s.w, blockEast: b.s.blockEast, v0Mean: b.s.v0Mean, seed: b.seeds[k], dt: b.dt });
    }
    const t0 = performance.now();
    while (!b.sim.done() && performance.now() - t0 < 40) b.sim.advance(200);
    $("outBatch").textContent = "running seed " + b.seeds[k] + " (" + (k + 1) + " of " + BATCH_SIZE + "), t = " + b.sim.t.toFixed(0) + " s";
    if (b.sim.done()) {
      if (b.sim.status === "failed" && b.dt > M.dtFor(b.s.n) / 4) {
        b.dt /= 2; b.sim = null; b.halved++;                 // repeat this seed with the step halved
      } else {
        const sum = b.sim.summary();
        b.results.push(sum);
        batchCurves.push({ n: b.s.n, t: b.sim.rec.t, outW: b.sim.rec.outW, outE: b.sim.rec.outE });
        b.sim = null; b.dt = M.dtFor(b.s.n);
        drawChart();
      }
    }
    if (b.results.length === BATCH_SIZE) { finishBatch(); return; }
    b.timer = setTimeout(batchStep, 0);
  }

  function finishBatch() {
    const b = batch, times = [], seeds = [];
    b.results.forEach(function (r, k) {
      if (r.cleared) times.push(r.tEvac);
      seeds.push(b.seeds[k] + ": " + (r.cleared ? r.tEvac.toFixed(1) + " s" : r.status === "failed" ? "failed" : "not cleared"));
    });
    const out = $("outBatch"), chk = $("outCheck");
    if (times.length === BATCH_SIZE) {
      const ci = M.meanCI(times);
      out.textContent = ci.mean.toFixed(1) + " ± " + ci.half.toFixed(1) + " s";
      const ref = findReference(b.s);
      if (ref) {
        const diff = Math.abs(ci.mean - ref.mean), tol = ci.half + ref.half, ok = diff <= tol;
        chk.textContent = (ok ? "✓ agrees" : "⚠ differs") + " (|Δ| = " + diff.toFixed(1) + " s, limit " + tol.toFixed(1) + " s)";
        chk.className = "v check " + (ok ? "ok" : "warn");
      } else { chk.textContent = "no notebook case for these settings"; chk.className = "v check"; }
    } else {
      out.textContent = times.length + " of " + BATCH_SIZE + " runs cleared";
      chk.textContent = "not comparable: some runs did not clear"; chk.className = "v check warn";
    }
    $("outSeeds").textContent = "Seeds: " + seeds.join(", ") + (b.halved ? ". " + b.halved + " run(s) were repeated with a halved time step." : ".");
    endBatch();
  }

  function endBatch() {
    if (batch && batch.timer) clearTimeout(batch.timer);
    batch = null;
    $("batchBtn").textContent = "Run 10 seeds";
    ["startBtn", "resetBtn"].forEach(function (id) { $(id).disabled = false; });
    setControlsDisabled(false);
    $("startBtn").disabled = !sim || sim.done();
    drawChart();
  }

  function cancelBatch() {
    endBatch();
    $("outBatch").textContent = "cancelled";
  }

  // ---------------------------------------------------------------- wiring
  $("startBtn").addEventListener("click", function () { running ? stop() : start(); });
  $("resetBtn").addEventListener("click", reset);
  $("batchBtn").addEventListener("click", function () { batch ? cancelBatch() : startBatch(); });
  ["nPeople", "exitWidth", "v0Mean"].forEach(function (id) {
    $(id).addEventListener("input", showSettings);
    $(id).addEventListener("change", reset);
  });
  ["blockEast", "seed"].forEach(function (id) { $(id).addEventListener("change", function () { showSettings(); reset(); }); });
  window.addEventListener("resize", function () { drawView(); drawChart(); });

  const test = M.selfTest();
  $("selfTest").textContent = "Self-test on page load (one person in open space against the analytic speed curve, as in the notebook's check V1): "
    + (test.pass ? "passed" : "FAILED") + ", largest speed error " + test.errV.toExponential(1) + " m/s, position error "
    + test.errX.toExponential(1) + " m (tolerance " + test.tol.toExponential(1) + ").";
  if (!test.pass) setStatus("The self-test of the integrator failed; results may be wrong.", "bad");

  showSettings();
  reset();
  if (!test.pass) setStatus("The self-test of the integrator failed; results may be wrong.", "bad");
})();
