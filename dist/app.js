"use strict";

const COLORS = {
  surgeon: "#ff6577",
  assistant_1: "#59c8ff",
  assistant_2: "#62d9aa",
  nurse_scrub: "#ffcb66",
  nurse_circulator: "#b79aff",
  person: "#aab7c8",
  instrument: "#c3ccd9",
  other: "#aab7c8",
  anatomy: "#e89552",
};

const ENTITY_CATEGORIES = ["person", "instrument", "other", "anatomy"];

const DEFAULT_ENTITIES = [
  { id: "person_surgeon", category: "person", role: "surgeon", label: "Surgeon", grounding_type: "instance_mask", color: COLORS.surgeon },
  { id: "person_assistant_1", category: "person", role: "assistant_1", label: "Assistant 1", grounding_type: "instance_mask", color: COLORS.assistant_1 },
  { id: "person_assistant_2", category: "person", role: "assistant_2", label: "Assistant 2", grounding_type: "instance_mask", color: COLORS.assistant_2 },
  { id: "person_nurse_scrub", category: "person", role: "nurse_scrub", label: "Nurse (Scrub)", grounding_type: "instance_mask", color: COLORS.nurse_scrub },
  { id: "person_nurse_circulator", category: "person", role: "nurse_circulator", label: "Nurse (Circulator)", grounding_type: "instance_mask", color: COLORS.nurse_circulator },
  { id: "instrument_saw", category: "instrument", label: "Saw", grounding_type: "category_only", color: COLORS.instrument },
  { id: "instrument_retractor", category: "instrument", label: "Retractor", grounding_type: "category_only", color: COLORS.instrument },
  { id: "instrument_hammer", category: "instrument", label: "Hammer", grounding_type: "category_only", color: COLORS.instrument },
  { id: "instrument_bovie", category: "instrument", label: "Bovie", grounding_type: "category_only", color: COLORS.instrument },
  { id: "other_unknown", category: "other", label: "Unknown item", grounding_type: "category_only", color: COLORS.other },
  { id: "anatomy_patient_leg", category: "anatomy", label: "Patient leg", grounding_type: "category_only", color: COLORS.anatomy },
  { id: "anatomy_surgical_site", category: "anatomy", label: "Surgical site", grounding_type: "category_only", color: COLORS.anatomy },
];

const LEGACY_ENTITY_ID_MAP = {
  person_operator: "person_surgeon",
  person_first_assistant: "person_assistant_1",
  person_second_assistant: "person_assistant_2",
  person_nurse: "person_nurse_scrub",
  person_circulator: "person_nurse_circulator",
  object_unknown: "other_unknown",
};

const DEFAULT_PREDICATES = ["holding", "using", "manipulating", "touching", "retracting", "lying_on", "assisting"];
const DEFAULT_ACTIONS = ["Proximal tibia sawing", "Distal femur cutting", "Irrigation", "Remove osteophyte", "Stability check"];
const VIEW_LAYOUT = [
  { id: "view_1", label: "View 1", x: 0, y: 0, width: .5, height: .6 },
  { id: "view_2", label: "View 2", x: .5, y: 0, width: .5, height: .6 },
  { id: "surgeon_pov", label: "Surgeon POV", x: 0, y: .6, width: 1 / 3, height: .4 },
  { id: "assistant_pov", label: "Assistant POV", x: 1 / 3, y: .6, width: 1 / 3, height: .4 },
  { id: "nurse_pov", label: "Nurse POV", x: 2 / 3, y: .6, width: 1 / 3, height: .4 },
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const uid = (prefix) => `${prefix}_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;

const state = {
  video: { file: "", purpose: "annotation", is_clipped_sample: false, fps: 30, total_frames: 0, duration: 0, width: 960, height: 450, layout: { type: "mixed_2_top_3_bottom", views: clone(VIEW_LAYOUT) } },
  entities: clone(DEFAULT_ENTITIES),
  predicates: [...DEFAULT_PREDICATES],
  actionCatalog: [...DEFAULT_ACTIONS],
  sgRelations: [],
  nodeStates: [],
  actions: [],
  legacyReviews: [],
  imports: [],
  selectedEntityId: "person_surgeon",
  zoomTile: null,
  masksVisible: true,
  referenceRange: null,
  editing: null,
  history: [],
  future: [],
  videoUrl: null,
};

const video = $("#video");
const canvas = $("#mask-canvas");
const ctx = canvas.getContext("2d");
const stage = $("#stage");
const stageSlot = $("#stage-slot");
const mediaLayer = $("#media-layer");
const appViewport = $("#app-viewport");
const appFrame = $("#app-frame");
const APP_DESIGN_WIDTH = 1600;
const APP_DESIGN_HEIGHT = 900;
let toastTimer = null;
let renderLoop = null;
let editingNodeId = null;
let editingReviewId = null;
let contextKind = "action";
let contextOpen = false;
let contextRenderSignature = "";

function mockPolygon(viewId, role, localPoints) {
  const view = VIEW_LAYOUT.find((item) => item.id === viewId);
  return {
    entity_id: `person_${role}`,
    view_id: view.id,
    source: "mock",
    is_placeholder: true,
    polygon: localPoints.map(([x, y]) => [view.x + x * view.width, view.y + y * view.height]),
  };
}

const MOCK_GROUNDINGS = [
  mockPolygon("view_1", "nurse_scrub", [[.03,.34],[.08,.23],[.17,.26],[.20,.91],[.16,.98],[.03,.94]]),
  mockPolygon("view_1", "surgeon", [[.36,.14],[.41,.07],[.49,.11],[.52,.90],[.48,.98],[.35,.94]]),
  mockPolygon("view_1", "assistant_1", [[.52,.12],[.57,.07],[.63,.13],[.66,.91],[.62,.98],[.51,.94]]),
  mockPolygon("view_1", "assistant_2", [[.72,.19],[.77,.12],[.85,.16],[.88,.92],[.83,.98],[.71,.94]]),
  mockPolygon("view_2", "assistant_1", [[.00,.18],[.05,.10],[.13,.14],[.16,.92],[.11,.98],[.00,.95]]),
  mockPolygon("view_2", "nurse_scrub", [[.37,.22],[.42,.13],[.51,.16],[.54,.91],[.49,.98],[.36,.94]]),
  mockPolygon("view_2", "assistant_2", [[.54,.17],[.58,.10],[.65,.13],[.68,.91],[.64,.98],[.53,.94]]),
  mockPolygon("view_2", "surgeon", [[.66,.14],[.71,.07],[.79,.11],[.82,.91],[.78,.98],[.65,.94]]),
];

function notify(message, type = "info") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show${type === "error" ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 2600);
}

function fps() {
  const value = Number($("#fps-input").value);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function currentFrame() {
  return Math.max(0, Math.round((video.currentTime || 0) * fps()));
}

function setWorkRange(start, end, { updateContext = true } = {}) {
  const safeStart = Math.max(0, Math.round(Number(start) || 0));
  const safeEnd = Math.max(0, Math.round(Number(end) || 0));
  $("#work-range-start").value = safeStart;
  $("#work-range-end").value = safeEnd;
  $$(".annotation-form").forEach((form) => {
    if (form.elements.start) form.elements.start.value = safeStart;
    if (form.elements.end) form.elements.end.value = safeEnd;
  });
  if (updateContext && safeEnd >= safeStart) {
    state.referenceRange = { start: safeStart, end: safeEnd };
    renderContextBox();
  }
}

function syncWorkRangeFromInputs() {
  setWorkRange($("#work-range-start").value, $("#work-range-end").value);
}

function frameToTime(frame) {
  return Number(frame) / fps();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00.000";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(3).padStart(6, "0")}`;
}

function entityById(id) { return state.entities.find((entity) => entity.id === id); }
function entityLabel(id) { return entityById(id)?.label || id; }

