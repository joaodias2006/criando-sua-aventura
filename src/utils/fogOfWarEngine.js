// 2D Raycasting Line-of-Sight (LoS) & Dynamic Fog of War Engine for Ordo Realitas VTT
// Supports dynamic custom walls and multiple interactive doors placed by the Master on any map!

export const MAP_BOUNDS = {
  minX: -7.5,
  maxX: 7.5,
  minZ: -4.5,
  maxZ: 4.5,
  width: 15,
  height: 9,
};

/**
 * Computes the dynamic line segment for an interactive door based on its hinge pivot, baseAngle and current opening angle
 */
export function getDoorSegment(door) {
  const totalAngle = (door.baseAngle || 0) + (door.angleRad || 0);
  const len = door.length || 2.0;
  // When totalAngle === 0, door goes from (hingeX, hingeZ) along +Z by `len`
  const endX = door.hingeX + Math.sin(totalAngle) * len;
  const endZ = door.hingeZ + Math.cos(totalAngle) * len;
  return {
    id: door.id,
    x1: door.hingeX,
    z1: door.hingeZ,
    x2: endX,
    z2: endZ,
  };
}

/**
 * Builds the combined array of blocking segments from current map walls + current doors
 */
export function buildActiveObstacleSegments(walls = [], doors = []) {
  const segs = walls.map((w) => ({
    x1: w.x1,
    z1: w.z1,
    x2: w.x2,
    z2: w.z2,
  }));
  doors.forEach((d) => {
    segs.push(getDoorSegment(d));
  });
  return segs;
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
  const numRays = 180; // Fast 60fps ray count
  const points = [];

  for (let i = 0; i < numRays; i++) {
    const angle = (i / numRays) * Math.PI * 2 - Math.PI;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);

    const angleDiff = Math.atan2(Math.sin(angle - facingAngle), Math.cos(angle - facingAngle));
    const inFlashlightCone = flashlightOn && Math.abs(angleDiff) < 0.72;
    let maxDist = inFlashlightCone ? 12.8 : 5.2;

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

  for (const v of viewers) {
    const dx = px - v.x;
    const dz = pz - v.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 13.0) continue;

    const dirX = dx / (dist || 1);
    const dirZ = dz / (dist || 1);

    let blocked = false;
    for (const seg of segments) {
      const hit = intersectRaySegment(v.x, v.z, dirX, dirZ, seg, dist - 0.12);
      if (hit !== null && hit < dist - 0.12) {
        blocked = true;
        break;
      }
    }
    if (!blocked) return true;
  }
  return false;
}
