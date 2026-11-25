const BASE = "https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services";
const UTRECHT_BASE = "https://georasterservices.provincie-utrecht.nl/erdas-iws/esri/Luchtfoto/rest/services";
const UTRECHT_CREDIT = "Provincie Utrecht";
const UTRECHT_LAYERS = [
  [1950, "Luchtfoto 1950 - lage resolutie"],
  [1996, "Luchtfoto 1996 - lage resolutie"],
  [2000, "Luchtfoto 2000 - lage resolutie"],
  [2003, "Luchtfoto 2003 - lage resolutie"],
  [2025, "Luchtfoto 2025 - hoge resolutie"],
];
const CACHE_NAME = "topotijdreis-tiles-v1";
const GRID_ORIGIN_X = -285401.92;
const GRID_ORIGIN_Y = 903401.92;
const GRID_RES0 = 3251.206502413005;
const GRID_TILE = 256;
const MAP_ORIGIN = { x: -30515500, y: 31112399.999999993 };
const SAT_ORIGIN = { x: GRID_ORIGIN_X, y: GRID_ORIGIN_Y };
const WIDTH = 1280;
const HEIGHT = 720;

const DEFAULT_VIEW = {
  year: 1833,
  x: 136502.06,
  y: 453882.08,
  zoom: 11,
};

const placeInput = document.querySelector("#place");
const yearSelect = document.querySelector("#map-year");
const coordsInput = document.querySelector("#coords");
const zoomInput = document.querySelector("#zoom");
const fromInput = document.querySelector("#from");
const toInput = document.querySelector("#to");
const stageWrap = document.querySelector(".stage-wrap");
const wipeBars = document.querySelector("#wipe-bars");
const layerBar = document.querySelector("#layer-bar");
const loadButton = document.querySelector("#load");
const statusEl = document.querySelector("#status");
const loadProgress = document.querySelector("#load-progress");
const loadStatus = document.querySelector("#load-status");
const mapCount = document.querySelector("#map-count");
const satCount = document.querySelector("#sat-count");
const canvas = document.querySelector("#map");
const playButton = document.querySelector("#play");
const scrub = document.querySelector("#scrub");
const transport = document.querySelector("#transport");
const transportControls = document.querySelector("#transport-controls");
const mapBar = document.querySelector("#mapbar");
const satBar = document.querySelector("#satbar");
const yearEl = document.querySelector("#year");
const holdInput = document.querySelector("#hold");
const layerToggle = document.querySelector("#layer-toggle");
const shareButton = document.querySelector("#share");
const downloadButton = document.querySelector("#download");
const mp4Button = document.querySelector("#mp4");
const zipButton = document.querySelector("#zip");
const forgetButton = document.querySelector("#forget");
const resetButton = document.querySelector("#reset");
const searchButton = document.querySelector("#search");
const helpDialog = document.querySelector("#help");
const shareHint = document.querySelector("#share-hint");
const shareHintClose = document.querySelector("#share-hint-close");
const helpOpen = document.querySelector("#help-open");
const helpClose = document.querySelector("#help-close");

const ctx = canvas.getContext("2d");
const offscreen = document.createElement("canvas");
offscreen.width = WIDTH;
offscreen.height = HEIGHT;
const offCtx = offscreen.getContext("2d");
const fromCanvas = document.createElement("canvas");
fromCanvas.width = WIDTH;
fromCanvas.height = HEIGHT;
const fromCtx = fromCanvas.getContext("2d");
const toCanvas = document.createElement("canvas");
toCanvas.width = WIDTH;
toCanvas.height = HEIGHT;
const toCtx = toCanvas.getContext("2d");
const mapBlendCanvas = document.createElement("canvas");
mapBlendCanvas.width = WIDTH;
mapBlendCanvas.height = HEIGHT;
const mapBlendCtx = mapBlendCanvas.getContext("2d");
mapBlendCtx.imageSmoothingEnabled = true;
mapBlendCtx.imageSmoothingQuality = "high";
const satBlendCanvas = document.createElement("canvas");
satBlendCanvas.width = WIDTH;
satBlendCanvas.height = HEIGHT;
const satBlendCtx = satBlendCanvas.getContext("2d");
satBlendCtx.imageSmoothingEnabled = true;
satBlendCtx.imageSmoothingQuality = "high";
const browseHold = document.createElement("canvas");
browseHold.width = WIDTH;
browseHold.height = HEIGHT;
const browseHoldCtx = browseHold.getContext("2d");
const scratch = document.createElement("canvas");
scratch.width = 160;
scratch.height = 90;
const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });

const MIN_ZOOM = 6;
const MAX_ZOOM = 14;

let frames = [];
let frameIndex = 0;
let loadId = 0;
let playToken = 0;
let playing = false;
let recording = false;
let packing = false;
let loading = false;
let cancelWait = null;
let activeAbort = null;
let tileStats = { network: 0, cached: 0, skipped: 0 };
let view = null;
let mapInfo = null;
let knownEditions = null;
let frameSource = "map";
const editionCache = { map: null, satellite: null };
let previewEdition = null;
let interactive = false;
let browsingLocal = false;
let sheetLevels = { map: new Set(), sat: new Set() };
const localMisses = new Set();
const VIEW_FETCH_DELAY = 600;
let viewFetchTimer = null;
let viewFetchAbort = null;
let viewFetchId = 0;
let fetchingView = false;
const viewInfo = { map: null, sat: null };
let sheetOrigin = { map: { ...MAP_ORIGIN }, sat: { ...SAT_ORIGIN } };
let browseOrigin = null;
let browseFrame = 0;
const localQueue = [];
let localFetches = 0;
let localSerial = 0;
const localInflight = new Set();
let clearCacheOnNextGesture = false;
let cacheEpoch = 0;
let drag = null;
let previewEpoch = 0;
let infoSource = "map";
let sourceToken = 0;
let persistReady = false;
let userGesture = false;
let layerSplit = 1;
let layerDrag = null;
let session = {
  from: "",
  to: "",
  hold: "800",
  linear: false,
  satellite: false,
  frameIndex: 0,
  rangeSet: false,
  movie: null,
};
const previewTiles = new Map();
const inflight = new Set();
const fetchQueue = [];
let activeFetches = 0;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
offCtx.imageSmoothingEnabled = true;
offCtx.imageSmoothingQuality = "high";

drawWelcome();
bootMap();

document.querySelector("#form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (document.activeElement === placeInput) {
    locatePlace();
    return;
  }
  startLoad();
});

resetButton.addEventListener("click", () => {
  resetView();
});

placeInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  locatePlace();
});

searchButton.addEventListener("click", () => {
  locatePlace();
});

const HELP_KEY = "topotijdreis-help";
const HELP_WEEK = 7 * 24 * 60 * 60 * 1000;

function helpIsDue() {
  try {
    const data = JSON.parse(localStorage.getItem(HELP_KEY) || "null");
    const shownAt = Number(data?.shownAt);
    if (!Number.isFinite(shownAt)) return true;
    return Date.now() - shownAt > HELP_WEEK;
  } catch {
    return true;
  }
}

function markHelpShown() {
  try {
    localStorage.setItem(HELP_KEY, JSON.stringify({ shownAt: Date.now() }));
  } catch {
    // The dialog can still open without a saved date.
  }
}

function openHelp(record) {
  if (typeof helpDialog.showModal === "function" && !helpDialog.open) helpDialog.showModal();
  else helpDialog.setAttribute("open", "");
  if (record) markHelpShown();
}

function openShareHint() {
  if (helpDialog.open) helpDialog.close();
  if (typeof shareHint.showModal === "function" && !shareHint.open) shareHint.showModal();
  else shareHint.setAttribute("open", "");
}

helpOpen.addEventListener("click", () => openHelp(false));
helpClose.addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
shareHintClose.addEventListener("click", () => shareHint.close());
shareHint.addEventListener("click", (event) => {
  if (event.target === shareHint) shareHint.close();
});
if (readShareSetup()) openShareHint();
else if (helpIsDue()) openHelp(true);

layerToggle.addEventListener("click", () => {
  flipLayerSide();
});

shareButton.addEventListener("click", () => {
  copyShareLink();
});

for (const control of [fromInput, toInput, holdInput]) {
  const keep = () => {
    if (!persistReady || !userGesture) return;
    pullFormIntoSession();
    rememberSettings();
  };
  control.addEventListener("input", keep);
  control.addEventListener("change", keep);
}

yearSelect.addEventListener("change", () => {
  applyFields();
});

const activePointers = new Map();
let pinch = null;

function rememberPointer(event) {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
}

function pinchGesture() {
  if (activePointers.size < 2) return null;
  const [a, b] = [...activePointers.values()];
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function applyPinch(prev, next) {
  if (!view || prev.dist < 1 || next.dist < 1) return;
  if (interactive) {
    if (!mapInfo) return;
  } else if (!beginLocalBrowse()) return;
  const scale = canvasScale();
  const before = groundResolution();
  view.x -= (next.x - prev.x) * scale.x * before;
  view.y += (next.y - prev.y) * scale.y * before;
  const rect = canvas.getBoundingClientRect();
  const px = (next.x - rect.left) * scale.x;
  const py = (next.y - rect.top) * scale.y;
  zoomAtPoint(px, py, -Math.log2(next.dist / prev.dist));
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || (!interactive && !canLocalBrowse())) return;
  rememberPointer(event);
  try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  if (activePointers.size >= 2) {
    drag = null;
    canvas.classList.remove("dragging");
    pinch = pinchGesture();
    if (interactive) onViewGesture();
    else beginLocalBrowse();
    return;
  }
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
});

canvas.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId)) return;
  rememberPointer(event);
  if (activePointers.size >= 2) {
    const next = pinchGesture();
    if (pinch && next) applyPinch(pinch, next);
    pinch = next;
    return;
  }
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 3) return;
  if (!drag.moved) {
    drag.moved = true;
    canvas.classList.add("dragging");
    if (interactive) onViewGesture();
    else if (!beginLocalBrowse()) return;
  }
  drag.x = event.clientX;
  drag.y = event.clientY;
  panByPixels(dx, dy);
});

function releasePointer(event) {
  activePointers.delete(event.pointerId);
  if (activePointers.size >= 2) {
    pinch = pinchGesture();
    drag = null;
    return;
  }
  pinch = null;
  if (activePointers.size === 1) {
    const [id, point] = activePointers.entries().next().value;
    drag = { id, x: point.x, y: point.y, moved: true };
    return;
  }
  endDrag(event);
}

canvas.addEventListener("pointerup", releasePointer);
canvas.addEventListener("pointercancel", releasePointer);
canvas.addEventListener("gesturestart", (event) => event.preventDefault());
canvas.addEventListener("gesturechange", (event) => event.preventDefault());

canvas.addEventListener("wheel", (event) => {
  if (!event.deltaY || (!interactive && !canLocalBrowse())) return;
  event.preventDefault();
  if (interactive) onViewGesture();
  else if (!beginLocalBrowse()) return;
  zoomAt(event);
}, { passive: false });

playButton.addEventListener("click", () => {
  if (playing) cancelPlayback();
  else startPlayback();
});

scrub.addEventListener("input", () => {
  cancelPlayback();
  showFrame(Number(scrub.value));
});

downloadButton.addEventListener("click", () => {
  recordMovie();
});

mp4Button.addEventListener("click", () => {
  recordMp4();
});

zipButton.addEventListener("click", () => {
  downloadZip();
});

forgetButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const removed = await clearSavedTiles();
  if (helpDialog.open) helpDialog.close();
  if (interactive) paintPreview();
  else if (browsingLocal) {
    requestLocalTiles();
    scheduleViewFetch();
  }
  setStatus(removed
    ? `${removed} opgeslagen tegel${removed === 1 ? "" : "s"} verwijderd. De volgende keer laden haalt ze opnieuw op.`
    : "Er stonden geen opgeslagen tegels.");
});

document.addEventListener("pointerdown", () => {
  userGesture = true;
}, true);

document.addEventListener("keydown", (event) => {
  userGesture = true;
  if (helpDialog.open || shareHint.open) return;
  const typing = event.target instanceof Element
    && event.target.matches("input:not([type=checkbox]), select, textarea");
  if (typing) return;
  if (event.code === "KeyU" && !event.repeat && !event.altKey && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    updateSatellite();
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!playButton.disabled) playButton.click();
  }
}, true);

bindWipeBars();

const fitRoot = document.querySelector("#fit");
let pageScale = 1;

function fitPage() {
  if (!fitRoot) return;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  if (!vw || !vh) return;
  const portrait = vh >= vw;
  const mobile = window.matchMedia("(pointer: coarse)").matches || vw < 980 || vh < 640;
  if (!mobile) {
    pageScale = 1;
    fitRoot.style.width = "";
    fitRoot.style.height = "";
    fitRoot.style.transform = "";
    return;
  }
  const gutter = 32;
  const bottom = portrait ? 32 : 0;
  const availW = Math.max(1, vw - gutter * 2);
  const availH = Math.max(1, vh - bottom);
  const comfort = portrait ? 480 : 1080;
  const designW = Math.max(comfort, availW);
  const designH = designW * availH / availW;
  fitRoot.style.width = `${designW}px`;
  fitRoot.style.height = `${designH}px`;
  fitRoot.style.transform = "";
  let neededW = Math.max(designW, fitRoot.scrollWidth);
  let neededH = Math.max(designH, fitRoot.scrollHeight);
  if (neededW > designW + 1) {
    fitRoot.style.width = `${neededW}px`;
    const grownH = Math.max(neededH, neededW * availH / availW);
    fitRoot.style.height = `${grownH}px`;
    neededW = Math.max(neededW, fitRoot.scrollWidth);
    neededH = Math.max(grownH, fitRoot.scrollHeight);
  }
  pageScale = Math.min(availW / neededW, availH / neededH);
  const x = gutter + (availW - neededW * pageScale) / 2;
  const y = (availH - neededH * pageScale) / 2;
  fitRoot.style.transformOrigin = "top left";
  fitRoot.style.transform = pageScale === 1 && x === 0 && y === 0
    ? ""
    : `translate(${x}px, ${y}px) scale(${pageScale})`;
}

function onViewportChange() {
  fitPage();
  layoutWipeBars();
}

fitPage();
window.addEventListener("resize", onViewportChange);
window.addEventListener("orientationchange", onViewportChange);
if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewportChange);

function drawWelcome() {
  ctx.fillStyle = "#e7dcc4";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#3d342b";
  ctx.font = "34px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
  ctx.fillText("Zoek een plaats of vul coördinaten in", 48, 86);
  ctx.font = "18px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillStyle = "#6d6256";
  ctx.fillText("De film blijft op deze plek en loopt door de kaartlagen.", 48, 124);
}

function localizeStatus(text) {
  if (!text || typeof text !== "string") return text;
  if (!/\b(years?|changes?|downloaded|Tiles:|unchanged|already in this browser|identical tiles)\b/i.test(text)) {
    return text;
  }
  let s = text;
  s = s.replace(/(\d+)\s+years?/gi, "$1 jaar");
  s = s.replace(/(\d+)\s+changes?/gi, (_, n) => `${n} wijziging${n === "1" ? "" : "en"}`);
  s = s.replace(
    /(\d+)\s+unchanged\s+sheets?\s+skipped/gi,
    (_, n) => `${n} ongewijzigd blad${n === "1" ? "" : "en"} overgeslagen`,
  );
  s = s.replace(/\b(\d+)\s+empty\b/gi, "$1 leeg");
  s = s.replace(/Tiles:\s*/gi, "Tegels: ");
  s = s.replace(/(\d+)\s+downloaded/gi, "$1 opgehaald");
  s = s.replace(/(\d+)\s+already in this browser/gi, "$1 al in deze browser");
  s = s.replace(/(\d+)\s+identical tiles skipped/gi, "$1 identieke tegels overgeslagen");
  return s;
}

function setStatus(text) {
  const line = localizeStatus(text);
  statusEl.textContent = line;
  loadStatus.textContent = line;
}

function parseMapUrl(value) {
  const match = String(value).match(/kaart\/(\d+)\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error("Gebruik een topotijdreis.nl/kaart/jaar/@x,y,zoom-link.");
  }
  return {
    year: Number(match[1]),
    x: Number(match[2]),
    y: Number(match[3]),
    zoom: Number(match[4]),
  };
}

