import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import { SCREW_SPECS, WALL, LID_THICK, LIP } from './enclosure.js';

const csgMat = new THREE.MeshStandardMaterial({ color: 0x4a90d9 });

/**
 * Helper: wrap an Evaluator result (Mesh) back into a Brush for chaining.
 */
function toBrush(mesh) {
  const brush = new Brush(mesh.geometry, csgMat);
  brush.updateMatrixWorld();
  return brush;
}

/**
 * Helper: create a cylinder Brush at a given position/rotation.
 */
function makeCylinder(radius, height, position, rotation) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
  const brush = new Brush(geo, csgMat);
  brush.position.copy(position);
  if (rotation) brush.rotation.copy(rotation);
  brush.updateMatrixWorld();
  return brush;
}

/**
 * Helper: create a box Brush at a given position/rotation.
 */
function makeBox(w, h, d, position, rotation) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const brush = new Brush(geo, csgMat);
  brush.position.copy(position);
  if (rotation) brush.rotation.copy(rotation);
  brush.updateMatrixWorld();
  return brush;
}

/**
 * Create a hole Brush for a component, oriented perpendicular to the given face.
 * The brush is positioned at the component's world position.
 */
function makeHoleBrush(comp, face, worldPos) {
  const throughDepth = 20; // longer than any wall to ensure through-hole

  // Rotation to orient the hole perpendicular to the face
  let rotation = null;
  switch (face) {
    case 'top':
      // Cylinder Y-axis is already perpendicular to top face
      rotation = null;
      break;
    case 'front':
    case 'back':
      rotation = new THREE.Euler(Math.PI / 2, 0, 0);
      break;
    case 'left':
    case 'right':
      rotation = new THREE.Euler(0, 0, Math.PI / 2);
      break;
  }

  const pos = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

  if (comp.holeShape === 'circle') {
    const radius = comp.holeDiameter / 2;
    return makeCylinder(radius, throughDepth, pos, rotation);
  } else {
    // roundrect — approximate with box for FDM
    // BoxGeometry(w, h, d) — h is along Y by default
    // For side faces, we need to orient the box correctly
    let w, h, d;
    switch (face) {
      case 'top':
        w = comp.holeWidth;
        h = throughDepth;
        d = comp.holeHeight;
        break;
      case 'front':
      case 'back':
        w = comp.holeWidth;
        h = comp.holeHeight;
        d = throughDepth;
        break;
      case 'left':
      case 'right':
        w = throughDepth;
        h = comp.holeHeight;
        d = comp.holeWidth;
        break;
      default:
        w = comp.holeWidth;
        h = throughDepth;
        d = comp.holeHeight;
    }
    return makeBox(w, h, d, pos, null);
  }
}

/**
 * Build watertight export meshes for the bottom half and lid.
 *
 * @param {object} dims - Enclosure dimensions from createEnclosure
 * @param {string} screwType - 'M3' or 'M2.5'
 * @param {Array} screwPositions - Array of {x, z} screw boss positions
 * @param {Array} placedComponents - Array of placed component records
 * @param {object} componentDefs - COMPONENTS definitions
 * @returns {{ bottomMesh: THREE.Mesh, lidMesh: THREE.Mesh }}
 */