function snapshot() {
  return clone({ entities: state.entities, predicates: state.predicates, actionCatalog: state.actionCatalog, sgRelations: state.sgRelations, nodeStates: state.nodeStates, actions: state.actions, legacyReviews: state.legacyReviews, imports: state.imports, selectedEntityId: state.selectedEntityId });
}

function pushHistory() {
  state.history.push(snapshot());
  if (state.history.length > 60) state.history.shift();
  state.future = [];
}

function applySnapshot(data) {
  state.entities = clone(data.entities);
  state.predicates = [...data.predicates];
  state.actionCatalog = [...data.actionCatalog];
  state.sgRelations = clone(data.sgRelations);
  state.nodeStates = clone(data.nodeStates);
  state.actions = clone(data.actions);
  state.legacyReviews = clone(data.legacyReviews || []);
  state.imports = clone(data.imports || []);
  state.selectedEntityId = data.selectedEntityId && state.entities.some((entity) => entity.id === data.selectedEntityId)
    ? data.selectedEntityId
    : state.entities[0]?.id || null;
  state.editing = null;
  state.referenceRange = null;
  setWorkRange(0, 0, { updateContext: false });
  renderAll();
}

function undo() {
  if (!state.history.length) return;
  state.future.push(snapshot());
  applySnapshot(state.history.pop());
  autoSave();
}

function redo() {
  if (!state.future.length) return;
  state.history.push(snapshot());
  applySnapshot(state.future.pop());
  autoSave();
}

function updateUndoButtons() {
  $("#undo").disabled = state.history.length === 0;
  $("#redo").disabled = state.future.length === 0;
}

function refreshEntityControls() {
  $$(".entity-select").forEach((select) => {
    const selected = select.value;
    const personOnly = select.classList.contains("person-only");
    const categoryOrder = { person: 0, instrument: 1, other: 1, anatomy: 2 };
    const entities = (personOnly ? state.entities.filter((entity) => entity.category === "person") : state.entities)
      .slice()
      .sort((left, right) => (categoryOrder[left.category] ?? 9) - (categoryOrder[right.category] ?? 9)
        || left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
    select.replaceChildren(...entities.map((entity) => {
      const option = document.createElement("option");
      option.value = entity.id;
      option.textContent = `${entity.label} · ${entity.category}`;
      return option;
    }));
    if (entities.some((entity) => entity.id === selected)) select.value = selected;
    else if (personOnly && entities.some((entity) => entity.id === state.selectedEntityId)) select.value = state.selectedEntityId;
  });
}

function refreshVocabulary() {
  const refreshPreset = (selector, values, placeholder) => {
    const select = $(selector);
    const selected = select.value;
    const options = [Object.assign(document.createElement("option"), { value: "", textContent: placeholder })];
    values.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })).forEach((value) => {
      options.push(Object.assign(document.createElement("option"), { value, textContent: value }));
    });
    select.replaceChildren(...options);
    if (values.includes(selected)) select.value = selected;
  };
  refreshPreset(".predicate-preset", state.predicates, "목록에서 선택");
  refreshPreset(".action-preset", state.actionCatalog, "목록에서 선택");
}

function renderEntities() {
  const list = $("#entity-list");
  const scrollPositions = Object.fromEntries(
    $$(".entity-category-items", list).map((items) => [items.dataset.category, items.scrollTop]),
  );
  const categoryMeta = [
    { id: "person", label: "Person", categories: ["person"] },
    { id: "instrument", label: "Instrument / Other", categories: ["instrument", "other"] },
    { id: "anatomy", label: "Anatomy", categories: ["anatomy"] },
  ];

  const createEntityItem = (entity) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `entity-item${state.selectedEntityId === entity.id ? " selected" : ""}`;
    item.setAttribute("aria-pressed", String(state.selectedEntityId === entity.id));
    item.title = `${entity.label} · ${entity.role || entity.category}`;
    item.style.setProperty("--entity-color", entity.color || COLORS[entity.category] || COLORS.other);
    item.innerHTML = `<i class="entity-dot"></i><span class="entity-copy"><strong></strong><span></span></span><span class="entity-grounding"></span>`;
    $("strong", item).textContent = entity.label;
    $(".entity-copy span", item).textContent = entity.role || entity.category;
    $(".entity-grounding", item).textContent = entity.grounding_type === "instance_mask" ? "MASK" : "CATEGORY";
    item.addEventListener("click", () => selectEntity(entity.id));
    return item;
  };

  const sections = categoryMeta.map((category) => {
    const entities = state.entities
      .filter((entity) => category.categories.includes(entity.category))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
    const section = document.createElement("section");
    section.className = "entity-category";
    section.setAttribute("aria-labelledby", `entity-category-${category.id}`);
    section.innerHTML = `
      <div class="entity-category-heading" id="entity-category-${category.id}">
        <strong>${category.label}</strong>
        <span>${entities.length}</span>
      </div>
      <div class="entity-category-items" data-category="${category.id}"></div>`;
    const items = $(".entity-category-items", section);
    items.replaceChildren(...entities.map(createEntityItem));
    requestAnimationFrame(() => { items.scrollTop = scrollPositions[category.id] || 0; });
    return section;
  });

  list.replaceChildren(...sections);
  $("#entity-count").textContent = String(state.entities.length);
  const activeEntity = entityById(state.selectedEntityId);
  const editNodeButton = $("#edit-node");
  const canEditNode = Boolean(activeEntity);
  editNodeButton.disabled = !canEditNode;
  editNodeButton.title = canEditNode ? `${activeEntity.label} 수정` : "수정할 Node를 선택하세요.";
  const indicator = $("#active-node-indicator");
  indicator.hidden = !activeEntity;
  if (activeEntity) {
    indicator.style.setProperty("--active-node-color", activeEntity.color || COLORS[activeEntity.category] || COLORS.other);
    $("#active-node-label").textContent = activeEntity.label;
    indicator.title = `현재 선택: ${activeEntity.label}`;
  }
}

function selectEntity(id) {
  const entity = entityById(id);
  if (!entity) return;
  state.selectedEntityId = id;
  renderEntities();
  const badge = $("#selected-entity");
  badge.hidden = false;
  badge.style.color = entity.color || COLORS.other;
  badge.textContent = `${entity.label} 선택됨`;
  $$(".person-only").forEach((select) => {
    if (entity.category === "person") select.value = id;
  });
  if (entity.category === "person") {
    $("#relation-form").elements.subject.value = id;
    $("#action-form").elements.actor.value = id;
    $("#state-form").elements.entity.value = id;
  } else {
    $("#relation-form").elements.object.value = id;
  }
  notify(`${entity.label}을 ${entity.category === "person" ? "사람 입력란" : "SG Object"}에 적용했습니다.`);
  drawMasks();
}

