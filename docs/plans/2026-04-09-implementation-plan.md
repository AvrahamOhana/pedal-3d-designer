# Guitar Pedal Enclosure Designer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based tool for designing 3D-printable guitar pedal enclosures with placeable component holes, exporting as STL.

**Architecture:** Single-page vanilla JS app. Three.js renders the 3D viewport. three-bvh-csg performs boolean subtraction of holes at export time. All client-side, no backend. Deployed to GitHub Pages.

**Tech Stack:** Three.js 0.183.2, three-bvh-csg 0.0.18, three-mesh-bvh 0.9.9, JSZip 3.10.1 — all via CDN importmap. No build step.

**Design doc:** `docs/plans/2026-04-09-pedal-enclosure-designer-design.md`

---

### Task 1: Project Skeleton — HTML + CSS + Three.js Viewport

**Files:**
- Create: `index.html`
- Create: `style.css`
- Create: `js/app.js`

**Step 1: Create index.html with importmap and layout**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedal Enclosure Designer</title>
    <link rel="stylesheet" href="style.css">
    <script type="importmap">
    {
        "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.183.2/+esm",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/",
            "three-mesh-bvh": "https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.9.9/+esm",
            "three-bvh-csg": "https://cdn.jsdelivr.net/npm/three-bvh-csg@0.0.18/+esm",
            "jszip": "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
        }
    }
    </script>
</head>
<body>
    <div id="toolbar">
        <select id="preset-select">
            <option value="1590A">1590A (39x89x27)</option>
            <option value="1590B" selected>1590B (60x112x31)</option>
            <option value="1590BB">1590BB (72x120x31)</option>
            <option value="1590XX">1590XX (121x145x34)</option>
            <option value="custom">Custom...</option>
        </select>
        <div id="custom-dims" style="display:none;">
            <label>W<input type="number" id="custom-w" value="60" min="20" max="300">mm</label>
            <label>D<input type="number" id="custom-d" value="112" min="20" max="300">mm</label>
            <label>H<input type="number" id="custom-h" value="31" min="15" max="100">mm</label>
        </div>
        <select id="screw-select">
            <option value="M3" selected>M3 Screws</option>
            <option value="M2.5">M2.5 Screws</option>
        </select>
        <button id="export-btn">Export STL</button>
    </div>
    <div id="main">
        <div id="panel">
            <h3>Components</h3>
            <div id="component-list"></div>
            <h3>Placed</h3>
            <div id="placed-list"></div>
            <div id="properties" style="display:none;">
                <h3>Properties</h3>
                <label>X <input type="number" id="prop-x" step="0.5">mm</label>
                <label>Y <input type="number" id="prop-y" step="0.5">mm</label>
                <button id="delete-btn">Delete</button>
            </div>
        </div>
        <div id="viewport"></div>
    </div>
    <div id="status-bar">
        <span id="dimensions-display"></span>
        <span id="part-count"></span>
        <span id="snap-toggle"><label><input type="checkbox" id="snap-enabled" checked> Snap 0.5mm</label></span>
    </div>
    <script type="module" src="js/app.js"></script>
