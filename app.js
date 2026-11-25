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
const fromInput = document.querySelector("#from");
const toInput = document.querySelector("#to");
const stageWrap = document.querySelector(".stage-wrap");
const wipeBars = document.querySelector("#wipe-bars");
const layerBar = document.querySelector("#layer-bar");
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
const scratch = document.createElement("canvas");
scratch.width = 160;
scratch.height = 90;
const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });

const MIN_ZOOM = 6;
const MAX_ZOOM = 14;

const VIEW_FETCH_DELAY = 600;
const TILE_DB = "topotijdreis-tiles";
const OLD_MOVIE_DB = "topotijdreis-session";
const TILE_BUDGET = 1024 * 1024 * 1024;
const TILE_GUESS = 24000;
const STORED = 1;
const CARRY = 2;
const BITMAP_LIMIT = 500;

let frames = [];
let frameIndex = 0;
let playToken = 0;
let playing = false;
let recording = false;
let packing = false;
let cancelWait = null;
let view = null;
let frameSource = "map";
let mapEditions = [];
let satAll = [];
const kindInfo = { map: null, sat: null };
const tileIndex = new Map();
let storedBytes = 0;
const indexDirty = new Set();
let indexFlushTimer = null;
const bitmaps = new Map();
const bitmapLoads = new Map();
const tileMarks = new Map();
let repaintTimer = null;
let engineTimer = null;
let engineAbort = null;
let engineRun = 0;
let engineWaiters = [];
let viewDoneKey = null;
let fetchingView = false;
let cacheEpoch = 0;
let drag = null;
let persistReady = false;
let userGesture = false;
let layerSplit = 1;
let layerDrag = null;
let presenting = 0;
let bitmapActive = 0;
const bitmapWaiting = [];
let session = {
  from: "",
  to: "",
  hold: "800",
  satellite: false,
};

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
offCtx.imageSmoothingEnabled = true;
offCtx.imageSmoothingQuality = "high";