function drawMasks() {
  if (!canvas.width || !canvas.height) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.masksVisible) return;
  const activeView = state.zoomTile === null ? null : VIEW_LAYOUT.find((view) => view.id === state.zoomTile);
  const visualScale = activeView ? ((1 / activeView.width) + (1 / activeView.height)) / 2 : 1;
  for (const grounding of MOCK_GROUNDINGS) {
    const entity = entityById(grounding.entity_id);
    if (!entity) continue;
    const points = grounding.polygon.map(([x, y]) => [x * canvas.width, y * canvas.height]);
    ctx.beginPath();
    points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.closePath();
    const selected = state.selectedEntityId === entity.id;
    ctx.fillStyle = `${entity.color}${selected ? "3d" : "16"}`;
    ctx.strokeStyle = entity.color;
    ctx.lineWidth = (selected ? 4 : 2) / visualScale;
    ctx.setLineDash([8 / visualScale, 5 / visualScale]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    if (selected) {
      const [x, y] = points[0];
      const fontSize = 13 / visualScale;
      ctx.font = `700 ${fontSize}px system-ui`;
      const text = `${entity.label} · MOCK`;
      const padding = 6 / visualScale;
      const width = ctx.measureText(text).width + padding * 2;
      const height = 21 / visualScale;
      ctx.fillStyle = "rgba(3,7,12,.86)";
      ctx.fillRect(x, Math.max(0, y - 24 / visualScale), width, height);
      ctx.fillStyle = entity.color;
      ctx.fillText(text, x + padding, Math.max(fontSize, y - 9 / visualScale));
    }
  }
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || .00001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function handleCanvasClick(event) {
  if (!state.masksVisible) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const hit = [...MOCK_GROUNDINGS].reverse().find((grounding) => pointInPolygon(x, y, grounding.polygon));
  if (hit) selectEntity(hit.entity_id);
}

function setZoom(viewId) {
  state.zoomTile = viewId;
  stage.classList.toggle("zoomed", viewId !== null);
  $$(".tile-button").forEach((button) => button.classList.toggle("active", button.dataset.tile === (viewId === null ? "all" : viewId)));
  if (viewId === null) {
    Object.assign(mediaLayer.style, { width: "100%", height: "100%", left: "0", top: "0" });
  } else {
    const view = VIEW_LAYOUT.find((item) => item.id === viewId);
    Object.assign(mediaLayer.style, {
      width: `${100 / view.width}%`,
      height: `${100 / view.height}%`,
      left: `${-(view.x / view.width) * 100}%`,
      top: `${-(view.y / view.height) * 100}%`,
    });
  }
  fitStage();
  drawMasks();
}

function fitStage() {
  const widthAvailable = stageSlot.clientWidth;
  const heightAvailable = stageSlot.clientHeight;
  if (!widthAvailable || !heightAvailable) return;
  const ratio = state.zoomTile === null
    ? ((state.video.width || 960) / (state.video.height || 450))
    : (16 / 9);
  let width = widthAvailable;
  let height = width / ratio;
  if (height > heightAvailable) {
    height = heightAvailable;
    width = height * ratio;
  }
  stage.style.width = `${Math.max(1, width)}px`;
  stage.style.height = `${Math.max(1, height)}px`;
}

function fitAppFrame() {
  const viewportWidth = window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
  const scale = Math.min(
    1,
    Math.max(1, viewportWidth - 16) / APP_DESIGN_WIDTH,
    Math.max(1, viewportHeight - 16) / APP_DESIGN_HEIGHT
  );
  appFrame.style.setProperty("--ui-scale", String(Math.max(.1, scale)));
}

function updateVideoReadout() {
  const frame = currentFrame();
  $("#frame-readout").textContent = `/ ${state.video.total_frames.toLocaleString()}`;
  $("#time-readout").textContent = formatTime(video.currentTime || 0);
  if (document.activeElement !== $("#frame-jump-input")) $("#frame-jump-input").value = frame;
  $("#frame-jump-input").max = String(Math.max(0, state.video.total_frames));
  $("#video-scrubber").max = String(Math.max(0, state.video.total_frames));
  $("#video-scrubber").value = String(frame);
  const left = state.video.duration ? Math.min(100, ((video.currentTime || 0) / state.video.duration) * 100) : 0;
  $$(".playhead").forEach((head) => { head.style.left = `${left}%`; });
  renderContextBox();
}

function startRenderLoop() {
  cancelAnimationFrame(renderLoop);
  const tick = () => {
    updateVideoReadout();
    drawMasks();
    if (!video.paused && !video.ended) renderLoop = requestAnimationFrame(tick);
  };
  renderLoop = requestAnimationFrame(tick);
}

function stepFrame(delta) {
  if (!video.src) return;
  video.pause();
  video.currentTime = Math.max(0, Math.min(state.video.duration || Infinity, (currentFrame() + delta) / fps()));
  updatePlayButton();
  updateVideoReadout();
}

function jumpToEnteredFrame() {
  const input = $("#frame-jump-input");
  const frame = Math.round(Number(input.value));
  if (!Number.isFinite(frame) || frame < 0) {
    notify("이동할 Frame 번호를 확인하세요.", "error");
    input.focus();
    return;
  }
  seekToFrame(frame);
}

function updatePlayButton() { $("#play-toggle").textContent = video.paused ? "재생" : "정지"; }

function loadVideoFile(file) {
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(file);
  video.src = state.videoUrl;
  state.video.file = file.name;
  state.referenceRange = null;
  setWorkRange(0, 0, { updateContext: false });
  contextOpen = false;
  $("#video-name").textContent = file.name;
  $("#stage-empty").hidden = true;
  mediaLayer.hidden = false;
  video.load();
}

function initializeVideoMetadata() {
  state.video.duration = video.duration || 0;
  state.video.width = video.videoWidth || 960;
  state.video.height = video.videoHeight || 450;
  state.video.fps = fps();
  state.video.total_frames = Math.max(0, Math.floor(state.video.duration * state.video.fps));
  state.video.layout = { type: "mixed_2_top_3_bottom", views: clone(VIEW_LAYOUT) };
  canvas.width = state.video.width;
  canvas.height = state.video.height;
  setZoom("surgeon_pov");
  setWorkRange(0, 0, { updateContext: false });
  fitStage();
  updateVideoReadout();
  renderTimeline();
  drawMasks();
  const draft = localStorage.getItem(storageKey());
  if (draft && confirm("이 영상에 저장된 임시 annotation이 있습니다. 불러올까요?")) {
    try { importProject(JSON.parse(draft), false); notify("임시 저장 내용을 불러왔습니다."); } catch (_) { notify("임시 저장 내용을 읽지 못했습니다.", "error"); }
  }
}

function recordLists() {
  return [
    ...state.sgRelations.map((record) => ({ ...record, kind: "sg" })),
    ...state.nodeStates.map((record) => ({ ...record, kind: "state" })),
    ...state.actions.map((record) => ({ ...record, kind: "action" })),
    ...state.legacyReviews.map((record) => ({ ...record, kind: "review" })),
  ];
}

function recordText(record) {
  if (record.kind === "sg") return `${entityLabel(record.subject_id)} — ${record.predicate} — ${entityLabel(record.object_id)}`;
  if (record.kind === "state") return `${entityLabel(record.entity_id)} · ${record.field_zone}`;
  if (record.kind === "review") return `${entityLabel(record.actor_id)} · ${record.label}`;
  return `${entityLabel(record.actor_id)} · ${record.label}`;
}

function contextRange() {
  if (state.referenceRange) return state.referenceRange;
  const frame = currentFrame();
  return { start: frame, end: frame };
}

function recordsForContext(range) {
  return recordLists().filter((record) => record.start_frame <= range.end && record.end_frame >= range.start);
}

function renderContextList(records) {
  const list = $("#context-list");
  const selected = records.filter((record) => record.kind === contextKind);
  const title = contextKind === "sg" ? "SG" : contextKind === "state" ? "State" : contextKind === "review" ? "Review" : "Action";
  $("#context-popover-title").textContent = `현재 구간 ${title}`;
  if (!selected.length) {
    const empty = document.createElement("div");
    empty.className = "context-empty";
    empty.textContent = "이 구간에는 해당 Annotation이 없습니다.";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...selected.map((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "context-record";
    button.innerHTML = "<span></span><strong></strong>";
    $("span", button).textContent = `${record.start_frame.toLocaleString()}–${record.end_frame.toLocaleString()}`;
    $("strong", button).textContent = recordText(record);
    button.addEventListener("click", () => {
      seekAndApplyRecordRange(record);
      contextOpen = false;
      renderContextBox();
    });
    return button;
  }));
}

function renderContextBox() {
  const range = contextRange();
  const records = recordsForContext(range);
  const signature = JSON.stringify({
    start: range.start,
    end: range.end,
    pinned: Boolean(state.referenceRange),
    contextKind,
    contextOpen,
    records: records.map((record) => [record.kind, record.id, record.start_frame, record.end_frame, recordText(record)]),
  });
  if (signature === contextRenderSignature) return;
  contextRenderSignature = signature;
  const counts = { sg: 0, state: 0, action: 0, review: 0 };
  records.forEach((record) => { counts[record.kind] += 1; });
  const action = records.find((record) => record.kind === "action");
  $("#context-range").textContent = state.referenceRange
    ? `${range.start.toLocaleString()}–${range.end.toLocaleString()} · 선택 구간`
    : `frame ${range.start.toLocaleString()} · 현재 위치`;
  $("#context-primary").textContent = action ? `[ACTION] ${recordText(action)}` : "[ACTION] 해당 구간 Action 없음";
  $$('[data-context-count]').forEach((item) => { item.textContent = String(counts[item.dataset.contextCount] || 0); });
  $$('[data-context-kind]').forEach((button) => {
    const active = contextOpen && button.dataset.contextKind === contextKind;
    button.classList.toggle("active", active);
    button.setAttribute("aria-expanded", String(active));
  });
  $("#context-popover").hidden = !contextOpen;
  if (contextOpen) renderContextList(records);
}

function renderRecords() {
  const query = $("#record-search").value.trim().toLowerCase();
  const filter = $(".record-filter.active")?.dataset.recordFilter || "all";
  const sort = $("#record-sort").value;
  const allRecords = recordLists();
  const counts = { all: allRecords.length, sg: 0, state: 0, action: 0, review: 0 };
  allRecords.forEach((record) => { counts[record.kind] += 1; });
  $$('[data-filter-count]').forEach((count) => { count.textContent = String(counts[count.dataset.filterCount] || 0); });
  const kindOrder = { sg: 0, state: 1, action: 2, review: 3 };
  const compareFrame = (a, b) => a.start_frame - b.start_frame || a.end_frame - b.end_frame || kindOrder[a.kind] - kindOrder[b.kind];
  const records = allRecords
    .filter((record) => filter === "all" || record.kind === filter)
    .filter((record) => !query || `${recordText(record)} ${record.note || ""}`.toLowerCase().includes(query))
    .sort(sort === "frame-desc"
      ? (a, b) => -compareFrame(a, b)
      : sort === "kind"
        ? (a, b) => kindOrder[a.kind] - kindOrder[b.kind] || compareFrame(a, b)
        : compareFrame);
  const body = $("#records-body");
  body.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    const convertAction = record.kind === "review"
      ? `<button class="record-action review-action" type="button">Action 전환</button>`
      : "";
    row.innerHTML = `<td><span class="kind-badge ${record.kind}"></span></td><td class="frame-cell"></td><td class="content-cell"></td><td class="note-cell"></td><td><div class="record-actions">${convertAction}<button class="record-action seek" type="button">이동</button><button class="record-action edit" type="button">수정</button><button class="record-action delete" type="button">삭제</button></div></td>`;
    $(".kind-badge", row).textContent = record.kind === "sg" ? "SG" : record.kind === "state" ? "STATE" : record.kind === "review" ? "REVIEW" : "ACTION";
    $(".frame-cell", row).textContent = `${record.start_frame.toLocaleString()}–${record.end_frame.toLocaleString()}`;
    $(".content-cell", row).textContent = recordText(record);
    $(".note-cell", row).textContent = record.note || "—";
    $(".seek", row).title = "영상 이동 + 시작/종료 frame을 입력 폼에 적용";
    $(".seek", row).addEventListener("click", () => seekAndApplyRecordRange(record));
    if (record.kind === "review") {
      $(".review-action", row).addEventListener("click", () => convertReview(record));
      $(".edit", row).addEventListener("click", () => openEditReviewDialog(record));
    } else $(".edit", row).addEventListener("click", () => editRecord(record));
    $(".delete", row).addEventListener("click", () => deleteRecord(record));
    return row;
  }));
  $("#empty-records").hidden = records.length > 0;
  $("#timeline-summary").textContent = `SG ${state.sgRelations.length} · State ${state.nodeStates.length} · Action ${state.actions.length} · Review ${state.legacyReviews.length}`;
}