</body>
</html>
```

**Step 2: Create style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

#toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
}

#toolbar select, #toolbar button, #toolbar input {
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #533483;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
}

#toolbar button {
    background: #533483;
    cursor: pointer;
    font-weight: bold;
}

#toolbar button:hover { background: #6a42a0; }

#custom-dims { display: flex; gap: 8px; align-items: center; }
#custom-dims input { width: 60px; }
#custom-dims label { font-size: 12px; display: flex; align-items: center; gap: 4px; }

#main {
    flex: 1;
    display: flex;
    overflow: hidden;
}

#panel {
    width: 220px;
    background: #16213e;
    border-right: 1px solid #0f3460;
    padding: 12px;
    overflow-y: auto;
}

#panel h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #a0a0c0;
    margin: 12px 0 8px;
}

#panel h3:first-child { margin-top: 0; }

.component-btn {
    display: block;
    width: 100%;
    padding: 8px;
    margin-bottom: 4px;
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
}

.component-btn:hover { border-color: #533483; }
.component-btn.active { border-color: #e94560; background: #1a1a4e; }

.placed-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    margin-bottom: 2px;
    font-size: 12px;
    border-radius: 3px;
    cursor: pointer;
}

.placed-item:hover { background: #0f3460; }
.placed-item.selected { background: #1a1a4e; border: 1px solid #e94560; }

#properties {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #0f3460;
}

#properties label {
    display: block;
    font-size: 12px;
    margin-bottom: 6px;
}

#properties input {
    width: 80px;
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #533483;
    padding: 4px 6px;
    border-radius: 3px;
    margin-left: 4px;
}

#delete-btn {
    margin-top: 8px;
    background: #e94560;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

#viewport {
    flex: 1;
    position: relative;
}

#status-bar {
    display: flex;
    gap: 20px;
    padding: 6px 16px;
    background: #16213e;
    border-top: 1px solid #0f3460;
    font-size: 12px;
    color: #a0a0c0;
}

#status-bar label { cursor: pointer; }
#status-bar input[type="checkbox"] { margin-right: 4px; }
```

**Step 3: Create js/app.js with basic Three.js scene**

```js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---- Scene Setup ----
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(80, 100, 150);

const renderer = new THREE.WebGLRenderer({ antialias: true });
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// Grid helper
const grid = new THREE.GridHelper(200, 40, 0x333355, 0x222244);
scene.add(grid);

// Resize handler
function resize() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();

// Render loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

console.log('Pedal Enclosure Designer loaded');
```

**Step 4: Verify in browser**

Open `index.html` in a browser (or use a local server). You should see:
- Dark UI with toolbar, left panel, 3D viewport with grid, status bar
- Orbit controls working (drag to rotate, scroll to zoom)

**Step 5: Commit**

```bash
git add index.html style.css js/app.js
git commit -m "feat: project skeleton with Three.js viewport"
```

---

### Task 2: Enclosure Geometry — Parametric Box Generation

**Files:**
- Create: `js/enclosure.js`
- Modify: `js/app.js`

**Step 1: Create js/enclosure.js with enclosure generation**

This module generates the visual preview meshes for the enclosure (bottom box + lid). These are NOT the CSG meshes — those are generated at export time. These are simplified visual representations.

