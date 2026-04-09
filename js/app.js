import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnclosure, PRESETS, SCREW_SPECS } from './enclosure.js';
import { COMPONENTS } from './components.js';
import { exportSTL } from './exporter.js';

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(80, 100, 150);

// --- Renderer ---
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.target.set(0, 0, 0);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 100, 50);
scene.add(directionalLight);

// --- Grid ---
const gridHelper = new THREE.GridHelper(200, 40, 0x533483, 0x333355);
scene.add(gridHelper);

// --- Resize handler ---
function onResize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener('resize', onResize);

// --- Animation loop ---
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ============================================================
// App state
// ============================================================
export const state = {
  preset: '1590B',
  width: 60,
  depth: 112,
  height: 31,
  screwType: 'M3',
  placedComponents: [],
  selectedId: null,
  activeComponent: null,
  enclosure: null,
};

export { scene, camera, renderer, controls };

// ============================================================
// DOM references
// ============================================================
const presetSelect = document.getElementById('preset-select');
const customDimsDiv = document.getElementById('custom-dimensions');
const customWidth = document.getElementById('custom-width');
const customDepth = document.getElementById('custom-depth');
const customHeight = document.getElementById('custom-height');
const screwTypeSelect = document.getElementById('screw-type');
const dimensionsDisplay = document.getElementById('dimensions-display');
const snapToggle = document.getElementById('snap-toggle');
const propXInput = document.getElementById('prop-x');
const propYInput = document.getElementById('prop-y');

// ============================================================
// Raycasting setup
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** Convert pointer event to normalized device coords relative to the viewport */
function getNDC(event) {
  const rect = viewport.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return mouse;
}

// ============================================================
// Ghost preview + component placement state
// ============================================================
let ghostMesh = null;
let ghostValid = false;
let ghostFace = null;
const markerMeshes = [];
let nextComponentId = 1;

// Drag state
let isDragging = false;
let dragComponentId = null;
let pointerDownPos = null;
let pointerMoved = false;
const DRAG_THRESHOLD = 4; // pixels

// ============================================================
// Geometry / mesh helpers
// ============================================================

