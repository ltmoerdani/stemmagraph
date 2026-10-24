/**
 * v385 Edge Markers Arah Relasi: helper pure pembangun objek marker.
 *
 * Semantik arah (terdokumentasi di spec builder ReactFlowFamilyTree):
 * konvensi top-down, panah menunjuk anak; pasangan dan sibling sengaja
 * tanpa panah. Model hub GEDCOM 7 (FAMC/FAMS) tidak mendefinisikan arah
 * visual; preseden Gramps menjadikan arah panah opsi pengguna.
 */
import { MarkerType, type EdgeMarker } from '@xyflow/react';

/**
 * Marker panah untuk edge parent-child.
 *
 * color: null agar marker mengikuti variabel tema --xy-edge-stroke
 * (aman terhadap colorMode dark). Ukuran 18x18 pada default markerUnits
 * strokeWidth; bila nanti stroke-width dibedakan per relasi atau berubah
 * saat selected, pindah ke userSpaceOnUse.
 *
 * @returns objek EdgeMarker sesuai kontrak v385
 */
export function parentChildMarkerEnd(): EdgeMarker {
  return {
    type: MarkerType.ArrowClosed,
    color: null,
    width: 18,
    height: 18,
  };
}