```js
import * as THREE from 'three';

export const PRESETS = {
    '1590A':  { width: 39,  depth: 89,  height: 27 },
    '1590B':  { width: 60,  depth: 112, height: 31 },
    '1590BB': { width: 72,  depth: 120, height: 31 },
    '1590XX': { width: 121, depth: 145, height: 34 },
};

export const SCREW_SPECS = {
    'M3':  { bossOuter: 8, bossHole: 4.0, throughHole: 3.2, depth: 5 },
    'M2.5': { bossOuter: 7, bossHole: 3.5, throughHole: 2.7, depth: 4.5 },
};

const WALL = 2;         // wall thickness mm
const CORNER_R = 2;     // corner radius mm
const LID_THICK = 2;    // lid plate thickness
const LIP = 1.5;        // lid lip height that sits inside bottom

/**
 * Creates enclosure preview meshes.
 * Returns { bottomGroup, lidGroup, facesMeshes, screwPositions, dims }
 * - facesMeshes: object with top/front/back/left/right invisible meshes for raycasting
 */
export function createEnclosure(width, depth, height, screwType = 'M3') {
    const screw = SCREW_SPECS[screwType];
    const bottomGroup = new THREE.Group();
    const lidGroup = new THREE.Group();

    // Bottom half: open-top box
    // Outer dimensions include walls
    const outerW = width + WALL * 2;
    const outerD = depth + WALL * 2;
    const bottomH = height - LID_THICK;

    // Simple box for bottom (open top simulated by inner cutout visual)
    const bottomGeo = new THREE.BoxGeometry(outerW, bottomH, outerD);
    const bottomMat = new THREE.MeshStandardMaterial({
        color: 0x4a90d9,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.position.y = bottomH / 2;
    bottomGroup.add(bottomMesh);

    // Screw bosses in corners (cylinders on inside of bottom)
    const bossH = bottomH - WALL;
    const screwPositions = [];
    const insetX = WALL + screw.bossOuter / 2 + 1;
    const insetZ = WALL + screw.bossOuter / 2 + 1;
    const corners = [
        [-(outerW / 2 - insetX), (outerD / 2 - insetZ)],
        [(outerW / 2 - insetX),  (outerD / 2 - insetZ)],
        [-(outerW / 2 - insetX), -(outerD / 2 - insetZ)],
        [(outerW / 2 - insetX),  -(outerD / 2 - insetZ)],
    ];

    corners.forEach(([cx, cz]) => {
        const bossGeo = new THREE.CylinderGeometry(screw.bossOuter / 2, screw.bossOuter / 2, bossH, 16);
        const bossMat = new THREE.MeshStandardMaterial({ color: 0x3a7bc8 });
        const boss = new THREE.Mesh(bossGeo, bossMat);
        boss.position.set(cx, WALL + bossH / 2, cz);
        bottomGroup.add(boss);
        screwPositions.push({ x: cx, z: cz });
    });

    // Lid: flat plate
    const lidGeo = new THREE.BoxGeometry(outerW, LID_THICK, outerD);
    const lidMat = new THREE.MeshStandardMaterial({
        color: 0x5ba0e9,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
    });
    const lidMesh = new THREE.Mesh(lidGeo, lidMat);
    lidMesh.position.y = bottomH + LID_THICK / 2;
    lidGroup.add(lidMesh);

    // Invisible face meshes for raycasting (component placement)
    const faceMat = new THREE.MeshBasicMaterial({ visible: false });
    const facesMeshes = {};

    // Top face (on lid)
    const topFace = new THREE.Mesh(new THREE.PlaneGeometry(outerW, outerD), faceMat);
    topFace.rotation.x = -Math.PI / 2;
    topFace.position.y = bottomH + LID_THICK;
    topFace.userData.face = 'top';
    facesMeshes.top = topFace;

    // Front face (positive Z)
    const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(outerW, bottomH), faceMat);
    frontFace.position.set(0, bottomH / 2, outerD / 2);
    frontFace.userData.face = 'front';
    facesMeshes.front = frontFace;

    // Back face (negative Z)
    const backFace = new THREE.Mesh(new THREE.PlaneGeometry(outerW, bottomH), faceMat);
    backFace.position.set(0, bottomH / 2, -outerD / 2);
    backFace.rotation.y = Math.PI;
    backFace.userData.face = 'back';
    facesMeshes.back = backFace;

    // Left face (negative X)
    const leftFace = new THREE.Mesh(new THREE.PlaneGeometry(outerD, bottomH), faceMat);
    leftFace.position.set(-outerW / 2, bottomH / 2, 0);
    leftFace.rotation.y = -Math.PI / 2;
    leftFace.userData.face = 'left';
    facesMeshes.left = leftFace;

    // Right face (positive X)
    const rightFace = new THREE.Mesh(new THREE.PlaneGeometry(outerD, bottomH), faceMat);
    rightFace.position.set(outerW / 2, bottomH / 2, 0);
    rightFace.rotation.y = Math.PI / 2;
    rightFace.userData.face = 'right';
    facesMeshes.right = rightFace;

    return {
        bottomGroup,
        lidGroup,
        facesMeshes,
        screwPositions,
        dims: { width, depth, height, outerW, outerD, bottomH, wall: WALL, lidThick: LID_THICK, lip: LIP },
    };
}
```

**Step 2: Wire enclosure into app.js**

Add to `js/app.js`:
- Import `createEnclosure` and `PRESETS`
- State object holding current preset, dimensions, placed components
- Function `rebuildEnclosure()` that clears and recreates the enclosure meshes
- Preset selector change handler
- Custom dimension inputs handler
- Update dimensions display in status bar