export function buildExportMeshes(dims, screwType, screwPositions, placedComponents, componentDefs) {
  const screw = SCREW_SPECS[screwType];
  const evaluator = new Evaluator();

  // ===========================
  // Bottom half construction
  // ===========================

  // 1. Outer box
  const outerGeo = new THREE.BoxGeometry(dims.outerW, dims.bottomH, dims.outerD);
  const outerBrush = new Brush(outerGeo, csgMat);
  outerBrush.position.set(0, dims.bottomH / 2, 0);
  outerBrush.updateMatrixWorld();

  // 2. Inner cavity
  const innerW = dims.outerW - WALL * 2;
  const innerD = dims.outerD - WALL * 2;
  const innerH = dims.bottomH - WALL;
  const innerGeo = new THREE.BoxGeometry(innerW, innerH, innerD);
  const innerBrush = new Brush(innerGeo, csgMat);
  innerBrush.position.set(0, WALL + innerH / 2, 0);
  innerBrush.updateMatrixWorld();

  // 3. Subtract cavity from outer
  let bottomResult = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);

  // 4. Add screw bosses (with insert holes pre-subtracted)
  const bossH = dims.bottomH - WALL;
  for (const pos of screwPositions) {
    const bossBrush = makeCylinder(
      screw.bossOuter / 2,
      bossH,
      new THREE.Vector3(pos.x, WALL + bossH / 2, pos.z)
    );
    // Subtract insert hole from boss before adding to bottom
    const holeBrush = makeCylinder(
      screw.bossHole / 2,
      screw.depth + 2,
      new THREE.Vector3(pos.x, dims.bottomH - screw.depth / 2, pos.z)
    );
    const bossWithHole = evaluator.evaluate(bossBrush, holeBrush, SUBTRACTION);
    bottomResult = evaluator.evaluate(toBrush(bottomResult), toBrush(bossWithHole), ADDITION);
  }

  // 6. Subtract component holes from bottom (side faces only)
  for (const placed of placedComponents) {
    if (placed.face === 'top') continue; // top components go on lid
    const comp = componentDefs[placed.type];
    if (!comp) continue;

    const holeBrush = makeHoleBrush(comp, placed.face, placed.position);
    bottomResult = evaluator.evaluate(toBrush(bottomResult), holeBrush, SUBTRACTION);
  }

  // ===========================
  // Lid construction
  // ===========================

  // 1. Lid plate
  const lidPlateGeo = new THREE.BoxGeometry(dims.outerW, LID_THICK, dims.outerD);
  const lidPlateBrush = new Brush(lidPlateGeo, csgMat);
  lidPlateBrush.position.set(0, dims.bottomH + LID_THICK / 2, 0);
  lidPlateBrush.updateMatrixWorld();

  // 2. Lip (sits inside bottom cavity)
  const lipW = innerW - 0.4;
  const lipD = innerD - 0.4;
  const lipGeo = new THREE.BoxGeometry(lipW, LIP, lipD);
  const lipBrush = new Brush(lipGeo, csgMat);
  lipBrush.position.set(0, dims.bottomH - LIP / 2, 0);
  lipBrush.updateMatrixWorld();

  let lidResult = evaluator.evaluate(lidPlateBrush, lipBrush, ADDITION);

  // 3. Subtract screw through-holes
  const throughH = LID_THICK + LIP + 2;
  for (const pos of screwPositions) {
    const holeBrush = makeCylinder(
      screw.throughHole / 2,
      throughH,
      new THREE.Vector3(pos.x, dims.bottomH + LID_THICK / 2, pos.z)
    );
    lidResult = evaluator.evaluate(toBrush(lidResult), holeBrush, SUBTRACTION);
  }

  // 4. Add reinforcement + subtract component holes from lid (top face only)
  for (const placed of placedComponents) {
    if (placed.face !== 'top') continue;
    const comp = componentDefs[placed.type];
    if (!comp) continue;

    // Add reinforcement geometry before subtracting the hole
    if (comp.reinforced) {
      const reinforceR = comp.reinforceOuter / 2;
      const reinforceH = comp.reinforceThick;
      const reinforceY = dims.bottomH - reinforceH / 2;

      // Solid cylinder (the hole subtraction later will cut through it)
      const ringBrush = makeCylinder(
        reinforceR,
        reinforceH,
        new THREE.Vector3(placed.position.x, reinforceY, placed.position.z)
      );
      lidResult = evaluator.evaluate(toBrush(lidResult), ringBrush, ADDITION);

      // Radial gusset ribs
      const ribCount = comp.ribCount || 4;
      const ribWidth = 1.5;
      const ribLength = reinforceR;  // from center outward to ring edge
      for (let i = 0; i < ribCount; i++) {
        const angle = i * (2 * Math.PI / ribCount);
        const offsetX = Math.cos(angle) * (ribLength / 2);
        const offsetZ = Math.sin(angle) * (ribLength / 2);
        const ribBrush = makeBox(
          ribWidth,
          reinforceH,
          ribLength,
          new THREE.Vector3(
            placed.position.x + offsetX,
            reinforceY,
            placed.position.z + offsetZ
          ),
          new THREE.Euler(0, -angle, 0)
        );
        lidResult = evaluator.evaluate(toBrush(lidResult), ribBrush, ADDITION);
      }
    }

    // Subtract the component hole (cuts through lid plate + reinforcement)
    const holeBrush = makeHoleBrush(comp, placed.face, placed.position);
    lidResult = evaluator.evaluate(toBrush(lidResult), holeBrush, SUBTRACTION);
  }

  // Convert final results to plain Mesh
  const bottomMesh = new THREE.Mesh(bottomResult.geometry, csgMat);
  const lidMesh = new THREE.Mesh(lidResult.geometry, csgMat);

  return { bottomMesh, lidMesh };
}
