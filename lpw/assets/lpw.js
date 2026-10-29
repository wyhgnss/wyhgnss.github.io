(() => {
  "use strict";

  const state = { manifest: null, coastline: null, frameIndex: 0, cache: new Map(), canvases: [], currentData: null, timer: null, selected: null, last3DPoint: null, view: "maps", historyRequestId: 0 };
  const palette = [[48,18,59],[65,69,171],[42,159,214],[27,207,212],[97,208,79],[249,231,33],[244,138,44],[198,32,40]];
  const layerNames = ["Low", "Middle", "High"];
  const $ = (selector) => document.querySelector(selector);
  const basePath = new URL("../data/", document.currentScript.src).href;
  const assetPath = new URL(".", document.currentScript.src).href;
  const PLAYBACK_INTERVAL_MS = 80;
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function fetchWithRetry(url, options = {}, attempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(url, { ...options, cache: attempt === 0 ? options.cache : "reload" });
        if (response.ok) return response;
        lastError = new Error(`Data request failed (${response.status})`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error;
      }
      if (attempt + 1 < attempts) await wait(350 * (attempt + 1));
    }
    throw lastError || new Error("Data request failed");
  }

  async function loadCoastline() {
    const response = await fetch(new URL("coastlines.json", assetPath), { cache: "force-cache" });
    if (!response.ok) throw new Error(`Coastline request failed (${response.status})`);
    state.coastline = await response.json();
  }

  async function inflate(response) {
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    if (!("DecompressionStream" in window)) throw new Error("This browser cannot decompress the LPW dataset. Please use a current Chrome, Edge, Firefox, or Safari release.");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Int16Array(await new Response(stream).arrayBuffer());
  }

  async function loadFrame(index) {
    const frame = state.manifest.frames[index];
    if (!frame) throw new Error("The requested analysis frame is unavailable.");
    if (!state.cache.has(frame.timestamp)) {
      const request = fetchWithRetry(new URL(frame.url, basePath), { cache: "force-cache" }).then(inflate);
      state.cache.set(frame.timestamp, request);
    }
    try {
      return await state.cache.get(frame.timestamp);
    } catch (error) {
      state.cache.delete(frame.timestamp);
      throw error;
    }
  }

  async function loadHistoryFrames(requestId, concurrency = 4) {
    const results = new Array(state.manifest.frames.length).fill(null);
    let nextIndex = 0;
    let loaded = 0;
    async function worker() {
      while (nextIndex < results.length) {
        const index = nextIndex;
        nextIndex += 1;
        try { results[index] = await loadFrame(index); }
        catch (error) { console.warn(`LPW frame ${index} is temporarily unavailable`, error); }
        loaded += 1;
        if (requestId === state.historyRequestId) {
          $("#history-loading").textContent = `Loading point history… ${loaded}/${results.length}`;
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, results.length) }, worker));
    return results;
  }

  function valueAt(data, layer, row, column) {
    const grid = state.manifest.grid;
    const raw = data[layer * grid.rows * grid.columns + row * grid.columns + column];
    return raw === grid.missing ? null : raw * grid.scale;
  }

  function color(value) {
    const t = Math.max(0, Math.min(1, value / 40)) * (palette.length - 1);
    const i = Math.min(palette.length - 2, Math.floor(t));
    const f = t - i;
    return palette[i].map((channel, j) => Math.round(channel + (palette[i + 1][j] - channel) * f));
  }

  function drawCoastline(context, canvas) {
    if (!state.coastline) return;
    const { latitude, longitude } = state.coastline;
    context.save();
    context.beginPath();
    context.strokeStyle = "rgba(248, 252, 253, .82)";
    context.lineWidth = .75;
    context.lineJoin = "round";
    let drawing = false;
    let previousLongitude = null;
    for (let i = 0; i < latitude.length; i += 1) {
      const lat = latitude[i];
      const lon = longitude[i];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        drawing = false;
        previousLongitude = null;
        continue;
      }
      const x = (lon + 180) / 360 * canvas.width;
      const y = (90 - lat) / 180 * canvas.height;
      if (!drawing || (previousLongitude !== null && Math.abs(lon - previousLongitude) > 180)) {
        context.moveTo(x, y);
        drawing = true;
      } else {
        context.lineTo(x, y);
      }
      previousLongitude = lon;
    }
    context.stroke();
    context.restore();
  }

  function drawSelection(context, canvas) {
    if (!state.selected) return;
    const x = (state.selected.lon + 180) / 360 * canvas.width;
    const y = (90 - state.selected.lat) / 180 * canvas.height;
    context.save();
    context.beginPath(); context.arc(x, y, 3.6, 0, Math.PI * 2);
    context.fillStyle = "#48d5c8"; context.fill();
    context.lineWidth = 1.5; context.strokeStyle = "#ffffff"; context.stroke();
    context.restore();
  }

  function renderFlatLayer(data, layerIndex, canvas) {
    const { rows, columns } = state.manifest.grid;
    canvas.width = columns;
    canvas.height = rows;
    const context = canvas.getContext("2d");
    const image = context.createImageData(columns, rows);
    for (let y = 0; y < rows; y += 1) {
      const sourceRow = rows - 1 - y;
      for (let x = 0; x < columns; x += 1) {
        const value = valueAt(data, layerIndex, sourceRow, x);
        const offset = (y * columns + x) * 4;
        if (value === null) continue;
        const rgb = color(value);
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    drawCoastline(context, canvas);
    drawSelection(context, canvas);
  }

  function renderFlatMaps(data) {
    state.currentData = data;
    state.canvases.forEach((canvas, layerIndex) => renderFlatLayer(data, layerIndex, canvas));
  }

  function initialiseCanvases() {
    state.canvases = ["map-low", "map-mid", "map-high"].map((id) => {
      const canvas = document.getElementById(id);
      canvas.addEventListener("click", (event) => {
        const bounds = canvas.getBoundingClientRect();
        const longitude = -180 + 360 * ((event.clientX - bounds.left) / bounds.width);
        const latitude = 90 - 180 * ((event.clientY - bounds.top) / bounds.height);
        selectPoint(latitude, longitude);
      });
      return canvas;
    });
  }

  async function renderFrame(index) {
    state.frameIndex = Math.max(0, Math.min(index, state.manifest.frames.length - 1));
    const data = await loadFrame(state.frameIndex);
    const frame = state.manifest.frames[state.frameIndex];
    $("#timeline").value = state.frameIndex;
    const utcTime = new Date(frame.timestamp);
    const utcLabel = utcTime.toISOString().slice(0, 16).replace("T", " ");
    const beijingLabel = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace("T", " ");
    $("#frame-time").textContent = utcLabel;
    $("#analysis-time").textContent = utcLabel + " UTC";
    $("#analysis-time-beijing").textContent = beijingLabel + " Beijing (UTC+8)";
    renderFlatMaps(data);
    if (state.view === "stack") await renderStack(data);
  }

  async function renderStack(data) {
    const grid = state.manifest.grid, stride = 3;
    const layerGap = 4;
    const x = Array.from({ length: Math.ceil(grid.columns / stride) }, (_, i) => grid.longitude_start + i * stride * grid.longitude_step);
    const y = Array.from({ length: Math.ceil(grid.rows / stride) }, (_, i) => grid.latitude_start + i * stride * grid.latitude_step);
    const traces = [0, 1, 2].map((layer) => ({
      type: "surface", x, y,
      z: y.map(() => x.map(() => layer * layerGap)),
      surfacecolor: y.map((_, row) => x.map((__, column) => valueAt(data, layer, row * stride, column * stride))),
      colorscale: [[0,"#30123b"],[.14,"#4145ab"],[.29,"#2a9fd6"],[.43,"#1bcfd4"],[.57,"#61d04f"],[.72,"#f9e721"],[.86,"#f48a2c"],[1,"#c62028"]],
      cmin: 0, cmax: 40, opacity: .83, showscale: false, name: layerNames[layer], hovertemplate: `${layerNames[layer]}<br>%{y:.1f}°, %{x:.1f}°<extra></extra>`
    }));
    const plot = document.getElementById("stack-plot");
    await Plotly.react(plot, traces, {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 10, b: 10 }, showlegend: false,
      scene: { bgcolor: "rgba(0,0,0,0)", camera: { eye: { x: 1.45, y: -1.55, z: 1.15 } }, aspectratio: { x: 2.2, y: 1.15, z: .82 },
        xaxis: { title: "Longitude", color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        yaxis: { title: "Latitude", color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        zaxis: { title: "Layer", tickvals: [0, layerGap, layerGap * 2], ticktext: ["Low","Middle","High"], color: "#9fb0ba", gridcolor: "#18303d", zerolinecolor: "#18303d" } }
    }, { responsive: true, displaylogo: false });
    plot.dataset.pointClickReadyAt = String(performance.now() + 1500);
    if (!plot.dataset.pointClickBound) {
      plot.on("plotly_hover", (event) => {
        const point = event.points && event.points[0];
        if (point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))) {
          state.last3DPoint = { lat: Number(point.y), lon: Number(point.x) };
        }
      });
      plot.on("plotly_unhover", () => { state.last3DPoint = null; });
      plot.addEventListener("click", (event) => {
        if (performance.now() < Number(plot.dataset.pointClickReadyAt || 0)) return;
        if (event.target.closest && event.target.closest(".modebar")) return;
        if (state.last3DPoint) selectPoint(state.last3DPoint.lat, state.last3DPoint.lon);
      });
      plot.dataset.pointClickBound = "true";
    }
  }

  function coordinates(lat, lon) {
    const grid = state.manifest.grid;
    const wrappedLon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { row: Math.max(0, Math.min(grid.rows - 1, Math.round((lat - grid.latitude_start) / grid.latitude_step))), column: Math.max(0, Math.min(grid.columns - 1, Math.round((wrappedLon - grid.longitude_start) / grid.longitude_step))), lat, lon: wrappedLon };
  }

  async function selectPoint(lat, lon) {
    state.selected = coordinates(lat, lon);
    $("#selected-point").textContent = `${state.selected.lat.toFixed(2)}°, ${state.selected.lon.toFixed(2)}°`;
    if (state.currentData) renderFlatMaps(state.currentData);
    $("#history-empty").hidden = true;
    $("#history-status").hidden = true;
    $("#history-loading").textContent = "Loading point history… 0/" + state.manifest.frames.length;
    $("#history-loading").hidden = false;
    const requestId = ++state.historyRequestId;
    try {
      const frames = await loadHistoryFrames(requestId);
      if (requestId !== state.historyRequestId) return;
      const available = frames.filter(Boolean).length;
      if (!available) throw new Error("The history archive is temporarily unavailable. Please try again in a moment.");
      const series = [0, 1, 2].map((layer) => frames.map((data) => data ? valueAt(data, layer, state.selected.row, state.selected.column) : null));
      Plotly.react("history-plot", series.map((values, layer) => ({ x: state.manifest.frames.map((frame) => frame.timestamp), y: values, name: layerNames[layer], mode: "lines", line: { color: ["#48d5c8", "#f2cc60", "#f05d5e"][layer], width: 2 }, hovertemplate: "%{y:.2f} mm<extra></extra>" })), {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 54, r: 24, t: 30, b: 50 },
        font: { color: "#91a4ae", family: "Inter, sans-serif", size: 11 }, legend: { orientation: "h", x: 0, y: 1.12 }, hovermode: "x",
        xaxis: { gridcolor: "#18303d", zeroline: false }, yaxis: { title: "LPW (mm)", rangemode: "tozero", gridcolor: "#18303d", zerolinecolor: "#29404b" }
      }, { responsive: true, displaylogo: false });
      $("#history-status").textContent = available === frames.length
        ? `${available} hourly frames loaded`
        : `${available}/${frames.length} hourly frames loaded · gaps indicate temporary server errors`;
      $("#history-status").hidden = false;
    } catch (error) { showError(error); }
    finally { $("#history-loading").hidden = true; }
  }

  function setPlaying(playing) {
    clearInterval(state.timer); state.timer = null;
    $("#play").innerHTML = playing ? "<span aria-hidden='true'>❚❚</span> Pause" : "<span aria-hidden='true'>▶</span> Play";
    if (playing) state.timer = setInterval(() => renderFrame((state.frameIndex + 1) % state.manifest.frames.length).catch(showError), PLAYBACK_INTERVAL_MS);
  }

  function showError(error) { $("#error").hidden = false; $("#error").textContent = error.message || String(error); console.error(error); }

  function bindControls() {
    $("#timeline").addEventListener("input", (event) => renderFrame(Number(event.target.value)).catch(showError));
    $("#step-back").addEventListener("click", () => renderFrame(state.frameIndex - 1).catch(showError));
    $("#step-forward").addEventListener("click", () => renderFrame(state.frameIndex + 1).catch(showError));
    $("#play").addEventListener("click", () => setPlaying(!state.timer));
    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", async () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", item === button); });
      $("#maps-view").hidden = state.view !== "maps"; $("#stack-view").hidden = state.view !== "stack";
      if (state.view === "stack") await renderStack(await loadFrame(state.frameIndex));
    }));
  }

  async function start() {
    try {
      state.manifest = await (await fetchWithRetry(new URL("manifest.json", basePath), { cache: "no-store" })).json();
      if (!state.manifest.frames.length) throw new Error("No LPW frames have been published yet. Run the data workflow to initialise the archive.");
      await loadCoastline();
      $("#timeline").max = state.manifest.frames.length - 1;
      state.frameIndex = state.manifest.frames.length - 1;
      initialiseCanvases(); bindControls(); await renderFrame(state.frameIndex);
      $("#loading").hidden = true;
    } catch (error) { $("#loading").hidden = true; showError(error); }
  }

  start();
})();