function numberOrNull(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function usingSatellite() {
  return !interactive && layerSplit < 0.5;
}

function parseEdition(name) {
  const match = /^Historische_tijdreis_(\d{4})(?:_(\d{4}))?$/.exec(name);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return {
    name,
    start,
    end,
    label: match[2] ? `${start}–${end}` : String(start),
  };
}

function serviceUrl(edition, tail) {
  const base = edition.base || BASE;
  return `${base}/${encodeURIComponent(edition.name)}/MapServer${tail}`;
}

function editionCovers(edition, place) {
  const box = edition.extent;
  if (!box || !place) return true;
  return place.x >= box.xmin && place.x <= box.xmax && place.y >= box.ymin && place.y <= box.ymax;
}

function editionsHere(editions, place) {
  return editions.filter((edition) => editionCovers(edition, place));
}

function satelliteCredit(edition) {
  if (!edition?.credit) return "Beeldmateriaal.nl / Kadaster";
  return edition.credit;
}

function imageType(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  return "image/jpeg";
}

function satelliteServiceName(year) {
  if (year === 2012) return "LuchtfotoNL50cm_2012";
  if (year === 2013) return "LuchtfotoNL50cm_2013";
  if (year === 2014) return "LuchtfotoNL_50_cm_2014";
  if (year === 2015) return "LuchtfotoNL_2015_50_cm";
  if (year >= 2021 && year <= 2024) return `HR_Luchtfoto_${year}`;
  if (year === 2026) return "HR_Luchtfoto_Actueel";
  if (year >= 2006 && year <= 2020) return `Luchtfoto_${year}`;
  return null;
}

async function discoverEditions(signal) {
  const key = usingSatellite() ? "satellite" : "map";
  if (editionCache[key]) {
    knownEditions = editionCache[key];
    return knownEditions;
  }
  const result = key === "satellite"
    ? await discoverSatellite(signal)
    : await discoverMaps(signal);
  editionCache[key] = result;
  if ((usingSatellite() ? "satellite" : "map") === key) knownEditions = result;
  return result;
}

async function discoverMaps(signal) {
  const response = await fetch(`${BASE}?f=pjson`, { signal });
  if (!response.ok) throw new Error("Kaartlagen konden niet worden opgehaald.");
  const data = await response.json();
  const editions = new Map();
  for (const service of data.services || []) {
    const edition = parseEdition(service.name);
    if (edition) editions.set(edition.name, edition);
  }

  const listedMax = Math.max(1814, ...[...editions.values()].map((edition) => edition.end));
  const thisYear = new Date().getFullYear();
  const missing = [];
  for (let year = listedMax + 1; year <= thisYear; year += 1) missing.push(year);
  await mapPool(missing, 6, async (year) => {
    const name = `Historische_tijdreis_${year}`;
    const probe = await fetch(`${BASE}/${name}/MapServer?f=pjson`, { signal });
    if (!probe.ok) return;
    const body = await probe.json();
    if (!body.tileInfo) return;
    editions.set(name, {
      name,
      start: year,
      end: year,
      label: String(year),
      maxLevel: body.tileInfo.lods.at(-1).level,
    });
  });

  return [...editions.values()].sort((a, b) => a.end - b.end || a.start - b.start);
}

async function discoverSatellite(signal) {
  const candidates = [];
  for (let year = 2006; year <= 2026; year += 1) {
    const name = satelliteServiceName(year);
    if (name) candidates.push({ year, name });
  }
  for (const [year, name] of UTRECHT_LAYERS) {
    candidates.push({ year, name, base: UTRECHT_BASE, credit: UTRECHT_CREDIT });
  }
  const editions = [];
  await mapPool(candidates, 6, async (candidate) => {
    const probe = await fetch(serviceUrl(candidate, "?f=pjson"), { signal });
    if (!probe.ok) return;
    const body = await probe.json();
    if (!body.tileInfo) return;
    const box = body.fullExtent;
    editions.push({
      name: candidate.name,
      start: candidate.year,
      end: candidate.year,
      label: String(candidate.year),
      maxLevel: body.tileInfo.lods.at(-1).level,
      base: candidate.base,
      credit: candidate.credit,
      extent: box ? { xmin: box.xmin, ymin: box.ymin, xmax: box.xmax, ymax: box.ymax } : null,
    });
  });
  editions.sort((a, b) => a.end - b.end);
  if (!editions.length) throw new Error("Satellietfoto's konden niet worden opgehaald.");
  return editions;
}

function selectEditions(editions, from, to) {
  const selected = editions.filter((edition) => {
    if (from != null && edition.end < from) return false;
    if (to != null && edition.end > to) return false;
    return true;
  });
  if (from != null) {
    const prior = [...editions].reverse().find((edition) => edition.end < from);
    if (prior && !selected.some((edition) => edition.name === prior.name)) selected.unshift(prior);
  }
  return selected;
}

async function loadTileInfo(edition, signal) {
  const response = await fetch(serviceUrl(edition, "?f=pjson"), { signal });
  if (!response.ok) throw new Error("De kaarttegels konden niet worden gelezen.");
  const data = await response.json();
  const info = data.tileInfo;
  if (!info) throw new Error("Deze kaartlaag heeft geen tegels.");
  const lods = info.lods.map((lod) => ({ level: lod.level, resolution: lod.resolution }));
  const finest = lods[lods.length - 1];
  return {
    originX: info.origin.x,
    originY: info.origin.y,
    tileSize: info.rows,
    lods,
    level: finest.level,
    resolution: finest.resolution,
    res0: lods[0].resolution,
    maxLevel: finest.level,
  };
}

function viewBounds(place, info) {
  const res = info.res0 / 2 ** place.zoom;
  return {
    xmin: place.x - (WIDTH / 2) * res,
    xmax: place.x + (WIDTH / 2) * res,
    ymin: place.y - (HEIGHT / 2) * res,
    ymax: place.y + (HEIGHT / 2) * res,
    res,
  };
}

function tilesFor(view, info) {
  const span = info.resolution * info.tileSize;
  const col0 = Math.floor((view.xmin - info.originX) / span);
  const col1 = Math.floor((view.xmax - info.originX) / span);
  const row0 = Math.floor((info.originY - view.ymax) / span);
  const row1 = Math.floor((info.originY - view.ymin) / span);
  const tiles = [];
  for (let row = row0; row <= row1; row += 1) {
    for (let col = col0; col <= col1; col += 1) tiles.push({ row, col });
  }
  return tiles;
}

function tileUrl(edition, info, tile) {
  return serviceUrl(edition, `/tile/${info.level}/${tile.row}/${tile.col}`);
}

function centerTile(tiles, place, info) {
  const span = info.resolution * info.tileSize;
  const col = Math.floor((place.x - info.originX) / span);
  const row = Math.floor((info.originY - place.y) / span);
  return tiles.find((tile) => tile.row === row && tile.col === col) || tiles[0];
}

function hashBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function probeTile(edition, info, tile, signal) {
  try {
    const response = await fetch(tileUrl(edition, info, tile), { method: "HEAD", signal });
    const etag = response.headers.get("etag");
    const length = Number(response.headers.get("content-length"));
    return {
      status: response.status,
      etag: etag || null,
      length: Number.isFinite(length) ? length : null,
    };
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return { status: 0, etag: null, length: null };
  }
}

function sameTileMarks(current, previous, field) {
  if (!previous || current.length !== previous.length) return false;
  return current.every((mark, index) => {
    const earlier = previous[index];
    if (mark.status !== earlier.status) return false;
    if (field === "etag") return Boolean(mark.etag) && mark.etag === earlier.etag;
    return mark.length != null && mark.length === earlier.length;
  });
}

async function cachedFetch(url, signal, track = true) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const epoch = cacheEpoch;
  let cache = null;
  if ("caches" in window) {
    try {
      cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) {
        if (track) tileStats.cached += 1;
        return hit;
      }
    } catch {
      cache = null;
    }
  }
  const response = await fetch(url, { signal });
  if (track) tileStats.network += 1;
  if (cache && response.ok && epoch === cacheEpoch) {
    const copy = response.clone();
    cache.put(url, copy).catch(() => {
      // A full cache should not stop the movie.
    });
  }
  return response;
}

async function loadTileBytes(edition, info, tile, signal, track = true) {
  try {
    const response = await cachedFetch(tileUrl(edition, info, tile), signal, track);
    if (!response.ok) return { bitmap: null, hash: `missing:${response.status}` };
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return { bitmap: null, hash: "missing:empty" };
    const bitmap = await createImageBitmap(new Blob([buffer], { type: imageType(buffer) }));
    return { bitmap, hash: hashBuffer(buffer) };
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return { bitmap: null, hash: "missing:error" };
  }
}

async function loadTileBitmap(edition, info, tile, signal, track = true) {
  const loaded = await loadTileBytes(edition, info, tile, signal, track);
  return loaded.bitmap;
}

function blitTile(context, bitmap, tile, bounds, info) {
  if (!bitmap) return;
  const span = info.resolution * info.tileSize;
  const left = info.originX + tile.col * span;
  const top = info.originY - tile.row * span;
  context.drawImage(
    bitmap,
    (left - bounds.xmin) / bounds.res,
    (bounds.ymax - top) / bounds.res,
    span / bounds.res,
    span / bounds.res,
  );
}