**Step 3: Verify**

Open in browser. Should see blue semi-transparent box with screw bosses. Changing preset dropdown rebuilds the box. Custom option shows dimension inputs.

**Step 4: Commit**

```bash
git add js/enclosure.js js/app.js
git commit -m "feat: parametric enclosure generation with presets"
```

---

### Task 3: Component Definitions

**Files:**
- Create: `js/components.js`
- Modify: `js/app.js`

**Step 1: Create js/components.js**

```js
/**
 * Component definitions for placeable parts.
 * All dimensions in mm.
 * holeShape: 'circle' | 'roundrect'
 * For circle: holeDiameter (includes 0.2mm FDM tolerance)
 * For roundrect: holeWidth, holeHeight, holeRadius
 * validFaces: array of face names where component can be placed
 * color: hex color for preview ring
 */
export const COMPONENTS = {
    footswitch: {
        name: 'Footswitch (3PDT)',
        holeShape: 'circle',
        holeDiameter: 12.2,  // 12mm + 0.2 tolerance
        validFaces: ['top'],
        color: 0xe94560,
        reinforced: true,
        reinforceOuter: 28,  // outer ring diameter
        reinforceThick: 2,   // extra thickness
        ribCount: 4,
    },
    led5mm: {
        name: 'LED (5mm)',
        holeShape: 'circle',
        holeDiameter: 5.7,
        validFaces: ['top'],
        color: 0x00ff88,
    },
    led3mm: {
        name: 'LED (3mm)',
        holeShape: 'circle',
        holeDiameter: 3.7,
        validFaces: ['top'],
        color: 0x00cc66,
    },
    toggle: {
        name: 'Toggle Switch',
        holeShape: 'circle',
        holeDiameter: 6.7,
        validFaces: ['top'],
        color: 0xffaa00,
    },
    guitarJack: {
        name: '1/4" Guitar Jack',
        holeShape: 'circle',
        holeDiameter: 9.7,
        validFaces: ['front', 'back', 'left', 'right'],
        color: 0xcc66ff,
    },
    dcJack: {
        name: 'DC Jack (2.1mm)',
        holeShape: 'circle',
        holeDiameter: 8.2,
        validFaces: ['front', 'back', 'left', 'right'],
        color: 0xff6644,
    },
    usbC: {
        name: 'USB-C Jack',
        holeShape: 'roundrect',
        holeWidth: 9.7,
        holeHeight: 3.7,
        holeRadius: 1.5,
        validFaces: ['front', 'back', 'left', 'right'],
        color: 0x44aaff,
    },
    pot: {
        name: 'Potentiometer',
        holeShape: 'circle',
        holeDiameter: 7.2,
        validFaces: ['top'],
        color: 0xaaaa00,
    },
    screwM3: {
        name: 'M3 Screw Hole',
        holeShape: 'circle',
        holeDiameter: 3.4,
        validFaces: ['top', 'front', 'back', 'left', 'right'],
        color: 0x888888,
    },
    screwM25: {
        name: 'M2.5 Screw Hole',
        holeShape: 'circle',
        holeDiameter: 2.9,
        validFaces: ['top', 'front', 'back', 'left', 'right'],
        color: 0x777777,
    },
};
```

**Step 2: Populate component panel in app.js**

Add to `js/app.js`:
- Import `COMPONENTS`
- Populate `#component-list` with buttons for each component
- Clicking a button sets `state.activeComponent` and adds `.active` class
- Clicking again (or pressing Escape) deselects

**Step 3: Verify**

Component buttons appear in left panel. Clicking highlights them, clicking again deselects.

**Step 4: Commit**

```bash
git add js/components.js js/app.js
git commit -m "feat: component definitions and panel UI"
```

---

### Task 4: Component Placement — Raycasting + Ghost Preview

**Files:**
- Modify: `js/app.js`

This is the core interaction: hover over a face to see a ghost preview, click to place.