/** Create a ring or plane mesh for a component (ghost or placed marker) */
function createComponentMesh(comp, opts) {
  let geo;
  if (comp.holeShape === 'circle') {
    const outerR = comp.holeDiameter / 2 + 1;
    const innerR = Math.max(0.1, comp.holeDiameter / 2 - 1);
    geo = new THREE.RingGeometry(innerR, outerR, 32);
  } else {
    // Build a rectangular ring (outline) for roundrect holes
    const w = comp.holeWidth;
    const h = comp.holeHeight;
    const t = 1; // ring thickness
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 - t, -h / 2 - t);
    shape.lineTo(w / 2 + t, -h / 2 - t);
    shape.lineTo(w / 2 + t, h / 2 + t);
    shape.lineTo(-w / 2 - t, h / 2 + t);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-w / 2, -h / 2);
    hole.lineTo(w / 2, -h / 2);
    hole.lineTo(w / 2, h / 2);
    hole.lineTo(-w / 2, h / 2);
    hole.closePath();
    shape.holes.push(hole);
    geo = new THREE.ShapeGeometry(shape);
  }

  const mat = new THREE.MeshBasicMaterial({
    color: opts.color,
    transparent: opts.transparent !== undefined ? opts.transparent : true,
    opacity: opts.opacity !== undefined ? opts.opacity : 0.6,
    side: THREE.DoubleSide,
    depthTest: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

/** Dispose geometry + material, remove from scene */
function disposeMesh(mesh) {
  if (!mesh) return;
  mesh.geometry.dispose();
  mesh.material.dispose();
  scene.remove(mesh);
}

// ============================================================
// Face coordinate helpers
// ============================================================

/** Face dimensions in local (u, v) space.
 *  Side faces use bottomH (the box wall height) since the lid sits on top. */
function getFaceDims(face, dims) {
  switch (face) {
    case 'top':   return { uSize: dims.outerW, vSize: dims.outerD };
    case 'front':
    case 'back':  return { uSize: dims.outerW, vSize: dims.bottomH };
    case 'left':
    case 'right': return { uSize: dims.outerD, vSize: dims.bottomH };
    default:      return { uSize: 100, vSize: 100 };
  }
}

/** Half-extents of the hole for edge clamping */
function getHoleHalf(comp) {
  if (comp.holeShape === 'circle') {
    const r = comp.holeDiameter / 2 + 1;
    return { hu: r, hv: r };
  }
  return { hu: comp.holeWidth / 2, hv: comp.holeHeight / 2 };
}

/** World point -> face-local (u, v) centered at face center */
function worldToLocal(face, point) {
  switch (face) {
    case 'top':   return { u: point.x, v: point.z };
    case 'front':
    case 'back':  return { u: point.x, v: point.y };
    case 'left':
    case 'right': return { u: point.z, v: point.y };
    default:      return { u: 0, v: 0 };
  }
}

/** Face-local (u, v) -> world position (with small offset to avoid z-fighting) */
function localToWorld(face, u, v, dims) {
  const topY = dims.bottomH + dims.lidThick;
  switch (face) {
    case 'top':   return new THREE.Vector3(u, topY + 0.1, v);
    case 'front': return new THREE.Vector3(u, v, dims.outerD / 2 + 0.1);
    case 'back':  return new THREE.Vector3(u, v, -dims.outerD / 2 - 0.1);
    case 'left':  return new THREE.Vector3(-dims.outerW / 2 - 0.1, v, u);
    case 'right': return new THREE.Vector3(dims.outerW / 2 + 0.1, v, u);
    default:      return new THREE.Vector3(0, 0, 0);
  }
}

/** Rotation to orient a mesh flat on a face */
function getFaceRotation(face) {
  switch (face) {
    case 'top':   return new THREE.Euler(-Math.PI / 2, 0, 0);
    case 'front': return new THREE.Euler(0, 0, 0);
    case 'back':  return new THREE.Euler(0, Math.PI, 0);
    case 'left':  return new THREE.Euler(0, Math.PI / 2, 0);
    case 'right': return new THREE.Euler(0, -Math.PI / 2, 0);
    default:      return new THREE.Euler(0, 0, 0);
  }
}

/** Snap to 0.5mm grid + clamp to face edges */
function constrainUV(u, v, comp, face, dims) {
  if (snapToggle && snapToggle.checked) {
    u = Math.round(u / 0.5) * 0.5;
    v = Math.round(v / 0.5) * 0.5;
  }

  const { uSize, vSize } = getFaceDims(face, dims);
  const { hu, hv } = getHoleHalf(comp);
  const uMax = uSize / 2 - hu - 1;
  const vMax = vSize / 2 - hv - 1;

  u = Math.max(-uMax, Math.min(uMax, u));
  v = Math.max(-vMax, Math.min(vMax, v));
  return { u, v };
}

// ============================================================
// Ghost preview management
// ============================================================

function updateGhost() {
  disposeMesh(ghostMesh);
  ghostMesh = null;
  ghostValid = false;
  ghostFace = null;

  if (!state.activeComponent) return;
  const comp = COMPONENTS[state.activeComponent];
  if (!comp) return;

  ghostMesh = createComponentMesh(comp, {
    color: 0x00ff88, transparent: true, opacity: 0.5,
  });
  ghostMesh.visible = false;
  scene.add(ghostMesh);
}

// ============================================================
// Selection
// ============================================================

function selectComponent(id) {
  deselectComponent();
  if (id == null) return;

  state.selectedId = id;
  const placed = state.placedComponents.find(c => c.id === id);
  if (!placed) return;

  const marker = markerMeshes.find(m => m.userData.componentId === id);
  if (marker) marker.material.color.setHex(0x4488ff);

  const propsPanel = document.getElementById('properties-panel');
  if (propsPanel) propsPanel.classList.remove('hidden');
  if (propXInput) propXInput.value = placed.localPos.u.toFixed(1);
  if (propYInput) propYInput.value = placed.localPos.v.toFixed(1);

  updatePlacedList();
}

function deselectComponent() {
  if (state.selectedId != null) {
    const placed = state.placedComponents.find(c => c.id === state.selectedId);
    const marker = markerMeshes.find(m => m.userData.componentId === state.selectedId);
    if (marker && placed) {
      const comp = COMPONENTS[placed.type];
      if (comp) marker.material.color.setHex(comp.color);
    }
  }
  state.selectedId = null;
  const propsPanel = document.getElementById('properties-panel');
  if (propsPanel) propsPanel.classList.add('hidden');
  updatePlacedList();
}

// ============================================================
// Placed list UI + part count
// ============================================================

function updatePlacedList() {
  const listEl = document.getElementById('placed-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  for (const placed of state.placedComponents) {
    const comp = COMPONENTS[placed.type];
    const div = document.createElement('div');
    div.className = 'placed-item';
    if (placed.id === state.selectedId) div.classList.add('selected');
    div.textContent = `${comp ? comp.name : placed.type} (${placed.face})`;
    div.addEventListener('click', () => selectComponent(placed.id));
    listEl.appendChild(div);
  }
}

function updatePartCount() {
  const el = document.getElementById('part-count');
  if (el) el.textContent = `Parts: ${state.placedComponents.length}`;
}

// ============================================================
// Place / delete / move component
// ============================================================

function placeComponent(compKey, face, u, v) {
  const comp = COMPONENTS[compKey];
  if (!comp) return;

  const dims = state.enclosure.dims;
  const constrained = constrainUV(u, v, comp, face, dims);
  const worldPos = localToWorld(face, constrained.u, constrained.v, dims);

  const id = nextComponentId++;
  const marker = createComponentMesh(comp, {
    color: comp.color,
    transparent: comp.holeShape === 'roundrect',
    opacity: comp.holeShape === 'roundrect' ? 0.8 : 1.0,
    wireframe: false,
  });
  marker.position.copy(worldPos);
  marker.rotation.copy(getFaceRotation(face));
  marker.userData.componentId = id;
  scene.add(marker);
  markerMeshes.push(marker);

  state.placedComponents.push({
    id,
    type: compKey,
    face,
    position: { x: worldPos.x, y: worldPos.y, z: worldPos.z },
    localPos: { u: constrained.u, v: constrained.v },
  });

  updatePlacedList();
  updatePartCount();
  return id;
}

function deleteComponent(id) {
  const idx = state.placedComponents.findIndex(c => c.id === id);
  if (idx === -1) return;
  state.placedComponents.splice(idx, 1);

  const mIdx = markerMeshes.findIndex(m => m.userData.componentId === id);
  if (mIdx !== -1) {
    disposeMesh(markerMeshes[mIdx]);
    markerMeshes.splice(mIdx, 1);
  }

  if (state.selectedId === id) {
    state.selectedId = null;
    const propsPanel = document.getElementById('properties-panel');
    if (propsPanel) propsPanel.classList.add('hidden');
  }

  updatePlacedList();
  updatePartCount();
}

function moveComponent(id, u, v) {
  const placed = state.placedComponents.find(c => c.id === id);
  if (!placed) return;

  const comp = COMPONENTS[placed.type];
  const dims = state.enclosure.dims;
  const constrained = constrainUV(u, v, comp, placed.face, dims);
  const worldPos = localToWorld(placed.face, constrained.u, constrained.v, dims);

  placed.localPos.u = constrained.u;
  placed.localPos.v = constrained.v;
  placed.position = { x: worldPos.x, y: worldPos.y, z: worldPos.z };

  const marker = markerMeshes.find(m => m.userData.componentId === id);
  if (marker) marker.position.copy(worldPos);
}

// ============================================================
// Pointer event handlers (on renderer canvas via viewport)
// ============================================================

viewport.addEventListener('pointermove', (e) => {
  // Track drag distance
  if (pointerDownPos) {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
      pointerMoved = true;
    }
  }

  if (!state.enclosure) return;

  // --- Dragging a placed component ---
  if (isDragging && dragComponentId != null) {
    getNDC(e);
    raycaster.setFromCamera(mouse, camera);

    const placed = state.placedComponents.find(c => c.id === dragComponentId);
    if (!placed) return;

    const facePlane = state.enclosure.facesMeshes[placed.face];
    if (!facePlane) return;

    const hits = raycaster.intersectObject(facePlane);
    if (hits.length > 0) {
      const local = worldToLocal(placed.face, hits[0].point);
      moveComponent(dragComponentId, local.u, local.v);

      if (propXInput) propXInput.value = placed.localPos.u.toFixed(1);
      if (propYInput) propYInput.value = placed.localPos.v.toFixed(1);
    }
    return;
  }

  // --- Ghost preview (only when not dragging and a component is active) ---
  if (!state.activeComponent || !ghostMesh) return;

  getNDC(e);
  raycaster.setFromCamera(mouse, camera);

  const facePlanes = Object.values(state.enclosure.facesMeshes);
  const hits = raycaster.intersectObjects(facePlanes);

  if (hits.length === 0) {
    ghostMesh.visible = false;
    ghostFace = null;
    return;
  }

  const hit = hits[0];
  const face = hit.object.userData.face;
  const comp = COMPONENTS[state.activeComponent];
  if (!comp) { ghostMesh.visible = false; return; }

  const isValid = comp.validFaces.includes(face);
  ghostValid = isValid;
  ghostFace = face;

  const local = worldToLocal(face, hit.point);
  const dims = state.enclosure.dims;
  const constrained = constrainUV(local.u, local.v, comp, face, dims);
  const worldPos = localToWorld(face, constrained.u, constrained.v, dims);

  ghostMesh.position.copy(worldPos);
  ghostMesh.rotation.copy(getFaceRotation(face));
  ghostMesh.material.color.setHex(isValid ? 0x00ff88 : 0xff4444);
  ghostMesh.visible = true;
});

viewport.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerMoved = false;

  // Check if clicking on a selected marker to start drag
  if (!state.activeComponent && state.selectedId != null) {
    getNDC(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(markerMeshes);
    if (hits.length > 0 && hits[0].object.userData.componentId === state.selectedId) {
      isDragging = true;
      dragComponentId = state.selectedId;
      controls.enabled = false;
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }
});

viewport.addEventListener('pointerup', (e) => {
  const wasDragging = isDragging;

  if (isDragging) {
    isDragging = false;
    dragComponentId = null;
    controls.enabled = true;
    viewport.releasePointerCapture(e.pointerId);
  }

  // If it was a real drag (pointer moved), just stop -- don't interpret as click
  if (wasDragging && pointerMoved) {
    pointerDownPos = null;
    return;
  }

  const wasClick = !pointerMoved;
  pointerDownPos = null;
  if (!wasClick) return;

  // --- Click to place ---
  if (state.activeComponent && ghostMesh && ghostMesh.visible && ghostValid && ghostFace) {
    const local = worldToLocal(ghostFace, ghostMesh.position);
    placeComponent(state.activeComponent, ghostFace, local.u, local.v);
    return;
  }

  // --- Click to select a placed marker ---
  if (!state.activeComponent) {
    getNDC(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(markerMeshes);
    if (hits.length > 0) {
      selectComponent(hits[0].object.userData.componentId);
      return;
    }
  }

  // --- Click empty space -> deselect ---
  deselectComponent();
});

// ============================================================
// Properties panel inputs
// ============================================================

function onPropChange() {
  if (state.selectedId == null) return;
  const u = parseFloat(propXInput.value) || 0;
  const v = parseFloat(propYInput.value) || 0;
  moveComponent(state.selectedId, u, v);

  const placed = state.placedComponents.find(c => c.id === state.selectedId);
  if (placed) {
    propXInput.value = placed.localPos.u.toFixed(1);
    propYInput.value = placed.localPos.v.toFixed(1);
  }
}
if (propXInput) propXInput.addEventListener('change', onPropChange);
if (propYInput) propYInput.addEventListener('change', onPropChange);

// ============================================================
// Delete button + keyboard shortcuts
// ============================================================

const deleteBtn = document.getElementById('delete-component');
if (deleteBtn) {
  deleteBtn.addEventListener('click', () => {
    if (state.selectedId != null) deleteComponent(state.selectedId);
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    // Deactivate component tool
    const list = document.getElementById('component-list');
    if (list) {
      const active = list.querySelector('.component-btn.active');
      if (active) active.classList.remove('active');
    }
    state.activeComponent = null;
    updateGhost();
    deselectComponent();
  }

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (state.selectedId != null) deleteComponent(state.selectedId);
  }
});

// ============================================================
// rebuildEnclosure (base + component re-validation)
// ============================================================

export function rebuildEnclosure() {
  // Remove old enclosure objects from scene and dispose GPU resources
  if (state.enclosure) {
    const disposeGroup = (group) => {
      group.traverse(child => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
      scene.remove(group);
    };
    disposeGroup(state.enclosure.bottomGroup);
    disposeGroup(state.enclosure.lidGroup);
    for (const plane of Object.values(state.enclosure.facesMeshes)) {
      plane.geometry.dispose();
      scene.remove(plane);
    }
  }

  // Create new enclosure
  const enc = createEnclosure(state.width, state.depth, state.height, state.screwType);
  state.enclosure = enc;

  // Add to scene
  scene.add(enc.bottomGroup);
  scene.add(enc.lidGroup);
  for (const plane of Object.values(enc.facesMeshes)) {
    scene.add(plane);
  }

  // Update dimensions display
  if (dimensionsDisplay) {
    dimensionsDisplay.textContent =
      `Dimensions: ${enc.dims.outerW} \u00d7 ${enc.dims.outerD} \u00d7 ${enc.dims.bottomH + enc.dims.lidThick} mm` +
      ` (inner ${enc.dims.width} \u00d7 ${enc.dims.depth} \u00d7 ${enc.dims.height})`;
  }

  // Center camera target on enclosure center
  const centerY = (enc.dims.bottomH + enc.dims.lidThick) / 2;
  controls.target.set(0, centerY, 0);

  // --- Re-validate placed components after enclosure change ---
  if (state.placedComponents.length > 0) {
    const dims = enc.dims;
    const toRemove = [];

    for (const placed of state.placedComponents) {
      const comp = COMPONENTS[placed.type];
      if (!comp) { toRemove.push(placed.id); continue; }

      const { uSize, vSize } = getFaceDims(placed.face, dims);
      const { hu, hv } = getHoleHalf(comp);
      if (uSize / 2 - hu - 1 < 0 || vSize / 2 - hv - 1 < 0) {
        toRemove.push(placed.id);
        continue;
      }

      // Clamp to new bounds
      const constrained = constrainUV(placed.localPos.u, placed.localPos.v, comp, placed.face, dims);
      placed.localPos.u = constrained.u;
      placed.localPos.v = constrained.v;

      const worldPos = localToWorld(placed.face, constrained.u, constrained.v, dims);
      placed.position = { x: worldPos.x, y: worldPos.y, z: worldPos.z };

      const marker = markerMeshes.find(m => m.userData.componentId === placed.id);
      if (marker) {
        marker.position.copy(worldPos);
        marker.rotation.copy(getFaceRotation(placed.face));
      }
    }

    for (const id of toRemove) deleteComponent(id);
  }

  updateGhost();
}

// ============================================================
// Event handlers
// ============================================================

presetSelect.addEventListener('change', () => {
  const val = presetSelect.value;
  state.preset = val;

  if (val === 'custom') {
    customDimsDiv.classList.remove('hidden');
    state.width = parseFloat(customWidth.value) || 60;
    state.depth = parseFloat(customDepth.value) || 112;
    state.height = parseFloat(customHeight.value) || 31;
  } else {
    customDimsDiv.classList.add('hidden');
    const p = PRESETS[val];
    state.width = p.width;
    state.depth = p.depth;
    state.height = p.height;
  }

  rebuildEnclosure();
});

for (const [input, key] of [[customWidth, 'width'], [customDepth, 'depth'], [customHeight, 'height']]) {
  input.addEventListener('change', () => {
    state[key] = parseFloat(input.value) || state[key];
    rebuildEnclosure();
  });
}

screwTypeSelect.addEventListener('change', () => {
  state.screwType = screwTypeSelect.value;
  rebuildEnclosure();
});

// ============================================================
// Component panel (with ghost management)
// ============================================================

function populateComponentPanel() {
  const list = document.getElementById('component-list');
  if (!list) return;
  list.innerHTML = '';

  for (const [key, comp] of Object.entries(COMPONENTS)) {
    const btn = document.createElement('button');
    btn.className = 'component-btn';
    btn.textContent = comp.name;
    btn.dataset.type = key;

    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        state.activeComponent = null;
      } else {
        const prev = list.querySelector('.component-btn.active');
        if (prev) prev.classList.remove('active');
        btn.classList.add('active');
        state.activeComponent = key;
      }
      deselectComponent();
      updateGhost();
    });

    list.appendChild(btn);
  }
}

// ============================================================
// Export STL
// ============================================================

const exportBtn = document.getElementById('export-stl');
if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    if (!state.enclosure) return;

    exportBtn.disabled = true;
    const origText = exportBtn.textContent;
    exportBtn.textContent = 'Exporting...';

    try {
      await exportSTL(
        state.enclosure.dims,
        state.screwType,
        state.enclosure.screwPositions,
        state.placedComponents,
        COMPONENTS
      );
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = origText;
    }
  });
}

// ============================================================
// Initial build
// ============================================================
rebuildEnclosure();
populateComponentPanel();

export { COMPONENTS };