document.querySelector("#form").addEventListener("submit", (event) => {
  event.preventDefault();
  locatePlace();
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

holdInput.addEventListener("change", () => {
  if (!persistReady) return;
  session.hold = holdInput.value;
  rememberSettings();
});

for (const control of [fromInput, toInput]) {
  control.addEventListener("change", () => {
    if (!persistReady) return;
    const from = numberOrNull(fromInput);
    const to = numberOrNull(toInput);
    if (from != null && to != null && from > to) {
      setStatus("Van-jaar ligt na tot-jaar.");
      return;
    }
    session.from = fromInput.value;
    session.to = toInput.value;
    rememberSettings();
    rebuildFrames();
    showFrame(frameIndex);
    scheduleEngine();
  });
}

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
  if (!view || prev.dist < 1 || next.dist < 1 || !canBrowse()) return;
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
  if (event.button !== 0 || !canBrowse()) return;
  rememberPointer(event);
  try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
  if (activePointers.size >= 2) {
    drag = null;
    canvas.classList.remove("dragging");
    pinch = pinchGesture();
    cancelPlayback();
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
    if (!canBrowse()) return;
    drag.moved = true;
    canvas.classList.add("dragging");
    cancelPlayback();
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
  if (!event.deltaY || !canBrowse()) return;
  event.preventDefault();
  cancelPlayback();
  zoomAt(event);
}, { passive: false });

playButton.addEventListener("click", () => {
  if (playing) cancelPlayback();
  else startPlayback();
});

scrub.addEventListener("input", () => {
  cancelPlayback();
  showFrame(Number(scrub.value));
  if (viewDoneKey !== viewKey()) scheduleEngine();
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
  if (recording || packing) return;
  const removed = await clearSavedTiles();
  if (helpDialog.open) helpDialog.close();
  paintLive();
  scheduleEngine();
  setStatus(removed
    ? `${removed} opgeslagen tegel${removed === 1 ? "" : "s"} verwijderd. Ze worden opnieuw opgehaald.`
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
  ctx.fillText("Kaart openen…", 48, 86);
  ctx.font = "18px 'Segoe UI', 'Helvetica Neue', sans-serif";
  ctx.fillStyle = "#6d6256";
  ctx.fillText("Sleep en zoom de kaart; de jaren voor dat beeld worden vanzelf opgehaald.", 48, 124);
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
  return layerSplit < 0.5;
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

function hashBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function levelForZoom(zoom, cap) {
  return Math.max(0, Math.min(cap, Math.round(zoom)));
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
  const show = frames.length > 0;
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
  if (!frames.length || recording) {
    layerSplit = target;
    session.satellite = layerSplit < 0.5;
    rememberSettings();
    return;
  }
  cancelPlayback();
  const token = playToken;
  const myShow = ++shownFrame;
  const from = layerSplit;
  await renderYear(frameIndex, { wait: true });
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
    if (wipeBars.hidden || recording || packing) return;
    event.preventDefault();
    cancelPlayback();
    layerBar.setPointerCapture(event.pointerId);
    layerDrag = {
      id: event.pointerId,
      split: splitFromClientX(event.clientX),
      activeSat: false,
    };
    renderYear(frameIndex);
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
  if (!frame) return false;
  const token = playToken;
  const myShow = ++shownFrame;
  layerSplit = 1;
  fromCtx.setTransform(1, 0, 0, 1, 0, 0);
  fromCtx.globalAlpha = 1;
  fromCtx.drawImage(canvas, 0, 0);
  await rasterSplitView(frameIndex, toCanvas, 1, false);
  if (myShow !== shownFrame || token !== playToken) return false;
  await runWipeTransition(myShow, token, 280, "x", sign);
  hasPresented = myShow === shownFrame && token === playToken;
  layoutWipeBars();
  return hasPresented;
}

async function showFrame(index) {
  await presentFrame(index, playToken);
}

function stepFrame(delta) {
  if (!frames.length || recording || packing) return;
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
  if (!frames.length || recording || packing) return;
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
  if (!frames.length || recording || packing) return;
  cancelPlayback();
  recording = true;
  syncControls();
  if (!(await readyForExport())) {
    recording = false;
    syncControls();
    return;
  }
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
  const place = view;
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
  if (!frames.length || recording || packing) return;
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
  cancelPlayback();
  recording = true;
  syncControls();
  if (!(await readyForExport())) {
    recording = false;
    syncControls();
    return null;
  }
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

function canvasBlob(source) {
  return new Promise((resolve, reject) => {
    source.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Kon geen beeld opslaan."));
    }, "image/jpeg", 0.92);
  });
}

async function downloadZip() {
  if (!frames.length || recording || packing) return;
  packing = true;
  cancelPlayback();
  syncControls();
  try {
    if (!(await readyForExport())) return;
    const blobs = [];
    const ids = new Map();
    const movie = { years: [], map: [], sat: [], credits: [], mapYears: [], satYears: [] };
    for (let i = 0; i < frames.length; i += 1) {
      setStatus(`Zip maken… ${i + 1} van ${frames.length}`);
      const plans = await renderYear(i, { wait: true, stampIt: false });
      movie.years.push(frames[i].label);
      for (const kind of ["map", "sat"]) {
        const plan = plans[kind];
        let id = null;
        if (plan.edition) {
          const signature = plan.layers.flatMap((layer) => layer.items.map((item) => item.url)).join("|") || `leeg:${kind}`;
          if (!ids.has(signature)) {
            ids.set(signature, blobs.length);
            blobs.push(await canvasBlob(kind === "map" ? mapBlendCanvas : satBlendCanvas));
          }
          id = ids.get(signature);
        }
        movie[kind].push(id);
      }
      movie.credits.push(satelliteCredit(plans.sat.shown));
      movie.mapYears.push(plans.map.shown?.start ?? null);
      movie.satYears.push(plans.sat.shown?.start ?? null);
    }
    const folder = movieBaseName();
    const files = [{
      name: `${folder}/index.html`,
      data: new TextEncoder().encode(viewerPage({
        ...movie,
        hold: Number(holdInput.value) || 800,
        linear: false,
        satellite: usingSatellite(),
        split: layerSplit,
        index: frameIndex,
        place: placeInput.value.trim(),
      })),
    }];
    for (let i = 0; i < blobs.length; i += 1) {
      files.push({
        name: `${folder}/i/${i}.jpg`,
        data: new Uint8Array(await blobs[i].arrayBuffer()),
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
    showFrame(frameIndex);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampZoom() {
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
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

function fillRangeSelects(editions) {
  if (!editions?.length) return;
  const first = editions[0].start;
  const last = editions.at(-1).end;
  const options = rangeSelectOptions(first, last);
  fromInput.replaceChildren(options.cloneNode(true));
  toInput.replaceChildren(options);
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

let placeRequest = 0;

let hereToken = 0;

function stillAtDefault() {
  if (!view) return false;
  return Math.round(view.x) === Math.round(DEFAULT_VIEW.x)
    && Math.round(view.y) === Math.round(DEFAULT_VIEW.y)
    && Math.round(view.zoom * 100) === Math.round(DEFAULT_VIEW.zoom * 100);
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
  if (!mapEditions.length) throw new Error("De kaartjaren worden nog geladen.");
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

const SETTINGS_KEY = "topotijdreis-session";

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
  } catch {
    return null;
  }
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
      year: Number.isFinite(year) ? year : null,
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
  session.satellite = setup.satellite;
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

function canBrowse() {
  return Boolean(view) && !recording && !packing;
}

function groundResolution() {
  return GRID_RES0 / 2 ** view.zoom;
}

function gridAt(info, level) {
  const lod = info.lods.find((item) => item.level === level);
  return { ...info, level, resolution: lod ? lod.resolution : info.res0 / 2 ** level };
}

function kindLevel(kind, zoom) {
  return levelForZoom(zoom, Math.min(kindInfo[kind].maxLevel, MAX_ZOOM));
}

function kindGrid(kind, level) {
  return gridAt(kindInfo[kind], level);
}

function kindEditions(kind, place = view) {
  return kind === "map" ? mapEditions : editionsHere(satAll, place);
}

function editionAt(list, year) {
  let index = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].end <= year) index = i;
  }
  return index;
}

function centerOf(place, grid) {
  const span = grid.resolution * grid.tileSize;
  return {
    row: Math.floor((grid.originY - place.y) / span),
    col: Math.floor((place.x - grid.originX) / span),
  };
}

function resolveTile(list, start, grid, tile) {
  for (let i = start; i >= 0; i -= 1) {
    const url = tileUrl(list[i], grid, tile);
    const entry = tileIndex.get(url);
    if (!entry) return null;
    if (entry.s === STORED) return { url, edition: list[i] };
  }
  return { url: null, edition: null };
}

function openTileDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TILE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("index");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadTileIndex() {
  try {
    const db = await openTileDb();
    const store = db.transaction("index", "readonly").objectStore("index");
    const [keys, values] = await Promise.all([idbRequest(store.getAllKeys()), idbRequest(store.getAll())]);
    db.close();
    keys.forEach((key, i) => setIndexEntry(key, values[i], false));
  } catch {
    // Without the index every tile is fetched again.
  }
  if (tileIndex.size || !("caches" in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const request of await cache.keys()) {
      setIndexEntry(request.url, { s: STORED, t: 0, b: TILE_GUESS });
    }
  } catch {
    // An unreadable cache starts empty.
  }
}

function setIndexEntry(url, entry, dirty = true) {
  const old = tileIndex.get(url);
  if (old?.s === STORED) storedBytes -= old.b || TILE_GUESS;
  tileIndex.set(url, entry);
  if (entry.s === STORED) storedBytes += entry.b || TILE_GUESS;
  if (dirty) markIndexDirty(url);
}

function dropIndexEntry(url) {
  const old = tileIndex.get(url);
  if (!old) return;
  if (old.s === STORED) storedBytes -= old.b || TILE_GUESS;
  tileIndex.delete(url);
  markIndexDirty(url);
}

function touchTile(url) {
  const entry = tileIndex.get(url);
  if (!entry || entry.s !== STORED) return;
  const now = Date.now();
  if (now - (entry.t || 0) < 60000) return;
  entry.t = now;
  markIndexDirty(url);
}

function markIndexDirty(url) {
  indexDirty.add(url);
  if (!indexFlushTimer) indexFlushTimer = setTimeout(flushIndex, 2000);
}

async function flushIndex() {
  clearTimeout(indexFlushTimer);
  indexFlushTimer = null;
  if (!indexDirty.size) return;
  const urls = [...indexDirty];
  indexDirty.clear();
  try {
    const db = await openTileDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("index", "readwrite");
      const store = tx.objectStore("index");
      for (const url of urls) {
        const entry = tileIndex.get(url);
        if (entry) store.put(entry, url);
        else store.delete(url);
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    for (const url of urls) indexDirty.add(url);
  }
}

async function evictTiles() {
  if (storedBytes <= TILE_BUDGET || !("caches" in window)) return;
  const oldest = [...tileIndex.entries()]
    .filter(([, entry]) => entry.s === STORED)
    .sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const [url] of oldest) {
      if (storedBytes <= TILE_BUDGET * 0.85) break;
      dropIndexEntry(url);
      const bitmap = bitmaps.get(url);
      if (bitmap) {
        bitmaps.delete(url);
        bitmap.close();
      }
      await cache.delete(url);
    }
  } catch {
    // The next run tries again.
  }
}

async function clearSavedTiles() {
  cacheEpoch += 1;
  cancelEngine();
  const removed = [...tileIndex.values()].filter((entry) => entry.s === STORED).length;
  tileIndex.clear();
  storedBytes = 0;
  indexDirty.clear();
  tileMarks.clear();
  viewDoneKey = null;
  for (const bitmap of bitmaps.values()) bitmap.close();
  bitmaps.clear();
  if ("caches" in window) {
    try {
      for (const name of await caches.keys()) {
        if (name.startsWith("topotijdreis-tiles")) await caches.delete(name);
      }
    } catch {
      // The next fetch still works without the store.
    }
  }
  try {
    const db = await openTileDb();
    await idbRequest(db.transaction("index", "readwrite").objectStore("index").clear());
    db.close();
  } catch {
    // A stale index only points at tiles that are fetched again.
  }
  return removed;
}

async function withBitmapSlot(task) {
  while (bitmapActive >= 12) await new Promise((resolve) => bitmapWaiting.push(resolve));
  bitmapActive += 1;
  try {
    return await task();
  } finally {
    bitmapActive -= 1;
    bitmapWaiting.shift()?.();
  }
}

function trimBitmaps() {
  while (bitmaps.size > BITMAP_LIMIT) {
    const [url, bitmap] = bitmaps.entries().next().value;
    bitmaps.delete(url);
    bitmap.close();
  }
}

function bitmapFor(url) {
  const bitmap = bitmaps.get(url);
  if (!bitmap) return null;
  bitmaps.delete(url);
  bitmaps.set(url, bitmap);
  touchTile(url);
  return bitmap;
}

function loadBitmap(url) {
  if (bitmaps.has(url)) return Promise.resolve(bitmaps.get(url));
  if (bitmapLoads.has(url)) return bitmapLoads.get(url);
  const job = withBitmapSlot(async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      const buffer = hit ? await hit.arrayBuffer() : null;
      if (!buffer?.byteLength) {
        dropIndexEntry(url);
        return null;
      }
      const bitmap = await createImageBitmap(new Blob([buffer], { type: imageType(buffer) }));
      bitmaps.set(url, bitmap);
      trimBitmaps();
      return bitmap;
    } catch {
      dropIndexEntry(url);
      return null;
    }
  }).finally(() => bitmapLoads.delete(url));
  bitmapLoads.set(url, job);
  return job;
}

function sideLayer(list, start, grid, place) {
  const bounds = viewBounds(place, grid);
  const items = [];
  let count = 0;
  let none = 0;
  for (const tile of tilesFor(bounds, grid)) {
    const hit = resolveTile(list, start, grid, tile);
    count += 1;
    if (hit && !hit.url) none += 1;
    if (hit?.url) items.push({ tile, url: hit.url, edition: hit.edition });
  }
  return { grid, bounds, items, count, none };
}

function sidePlan(kind, year, place = view) {
  const plan = { kind, edition: null, shown: null, layers: [], empty: false };
  if (!kindInfo[kind] || !place) return plan;
  const list = kindEditions(kind, place);
  const start = editionAt(list, year);
  if (start < 0) return plan;
  plan.edition = list[start];
  const top = kindLevel(kind, place.zoom);
  let finest = null;
  for (let level = Math.max(0, top - 4); level <= top; level += 1) {
    const layer = sideLayer(list, start, kindGrid(kind, level), place);
    if (level === top) finest = layer;
    if (layer.items.length) plan.layers.push(layer);
  }
  if (!plan.layers.length && top < kindInfo[kind].maxLevel) {
    const layer = sideLayer(list, start, kindGrid(kind, top + 1), place);
    if (layer.items.length) plan.layers.push(layer);
  }
  plan.empty = finest.count > 0 && finest.none === finest.count;
  const best = plan.layers.at(-1);
  if (best) {
    const center = centerOf(place, best.grid);
    const hit = best.items.find((item) => item.tile.row === center.row && item.tile.col === center.col);
    plan.shown = (hit || best.items[0]).edition;
  }
  return plan;
}

function renderSide(context, plan, label, kind, notes, stampIt) {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  if (!plan.edition || plan.empty) {
    drawMissing(context, kind === "map" ? "map" : "picture");
  } else {
    context.fillStyle = "#e7dcc4";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    for (const layer of plan.layers) {
      for (const item of layer.items) blitTile(context, bitmapFor(item.url), item.tile, layer.bounds, layer.grid);
    }
  }
  if (!stampIt) return;
  const credit = kind === "map" ? "Kadaster / Topotijdreis" : satelliteCredit(plan.shown || plan.edition);
  stamp(label, context, credit, notes);
}

function drawYear(frame, plans, stampIt) {
  const notes = {
    map: plans.map.empty ? null : plans.map.shown?.start ?? null,
    sat: plans.sat.empty ? null : plans.sat.shown?.start ?? null,
  };
  renderSide(mapBlendCtx, plans.map, frame.label, "map", notes, stampIt);
  renderSide(satBlendCtx, plans.sat, frame.label, "sat", notes, stampIt);
}

async function renderYear(index, { wait = false, stampIt = true } = {}) {
  const frame = frames[index];
  if (!frame || !view) return null;
  const year = Number(frame.label);
  const plans = { map: sidePlan("map", year), sat: sidePlan("sat", year) };
  const urls = [];
  for (const plan of [plans.map, plans.sat]) {
    for (const layer of plan.layers) {
      for (const item of layer.items) {
        if (!bitmaps.has(item.url)) urls.push(item.url);
      }
    }
  }
  if (urls.length) {
    const loads = Promise.all(urls.map(loadBitmap));
    if (wait) await loads;
    else loads.then(requestRepaint);
  }
  drawYear(frame, plans, stampIt);
  return plans;
}

function paintLive() {
  if (!view || !frames.length) {
    drawWelcome();
    return;
  }
  renderYear(frameIndex);
  drawLayerSplit(layerDrag ? layerDrag.split : layerSplit, false);
}

function requestRepaint() {
  if (repaintTimer) return;
  repaintTimer = requestAnimationFrame(() => {
    repaintTimer = null;
    if (playing || recording || packing || presenting) return;
    paintLive();
  });
}

async function rasterSplitView(index, target, split = layerSplit, activeSat = false) {
  await renderYear(index, { wait: true });
  drawLayerSplitTo(target.getContext("2d"), split, activeSat);
}

async function presentFrame(index, token, {
  fadeMs = 0, wipeMs = 0, wipeAxis = "x", wipeSign = 1, onFrame,
} = {}) {
  const frame = frames[index];
  if (!frame || !view) return false;
  const myShow = ++shownFrame;
  presenting += 1;
  try {
    await rasterSplitView(index, toCanvas, layerSplit, false);
    if (myShow !== shownFrame || token !== playToken) return false;
    frameIndex = index;
    view.year = Number(frame.label);
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
  } finally {
    presenting -= 1;
  }
}

function sourceAt(kind, index) {
  if (!kindInfo[kind] || !frames[index]) return null;
  const list = kindEditions(kind);
  const start = editionAt(list, Number(frames[index].label));
  if (start < 0) return null;
  const grid = kindGrid(kind, kindLevel(kind, view.zoom));
  return resolveTile(list, start, grid, centerOf(view, grid))?.url || list[start].name;
}

function frameHold(index) {
  const full = Number(holdInput.value);
  if (index === 0) return full;
  const kind = usingSatellite() ? "sat" : "map";
  return sourceAt(kind, index) !== sourceAt(kind, index - 1) ? full : full / 4;
}

function recordingStart() {
  if (!usingSatellite()) return 0;
  const photos = kindEditions("sat");
  const first = frames.findIndex((frame) => editionAt(photos, Number(frame.label)) >= 0);
  return first < 0 ? 0 : first;
}

function rebuildFrames() {
  const before = frames.map((frame) => frame.label).join();
  const keep = Number(frames[frameIndex]?.label ?? view?.year);
  const years = spanYears(mapEditions, kindEditions("sat"), numberOrNull(fromInput), numberOrNull(toInput));
  frames = years.map((year) => ({ label: String(year) }));
  let index = frames.findIndex((frame) => Number(frame.label) === keep);
  if (index < 0) index = Number.isFinite(keep) && keep < years[0] ? 0 : frames.length - 1;
  frameIndex = Math.max(0, index);
  scrub.max = String(Math.max(0, frames.length - 1));
  scrub.value = String(frameIndex);
  if (view && frames[frameIndex]) view.year = Number(frames[frameIndex].label);
  syncControls();
  return before !== frames.map((frame) => frame.label).join();
}

function followView() {
  paintLive();
  scheduleEngine();
}

function panByPixels(cssDx, cssDy) {
  if (!view || !canBrowse()) return;
  const scale = canvasScale();
  const res = groundResolution();
  view.x -= cssDx * scale.x * res;
  view.y += cssDy * scale.y * res;
  followView();
}

function zoomAtPoint(px, py, step) {
  if (!view || !canBrowse()) return;
  const before = groundResolution();
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom - step));
  const after = groundResolution();
  const mapX = view.x + (px - WIDTH / 2) * before;
  const mapY = view.y - (py - HEIGHT / 2) * before;
  view.x = mapX - (px - WIDTH / 2) * after;
  view.y = mapY + (py - HEIGHT / 2) * after;
  followView();
}

function moveTo(place) {
  if (!view || !canBrowse()) return;
  cancelPlayback();
  view.x = place.x;
  view.y = place.y;
  if (Number.isFinite(place.zoom)) view.zoom = place.zoom;
  clampZoom();
  rememberSettings();
  rebuildFrames();
  paintLive();
  layoutWipeBars();
  scheduleEngine();
}

function applyLocatedPlace(place) {
  moveTo(place);
  setStatus(`${place.label} · ${Math.round(place.x)}, ${Math.round(place.y)}.`);
}

function useCurrentLocation() {
  if (!navigator.geolocation || !window.isSecureContext || !stillAtDefault()) return;
  const token = ++hereToken;
  navigator.geolocation.getCurrentPosition((position) => {
    if (token !== hereToken || !stillAtDefault()) return;
    const point = asDutchLatLon(position.coords.latitude, position.coords.longitude);
    if (!point) return;
    moveTo({ ...point, zoom: 10 });
    setStatus(`Huidige locatie · ${Math.round(view.x)}, ${Math.round(view.y)}.`);
  }, () => {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
}

function syncControls() {
  const blocked = recording || packing;
  const ready = frames.length > 0;
  transport.hidden = !ready;
  scrub.hidden = !ready;
  transportControls.hidden = !ready;
  loadProgress.hidden = !fetchingView;
  playButton.disabled = blocked || !ready;
  downloadButton.disabled = blocked || !ready;
  mp4Button.disabled = blocked || !ready;
  zipButton.disabled = blocked || !ready;
  scrub.disabled = blocked || !ready;
  layerToggle.disabled = blocked;
  canvas.classList.toggle("browsable", !blocked);
  syncWipeBars();
  fitPage();
}

function viewKey(place = view) {
  return [
    Math.round(place.x),
    Math.round(place.y),
    Math.round(place.zoom * 100),
    fromInput.value,
    toInput.value,
  ].join("|");
}

function cancelEngine() {
  clearTimeout(engineTimer);
  engineTimer = null;
  engineRun += 1;
  engineAbort?.abort();
  engineAbort = null;
  if (fetchingView) {
    fetchingView = false;
    syncControls();
  }
}

function scheduleEngine(delay = VIEW_FETCH_DELAY) {
  cancelEngine();
  if (!view || !frames.length) return;
  engineTimer = setTimeout(() => {
    engineTimer = null;
    rememberSettings();
    if (rebuildFrames()) paintLive();
    runEngine();
  }, delay);
}

function settleWaiters(ok) {
  const waiters = engineWaiters;
  engineWaiters = [];
  for (const resolve of waiters) resolve(ok);
}

function waitForView() {
  if (viewDoneKey === viewKey()) return Promise.resolve(true);
  if (!engineTimer && !fetchingView) scheduleEngine(0);
  return new Promise((resolve) => engineWaiters.push(resolve));
}

async function readyForExport() {
  if (viewDoneKey === viewKey()) return true;
  setStatus("Eerst de ontbrekende tegels voor dit beeld ophalen…");
  const ok = await waitForView();
  if (!ok) setStatus("Niet alle tegels voor dit beeld konden worden opgehaald.");
  return ok;
}

function tileMark(edition, grid, tile, signal) {
  const url = tileUrl(edition, grid, tile);
  if (!tileMarks.has(url)) {
    if (tileMarks.size > 20000) tileMarks.clear();
    const job = markFor(url, signal).catch((error) => {
      tileMarks.delete(url);
      throw error;
    });
    tileMarks.set(url, job);
  }
  return tileMarks.get(url);
}

async function markFor(url, signal) {
  const entry = tileIndex.get(url);
  if (entry?.s === STORED && entry.h != null) return { status: 200, etag: null, length: entry.b };
  try {
    const response = await fetch(url, { method: "HEAD", signal });
    const length = Number(response.headers.get("content-length"));
    return { status: response.status, etag: null, length: Number.isFinite(length) && length > 0 ? length : null };
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return { status: 0, etag: null, length: null };
  }
}

async function putTile(url, buffer, hash) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(buffer, { headers: { "Content-Type": imageType(buffer) } }));
  setIndexEntry(url, { s: STORED, t: Date.now(), b: buffer.byteLength, h: hash });
}

async function tileHash(edition, grid, tile, signal, keep) {
  const url = tileUrl(edition, grid, tile);
  const entry = tileIndex.get(url);
  if (entry?.s === STORED && entry.h != null) return entry.h;
  if (entry?.s === STORED) {
    const hit = await (await caches.open(CACHE_NAME)).match(url);
    if (hit) {
      const hash = hashBuffer(await hit.arrayBuffer());
      setIndexEntry(url, { ...entry, h: hash });
      return hash;
    }
  }
  const response = await fetch(url, { signal });
  if (!response.ok) return null;
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength) return null;
  const hash = hashBuffer(buffer);
  if (keep && !tileIndex.has(url)) {
    try {
      await putTile(url, buffer, hash);
    } catch {
      evictTiles();
    }
  }
  return hash;
}

async function sameAsBefore(edition, previous, grid, sample, marks, signal) {
  const at = marks.findIndex((mark) => mark.status === 200);
  if (at < 0) return true;
  const mine = await tileHash(edition, grid, sample[at], signal, true);
  const theirs = await tileHash(previous, grid, sample[at], signal, false);
  return mine != null && mine === theirs;
}

async function storeTile(layer, index, tile, signal) {
  const url = tileUrl(layer.list[index], layer.grid, tile);
  if (tileIndex.has(url)) return 0;
  const epoch = cacheEpoch;
  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return -1;
  }
  if (response.status === 404 || response.status === 400 || response.status === 204) {
    setIndexEntry(url, { s: CARRY, t: 0, b: 0 });
    return 0;
  }
  if (!response.ok) return -1;
  const buffer = await response.arrayBuffer();
  if (epoch !== cacheEpoch) return 0;
  if (!buffer.byteLength) {
    setIndexEntry(url, { s: CARRY, t: 0, b: 0 });
    return 0;
  }
  const hash = hashBuffer(buffer);
  const prior = index > 0 ? resolveTile(layer.list, index - 1, layer.grid, tile) : null;
  if (prior?.url && tileIndex.get(prior.url)?.h === hash) {
    setIndexEntry(url, { s: CARRY, t: 0, b: 0 });
    return 0;
  }
  try {
    await putTile(url, buffer, hash);
  } catch {
    evictTiles();
    return -1;
  }
  return 1;
}