function fingerprint() {
  scratchCtx.drawImage(offscreen, 0, 0, scratch.width, scratch.height);
  const data = scratchCtx.getImageData(0, 0, scratch.width, scratch.height).data;
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 16) {
    hash ^= data[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const NOTE_ICON = 24;
const NOTE_ICON_GAP = 7;
const NOTE_PART_GAP = 20;

function drawNoteIcon(context, kind, x, y) {
  const s = NOTE_ICON;
  context.save();
  context.translate(x, y - s / 2);
  context.lineWidth = 2.2;
  context.lineJoin = "round";
  context.strokeStyle = context.fillStyle;
  context.beginPath();
  if (kind === "map") {
    context.moveTo(1, 4);
    context.lineTo(8, 1);
    context.lineTo(16, 4);
    context.lineTo(23, 1);
    context.lineTo(23, 20);
    context.lineTo(16, 23);
    context.lineTo(8, 20);
    context.lineTo(1, 23);
    context.closePath();
    context.moveTo(8, 1);
    context.lineTo(8, 20);
    context.moveTo(16, 4);
    context.lineTo(16, 23);
    context.stroke();
  } else {
    context.moveTo(2, 7);
    context.lineTo(7, 7);
    context.lineTo(9, 3);
    context.lineTo(15, 3);
    context.lineTo(17, 7);
    context.lineTo(22, 7);
    context.lineTo(22, 21);
    context.lineTo(2, 21);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.arc(12, 14, 4.5, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

function noteParts(notes) {
  return [["map", notes?.map], ["sat", notes?.sat]]
    .filter(([, year]) => year != null && Number.isFinite(Number(year)))
    .map(([kind, year]) => ({ kind, text: String(year) }));
}

function stamp(label, context = offCtx, line, notes) {
  context.save();
  const parts = noteParts(notes);
  const padX = 18;
  context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
  const yearW = context.measureText(String(label)).width;
  context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
  for (const part of parts) part.width = context.measureText(part.text).width;
  const noteW = parts.reduce((sum, part) => sum + NOTE_ICON + NOTE_ICON_GAP + part.width, 0)
    + NOTE_PART_GAP * Math.max(0, parts.length - 1);
  const textW = Math.max(yearW, noteW);
  const boxH = parts.length ? 112 : 72;
  context.fillStyle = "rgba(243, 236, 223, 0.94)";
  context.fillRect(28, 28, textW + padX * 2, boxH);
  context.fillStyle = "#1c1916";
  context.textBaseline = "middle";
  context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
  const middle = 28 + padX + textW / 2;
  context.fillText(String(label), middle - yearW / 2, 28 + 36);
  if (parts.length) {
    context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
    context.fillStyle = "rgba(28, 25, 22, 0.78)";
    let x = middle - noteW / 2;
    const y = 28 + 84;
    for (const part of parts) {
      drawNoteIcon(context, part.kind, x, y);
      x += NOTE_ICON + NOTE_ICON_GAP;
      context.fillText(part.text, x, y + 1);
      x += part.width + NOTE_PART_GAP;
    }
  }

  context.font = "16px 'Segoe UI', 'Helvetica Neue', sans-serif";
  context.fillStyle = "rgba(243, 236, 223, 0.95)";
  context.textAlign = "right";
  context.shadowColor = "rgba(28, 25, 22, 0.55)";
  context.shadowBlur = 6;
  const credit = line || (frameSource === "satellite" ? "Beeldmateriaal.nl / Kadaster" : "Kadaster / Topotijdreis");
  context.fillText(credit, WIDTH - 28, HEIGHT - 26);
  context.restore();
}

function sheetForYear(editions, year) {
  let chosen = null;
  for (const edition of editions) {
    if (edition.end <= year) chosen = edition;
  }
  return chosen;
}

function timelineYears(editions, from, to) {
  const start = from ?? editions[0]?.start;
  const end = to ?? editions.at(-1)?.end;
  if (start == null || end == null || start > end) return [];
  const years = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

function spanYears(mapEditions, satEditions, from, to) {
  const starts = [mapEditions[0]?.start, satEditions[0]?.start].filter((year) => year != null);
  const ends = [mapEditions.at(-1)?.end, satEditions.at(-1)?.end].filter((year) => year != null);
  if (!starts.length || !ends.length) return [];
  const start = from ?? Math.min(...starts);
  const end = to ?? Math.max(...ends);
  if (start > end) return [];
  const years = [];
  for (let year = start; year <= end; year += 1) years.push(year);
  return years;
}

function carriedBlobs(editions, plan, years) {
  const table = new Map((plan || []).map((item) => [item.edition.name, item.blob || null]));
  let carry = null;
  return years.map((year) => {
    const edition = sheetForYear(editions, year);
    const own = edition ? table.get(edition.name) || null : null;
    if (own) carry = own;
    return carry;
  });
}

function sourceStarts(plan, years) {
  const items = [...(plan || [])].sort((a, b) => a.edition.end - b.edition.end || a.edition.start - b.edition.start);
  let start = null;
  let index = 0;
  return years.map((year) => {
    while (index < items.length && items[index].edition.end <= year) {
      if (items[index].state !== "grey" && items[index].blob) start = items[index].edition.start;
      index += 1;
    }
    return start;
  });
}

function sheetYear(frame, kind) {
  const blob = kind === "map" ? frame?.map : frame?.satellite;
  if (!blob) return null;
  const stored = frame[kind === "map" ? "mapYear" : "satYear"];
  if (stored != null && Number.isFinite(Number(stored))) return Number(stored);
  const year = Number(frame.label);
  if (!Number.isFinite(year)) return null;
  let start = null;
  for (const item of savedPlan(kind === "map" ? session.movie?.mapPlan : session.movie?.satPlan)) {
    if (item.edition.end > year) break;
    if (item.state !== "grey") start = item.edition.start;
  }
  return Number.isFinite(start) ? start : null;
}

function frameNotes(frame) {
  return { map: sheetYear(frame, "map"), sat: sheetYear(frame, "sat") };
}

function buildFrames(mapEditions, satEditions, from, to, mapPlan, satPlan) {
  const years = spanYears(mapEditions, satEditions, from, to);
  const maps = carriedBlobs(mapEditions, mapPlan, years);
  const satellites = carriedBlobs(satEditions, satPlan, years);
  const mapYears = sourceStarts(mapPlan, years);
  const satYears = sourceStarts(satPlan, years);
  return years.map((year, index) => ({
    label: String(year),
    map: maps[index],
    satellite: satellites[index],
    satCredit: satelliteCredit(sheetForYear(satEditions, year)),
    mapYear: maps[index] ? mapYears[index] : null,
    satYear: satellites[index] ? satYears[index] : null,
  }));
}

function activeBlob(frame) {
  if (!frame) return null;
  return usingSatellite() ? frame.satellite : frame.map;
}

function frameHold(index) {
  const full = Number(holdInput.value);
  const frame = frames[index];
  if (!frame || index === 0) return full;
  if (activeBlob(frame) !== activeBlob(frames[index - 1])) return full;
  return full / 4;
}

function levelForZoom(zoom, cap) {
  return Math.max(0, Math.min(cap, Math.round(zoom)));
}

function frameGrid(info, zoom, editions, satellite) {
  let cap = info.maxLevel;
  if (satellite && editions.length) {
    cap = Math.min(cap, ...editions.map((edition) => edition.maxLevel ?? info.maxLevel));
  }
  const level = levelForZoom(zoom, cap);
  const lod = info.lods.find((item) => item.level === level) || info.lods.at(-1);
  return { ...info, level: lod.level, resolution: lod.resolution };
}

function sampleTiles(tiles, focus) {
  if (!tiles.length) return [];
  const row0 = Math.min(...tiles.map((tile) => tile.row));
  const row1 = Math.max(...tiles.map((tile) => tile.row));
  const col0 = Math.min(...tiles.map((tile) => tile.col));
  const col1 = Math.max(...tiles.map((tile) => tile.col));
  const wanted = [
    focus,
    { row: row0, col: col0 },
    { row: row0, col: col1 },
    { row: row1, col: col0 },
    { row: row1, col: col1 },
  ];
  const seen = new Set();
  const sample = [];
  for (const tile of wanted) {
    const key = `${tile.row}/${tile.col}`;
    if (seen.has(key)) continue;
    if (!tiles.some((item) => item.row === tile.row && item.col === tile.col)) continue;
    seen.add(key);
    sample.push(tiles.find((item) => item.row === tile.row && item.col === tile.col));
  }
  return sample.length ? sample : [tiles[0]];
}

function storeFrame() {
  return new Promise((resolve, reject) => {
    offscreen.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Kon geen beeld opslaan."));
    }, "image/jpeg", 0.92);
  });
}

function classifySheet(marks, previous) {
  const pictured = marks.some((mark) => mark.status === 200);
  if (!pictured) return { state: "grey", provisional: false };
  if (!previous) return { state: "red", provisional: false };
  if (sameTileMarks(marks, previous, "etag")) return { state: "grey", provisional: false };
  if (sameTileMarks(marks, previous, "length")) return { state: "grey", provisional: true };
  return { state: "red", provisional: false };
}

let barSpan = null;

function segmentStateLabel(state) {
  if (state === "red") return "ophalen";
  if (state === "green") return "opgeslagen";
  if (state === "wait") return "wachten";
  return "ongewijzigd";
}

function segmentTitle(detail, state) {
  return `${detail} · ${segmentStateLabel(state)}`;
}

function paintPlan(bar, plan, name, editions = null) {
  bar.hidden = false;
  const source = editions || plan.map((item) => item.edition).filter(Boolean);
  const segments = [];
  if (barSpan) {
    for (let year = barSpan.start; year <= barSpan.end; year += 1) {
      const edition = sheetForYear(source, year);
      const item = edition && plan.find((entry) => entry.edition?.name === edition.name);
      const state = item ? item.state : "grey";
      const detail = edition ? `${year} · ${edition.label}` : `${year} · geen beeld`;
      segments.push({ state, title: segmentTitle(detail, state) });
    }
  }
  if (!segments.length) {
    const items = plan.length ? plan : [{ edition: { label: "Geen bladen" }, state: "grey" }];
    segments.push(...items.map((item) => ({
      state: item.state,
      title: segmentTitle(item.edition.label, item.state),
    })));
  }
  bar.replaceChildren(...segments.map((item) => {
    const segment = document.createElement("i");
    segment.className = item.state;
    segment.title = item.title;
    return segment;
  }));
  const grey = plan.filter((item) => item.state === "grey").length;
  const red = plan.filter((item) => item.state === "red").length;
  const green = plan.filter((item) => item.state === "green").length;
  const done = green + grey;
  bar.setAttribute("aria-label", `${name}: ${green} opgeslagen, ${red} nog ophalen, ${grey} ongewijzigd`);
  const count = bar === mapBar ? mapCount : satCount;
  count.textContent = plan.length ? `${done} van ${plan.length}` : "";
}

function clearPlan() {
  barSpan = null;
  for (const bar of [mapBar, satBar]) {
    bar.replaceChildren();
    bar.hidden = true;
    bar.setAttribute("aria-label", bar === mapBar ? "Voortgang kaart" : "Voortgang foto's");
  }
  mapCount.textContent = "";
  satCount.textContent = "";
}

function summary(changes, same, empty, years) {
  const parts = [
    `${years} jaar`,
    `${changes} wijziging${changes === 1 ? "" : "en"}`,
  ];
  if (same) parts.push(`${same} ongewijzigd blad${same === 1 ? "" : "en"} overgeslagen`);
  if (empty) parts.push(`${empty} leeg`);
  const fetched = `${tileStats.network} opgehaald, ${tileStats.cached} al in deze browser, ${tileStats.skipped} identieke tegels overgeslagen`;
  return `${parts.join(" · ")}. Tegels: ${fetched}.`;
}

async function downloadLayer({
  name, editions, satellite, signal, place, bar, myId, chosen,
}) {
  const selected = chosen
    ? editions
    : selectEditions(editions, numberOrNull(fromInput), numberOrNull(toInput));
  if (!selected.length) {
    paintPlan(bar, [], name);
    return { plan: [], changes: 0, same: 0, empty: 0 };
  }
  const info = frameGrid(await loadTileInfo(selected[0], signal), place.zoom, selected, satellite);
  const kind = satellite ? "sat" : "map";
  sheetLevels[kind].add(info.level);
  sheetOrigin[kind] = { x: info.originX, y: info.originY };
  const bounds = viewBounds(place, info);
  const tiles = tilesFor(bounds, info);
  const focus = centerTile(tiles, place, info);
  const plan = selected.map((edition) => ({
    edition,
    state: "wait",
    provisional: false,
    marks: null,
    focusHit: null,
  }));
  paintPlan(bar, plan, name);

  let previousMarks = null;
  let lastFocusHash = null;
  let lastHash = null;
  let lastBlob = null;
  let changes = 0;
  frameSource = satellite ? "satellite" : "map";

  for (let i = 0; i < plan.length; i += 1) {
    if (myId !== loadId) return null;
    const item = plan[i];
    setStatus(`${name}: ${i + 1} van ${plan.length} · ${item.edition.label}`);
    const sample = sampleTiles(tiles, focus);
    item.marks = await mapPool(sample, 8, (tile) => probeTile(item.edition, info, tile, signal));
    if (myId !== loadId) return null;
    const kind = classifySheet(item.marks, previousMarks);
    item.state = kind.state;
    item.provisional = kind.provisional;
    previousMarks = item.marks;
    const pictured = item.marks.some((mark) => mark.status === 200);

    if (kind.state === "grey" && !kind.provisional) {
      tileStats.skipped += tiles.length;
      item.blob = pictured ? lastBlob : null;
      if (!pictured) lastFocusHash = null;
      paintPlan(bar, plan, name);
      continue;
    }

    const hit = await loadTileBytes(item.edition, info, focus, signal);
    if (myId !== loadId) {
      hit.bitmap?.close();
      return null;
    }
    if (item.provisional && hit.hash === lastFocusHash) {
      tileStats.skipped += tiles.length - 1;
      hit.bitmap?.close();
      item.state = "grey";
      item.provisional = false;
      item.blob = lastBlob;
      paintPlan(bar, plan, name);
      continue;
    }

    item.state = "red";
    item.provisional = false;
    item.focusHit = hit;
    lastFocusHash = hit.hash;
    paintPlan(bar, plan, name);
    offCtx.fillStyle = "#e7dcc4";
    offCtx.fillRect(0, 0, WIDTH, HEIGHT);
    let paint = Promise.resolve();
    let drew = false;
    try {
      await mapPool(tiles, 6, async (tile) => {
        const entry = tile.row === focus.row && tile.col === focus.col
          ? item.focusHit
          : await loadTileBytes(item.edition, info, tile, signal);
        if (myId !== loadId) {
          entry.bitmap?.close();
          return;
        }
        const bitmap = entry.bitmap;
        entry.bitmap = null;
        if (!bitmap) return;
        drew = true;
        const placeTile = () => {
          try {
            if (myId === loadId) blitTile(offCtx, bitmap, tile, bounds, info);
          } finally {
            bitmap.close();
          }
        };
        paint = paint.then(placeTile, placeTile);
      });
      await paint;
    } catch (error) {
      await paint;
      throw error;
    }
    if (myId !== loadId) return null;
    if (!drew) {
      item.state = "grey";
      item.blank = true;
      item.blob = null;
      paintPlan(bar, plan, name);
      continue;
    }
    const hash = fingerprint();
    if (hash === lastHash) {
      item.state = "grey";
      item.blob = lastBlob;
      paintPlan(bar, plan, name);
      continue;
    }
    lastHash = hash;
    const blob = await storeFrame();
    if (myId !== loadId) return null;
    item.blob = blob;
    lastBlob = blob;
    changes += 1;
    item.state = "green";
    stamp(item.edition.label, offCtx, item.edition.credit);
    ctx.drawImage(offscreen, 0, 0);
    yearEl.textContent = item.edition.label;
    paintPlan(bar, plan, name);
  }

  const hasPicture = (entry) => entry.marks.some((mark) => mark.status === 200);
  const same = plan.filter((entry) => entry.state === "grey" && hasPicture(entry) && !entry.blank).length;
  const empty = plan.filter((entry) => entry.state === "grey" && (!hasPicture(entry) || entry.blank)).length;
  return { plan, changes, same, empty };
}

async function startLoad() {
  const myId = ++loadId;
  cancelPlayback();
  frames = [];
  frameIndex = 0;
  cancelViewFetch();
  browsingLocal = false;
  sheetLevels = { map: new Set(), sat: new Set() };
  localMisses.clear();
  sheetOrigin = { map: { ...MAP_ORIGIN }, sat: { ...SAT_ORIGIN } };
  dropBrowseHold();
  tileStats = { network: 0, cached: 0, skipped: 0 };
  loading = true;
  syncControls();
  yearEl.textContent = "—";
  scrub.value = "0";
  clearPlan();

  try {
    pullFormIntoSession();
    view = readView();
    clampZoom();
    persistReady = true;
    writeFields();
    setInteractive(false);
    const place = view;
    const from = numberOrNull(fromInput);
    const to = numberOrNull(toInput);
    if (from != null && to != null && from > to) {
      throw new Error("Van-jaar ligt na tot-jaar.");
    }

    setStatus("Kaarten en satellietfoto's opzoeken…");
    const signal = beginLoadAbort();
    const mapEditions = await discoverMaps(signal);
    const satAll = await discoverSatellite(signal);
    const satEditions = editionsHere(satAll, place);
    editionCache.map = mapEditions;
    editionCache.satellite = satAll;
    knownEditions = usingSatellite() ? satEditions : mapEditions;
    if (myId !== loadId) return;
    const years = spanYears(mapEditions, satEditions, from, to);
    barSpan = years.length ? { start: years[0], end: years.at(-1) } : null;
    const satSelected = selectEditions(satEditions, from, to);
    paintPlan(satBar, satSelected.map((edition) => ({ edition, state: "wait" })), "Foto's");

    const mapLayer = await downloadLayer({
      name: "Kaart", editions: mapEditions, satellite: false, signal, place, bar: mapBar, myId,
    });
    if (!mapLayer || myId !== loadId) return;
    const satLayer = await downloadLayer({
      name: "Foto's", editions: satEditions, satellite: true, signal, place, bar: satBar, myId,
    });
    if (!satLayer || myId !== loadId) return;

    frames = buildFrames(mapEditions, satEditions, from, to, mapLayer.plan, satLayer.plan);
    if (!frames.length) throw new Error("Geen jaren in dat bereik.");
    frameIndex = frames.length - 1;
    scrub.max = String(frames.length - 1);
    scrub.value = String(frameIndex);
    frameSource = usingSatellite() ? "satellite" : "map";
    await showFrame(frameIndex);
    if (myId !== loadId) return;
    const statusText = summary(
      mapLayer.changes + satLayer.changes,
      mapLayer.same + satLayer.same,
      mapLayer.empty + satLayer.empty,
      frames.length,
    );
    setStatus(statusText);
    await saveMovie(mapLayer.plan, satLayer.plan, statusText);
  } catch (error) {
    if (myId !== loadId || error.name === "AbortError") return;
    setStatus(error.message || "Kon de film niet samenstellen.");
  } finally {
    if (myId === loadId) {
      loading = false;
      syncControls();
    }
  }
}

function savedPlan(items) {
  return (items || []).map((item) => ({
    edition: editionFromSaved(item),
    state: item.state || "green",
  })).filter((item) => Number.isFinite(item.edition.start) && Number.isFinite(item.edition.end));
}

function mergePlans(saved, fresh) {
  const merged = saved.map((item) => ({ edition: item.edition, state: item.state }));
  for (const item of fresh) {
    const existing = merged.find((entry) => entry.edition.name === item.edition.name);
    if (existing) existing.state = item.state;
    else merged.push({ edition: item.edition, state: item.state });
  }
  merged.sort((a, b) => a.edition.end - b.edition.end || a.edition.start - b.edition.start);
  return merged;
}

function sheetsMissingFromFilm(editions) {
  const needed = [];
  const seen = new Set();
  for (const frame of frames) {
    const edition = sheetForYear(editions, Number(frame.label));
    if (!edition || seen.has(edition.name)) continue;
    seen.add(edition.name);
    const stale = edition.credit ? frame.satCredit !== edition.credit : !frame.satellite;
    if (stale) needed.push(edition);
  }
  return needed;
}

function paintNewSatellites(editions, plan) {
  const fresh = new Map();
  for (const item of plan) {
    if (item.blob) fresh.set(item.edition.name, item.blob);
  }
  if (!fresh.size) return 0;
  let carryName = null;
  let carryBlob = null;
  let carryCredit = null;
  let filled = 0;
  for (const frame of frames) {
    const edition = sheetForYear(editions, Number(frame.label));
    if (!edition || !fresh.has(edition.name)) continue;
    if (carryName !== edition.name) {
      carryName = edition.name;
      carryBlob = fresh.get(edition.name);
      carryCredit = satelliteCredit(edition);
    }
    if (frame.satellite !== carryBlob || frame.satCredit !== carryCredit) filled += 1;
    frame.satellite = carryBlob;
    frame.satCredit = carryCredit;
    frame.satYear = edition.start;
  }
  return filled;
}

async function updateSatellite() {
  if (loading || recording || packing) return;
  if (interactive || !frames.length || !view) {
    setStatus("Laad eerst een film.");
    return;
  }
  const myId = ++loadId;
  cancelPlayback();
  loading = true;
  tileStats = { network: 0, cached: 0, skipped: 0 };
  syncControls();
  try {
    setStatus("Nieuwe luchtfoto's opzoeken…");
    const signal = beginLoadAbort();
    const place = anchoredView();
    const satEditions = editionsHere(await discoverSatellite(signal), place);
    if (myId !== loadId) return;
    const needed = sheetsMissingFromFilm(satEditions);
    if (!needed.length) {
      setStatus("Geen nieuwe luchtfoto's voor deze film.");
      return;
    }
    const satLayer = await downloadLayer({
      name: "Foto's",
      editions: needed,
      satellite: true,
      signal,
      place,
      bar: satBar,
      myId,
      chosen: true,
    });
    if (!satLayer || myId !== loadId) return;
    const filled = paintNewSatellites(satEditions, satLayer.plan);
    const statusText = filled
      ? `${satLayer.changes} luchtfoto${satLayer.changes === 1 ? "" : "'s"} toegevoegd aan deze film.`
      : "Geen nieuwe luchtfoto's voor deze film.";
    await showFrame(frameIndex);
    if (myId !== loadId) return;
    setStatus(statusText);
    await saveMovie(savedPlan(session.movie?.mapPlan), mergePlans(savedPlan(session.movie?.satPlan), satLayer.plan), statusText);
    restorePlans(session.movie);
  } catch (error) {
    if (myId !== loadId || error.name === "AbortError") return;
    setStatus(error.message || "Kon de nieuwe luchtfoto's niet toevoegen.");
  } finally {
    if (myId === loadId) {
      loading = false;
      syncControls();
    }
  }
}

function beginLoadAbort() {
  activeAbort?.abort();
  activeAbort = new AbortController();
  return activeAbort.signal;
}

let shownFrame = 0;
let hasPresented = false;

function drawMissing(context, kind) {
  context.save();
  context.fillStyle = "#0c0c0c";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.translate(WIDTH / 2, HEIGHT / 2);
  context.strokeStyle = "#f3ecdf";
  context.lineWidth = 8;
  context.lineJoin = "round";
  context.lineCap = "round";
  const box = 86;
  context.strokeRect(-box, -box * 0.68, box * 2, box * 1.36);
  context.beginPath();
  if (kind === "map") {
    context.moveTo(-box * 0.75, box * 0.05);
    context.lineTo(-box * 0.2, -box * 0.28);
    context.lineTo(box * 0.15, box * 0.12);
    context.lineTo(box * 0.75, -box * 0.22);
  } else {
    context.moveTo(-box * 0.7, box * 0.32);
    context.lineTo(-box * 0.15, -box * 0.12);
    context.lineTo(box * 0.2, box * 0.18);
    context.lineTo(box * 0.72, -box * 0.28);
  }
  context.stroke();
  if (kind !== "map") {
    context.beginPath();
    context.arc(box * 0.42, -box * 0.32, 12, 0, Math.PI * 2);
    context.stroke();
  }
  context.beginPath();
  context.moveTo(-box * 1.2, -box * 0.9);
  context.lineTo(box * 1.2, box * 0.9);
  context.stroke();
  context.restore();
}

function composeFrame(target, bitmap, label, missingKind, credit, note) {
  const context = target.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  if (bitmap) {
    context.fillStyle = "#e7dcc4";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(bitmap, 0, 0, WIDTH, HEIGHT);
  } else {
    drawMissing(context, missingKind || "map");
  }
  stamp(label, context, credit, note);
}

function smoothStep(amount) {
  return amount * amount * (3 - 2 * amount);
}

function drawWipeBetween(axis, sign, t) {
  const amount = Math.min(1, Math.max(0, t));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(fromCanvas, 0, 0);
  ctx.save();
  if (axis === "x") {
    if (sign > 0) {
      const edge = amount * WIDTH;
      ctx.beginPath();
      ctx.rect(0, 0, edge, HEIGHT);
      ctx.clip();
    } else {
      const edge = (1 - amount) * WIDTH;
      ctx.beginPath();
      ctx.rect(edge, 0, WIDTH - edge, HEIGHT);
      ctx.clip();
    }
  } else if (sign > 0) {
    const edge = (1 - amount) * HEIGHT;
    ctx.beginPath();
    ctx.rect(0, edge, WIDTH, HEIGHT - edge);
    ctx.clip();
  } else {
    const edge = amount * HEIGHT;
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, edge);
    ctx.clip();
  }
  ctx.drawImage(toCanvas, 0, 0);
  ctx.restore();
}

function drawLayerSplitTo(context, split, activeSat = false) {
  const t = Math.min(1, Math.max(0, split));
  const edge = t * WIDTH;
  const active = activeSat ? satBlendCanvas : mapBlendCanvas;
  const other = activeSat ? mapBlendCanvas : satBlendCanvas;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.drawImage(other, 0, 0);
  if (edge > 0) {
    context.save();
    context.beginPath();
    context.rect(0, 0, edge, HEIGHT);
    context.clip();
    context.drawImage(active, 0, 0);
    context.restore();
  }
}

function drawLayerSplit(split, activeSat) {
  drawLayerSplitTo(ctx, split, activeSat);
}

async function rasterSplitView(index, target, split = layerSplit, activeSat = false) {
  await composeBothLayers(index);
  drawLayerSplitTo(target.getContext("2d"), split, activeSat);
}

async function paintSplitView(index, split = layerSplit, activeSat = false) {
  await rasterSplitView(index, toCanvas, split, activeSat);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(toCanvas, 0, 0);
}

async function runWipeTransition(myShow, token, ms, axis, sign, onFrame) {
  const started = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      if (myShow !== shownFrame || token !== playToken) {
        resolve();
        return;
      }
      const amount = Math.min(1, (now - started) / ms);
      drawWipeBetween(axis, sign, smoothStep(amount));
      onFrame?.();
      if (amount < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

async function composeFrameBlob(blob, label, kind, target, credit, note) {
  const bitmap = blob ? await createImageBitmap(blob) : null;
  composeFrame(target, bitmap, label, kind, credit, note);
  bitmap?.close();
}

async function composeBothLayers(index) {
  const frame = frames[index];
  if (!frame) return;
  if (browsingLocal && !recording && !packing) {
    renderLocalLayers(index, false);
    requestLocalTiles(index);
    return;
  }
  const shown = usingSatellite() ? "satellite" : "map";
  frameSource = "map";
  await composeFrameBlob(frame.map, frame.label, "map", mapBlendCanvas, undefined, frameNotes(frame));
  frameSource = "satellite";
  await composeFrameBlob(frame.satellite, frame.label, "picture", satBlendCanvas, frame.satCredit, frameNotes(frame));
  frameSource = shown;
}

function splitFromClientX(clientX) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return layerSplit;
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
}

function layoutWipeBars() {
  if (!wipeBars || wipeBars.hidden) return;
  const rect = canvas.getBoundingClientRect();
  const box = stageWrap.getBoundingClientRect();
  const scale = pageScale || 1;
  const left = (rect.left - box.left) / scale;
  const top = (rect.top - box.top) / scale;
  const width = rect.width / scale;
  const height = rect.height / scale;
  const barW = 28;
  const split = layerDrag ? layerDrag.split : layerSplit;
  const splitLeft = left + split * width - barW / 2;
  layerBar.style.left = `${Math.max(left, Math.min(left + width - barW, splitLeft))}px`;
  layerBar.style.top = `${top}px`;
  layerBar.style.height = `${height}px`;
  layerBar.style.width = `${barW}px`;
  updateWipeThumbs();
}

function updateWipeThumbs() {
  if (!frames.length || wipeBars.hidden) return;
  const split = layerDrag ? layerDrag.split : layerSplit;
  layerBar.setAttribute("aria-valuenow", String(Math.round(split * 100) / 100));
}

function syncWipeBars() {
  const show = frames.length > 0 && !interactive && !loading;
  wipeBars.hidden = !show;
  if (show) layoutWipeBars();
}

function finishLayerDrag() {
  const drag = layerDrag;
  layerDrag = null;
  if (!drag) return;
  layerSplit = drag.split;
  session.satellite = usingSatellite();
  hasPresented = true;
  rememberSettings();
  layoutWipeBars();
}

async function flipLayerSide() {
  const target = layerSplit > 0.5 ? 0 : 1;
  if (!frames.length || interactive || loading || recording) {
    layerSplit = target;
    session.satellite = layerSplit < 0.5;
    rememberSettings();
    return;
  }
  cancelPlayback();
  const token = playToken;
  const myShow = ++shownFrame;
  const from = layerSplit;
  await composeBothLayers(frameIndex);
  if (myShow !== shownFrame || token !== playToken) return;
  const started = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      if (myShow !== shownFrame || token !== playToken) {
        resolve();
        return;
      }
      const amount = Math.min(1, (now - started) / 280);
      layerSplit = from + (target - from) * smoothStep(amount);
      drawLayerSplit(layerSplit, false);
      layoutWipeBars();
      if (amount < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  if (myShow !== shownFrame || token !== playToken) return;
  layerSplit = target;
  session.satellite = layerSplit < 0.5;
  hasPresented = true;
  rememberSettings();
  layoutWipeBars();
}

function bindWipeBars() {
  layerBar.addEventListener("pointerdown", async (event) => {
    if (wipeBars.hidden || loading || recording) return;
    event.preventDefault();
    cancelPlayback();
    layerBar.setPointerCapture(event.pointerId);
    layerDrag = {
      id: event.pointerId,
      split: splitFromClientX(event.clientX),
      activeSat: false,
    };
    await composeBothLayers(frameIndex);
    drawLayerSplit(layerDrag.split, layerDrag.activeSat);
    layoutWipeBars();
  });

  layerBar.addEventListener("pointermove", (event) => {
    if (!layerDrag || event.pointerId !== layerDrag.id) return;
    layerDrag.split = splitFromClientX(event.clientX);
    drawLayerSplit(layerDrag.split, layerDrag.activeSat);
    layoutWipeBars();
  });

  const endLayer = (event) => {
    if (!layerDrag || event.pointerId !== layerDrag.id) return;
    layerBar.releasePointerCapture(event.pointerId);
    finishLayerDrag();
  };
  layerBar.addEventListener("pointerup", endLayer);
  layerBar.addEventListener("pointercancel", endLayer);
}

async function toggleLayerWithWipe(sign) {
  const frame = frames[frameIndex];
  if (!frame || interactive) return false;
  const token = playToken;
  const myShow = ++shownFrame;
  layerSplit = 1;
  fromCtx.setTransform(1, 0, 0, 1, 0, 0);
  fromCtx.globalAlpha = 1;
  fromCtx.drawImage(canvas, 0, 0);
  frameSource = usingSatellite() ? "satellite" : "map";
  await rasterSplitView(frameIndex, toCanvas, 1, false);
  if (myShow !== shownFrame || token !== playToken || interactive) return false;
  await runWipeTransition(myShow, token, 280, "x", sign);
  hasPresented = myShow === shownFrame && token === playToken;
  layoutWipeBars();
  return hasPresented;
}

async function presentFrame(index, token, { fadeMs = 0, wipeMs = 0, wipeAxis = "x", wipeSign = 1, onFrame } = {}) {
  const frame = frames[index];
  if (!frame || interactive) return false;
  if (browsingLocal && !recording && !packing) {
    frameIndex = index;
    scrub.value = String(index);
    yearEl.textContent = frame.label;
    rememberSettings();
    if (renderLocalLayers(index, false)) drawLayerSplit(layerSplit, false);
    else if (index === browseFrame) paintHeld();
    requestLocalTiles(index);
    hasPresented = true;
    return true;
  }
  const myShow = ++shownFrame;
  frameSource = usingSatellite() ? "satellite" : "map";
  await rasterSplitView(index, toCanvas, layerSplit, false);
  if (myShow !== shownFrame || token !== playToken || interactive) return false;
  frameIndex = index;
  scrub.value = String(index);
  yearEl.textContent = frame.label;
  rememberSettings();

  const wipe = wipeMs > 16 && hasPresented;
  const blend = !wipe && fadeMs > 16 && hasPresented;
  if (!wipe && !blend) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(toCanvas, 0, 0);
    hasPresented = true;
    onFrame?.();
    return true;
  }

  fromCtx.setTransform(1, 0, 0, 1, 0, 0);
  fromCtx.globalAlpha = 1;
  fromCtx.drawImage(canvas, 0, 0);
  if (wipe) {
    await runWipeTransition(myShow, token, wipeMs, wipeAxis, wipeSign, onFrame);
  } else {
    const started = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        if (myShow !== shownFrame || token !== playToken) {
          resolve();
          return;
        }
        const amount = Math.min(1, (now - started) / fadeMs);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(fromCanvas, 0, 0);
        ctx.globalAlpha = smoothStep(amount);
        ctx.drawImage(toCanvas, 0, 0);
        ctx.globalAlpha = 1;
        onFrame?.();
        if (amount < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }
  hasPresented = myShow === shownFrame && token === playToken;
  updateWipeThumbs();
  return hasPresented;
}

async function showFrame(index) {
  await presentFrame(index, playToken);
}

function stepFrame(delta) {
  if (!frames.length || loading || recording || interactive) return;
  const next = Math.min(frames.length - 1, Math.max(0, frameIndex + delta));
  if (next === frameIndex && hasPresented) return;
  cancelPlayback();
  presentFrame(next, playToken, {
    wipeMs: 220,
    wipeAxis: "x",
    wipeSign: delta > 0 ? 1 : -1,
  });
}

function startPlayback() {
  if (!frames.length || loading || recording) return;
  const token = ++playToken;
  playing = true;
  playButton.textContent = "Pauzeren";
  const start = frameIndex >= frames.length - 1 ? 0 : frameIndex;
  runPlayback(token, start);
}

async function runPlayback(token, start) {
  for (let i = start; i < frames.length; i += 1) {
    if (token !== playToken) return;
    const hold = frameHold(i);
    const fadeMs = hasPresented ? Math.min(320, hold * 0.5) : 0;
    const shown = await presentFrame(i, token, { fadeMs });
    if (!shown || token !== playToken) return;
    if (i < frames.length - 1) {
      const cancelled = await wait(Math.max(0, hold - fadeMs), token);
      if (cancelled) return;
    }
  }
  if (token === playToken) {
    playing = false;
    playButton.textContent = "Afspelen";
  }
}

function cancelPlayback() {
  playToken += 1;
  playing = false;
  playButton.textContent = "Afspelen";
  if (cancelWait) cancelWait();
}

function wait(ms, token) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cancelWait = null;
      resolve(token !== playToken);
    }, ms);
    cancelWait = () => {
      clearTimeout(timer);
      cancelWait = null;
      resolve(true);
    };
  });
}

