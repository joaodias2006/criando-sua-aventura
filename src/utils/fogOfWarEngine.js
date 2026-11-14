// 2D/3D Raycasting Line-of-Sight (LoS) & Dynamic Fog of War Engine for Ordo Realitas VTT
// Computes real-time visibility polygons blocked by walls and the physical Hinge-Joint door angle.

export const MAP_BOUNDS = {
  minX: -7.5,
  maxX: 7.5,
  minZ: -4.5,
  maxZ: 4.5,
  width: 15,
  height: 9,
};

// Static wall segments in world coordinates (x1, z1, x2, z2)
// Room 1 is West (-7.5 to 0), Room 2 is East (0 to +7.5)
// Doorway gap on divider wall (x = 0) is from z = -1.05 to z = +0.95 (width 2.0m)
export const STATIC_WALL_SEGMENTS = [
  // Outer perimeter
  { x1: -7.5, z1: -4.5, x2: 7.5, z2: -4.5 },
  { x1: 7.5, z1: -4.5, x2: 7.5, z2: 4.5 },
  { x1: 7.5, z1: 4.5, x2: -7.5, z2: 4.5 },
  { x1: -7.5, z1: 4.5, x2: -7.5, z2: -4.5 },
  // Central dividing wall (x = 0) North section
  { x1: 0, z1: -4.5, x2: 0, z2: -1.05 },
  // Central dividing wall (x = 0) South section
  { x1: 0, z1: 0.95, x2: 0, z2: 4.5 },
];

/**
 * Computes the dynamic line segment for the physical door based on its hinge pivot (-1.05) and current angle
 */
export function getDoorSegment(doorAngleRad, doorHingeX = 0, doorHingeZ = -1.05, doorLength = 2.0) {
  // When doorAngleRad === 0, door goes from (0, -1.05) to (0, +0.95) closing the gap completely
  const endX = doorHingeX + Math.sin(doorAngleRad) * doorLength;
  const endZ = doorHingeZ + Math.cos(doorAngleRad) * doorLength;
  return {
    x1: doorHingeX,
    z1: doorHingeZ,
    x2: endX,
    z2: endZ,
  };
}

/**
 * Ray-segment intersection: ray from (ox, oz) along direction (dx, dz) up to maxDist
 */
function intersectRaySegment(ox, oz, dx, dz, seg, maxDist) {
  const r_px = ox;
  const r_py = oz;
  const r_dx = dx;
  const r_dy = dz;

  const s_px = seg.x1;
  const s_py = seg.z1;
  const s_dx = seg.x2 - seg.x1;
  const s_dy = seg.z2 - seg.z1;

  const denom = s_dx * r_dy - s_dy * r_dx;
  if (Math.abs(denom) < 1e-7) return null;

  const t2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / denom;
  if (t2 < -0.002 || t2 > 1.002) return null;

  const t1 = (s_px + s_dx * t2 - r_px) / (Math.abs(r_dx) > 1e-6 ? r_dx : 1e-6);
  const altT1 = (s_py + s_dy * t2 - r_py) / (Math.abs(r_dy) > 1e-6 ? r_dy : 1e-6);
  const dist = Math.abs(r_dx) > Math.abs(r_dy) ? t1 : altT1;

  if (dist < 0 || dist > maxDist) return null;
  return dist;
}

/**
 * Computes a 360-degree visibility polygon around (ox, oz) with a directional flashlight boost
 */
export function computeVisibilityPolygon(ox, oz, facingAngle, segments, flashlightOn = true) {
  const numRays = 220;
  const points = [];

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 - Math.PI;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);

    // Base ambient vision radius around character is 4.8m; flashlight cone extends to 12.5m
    let angleDiff = Math.atan2(Math.sin(angle - facingAngle), Math.cos(angle - facingAngle));
    const inFlashlightCone = flashlightOn && Math.abs(angleDiff) < 0.72; // ~82 deg cone
    let maxDist = inFlashlightCone ? 12.8 : 5.4;

    for (let s = 0; s < segments.length; s++) {
      const hitDist = intersectRaySegment(ox, oz, dx, dz, segments[s], maxDist);
      if (hitDist !== null && hitDist < maxDist) {
        maxDist = hitDist;
      }
    }

    points.push({
      x: ox + dx * maxDist,
      z: oz + dz * maxDist,
    });
  }

  return points;
}

/**
 * Checks if a world point (px, pz) has clear line of sight from any viewer token
 */
export function isPointVisibleToViewers(px, pz, viewers, segments, manualRoom2Revealed = false) {
  if (manualRoom2Revealed && px >= 0) return true;
  if (px < 0.1) return true; // Room 1 is the starting investigation room

  for (const v of viewers) {
    const dx = px - v.x;
    const dz = pz - v.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 13.0) continue;

    const dirX = dx / (dist || 1);
    const dirZ = dz / (dist || 1);

    let blocked = false;
    for (const seg of segments) {
      const hit = intersectRaySegment(v.x, v.z, dirX, dirZ, seg, dist - 0.15);
      if (hit !== null && hit < dist - 0.15) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return true;
  }
  return false;
}