function renderTimeline() {
  const total = Math.max(state.video.total_frames, 1);
  const tracks = { sg: $("[data-track='sg']"), state: $("[data-track='state']"), action: $("[data-track='action']") };
  Object.values(tracks).forEach((track) => {
    track.querySelectorAll(".timeline-bar").forEach((bar) => bar.remove());
  });
  for (const record of recordLists()) {
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = `timeline-bar ${record.kind}`;
    bar.style.left = `${(record.start_frame / total) * 100}%`;
    bar.style.width = `${Math.max(.25, ((record.end_frame - record.start_frame + 1) / total) * 100)}%`;
    bar.title = `${recordText(record)} · frame ${record.start_frame}–${record.end_frame}`;
    bar.addEventListener("click", () => seekToFrame(record.start_frame));
    const track = record.kind === "review" ? tracks.action : tracks[record.kind];
    track.appendChild(bar);
  }
}

function renderAll() {
  refreshEntityControls();
  refreshVocabulary();
  renderEntities();
  renderRecords();
  renderTimeline();
  renderContextBox();
  updateUndoButtons();
  if (!state.editing) {
    $("#relation-form .submit-button").textContent = "SG relation 저장";
    $("#state-form .submit-button").textContent = "Node state 저장";
    $("#action-form .submit-button").textContent = "Action 저장";
  }
  drawMasks();
}

function seekToFrame(frame) {
  if (!video.src) { notify("먼저 영상을 열어주세요.", "error"); return; }
  video.pause();
  video.currentTime = Math.max(0, Math.min(state.video.duration || Infinity, frameToTime(frame)));
  updatePlayButton();
  updateVideoReadout();
}

function seekAndApplyRecordRange(record) {
  seekToFrame(record.start_frame);
  setWorkRange(record.start_frame, record.end_frame);
  notify(`frame ${record.start_frame.toLocaleString()}–${record.end_frame.toLocaleString()} 범위를 입력 폼에 적용했습니다.`);
}

function annotationArray(kind) {
  return kind === "sg" ? state.sgRelations : kind === "state" ? state.nodeStates : kind === "review" ? state.legacyReviews : state.actions;
}

function validateRange(start, end) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start) {
    notify("Frame 범위를 확인하세요. End는 Start보다 같거나 커야 합니다.", "error");
    return false;
  }
  return true;
}

function normalizedRecordText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isSameAnnotation(kind, left, right) {
  if (left.start_frame !== right.start_frame || left.end_frame !== right.end_frame) return false;
  if (kind === "sg") {
    return left.subject_id === right.subject_id
      && left.object_id === right.object_id
      && normalizedRecordText(left.predicate) === normalizedRecordText(right.predicate);
  }
  if (kind === "state") {
    return left.entity_id === right.entity_id
      && normalizedRecordText(left.field_zone) === normalizedRecordText(right.field_zone);
  }
  return left.actor_id === right.actor_id
    && normalizedRecordText(left.label) === normalizedRecordText(right.label);
}