async function fillEdition(layer, item, signal, live) {
  const { grid, list } = layer;
  const index = list.indexOf(item.edition);
  const previous = index > 0 ? list[index - 1] : null;
  const missing = item.missing;
  const result = { added: 0, failed: 0 };
  if (missing.length > 6) {
    const focus = missing.find((tile) => tile.row === layer.focus.row && tile.col === layer.focus.col)
      || missing[Math.floor(missing.length / 2)];
    const sample = sampleTiles(missing, focus);
    const marks = await mapPool(sample, 5, (tile) => tileMark(item.edition, grid, tile, signal));
    if (!live()) return result;
    let carry = !marks.some((mark) => mark.status === 200);
    if (!carry && previous) {
      const before = await mapPool(sample, 5, (tile) => tileMark(previous, grid, tile, signal));
      if (!live()) return result;
      carry = sameTileMarks(marks, before, "length")
        && await sameAsBefore(item.edition, previous, grid, sample, marks, signal);
      if (!live()) return result;
    }
    if (carry) {
      for (const tile of missing) {
        const url = tileUrl(item.edition, grid, tile);
        if (!tileIndex.has(url)) setIndexEntry(url, { s: CARRY, t: 0, b: 0 });
      }
      item.carried = true;
      return result;
    }
  }
  await mapPool(missing, 4, async (tile) => {
    if (!live()) return;
    const outcome = await storeTile(layer, index, tile, signal);
    if (outcome > 0) result.added += 1;
    if (outcome < 0) result.failed += 1;
  });
  return result;
}

