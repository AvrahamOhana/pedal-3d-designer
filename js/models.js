import * as THREE from 'three';

// ============================================================
// Shared materials
// ============================================================
const metalMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.2 });
const blackPlasticMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.1, roughness: 0.8 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xb5a642, metalness: 0.8, roughness: 0.3 });

const SEG = 20; // cylinder segments (good enough for preview)

// ============================================================
// Helper: clone material so we can tint per-instance later
// ============================================================
function mat(base) {
  return base.clone();
}

// ============================================================
// 1. Footswitch (3PDT)
// ============================================================
function createFootswitchModel() {
  const g = new THREE.Group();

  // Threaded barrel: y=-4 to y=4 (straddles surface at y=0)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 8, SEG),
    mat(darkMetalMat)
  );
  barrel.position.y = 0;
  g.add(barrel);

  // Hex nut: 6-sided, below surface
  const nut = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 2, 6),
    mat(metalMat)
  );
  nut.position.y = -1; // sits below surface
  g.add(nut);

  // Button cap: on top of barrel
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 4, SEG),
    mat(blackPlasticMat)
  );
  cap.position.y = 6; // top of barrel (4) + half cap (2)
  g.add(cap);

  // Rubber stomp pad on top of button
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.05, roughness: 0.95 });
  const rubber = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 1, SEG),
    rubberMat
  );
  rubber.position.y = 8.5; // top of cap (8) + half rubber (0.5)
  g.add(rubber);

  return g;
}

// ============================================================
// 2. LED 5mm
// ============================================================
function createLED5mmModel(color) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);

  const ledMat = new THREE.MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
    metalness: 0.1,
    roughness: 0.3,
  });

  // Cylindrical base below surface
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 2.75, 3, SEG),
    ledMat.clone()
  );
  base.position.y = -1.5;
  g.add(base);

  // Dome (half sphere) on top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.75, SEG, SEG / 2, 0, Math.PI * 2, 0, Math.PI / 2),
    ledMat
  );
  dome.position.y = 0;
  g.add(dome);

  return g;
}

// ============================================================
// 3. LED 3mm
// ============================================================
function createLED3mmModel(color) {
  const g = new THREE.Group();
  const c = new THREE.Color(color);

  const ledMat = new THREE.MeshStandardMaterial({
    color: c,
    emissive: c,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.8,
    metalness: 0.1,
    roughness: 0.3,
  });

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 2, SEG),
    ledMat.clone()
  );
  base.position.y = -1;
  g.add(base);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.75, SEG, SEG / 2, 0, Math.PI * 2, 0, Math.PI / 2),
    ledMat
  );
  dome.position.y = 0;
  g.add(dome);

  return g;
}

// ============================================================
// 4. Toggle switch
// ============================================================
function createToggleModel() {
  const g = new THREE.Group();

  // Threaded base below surface
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 3, SEG),
    mat(metalMat)
  );
  base.position.y = -1.5;
  g.add(base);

  // Hex nut at surface
  const nut = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 1.5, 6),
    mat(metalMat)
  );
  nut.position.y = 0.75;
  g.add(nut);

  // Lever arm: angled 20 degrees from vertical
  // Pivot at nut top (y=1.5), lever length=8mm
  const angle = THREE.MathUtils.degToRad(20);
  const leverPivotY = 1.5;
  const leverGroup = new THREE.Group();
  leverGroup.position.y = leverPivotY;
  leverGroup.rotation.z = angle;

  const lever = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 8, 8),
    mat(metalMat)
  );
  lever.position.y = 4; // center of 8mm lever
  leverGroup.add(lever);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, SEG, SEG),
    mat(metalMat)
  );
  ball.position.y = 8; // top of lever
  leverGroup.add(ball);

  g.add(leverGroup);

  return g;
}

// ============================================================
// 5. 1/4" Guitar jack
// ============================================================
function createGuitarJackModel() {
  const g = new THREE.Group();

  // Barrel/socket straddling surface
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(4.75, 4.75, 12, SEG),
    mat(darkMetalMat)
  );
  barrel.position.y = 0;
  g.add(barrel);

  // Hex nut on outside (positive Y)
  const nut = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 2, 6),
    mat(metalMat)
  );
  nut.position.y = 4;
  g.add(nut);

  // Washer between nut and surface
  const washer = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.5, 8, SEG),
    mat(metalMat)
  );
  washer.rotation.x = Math.PI / 2;
  washer.position.y = 2.5;
  g.add(washer);

  // Inner contact hole (recessed on outside)
  const hole = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 2, SEG),
    mat(blackPlasticMat)
  );
  hole.position.y = 5.5;
  g.add(hole);

  return g;
}

// ============================================================
// 6. DC jack
// ============================================================
function createDCJackModel() {
  const g = new THREE.Group();

  // Housing straddling surface
  const housing = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 10, SEG),
    mat(blackPlasticMat)
  );
  housing.position.y = 0;
  g.add(housing);

  // Outer rim on outside
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 1, SEG),
    mat(metalMat)
  );
  rim.position.y = 4;
  g.add(rim);

  // Inner barrel (dark, visible from outside)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 3, SEG),
    mat(darkMetalMat)
  );
  inner.position.y = 5.5;
  g.add(inner);

  // Center pin (brass)
  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 3, 8),
    mat(brassMat)
  );
  pin.position.y = 5.5;
  g.add(pin);

  return g;
}