function saveRecord(kind, data) {
  const array = annotationArray(kind);
  const editingId = state.editing?.kind === kind ? state.editing.id : null;
  const duplicate = array.find((record) => record.id !== editingId && isSameAnnotation(kind, record, data));
  if (duplicate) {
    const typeLabel = kind === "sg" ? "SG relation" : kind === "state" ? "Node state" : "Action";
    notify(`동일한 ${typeLabel}이 같은 frame 구간에 이미 저장되어 있습니다.`, "error");
    return false;
  }
  pushHistory();
  if (kind === "action" && state.editing?.kind === "review") {
    const reviewIndex = state.legacyReviews.findIndex((record) => record.id === state.editing.id);
    const review = reviewIndex >= 0 ? state.legacyReviews.splice(reviewIndex, 1)[0] : null;
    array.push({ ...data, id: uid("action"), legacy_source_id: review?.legacy_source_id, converted_from: "legacy_triplet" });
  } else if (state.editing?.kind === kind) {
    const index = array.findIndex((record) => record.id === state.editing.id);
    if (index >= 0) array[index] = { ...data, id: state.editing.id };
  } else {
    array.push({ ...data, id: uid(kind) });
  }
  state.editing = null;
  renderAll();
  autoSave();
  notify(`${kind === "sg" ? "SG relation" : kind === "state" ? "Node state" : "Action"}을 저장했습니다.`);
  return true;
}

function submitRelation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const start = Number(values.get("start"));
  const end = Number(values.get("end"));
  if (!validateRange(start, end)) return;
  const predicate = String(values.get("predicate")).trim();
  if (!state.predicates.includes(predicate)) state.predicates.push(predicate);
  const wasEditing = state.editing?.kind === "sg";
  const saved = saveRecord("sg", {
    subject_id: values.get("subject"), predicate, object_id: values.get("object"), start_frame: start, end_frame: end,
    start_time: frameToTime(start), end_time: frameToTime(end), note: String(values.get("note") || "").trim(),
    observed_in_views: state.zoomTile === null ? [] : [state.zoomTile],
  });
  if (saved) {
    form.elements.note.value = "";
    if (!wasEditing) {
      form.elements.predicate.value = "";
      $(".predicate-preset").value = "";
      form.elements.predicate.focus();
      notify("SG를 저장했습니다. 같은 작업 구간에 다음 관계를 계속 입력할 수 있습니다.");
    }
  }
}

function submitState(event) {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const start = Number(values.get("start"));
  const end = Number(values.get("end"));
  if (!validateRange(start, end)) return;
  const saved = saveRecord("state", {
    entity_id: values.get("entity"), field_zone: values.get("zone"), start_frame: start, end_frame: end,
    start_time: frameToTime(start), end_time: frameToTime(end), note: String(values.get("note") || "").trim(),
  });
  if (saved) event.currentTarget.elements.note.value = "";
}

function submitAction(event) {
  event.preventDefault();
  const values = new FormData(event.currentTarget);
  const start = Number(values.get("start"));
  const end = Number(values.get("end"));
  if (!validateRange(start, end)) return;
  const label = String(values.get("label")).trim();
  if (!state.actionCatalog.includes(label)) state.actionCatalog.push(label);
  const wasEditing = Boolean(state.editing);
  const saved = saveRecord("action", {
    actor_id: values.get("actor"), label, start_frame: start, end_frame: end,
    start_time: frameToTime(start), end_time: frameToTime(end), note: String(values.get("note") || "").trim(),
  });
  if (saved) {
    event.currentTarget.elements.note.value = "";
    if (!wasEditing) {
      event.currentTarget.elements.label.value = "";
      $(".action-preset").value = "";
    }
  }
}

function editRecord(record) {
  setWorkRange(record.start_frame, record.end_frame);
  setRecordsExpanded(false);
  state.editing = { kind: record.kind, id: record.id };
  const tab = $(`.annotation-tab[data-form='${record.kind === "sg" ? "relation" : record.kind}']`);
  activateForm(tab.dataset.form);
  const form = $(`#${tab.dataset.form}-form`);
  if (record.kind === "sg") {
    form.elements.subject.value = record.subject_id;
    form.elements.predicate.value = record.predicate;
    $(".predicate-preset").value = state.predicates.includes(record.predicate) ? record.predicate : "";
    form.elements.object.value = record.object_id;
  } else if (record.kind === "state") {
    form.elements.entity.value = record.entity_id;
    form.elements.zone.value = record.field_zone;
  } else {
    form.elements.actor.value = record.actor_id;
    form.elements.label.value = record.label;
    $(".action-preset").value = state.actionCatalog.includes(record.label) ? record.label : "";
  }
  setWorkRange(record.start_frame, record.end_frame);
  form.elements.note.value = record.note || "";
  form.querySelector(".submit-button").textContent = "수정 내용 저장";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function convertReview(record) {
  setWorkRange(record.start_frame, record.end_frame);
  setRecordsExpanded(false);
  state.editing = { kind: "review", id: record.id };
  activateForm("action");
  const form = $("#action-form");
  form.elements.actor.value = record.actor_id;
  form.elements.label.value = record.label;
  $(".action-preset").value = state.actionCatalog.includes(record.label) ? record.label : "";
  setWorkRange(record.start_frame, record.end_frame);
  form.elements.note.value = record.note || "";
  form.querySelector(".submit-button").textContent = "Action으로 전환";
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetReviewDialog() {
  editingReviewId = null;
  $("#review-form").reset();
}

function openEditReviewDialog(record) {
  state.referenceRange = { start: record.start_frame, end: record.end_frame };
  renderContextBox();
  editingReviewId = record.id;
  const form = $("#review-form");
  form.elements.actor.value = record.actor_id;
  form.elements.label.value = record.label;
  form.elements.start.value = record.start_frame;
  form.elements.end.value = record.end_frame;
  form.elements.note.value = record.note || "";
  $("#review-dialog").showModal();
  requestAnimationFrame(() => form.elements.label.focus());
}

function confirmReviewEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const start = Number(values.get("start"));
  const end = Number(values.get("end"));
  if (!validateRange(start, end)) return;
  const current = state.legacyReviews.find((record) => record.id === editingReviewId);
  if (!current) {
    notify("수정할 검토 항목을 찾을 수 없습니다.", "error");
    return;
  }
  const next = {
    ...current,
    actor_id: values.get("actor"),
    label: String(values.get("label")).trim(),
    start_frame: start,
    end_frame: end,
    start_time: frameToTime(start),
    end_time: frameToTime(end),
    note: String(values.get("note") || "").trim(),
  };
  const duplicate = state.legacyReviews.find((record) => record.id !== editingReviewId && isSameAnnotation("review", record, next));
  if (duplicate) {
    notify("동일한 검토 항목이 같은 frame 구간에 이미 저장되어 있습니다.", "error");
    return;
  }
  pushHistory();
  Object.assign(current, next);
  setWorkRange(start, end);
  $("#review-dialog").close();
  resetReviewDialog();
  renderAll();
  autoSave();
  notify("검토 항목을 수정했습니다.");
}

function deleteRecord(record) {
  if (!confirm(`삭제할까요?\n${recordText(record)}`)) return;
  pushHistory();
  const array = annotationArray(record.kind);
  const index = array.findIndex((item) => item.id === record.id);
  if (index >= 0) array.splice(index, 1);
  renderAll();
  autoSave();
}

function activateForm(name) {
  const convertingReview = state.editing?.kind === "review" && name === "action";
  $$(".annotation-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.form === name));
  $$(".annotation-form").forEach((form) => form.classList.toggle("active", form.id === `${name}-form`));
  $$(".submit-button").forEach((button) => {
    const kind = button.closest("form").dataset.kind;
    button.textContent = kind === "sg" ? "SG relation 저장" : kind === "state" ? "Node state 저장" : "Action 저장";
  });
  if (state.editing && !convertingReview && ((name === "relation" ? "sg" : name) !== state.editing.kind)) state.editing = null;
}

function addPredicate(input) {
  const value = input.value.trim();
  if (!value) { notify("Predicate를 입력하세요.", "error"); return; }
  if (!state.predicates.includes(value)) {
    pushHistory();
    state.predicates.push(value);
    refreshVocabulary();
    updateUndoButtons();
    autoSave();
    notify(`Predicate '${value}'를 추가했습니다.`);
  }
}

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "_").replace(/^_|_$/g, "") || Math.random().toString(36).slice(2, 7);
}