**Step 1: Add raycasting and ghost preview**

In `js/app.js`, add:
- `THREE.Raycaster` and mouse vector
- `mousemove` handler on viewport:
  - Raycast against face meshes
  - If hit and face is valid for active component, show ghost mesh at hit point
  - Snap position to 0.5mm grid if snap enabled
  - Constrain position so hole stays within face bounds (min 1mm from edge)
  - If face is invalid, show red ghost
- Ghost mesh: `THREE.RingGeometry` for circles (or thin torus), colored green/red
- For roundrect (USB-C): use a `THREE.PlaneGeometry` outline

**Step 2: Add click-to-place**

- `click` handler on viewport:
  - If ghost is showing on valid face, create a placed component
  - Add to `state.placedComponents` array: `{ id, type, face, position: {x,y,z}, localPos: {u,v} }`
  - Create a permanent ring mesh at that position, add to scene
  - Update placed list in panel
  - Update part count in status bar

**Step 3: Add component selection and deletion**

- Clicking a placed component ring (raycast against placed meshes) selects it
  - Show blue highlight
  - Show properties panel with X/Y inputs (local face coordinates)
  - Show delete button
- Delete button or Delete key removes the component
- Editing X/Y in properties panel moves the component

**Step 4: Add drag to reposition**

- When a placed component is selected, dragging moves it along its face
- Same snapping and bounds constraints as placement

**Step 5: Verify**

- Select footswitch, hover over top face → green ring follows cursor
- Click → ring placed permanently
- Hover over side face → red ring (invalid for footswitch)
- Select guitar jack, hover over side face → green ring
- Click placed ring → blue selection, properties panel shows
- Drag placed ring → moves along face
- Delete key → removes

**Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat: component placement with raycasting and ghost preview"
```

---

### Task 5: CSG Export — STL Generation

**Files:**
- Create: `js/csg.js`
- Create: `js/exporter.js`
- Modify: `js/app.js`

**Step 1: Create js/csg.js**

```js
import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { SCREW_SPECS } from './enclosure.js';

const WALL = 2;
const LID_THICK = 2;
const LIP = 1.5;
const CSG_SEGMENTS = 32;

/**
 * Build export-ready meshes with all holes subtracted.
 * Returns { bottomMesh, lidMesh }
 */
export function buildExportMeshes(dims, screwType, placedComponents, componentDefs) {
    const evaluator = new Evaluator();
    const screw = SCREW_SPECS[screwType];
    const mat = new THREE.MeshStandardMaterial();

    // --- Bottom half ---
    // Outer box
    const outerBottom = new Brush(
        new THREE.BoxGeometry(dims.outerW, dims.bottomH, dims.outerD), mat
    );
    outerBottom.position.y = dims.bottomH / 2;
    outerBottom.updateMatrixWorld();

    // Inner cavity (subtract to make it hollow)
    const innerW = dims.outerW - WALL * 2;
    const innerD = dims.outerD - WALL * 2;
    const innerH = dims.bottomH - WALL;
    const innerBottom = new Brush(
        new THREE.BoxGeometry(innerW, innerH, innerD), mat
    );
    innerBottom.position.y = WALL + innerH / 2;
    innerBottom.updateMatrixWorld();

    let bottom = evaluator.evaluate(outerBottom, innerBottom, SUBTRACTION);

    // Add screw bosses (union would be needed, but simpler: build boss as part of bottom)
    // Actually, screw bosses are solid cylinders inside the cavity.
    // We'll build the bottom differently: outer box minus inner cavity,
    // then the bosses are separate geometry merged into the final mesh.
    // For CSG simplicity, we add boss cylinders and subtract their holes.

    // --- Lid ---
    const outerLid = new Brush(
        new THREE.BoxGeometry(dims.outerW, LID_THICK, dims.outerD), mat
    );
    outerLid.position.y = dims.bottomH + LID_THICK / 2;
    outerLid.updateMatrixWorld();

    // Lid lip (sits inside bottom)
    const lipW = innerW - 0.4; // 0.4mm clearance
    const lipD = innerD - 0.4;
    const lipBrush = new Brush(
        new THREE.BoxGeometry(lipW, LIP, lipD), mat
    );
    lipBrush.position.y = dims.bottomH - LIP / 2;
    lipBrush.updateMatrixWorld();

    // We'll merge lid + lip by union... but three-bvh-csg ADDITION works.
    // For simplicity, we can build lid as one taller box and subtract.
    // Actually let's just make lid + lip as a single combined shape.

    let lid = outerLid; // Start simple, add lip later if needed

    // Subtract component holes from bottom (side holes) and lid (top holes)
    for (const comp of placedComponents) {
        const def = componentDefs[comp.type];
        const holeBrush = createHoleBrush(def, comp, dims, mat);
        if (!holeBrush) continue;

        if (comp.face === 'top') {
            lid = evaluator.evaluate(toBrush(lid), holeBrush, SUBTRACTION);
        } else {
            bottom = evaluator.evaluate(toBrush(bottom), holeBrush, SUBTRACTION);
        }
    }

    // Subtract screw through-holes from lid, screw insert holes from bottom bosses
    // (Implementation adds cylinder brushes at each screw position)

    return { bottomMesh: toMesh(bottom), lidMesh: toMesh(lid) };
}