// ============================================================
// 7. USB-C jack
// ============================================================
function createUSBCModel() {
  const g = new THREE.Group();

  // Housing: box straddling surface, built along Y axis
  // 9.5 wide (X), 3.5 tall (Z), 8 deep (Y)
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 8, 3.5),
    mat(darkMetalMat)
  );
  housing.position.y = 0;
  g.add(housing);

  // Port opening on outside face (positive Y)
  const portMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.1, roughness: 0.9 });
  const port = new THREE.Mesh(
    new THREE.BoxGeometry(8.5, 2, 2.8),
    portMat
  );
  port.position.y = 3.5;
  g.add(port);

  // Metal shield tabs on top and bottom edges
  const tabGeo = new THREE.BoxGeometry(7, 0.5, 0.3);
  const tabTop = new THREE.Mesh(tabGeo, mat(metalMat));
  tabTop.position.set(0, 4.2, 1.5);
  g.add(tabTop);

  const tabBot = new THREE.Mesh(tabGeo.clone(), mat(metalMat));
  tabBot.position.set(0, 4.2, -1.5);
  g.add(tabBot);

  return g;
}

// ============================================================
// 8. Potentiometer
// ============================================================
function createPotModel() {
  const g = new THREE.Group();

  // Shaft thread straddling surface
  const thread = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 8, SEG),
    mat(metalMat)
  );
  thread.position.y = 0;
  g.add(thread);

  // Hex nut at surface
  const nut = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 1.5, 6),
    mat(metalMat)
  );
  nut.position.y = 2;
  g.add(nut);

  // Shaft on top
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 4, SEG),
    mat(metalMat)
  );
  shaft.position.y = 5;
  g.add(shaft);

  // Knob: tapered cylinder
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 12, SEG),
    mat(blackPlasticMat)
  );
  knob.position.y = 13; // top of shaft (7) + half knob (6)
  g.add(knob);

  // Pointer line on knob top surface
  const pointerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.0, roughness: 0.9 });
  const pointer = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.3, 5),
    pointerMat
  );
  pointer.position.set(0, 19.2, 0);
  g.add(pointer);

  return g;
}

// ============================================================
// 9. M3 screw
// ============================================================
function createScrewM3Model() {
  const g = new THREE.Group();

  // Socket head cap: on top
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(2.75, 2.75, 2.5, SEG),
    mat(darkMetalMat)
  );
  head.position.y = 1.25;
  g.add(head);

  // Hex socket recessed into head top
  const socketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 1, 6),
    socketMat
  );
  socket.position.y = 2.0;
  g.add(socket);

  // Shaft below surface
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 6, SEG),
    mat(metalMat)
  );
  shaft.position.y = -3; // extends below
  g.add(shaft);

  return g;
}

// ============================================================
// 10. M2.5 screw
// ============================================================
function createScrewM25Model() {
  const g = new THREE.Group();

  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 2.25, 2, SEG),
    mat(darkMetalMat)
  );
  head.position.y = 1;
  g.add(head);

  const socketMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
  const socket = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 0.8, 6),
    socketMat
  );
  socket.position.y = 1.6;
  g.add(socket);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 5, SEG),
    mat(metalMat)
  );
  shaft.position.y = -2.5;
  g.add(shaft);

  return g;
}

// ============================================================
// Rotation for 3D models on each face
// Models are built with +Y as "outward" normal.
// This returns the Euler rotation to orient the model on each face.
// ============================================================
export function getModelRotation(face) {
  switch (face) {
    case 'top':   return new THREE.Euler(0, 0, 0);                       // +Y stays +Y (up)
    case 'front': return new THREE.Euler(Math.PI / 2, 0, 0);            // +Y -> +Z (front)
    case 'back':  return new THREE.Euler(-Math.PI / 2, 0, 0);           // +Y -> -Z (back)
    case 'left':  return new THREE.Euler(Math.PI / 2, 0, -Math.PI / 2); // +Y -> -X, width horizontal
    case 'right': return new THREE.Euler(Math.PI / 2, 0, Math.PI / 2);  // +Y -> +X, width horizontal
    default:      return new THREE.Euler(0, 0, 0);
  }
}

// ============================================================
// Lookup function
// ============================================================
export function createComponentModel(type, color) {
  switch (type) {
    case 'footswitch': return createFootswitchModel();
    case 'led5mm':     return createLED5mmModel(color);
    case 'led3mm':     return createLED3mmModel(color);
    case 'toggle':     return createToggleModel();
    case 'guitarJack': return createGuitarJackModel();
    case 'dcJack':     return createDCJackModel();
    case 'pot':        return createPotModel();
    case 'usbC':       return createUSBCModel();
    case 'screwM3':    return createScrewM3Model();
    case 'screwM25':   return createScrewM25Model();
    default:           return null;
  }
}
