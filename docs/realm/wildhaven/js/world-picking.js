// Raycasting in Three.js does not honor ancestor visibility. Ignore overlays,
// hidden descendants and transparent cue surfaces before choosing a visible hit.
export function visibleSurfaceHit(hits) {
  return hits.find(hit => {
    if (!hit.object.isMesh) return false;
    for (let node = hit.object; node; node = node.parent) if (!node.visible || node.userData?.unit?.status === 'dead') return false;
    const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
    const material = materials[hit.face?.materialIndex || 0];
    if (!material || material.visible === false || material.opacity <= .05 || material.depthWrite === false) return false;
    const planes = material.clippingPlanes || [];
    if (planes.length) {
      const clipped = planes.map(plane => plane.distanceToPoint(hit.point) < 0);
      if (material.clipIntersection ? clipped.every(Boolean) : clipped.some(Boolean)) return false;
    }
    return true;
  }) || null;
}
