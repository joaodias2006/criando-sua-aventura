import * as THREE from 'three';

/**
 * Generates a high-detail procedural hardwood floor texture with tactical 1.5m grid lines
 */
export function createWoodFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Base dark aged mahogany/oak tone
  ctx.fillStyle = '#241710';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankRows = 16;
  const plankH = 1024 / plankRows;

  for (let r = 0; r < plankRows; r++) {
    const y = r * plankH;
    const cols = 4;
    const offset = (r % 2) * 128;

    for (let c = -1; c <= cols; c++) {
      const x = c * (1024 / cols) + offset;
      const w = 1024 / cols;

      // Slight variation per plank
      const shade = 26 + ((r * 7 + c * 13) % 14);
      ctx.fillStyle = `rgb(${shade + 14}, ${shade + 2}, ${Math.max(8, shade - 6)})`;
      ctx.fillRect(x + 2, y + 2, w - 4, plankH - 4);

      // Wood grain streaks
      ctx.strokeStyle = 'rgba(12, 6, 3, 0.32)';
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 6; g++) {
        ctx.beginPath();
        const gy = y + 8 + ((g * 11 + r * 5) % (plankH - 14));
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + w * 0.3, gy + 3, x + w * 0.7, gy - 3, x + w - 4, gy);
        ctx.stroke();
      }
    }
  }

  // Tactical Grid Overlay (10x6 squares on 15m x 9m map -> each square = 1.5m)
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a glowing Occult Transcendence Sigil texture (Ordem Paranormal style)
 */
export function createOccultSigilTexture(colorHex = '#dc2626') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const cx = 256;
  const cy = 256;

  ctx.clearRect(0, 0, 512, 512);
  ctx.strokeStyle = colorHex;
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 5;

  // Outer ritual circles
  [220, 195, 125].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Hexagram / Esoteric Star
  for (let offset = 0; offset < 2; offset++) {
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const ang = (i * 2 * Math.PI) / 3 + (offset * Math.PI) / 3 - Math.PI / 2;
      const px = cx + Math.cos(ang) * 192;
      const py = cy + Math.sin(ang) * 192;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Inner spiral / eye sigils
  ctx.lineWidth = 3.5;
  for (let i = 0; i < 12; i++) {
    const ang = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * 125, cy + Math.sin(ang) * 125);
    ctx.lineTo(cx + Math.cos(ang) * 195, cy + Math.sin(ang) * 195);
    ctx.stroke();
  }

  // Center blood/fear glyph
  ctx.beginPath();
  ctx.arc(cx, cy, 42, 0, Math.PI * 2);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

/**
 * Creates a floating 3D Hand Cursor ("Mãozinha") with articulated fingers for grabbing animation
 */