function recordingStart() {
  if (!usingSatellite()) return 0;
  const first = frames.findIndex((frame) => frame.satellite);
  return first < 0 ? 0 : first;
}

async function recordMovie() {
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType || !canvas.captureStream) {
    setStatus("Deze browser kan geen WebM van de kaart opnemen.");
    return;
  }
  await recordStream(mimeType, "webm");
}

async function recordStream(mimeType, extension) {
  if (!frames.length || loading || recording) return;
  leaveLocalBrowse();
  cancelPlayback();
  recording = true;
  syncControls();
  setStatus("Opnemen…");
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  try {
    const token = ++playToken;
    playing = true;
    recorder.start(100);
    let cancelled = false;
    const start = recordingStart();
    hasPresented = false;
    for (let i = start; i < frames.length; i += 1) {
      if (token !== playToken) {
        cancelled = true;
        break;
      }
      const hold = frameHold(i);
      const fadeMs = i === start ? 0 : Math.min(320, hold * 0.5);
      const shown = await presentFrame(i, token, {
        fadeMs,
        onFrame: () => track.requestFrame(),
      });
      if (!shown || token !== playToken) {
        cancelled = true;
        break;
      }
      ctx.getImageData(0, 0, 1, 1);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      track.requestFrame();
      await sleep(Math.max(0, hold - fadeMs));
    }
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    if (cancelled) return;
    saveMovie(new Blob(chunks, { type: mimeType }), extension);
  } catch (error) {
    if (recorder.state !== "inactive") recorder.stop();
    setStatus(error.message || "Kon de film niet opnemen.");
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    playing = false;
    playButton.textContent = "Afspelen";
    recording = false;
    syncControls();
  }
}

function movieBaseName() {
  const place = anchoredView() || view;
  const x = Math.round(place?.x ?? 0);
  const y = Math.round(place?.y ?? 0);
  const mode = usingSatellite() ? "satelliet" : "kaart";
  return `tijdreis-${mode}-${x}-${y}`;
}

function movieName() {
  return `${movieBaseName()}.webm`;
}

function saveMovie(blob, extension) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${movieBaseName()}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 15000);
  setStatus(`Opgeslagen als ${link.download}.`);
}

async function chooseMp4File() {
  const name = `${movieBaseName()}.mp4`;
  if (!window.showSaveFilePicker) return { name };
  try {
    const handle = await showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "MP4-video", accept: { "video/mp4": [".mp4"] } }],
    });
    return { name, handle };
  } catch (error) {
    if (error.name === "AbortError") return null;
    return { name };
  }
}

async function writeChosenFile(choice, blob) {
  if (!choice?.handle) {
    saveMovie(blob, "mp4");
    return;
  }
  const writable = await choice.handle.createWritable();
  await writable.write(blob);
  await writable.close();
  setStatus(`Opgeslagen als ${choice.name}.`);
}

async function mp4Codec() {
  if (typeof VideoEncoder === "undefined") return null;
  const codecs = ["avc1.64001f", "avc1.4d001f", "avc1.42001f"];
  for (const codec of codecs) {
    const config = {
      codec,
      width: WIDTH,
      height: HEIGHT,
      bitrate: 4_000_000,
      avc: { format: "avc" },
      hardwareAcceleration: "no-preference",
    };
    const support = await VideoEncoder.isConfigSupported(config);
    if (support.supported) return support.config || config;
  }
  return null;
}

async function recordMp4() {
  if (!frames.length || loading || recording) return;
  const choice = await chooseMp4File();
  if (!choice) return;
  const config = await mp4Codec();
  if (!config) {
    if (canvas.captureStream && MediaRecorder.isTypeSupported("video/mp4")) {
      await recordStream("video/mp4", "mp4");
    } else {
      setStatus("Deze browser kan geen MP4 maken.");
    }
    return;
  }
  const blob = await recordEncodedMp4(config);
  if (!blob) return;
  try {
    await writeChosenFile(choice, blob);
  } catch (error) {
    setStatus(error.message || "Kon de film niet opslaan.");
  }
}

async function recordEncodedMp4(config) {
  leaveLocalBrowse();
  cancelPlayback();
  recording = true;
  syncControls();
  setStatus("Opnemen…");
  const samples = [];
  const durations = [];
  let description = null;
  let failed = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig?.description) description = new Uint8Array(meta.decoderConfig.description);
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      samples.push(data);
    },
    error: (error) => {
      failed = error;
    },
  });

  try {
    encoder.configure(config);
    const token = ++playToken;
    playing = true;
    const start = recordingStart();
    hasPresented = false;
    let time = 0;
    for (let i = start; i < frames.length; i += 1) {
      if (failed) throw failed;
      if (token !== playToken) return;
      const hold = Math.max(1, Math.round(frameHold(i)));
      const fadeMs = i === start ? 0 : Math.min(320, hold * 0.5);
      const shown = await presentFrame(i, token, { fadeMs });
      if (!shown || token !== playToken) return null;
      while (encoder.encodeQueueSize > 4) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const bitmap = await createImageBitmap(canvas);
      const frame = new VideoFrame(bitmap, { timestamp: time * 1000, duration: hold * 1000 });
      bitmap.close();
      durations.push(hold);
      encoder.encode(frame, { keyFrame: true });
      frame.close();
      time += hold;
    }
    await encoder.flush();
    if (failed) throw failed;
    if (!description || samples.length !== durations.length) throw new Error("Kon de MP4 niet maken.");
    const packed = samples.map((data, index) => ({ data, duration: durations[index] }));
    return new Blob([muxMp4(packed, WIDTH, HEIGHT, description)], { type: "video/mp4" });
  } catch (error) {
    setStatus(error.message || "Kon de film niet opnemen.");
  } finally {
    if (encoder.state !== "closed") encoder.close();
    playing = false;
    playButton.textContent = "Afspelen";
    recording = false;
    syncControls();
  }
}

function mp4Bytes(parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function mp4Str(value) {
  return new TextEncoder().encode(value);
}

function mp4U32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function mp4Box(type, ...parts) {
  const body = mp4Bytes(parts);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(mp4Str(type), 4);
  out.set(body, 8);
  return out;
}

function muxMp4(samples, width, height, avcC) {
  const durations = samples.map((sample) => sample.duration);
  const duration = durations.reduce((total, item) => total + item, 0);
  const created = Math.floor(Date.now() / 1000) + 2082844800;
  const ftyp = mp4Box("ftyp", mp4Str("isom"), mp4U32(0x200), mp4Str("isomiso2avc1mp41"));
  const matrix = new Uint8Array(36);
  const matrixView = new DataView(matrix.buffer);
  matrixView.setUint32(0, 0x00010000);
  matrixView.setUint32(16, 0x00010000);
  matrixView.setUint32(32, 0x40000000);
  const mvhdBody = new Uint8Array(100);
  const mvhd = new DataView(mvhdBody.buffer);
  mvhd.setUint32(4, created);
  mvhd.setUint32(8, created);
  mvhd.setUint32(12, 1000);
  mvhd.setUint32(16, duration);
  mvhd.setUint32(20, 0x00010000);
  mvhd.setUint16(24, 0x0100);
  mvhdBody.set(matrix, 36);
  mvhd.setUint32(96, 2);
  const tkhdBody = new Uint8Array(84);
  const tkhd = new DataView(tkhdBody.buffer);
  tkhd.setUint32(0, 0x7);
  tkhd.setUint32(4, created);
  tkhd.setUint32(8, created);
  tkhd.setUint32(12, 1);
  tkhd.setUint32(20, duration);
  tkhdBody.set(matrix, 40);
  tkhd.setUint32(76, width << 16);
  tkhd.setUint32(80, height << 16);
  const mdhdBody = new Uint8Array(24);
  const mdhd = new DataView(mdhdBody.buffer);
  mdhd.setUint32(4, created);
  mdhd.setUint32(8, created);
  mdhd.setUint32(12, 1000);
  mdhd.setUint32(16, duration);
  mdhd.setUint16(20, 0x55c4);
  const vmhdBody = new Uint8Array(12);
  new DataView(vmhdBody.buffer).setUint32(0, 1);
  const url = mp4Box("url ", mp4U32(1));
  const dref = mp4Box("dref", mp4U32(0), mp4U32(1), url);
  const runs = [];
  for (const delta of durations) {
    const last = runs.at(-1);
    if (last && last.delta === delta) last.count += 1;
    else runs.push({ count: 1, delta });
  }
  const sttsBody = new Uint8Array(8 + runs.length * 8);
  const stts = new DataView(sttsBody.buffer);
  stts.setUint32(4, runs.length);
  runs.forEach((run, index) => {
    stts.setUint32(8 + index * 8, run.count);
    stts.setUint32(12 + index * 8, run.delta);
  });
  const stscBody = new Uint8Array(20);
  const stsc = new DataView(stscBody.buffer);
  stsc.setUint32(4, 1);
  stsc.setUint32(8, 1);
  stsc.setUint32(12, samples.length);
  stsc.setUint32(16, 1);
  const stszBody = new Uint8Array(12 + samples.length * 4);
  const stsz = new DataView(stszBody.buffer);
  stsz.setUint32(8, samples.length);
  samples.forEach((sample, index) => stsz.setUint32(12 + index * 4, sample.data.length));
  const stcoBody = new Uint8Array(12);
  new DataView(stcoBody.buffer).setUint32(4, 1);
  const visual = new Uint8Array(78);
  const visualView = new DataView(visual.buffer);
  visualView.setUint16(6, 1);
  visualView.setUint16(24, width);
  visualView.setUint16(26, height);
  visualView.setUint32(28, 0x00480000);
  visualView.setUint32(32, 0x00480000);
  visualView.setUint16(40, 1);
  visualView.setUint16(74, 0x0018);
  visualView.setInt16(76, -1);
  const avc1 = mp4Box("avc1", visual, mp4Box("avcC", avcC));
  const stsd = mp4Box("stsd", mp4U32(0), mp4U32(1), avc1);
  const stbl = mp4Box(
    "stbl",
    stsd,
    mp4Box("stts", sttsBody),
    mp4Box("stsc", stscBody),
    mp4Box("stsz", stszBody),
    mp4Box("stco", stcoBody),
  );
  const minf = mp4Box("minf", mp4Box("vmhd", vmhdBody), mp4Box("dinf", dref), stbl);
  const mdia = mp4Box(
    "mdia",
    mp4Box("mdhd", mdhdBody),
    mp4Box("hdlr", mp4U32(0), mp4U32(0), mp4Str("vide"), new Uint8Array(12), mp4Str("VideoHandler\0")),
    minf,
  );
  const trak = mp4Box("trak", mp4Box("tkhd", tkhdBody), mdia);
  const moov = mp4Box("moov", mp4Box("mvhd", mvhdBody), trak);
  const payload = mp4Bytes(samples.map((sample) => sample.data));
  const mdat = new Uint8Array(8 + payload.length);
  new DataView(mdat.buffer).setUint32(0, mdat.length);
  mdat.set(mp4Str("mdat"), 4);
  mdat.set(payload, 8);
  new DataView(moov.buffer).setUint32(moov.length - 4, ftyp.length + moov.length + 8);
  return mp4Bytes([ftyp, moov, mdat]);
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let crc = n;
  for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  CRC_TABLE[n] = crc >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const size = file.data.length;
    const crc = crc32(file.data);
    const local = new Uint8Array(30);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, name.length, true);
    parts.push(local, name, file.data);
    const head = new Uint8Array(46);
    const cd = new DataView(head.buffer);
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(head, name);
    offset += 30 + name.length + size;
  }
  let centralSize = 0;
  for (const part of central) centralSize += part.length;
  const end = new Uint8Array(22);
  const eocd = new DataView(end.buffer);
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