function resetNodeDialog() {
  editingNodeId = null;
  $("#node-form").reset();
  $("#node-dialog-eyebrow").textContent = "NEW NODE";
  $("#node-dialog-title").textContent = "Node 추가";
  $("#node-dialog-help").textContent = "수술도구는 Instrument, 그 밖의 물체는 Other로 구분합니다. 두 Category는 목록에서 함께 표시됩니다.";
  $("#confirm-node").textContent = "추가";
}

function openAddNodeDialog() {
  resetNodeDialog();
  $("#node-dialog").showModal();
  requestAnimationFrame(() => $("#node-form").elements.label.focus());
}

function openEditNodeDialog() {
  const entity = entityById(state.selectedEntityId);
  if (!entity) {
    notify("수정할 Node를 선택하세요.", "error");
    return;
  }
  editingNodeId = entity.id;
  const form = $("#node-form");
  form.elements.category.value = entity.category;
  form.elements.label.value = entity.label;
  form.elements.id.value = entity.id;
  $("#node-dialog-eyebrow").textContent = "EDIT NODE";
  $("#node-dialog-title").textContent = "Node 수정";
  $("#node-dialog-help").textContent = "Category를 변경해도 이 Node를 참조하는 기존 annotation은 유지됩니다. Instrument와 Other는 별도로 저장됩니다.";
  $("#confirm-node").textContent = "수정 저장";
  $("#node-dialog").showModal();
  requestAnimationFrame(() => form.elements.label.focus());
}

function replaceEntityReferences(oldId, newId) {
  state.sgRelations.forEach((record) => {
    if (record.subject_id === oldId) record.subject_id = newId;
    if (record.object_id === oldId) record.object_id = newId;
  });
  state.nodeStates.forEach((record) => { if (record.entity_id === oldId) record.entity_id = newId; });
  state.actions.forEach((record) => { if (record.actor_id === oldId) record.actor_id = newId; });
  state.legacyReviews.forEach((record) => { if (record.actor_id === oldId) record.actor_id = newId; });
}

function confirmNode(event) {
  event.preventDefault();
  const form = $("#node-form");
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const category = String(values.get("category"));
  if (!ENTITY_CATEGORIES.includes(category)) { notify("지원하지 않는 Node Category입니다.", "error"); return; }
  const label = String(values.get("label")).trim();
  if (!label) { notify("표시 이름을 입력하세요.", "error"); return; }
  const id = String(values.get("id") || "").trim() || (editingNodeId || `${category}_${slugify(label)}`);
  if (state.entities.some((entity) => entity.id === id && entity.id !== editingNodeId)) { notify("같은 Node ID가 이미 있습니다.", "error"); return; }

  if (editingNodeId) {
    const entity = entityById(editingNodeId);
    if (!entity) { notify("수정할 Node를 찾을 수 없습니다.", "error"); return; }
    const usedAsPerson = state.sgRelations.some((record) => record.subject_id === editingNodeId)
      || state.nodeStates.some((record) => record.entity_id === editingNodeId)
      || state.actions.some((record) => record.actor_id === editingNodeId);
    if (entity.category === "person" && category !== "person" && usedAsPerson) {
      notify("이 Node를 사람 역할로 사용한 annotation이 있어 Person 이외의 Category로 변경할 수 없습니다.", "error");
      return;
    }
    pushHistory();
    replaceEntityReferences(editingNodeId, id);
    const nextRole = category === "person"
      ? (entity.category === "person" && entity.user_created !== true ? entity.role : slugify(label))
      : undefined;
    const nextColor = category === entity.category ? entity.color : COLORS[category] || COLORS.other;
    Object.assign(entity, {
      id,
      category,
      role: nextRole,
      label,
      grounding_type: category === "person" ? "instance_mask" : "category_only",
      color: nextColor,
    });
    state.selectedEntityId = id;
    $("#node-dialog").close();
    resetNodeDialog();
    renderAll();
    autoSave();
    notify(`Node '${label}'를 수정했습니다.`);
    return;
  }

  pushHistory();
  state.entities.push({ id, category, role: category === "person" ? slugify(label) : undefined, label, grounding_type: category === "person" ? "instance_mask" : "category_only", color: COLORS[category] || COLORS.other, user_created: true });
  state.selectedEntityId = id;
  $("#node-dialog").close();
  resetNodeDialog();
  renderAll();
  selectEntity(id);
  autoSave();
  notify(`Node '${label}'를 추가했습니다.`);
}

function projectData() {
  state.video.fps = fps();
  return {
    version: 6,
    schema: "surgical-sg-annotation",
    saved_at: new Date().toISOString(),
    video: clone(state.video),
    vocabulary: {
      entity_categories: [...new Set(state.entities.map((entity) => entity.category))],
      predicates: [...state.predicates],
      field_zones: ["inside_left", "inside_right", "outside_left", "outside_right", "unknown"],
      actions: [...state.actionCatalog],
    },
    entities: clone(state.entities),
    grounding: {
      mode: "mock",
      is_placeholder: true,
      warning: "Mock mask geometry is for interface testing only and must not be used as segmentation ground truth.",
      tracks: clone(MOCK_GROUNDINGS),
    },
    sg_relations: clone(state.sgRelations),
    node_states: clone(state.nodeStates),
    actions: clone(state.actions),
    review_items: clone(state.legacyReviews),
    imports: clone(state.imports),
  };
}

function ensureUtilityEntities(entities) {
  const next = clone(entities || []);
  const unknown = DEFAULT_ENTITIES.find((entity) => entity.id === "other_unknown");
  if (unknown && !next.some((entity) => entity.id === unknown.id)) next.push(clone(unknown));
  return next;
}

function migrateProjectData(data) {
  const migrated = clone(data);
  const sourceVersion = Number(migrated.version || 0);

  const idMap = {};
  const entities = clone(migrated.entities || DEFAULT_ENTITIES);
  entities.forEach((entity) => {
    const previousId = entity.id;
    const mappedId = LEGACY_ENTITY_ID_MAP[previousId];
    if (mappedId) {
      entity.id = mappedId;
      idMap[previousId] = mappedId;
    }
    if (entity.category === "object") entity.category = "other";
    if (previousId === "object_unknown" && entity.label === "Unknown object") entity.label = "Unknown item";
    if (!entity.color || entity.category === "other") entity.color = COLORS[entity.category] || COLORS.other;
  });

  const uniqueEntities = [];
  const seenIds = new Set();
  entities.forEach((entity) => {
    if (!seenIds.has(entity.id)) {
      seenIds.add(entity.id);
      uniqueEntities.push(entity);
    }
  });

  if (sourceVersion < 5) {
    DEFAULT_ENTITIES.filter((entity) => entity.category === "person").forEach((canonical) => {
      const existing = uniqueEntities.find((entity) => entity.id === canonical.id);
      if (existing) Object.assign(existing, clone(canonical));
      else uniqueEntities.push(clone(canonical));
    });
  }

  migrated.entities = uniqueEntities;
  migrated.sg_relations = clone(migrated.sg_relations || []);
  migrated.node_states = clone(migrated.node_states || []);
  migrated.actions = clone(migrated.actions || []);
  migrated.review_items = clone(migrated.review_items || []);
  migrated.imports = clone(migrated.imports || []);
  migrated.sg_relations.forEach((record) => {
    record.subject_id = idMap[record.subject_id] || record.subject_id;
    record.object_id = idMap[record.object_id] || record.object_id;
  });
  migrated.node_states.forEach((record) => {
    record.entity_id = idMap[record.entity_id] || record.entity_id;
  });
  migrated.actions.forEach((record) => {
    record.actor_id = idMap[record.actor_id] || record.actor_id;
  });
  migrated.review_items.forEach((record) => {
    record.actor_id = idMap[record.actor_id] || record.actor_id;
  });
  migrated.version = 6;
  return migrated;
}

