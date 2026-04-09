import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEnclosure, PRESETS, SCREW_SPECS } from './enclosure.js';

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

// ============================================================
// rebuildEnclosure
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
      `Dimensions: ${enc.dims.outerW} × ${enc.dims.outerD} × ${enc.dims.bottomH + enc.dims.lidThick} mm` +
      ` (inner ${enc.dims.width} × ${enc.dims.depth} × ${enc.dims.height})`;
  }

  // Center camera target on enclosure center
  const centerY = (enc.dims.bottomH + enc.dims.lidThick) / 2;
  controls.target.set(0, centerY, 0);
}

// ============================================================
// Event handlers
// ============================================================

// Preset select
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

// Custom dimension inputs
for (const [input, key] of [[customWidth, 'width'], [customDepth, 'depth'], [customHeight, 'height']]) {
  input.addEventListener('change', () => {
    state[key] = parseFloat(input.value) || state[key];
    rebuildEnclosure();
  });
}

// Screw type
screwTypeSelect.addEventListener('change', () => {
  state.screwType = screwTypeSelect.value;
  rebuildEnclosure();
});

// ============================================================
// Initial build
// ============================================================
rebuildEnclosure();
