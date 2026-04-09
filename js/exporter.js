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

  // Rotate from Y-up (Three.js) to Z-up (STL/slicer convention)
  const yToZ = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  bottomMesh.geometry.applyMatrix4(yToZ);
  lidMesh.geometry.applyMatrix4(yToZ);

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