function isLegacyActionProject(data) {
  return Boolean(data && !data.schema && Array.isArray(data.annotations) && data.video && data.action_catalog);
}

function legacyActorId(instance) {
  const value = String(instance || "").trim().toLowerCase();
  if (value.includes("1st") || value.includes("first")) return "person_assistant_1";
  if (value.includes("2nd") || value.includes("second")) return "person_assistant_2";
  if (value.includes("scrub")) return "person_nurse_scrub";
  if (value.includes("circulator")) return "person_nurse_circulator";
  return "person_surgeon";
}

function buildLegacyActionImport(data) {
  const sourceFps = Number(data.video?.fps) > 0 ? Number(data.video.fps) : 30;
  const annotations = data.annotations.filter((record) => Number.isFinite(Number(record.start_frame)) && Number.isFinite(Number(record.end_frame)));
  const makeBase = (record) => ({
    actor_id: legacyActorId(record.instance),
    label: String(record.name || "").trim() || "Untitled legacy annotation",
    start_frame: Number(record.start_frame),
    end_frame: Number(record.end_frame),
    start_time: Number(record.start_frame) / sourceFps,
    end_time: Number(record.end_frame) / sourceFps,
    note: String(record.note || "").trim(),
    legacy_source_id: String(record.id || ""),
    legacy_source_kind: String(record.kind || ""),
  });
  return {
    sourceFps,
    sourceFrames: Number(data.video?.total_frames) || 0,
    sourceVideo: String(data.video?.path || ""),
    actions: annotations.filter((record) => record.kind === "action").map((record) => ({ ...makeBase(record), id: `legacy_action_${record.id || uid("source")}` })),
    reviews: annotations.filter((record) => record.kind === "triplet").map((record) => ({ ...makeBase(record), id: `legacy_review_${record.id || uid("source")}`, review_reason: "legacy_triplet" })),
  };
}

function importLegacyActionProject(data) {
  const prepared = buildLegacyActionImport(data);
  const knownSourceIds = new Set([
    ...state.actions.map((record) => record.legacy_source_id).filter(Boolean),
    ...state.legacyReviews.map((record) => record.legacy_source_id).filter(Boolean),
  ]);
  const actions = prepared.actions.filter((record) => !knownSourceIds.has(record.legacy_source_id));
  const reviews = prepared.reviews.filter((record) => !knownSourceIds.has(record.legacy_source_id));
  if (!actions.length && !reviews.length) {
    notify("가져올 새 Action 또는 검토 항목이 없습니다.");
    return null;
  }
  const loadedFrames = video.src ? state.video.total_frames : 0;
  const frameDifference = loadedFrames && prepared.sourceFrames ? Math.abs(loadedFrames - prepared.sourceFrames) : 0;
  const mismatch = frameDifference > Math.max(prepared.sourceFps * 2, prepared.sourceFrames * .005);
  const warning = mismatch ? `\n\n주의: 현재 영상(${loadedFrames.toLocaleString()} frames)과 JSON(${prepared.sourceFrames.toLocaleString()} frames)의 길이가 다릅니다.` : "";
  const message = `기존 Action ${actions.length}개와 검토 항목 ${reviews.length}개를 현재 프로젝트에 병합합니다.${warning}\n\n계속할까요?`;
  if (!confirm(message)) return null;

  pushHistory();
  state.actions.push(...actions);
  state.legacyReviews.push(...reviews);
  state.actionCatalog = [...new Set([...state.actionCatalog, ...actions.map((record) => record.label)])];
  state.imports.push({
    format: "legacy-jcm-v2",
    imported_at: new Date().toISOString(),
    source_video: prepared.sourceVideo,
    source_fps: prepared.sourceFps,
    source_total_frames: prepared.sourceFrames,
    action_count: actions.length,
    review_count: reviews.length,
  });
  $("#fps-input").value = String(prepared.sourceFps);
  state.video.fps = prepared.sourceFps;
  if (!video.src && prepared.sourceFrames) state.video.total_frames = prepared.sourceFrames;
  state.editing = null;
  renderAll();
  autoSave();
  return { actions: actions.length, reviews: reviews.length, mismatch };
}

function storageKey() { return `surgical-sg-annotator:${state.video.file || "untitled"}`; }

function autoSave() {
  try { localStorage.setItem(storageKey(), JSON.stringify(projectData())); } catch (_) { /* Browser storage can be unavailable. */ }
}

function saveDraft() {
  autoSave();
  notify("현재 브라우저에 임시 저장했습니다.");
}