export function createHandCursor3D(colorHex = '#f59e0b', label = 'Você') {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.25,
    emissive: colorHex,
    emissiveIntensity: 0.22,
  });

  const cuffMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.5,
    metalness: 0.7,
  });

  // Palm
  const palmGeo = new THREE.BoxGeometry(0.46, 0.14, 0.48);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.castShadow = true;
  group.add(palm);

  // Ordo Realitas Wrist Cuff
  const cuffGeo = new THREE.CylinderGeometry(0.22, 0.24, 0.22, 16);
  const cuff = new THREE.Mesh(cuffGeo, cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, 0.32);
  group.add(cuff);

  // Glowing Ring on Cuff
  const ringGeo = new THREE.TorusGeometry(0.23, 0.03, 12, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: colorHex });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 0, 0.25);
  group.add(ring);

  // 4 Articulated Fingers
  const fingers = [];
  const fingerX = [-0.16, -0.055, 0.055, 0.16];
  const fingerLen = [0.28, 0.34, 0.32, 0.24];

  fingerX.forEach((fx, i) => {
    const pivot = new THREE.Group();
    pivot.position.set(fx, 0, -0.22);

    const proxGeo = new THREE.CylinderGeometry(0.042, 0.046, fingerLen[i], 10);
    const proxMesh = new THREE.Mesh(proxGeo, skinMat);
    proxMesh.rotation.x = Math.PI / 2;
    proxMesh.position.set(0, 0, -fingerLen[i] / 2);
    proxMesh.castShadow = true;
    pivot.add(proxMesh);

    const tipPivot = new THREE.Group();
    tipPivot.position.set(0, 0, -fingerLen[i]);
    const tipGeo = new THREE.SphereGeometry(0.044, 10, 10);
    const tipMesh = new THREE.Mesh(tipGeo, skinMat);
    tipPivot.add(tipMesh);
    pivot.add(tipPivot);

    group.add(pivot);
    fingers.push({ pivot, tipPivot });
  });

  // Thumb
  const thumbPivot = new THREE.Group();
  thumbPivot.position.set(-0.24, -0.02, -0.05);
  thumbPivot.rotation.y = 0.55;
  const thumbMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.25, 10), skinMat);
  thumbMesh.rotation.x = Math.PI / 2;
  thumbMesh.position.set(0, 0, -0.12);
  thumbPivot.add(thumbMesh);
  group.add(thumbPivot);

  // Vertical laser pointer line down to table surface
  const beamGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.2, 8);
  const beamMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.38,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, -0.65, 0);
  group.add(beam);

  group.userData = {
    fingers,
    thumbPivot,
    skinMat,
    ringMat,
    beamMat,
    label,
    grabProgress: 0,
  };

  return group;
}

/**
 * Animates the 3D Hand Cursor fingers between open (0) and grabbing/closed (1)
 */
export function updateHandCursorPose(handGroup, isGrabbing, dt = 0.016) {
  if (!handGroup || !handGroup.userData) return;
  const target = isGrabbing ? 1.0 : 0.0;
  const current = handGroup.userData.grabProgress || 0;
  const next = current + (target - current) * Math.min(1, dt * 16);
  handGroup.userData.grabProgress = next;

  handGroup.userData.fingers.forEach(({ pivot }) => {
    pivot.rotation.x = -next * 1.15;
  });
  if (handGroup.userData.thumbPivot) {
    handGroup.userData.thumbPivot.rotation.x = -next * 0.65;
    handGroup.userData.thumbPivot.rotation.z = -next * 0.45;
  }
}

/**
 * Creates a 3D Miniature Token (Tabletop Simulator style base + sculpted miniature + flashlight cone)
 */
export function createTokenMesh3D(tokenData) {
  const group = new THREE.Group();

  // Heavy Metallic/Obsidian Tabletop Base
  const baseMat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.4,
    metalness: 0.7,
  });
  const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.6, 0.16, 28), baseMat);
  baseMesh.position.y = 0.08;
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // Glowing Class/Element Ring around base
  const ringMat = new THREE.MeshStandardMaterial({
    color: tokenData.ringColor || '#f59e0b',
    emissive: tokenData.ringColor || '#f59e0b',
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 12, 32), ringMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 0.15;
  group.add(ringMesh);

  // Miniature Sculpt (Body + Head + Weapon/Symbol)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: tokenData.color || '#d97706',
    roughness: 0.45,
    metalness: 0.2,
  });

  if (tokenData.type === 'monster') {
    // Bestial hunched Blood Zombie / Creature silhouette
    const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42, 1), bodyMat);
    torso.position.set(0, 0.58, 0);
    torso.scale.set(1.0, 1.35, 0.85);
    torso.castShadow = true;
    group.add(torso);

    const headMat = new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#991b1b',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), headMat);
    head.position.set(0, 1.12, 0.14);
    head.castShadow = true;
    group.add(head);
  } else {
    // Agent Coat & Shoulders
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.72, 16), bodyMat);
    torso.position.y = 0.52;
    torso.castShadow = true;
    group.add(torso);

    // Agent Head
    const headMat = new THREE.MeshStandardMaterial({
      color: '#fde68a',
      roughness: 0.5,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), headMat);
    head.position.y = 1.04;
    head.castShadow = true;
    group.add(head);

    // Tactical Flashlight Volumetric Cone Mesh (facing +X in local space)
    const coneGeo = new THREE.ConeGeometry(1.1, 3.4, 24, 1, true);
    coneGeo.translate(0, -1.7, 0);
    coneGeo.rotateZ(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const flashlightCone = new THREE.Mesh(coneGeo, coneMat);
    flashlightCone.position.set(0.25, 0.65, 0);
    flashlightCone.visible = tokenData.flashlightOn !== false;
    group.add(flashlightCone);
    group.userData.flashlightCone = flashlightCone;
  }

  // Direction indicator arrow on front of base (+X)
  const arrowMat = new THREE.MeshBasicMaterial({ color: tokenData.ringColor || '#ffffff' });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), arrowMat);
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.set(0.62, 0.15, 0);
  group.add(arrow);

  group.userData.tokenId = tokenData.id;
  group.userData.ringMat = ringMat;
  return group;
}