function createHoleBrush(def, comp, dims, mat) {
    if (def.holeShape === 'circle') {
        const radius = def.holeDiameter / 2;
        const depth = 20; // through-hole, longer than any wall
        const geo = new THREE.CylinderGeometry(radius, radius, depth, CSG_SEGMENTS);
        const brush = new Brush(geo, mat);

        // Orient cylinder perpendicular to the face
        if (comp.face === 'top') {
            brush.position.set(comp.position.x, comp.position.y, comp.position.z);
            // cylinder default is Y-axis, which is correct for top face
        } else if (comp.face === 'front' || comp.face === 'back') {
            brush.rotation.x = Math.PI / 2;
            brush.position.set(comp.position.x, comp.position.y, comp.position.z);
        } else {
            brush.rotation.z = Math.PI / 2;
            brush.position.set(comp.position.x, comp.position.y, comp.position.z);
        }
        brush.updateMatrixWorld();
        return brush;
    }

    if (def.holeShape === 'roundrect') {
        // Approximate with a box (rounded rect is close enough for FDM)
        const depth = 20;
        const geo = new THREE.BoxGeometry(def.holeWidth, depth, def.holeHeight);
        const brush = new Brush(geo, mat);

        if (comp.face === 'front' || comp.face === 'back') {
            brush.rotation.x = Math.PI / 2;
        } else if (comp.face === 'left' || comp.face === 'right') {
            brush.rotation.z = Math.PI / 2;
        }
        brush.position.set(comp.position.x, comp.position.y, comp.position.z);
        brush.updateMatrixWorld();
        return brush;
    }

    return null;
}

function toBrush(meshOrBrush) {
    if (meshOrBrush instanceof Brush) return meshOrBrush;
    const brush = new Brush(meshOrBrush.geometry, meshOrBrush.material);
    brush.position.copy(meshOrBrush.position);
    brush.rotation.copy(meshOrBrush.rotation);
    brush.scale.copy(meshOrBrush.scale);
    brush.updateMatrixWorld();
    return brush;
}

function toMesh(brushOrMesh) {
    if (brushOrMesh instanceof THREE.Mesh) {
        return new THREE.Mesh(brushOrMesh.geometry, brushOrMesh.material);
    }
    return brushOrMesh;
}
```

**Step 2: Create js/exporter.js**

```js
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import JSZip from 'jszip';
import { buildExportMeshes } from './csg.js';

/**
 * Export enclosure as ZIP containing two STL files.
 */
