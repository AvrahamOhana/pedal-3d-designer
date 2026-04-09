import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import JSZip from 'jszip';
import { buildExportMeshes } from './csg.js';

/**
 * Export the enclosure as two STL files (bottom + lid) in a ZIP archive.
 *
 * @param {object} dims - Enclosure dimensions
 * @param {string} screwType - 'M3' or 'M2.5'
 * @param {Array} screwPositions - Screw boss positions
 * @param {Array} placedComponents - Placed component records
 * @param {object} componentDefs - COMPONENTS definitions
 * @returns {Promise<void>}
 */
export async function exportSTL(dims, screwType, screwPositions, placedComponents, componentDefs) {
  const { bottomMesh, lidMesh } = buildExportMeshes(
    dims, screwType, screwPositions, placedComponents, componentDefs
  );

  // Convert Y-up (Three.js) to Z-up (STL/slicer convention)
  // rotX(-PI/2): Y -> -Z, Z -> Y. So Three.js +Y (up) becomes -Z (down in slicer).
  // Bottom: open side is at high Y in Three.js. After rotX(-PI/2) it faces -Z (down).
  // Add rotX(PI) to flip it: open side faces +Z (up). Print on the flat floor.
  const bottomRot = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  bottomMesh.geometry.applyMatrix4(bottomRot);

  // Lid: flat top at high Y. After rotX(-PI/2) it faces -Z (down on bed). Good.
  const lidRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  lidMesh.geometry.applyMatrix4(lidRot);

  const exporter = new STLExporter();
  const bottomSTL = exporter.parse(bottomMesh, { binary: true }).buffer;
  const lidSTL = exporter.parse(lidMesh, { binary: true }).buffer;

  const zip = new JSZip();
  zip.file('enclosure-bottom.stl', bottomSTL);
  zip.file('enclosure-lid.stl', lidSTL);

  const blob = await zip.generateAsync({ type: 'blob' });

  // Trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'enclosure-stl.zip';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Clean up
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);
}