/**
 * Creates an inspectable 3D Handout/Clue mesh with hover luminescence
 */
export function createHandoutMesh3D(clue) {
  const group = new THREE.Group();

  let mainMesh;
  if (clue.type === 'diary') {
    const mat = new THREE.MeshStandardMaterial({
      color: '#7f1d1d',
      roughness: 0.6,
      emissive: '#450a0a',
      emissiveIntensity: 0.25,
    });
    mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.42), mat);
  } else if (clue.type === 'photo') {
    const mat = new THREE.MeshStandardMaterial({
      color: '#f4f4f5',
      roughness: 0.3,
      emissive: '#eab308',
      emissiveIntensity: 0.15,
    });
    mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.44), mat);
  } else if (clue.type === 'tape') {
    const mat = new THREE.MeshStandardMaterial({
      color: '#27272a',
      roughness: 0.4,
      metalness: 0.6,
      emissive: '#06b6d4',
      emissiveIntensity: 0.2,
    });
    mainMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.24), mat);
  } else {
    // Scroll / Parchment
    const mat = new THREE.MeshStandardMaterial({
      color: '#fef3c7',
      roughness: 0.7,
      emissive: '#d97706',
      emissiveIntensity: 0.25,
    });
    mainMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.56, 14), mat);
    mainMesh.rotation.z = Math.PI / 2;
  }

  mainMesh.castShadow = true;
  group.add(mainMesh);

  // Subtle glowing investigation aura ring around the clue
  const auraGeo = new THREE.RingGeometry(0.32, 0.42, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: '#facc15',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.45,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.rotation.x = -Math.PI / 2;
  aura.position.y = -0.02;
  group.add(aura);

  group.position.set(clue.x, clue.y, clue.z);
  group.userData = {
    isClue: true,
    clueId: clue.id,
    aura,
    auraMat,
    mainMesh,
  };

  return group;
}

/**
 * Builds a 3D Polyhedral Die mesh with numbered faces for d4, d6, d8, d10, d12, d20
 */
export function createDieMesh3D(sides = 20, elementColor = '#dc2626') {
  let geo;
  const radius = 0.34;
  if (sides === 4) geo = new THREE.TetrahedronGeometry(radius);
  else if (sides === 6) geo = new THREE.BoxGeometry(radius * 1.35, radius * 1.35, radius * 1.35);
  else if (sides === 8) geo = new THREE.OctahedronGeometry(radius);
  else if (sides === 12 || sides === 10) geo = new THREE.DodecahedronGeometry(radius);
  else geo = new THREE.IcosahedronGeometry(radius);

  const mat = new THREE.MeshStandardMaterial({
    color: '#18181b',
    roughness: 0.25,
    metalness: 0.65,
    emissive: elementColor,
    emissiveIntensity: 0.28,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Wireframe gold/crimson edges for authentic RPG die look
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: elementColor, linewidth: 2 })
  );
  mesh.add(edges);

  return mesh;
}
