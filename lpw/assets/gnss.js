(() => {
  "use strict";

  const scriptUrl = document.currentScript.src;
  const dataPath = new URL("../data/gnss/", scriptUrl);
  const assetPath = new URL(".", scriptUrl);
  const layerNames = ["Low", "Middle", "High"];
  const layerColors = ["#48d5c8", "#f2cc60", "#f05d5e"];
  const DEFAULT_GNSS_DATE = "2023-05-20";
  const colorscale = [[0,"#30123b"],[.14,"#4145ab"],[.29,"#2a9fd6"],[.43,"#1bcfd4"],[.57,"#61d04f"],[.72,"#f9e721"],[.86,"#f48a2c"],[1,"#c62028"]];
  const $ = (selector) => document.querySelector(selector);
  const state = {
    manifest: null,
    coastline: null,
    timeIndex: 0,
    view: "maps",
    arrays: null,
    stationRows: new Map(),
    hoveredStation: null,
    selectedStation: null
  };

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function plotTheme() {
    const light = document.documentElement.dataset.theme === "light";
    return light
      ? { text: "#334952", muted: "#526770", grid: "#cbd8dc", zero: "#b8c9ce", coast: "rgba(30,55,65,.72)", land: "#e4ebed", ocean: "#f7f9fa", boundary: "rgba(29,52,62,.9)", markerLine: "rgba(24,45,54,.58)" }
      : { text: "#91a4ae", muted: "#78909c", grid: "#18303d", zero: "#29404b", coast: "rgba(232,241,245,.68)", land: "#0c1c26", ocean: "#071018", boundary: "rgba(255,255,255,.9)", markerLine: "rgba(255,255,255,.62)" };
  }

  async function fetchWithRetry(url, attempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(url, { cache: attempt ? "reload" : "force-cache" });
        if (response.ok) return response;
        lastError = new Error(`GNSS data request failed (${response.status})`);
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error;
      }
      if (attempt + 1 < attempts) await wait(400 * (attempt + 1));
    }
    throw lastError || new Error("GNSS data request failed");
  }

  async function inflate(response) {
    if (!("DecompressionStream" in window)) {
      throw new Error("This browser cannot decompress the GNSS archive. Please use a current browser release.");
    }
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
  }

  function decodeBinary(buffer) {
    const count = state.manifest.record_count;
    const padding = state.manifest.binary.padding_after_station;
    const stationOffset = count * 2;
    const valuesOffset = stationOffset + count + padding;
    const expectedBytes = valuesOffset + count * 6;
    if (buffer.byteLength !== expectedBytes) {
      throw new Error(`GNSS archive size mismatch (${buffer.byteLength} received, ${expectedBytes} expected)`);
    }
    state.arrays = {
      time: new Uint16Array(buffer, 0, count),
      station: new Uint8Array(buffer, stationOffset, count),
      low: new Int16Array(buffer, valuesOffset, count),
      middle: new Int16Array(buffer, valuesOffset + count * 2, count),
      high: new Int16Array(buffer, valuesOffset + count * 4, count)
    };
  }

  function value(row, layer) {
    return state.arrays[["low", "middle", "high"][layer]][row] * state.manifest.scale;
  }

  function rowsAtTime(index) {
    const start = state.manifest.offsets[index];
    const end = state.manifest.offsets[index + 1];
    return Array.from({ length: end - start }, (_, offset) => start + offset);
  }

  function stationDisplay(index) {
    const station = state.manifest.stations[index];
    return station.name;
  }

  function snapshot() {
    const rows = rowsAtTime(state.timeIndex);
    const stations = rows.map((row) => state.arrays.station[row]);
    return {
      rows,
      stations,
      latitude: stations.map((index) => state.manifest.stations[index].latitude),
      longitude: stations.map((index) => state.manifest.stations[index].longitude),
      labels: stations.map(stationDisplay),
      values: [0, 1, 2].map((layer) => rows.map((row) => value(row, layer)))
    };
  }

  function geoStyle(domain) {
    const theme = plotTheme();
    return {
      domain,
      projection: { type: "equirectangular" },
      bgcolor: "rgba(0,0,0,0)",
      showframe: false,
      showcoastlines: true,
      coastlinecolor: theme.coast,
      coastlinewidth: .7,
      showcountries: false,
      showland: true,
      landcolor: theme.land,
      showocean: true,
      oceancolor: theme.ocean,
      lataxis: { range: [-90, 90], showgrid: false },
      lonaxis: { range: [-180, 180], showgrid: false }
    };
  }

  function bindStationClick(plot) {
    if (plot.dataset.stationClickBound) return;
    plot.on("plotly_click", (event) => {
      const index = Number(event.points?.[0]?.customdata);
      if (Number.isInteger(index) && index >= 0 && index < state.manifest.stations.length) {
        renderStationHistory(index);
      }
    });
    plot.dataset.stationClickBound = "true";
  }

  function bind3DStationClick(plot) {
    bindStationClick(plot);
    if (plot.dataset.stationClickFallbackBound) return;
    plot.on("plotly_hover", (event) => {
      const index = Number(event.points?.[0]?.customdata);
      state.hoveredStation = Number.isInteger(index) ? index : null;
    });
    plot.on("plotly_unhover", () => { state.hoveredStation = null; });
    plot.addEventListener("click", (event) => {
      if (event.target.closest?.(".modebar")) return;
      if (Number.isInteger(state.hoveredStation)) renderStationHistory(state.hoveredStation);
    });
    plot.dataset.stationClickFallbackBound = "true";
  }

  async function renderFlatMaps(data) {
    const plotIds = ["gnss-map-low", "gnss-map-mid", "gnss-map-high"];
    const theme = plotTheme();
    await Promise.all(plotIds.map(async (id, layer) => {
      const plot = document.getElementById(id);
      const trace = {
        type: "scattergeo",
        mode: "markers",
        lat: data.latitude,
        lon: data.longitude,
        text: data.labels,
        customdata: data.stations,
        marker: {
          color: data.values[layer],
          colorscale,
          cmin: 0,
          cmax: 40,
          size: 9,
          opacity: .94,
          line: { color: theme.markerLine, width: .55 },
          showscale: false
        },
        hovertemplate: "<b>%{text}</b><br>%{marker.color:.2f} mm<extra></extra>"
      };
      await Plotly.react(plot, [trace], {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 4, r: 4, t: 4, b: 4 },
        font: { color: theme.text, family: "Inter, sans-serif", size: 11 },
        showlegend: false,
        geo: geoStyle({ x: [0, 1], y: [0, 1] })
      }, { responsive: true, displaylogo: false, scrollZoom: false });
      bindStationClick(plot);
    }));
  }

  function coastlineTrace(layer, gap) {
    const theme = plotTheme();
    const longitude = [], latitude = [], height = [];
    for (let index = 0; index < state.coastline.latitude.length; index += 1) {
      const lat = state.coastline.latitude[index];
      const lon = state.coastline.longitude[index];
      const valid = Number.isFinite(lat) && Number.isFinite(lon);
      latitude.push(valid ? lat : null);
      longitude.push(valid ? lon : null);
      height.push(valid ? layer * gap : null);
    }
    return {
      type: "scatter3d", mode: "lines", x: longitude, y: latitude, z: height,
      line: { color: theme.coast, width: 1 },
      hoverinfo: "skip", showlegend: false
    };
  }

  function boundaryTrace(layer, gap) {
    const theme = plotTheme();
    return {
      type: "scatter3d",
      mode: "lines",
      x: [-180, 180, 180, -180, -180],
      y: [-90, -90, 90, 90, -90],
      z: [0, 0, 0, 0, 0].map(() => layer * gap),
      line: { color: theme.boundary, width: 2 },
      hoverinfo: "skip",
      showlegend: false
    };
  }

  async function renderStack(data) {
    const plot = $("#gnss-stack-plot");
    const gap = 12;
    const theme = plotTheme();
    const coastlines = [0, 1, 2].map((layer) => coastlineTrace(layer, gap));
    const boundaries = [0, 1, 2].map((layer) => boundaryTrace(layer, gap));
    const markers = [0, 1, 2].map((layer) => ({
      type: "scatter3d",
      mode: "markers",
      name: layerNames[layer],
      x: data.longitude,
      y: data.latitude,
      z: data.latitude.map(() => layer * gap),
      text: data.labels,
      customdata: data.stations,
      marker: {
        color: data.values[layer], colorscale, cmin: 0, cmax: 40,
        size: 6, opacity: .95,
        line: { color: theme.markerLine, width: .45 },
        showscale: false
      },
      hovertemplate: "<b>%{text}</b><br>%{marker.color:.2f} mm<extra></extra>"
    }));

    await Plotly.react(plot, [...boundaries, ...coastlines, ...markers], {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 0, t: 10, b: 10 }, showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        camera: { eye: { x: 1.45, y: -1.55, z: 1.18 } },
        aspectratio: { x: 2.2, y: 1.15, z: 1.22 },
        xaxis: { title: "Longitude", range: [-180, 180], color: theme.muted, gridcolor: theme.grid, zerolinecolor: theme.grid },
        yaxis: { title: "Latitude", range: [-90, 90], color: theme.muted, gridcolor: theme.grid, zerolinecolor: theme.grid },
        zaxis: { title: "Layer", range: [-1, gap * 2 + 1], tickvals: [0, gap, gap * 2], ticktext: layerNames, color: theme.text, gridcolor: theme.grid, zerolinecolor: theme.grid }
      }
    }, { responsive: true, displaylogo: false });
    bind3DStationClick(plot);
  }

  function availableTimesOnDate(date) {
    const prefix = `${date}T`;
    const indices = [];
    state.manifest.times.forEach((time, index) => { if (time.startsWith(prefix)) indices.push(index); });
    return indices;
  }

  function populateTimeSelect(date, preferredIndex) {
    const indices = availableTimesOnDate(date);
    const select = $("#gnss-time");
    select.replaceChildren();
    indices.forEach((index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = state.manifest.times[index].slice(11, 16);
      option.selected = index === preferredIndex;
      select.append(option);
    });
    select.disabled = !indices.length;
    return indices;
  }

  async function renderTime(index) {
    state.timeIndex = Math.max(0, Math.min(index, state.manifest.times.length - 1));
    const timestamp = state.manifest.times[state.timeIndex];
    const date = timestamp.slice(0, 10);
    $("#gnss-date").value = date;
    populateTimeSelect(date, state.timeIndex);
    $("#gnss-time").value = state.timeIndex;
    const data = snapshot();
    $("#gnss-observation-time").textContent = timestamp.replace("T", " ");
    $("#gnss-station-count").textContent = `${data.rows.length} station${data.rows.length === 1 ? "" : "s"} available`;
    $("#gnss-error").hidden = true;
    if (state.view === "maps") await renderFlatMaps(data);
    else await renderStack(data);
  }

  function rowsForStation(stationIndex) {
    if (!state.stationRows.has(stationIndex)) {
      const rows = [];
      for (let row = 0; row < state.arrays.station.length; row += 1) {
        if (state.arrays.station[row] === stationIndex) rows.push(row);
      }
      state.stationRows.set(stationIndex, rows);
    }
    return state.stationRows.get(stationIndex);
  }

  async function renderStationHistory(stationIndex) {
    state.selectedStation = stationIndex;
    const station = state.manifest.stations[stationIndex];
    const rows = rowsForStation(stationIndex);
    const times = rows.map((row) => state.manifest.times[state.arrays.time[row]]);
    const series = [0, 1, 2].map((layer) => rows.map((row) => value(row, layer)));

    $("#gnss-selected-station").textContent = `${station.name} · ${station.latitude.toFixed(4)}°, ${station.longitude.toFixed(4)}°`;
    $("#gnss-history-empty").hidden = true;
    $("#gnss-history-status").textContent = `${rows.length.toLocaleString()} available epochs · ${state.manifest.times[0].slice(0, 10)} to ${state.manifest.times.at(-1).slice(0, 10)}`;
    $("#gnss-history-status").hidden = false;
    const theme = plotTheme();
    await Plotly.react("gnss-history-plot", series.map((values, layer) => ({
      type: "scattergl",
      x: times,
      y: values,
      name: layerNames[layer],
      mode: "lines",
      line: { color: layerColors[layer], width: 1.6 },
      hovertemplate: "%{y:.2f} mm<extra></extra>"
    })), {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 54, r: 24, t: 42, b: 54 },
      font: { color: theme.text, family: "Inter, sans-serif", size: 11 },
      legend: { orientation: "h", x: 0, y: 1.1 }, hovermode: "x",
      xaxis: { gridcolor: theme.grid, zeroline: false, rangeslider: { visible: true, thickness: .08 } },
      yaxis: { title: "GNSS LPW (mm)", rangemode: "tozero", gridcolor: theme.grid, zerolinecolor: theme.zero }
    }, { responsive: true, displaylogo: false });
  }

  function showError(error) {
    $("#gnss-error").hidden = false;
    $("#gnss-error").textContent = error.message || String(error);
    console.error(error);
  }

  function bindControls() {
    $("#gnss-date").addEventListener("change", (event) => {
      const indices = populateTimeSelect(event.target.value, -1);
      if (!indices.length) {
        showError(new Error("No GNSS observations are available on the selected date."));
        return;
      }
      renderTime(indices[0]).catch(showError);
    });
    $("#gnss-time").addEventListener("change", (event) => renderTime(Number(event.target.value)).catch(showError));
    $("#gnss-step-back").addEventListener("click", () => renderTime(state.timeIndex - 1).catch(showError));
    $("#gnss-step-forward").addEventListener("click", () => renderTime(state.timeIndex + 1).catch(showError));
    document.querySelectorAll("[data-gnss-view]").forEach((button) => button.addEventListener("click", () => {
      state.view = button.dataset.gnssView;
      document.querySelectorAll("[data-gnss-view]").forEach((item) => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", item === button);
      });
      $("#gnss-maps-view").hidden = state.view !== "maps";
      $("#gnss-stack-view").hidden = state.view !== "stack";
      renderTime(state.timeIndex).catch(showError);
    }));
  }

  async function start() {
    try {
      const [manifestResponse, binaryResponse, coastlineResponse] = await Promise.all([
        fetchWithRetry(new URL("manifest.json", dataPath)),
        fetchWithRetry(new URL("observations.bin.gz", dataPath)),
        fetchWithRetry(new URL("coastlines.json", assetPath))
      ]);
      state.manifest = await manifestResponse.json();
      state.coastline = await coastlineResponse.json();
      decodeBinary(await inflate(binaryResponse));
      $("#gnss-date").min = state.manifest.times[0].slice(0, 10);
      $("#gnss-date").max = state.manifest.times.at(-1).slice(0, 10);
      bindControls();
      const defaultTimes = availableTimesOnDate(DEFAULT_GNSS_DATE);
      await renderTime(defaultTimes[0] ?? state.manifest.times.length - 1);
      $("#gnss-loading").hidden = true;
    } catch (error) {
      $("#gnss-loading").hidden = true;
      showError(error);
    }
  }

  window.addEventListener("lpw-theme-change", () => {
    if (!state.manifest || !state.arrays) return;
    renderTime(state.timeIndex).catch(showError);
    if (Number.isInteger(state.selectedStation)) renderStationHistory(state.selectedStation).catch(showError);
  });

  start();
})();