function viewerPage(movie) {
  const data = JSON.stringify(movie).replace(/</g, "\\u003c");
  const utrecht = (movie.credits || []).some((credit) => credit === "Provincie Utrecht");
  const sourceLine = utrecht
    ? "Kaart: Kadaster, Topotijdreis. Satelliet: Beeldmateriaal.nl, Kadaster. Luchtfoto's van 1950, 1996, 2000, 2003 en 2025 in de provincie Utrecht: Provincie Utrecht."
    : "Kaart: Kadaster, Topotijdreis. Satelliet: Beeldmateriaal.nl, Kadaster.";
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tijdreis</title>
  <style>
    :root { color-scheme: dark; --ink: #1c1916; --paper: #f3ecdf; --muted: #b5a894; --red: #c4492c; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: var(--ink); color: var(--paper); font: 16px/1.4 "Segoe UI", "Helvetica Neue", sans-serif; }
    header, .transport, .note { width: min(1100px, calc(100% - 32px)); margin: 0 auto; }
    header { padding: 28px 0 12px; }
    .eyebrow { margin: 0 0 4px; color: var(--muted); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { margin: 0; font-family: Palatino, "Palatino Linotype", "Times New Roman", serif; font-size: 40px; font-weight: 500; letter-spacing: -0.03em; }
    .stage-wrap { position: relative; width: min(1100px, calc(100% - 32px)); margin: 12px auto; }
    canvas { display: block; width: 100%; height: auto; background: #e7dcc4; touch-action: none; }
    .wipe-bars { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
    .layer-bar { position: absolute; pointer-events: auto; touch-action: none; width: 28px; cursor: ew-resize; background: transparent; }
    .layer-bar::before { content: ""; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: rgba(243, 236, 223, 0.85); box-shadow: 0 0 6px rgba(0, 0, 0, 0.35); pointer-events: none; }
    .layer-thumb { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; gap: 2px; min-width: 34px; height: 34px; padding: 0 6px; border-radius: 6px; font-size: 14px; font-weight: 600; line-height: 1; letter-spacing: -0.08em; color: var(--ink); background: rgba(243, 236, 223, 0.96); border: 1px solid #c9bfb1; box-shadow: 0 1px 6px rgba(28, 25, 22, 0.4); pointer-events: none; }
    figcaption, .note { color: var(--muted); font-size: 13px; }
    .transport { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 8px 0 28px; }
    .playline { flex: 1 1 220px; }
    #scrub { width: 100%; accent-color: var(--red); }
    button, select { font: 15px/1.2 "Segoe UI", sans-serif; color: var(--ink); background: #d9d0c2; border: 0; border-radius: 2px; padding: 10px 12px; }
    button { cursor: pointer; }
    label { color: var(--muted); font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <p class="eyebrow">Kadaster · Topotijdreis</p>
    <h1 id="place">Tijdreis</h1>
  </header>
  <div class="stage-wrap" id="stage">
    <canvas id="map" width="1280" height="720"></canvas>
    <div class="wipe-bars" id="bars">
      <div class="layer-bar" id="splitbar" role="slider" aria-label="Kaart en satelliet" aria-valuemin="0" aria-valuemax="1"><div class="layer-thumb"><span>←</span><span>→</span></div></div>
    </div>
  </div>
  <p class="note" style="margin-top:8px">${sourceLine}</p>
  <div class="transport">
    <button id="play" type="button">Afspelen</button>
    <label>Tempo
      <select id="hold" aria-label="Tempo">
        <option value="400">snel</option>
        <option value="800">normaal</option>
        <option value="1500">langzaam</option>
      </select>
    </label>
    <button id="layer-toggle" type="button">Sat/Kaart</button>
    <div class="playline"><input id="scrub" type="range" min="0" value="0" aria-label="Jaar"></div>
  </div>
  <p class="note">Deze bladzijde leest alleen de beelden naast zich. Uitgepakt openen in de browser; internet is niet nodig.</p>
  <script type="application/json" id="movie">${data}</script>
  <script>
    const MOVIE = JSON.parse(document.getElementById("movie").textContent);
    const W = 1280;
    const H = 720;
    const stage = document.getElementById("stage");
    const screen = document.getElementById("map");
    const ctx = screen.getContext("2d");
    const fromCanvas = document.createElement("canvas");
    const toCanvas = document.createElement("canvas");
    const mapBlend = document.createElement("canvas");
    const satBlend = document.createElement("canvas");
    [fromCanvas, toCanvas, mapBlend, satBlend].forEach((canvas) => {
      canvas.width = W;
      canvas.height = H;
    });
    const fromCtx = fromCanvas.getContext("2d");
    const playBtn = document.getElementById("play");
    const scrub = document.getElementById("scrub");
    const hold = document.getElementById("hold");
    const layerToggle = document.getElementById("layer-toggle");
    const splitbar = document.getElementById("splitbar");
    const last = Math.max(0, MOVIE.years.length - 1);
    let index = Math.min(last, Math.max(0, MOVIE.index || 0));
    let split = MOVIE.split == null ? (MOVIE.satellite ? 0 : 1) : Math.min(1, Math.max(0, MOVIE.split));
    let playToken = 0;
    let playing = false;
    let hasPresented = false;
    let showId = 0;
    let builtYear = -1;
    let layerDrag = null;
    const images = {};

    document.getElementById("place").textContent = MOVIE.place || "Tijdreis";
    document.title = MOVIE.place ? "Tijdreis · " + MOVIE.place : "Tijdreis";
    if ([...hold.options].some((option) => option.value === String(MOVIE.hold))) hold.value = String(MOVIE.hold);
    scrub.max = String(last);
    function loadImages() {
      const ids = [];
      MOVIE.map.concat(MOVIE.sat).forEach((id) => {
        if (id != null && ids.indexOf(id) < 0) ids.push(id);
      });
      return Promise.all(ids.map((id) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { images[id] = img; resolve(); };
        img.onerror = () => resolve();
        img.src = "i/" + id + ".jpg";
      })));
    }

    function drawMissing(context, kind) {
      context.save();
      context.fillStyle = "#0c0c0c";
      context.fillRect(0, 0, W, H);
      context.translate(W / 2, H / 2);
      context.strokeStyle = "#f3ecdf";
      context.lineWidth = 8;
      context.lineJoin = "round";
      context.lineCap = "round";
      const box = 86;
      context.strokeRect(-box, -box * 0.68, box * 2, box * 1.36);
      context.beginPath();
      if (kind === "map") {
        context.moveTo(-box * 0.75, box * 0.05);
        context.lineTo(-box * 0.2, -box * 0.28);
        context.lineTo(box * 0.15, box * 0.12);
        context.lineTo(box * 0.75, -box * 0.22);
      } else {
        context.moveTo(-box * 0.7, box * 0.32);
        context.lineTo(-box * 0.15, -box * 0.12);
        context.lineTo(box * 0.2, box * 0.18);
        context.lineTo(box * 0.72, -box * 0.28);
      }
      context.stroke();
      if (kind !== "map") {
        context.beginPath();
        context.arc(box * 0.42, -box * 0.32, 12, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(-box * 1.2, -box * 0.9);
      context.lineTo(box * 1.2, box * 0.9);
      context.stroke();
      context.restore();
    }

    function drawNoteIcon(context, kind, x, y) {
      context.save();
      context.translate(x, y - 12);
      context.lineWidth = 2.2;
      context.lineJoin = "round";
      context.strokeStyle = context.fillStyle;
      context.beginPath();
      if (kind === "map") {
        context.moveTo(1, 4);
        context.lineTo(8, 1);
        context.lineTo(16, 4);
        context.lineTo(23, 1);
        context.lineTo(23, 20);
        context.lineTo(16, 23);
        context.lineTo(8, 20);
        context.lineTo(1, 23);
        context.closePath();
        context.moveTo(8, 1);
        context.lineTo(8, 20);
        context.moveTo(16, 4);
        context.lineTo(16, 23);
        context.stroke();
      } else {
        context.moveTo(2, 7);
        context.lineTo(7, 7);
        context.lineTo(9, 3);
        context.lineTo(15, 3);
        context.lineTo(17, 7);
        context.lineTo(22, 7);
        context.lineTo(22, 21);
        context.lineTo(2, 21);
        context.closePath();
        context.stroke();
        context.beginPath();
        context.arc(12, 14, 4.5, 0, Math.PI * 2);
        context.stroke();
      }
      context.restore();
    }

    function stamp(context, label, kind, credit, notes) {
      context.save();
      const parts = [["map", notes && notes.map], ["sat", notes && notes.sat]]
        .filter((part) => part[1] != null && Number.isFinite(Number(part[1])))
        .map((part) => ({ kind: part[0], text: String(part[1]) }));
      const padX = 18;
      context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      const yearW = context.measureText(String(label)).width;
      context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      let noteW = 0;
      parts.forEach((part, i) => {
        part.width = context.measureText(part.text).width;
        noteW += 31 + part.width + (i ? 20 : 0);
      });
      const textW = Math.max(yearW, noteW);
      const boxH = parts.length ? 112 : 72;
      context.fillStyle = "rgba(243, 236, 223, 0.94)";
      context.fillRect(28, 28, textW + padX * 2, boxH);
      context.fillStyle = "#1c1916";
      context.textBaseline = "middle";
      context.font = "600 52px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
      const middle = 28 + padX + textW / 2;
      context.fillText(String(label), middle - yearW / 2, 28 + 36);
      if (parts.length) {
        context.font = "600 26px Palatino, 'Palatino Linotype', 'Times New Roman', serif";
        context.fillStyle = "rgba(28, 25, 22, 0.78)";
        let x = middle - noteW / 2;
        for (const part of parts) {
          drawNoteIcon(context, part.kind, x, 28 + 84);
          x += 31;
          context.fillText(part.text, x, 28 + 85);
          x += part.width + 20;
        }
      }
      context.font = "16px 'Segoe UI', 'Helvetica Neue', sans-serif";
      context.fillStyle = "rgba(243, 236, 223, 0.95)";
      context.textAlign = "right";
      context.shadowColor = "rgba(28, 25, 22, 0.55)";
      context.shadowBlur = 6;
      const line = kind === "map" ? "Kadaster / Topotijdreis" : (credit || "Beeldmateriaal.nl / Kadaster");
      context.fillText(line, W - 28, H - 26);
      context.restore();
    }

    function composeLayer(canvas, id, label, kind, credit, note) {
      const context = canvas.getContext("2d");
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      const img = id == null ? null : images[id];
      if (img) {
        context.fillStyle = "#e7dcc4";
        context.fillRect(0, 0, W, H);
        context.drawImage(img, 0, 0, W, H);
      } else drawMissing(context, kind);
      stamp(context, label, kind, credit, note);
    }

    function buildLayers(i) {
      if (builtYear === i) return;
      const label = MOVIE.years[i] || "";
      const notes = {
        map: MOVIE.mapYears ? MOVIE.mapYears[i] : null,
        sat: MOVIE.satYears ? MOVIE.satYears[i] : null,
      };
      composeLayer(mapBlend, MOVIE.map[i], label, "map", null, notes);
      composeLayer(satBlend, MOVIE.sat[i], label, "picture", MOVIE.credits && MOVIE.credits[i], notes);
      builtYear = i;
    }

    function drawSplit(context, splitValue) {
      const t = Math.min(1, Math.max(0, splitValue));
      const edge = t * W;
      const active = mapBlend;
      const other = satBlend;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.drawImage(other, 0, 0);
      if (edge > 0) {
        context.save();
        context.beginPath();
        context.rect(0, 0, edge, H);
        context.clip();
        context.drawImage(active, 0, 0);
        context.restore();
      }
    }

    function renderSplit(canvas, i) {
      buildLayers(i);
      drawSplit(canvas.getContext("2d"), split);
    }

    function smooth(amount) {
      return amount * amount * (3 - 2 * amount);
    }

    function drawWipe(sign, t) {
      const amount = Math.min(1, Math.max(0, t));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(fromCanvas, 0, 0);
      ctx.save();
      ctx.beginPath();
      if (sign > 0) ctx.rect(0, 0, amount * W, H);
      else ctx.rect((1 - amount) * W, 0, amount * W, H);
      ctx.clip();
      ctx.drawImage(toCanvas, 0, 0);
      ctx.restore();
    }

    function layout() {
      const rect = screen.getBoundingClientRect();
      const box = stage.getBoundingClientRect();
      const left = rect.left - box.left;
      const top = rect.top - box.top;
      const barW = 28;
      const splitLeft = left + split * rect.width - barW / 2;
      splitbar.style.left = Math.max(left, Math.min(left + rect.width - barW, splitLeft)) + "px";
      splitbar.style.top = top + "px";
      splitbar.style.height = rect.height + "px";
      splitbar.style.width = barW + "px";
      splitbar.setAttribute("aria-valuenow", String(Math.round(split * 100) / 100));
    }

    function showAt(i) {
      index = Math.min(last, Math.max(0, i));
      builtYear = -1;
      renderSplit(screen, index);
      hasPresented = true;
      scrub.value = String(index);
      layout();
    }

    function holdFor(i) {
      const full = Number(hold.value) || 800;
      if (i === 0) return full;
      const key = split < 0.5 ? "sat" : "map";
      if (MOVIE[key][i] !== MOVIE[key][i - 1]) return full;
      return full / 4;
    }

    function stopPlay() {
      playToken += 1;
      playing = false;
      playBtn.textContent = "Afspelen";
    }

    function present(i, token, fadeMs, wipeMs, wipeSign, done) {
      const my = ++showId;
      builtYear = -1;
      renderSplit(toCanvas, i);
      if (token !== playToken || my !== showId) return;
      index = Math.min(last, Math.max(0, i));
      scrub.value = String(index);
      const wipe = wipeMs > 16 && hasPresented;
      const blend = !wipe && fadeMs > 16 && hasPresented;
      if (!wipe && !blend) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.drawImage(toCanvas, 0, 0);
        hasPresented = true;
        layout();
        if (done) done();
        return;
      }
      fromCtx.setTransform(1, 0, 0, 1, 0, 0);
      fromCtx.globalAlpha = 1;
      fromCtx.drawImage(screen, 0, 0);
      const ms = wipe ? wipeMs : fadeMs;
      const started = performance.now();
      const tick = (now) => {
        if (token !== playToken || my !== showId) return;
        const amount = Math.min(1, (now - started) / Math.max(1, ms));
        const eased = smooth(amount);
        if (wipe) drawWipe(wipeSign, eased);
        else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalAlpha = 1;
          ctx.drawImage(fromCanvas, 0, 0);
          ctx.globalAlpha = eased;
          ctx.drawImage(toCanvas, 0, 0);
          ctx.globalAlpha = 1;
        }
        if (amount < 1) requestAnimationFrame(tick);
        else {
          hasPresented = true;
          layout();
          if (done) done();
        }
      };
      requestAnimationFrame(tick);
    }

    function startPlay() {
      if (playing) {
        stopPlay();
        showAt(index);
        return;
      }
      const token = ++playToken;
      playing = true;
      playBtn.textContent = "Pauzeren";
      let cursor = index >= last ? 0 : index;
      const step = () => {
        if (token !== playToken) return;
        const holdMs = holdFor(cursor);
        const fade = hasPresented ? Math.min(320, holdMs * 0.5) : 0;
        present(cursor, token, fade, 0, 1, () => {
          if (token !== playToken) return;
          if (cursor >= last) {
            playing = false;
            playBtn.textContent = "Afspelen";
            return;
          }
          setTimeout(() => {
            cursor += 1;
            step();
          }, Math.max(0, holdMs - fade));
        });
      };
      step();
    }

    function splitFrom(clientX) {
      const rect = screen.getBoundingClientRect();
      if (!rect.width) return split;
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    }

    playBtn.addEventListener("click", startPlay);
    scrub.addEventListener("input", () => {
      stopPlay();
      showAt(Number(scrub.value));
    });
    layerToggle.addEventListener("click", () => {
      stopPlay();
      const target = split > 0.5 ? 0 : 1;
      const from = split;
      builtYear = -1;
      buildLayers(index);
      const token = playToken;
      const my = ++showId;
      const started = performance.now();
      const tick = (now) => {
        if (token !== playToken || my !== showId) return;
        const amount = Math.min(1, (now - started) / 280);
        split = from + (target - from) * smooth(amount);
        drawSplit(ctx, split);
        layout();
        if (amount < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    hold.addEventListener("change", stopPlay);

    splitbar.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      stopPlay();
      try { splitbar.setPointerCapture(event.pointerId); } catch (error) { /* The move listener still tracks the pointer. */ }
      layerDrag = { id: event.pointerId };
      builtYear = -1;
      buildLayers(index);
      split = splitFrom(event.clientX);
      drawSplit(ctx, split);
      layout();
    });
    splitbar.addEventListener("pointermove", (event) => {
      if (!layerDrag || event.pointerId !== layerDrag.id) return;
      split = splitFrom(event.clientX);
      drawSplit(ctx, split);
      layout();
    });
    const endLayer = (event) => {
      if (!layerDrag || event.pointerId !== layerDrag.id) return;
      try { splitbar.releasePointerCapture(event.pointerId); } catch (error) { /* Capture was already released. */ }
      layerDrag = null;
      layout();
    };
    splitbar.addEventListener("pointerup", endLayer);
    splitbar.addEventListener("pointercancel", endLayer);

    document.addEventListener("keydown", (event) => {
      if (event.target.matches("input, select, textarea")) return;
      if (event.code === "Space") {
        event.preventDefault();
        startPlay();
      } else if (event.code === "ArrowRight") {
        stopPlay();
        present(Math.min(last, index + 1), playToken, 0, 220, 1);
      } else if (event.code === "ArrowLeft") {
        stopPlay();
        present(Math.max(0, index - 1), playToken, 0, 220, -1);
      }
    });

    window.addEventListener("resize", layout);
    loadImages().then(() => showAt(index));
  </script>
</body>
</html>`;
}

async function downloadZip() {
  if (!frames.length || loading || recording || packing) return;
  packing = true;
  cancelPlayback();
  syncControls();
  setStatus("Zip maken…");
  try {
    const packed = packFrames(frames);
    const folder = movieBaseName();
    const files = [{
      name: `${folder}/index.html`,
      data: new TextEncoder().encode(viewerPage({
        years: packed.frames.map((item) => item.label),
        map: packed.frames.map((item) => item.map),
        sat: packed.frames.map((item) => item.satellite),
        credits: packed.frames.map((item) => item.satCredit),
        mapYears: frames.map((item) => sheetYear(item, "map")),
        satYears: frames.map((item) => sheetYear(item, "sat")),
        hold: Number(holdInput.value) || 800,
        linear: false,
        satellite: usingSatellite(),
        split: layerSplit,
        index: frameIndex,
        place: placeInput.value.trim(),
      })),
    }];
    for (let i = 0; i < packed.blobs.length; i += 1) {
      files.push({
        name: `${folder}/i/${i}.jpg`,
        data: new Uint8Array(await packed.blobs[i].arrayBuffer()),
      });
    }
    const blob = zipStore(files);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${folder}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60000);
    setStatus(`Opgeslagen als ${link.download}. Pak de map uit en open index.html.`);
  } catch (error) {
    setStatus(error.message || "Kon de zip niet maken.");
  } finally {
    packing = false;
    syncControls();
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncControls() {
  const blocked = loading || recording || packing;
  const canPlay = frames.length > 0 && !interactive;
  transport.hidden = !canPlay;
  loadProgress.hidden = !(loading || fetchingView);
  scrub.hidden = !canPlay;
  transportControls.hidden = !canPlay;
  playButton.disabled = blocked || !canPlay;
  downloadButton.disabled = blocked || !canPlay;
  mp4Button.disabled = blocked || !canPlay;
  zipButton.disabled = blocked || !canPlay;
  scrub.disabled = blocked || !canPlay;
  canvas.classList.toggle("browsable", canPlay && !blocked);
  loadButton.disabled = blocked;
  loadButton.textContent = loading ? "Bezig…" : "Laden";
  layerToggle.disabled = blocked;
  syncChrome();
  syncWipeBars();
}

function editionForYear(editions, year) {
  if (!editions?.length) return null;
  let chosen = null;
  for (const edition of editions) {
    if (edition.end <= year) chosen = edition;
  }
  return chosen || editions[0];
}

function clampZoom() {
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
}

function readView() {
  if (!view) throw new Error("Geen kaartweergave.");
  const year = Number(yearSelect.value);
  if (!Number.isFinite(year)) throw new Error("Kies een jaar.");
  return { year, x: view.x, y: view.y, zoom: view.zoom };
}

function formatCoords(x, y) {
  const east = Math.round(x * 100) / 100;
  const north = Math.round(y * 100) / 100;
  return `${east}, ${north}`;
}

function ensureYearOption(year) {
  const value = String(year);
  if ([...yearSelect.options].some((option) => option.value === value)) return;
  const option = document.createElement("option");
  option.value = value;
  option.textContent = value;
  yearSelect.append(option);
}

function yearOptionsFragment(start, end) {
  const fragment = document.createDocumentFragment();
  for (let year = start; year <= end; year += 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    fragment.append(option);
  }
  return fragment;
}

function rangeSelectOptions(first, last) {
  const fragment = document.createDocumentFragment();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "—";
  fragment.append(empty);
  fragment.append(yearOptionsFragment(first, last));
  return fragment;
}

function resetVanTot() {
  session.from = "";
  session.to = "";
  session.rangeSet = false;
  if (fromInput.options.length) {
    fromInput.value = "";
    toInput.value = "";
  }
}

function fillYearSelect(editions) {
  if (!editions?.length) return;
  const first = editions[0].start;
  const last = editions.at(-1).end;
  let selected = view?.year ?? last;
  if (!session.rangeSet || selected < first) selected = last;
  yearSelect.replaceChildren(yearOptionsFragment(first, last));
  if (selected < first) selected = first;
  if (selected > last) selected = last;
  yearSelect.value = String(selected);
  if (view) view.year = selected;
}

function fillRangeSelects(editions) {
  if (!editions?.length) return;
  const first = editions[0].start;
  const last = editions.at(-1).end;
  const options = rangeSelectOptions(first, last);
  fromInput.replaceChildren(options.cloneNode(true));
  toInput.replaceChildren(options);
  if (!session.rangeSet) {
    fromInput.value = "";
    toInput.value = "";
    session.from = "";
    session.to = "";
    return;
  }
  const from = Number(session.from);
  const to = Number(session.to);
  fromInput.value = session.from === "" || !Number.isFinite(from)
    ? ""
    : String(Math.min(Math.max(from, first), last));
  toInput.value = session.to === "" || !Number.isFinite(to)
    ? ""
    : String(Math.min(Math.max(to, first), last));
  session.from = fromInput.value;
  session.to = toInput.value;
}

function writeFields() {
  ensureYearOption(view.year);
  yearSelect.value = String(view.year);
  coordsInput.value = formatCoords(view.x, view.y);
  zoomInput.value = String(Math.round(view.zoom * 1000) / 1000);
  if (fromInput.options.length) {
    if (session.from === "") fromInput.value = "";
    else if ([...fromInput.options].some((option) => option.value === session.from)) {
      fromInput.value = session.from;
    }
    if (session.to === "") toInput.value = "";
    else if ([...toInput.options].some((option) => option.value === session.to)) {
      toInput.value = session.to;
    }
  }
  if ([...holdInput.options].some((option) => option.value === String(session.hold))) {
    holdInput.value = String(session.hold);
  }
  rememberSettings();
}

function applyFields() {
  if (loading || !view) return;
  try {
    const next = readView();
    if (!interactive) {
      view = next;
      clampZoom();
      rememberSettings();
      return;
    }
    const yearChanged = next.year !== view.year;
    view = next;
    clampZoom();
    writeFields();
    if (yearChanged) previewEdition = sheetForYear(knownEditions, view.year);
    const source = usingSatellite() ? "satellite" : "map";
    if (!mapInfo || infoSource !== source) {
      showPreview();
      return;
    }
    paintPreview();
    requestTiles();
  } catch (error) {
    setStatus(error.message);
  }
}

let placeRequest = 0;

let hereToken = 0;

function stillAtDefault() {
  if (!view) return false;
  return Math.round(view.x) === Math.round(DEFAULT_VIEW.x)
    && Math.round(view.y) === Math.round(DEFAULT_VIEW.y)
    && Math.round(view.zoom * 100) === Math.round(DEFAULT_VIEW.zoom * 100);
}

function useCurrentLocation() {
  if (!navigator.geolocation || !window.isSecureContext || !stillAtDefault()) return;
  const token = ++hereToken;
  navigator.geolocation.getCurrentPosition((position) => {
    if (token !== hereToken || !interactive || loading || frames.length || !stillAtDefault()) return;
    const point = asDutchLatLon(position.coords.latitude, position.coords.longitude);
    if (!point || !knownEditions?.length) return;
    view = { ...view, x: point.x, y: point.y, zoom: 10 };
    clampZoom();
    writeFields();
    previewEdition = sheetForYear(knownEditions, view.year);
    showPreview();
    setStatus(`Huidige locatie · ${Math.round(view.x)}, ${Math.round(view.y)} · zoom ${view.zoom}`);
  }, () => {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
}

function locatePlace() {
  hereToken += 1;
  const text = placeInput.value.trim();
  if (!text) return;
  const request = ++placeRequest;
  resolvePlace(text)
    .then((place) => {
      if (request !== placeRequest) return;
      applyLocatedPlace(place);
    })
    .catch((error) => {
      if (request !== placeRequest) return;
      setStatus(error.message || "Plaats niet gevonden.");
    });
}

async function resolvePlace(text) {
  const linked = readLinkedPlace(text);
  if (linked) {
    layerSplit = linked.satellite ? 0 : 1;
    session.satellite = linked.satellite;
  }
  if (linked || !knownEditions?.length) await discoverEditions();
  if (!knownEditions?.length) throw new Error("De kaartjaren worden nog geladen.");
  if (linked) return linked;
  const typed = readTypedCoordinates(text);
  if (typed) return typed;
  setStatus("Plaats opzoeken…");
  const dutch = await searchPdok(text);
  if (dutch) return dutch;
  const found = await searchNominatim(text);
  if (found) return found;
  throw new Error("Geen plaats gevonden voor deze zoekopdracht.");
}

function readLinkedPlace(text) {
  const match = String(text).match(/(kaart|satelliet)\/(\d+)\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  return {
    x: Number(match[3]),
    y: Number(match[4]),
    zoom: Number(match[5]),
    satellite: match[1] === "satelliet",
    label: match[1] === "satelliet" ? "Satellietlink" : "Kaartlink",
  };
}

function readTypedCoordinates(text) {
  if (/[a-z]/i.test(text)) return null;
  const match = text.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[, ]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const a = Number(match[1].replace(",", "."));
  const b = Number(match[2].replace(",", "."));
  const rd = asRd(a, b);
  if (rd) return { ...rd, label: "Coördinaten" };
  const geographic = asDutchLatLon(a, b);
  if (geographic) return { ...geographic, label: "Coördinaten" };
  throw new Error("Die coördinaten liggen buiten Nederland.");
}

function asRd(a, b) {
  const easting = (value) => value >= -7000 && value <= 300000;
  const northing = (value) => value >= 289000 && value <= 629000;
  if (easting(a) && northing(b)) return { x: a, y: b };
  if (northing(a) && easting(b)) return { x: b, y: a };
  return null;
}

function asDutchLatLon(a, b) {
  const latitude = (value) => value >= 50.5 && value <= 53.7;
  const longitude = (value) => value >= 3.2 && value <= 7.3;
  if (latitude(a) && longitude(b)) return wgs84ToRd(a, b);
  if (longitude(a) && latitude(b)) return wgs84ToRd(b, a);
  return null;
}

function wgs84ToRd(lat, lon) {
  const dphi = 0.36 * (lat - 52.1551744);
  const dlam = 0.36 * (lon - 5.38720621);
  const east = [
    [0, 1, 190094.945],
    [1, 1, -11832.228],
    [2, 1, -114.221],
    [0, 3, -32.391],
    [1, 0, -0.705],
    [3, 1, -2.340],
    [1, 3, -0.608],
    [0, 2, -0.008],
    [2, 3, 0.148],
  ];
  const north = [
    [1, 0, 309056.544],
    [0, 2, 3638.893],
    [2, 0, 73.077],
    [1, 2, -157.984],
    [3, 0, 59.788],
    [0, 1, 0.433],
    [2, 2, -6.439],
    [1, 1, -0.032],
    [0, 4, 0.092],
    [1, 4, -0.054],
  ];
  let x = 155000;
  let y = 463000;
  for (const [powerLat, powerLon, factor] of east) x += factor * dphi ** powerLat * dlam ** powerLon;
  for (const [powerLat, powerLon, factor] of north) y += factor * dphi ** powerLat * dlam ** powerLon;
  return { x, y };
}

function queryTokens(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !/^\d+$/.test(word));
}

function bestPdok(text, docs) {
  const tokens = queryTokens(text);
  if (!tokens.length) return null;
  const longest = tokens.reduce((left, right) => (right.length > left.length ? right : left));
  let best = null;
  let hits = 0;
  for (const doc of docs) {
    const name = String(doc.weergavenaam || "").toLowerCase();
    const matched = tokens.filter((token) => name.includes(token)).length;
    if (matched > hits) {
      best = doc;
      hits = matched;
    }
  }
  if (!best || !String(best.weergavenaam).toLowerCase().includes(longest)) return null;
  const point = String(best.centroide_rd || "").match(/POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/);
  if (!point) return null;
  return { x: Number(point[1]), y: Number(point[2]), label: best.weergavenaam };
}

async function searchPdok(text) {
  const url = new URL("https://api.pdok.nl/bzk/locatieserver/search/v3_1/free");
  url.searchParams.set("q", text);
  url.searchParams.set("rows", "5");
  url.searchParams.set("fl", "weergavenaam,centroide_rd,type,score");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Plaats zoeken mislukt.");
  const data = await response.json();
  return bestPdok(text, data.response?.docs || []);
}

async function searchNominatim(text) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", text);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "nl");
  const response = await fetch(url, { headers: { "Accept-Language": "nl" } });
  if (!response.ok) throw new Error("Plaats zoeken mislukt.");
  const data = await response.json();
  const hit = data[0];
  if (!hit) return null;
  const point = wgs84ToRd(Number(hit.lat), Number(hit.lon));
  return { ...point, label: hit.name || hit.display_name };
}

function samePoint(place) {
  if (!view) return false;
  return Math.round(place.x) === Math.round(view.x) && Math.round(place.y) === Math.round(view.y);
}

function unlockMovie() {
  const wandered = browsingLocal;
  loadId += 1;
  activeAbort?.abort();
  loading = false;
  recording = false;
  packing = false;
  cancelPlayback();
  frames = [];
  frameIndex = 0;
  cancelViewFetch();
  browsingLocal = false;
  dropBrowseHold();
  layerSplit = 1;
  hasPresented = false;
  scrub.value = "0";
  scrub.max = "0";
  clearPlan();
  clearCacheOnNextGesture = true;
  setInteractive(true);
  if (wandered) writeFields();
  syncControls();
}

function applyLocatedPlace(place) {
  const earliest = knownEditions[0].start;
  const latest = knownEditions[knownEditions.length - 1].end;
  const moved = !samePoint(place);
  if (moved) {
    unlockMovie();
    session.movie = null;
    session.frameIndex = 0;
    resetVanTot();
  }
  view = { year: latest, x: place.x, y: place.y, zoom: place.zoom ?? 9 };
  clampZoom();
  if (knownEditions?.length) fillRangeSelects(knownEditions);
  writeFields();
  if (interactive && !loading) {
    previewEdition = sheetForYear(knownEditions, view.year);
    showPreview();
  }
  const where = `${Math.round(place.x)}, ${Math.round(place.y)}`;
  const movedNote = moved ? " Van en tot gereset. Kaart hersteld." : "";
  const rangeNote = session.rangeSet ? ` · ${earliest}–${latest}` : " · kies Van en Tot";
  setStatus(`${place.label} · ${where} · zoom ${view.zoom}${rangeNote}.${movedNote}`);
}

function syncChrome() {
  const locked = !interactive;
  const failed = locked && !loading && frames.length === 0;
  const header = document.querySelector("#setup-header");
  const title = document.querySelector(".title");
  const fields = document.querySelector("#setup-fields");
  const bar = document.querySelector("#locked-bar");
  const form = document.querySelector("#form");
  const label = document.querySelector("#locked-label");
  header.hidden = locked && !failed;
  title.hidden = locked;
  fields.hidden = locked;
  bar.hidden = !locked;
  form.classList.toggle("is-locked", locked);
  if (locked) {
    const from = fromInput.value;
    const to = toInput.value;
    label.textContent = from && to ? `Tijdreis ${from} tot ${to}` : "Tijdreis";
    if (helpOpen.parentElement !== bar.querySelector(".locked-title")) {
      bar.querySelector(".locked-title").appendChild(helpOpen);
    }
  } else if (helpOpen.parentElement !== title) {
    title.appendChild(helpOpen);
  }
  fitPage();
}

function setInteractive(on) {
  interactive = on;
  canvas.classList.toggle("interactive", on);
  if (!on) canvas.classList.remove("dragging");
  syncChrome();
  syncWipeBars();
}

function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  drag = null;
  canvas.classList.remove("dragging");
}

function canvasScale() {
  const rect = canvas.getBoundingClientRect();
  return {
    x: rect.width ? WIDTH / rect.width : 1,
    y: rect.height ? HEIGHT / rect.height : 1,
  };
}

function groundResolution() {
  const res0 = mapInfo?.res0 || GRID_RES0;
  return res0 / 2 ** view.zoom;
}

function canLocalBrowse() {
  return frames.length > 0 && !interactive && !loading && !recording && !packing;
}

function captureBrowseHold() {
  browseHoldCtx.setTransform(1, 0, 0, 1, 0, 0);
  browseHoldCtx.drawImage(canvas, 0, 0);
  browseOrigin = { x: view.x, y: view.y, zoom: view.zoom };
  browseFrame = frameIndex;
}

function dropBrowseHold() {
  browseOrigin = null;
  browseHoldCtx.setTransform(1, 0, 0, 1, 0, 0);
  browseHoldCtx.clearRect(0, 0, WIDTH, HEIGHT);
}

function beginLocalBrowse() {
  if (interactive || !canLocalBrowse()) return false;
  if (!browsingLocal) {
    cancelPlayback();
    captureBrowseHold();
    browsingLocal = true;
    setStatus("Zoomen en slepen gebruikt de opgeslagen tegels.");
  }
  return true;
}

function leaveLocalBrowse() {
  if (!browsingLocal) return;
  cancelViewFetch();
  browsingLocal = false;
  localSerial += 1;
  localQueue.length = 0;
  localInflight.clear();
  const home = session.movie?.view;
  if (home && view) {
    view.x = home.x;
    view.y = home.y;
    view.zoom = home.zoom;
  }
  dropBrowseHold();
  canvas.classList.remove("dragging");
}

function anchoredView() {
  const home = browsingLocal ? session.movie?.view : null;
  if (home && Number.isFinite(home.x) && Number.isFinite(home.y) && Number.isFinite(home.zoom)) {
    return { ...view, year: home.year ?? view.year, x: home.x, y: home.y, zoom: home.zoom };
  }
  return view;
}

function gridAt(level, origin) {
  const point = origin || SAT_ORIGIN;
  const resolution = GRID_RES0 / 2 ** level;
  return {
    originX: point.x,
    originY: point.y,
    tileSize: GRID_TILE,
    lods: [{ level, resolution }],
    level,
    resolution,
    res0: GRID_RES0,
    maxLevel: level,
  };
}

function storedTiles(level, origin) {
  const grid = gridAt(level, origin);
  return { grid, tiles: tilesFor(viewBounds(view, grid), grid) };
}

function drawLevels(kind) {
  const stored = [...sheetLevels[kind]].sort((a, b) => a - b);
  if (!stored.length || !view) return [];
  const wanted = Math.round(view.zoom);
  const near = stored.filter((level) => level >= wanted - 4 && level <= wanted + 2);
  if (near.length) return near;
  const closest = stored.reduce((best, level) => (
    Math.abs(level - wanted) < Math.abs(best - wanted) ? level : best
  ), stored[0]);
  return closest <= wanted + 3 ? [closest] : [];
}

function sourcedEdition(items, year) {
  let chosen = null;
  for (const item of savedPlan(items)) {
    if (item.edition.end > year) break;
    if (item.state === "grey") continue;
    chosen = item.edition;
  }
  return chosen;
}

function editionsForYear(year) {
  return {
    map: sourcedEdition(session.movie?.mapPlan, year),
    sat: sourcedEdition(session.movie?.satPlan, year),
  };
}

function paintHeld() {
  if (!browseOrigin || frameIndex !== browseFrame) return;
  const res = groundResolution();
  const holdRes = GRID_RES0 / 2 ** browseOrigin.zoom;
  const scale = holdRes / res;
  const dx = (browseOrigin.x - view.x) / res;
  const dy = (view.y - browseOrigin.y) / res;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e7dcc4";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const w = WIDTH * scale;
  const h = HEIGHT * scale;
  ctx.drawImage(browseHold, WIDTH / 2 + dx - w / 2, HEIGHT / 2 + dy - h / 2, w, h);
}

function drawCachedSide(context, edition, levels, origin, label, credit, kind, reveal, note) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  if (!edition) {
    drawMissing(context, kind);
    stamp(label, context, credit, note);
    return -1;
  }
  const layers = levels.map((level) => ({ level, ...storedTiles(level, origin) }));
  let drawn = 0;
  for (const { level, tiles } of layers) {
    for (const tile of tiles) {
      if (previewTiles.has(tileKey(edition, level, tile))) drawn += 1;
    }
  }
  if (!drawn) {
    if (!reveal) return 0;
    context.fillStyle = "#e7dcc4";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    stamp(label, context, credit, note);
    return -1;
  }
  context.fillStyle = "#e7dcc4";
  context.fillRect(0, 0, WIDTH, HEIGHT);
  for (const { level, grid, tiles } of layers) {
    const bounds = viewBounds(view, grid);
    for (const tile of tiles) {
      blitTile(context, previewTiles.get(tileKey(edition, level, tile)), tile, bounds, grid);
    }
  }
  stamp(label, context, credit, note);
  return drawn;
}

function renderLocalLayers(index = frameIndex, reveal = false) {
  const frame = frames[index];
  if (!frame || !view) return false;
  const year = Number(frame.label);
  const editions = editionsForYear(year);
  const mapN = drawCachedSide(
    mapBlendCtx,
    editions.map,
    drawLevels("map"),
    sheetOrigin.map,
    frame.label,
    "Kadaster / Topotijdreis",
    "map",
    reveal,
    frameNotes(frame),
  );
  const satN = drawCachedSide(
    satBlendCtx,
    editions.sat,
    drawLevels("sat"),
    sheetOrigin.sat,
    frame.label,
    frame.satCredit || "Beeldmateriaal.nl / Kadaster",
    "picture",
    reveal,
    frameNotes(frame),
  );
  return mapN !== 0 || satN !== 0;
}

function paintLocal(reveal = false) {
  if (!renderLocalLayers(frameIndex, reveal)) {
    if (frameIndex === browseFrame) paintHeld();
    return;
  }
  drawLayerSplit(layerDrag ? layerDrag.split : layerSplit, false);
}

async function loadCachedTile(edition, info, tile) {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(tileUrl(edition, info, tile));
    if (!hit) return null;
    const buffer = await hit.arrayBuffer();
    if (!buffer.byteLength) return null;
    return await createImageBitmap(new Blob([buffer], { type: imageType(buffer) }));
  } catch {
    return null;
  }
}

async function ensureSheetLevel(kind, edition) {
  if (!edition) return null;
  if (sheetLevels[kind].size) return null;
  if (!("caches" in window)) return null;
  const anchor = session.movie?.view || view;
  if (!anchor) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    let centerOnly = null;
    for (let level = 19; level >= 0; level -= 1) {
      const grid = gridAt(level, sheetOrigin[kind]);
      const span = grid.resolution * grid.tileSize;
      const col = Math.floor((anchor.x - grid.originX) / span);
      const row = Math.floor((grid.originY - anchor.y) / span);
      const center = await cache.match(tileUrl(edition, grid, { row, col }));
      if (!center) continue;
      if (centerOnly == null) centerOnly = level;
      const neighbor = await cache.match(tileUrl(edition, grid, { row: row + 1, col: col + 1 }));
      if (neighbor) return rememberSheetLevel(kind, level);
    }
    if (centerOnly != null) return rememberSheetLevel(kind, centerOnly);
  } catch {
    return null;
  }
  return null;
}

function levelsRecord() {
  return {
    map: [...sheetLevels.map].sort((a, b) => a - b),
    sat: [...sheetLevels.sat].sort((a, b) => a - b),
    mapOrigin: sheetOrigin.map,
    satOrigin: sheetOrigin.sat,
  };
}

function rememberSheetLevel(kind, level) {
  if (sheetLevels[kind].has(level)) return level;
  sheetLevels[kind].add(level);
  if (session.movie) {
    session.movie = { ...session.movie, levels: levelsRecord() };
    rememberSettings();
  }
  return level;
}

function readLevels(value) {
  const list = Array.isArray(value) ? value : [value];
  return new Set(list.map(Number).filter(Number.isFinite));
}

function queueVisibleTiles(year) {
  const editions = editionsForYear(year);
  const jobs = [
    [editions.map, drawLevels("map"), sheetOrigin.map],
    [editions.sat, drawLevels("sat"), sheetOrigin.sat],
  ];
  const wanted = new Set();
  for (const job of localQueue) localInflight.delete(job.key);
  localQueue.length = 0;
  for (const [edition, levels, origin] of jobs) {
    if (!edition) continue;
    for (const level of levels) {
      const { grid, tiles } = storedTiles(level, origin);
      for (const tile of tiles) {
        const key = tileKey(edition, level, tile);
        wanted.add(key);
        if (previewTiles.has(key) || localInflight.has(key) || localMisses.has(key)) continue;
        localInflight.add(key);
        localQueue.push({ key, edition, grid, tile, year, serial: localSerial });
      }
    }
  }
  for (const [key, bitmap] of previewTiles) {
    if (!wanted.has(key)) {
      bitmap.close();
      previewTiles.delete(key);
    }
  }
  pumpLocal();
}

function pumpLocal() {
  while (localFetches < 6 && localQueue.length) {
    const job = localQueue.shift();
    localFetches += 1;
    loadCachedTile(job.edition, job.grid, job.tile)
      .then((bitmap) => {
        const live = frames[frameIndex];
        const year = Number(live?.label);
        const editions = Number.isFinite(year) ? editionsForYear(year) : null;
        const still = editions && (editions.map?.name === job.edition.name || editions.sat?.name === job.edition.name);
        if (job.serial !== localSerial || !browsingLocal || !still) {
          bitmap?.close();
          return;
        }
        if (bitmap) previewTiles.set(job.key, bitmap);
        else localMisses.add(job.key);
      })
      .finally(() => {
        localFetches -= 1;
        localInflight.delete(job.key);
        if (browsingLocal && job.serial === localSerial) {
          paintLocal(localFetches === 0 && localQueue.length === 0);
        }
        pumpLocal();
      });
  }
}

function requestLocalTiles(index = frameIndex) {
  if (!browsingLocal || recording || packing) return;
  const frame = frames[index];
  if (!frame) return;
  const serial = localSerial;
  const year = Number(frame.label);
  const editions = editionsForYear(year);
  const probeSat = editions.sat || sourcedEdition(session.movie?.satPlan, 9999);
  const probeMap = editions.map || sourcedEdition(session.movie?.mapPlan, 9999);
  Promise.all([
    ensureSheetLevel("map", probeMap),
    ensureSheetLevel("sat", probeSat),
  ]).then(() => {
    if (serial !== localSerial || !browsingLocal) return;
    if (Number(frames[frameIndex]?.label) !== year) return;
    queueVisibleTiles(year);
    if (!localQueue.length && localFetches === 0) paintLocal(true);
  });
}

function followView() {
  if (interactive) {
    writeFields();
    paintPreview();
    requestTiles();
    return;
  }
  if (!browsingLocal) return;
  paintLocal(false);
  requestLocalTiles();
  scheduleViewFetch();
}

function cancelViewFetch() {
  clearTimeout(viewFetchTimer);
  viewFetchTimer = null;
  viewFetchId += 1;
  viewFetchAbort?.abort();
  viewFetchAbort = null;
  if (fetchingView) {
    fetchingView = false;
    syncControls();
  }
}

function scheduleViewFetch() {
  cancelViewFetch();
  if (!browsingLocal) return;
  viewFetchTimer = setTimeout(() => {
    viewFetchTimer = null;
    fetchViewTiles();
  }, VIEW_FETCH_DELAY);
}

function filmEditions(items) {
  return savedPlan(items).filter((item) => item.state !== "grey").map((item) => item.edition);
}

async function storeTile(url, signal, epoch) {
  const cache = await caches.open(CACHE_NAME);
  if (await cache.match(url)) return false;
  const response = await fetch(url, { signal });
  if (!response.ok || epoch !== cacheEpoch) return false;
  await cache.put(url, response);
  return true;
}

async function fetchViewTiles() {
  if (!browsingLocal || !canLocalBrowse() || !("caches" in window) || !frames.length) return;
  const myId = ++viewFetchId;
  const abort = new AbortController();
  viewFetchAbort = abort;
  const signal = abort.signal;
  const epoch = cacheEpoch;
  const live = () => myId === viewFetchId && browsingLocal && !signal.aborted;
  const place = { x: view.x, y: view.y, zoom: view.zoom };
  const current = editionsForYear(Number(frames[frameIndex]?.label));
  const layers = [
    { kind: "map", name: "Kaart", bar: mapBar, editions: filmEditions(session.movie?.mapPlan), current: current.map },
    { kind: "sat", name: "Foto's", bar: satBar, editions: filmEditions(session.movie?.satPlan), current: current.sat },
  ].filter((layer) => layer.editions.length);
  if (!layers.length) return;

  try {
    for (const layer of layers) {
      if (!viewInfo[layer.kind]) viewInfo[layer.kind] = await loadTileInfo(layer.editions[0], signal);
      if (!live()) return;
      const info = viewInfo[layer.kind];
      layer.level = levelForZoom(place.zoom, info.maxLevel);
      layer.grid = gridAt(layer.level, sheetOrigin[layer.kind]);
      layer.tiles = tilesFor(viewBounds(place, layer.grid), layer.grid);
      layer.plan = layer.editions.map((edition) => ({ edition, state: "wait", left: layer.tiles.length }));
    }
    if (frames.length) {
      const start = Number(frames[0].label);
      const end = Number(frames.at(-1).label);
      if (Number.isFinite(start) && Number.isFinite(end)) barSpan = { start, end };
    }
    fetchingView = true;
    syncControls();

    const jobs = [];
    for (const layer of layers) {
      for (const item of layer.plan) {
        for (const tile of layer.tiles) jobs.push({ layer, item, tile });
      }
    }
    jobs.sort((a, b) => (
      (b.item.edition.name === b.layer.current?.name) - (a.item.edition.name === a.layer.current?.name)
    ));
    const total = jobs.length;
    let done = 0;
    let added = 0;
    let painted = false;
    let refresh = null;
    const paint = () => {
      painted = false;
      if (!live() || !fetchingView) return;
      for (const layer of layers) paintPlan(layer.bar, layer.plan, layer.name);
      setStatus(`Tegels voor dit beeld ophalen: ${done} van ${total} · ${added} nieuw`);
    };
    const refreshView = () => {
      refresh = null;
      if (!live()) return;
      localMisses.clear();
      requestLocalTiles();
    };
    paint();

    for (const layer of layers) rememberSheetLevel(layer.kind, layer.level);

    await mapPool(jobs, 8, async ({ layer, item, tile }) => {
      if (!live()) return;
      let stored = false;
      try {
        stored = await storeTile(tileUrl(item.edition, layer.grid, tile), signal, epoch);
      } catch (error) {
        if (error.name === "AbortError") throw error;
      }
      if (!live()) return;
      done += 1;
      if (stored) added += 1;
      item.left -= 1;
      if (item.left <= 0) item.state = "green";
      else if (item.state === "wait") item.state = "red";
      const showing = editionsForYear(Number(frames[frameIndex]?.label));
      const visible = showing.map?.name === item.edition.name || showing.sat?.name === item.edition.name;
      if (stored && visible && !refresh) refresh = setTimeout(refreshView, 250);
      if (!painted) {
        painted = true;
        requestAnimationFrame(paint);
      }
    });
    if (!live()) return;
    clearTimeout(refresh);
    refreshView();
    fetchingView = false;
    syncControls();
    setStatus(added
      ? `${added} tegel${added === 1 ? "" : "s"} voor dit beeld opgeslagen.`
      : "Alle tegels voor dit beeld staan al in deze browser.");
  } catch (error) {
    if (error.name === "AbortError" || myId !== viewFetchId) return;
    fetchingView = false;
    syncControls();
    setStatus(error.message || "Kon de tegels voor dit beeld niet ophalen.");
  } finally {
    if (viewFetchAbort === abort) viewFetchAbort = null;
  }
}

function panByPixels(cssDx, cssDy) {
  if (!view) return;
  if (!interactive && !beginLocalBrowse()) return;
  const scale = canvasScale();
  const res = groundResolution();
  view.x -= cssDx * scale.x * res;
  view.y += cssDy * scale.y * res;
  followView();
}

function zoomAtPoint(px, py, step) {
  if (!view) return;
  if (interactive) {
    if (!mapInfo) return;
  } else if (!beginLocalBrowse()) return;
  const before = groundResolution();
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom - step));
  const after = groundResolution();
  const mapX = view.x + (px - WIDTH / 2) * before;
  const mapY = view.y - (py - HEIGHT / 2) * before;
  view.x = mapX - (px - WIDTH / 2) * after;
  view.y = mapY + (py - HEIGHT / 2) * after;
  clampZoom();
  followView();
}

function zoomAtCenter(step) {
  zoomAtPoint(WIDTH / 2, HEIGHT / 2, step);
}

function zoomAt(event) {
  const scale = canvasScale();
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * scale.x;
  const py = (event.clientY - rect.top) * scale.y;
  const step = Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 120) * 0.004;
  zoomAtPoint(px, py, step);
}

function onViewGesture() {
  if (!clearCacheOnNextGesture) return;
  clearCacheOnNextGesture = false;
  clearSavedTiles().then(() => {
    if (interactive) setStatus("Opgeslagen tegels gewist.");
  });
}

async function clearSavedTiles() {
  cacheEpoch += 1;
  clearPreviewTiles();
  if (!("caches" in window)) return 0;
  let removed = 0;
  try {
    const names = await caches.keys();
    for (const name of names) {
      if (!name.startsWith("topotijdreis-tiles")) continue;
      const cache = await caches.open(name);
      const keys = await cache.keys();
      removed += keys.length;
      await Promise.all(keys.map((key) => cache.delete(key)));
      await caches.delete(name);
    }
  } catch {
    // The next fetch still works without the store.
  }
  return removed;
}

function lodForZoom(zoom) {
  const cap = Math.min(mapInfo.maxLevel, previewEdition?.maxLevel ?? mapInfo.maxLevel);
  const level = Math.max(0, Math.min(cap, Math.floor(zoom)));
  return mapInfo.lods.find((lod) => lod.level === level) || mapInfo.lods.at(-1);
}

function tileKey(edition, level, tile) {
  return `${edition.name}/${level}/${tile.row}/${tile.col}`;
}

function paintPreview() {
  if (!interactive || !view) return;
  ctx.fillStyle = "#e7dcc4";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (!mapInfo || !previewEdition) {
    yearEl.textContent = String(view.year);
    return;
  }
  const lod = lodForZoom(view.zoom);
  const grid = { ...mapInfo, level: lod.level, resolution: lod.resolution };
  const bounds = viewBounds(view, mapInfo);
  const tiles = tilesFor(bounds, grid);
  const span = lod.resolution * mapInfo.tileSize;
  for (const tile of tiles) {
    const bitmap = previewTiles.get(tileKey(previewEdition, lod.level, tile));
    if (!bitmap) continue;
    const left = mapInfo.originX + tile.col * span;
    const top = mapInfo.originY - tile.row * span;
    ctx.drawImage(
      bitmap,
      (left - bounds.xmin) / bounds.res,
      (bounds.ymax - top) / bounds.res,
      span / bounds.res,
      span / bounds.res,
    );
  }
  ctx.save();
  ctx.font = "16px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillStyle = "rgba(28, 25, 22, 0.75)";
  ctx.fillText("Sleep · knijp of scroll om te zoomen", 28, HEIGHT - 26);
  ctx.restore();
  yearEl.textContent = previewEdition.label;
}

function requestTiles() {
  if (!interactive || !mapInfo || !previewEdition) return;
  const lod = lodForZoom(view.zoom);
  const grid = { ...mapInfo, level: lod.level, resolution: lod.resolution };
  const tiles = tilesFor(viewBounds(view, mapInfo), grid);
  for (const tile of tiles) {
    const key = tileKey(previewEdition, lod.level, tile);
    if (previewTiles.has(key) || inflight.has(key)) continue;
    inflight.add(key);
    fetchQueue.push({ key, tile, grid, edition: previewEdition, epoch: previewEpoch });
  }
  pumpQueue();
}

function pumpQueue() {
  while (activeFetches < 6 && fetchQueue.length) {
    const job = fetchQueue.shift();
    activeFetches += 1;
    loadTileBitmap(job.edition, job.grid, job.tile, undefined, false)
      .then((bitmap) => {
        if (bitmap && job.epoch === previewEpoch) previewTiles.set(job.key, bitmap);
        else bitmap?.close();
      })
      .finally(() => {
        activeFetches -= 1;
        inflight.delete(job.key);
        paintPreview();
        pumpQueue();
      });
  }
}

function resetView() {
  unlockMovie();
  previewEdition = sheetForYear(knownEditions, view.year);
  paintPreview();
  requestTiles();
  setStatus("Kaart vrijgegeven. De volgende pan of zoom wist opgeslagen tegels.");
}

function clearPreviewTiles() {
  previewEpoch += 1;
  localSerial += 1;
  localQueue.length = 0;
  localInflight.clear();
  localMisses.clear();
  for (const bitmap of previewTiles.values()) bitmap.close();
  previewTiles.clear();
  inflight.clear();
  fetchQueue.length = 0;
}

async function showPreview() {
  const token = ++sourceToken;
  clearPreviewTiles();
  if (!interactive || !view) return;
  if (!previewEdition) {
    paintPreview();
    return;
  }
  try {
    const source = usingSatellite() ? "satellite" : "map";
    if (!mapInfo || infoSource !== source) {
      mapInfo = await loadTileInfo(previewEdition);
      if (token !== sourceToken) return;
      infoSource = source;
    }
    paintPreview();
    requestTiles();
  } catch (error) {
    if (token === sourceToken) setStatus(error.message || "Kon het beeldmateriaal niet openen.");
  }
}

async function switchSource() {
  const token = ++sourceToken;
  clearPreviewTiles();
  try {
    const editions = await discoverEditions();
    if (token !== sourceToken) return;
    if (!interactive || loading) {
      infoSource = "";
      setStatus(usingSatellite()
        ? "Satellietfoto's worden gebruikt bij de volgende keer laden."
        : "Kaarten worden gebruikt bij de volgende keer laden.");
      return;
    }
    previewEdition = sheetForYear(editions, view.year);
    if (!previewEdition) {
      paintPreview();
      const first = editions[0]?.start;
      const last = editions.at(-1)?.end;
      setStatus(usingSatellite()
        ? `Geen satellietfoto voor dit jaar. Foto's lopen van ${first} tot ${last}.`
        : "Geen kaart voor dit jaar.");
      return;
    }
    mapInfo = await loadTileInfo(previewEdition);
    if (token !== sourceToken) return;
    infoSource = "map";
    paintPreview();
    requestTiles();
    setStatus(usingSatellite() ? "Satellietfoto's tonen." : "Topografische kaarten tonen.");
  } catch (error) {
    if (token !== sourceToken) return;
    setStatus(error.message || "Kon het beeldmateriaal niet wisselen.");
  }
}

const SETTINGS_KEY = "topotijdreis-session";
const MOVIE_DB = "topotijdreis-session";

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  } catch {
    return null;
  }
}

function pullFormIntoSession() {
  session.from = fromInput.value;
  session.to = toInput.value;
  session.hold = holdInput.value;
  session.linear = false;
  session.satellite = usingSatellite();
  session.rangeSet = true;
}

function rememberSettings() {
  if (!view || !persistReady) return;
  if (!session.movie) {
    const previous = readSettings();
    if (previous?.movie) session.movie = previous.movie;
  }
  const frameAt = frames.length ? frameIndex : (session.frameIndex || 0);
  session.frameIndex = frameAt;
  if (session.movie) session.movie = { ...session.movie, frameIndex: frameAt };
  const storedView = anchoredView();
  const data = {
    view: { year: storedView.year, x: storedView.x, y: storedView.y, zoom: storedView.zoom },
    from: session.from,
    to: session.to,
    hold: session.hold,
    linear: false,
    satellite: session.satellite,
    split: layerSplit,
    frameIndex: frameAt,
    rangeSet: session.rangeSet === true,
    movie: session.movie,
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // A full browser store should not stop the map.
  }
}

function sameView(left, right) {
  if (!left || !right) return false;
  return Math.round(left.x) === Math.round(right.x)
    && Math.round(left.y) === Math.round(right.y)
    && Math.round(left.zoom * 100) === Math.round(right.zoom * 100);
}

function samePlace(left, right, fromLeft, fromRight, toLeft, toRight) {
  return sameView(left, right)
    && String(fromLeft ?? "") === String(fromRight ?? "")
    && String(toLeft ?? "") === String(toRight ?? "");
}

function loadSession(data) {
  const stored = data?.view;
  if (!stored) return false;
  const year = Number(stored.year);
  const x = Number(stored.x);
  const y = Number(stored.y);
  const zoom = Number(stored.zoom);
  if (![year, x, y, zoom].every(Number.isFinite)) return false;
  view = { year, x, y, zoom };
  session = {
    from: data.from ?? "",
    to: data.to ?? "",
    hold: data.hold ?? "800",
    linear: false,
    satellite: Boolean(data.satellite),
    frameIndex: Number.isFinite(Number(data.frameIndex)) ? Number(data.frameIndex) : 0,
    rangeSet: data.rangeSet === true,
    movie: data.movie || null,
  };
  const storedSplit = Number(data.split);
  layerSplit = Number.isFinite(storedSplit)
    ? Math.min(1, Math.max(0, storedSplit))
    : (session.satellite ? 0 : 1);
  session.satellite = layerSplit < 0.5;
  if (
    !session.rangeSet
    && session.movie
    && session.from === ""
    && session.to === ""
    && sameView(view, session.movie.view)
  ) {
    session.from = String(session.movie.from ?? "");
    session.to = String(session.movie.to ?? "");
    session.rangeSet = true;
  }
  return true;
}

function openMovieDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MOVIE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("movie")) {
        request.result.createObjectStore("movie");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeMovieRecord(record) {
  const db = await openMovieDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction("movie", "readwrite");
    tx.objectStore("movie").put(record, "current");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readMovieRecord() {
  const db = await openMovieDb();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction("movie", "readonly");
    const request = tx.objectStore("movie").get("current");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}

function packFrames(items) {
  const blobs = [];
  const ids = new Map();
  const idOf = (blob) => {
    if (!blob) return null;
    if (ids.has(blob)) return ids.get(blob);
    const id = blobs.length;
    blobs.push(blob);
    ids.set(blob, id);
    return id;
  };
  return {
    blobs,
    frames: items.map((item) => ({
      label: item.label,
      map: idOf(item.map),
      satellite: idOf(item.satellite),
      satCredit: item.satCredit || null,
      mapYear: item.mapYear != null && Number.isFinite(Number(item.mapYear)) ? Number(item.mapYear) : null,
      satYear: item.satYear != null && Number.isFinite(Number(item.satYear)) ? Number(item.satYear) : null,
    })),
  };
}

function unpackFrames(record) {
  const blobs = record?.blobs || [];
  return (record?.frames || []).map((item) => ({
    label: item.label,
    map: item.map == null ? null : blobs[item.map] || null,
    satellite: item.satellite == null ? null : blobs[item.satellite] || null,
    satCredit: item.satCredit || null,
    mapYear: item.mapYear != null && Number.isFinite(Number(item.mapYear)) ? Number(item.mapYear) : null,
    satYear: item.satYear != null && Number.isFinite(Number(item.satYear)) ? Number(item.satYear) : null,
  }));
}

async function saveMovie(mapPlan, satPlan, statusText) {
  session.frameIndex = frameIndex;
  session.rangeSet = true;
  const storedView = anchoredView();
  const levels = levelsRecord();
  session.movie = {
    view: { year: storedView.year, x: storedView.x, y: storedView.y, zoom: storedView.zoom },
    from: session.from,
    to: session.to,
    frameIndex,
    status: statusText,
    levels,
    mapPlan: mapPlan.map((item) => ({
      label: item.edition.label,
      name: item.edition.name,
      start: item.edition.start,
      end: item.edition.end,
      state: item.state,
    })),
    satPlan: satPlan.map((item) => ({
      label: item.edition.label,
      name: item.edition.name,
      start: item.edition.start,
      end: item.edition.end,
      state: item.state,
    })),
  };
  rememberSettings();
  try {
    await writeMovieRecord(packFrames(frames));
  } catch {
    setStatus(`${statusText} De beelden konden niet voor het volgende bezoek worden bewaard.`);
  }
}

function editionFromSaved(item) {
  const label = String(item.label || "");
  const match = label.match(/(\d{4})\D*(\d{4})?/);
  const start = Number.isFinite(item.start) ? item.start : (match ? Number(match[1]) : NaN);
  const end = Number.isFinite(item.end) ? item.end : (match ? Number(match[2] || match[1]) : NaN);
  const name = item.name || label;
  const utrecht = UTRECHT_LAYERS.some(([, layer]) => layer === name);
  return {
    name,
    label,
    start,
    end,
    base: utrecht ? UTRECHT_BASE : undefined,
    credit: utrecht ? UTRECHT_CREDIT : undefined,
  };
}

function restorePlans(movie) {
  if (frames.length) {
    const start = Number(frames[0].label);
    const end = Number(frames.at(-1).label);
    if (Number.isFinite(start) && Number.isFinite(end)) barSpan = { start, end };
  } else if (movie.from !== "" && movie.to !== "") {
    const start = Number(movie.from);
    const end = Number(movie.to);
    if (Number.isFinite(start) && Number.isFinite(end)) barSpan = { start, end };
  }
  const toPlan = (items) => (items || []).map((item) => {
    const edition = editionFromSaved(item);
    return { edition, state: item.state || "grey" };
  }).filter((item) => Number.isFinite(item.edition.start) && Number.isFinite(item.edition.end));
  const mapItems = toPlan(movie.mapPlan);
  const satItems = toPlan(movie.satPlan);
  paintPlan(mapBar, mapItems, "Kaart", mapItems.map((item) => item.edition));
  paintPlan(satBar, satItems, "Foto's", satItems.map((item) => item.edition));
}

function reapplySession() {
  if (!view) return;
  const focused = document.activeElement;
  const editing = focused && focused.matches && focused.matches("input, select, textarea");
  const saved = persistReady;
  persistReady = false;
  if (focused !== yearSelect) {
    ensureYearOption(view.year);
    yearSelect.value = String(view.year);
  }
  coordsInput.value = formatCoords(view.x, view.y);
  zoomInput.value = String(Math.round(view.zoom * 1000) / 1000);
  if (!editing || focused !== fromInput) fromInput.value = session.from;
  if (!editing || focused !== toInput) toInput.value = session.to;
  if (focused !== holdInput && [...holdInput.options].some((option) => option.value === String(session.hold))) {
    holdInput.value = String(session.hold);
  }
  persistReady = saved;
}

const SHARE_KEYS = ["x", "y", "z", "jaar", "van", "tot", "sat", "lijn", "split", "tempo", "plaats"];
let openedFromShare = false;

function readShareSetup() {
  const params = new URLSearchParams(location.search);
  if (!params.has("x") || !params.has("y") || !params.has("z")) return null;
  const x = Number(params.get("x"));
  const y = Number(params.get("y"));
  const zoom = Number(params.get("z"));
  if (![x, y, zoom].every(Number.isFinite)) return null;
  const year = Number(params.get("jaar"));
  const from = params.get("van") || "";
  const to = params.get("tot") || "";
  const yearOk = (value) => /^\d{4}$/.test(value);
  const tempo = params.get("tempo");
  return {
    view: {
      year: Number.isFinite(year) ? year : DEFAULT_VIEW.year,
      x,
      y,
      zoom,
    },
    from: yearOk(from) ? from : "",
    to: yearOk(to) ? to : "",
    satellite: params.has("split")
      ? Number(params.get("split")) < 0.5
      : params.get("sat") === "1",
    split: params.has("split") ? Number(params.get("split")) : (params.has("sat") ? (params.get("sat") === "1" ? 0 : 1) : null),
    linear: false,
    hold: tempo === "400" || tempo === "800" || tempo === "1500" ? tempo : null,
    place: (params.get("plaats") || "").slice(0, 120),
  };
}

function applyShareSetup(setup) {
  view = setup.view;
  clampZoom();
  session.from = setup.from;
  session.to = setup.to;
  session.rangeSet = setup.from !== "" && setup.to !== "";
  session.satellite = setup.satellite;
  session.linear = false;
  if (setup.split != null && Number.isFinite(setup.split)) {
    layerSplit = Math.min(1, Math.max(0, setup.split));
    session.satellite = layerSplit < 0.5;
  } else if (setup.satellite) {
    layerSplit = 0;
  }
  if (setup.hold) session.hold = setup.hold;
  if (setup.place) placeInput.value = setup.place;
}

function shareSetupUrl() {
  const url = new URL(location.href);
  for (const key of SHARE_KEYS) url.searchParams.delete(key);
  const round = (value, digits) => String(Math.round(value * (10 ** digits)) / (10 ** digits));
  url.searchParams.set("x", round(view.x, 2));
  url.searchParams.set("y", round(view.y, 2));
  url.searchParams.set("z", round(view.zoom, 3));
  url.searchParams.set("jaar", String(view.year));
  if (fromInput.value) url.searchParams.set("van", fromInput.value);
  if (toInput.value) url.searchParams.set("tot", toInput.value);
  url.searchParams.set("sat", usingSatellite() ? "1" : "0");
  url.searchParams.set("split", round(layerSplit, 3));
  if (holdInput.value) url.searchParams.set("tempo", holdInput.value);
  const place = placeInput.value.trim();
  if (place) url.searchParams.set("plaats", place.slice(0, 120));
  return url.toString();
}

function clearShareQuery() {
  if (!openedFromShare) return;
  openedFromShare = false;
  if (persistReady) rememberSettings();
  const url = new URL(location.href);
  for (const key of SHARE_KEYS) url.searchParams.delete(key);
  const search = url.searchParams.toString();
  history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${url.hash}`);
}

async function copyShareLink() {
  if (!view) return;
  const link = shareSetupUrl();
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch {
    const field = document.createElement("textarea");
    field.value = link;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    field.remove();
  }
  shareButton.textContent = copied ? "Gekopieerd" : "Mislukt";
  setStatus(copied ? "Link gekopieerd." : "Kon de link niet kopiëren.");
  setTimeout(() => {
    if (shareButton.textContent !== "Delen") shareButton.textContent = "Delen";
  }, 1600);
}

async function bootMap() {
  try {
    const stored = readSettings();
    let restoredSettings = loadSession(stored);
    if (!restoredSettings) view = { ...DEFAULT_VIEW };
    const shared = readShareSetup();
    if (shared) {
      applyShareSetup(shared);
      openedFromShare = true;
      restoredSettings = true;
    }
    clampZoom();
    writeFields();
    setStatus(shared ? "Gedeelde plek openen…" : restoredSettings ? "Opgeslagen plek openen…" : "Kaart openen…");
    const mapEditions = await discoverMaps();
    editionCache.map = mapEditions;
    fillYearSelect(mapEditions);
    fillRangeSelects(mapEditions);
    if (!restoredSettings && view) {
      view.year = mapEditions.at(-1).end;
      session.from = String(mapEditions[0].start);
      session.to = String(mapEditions.at(-1).end);
      session.rangeSet = true;
      fillYearSelect(mapEditions);
      fillRangeSelects(mapEditions);
    }
    const later = readSettings();
    if (!shared && later?.view && (!restoredSettings || (later.movie && !session.movie) || (session.from === "" && later.movie?.from))) {
      restoredSettings = loadSession(later);
    }
    writeFields();
    if (loadId !== 0) return;
    const movie = session.movie;
    let packed = null;
    try {
      packed = await readMovieRecord();
    } catch {
      packed = null;
    }
    const restoredFrames = unpackFrames(packed);
    if (
      restoredFrames.length
      && movie
      && samePlace(view, movie.view, session.from, movie.from, session.to, movie.to)
    ) {
      frames = restoredFrames;
      const levels = movie.levels || {};
      const originOf = (value, fallback) => {
        const x = Number(value?.x);
        const y = Number(value?.y);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : { ...fallback };
      };
      sheetLevels = {
        map: readLevels(levels.map),
        sat: readLevels(levels.sat),
      };
      sheetOrigin = {
        map: originOf(levels.mapOrigin, MAP_ORIGIN),
        sat: originOf(levels.satOrigin, SAT_ORIGIN),
      };
      frameIndex = Math.min(Math.max(session.frameIndex || 0, 0), frames.length - 1);
      scrub.max = String(frames.length - 1);
      scrub.value = String(frameIndex);
      restorePlans(movie);
      knownEditions = mapEditions;
      if (loadId !== 0) return;
      setInteractive(false);
      persistReady = true;
      reapplySession();
      await showFrame(frameIndex);
      syncControls();
      setStatus(localizeStatus(movie.status) || "Laatste download hersteld.");
      clearShareQuery();
      return;
    }
    knownEditions = mapEditions;
    previewEdition = sheetForYear(knownEditions, view.year) || editionForYear(knownEditions, view.year);
    persistReady = true;
    reapplySession();
    if (restoredSettings) rememberSettings();
    if (!previewEdition) {
      setInteractive(true);
      paintPreview();
      setStatus("Sleep de kaart. Knijp of scroll om in te zoomen. Laden vergrendelt dit beeld.");
      clearShareQuery();
      if (!restoredSettings) useCurrentLocation();
      return;
    }
    mapInfo = await loadTileInfo(previewEdition);
    infoSource = "map";
    if (loadId !== 0) return;
    setInteractive(true);
    paintPreview();
    requestTiles();
    setStatus("Sleep de kaart. Knijp of scroll om in te zoomen. Laden vergrendelt dit beeld.");
    clearShareQuery();
    if (!restoredSettings) useCurrentLocation();
  } catch (error) {
    persistReady = true;
    clearShareQuery();
    setStatus(error.message || "Kon de kaart niet openen.");
  }
}

window.addEventListener("pageshow", () => {
  reapplySession();
});

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