async function runEngine() {
  if (!view || !frames.length || !kindInfo.map || !("caches" in window)) {
    settleWaiters(false);
    return;
  }
  const run = ++engineRun;
  const abort = new AbortController();
  engineAbort = abort;
  const signal = abort.signal;
  const live = () => run === engineRun && !signal.aborted;
  const place = { x: view.x, y: view.y, zoom: view.zoom };
  const key = viewKey(place);
  const from = numberOrNull(fromInput);
  const to = numberOrNull(toInput);
  const year = Number(frames[frameIndex]?.label);
  const layers = [];
  for (const kind of ["map", "sat"]) {
    if (!kindInfo[kind]) continue;
    const list = kindEditions(kind, place);
    const selected = selectEditions(list, from, to);
    if (!selected.length) continue;
    const grid = kindGrid(kind, kindLevel(kind, place.zoom));
    layers.push({
      kind,
      list,
      grid,
      tiles: tilesFor(viewBounds(place, grid), grid),
      focus: centerOf(place, grid),
      current: list[editionAt(list, year)] || null,
      name: kind === "map" ? "Kaart" : "Foto's",
      bar: kind === "map" ? mapBar : satBar,
      plan: selected.map((edition) => ({ edition, state: "wait", missing: [], carried: false })),
    });
  }
  const queue = [];
  for (const layer of layers) {
    for (const item of layer.plan) {
      const urls = layer.tiles.map((tile) => tileUrl(item.edition, layer.grid, tile));
      item.missing = layer.tiles.filter((tile, i) => !tileIndex.has(urls[i]));
      if (item.missing.length) queue.push({ layer, item });
      else item.state = urls.some((url) => tileIndex.get(url).s === STORED) ? "green" : "grey";
    }
  }
  if (!queue.length) {
    finishEngine(key, 0, 0);
    return;
  }
  const distance = (entry) => (
    entry.item.edition === entry.layer.current ? -1 : Math.abs(entry.item.edition.end - year)
  );
  queue.sort((a, b) => distance(a) - distance(b));
  barSpan = { start: Number(frames[0].label), end: Number(frames.at(-1).label) };
  fetchingView = true;
  syncControls();
  let added = 0;
  let failed = 0;
  let done = 0;
  let painted = false;
  const paint = () => {
    painted = false;
    if (!live() || !fetchingView) return;
    for (const layer of layers) paintPlan(layer.bar, layer.plan, layer.name);
    setStatus(`Jaren voor dit beeld ophalen: ${done} van ${queue.length} · ${added} nieuwe tegel${added === 1 ? "" : "s"}`);
  };
  const tick = () => {
    if (painted) return;
    painted = true;
    requestAnimationFrame(paint);
  };
  paint();
  try {
    await mapPool(queue, 3, async ({ layer, item }) => {
      if (!live()) return;
      item.state = "red";
      tick();
      const result = await fillEdition(layer, item, signal, live);
      if (!live()) return;
      added += result.added;
      failed += result.failed;
      done += 1;
      item.state = item.carried ? "grey" : "green";
      tick();
      if (result.added) requestRepaint();
    });
    if (!live()) return;
    finishEngine(key, added, failed);
  } catch (error) {
    if (error.name === "AbortError" || !live()) return;
    fetchingView = false;
    syncControls();
    settleWaiters(false);
    setStatus(error.message || "Kon de tegels voor dit beeld niet ophalen.");
  } finally {
    if (engineAbort === abort) engineAbort = null;
  }
}

