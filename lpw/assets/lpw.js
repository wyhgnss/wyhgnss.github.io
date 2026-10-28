(() => {
  "use strict";

  const state = { manifest: null, frameIndex: 0, cache: new Map(), overlays: [], maps: [], markers: [], timer: null, selected: null, view: "maps" };
  const palette = [[48,18,59],[65,69,171],[42,159,214],[27,207,212],[97,208,79],[249,231,33],[244,138,44],[198,32,40]];
  const layerNames = ["Low", "Middle", "High"];
  const mercatorLimit = 85.05112878;
  const rasterSize = 720;
  const $ = (selector) => document.querySelector(selector);
  const basePath = new URL("../data/", document.currentScript.src).href;

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
      state.cache.set(frame.timestamp, inflate(await fetch(new URL(frame.url, basePath), { cache: "force-cache" })));
    }
    return state.cache.get(frame.timestamp);
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

  function interpolatedValue(data, layer, latitude, longitude) {
    const grid = state.manifest.grid;
    const latitudeIndex = Math.max(0, Math.min(grid.rows - 1, (latitude - grid.latitude_start) / grid.latitude_step));
    const wrappedLongitude = ((longitude - grid.longitude_start) % 360 + 360) % 360;
    const longitudeIndex = wrappedLongitude / grid.longitude_step;
    const row0 = Math.floor(latitudeIndex);
    const row1 = Math.min(grid.rows - 1, row0 + 1);
    const column0 = Math.floor(longitudeIndex) % grid.columns;
    const column1 = (column0 + 1) % grid.columns;
    const latitudeWeight = latitudeIndex - row0;
    const longitudeWeight = longitudeIndex - Math.floor(longitudeIndex);
    const samples = [
      [valueAt(data, layer, row0, column0), (1 - latitudeWeight) * (1 - longitudeWeight)],
      [valueAt(data, layer, row0, column1), (1 - latitudeWeight) * longitudeWeight],
      [valueAt(data, layer, row1, column0), latitudeWeight * (1 - longitudeWeight)],
      [valueAt(data, layer, row1, column1), latitudeWeight * longitudeWeight]
    ];
    let weightedValue = 0;
    let validWeight = 0;
    samples.forEach(([sample, weight]) => {
      if (sample !== null) { weightedValue += sample * weight; validWeight += weight; }
    });
    return validWeight > 0 ? weightedValue / validWeight : null;
  }

  function mercatorRasterUrl(data, layerIndex) {
    const canvas = document.createElement("canvas");
    canvas.width = rasterSize;
    canvas.height = rasterSize;
    const context = canvas.getContext("2d");
    const image = context.createImageData(rasterSize, rasterSize);
    for (let y = 0; y < rasterSize; y += 1) {
      const mercatorY = Math.PI * (1 - 2 * ((y + .5) / rasterSize));
      const latitude = Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI;
      for (let x = 0; x < rasterSize; x += 1) {
        const longitude = -180 + 360 * ((x + .5) / rasterSize);
        const value = interpolatedValue(data, layerIndex, latitude, longitude);
        const offset = (y * rasterSize + x) * 4;
        if (value === null) continue;
        const rgb = color(value);
        image.data[offset] = rgb[0];
        image.data[offset + 1] = rgb[1];
        image.data[offset + 2] = rgb[2];
        image.data[offset + 3] = 228;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function initialiseMaps() {
    ["map-low", "map-mid", "map-high"].forEach((id, index) => {
      const map = L.map(id, { worldCopyJump: true, minZoom: 1, maxZoom: 7, zoomControl: index === 0, attributionControl: index === 2 }).setView([16, 8], 1);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, className: "base-tiles", attribution: "© OpenStreetMap contributors" }).addTo(map);
      map.on("click", (event) => selectPoint(event.latlng.lat, event.latlng.lng));
      state.maps.push(map);
    });
    let syncing = false;
    state.maps.forEach((source) => source.on("move", () => {
      if (syncing) return;
      syncing = true;
      state.maps.filter((map) => map !== source).forEach((map) => map.setView(source.getCenter(), source.getZoom(), { animate: false }));
      syncing = false;
    }));
  }

  async function renderFrame(index) {
    state.frameIndex = Math.max(0, Math.min(index, state.manifest.frames.length - 1));
    const data = await loadFrame(state.frameIndex);
    const frame = state.manifest.frames[state.frameIndex];
    $("#timeline").value = state.frameIndex;
    $("#frame-time").textContent = new Date(frame.timestamp).toISOString().slice(0, 16).replace("T", " ");
    $("#analysis-time").textContent = new Date(frame.timestamp).toISOString().slice(0, 16).replace("T", " ") + " UTC";
    state.overlays.forEach((overlay) => overlay.remove());
    state.overlays = [];
    state.maps.forEach((map, layerIndex) => {
      const imageUrl = mercatorRasterUrl(data, layerIndex);
      [-360, 0, 360].forEach((longitudeShift) => {
        const overlay = L.imageOverlay(
          imageUrl,
          [[-mercatorLimit, -180 + longitudeShift], [mercatorLimit, 180 + longitudeShift]],
          { opacity: .92, interactive: false, className: "lpw-image-layer" }
        );
        overlay.once("error", () => showError(new Error("The LPW raster could not be rendered.")));
        state.overlays.push(overlay.addTo(map));
      });
    });
    if (state.view === "stack") renderStack(data);
  }

  function renderStack(data) {
    const grid = state.manifest.grid, stride = 3;
    const x = Array.from({ length: Math.ceil(grid.columns / stride) }, (_, i) => grid.longitude_start + i * stride * grid.longitude_step);
    const y = Array.from({ length: Math.ceil(grid.rows / stride) }, (_, i) => grid.latitude_start + i * stride * grid.latitude_step);
    const traces = [0, 1, 2].map((layer) => ({
      type: "surface", x, y,
      z: y.map(() => x.map(() => layer * 1.45)),
      surfacecolor: y.map((_, row) => x.map((__, column) => valueAt(data, layer, row * stride, column * stride))),
      customdata: y.map((_, row) => x.map((__, column) => valueAt(data, layer, row * stride, column * stride))),
      colorscale: [[0,"#30123b"],[.14,"#4145ab"],[.29,"#2a9fd6"],[.43,"#1bcfd4"],[.57,"#61d04f"],[.72,"#f9e721"],[.86,"#f48a2c"],[1,"#c62028"]],
      cmin: 0, cmax: 40, opacity: .83, showscale: false, name: layerNames[layer], hovertemplate: `${layerNames[layer]}<br>%{y:.1f}°, %{x:.1f}°<br>%{customdata:.2f} mm<extra></extra>`
    }));
    Plotly.react("stack-plot", traces, {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 10, b: 10 }, showlegend: false,
      scene: { bgcolor: "rgba(0,0,0,0)", camera: { eye: { x: 1.45, y: -1.55, z: 1.05 } }, aspectratio: { x: 2.2, y: 1.15, z: .42 },
        xaxis: { title: "Longitude", color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        yaxis: { title: "Latitude", color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        zaxis: { title: "Layer", tickvals: [0,1.45,2.9], ticktext: ["Low","Middle","High"], color: "#9fb0ba", gridcolor: "#18303d", zerolinecolor: "#18303d" } }
    }, { responsive: true, displaylogo: false });
  }

  function coordinates(lat, lon) {
    const grid = state.manifest.grid;
    const wrappedLon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { row: Math.max(0, Math.min(grid.rows - 1, Math.round((lat - grid.latitude_start) / grid.latitude_step))), column: Math.max(0, Math.min(grid.columns - 1, Math.round((wrappedLon - grid.longitude_start) / grid.longitude_step))), lat, lon: wrappedLon };
  }

  async function selectPoint(lat, lon) {
    state.selected = coordinates(lat, lon);
    $("#selected-point").textContent = `${state.selected.lat.toFixed(2)}°, ${state.selected.lon.toFixed(2)}°`;
    state.markers.forEach((marker) => marker.remove());
    state.markers = state.maps.map((map) => L.circleMarker([lat, lon], { radius: 5, color: "#fff", weight: 2, fillColor: "#48d5c8", fillOpacity: 1 }).addTo(map));
    $("#history-empty").hidden = true; $("#history-loading").hidden = false;
    try {
      const frames = await Promise.all(state.manifest.frames.map((_, index) => loadFrame(index)));
      const series = [0, 1, 2].map((layer) => frames.map((data) => valueAt(data, layer, state.selected.row, state.selected.column)));
      Plotly.react("history-plot", series.map((values, layer) => ({ x: state.manifest.frames.map((frame) => frame.timestamp), y: values, name: layerNames[layer], mode: "lines", line: { color: ["#48d5c8", "#f2cc60", "#f05d5e"][layer], width: 2 }, hovertemplate: "%{x|%b %d, %H:%M}<br>%{y:.2f} mm<extra>" + layerNames[layer] + "</extra>" })), {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 54, r: 24, t: 30, b: 50 },
        font: { color: "#91a4ae", family: "Inter, sans-serif", size: 11 }, legend: { orientation: "h", x: 0, y: 1.12 }, hovermode: "x unified",
        xaxis: { gridcolor: "#18303d", zeroline: false }, yaxis: { title: "LPW (mm)", rangemode: "tozero", gridcolor: "#18303d", zerolinecolor: "#29404b" }
      }, { responsive: true, displaylogo: false });
    } catch (error) { showError(error); }
    finally { $("#history-loading").hidden = true; }
  }

  function setPlaying(playing) {
    clearInterval(state.timer); state.timer = null;
    $("#play").innerHTML = playing ? "<span aria-hidden='true'>❚❚</span> Pause" : "<span aria-hidden='true'>▶</span> Play";
    if (playing) state.timer = setInterval(() => renderFrame((state.frameIndex + 1) % state.manifest.frames.length).catch(showError), 900);
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
      if (state.view === "stack") renderStack(await loadFrame(state.frameIndex));
      else setTimeout(() => state.maps.forEach((map) => map.invalidateSize()), 0);
    }));
  }

  async function start() {
    try {
      state.manifest = await (await fetch(new URL("manifest.json", basePath), { cache: "no-store" })).json();
      if (!state.manifest.frames.length) throw new Error("No LPW frames have been published yet. Run the data workflow to initialise the archive.");
      $("#archive-size").textContent = `${state.manifest.frames.length} hourly frames`;
      $("#timeline").max = state.manifest.frames.length - 1;
      state.frameIndex = state.manifest.frames.length - 1;
      initialiseMaps(); bindControls(); await renderFrame(state.frameIndex);
      $("#loading").hidden = true;
    } catch (error) { $("#loading").hidden = true; showError(error); }
  }

  start();
})();
