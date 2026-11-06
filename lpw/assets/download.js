(() => {
  "use strict";

  const scriptUrl = document.currentScript.src;
  const dataPath = new URL("../data/gnss/", scriptUrl);
  const archiveManifestPath = new URL("../data/mimic-archive.json", scriptUrl);
  const $ = (selector) => document.querySelector(selector);
  const state = {
    manifest: null,
    arrays: null,
    counts: null,
    firstRows: null,
    lastRows: null,
    stationIndices: [],
    selectedStation: null,
    mimicRoot: null,
    mimicYearManifest: null,
    mimicYearManifestUrl: null
  };

  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function updateThemeToggle() {
    const light = document.documentElement.dataset.theme === "light";
    const button = $("#theme-toggle");
    if (!button) return;
    button.setAttribute("aria-pressed", String(light));
    button.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} theme`);
    $("#theme-toggle-label").textContent = light ? "Dark" : "Light";
  }

  function bindThemeToggle() {
    updateThemeToggle();
    $("#theme-toggle")?.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem("lpw-theme", theme);
      } catch (error) {
        console.warn("Theme preference could not be saved", error);
      }
      updateThemeToggle();
    });
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

  function indexStations() {
    const stationCount = state.manifest.stations.length;
    state.counts = new Uint32Array(stationCount);
    state.firstRows = new Int32Array(stationCount);
    state.lastRows = new Int32Array(stationCount);
    state.firstRows.fill(-1);
    state.lastRows.fill(-1);

    for (let row = 0; row < state.arrays.station.length; row += 1) {
      const stationIndex = state.arrays.station[row];
      state.counts[stationIndex] += 1;
      if (state.firstRows[stationIndex] === -1) state.firstRows[stationIndex] = row;
      state.lastRows[stationIndex] = row;
    }

    state.stationIndices = Array.from({ length: stationCount }, (_, index) => index)
      .filter((index) => state.counts[index] > 0)
      .sort((left, right) => state.manifest.stations[left].name.localeCompare(
        state.manifest.stations[right].name,
        undefined,
        { numeric: true, sensitivity: "base" }
      ));
  }

  function optionLabel(index) {
    const station = state.manifest.stations[index];
    return `${station.name} · Station ${station.number} · ${state.counts[index].toLocaleString()} epochs`;
  }

  function populateStations(query = "") {
    const normalized = query.trim().toLowerCase();
    const matches = state.stationIndices.filter((index) => {
      const station = state.manifest.stations[index];
      return !normalized
        || station.name.toLowerCase().includes(normalized)
        || String(station.number).includes(normalized);
    });
    const select = $("#station-select");
    select.replaceChildren();

    if (!matches.length) {
      const option = document.createElement("option");
      option.textContent = "No matching stations";
      option.disabled = true;
      select.append(option);
      state.selectedStation = null;
      clearStationDetails("No station matches the current search.");
      return;
    }

    matches.forEach((index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = optionLabel(index);
      select.append(option);
    });

    const preferred = matches.includes(state.selectedStation) ? state.selectedStation : matches[0];
    select.value = preferred;
    showStation(preferred);
  }

  function formatCoordinate(value, positive, negative) {
    return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
  }

  function timeForRow(row) {
    return state.manifest.times[state.arrays.time[row]];
  }

  function showStation(index) {
    const stationIndex = Number(index);
    if (!Number.isInteger(stationIndex) || state.counts[stationIndex] === 0) {
      clearStationDetails("Select a station from the list.");
      return;
    }
    state.selectedStation = stationIndex;
    const station = state.manifest.stations[stationIndex];
    $("#station-name").textContent = station.name;
    $("#station-coordinates").textContent = `${formatCoordinate(station.latitude, "N", "S")} · ${formatCoordinate(station.longitude, "E", "W")}`;
    $("#station-number").textContent = station.number;
    $("#station-epochs").textContent = state.counts[stationIndex].toLocaleString();
    $("#station-first-time").textContent = timeForRow(state.firstRows[stationIndex]).replace("T", " ");
    $("#station-last-time").textContent = timeForRow(state.lastRows[stationIndex]).replace("T", " ");
    $("#download-button").disabled = false;
    $("#download-status").textContent = `Ready to export ${state.counts[stationIndex].toLocaleString()} observations for ${station.name}.`;
  }

  function clearStationDetails(message) {
    $("#station-name").textContent = "—";
    $("#station-coordinates").textContent = message;
    ["#station-number", "#station-epochs", "#station-first-time", "#station-last-time"].forEach((selector) => {
      $(selector).textContent = "—";
    });
    $("#download-button").disabled = true;
    $("#download-status").textContent = message;
  }

  function safeFilename(value) {
    const sanitized = value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
    return sanitized || "station";
  }

  function stationText(stationIndex) {
    const station = state.manifest.stations[stationIndex];
    const scale = state.manifest.scale;
    const lines = [
      `# ${state.manifest.product}`,
      `# Station: ${station.name}`,
      `# Station number: ${station.number}`,
      `# Latitude: ${station.latitude.toFixed(4)} degrees`,
      `# Longitude: ${station.longitude.toFixed(4)} degrees`,
      `# Time zone: ${state.manifest.time_zone} (dataset time)`,
      "# Units: mm",
      "# Low layer: surface-900 hPa",
      "# Middle layer: 900-700 hPa",
      "# High layer: 700-300 hPa",
      "dataset_time\tlow_lpw_mm\tmiddle_lpw_mm\thigh_lpw_mm"
    ];

    for (let row = 0; row < state.arrays.station.length; row += 1) {
      if (state.arrays.station[row] !== stationIndex) continue;
      lines.push([
        timeForRow(row),
        (state.arrays.low[row] * scale).toFixed(2),
        (state.arrays.middle[row] * scale).toFixed(2),
        (state.arrays.high[row] * scale).toFixed(2)
      ].join("\t"));
    }
    return `${lines.join("\n")}\n`;
  }

  function downloadSelectedStation() {
    if (!Number.isInteger(state.selectedStation)) return;
    const station = state.manifest.stations[state.selectedStation];
    const button = $("#download-button");
    button.disabled = true;
    $("#download-status").textContent = `Creating the ${station.name} text file…`;

    try {
      const text = stationText(state.selectedStation);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `gnss-lpw_${safeFilename(station.name)}.txt`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("#download-status").textContent = `Downloaded ${state.counts[state.selectedStation].toLocaleString()} observations for ${station.name}.`;
    } catch (error) {
      showError(error);
    } finally {
      button.disabled = false;
    }
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`;
  }

  function populateMimicDates(preferredDate = null) {
    const files = state.mimicYearManifest?.files || [];
    const dates = [...new Set(files.map((file) => file.date || file.timestamp.slice(0, 10)))].sort().reverse();
    const select = $("#mimic-date");
    select.replaceChildren();
    dates.forEach((date) => {
      const option = document.createElement("option");
      option.value = date;
      option.textContent = date;
      select.append(option);
    });
    select.disabled = !dates.length;
    if (!dates.length) {
      renderMimicProducts(null);
      return;
    }
    select.value = dates.includes(preferredDate) ? preferredDate : dates[0];
    renderMimicProducts(select.value);
  }

  function renderMimicProducts(date) {
    const container = $("#mimic-product-list");
    container.replaceChildren();
    const files = (state.mimicYearManifest?.files || []).filter((file) => file.date === date);
    $("#mimic-selected-date").textContent = date || "—";
    $("#mimic-date-summary").textContent = files.length
      ? `${files.length} UTC analysis time${files.length === 1 ? "" : "s"} available · NetCDF-4 · 0.25°`
      : "No MIMIC products are available for this date.";

    if (!files.length) {
      const empty = document.createElement("p");
      empty.className = "mimic-product-empty";
      empty.textContent = "No archived files are available for the selected date.";
      container.append(empty);
      $("#mimic-download-status").textContent = "Choose another archive date.";
      return;
    }

    files.forEach((file) => {
      const row = document.createElement("article");
      row.className = "mimic-product-row";
      const time = document.createElement("time");
      time.dateTime = file.timestamp;
      time.textContent = `${file.timestamp.slice(11, 16)} UTC`;
      const metadata = document.createElement("span");
      metadata.className = "mimic-product-meta";
      metadata.textContent = `${formatBytes(file.bytes)} · SHA-256 ${file.sha256.slice(0, 12)}…`;
      const link = document.createElement("a");
      link.className = "mimic-product-link";
      link.href = new URL(file.url, state.mimicYearManifestUrl).href;
      link.download = "";
      link.rel = "noopener";
      link.textContent = "Download .nc";
      row.append(time, metadata, link);
      container.append(row);
    });
    $("#mimic-download-status").textContent = `${files.length} product${files.length === 1 ? "" : "s"} ready to download for ${date}.`;
  }

  async function loadMimicYear(year) {
    const entry = state.mimicRoot.years.find((item) => String(item.year) === String(year));
    if (!entry) throw new Error(`No MIMIC archive index is available for ${year}.`);
    $("#mimic-date").disabled = true;
    $("#mimic-download-status").textContent = `Loading the ${year} archive index…`;
    state.mimicYearManifestUrl = new URL(entry.url, state.mimicRoot.archive_base_url).href;
    const response = await fetchWithRetry(state.mimicYearManifestUrl);
    state.mimicYearManifest = await response.json();
    populateMimicDates();
  }

  function showMimicError(error) {
    $("#mimic-download-loading").hidden = true;
    $("#mimic-download-error").hidden = false;
    $("#mimic-download-error").textContent = error.message || String(error);
    $("#mimic-download-status").textContent = "The MIMIC NetCDF archive is currently unavailable.";
    $("#mimic-archive-range").textContent = "Not configured";
    console.error(error);
  }

  async function startMimicArchive() {
    try {
      const response = await fetchWithRetry(archiveManifestPath);
      state.mimicRoot = await response.json();
      if (!state.mimicRoot.enabled || !state.mimicRoot.years?.length) {
        throw new Error("The 0.25° MIMIC NetCDF archive has not been activated in Cloudflare R2 yet.");
      }
      const years = [...state.mimicRoot.years].sort((left, right) => right.year - left.year);
      const yearSelect = $("#mimic-year");
      years.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.year;
        option.textContent = `${entry.year} · ${entry.file_count.toLocaleString()} files`;
        yearSelect.append(option);
      });
      const first = years.at(-1).first_timestamp.slice(0, 10);
      const last = years[0].last_timestamp.slice(0, 10);
      $("#mimic-archive-range").textContent = `${first} – ${last}`;
      yearSelect.disabled = false;
      yearSelect.addEventListener("change", (event) => loadMimicYear(event.target.value).catch(showMimicError));
      $("#mimic-date").addEventListener("change", (event) => renderMimicProducts(event.target.value));
      $("#mimic-download-loading").hidden = true;
      await loadMimicYear(years[0].year);
    } catch (error) {
      showMimicError(error);
    }
  }

  function bindControls() {
    $("#station-search").addEventListener("input", (event) => populateStations(event.target.value));
    $("#station-select").addEventListener("change", (event) => showStation(Number(event.target.value)));
    $("#station-select").addEventListener("dblclick", downloadSelectedStation);
    $("#download-button").addEventListener("click", downloadSelectedStation);
  }

  function showError(error) {
    $("#download-error").hidden = false;
    $("#download-error").textContent = error.message || String(error);
    $("#download-status").textContent = "The GNSS download archive could not be prepared.";
    console.error(error);
  }

  async function startGnssArchive() {
    try {
      const manifestResponse = await fetchWithRetry(new URL("manifest.json", dataPath));
      state.manifest = await manifestResponse.json();
      const binaryResponse = await fetchWithRetry(new URL(state.manifest.binary.url, dataPath));
      decodeBinary(await inflate(binaryResponse));
      indexStations();

      $("#download-station-total").textContent = state.stationIndices.length.toLocaleString();
      $("#download-time-range").textContent = `${state.manifest.times[0].slice(0, 10)} – ${state.manifest.times.at(-1).slice(0, 10)}`;
      $("#station-search").disabled = false;
      $("#station-select").disabled = false;
      $("#download-loading").hidden = true;
      bindControls();
      populateStations();
    } catch (error) {
      $("#download-loading").hidden = true;
      showError(error);
    }
  }

  function start() {
    bindThemeToggle();
    startMimicArchive();
    startGnssArchive();
  }

  start();
})();
