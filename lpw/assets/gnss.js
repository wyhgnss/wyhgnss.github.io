(() => {
  "use strict";

  const scriptUrl = document.currentScript.src;
  const dataPath = new URL("../data/gnss/", scriptUrl);
  const assetPath = new URL(".", scriptUrl);
  const layerNames = ["Low", "Middle", "High"];
  const layerColors = ["#48d5c8", "#f2cc60", "#f05d5e"];
  const colorscale = [[0,"#30123b"],[.14,"#4145ab"],[.29,"#2a9fd6"],[.43,"#1bcfd4"],[.57,"#61d04f"],[.72,"#f9e721"],[.86,"#f48a2c"],[1,"#c62028"]];
  const $ = (selector) => document.querySelector(selector);
  const state = {
    manifest: null,
    coastline: null,
    timeIndex: 0,
    view: "maps",
    arrays: null,
    stationRows: new Map(),
    hoveredStation: null
  };

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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
    return `${station.name} · Station ${station.number}`;
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
    return {
      domain,
      projection: { type: "equirectangular" },
      bgcolor: "rgba(0,0,0,0)",
      showframe: false,
      showcoastlines: true,
      coastlinecolor: "rgba(232,241,245,.68)",
      coastlinewidth: .7,
      showcountries: false,
      showland: true,
      landcolor: "#0c1c26",
      showocean: true,
      oceancolor: "#071018",
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
    const mobile = window.innerWidth <= 760;
    const plot = $("#gnss-flat-plot");
    const traces = [0, 1, 2].map((layer) => ({
      type: "scattergeo",
      geo: layer ? `geo${layer + 1}` : "geo",
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
        size: 7,
        opacity: .94,
        line: { color: "rgba(255,255,255,.62)", width: .55 },
        showscale: layer === 2,
        colorbar: {
          title: { text: "LPW (mm)", side: "right", font: { color: "#91a4ae", size: 10 } },
          tickfont: { color: "#91a4ae", size: 9 },
          thickness: 10,
          len: mobile ? .28 : .72,
          x: 1.015,
          y: mobile ? .17 : .5,
          outlinewidth: 0
        }
      },
      hovertemplate: "<b>%{text}</b><br>%{marker.color:.2f} mm<extra></extra>"
    }));

    const domains = mobile
      ? [{ x: [0, .96], y: [.69, 1] }, { x: [0, .96], y: [.345, .655] }, { x: [0, .96], y: [0, .31] }]
      : [{ x: [0, .315], y: [0, 1] }, { x: [.3425, .6575], y: [0, 1] }, { x: [.685, 1], y: [0, 1] }];
    const annotations = mobile
      ? [[.48, 1.025], [.48, .68], [.48, .335]]
      : [[.1575, 1.04], [.5, 1.04], [.8425, 1.04]];

    await Plotly.react(plot, traces, {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 12, r: mobile ? 62 : 72, t: 48, b: 18 },
      font: { color: "#91a4ae", family: "Inter, sans-serif", size: 11 },
      showlegend: false,
      geo: geoStyle(domains[0]),
      geo2: geoStyle(domains[1]),
      geo3: geoStyle(domains[2]),
      annotations: layerNames.map((name, layer) => ({
        text: `<b>${name} layer</b><br><span style="font-size:9px;color:#78909c">${["Surface–900", "900–700", "700–300"][layer]} hPa</span>`,
        x: annotations[layer][0], y: annotations[layer][1], xref: "paper", yref: "paper", showarrow: false, align: "center"
      }))
    }, { responsive: true, displaylogo: false, scrollZoom: false });
    bindStationClick(plot);
  }

  function coastlineTrace(layer, gap) {
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
      line: { color: "rgba(220,235,241,.34)", width: 1 },
      hoverinfo: "skip", showlegend: false
    };
  }

  async function renderStack(data) {
    const plot = $("#gnss-stack-plot");
    const gap = 7;
    const coastlines = [0, 1, 2].map((layer) => coastlineTrace(layer, gap));
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
        size: 4.5, opacity: .95,
        line: { color: "rgba(255,255,255,.55)", width: .45 },
        showscale: layer === 2,
        colorbar: {
          title: { text: "LPW (mm)", font: { color: "#91a4ae", size: 10 } },
          tickfont: { color: "#91a4ae", size: 9 }, thickness: 10, len: .68, outlinewidth: 0
        }
      },
      hovertemplate: "<b>%{text}</b><br>%{marker.color:.2f} mm<extra></extra>"
    }));

    await Plotly.react(plot, [...coastlines, ...markers], {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 0, r: 48, t: 10, b: 10 }, showlegend: false,
      scene: {
        bgcolor: "rgba(0,0,0,0)",
        camera: { eye: { x: 1.45, y: -1.55, z: 1.18 } },
        aspectratio: { x: 2.2, y: 1.15, z: .9 },
        xaxis: { title: "Longitude", range: [-180, 180], color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        yaxis: { title: "Latitude", range: [-90, 90], color: "#78909c", gridcolor: "#18303d", zerolinecolor: "#18303d" },
        zaxis: { title: "Layer", range: [-1, gap * 2 + 1], tickvals: [0, gap, gap * 2], ticktext: layerNames, color: "#9fb0ba", gridcolor: "#18303d", zerolinecolor: "#18303d" }
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
    const station = state.manifest.stations[stationIndex];
    const rows = rowsForStation(stationIndex);
    const times = rows.map((row) => state.manifest.times[state.arrays.time[row]]);
    const series = [0, 1, 2].map((layer) => rows.map((row) => value(row, layer)));

    $("#gnss-selected-station").textContent = `${station.name} · Station ${station.number} · ${station.latitude.toFixed(4)}°, ${station.longitude.toFixed(4)}°`;
    $("#gnss-history-empty").hidden = true;
    $("#gnss-history-status").textContent = `${rows.length.toLocaleString()} available epochs · ${state.manifest.times[0].slice(0, 10)} to ${state.manifest.times.at(-1).slice(0, 10)}`;
    $("#gnss-history-status").hidden = false;
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
      font: { color: "#91a4ae", family: "Inter, sans-serif", size: 11 },
      legend: { orientation: "h", x: 0, y: 1.1 }, hovermode: "x",
      xaxis: { gridcolor: "#18303d", zeroline: false, rangeslider: { visible: true, thickness: .08 } },
      yaxis: { title: "GNSS LPW (mm)", rangemode: "tozero", gridcolor: "#18303d", zerolinecolor: "#29404b" }
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
      await renderTime(state.manifest.times.length - 1);
      $("#gnss-loading").hidden = true;
    } catch (error) {
      $("#gnss-loading").hidden = true;
      showError(error);
    }
  }

  start();
})();
