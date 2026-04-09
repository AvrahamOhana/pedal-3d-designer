import * as THREE from 'three';

// --- Presets ---
export const PRESETS = {
    '1590A':  { width: 39,  depth: 89,  height: 27 },
    '1590B':  { width: 60,  depth: 112, height: 31 },
    '1590BB': { width: 72,  depth: 120, height: 31 },
    '1590XX': { width: 121, depth: 145, height: 34 },
};

// --- Screw specifications ---
export const SCREW_SPECS = {
    'M3':    { bossOuter: 8, bossHole: 4.0, throughHole: 3.2, depth: 5 },
    'M2.5':  { bossOuter: 7, bossHole: 3.5, throughHole: 2.7, depth: 4.5 },
};

// --- Constants ---
export const WALL = 2;
export const CORNER_R = 2;
export const LID_THICK = 2;
export const LIP = 1.5;

/**
 * Create a parametric enclosure (bottom box + lid) with screw bosses and
 * invisible face planes for raycasting.
 *
 * Coordinate convention:
 *   - Enclosure is centered on X and Z.
 *   - Bottom of the box sits at y = 0.
 *   - Y is up.
 *
 * @param {number} width  Inner width  (X axis)
 * @param {number} depth  Inner depth  (Z axis)
 * @param {number} height Inner height (Y axis, total inner cavity height)
 * @param {string} screwType 'M3' | 'M2.5'
 * @returns {{ bottomGroup, lidGroup, facesMeshes, screwPositions, dims }}
 */
export function createEnclosure(width, depth, height, screwType = 'M3') {
    const screw = SCREW_SPECS[screwType];

    // Outer dimensions
    const outerW = width + 2 * WALL;
    const outerD = depth + 2 * WALL;
    // Bottom half height: inner height + floor thickness (WALL)
    const bottomH = height + WALL;
    const lidH = LID_THICK;

    // --- Material ---
    const boxMat = new THREE.MeshPhysicalMaterial({
        color: 0x4488cc,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const lidMat = new THREE.MeshPhysicalMaterial({
        color: 0x66aadd,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const bossMat = new THREE.MeshPhysicalMaterial({
        color: 0x4488cc,
        transparent: true,
        opacity: 0.6,
    });

    // ============================
    // Bottom group (open-top box)
    // ============================
    const bottomGroup = new THREE.Group();
    bottomGroup.name = 'enclosure-bottom';

    // Build an open-top box from 5 faces (floor + 4 walls)
    // Floor
    const floorGeo = new THREE.BoxGeometry(outerW, WALL, outerD);
    const floorMesh = new THREE.Mesh(floorGeo, boxMat);
    floorMesh.position.set(0, WALL / 2, 0);
    bottomGroup.add(floorMesh);

    // Front wall (positive Z face)
    const frontGeo = new THREE.BoxGeometry(outerW, height, WALL);
    const frontMesh = new THREE.Mesh(frontGeo, boxMat);
    frontMesh.position.set(0, WALL + height / 2, outerD / 2 - WALL / 2);
    bottomGroup.add(frontMesh);

    // Back wall (negative Z face)
    const backMesh = new THREE.Mesh(frontGeo, boxMat);
    backMesh.position.set(0, WALL + height / 2, -(outerD / 2 - WALL / 2));
    bottomGroup.add(backMesh);

    // Left wall (negative X face)
    const sideGeo = new THREE.BoxGeometry(WALL, height, depth);
    const leftMesh = new THREE.Mesh(sideGeo, boxMat);
    leftMesh.position.set(-(outerW / 2 - WALL / 2), WALL + height / 2, 0);
    bottomGroup.add(leftMesh);

    // Right wall (positive X face)
    const rightMesh = new THREE.Mesh(sideGeo, boxMat);
    rightMesh.position.set(outerW / 2 - WALL / 2, WALL + height / 2, 0);
    bottomGroup.add(rightMesh);

    // --- Screw bosses ---
    const bossRadius = screw.bossOuter / 2;
    const bossHeight = height; // bosses rise from floor to top of bottom half

    const screwPositions = [
        { x: -(width / 2 - bossRadius - 1), z: -(depth / 2 - bossRadius - 1) },
        { x:  (width / 2 - bossRadius - 1), z: -(depth / 2 - bossRadius - 1) },
        { x: -(width / 2 - bossRadius - 1), z:  (depth / 2 - bossRadius - 1) },
        { x:  (width / 2 - bossRadius - 1), z:  (depth / 2 - bossRadius - 1) },
    ];

    const bossGeo = new THREE.CylinderGeometry(bossRadius, bossRadius, bossHeight, 24);
    for (const pos of screwPositions) {
        const boss = new THREE.Mesh(bossGeo, bossMat);
        boss.position.set(pos.x, WALL + bossHeight / 2, pos.z);
        bottomGroup.add(boss);
    }

    // ============================
    // Lid group
    // ============================
    const lidGroup = new THREE.Group();
    lidGroup.name = 'enclosure-lid';

    const lidGeo = new THREE.BoxGeometry(outerW, lidH, outerD);
    const lidMesh = new THREE.Mesh(lidGeo, lidMat);
    // Lid sits on top of the bottom half
    lidMesh.position.set(0, bottomH + lidH / 2, 0);
    lidGroup.add(lidMesh);

    // ============================
    // Face meshes (invisible, for raycasting)
    // ============================
    const invisMat = new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
    });

    // Top face — on the lid surface (top of lid)
    const topY = bottomH + lidH;
    const topPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerW, outerD),
        invisMat
    );
    topPlane.rotation.x = -Math.PI / 2;
    topPlane.position.set(0, topY, 0);
    topPlane.userData.face = 'top';

    // Front face (positive Z)
    const frontPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerW, bottomH),
        invisMat
    );
    frontPlane.position.set(0, bottomH / 2, outerD / 2);
    frontPlane.userData.face = 'front';

    // Back face (negative Z)
    const backPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerW, bottomH),
        invisMat
    );
    backPlane.rotation.y = Math.PI;
    backPlane.position.set(0, bottomH / 2, -outerD / 2);
    backPlane.userData.face = 'back';

    // Left face (negative X)
    const leftPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerD, bottomH),
        invisMat
    );
    leftPlane.rotation.y = Math.PI / 2;
    leftPlane.position.set(-outerW / 2, bottomH / 2, 0);
    leftPlane.userData.face = 'left';

    // Right face (positive X)
    const rightPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(outerD, bottomH),
        invisMat
    );
    rightPlane.rotation.y = -Math.PI / 2;
    rightPlane.position.set(outerW / 2, bottomH / 2, 0);
    rightPlane.userData.face = 'right';

    const facesMeshes = {
        top: topPlane,
        front: frontPlane,
        back: backPlane,
        left: leftPlane,
        right: rightPlane,
    };

    const dims = {
        width,
        depth,
        height,
        outerW,
        outerD,
        bottomH,
        wall: WALL,
        lidThick: LID_THICK,
        lip: LIP,
    };

    return { bottomGroup, lidGroup, facesMeshes, screwPositions, dims };
}