function finishEngine(key, added, failed) {
  viewDoneKey = key;
  if (fetchingView) {
    fetchingView = false;
    syncControls();
  }
  settleWaiters(true);
  requestRepaint();
  flushIndex();
  evictTiles();
  if (recording || packing) return;
  const lost = failed ? ` ${failed} tegel${failed === 1 ? "" : "s"} niet gelukt; de volgende keer opnieuw.` : "";
  if (added) setStatus(`${added} tegel${added === 1 ? "" : "s"} voor dit beeld opgeslagen.${lost}`);
  else setStatus(`Alle jaren voor dit beeld staan in deze browser.${lost}`);
}

function rememberSettings() {
  if (!view || !persistReady) return;
  const data = {
    view: { year: view.year, x: view.x, y: view.y, zoom: view.zoom },
    from: session.from,
    to: session.to,
    hold: session.hold,
    satellite: usingSatellite(),
    split: layerSplit,
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch {
    // A full browser store should not stop the map.
  }
}

function loadSession(data) {
  const stored = data?.view;
  if (!stored) return false;
  const x = Number(stored.x);
  const y = Number(stored.y);
  const zoom = Number(stored.zoom);
  const year = Number(stored.year);
  if (![x, y, zoom].every(Number.isFinite)) return false;
  view = { year: Number.isFinite(year) ? year : null, x, y, zoom };
  session = {
    from: data.from ?? "",
    to: data.to ?? "",
    hold: data.hold ?? "800",
    satellite: Boolean(data.satellite),
  };
  const storedSplit = Number(data.split);
  layerSplit = Number.isFinite(storedSplit)
    ? Math.min(1, Math.max(0, storedSplit))
    : (session.satellite ? 0 : 1);
  return true;
}

async function bootMap() {
  try {
    let restored = loadSession(readSettings());
    if (!restored) view = { ...DEFAULT_VIEW, year: null };
    const shared = readShareSetup();
    if (shared) {
      applyShareSetup(shared);
      openedFromShare = true;
      restored = true;
    }
    clampZoom();
    if ([...holdInput.options].some((option) => option.value === String(session.hold))) {
      holdInput.value = String(session.hold);
    }
    setStatus(shared ? "Gedeelde plek openen…" : restored ? "Opgeslagen plek openen…" : "Kaart openen…");
    if ("indexedDB" in window) indexedDB.deleteDatabase(OLD_MOVIE_DB);
    const indexed = loadTileIndex();
    const [maps, photos] = await Promise.all([discoverMaps(), discoverSatellite().catch(() => [])]);
    mapEditions = maps;
    satAll = photos;
    fillRangeSelects(mapEditions);
    kindInfo.map = await loadTileInfo(mapEditions.at(-1));
    const photo = satAll.find((edition) => !edition.base) || satAll[0];
    if (photo) kindInfo.sat = await loadTileInfo(photo).catch(() => null);
    await indexed;
    if (view.year == null) view.year = Math.max(mapEditions.at(-1).end, satAll.at(-1)?.end ?? 0);
    persistReady = true;
    rebuildFrames();
    rememberSettings();
    await showFrame(frameIndex);
    layoutWipeBars();
    scheduleEngine(150);
    setStatus("Sleep en zoom de kaart. De jaren voor dit beeld worden vanzelf opgehaald.");
    clearShareQuery();
    if (!restored) useCurrentLocation();
  } catch (error) {
    persistReady = true;
    clearShareQuery();
    setStatus(error.message || "Kon de kaart niet openen.");
  }
}

window.addEventListener("pagehide", () => {
  flushIndex();
});

drawWelcome();
bootMap();