export async function exportSTL(dims, screwType, placedComponents, componentDefs) {
    const exporter = new STLExporter();

    const { bottomMesh, lidMesh } = buildExportMeshes(
        dims, screwType, placedComponents, componentDefs
    );

    const bottomSTL = exporter.parse(bottomMesh, { binary: true });
    const lidSTL = exporter.parse(lidMesh, { binary: true });

    const zip = new JSZip();
    zip.file('enclosure-bottom.stl', bottomSTL);
    zip.file('enclosure-lid.stl', lidSTL);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pedal-enclosure.zip';
    a.click();
    URL.revokeObjectURL(url);
}
```

**Step 3: Wire export button in app.js**

- Import `exportSTL`
- Export button click handler calls `exportSTL(state.dims, state.screwType, state.placedComponents, COMPONENTS)`
- Show loading state on button during export
- Handle errors with alert

**Step 4: Verify**

- Place some components on the enclosure
- Click Export STL
- ZIP downloads with two STL files
- Open STLs in Bambu Studio — should see enclosure halves with holes

**Step 5: Commit**

```bash
git add js/csg.js js/exporter.js js/app.js
git commit -m "feat: CSG boolean export to STL with ZIP download"
```

---

### Task 6: Footswitch Reinforcement in CSG

**Files:**
- Modify: `js/csg.js`

**Step 1: Add reinforcement ring + ribs for footswitch components**

In `buildExportMeshes`, after subtracting the footswitch hole from the lid, add (via CSG union/ADDITION):
- A thick ring on the underside of the lid (inner diameter = hole diameter, outer = reinforceOuter)
- 4 radial ribs connecting ring to lid underside

This only applies to components with `reinforced: true`.

**Step 2: Verify**

Export an enclosure with a footswitch placed. Open the lid STL — should see the reinforcement ring and ribs on the underside around the footswitch hole.

**Step 3: Commit**

```bash
git add js/csg.js
git commit -m "feat: footswitch reinforcement ribs in CSG export"
```

---

### Task 7: Polish + Edge Cases

**Files:**
- Modify: `js/app.js`
- Modify: `js/enclosure.js`

**Step 1: Overlap detection**

When placing a component, check distance to all other placed components. If any hole edges overlap (distance between centers < sum of radii + 1mm), show red ghost and prevent placement.

**Step 2: Edge proximity enforcement**

Prevent placing components within 1mm of enclosure edge. Already constrained in ghost preview, but add final validation on click.

**Step 3: Undo support**

Simple undo stack: each placement/deletion pushes to undo array. Ctrl+Z pops and reverses the action.

**Step 4: Keyboard shortcuts**

- `Delete` / `Backspace`: delete selected component
- `Escape`: deselect component / cancel placement mode
- `Ctrl+Z`: undo

**Step 5: Verify all edge cases**

- Try placing overlapping components → blocked
- Try placing at edge → blocked
- Ctrl+Z undoes placement
- Delete removes selected

**Step 6: Commit**

```bash
git add js/app.js js/enclosure.js
git commit -m "feat: overlap detection, edge enforcement, undo, keyboard shortcuts"
```

---

### Task 8: GitHub Pages Deployment

**Files:**
- No new files needed (static site deploys as-is)

**Step 1: Create GitHub repo**

```bash
gh repo create pedal-3d-designer --public --source=. --push
```

**Step 2: Enable GitHub Pages**

```bash
gh api repos/{owner}/pedal-3d-designer/pages -X POST -f source.branch=master -f source.path=/
```

Or do it via Settings > Pages > Source: master branch, root folder.

**Step 3: Verify**

Visit `https://{username}.github.io/pedal-3d-designer/` — full app should load and work.

**Step 4: Commit any final tweaks**

```bash
git add -A && git commit -m "chore: deployment ready"
git push
```

---

## Execution Order

Tasks 1-5 are sequential (each builds on the previous). Task 6 depends on Task 5. Task 7 depends on Task 4. Task 8 is last.

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
                                  ↘ Task 7
                                           → Task 8
```

Total: 8 tasks. Estimated files: 7 JS/HTML/CSS files, ~1500 lines of code.