function exportProject() {
  const data = projectData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const base = (state.video.file || "untitled").replace(/\.[^.]+$/, "");
  anchor.href = url;
  anchor.download = `${base}_sg_annotations.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("JSON을 내보냈습니다. Mock mask는 placeholder로 표시되어 있습니다.");
}

function importProject(data, rememberHistory = true) {
  if (!data || data.schema !== "surgical-sg-annotation") throw new Error("지원하지 않는 JSON 형식입니다.");
  const imported = migrateProjectData(data);
  if (rememberHistory) pushHistory();
  state.entities = ensureUtilityEntities(imported.entities || DEFAULT_ENTITIES);
  state.predicates = [...new Set([...DEFAULT_PREDICATES, ...(imported.vocabulary?.predicates || [])])];
  state.actionCatalog = [...(imported.vocabulary?.actions || DEFAULT_ACTIONS)];
  state.sgRelations = clone(imported.sg_relations || []);
  state.nodeStates = clone(imported.node_states || []);
  state.actions = clone(imported.actions || []);
  state.legacyReviews = clone(imported.review_items || []);
  state.imports = clone(imported.imports || []);
  if (imported.video?.fps) $("#fps-input").value = String(imported.video.fps);
  if (!state.video.file && imported.video) state.video = { ...state.video, ...clone(imported.video) };
  state.selectedEntityId = state.entities.find((entity) => entity.category === "person")?.id || state.entities[0]?.id;
  state.referenceRange = null;
  setWorkRange(0, 0, { updateContext: false });
  contextOpen = false;
  renderAll();
  autoSave();
}

function handleJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (isLegacyActionProject(data)) {
        const result = importLegacyActionProject(data);
        if (result) notify(`Action ${result.actions}개 · 검토 ${result.reviews}개를 가져왔습니다.`);
      } else {
        importProject(data);
        notify("JSON annotation을 불러왔습니다.");
      }
    }
    catch (error) { notify(error.message || "JSON을 읽지 못했습니다.", "error"); }
  };
  reader.readAsText(file);
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  try {
    context.registerTool({
      name: "get_annotation_summary",
      title: "Get annotation summary",
      description: "Read counts of SG relations, node states, actions, and nodes in the current project.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return { sg_relations: state.sgRelations.length, node_states: state.nodeStates.length, actions: state.actions.length, entities: state.entities.length, video: state.video.file || null }; },
    });
    context.registerTool({
      name: "add_sg_relation",
      title: "Add SG relation",
      description: "Add one subject-predicate-object relation over a frame interval to the visible annotation project.",
      inputSchema: {
        type: "object",
        properties: { subject_id: { type: "string" }, predicate: { type: "string" }, object_id: { type: "string" }, start_frame: { type: "integer", minimum: 0 }, end_frame: { type: "integer", minimum: 0 }, note: { type: "string" } },
        required: ["subject_id", "predicate", "object_id", "start_frame", "end_frame"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!entityById(input.subject_id) || !entityById(input.object_id)) throw new Error("Unknown entity id");
        if (!validateRange(input.start_frame, input.end_frame)) throw new Error("Invalid frame range");
        const saved = saveRecord("sg", { ...input, note: input.note || "", start_time: frameToTime(input.start_frame), end_time: frameToTime(input.end_frame), observed_in_views: [] });
        if (!saved) throw new Error("Duplicate SG relation in the same frame range");
        return { saved: true, total: state.sgRelations.length };
      },
    });
  } catch (_) { /* Feature is optional outside supported browsers. */ }
}

$("#video-file").addEventListener("change", (event) => { const file = event.target.files?.[0]; if (file) loadVideoFile(file); });
$("#json-file").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) handleJsonFile(file);
  event.target.value = "";
});
video.addEventListener("loadedmetadata", initializeVideoMetadata);
video.addEventListener("play", () => { updatePlayButton(); startRenderLoop(); });
video.addEventListener("pause", () => { updatePlayButton(); updateVideoReadout(); });
video.addEventListener("ended", updatePlayButton);
video.addEventListener("seeked", () => { updateVideoReadout(); drawMasks(); });
canvas.addEventListener("click", handleCanvasClick);
$("#play-toggle").addEventListener("click", () => { if (!video.src) return notify("먼저 영상을 열어주세요.", "error"); video.paused ? video.play() : video.pause(); });
$("#previous-frame").addEventListener("click", () => stepFrame(-1));
$("#next-frame").addEventListener("click", () => stepFrame(1));
$("#frame-jump-go").addEventListener("click", jumpToEnteredFrame);
$("#frame-jump-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") { event.preventDefault(); jumpToEnteredFrame(); }
});
$("#playback-rate").addEventListener("change", (event) => { video.playbackRate = Number(event.target.value); });
$("#fps-input").addEventListener("change", () => { state.video.fps = fps(); state.video.total_frames = Math.floor((state.video.duration || 0) * state.video.fps); renderTimeline(); updateVideoReadout(); autoSave(); });
$("#video-scrubber").addEventListener("input", (event) => {
  if (state.video.duration) video.currentTime = frameToTime(Number(event.target.value));
});
$("#mask-toggle").addEventListener("change", (event) => { state.masksVisible = event.target.checked; drawMasks(); });
$$(".tile-button").forEach((button) => button.addEventListener("click", () => setZoom(button.dataset.tile === "all" ? null : button.dataset.tile)));
$$(".annotation-tab").forEach((tab) => tab.addEventListener("click", () => activateForm(tab.dataset.form)));
$("#work-range-start").addEventListener("change", syncWorkRangeFromInputs);
$("#work-range-end").addEventListener("change", syncWorkRangeFromInputs);
$("#work-range-start-current").addEventListener("click", () => {
  const frame = currentFrame();
  setWorkRange(frame, Math.max(frame, Number($("#work-range-end").value) || 0));
});
$("#work-range-end-current").addEventListener("click", () => {
  const frame = currentFrame();
  setWorkRange(Math.min(frame, Number($("#work-range-start").value) || 0), frame);
});
$(".predicate-preset").addEventListener("change", (event) => {
  if (!event.target.value) return;
  $("#relation-form").elements.predicate.value = event.target.value;
  $("#relation-form").elements.predicate.focus();
});
$(".action-preset").addEventListener("change", (event) => {
  if (!event.target.value) return;
  $("#action-form").elements.label.value = event.target.value;
  $("#action-form").elements.label.focus();
});
$("#relation-form").addEventListener("submit", submitRelation);
$("#state-form").addEventListener("submit", submitState);
$("#action-form").addEventListener("submit", submitAction);
$("#add-node").addEventListener("click", openAddNodeDialog);
$("#edit-node").addEventListener("click", openEditNodeDialog);
$("#node-form").addEventListener("submit", confirmNode);
$$('.node-dialog-cancel').forEach((button) => button.addEventListener("click", () => {
  $("#node-dialog").close("cancel");
  resetNodeDialog();
}));
$("#node-dialog").addEventListener("cancel", resetNodeDialog);
$("#review-form").addEventListener("submit", confirmReviewEdit);
$$('.review-dialog-cancel').forEach((button) => button.addEventListener("click", () => {
  $("#review-dialog").close("cancel");
  resetReviewDialog();
}));
$("#review-dialog").addEventListener("cancel", resetReviewDialog);
$("#save-draft").addEventListener("click", saveDraft);
$("#export-json").addEventListener("click", exportProject);
$("#record-search").addEventListener("input", renderRecords);
$("#record-sort").addEventListener("change", renderRecords);
$$('[data-record-filter]').forEach((button) => button.addEventListener("click", () => {
  $$('.record-filter').forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderRecords();
}));
$$('[data-context-kind]').forEach((button) => button.addEventListener("click", () => {
  const nextKind = button.dataset.contextKind;
  contextOpen = !(contextOpen && contextKind === nextKind);
  contextKind = nextKind;
  renderContextBox();
}));
$("#context-close").addEventListener("click", () => {
  contextOpen = false;
  renderContextBox();
});
function setRecordsExpanded(expanded) {
  const panel = $(".records-panel");
  const button = $("#toggle-records");
  if (expanded) setVideoFocus(false);
  panel.classList.toggle("expanded", expanded);
  $(".app-shell").classList.toggle("review-mode", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  button.textContent = expanded ? "← 라벨 입력으로 돌아가기" : "▤ 기록 검토";
  requestAnimationFrame(() => {
    fitStage();
    drawMasks();
  });
}

function setVideoFocus(focused) {
  const shell = $(".app-shell");
  const button = $("#toggle-video-focus");
  shell.classList.toggle("video-focus-mode", focused);
  button.setAttribute("aria-pressed", String(focused));
  button.textContent = focused ? "라벨 입력 보기" : "영상 크게";
  requestAnimationFrame(() => { fitStage(); drawMasks(); });
}

$("#toggle-records").addEventListener("click", () => {
  setRecordsExpanded(!$(".records-panel").classList.contains("expanded"));
});
$("#toggle-video-focus").addEventListener("click", () => {
  setVideoFocus(!$(".app-shell").classList.contains("video-focus-mode"));
});
$("#undo").addEventListener("click", undo);
$("#redo").addEventListener("click", redo);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && contextOpen) {
    contextOpen = false;
    renderContextBox();
    return;
  }
  if (event.key === "Escape" && $(".records-panel").classList.contains("expanded")) {
    setRecordsExpanded(false);
    return;
  }
  if (event.key === "Escape" && $(".app-shell").classList.contains("video-focus-mode")) {
    setVideoFocus(false);
    return;
  }
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
  if (event.code === "Space") { event.preventDefault(); $("#play-toggle").click(); }
  const step = event.altKey ? 100 : event.shiftKey ? 10 : 1;
  if (event.code === "ArrowLeft") { event.preventDefault(); stepFrame(-step); }
  if (event.code === "ArrowRight") { event.preventDefault(); stepFrame(step); }
  if (event.key.toLowerCase() === "i") {
    const frame = currentFrame();
    setWorkRange(frame, Math.max(frame, Number($("#work-range-end").value) || 0));
  }
  if (event.key.toLowerCase() === "o") {
    const frame = currentFrame();
    setWorkRange(Math.min(frame, Number($("#work-range-start").value) || 0), frame);
  }
});

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => { fitStage(); drawMasks(); }).observe(stageSlot);
} else {
  window.addEventListener("resize", () => { fitStage(); drawMasks(); });
}
window.addEventListener("resize", fitAppFrame);
window.visualViewport?.addEventListener("resize", fitAppFrame);
window.addEventListener("pageshow", fitAppFrame);

fitAppFrame();
setWorkRange(0, 0, { updateContext: false });
renderAll();
fitStage();
registerWebMcpTools();
