import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  MAP_BOUNDS,
  STATIC_WALL_SEGMENTS,
  getDoorSegment,
  computeVisibilityPolygon,
  isPointVisibleToViewers,
} from '../utils/fogOfWarEngine';
import {
  createWoodFloorTexture,
  createOccultSigilTexture,
  createHandCursor3D,
  updateHandCursorPose,
  createTokenMesh3D,
  createHandoutMesh3D,
  createDieMesh3D,
} from '../utils/sceneBuilders';
import { soundEngine } from '../utils/soundEngine';

export default function Tabletop3D({
  role, // 'gm' | 'arthur' | 'dante'
  tokens,
  setTokens,
  selectedTokenId,
  setSelectedTokenId,
  handouts,
  onInspectHandout,
  doorLocked,
  setDoorLocked,
  doorAngleDeg,
  setDoorAngleDeg,
  manualDoorTargetRad,
  setManualDoorTargetRad,
  fogMode, // 'dynamic' | 'reveal_all' | 'brush_reveal' | 'brush_hide'
  manualRoom2Revealed,
  rollRequest,
  activeRitualEffect,
  spawnedProps,
  showTeamCursors,
  rulerForcedOn,
  onNotification,
}) {
  const mountRef = useRef(null);

  // Live HUD overlays projected from 3D world coordinates
  const [tokenLabels, setTokenLabels] = useState([]);
  const [rulerInfo, setRulerInfo] = useState(null);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [hoveredClueId, setHoveredClueId] = useState(null);

  // Mutable refs for 60fps animation loop access without re-mounting WebGL context
  const stateRef = useRef({
    role,
    tokens,
    selectedTokenId,
    handouts,
    doorLocked,
    fogMode,
    manualRoom2Revealed,
    showTeamCursors,
    rulerForcedOn,
    hoveredClueId: null,
  });

  useEffect(() => {
    stateRef.current = {
      ...stateRef.current,
      role,
      tokens,
      selectedTokenId,
      handouts,
      doorLocked,
      fogMode,
      manualRoom2Revealed,
      showTeamCursors,
      rulerForcedOn,
    };
  }, [
    role,
    tokens,
    selectedTokenId,
    handouts,
    doorLocked,
    fogMode,
    manualRoom2Revealed,
    showTeamCursors,
    rulerForcedOn,
  ]);

  const engineRef = useRef(null);

  // Keyboard listener for Spacebar (Inspect hovered clue) and Tab/Alt (3D Ruler)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' || e.key === 'Alt') {
        if (e.key === 'Tab') e.preventDefault();
        if (engineRef.current) engineRef.current.isMeasureKeyHold = true;
      }
      if (e.code === 'Space' && stateRef.current.hoveredClueId) {
        e.preventDefault();
        const clue = stateRef.current.handouts.find((h) => h.id === stateRef.current.hoveredClueId);
        if (clue) onInspectHandout(clue);
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'Tab' || e.key === 'Alt') {
        if (engineRef.current) engineRef.current.isMeasureKeyHold = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onInspectHandout]);

  // Main Three.js + Cannon-es Initialization
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. THREE.Scene, Camera & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07070a');
    scene.fog = new THREE.FogExp2('#07070a', 0.018);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 120);
    // Spherical orbital camera parameters
    const camSpherical = {
      target: new THREE.Vector3(-0.8, 0, 0.3),
      radius: 15.5,
      theta: -0.22, // slight angle
      phi: 0.68, // ~40 degrees from vertical
    };

    const updateCameraFromSpherical = () => {
      camSpherical.phi = Math.max(0.18, Math.min(1.38, camSpherical.phi));
      camSpherical.radius = Math.max(5.5, Math.min(28, camSpherical.radius));
      const sinPhi = Math.sin(camSpherical.phi);
      camera.position.x = camSpherical.target.x + camSpherical.radius * sinPhi * Math.sin(camSpherical.theta);
      camera.position.y = camSpherical.target.y + camSpherical.radius * Math.cos(camSpherical.phi);
      camera.position.z = camSpherical.target.z + camSpherical.radius * sinPhi * Math.cos(camSpherical.theta);
      camera.lookAt(camSpherical.target);
    };
    updateCameraFromSpherical();

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. CANNON.World Physics Setup
    const world = new CANNON.World();
    world.gravity.set(0, -22, 0);
    world.allowSleep = false;

    const groundPhysMat = new CANNON.Material('groundMat');
    const objectPhysMat = new CANNON.Material('objectMat');
    world.addContactMaterial(
      new CANNON.ContactMaterial(groundPhysMat, objectPhysMat, {
        friction: 0.45,
        restitution: 0.32,
      })
    );

    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: groundPhysMat,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight('#27273a', 0.65);
    scene.add(ambientLight);

    // Warm Desk Lamp Light in Room 1 (Investigation Office)
    const deskLight = new THREE.PointLight('#fb923c', 2.4, 9.5, 1.5);
    deskLight.position.set(-3.2, 2.2, -2.4);
    deskLight.castShadow = true;
    deskLight.shadow.mapSize.set(1024, 1024);
    scene.add(deskLight);

    // Eerie Crimson/Occult Light in Room 2 (Hidden Ritual Room)
    const ritualRoomLight = new THREE.PointLight('#dc2626', 2.6, 10.5, 1.5);
    ritualRoomLight.position.set(3.8, 2.4, 0);
    ritualRoomLight.castShadow = true;
    scene.add(ritualRoomLight);

    // 4. Tabletop Surface, Hardwood Floor & Tactical 1.5m Grid
    const outerTableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.5, 14),
      new THREE.MeshStandardMaterial({ color: '#110d0a', roughness: 0.85, metalness: 0.1 })
    );
    outerTableMesh.position.set(0, -0.26, 0);
    outerTableMesh.receiveShadow = true;
    scene.add(outerTableMesh);

    const woodTex = createWoodFloorTexture();
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_BOUNDS.width, MAP_BOUNDS.height),
      new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.68,
        metalness: 0.08,
      })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Tactical 1.5m Square Grid Helper (10x6 squares = 15m x 9m)
    const gridGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.11,
    });
    for (let x = -7.5; x <= 7.501; x += 1.5) {
      const pts = [new THREE.Vector3(x, 0.012, -4.5), new THREE.Vector3(x, 0.012, 4.5)];
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let z = -4.5; z <= 4.501; z += 1.5) {
      const pts = [new THREE.Vector3(-7.5, 0.012, z), new THREE.Vector3(7.5, 0.012, z)];
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    scene.add(gridGroup);

    // 5. Walls & Architecture (Room 1: Investigation Office | Room 2: Hidden Ritual Chamber)
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#1e1b18',
      roughness: 0.78,
      metalness: 0.12,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#3f2e21',
      roughness: 0.55,
    });

    const addWallBox = (cx, cz, w, d, h = 2.5) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      mesh.position.set(cx, h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Top wooden crown trim
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.08, d + 0.04), trimMat);
      trim.position.set(cx, h + 0.04, cz);
      scene.add(trim);

      // Physics collider
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
      });
      body.position.set(cx, h / 2, cz);
      world.addBody(body);
    };

    // Outer perimeter walls (low cutaway height so camera sees inside clearly)
    addWallBox(0, -4.5, 15.2, 0.28, 2.2); // North
    addWallBox(0, 4.5, 15.2, 0.28, 1.35); // South (low cutaway)
    addWallBox(-7.5, 0, 0.28, 9.2, 2.2); // West
    addWallBox(7.5, 0, 0.28, 9.2, 2.2); // East

    // Central Dividing Wall at x = 0 with Doorway Gap (z from -1.05 to +0.95)
    addWallBox(0, -2.775, 0.28, 3.45, 2.4); // North divider segment
    addWallBox(0, 2.725, 0.28, 3.55, 2.4); // South divider segment

    // Door Frame Lintel above the doorway
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 2.1), trimMat);
    lintel.position.set(0, 2.32, -0.05);
    scene.add(lintel);

    // 6. PHYSICAL INTERACTIVE DOOR WITH CANNON.HingeConstraint
    const doorLength = 2.0;
    const doorHeight = 2.15;
    const doorThickness = 0.12;
    const hingeX = 0;
    const hingeZ = -1.05;

    // Static Hinge Post Body
    const hingePivotBody = new CANNON.Body({ mass: 0 });
    hingePivotBody.position.set(hingeX, doorHeight / 2, hingeZ);
    world.addBody(hingePivotBody);

    // Dynamic Physical Door Body
    const doorBody = new CANNON.Body({
      mass: 12,
      shape: new CANNON.Box(new CANNON.Vec3(doorThickness / 2, doorHeight / 2, doorLength / 2)),
      linearDamping: 0.5,
      angularDamping: 0.78,
    });
    doorBody.position.set(hingeX, doorHeight / 2, hingeZ + doorLength / 2);
    world.addBody(doorBody);

    // Real HingeConstraint connecting door edge to hinge post
    const doorHinge = new CANNON.HingeConstraint(hingePivotBody, doorBody, {
      pivotA: new CANNON.Vec3(0, 0, 0),
      axisA: new CANNON.Vec3(0, 1, 0),
      pivotB: new CANNON.Vec3(0, 0, -doorLength / 2),
      axisB: new CANNON.Vec3(0, 1, 0),
      collideConnected: false,
    });
    world.addConstraint(doorHinge);

    // Three.js Door Visual Group
    const doorGroup = new THREE.Group();
    const doorWoodMat = new THREE.MeshStandardMaterial({
      color: '#5c2d16',
      roughness: 0.55,
      metalness: 0.15,
    });
    const doorPanelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(doorThickness, doorHeight, doorLength),
      doorWoodMat
    );
    doorPanelMesh.castShadow = true;
    doorPanelMesh.receiveShadow = true;
    doorGroup.add(doorPanelMesh);

    // Brass Doorknobs on both sides (near the swinging edge z = +doorLength/2 - 0.22)
    const knobMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      roughness: 0.25,
      metalness: 0.85,
      emissive: '#ca8a04',
      emissiveIntensity: 0.35,
    });
    const knobGeo = new THREE.SphereGeometry(0.085, 16, 16);
    const knobLeft = new THREE.Mesh(knobGeo, knobMat);
    knobLeft.position.set(-0.11, 0, doorLength / 2 - 0.22);
    const knobRight = new THREE.Mesh(knobGeo, knobMat);
    knobRight.position.set(0.11, 0, doorLength / 2 - 0.22);
    doorGroup.add(knobLeft, knobRight);

    // Lock status indicator light on door above knob
    const lockIndicatorMat = new THREE.MeshBasicMaterial({
      color: stateRef.current.doorLocked ? '#ef4444' : '#22c55e',
    });
    const lockIndicator = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), lockIndicatorMat);
    lockIndicator.position.set(0, 0.26, doorLength / 2 - 0.22);
    doorGroup.add(lockIndicator);

    doorGroup.userData = { isDoor: true, knobMat, lockIndicatorMat };
    scene.add(doorGroup);

    // 7. Interior Props & Environment Details (Room 1 & Room 2)
    const room2Objects = []; // Track objects in Room 2 to hide from players when blocked by Fog of War

    // Room 1: Investigation Desk (x: -3.3, z: -2.2)
    const deskGroup = new THREE.Group();
    const deskMat = new THREE.MeshStandardMaterial({ color: '#3b1f0e', roughness: 0.6 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 2.4), deskMat);
    deskTop.position.y = 0.85;
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    deskGroup.add(deskTop);
    [
      [-0.75, -1.05],
      [0.75, -1.05],
      [-0.75, 1.05],
      [0.75, 1.05],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), deskMat);
      leg.position.set(lx, 0.425, lz);
      leg.castShadow = true;
      deskGroup.add(leg);
    });
    // Banker's green/amber lamp on desk
    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.8, roughness: 0.2 })
    );
    lampBase.position.set(-0.35, 1.05, -0.75);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.2, 14),
      new THREE.MeshStandardMaterial({
        color: '#15803d',
        emissive: '#f59e0b',
        emissiveIntensity: 0.7,
      })
    );
    lampShade.position.set(-0.35, 1.24, -0.75);
    deskGroup.add(lampBase, lampShade);
    deskGroup.position.set(-3.3, 0, -2.0);
    scene.add(deskGroup);

    // Room 1: South Side Table (for torn photo)
    const sideTable = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.74, 1.2), deskMat);
    sideTable.position.set(-1.8, 0.37, 2.3);
    sideTable.castShadow = true;
    sideTable.receiveShadow = true;
    scene.add(sideTable);

    // Room 1: Bookshelf against West Wall
    const shelfMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 2.1, 3.2),
      new THREE.MeshStandardMaterial({ color: '#291509', roughness: 0.75 })
    );
    shelfMesh.position.set(-7.05, 1.05, -1.2);
    shelfMesh.castShadow = true;
    scene.add(shelfMesh);

    // Room 1: Worn Persian Rug
    const rugMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 3.2),
      new THREE.MeshStandardMaterial({ color: '#451a1c', roughness: 0.9 })
    );
    rugMesh.rotation.x = -Math.PI / 2;
    rugMesh.position.set(-3.8, 0.015, 0.4);
    rugMesh.receiveShadow = true;
    scene.add(rugMesh);

    // Room 2 (Hidden Ritual Room): Glowing Occult Transcendence Circle on the floor
    const sigilTex = createOccultSigilTexture('#dc2626');
    const sigilMat = new THREE.MeshBasicMaterial({
      map: sigilTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sigilMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), sigilMat);
    sigilMesh.rotation.x = -Math.PI / 2;
    sigilMesh.position.set(3.8, 0.025, 0.2);
    scene.add(sigilMesh);
    room2Objects.push(sigilMesh);

    // Room 2: Stone Occult Altar
    const altarMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.92, 2.2),
      new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.85, metalness: 0.2 })
    );
    altarMesh.position.set(4.6, 0.46, -2.1);
    altarMesh.castShadow = true;
    altarMesh.receiveShadow = true;
    scene.add(altarMesh);
    room2Objects.push(altarMesh);

    // 8. DYNAMIC RAYCASTING FOG OF WAR OVERLAY (512x512 CanvasTexture)
    const fogCanvas = document.createElement('canvas');
    fogCanvas.width = 512;
    fogCanvas.height = 512;
    const fogCtx = fogCanvas.getContext('2d');

    // Manual paint mask canvas for GM Brush Tool
    const manualMaskCanvas = document.createElement('canvas');
    manualMaskCanvas.width = 512;
    manualMaskCanvas.height = 512;
    const manualMaskCtx = manualMaskCanvas.getContext('2d');

    const fogTexture = new THREE.CanvasTexture(fogCanvas);
    fogTexture.minFilter = THREE.LinearFilter;
    fogTexture.magFilter = THREE.LinearFilter;

    const fogPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_BOUNDS.width, MAP_BOUNDS.height),
      new THREE.MeshBasicMaterial({
        map: fogTexture,
        transparent: true,
        depthWrite: false,
      })
    );
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.set(0, 1.88, 0); // Above tokens/tables to shroud unseen rooms in pitch black
    scene.add(fogPlane);

    // 9. 3D Floating Hand Cursors ("Mãozinhas")
    const mainHandCursor = createHandCursor3D('#f59e0b', 'Você');
    mainHandCursor.position.set(-2.5, 1.65, 0.5);
    scene.add(mainHandCursor);

    const peerHandCursor = createHandCursor3D('#a855f7', 'Dante (J2)');
    peerHandCursor.position.set(-3.1, 1.65, -1.6);
    scene.add(peerHandCursor);

    // 10. 3D Tactical Ruler Group (Tab / Alt Measurement: 1.5m = 1 square)
    const rulerGroup = new THREE.Group();
    const rulerLineMat = new THREE.LineBasicMaterial({ color: '#facc15', linewidth: 3 });
    const rulerLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, 0.2, 0),
    ]);
    const rulerLine = new THREE.Line(rulerLineGeo, rulerLineMat);
    rulerGroup.add(rulerLine);

    const rulerStartSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 14),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    const rulerEndSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 14, 14),
      new THREE.MeshBasicMaterial({ color: '#ef4444' })
    );
    rulerGroup.add(rulerStartSphere, rulerEndSphere);
    const rulerTicksGroup = new THREE.Group();
    rulerGroup.add(rulerTicksGroup);
    rulerGroup.visible = false;
    scene.add(rulerGroup);

    // 11. Token Meshes, Physics Bodies & SpotLights Registry
    const tokenRecords = new Map();
    const clueMeshes = new Map();
    const diceRecords = [];
    const particleSystems = [];
    const customPropMeshes = [];

    // Raycaster & Mouse interaction state
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    const groundPlaneMath = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragPlaneMath = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.1);
    const mouseWorldPos = new THREE.Vector3(-2, 0, 0);
    const prevMouseWorldPos = new THREE.Vector3(-2, 0, 0);

    let interactionMode = null; // 'drag_token' | 'drag_door' | 'orbit_camera' | 'pan_camera' | 'paint_fog'
    let draggedTokenId = null;
    let dragStartWorld = new THREE.Vector3();
    let prevPointer = { x: 0, y: 0 };
    let doorCurrentAngle = 0; // Radians around hinge (-1.2 to +1.2)
    let lastDoorSlamTime = 0;

    // Helper: Convert world (x, z) to Fog Canvas (px, py)
    const worldToFogCanvas = (wx, wz) => {
      const u = (wx - MAP_BOUNDS.minX) / MAP_BOUNDS.width;
      const v = (wz - MAP_BOUNDS.minZ) / MAP_BOUNDS.height;
      return {
        x: u * 512,
        y: v * 512,
      };
    };

    // Helper: Paint on manual fog mask when GM uses Fog Brush
    const paintManualFogAt = (wx, wz, reveal = true) => {
      const pt = worldToFogCanvas(wx, wz);
      manualMaskCtx.save();
      manualMaskCtx.beginPath();
      manualMaskCtx.arc(pt.x, pt.y, 44, 0, Math.PI * 2);
      if (reveal) {
        manualMaskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
        manualMaskCtx.globalCompositeOperation = 'source-over';
      } else {
        manualMaskCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        manualMaskCtx.globalCompositeOperation = 'destination-out';
      }
      manualMaskCtx.fill();
      manualMaskCtx.restore();
    };

    // Mouse / Pointer Event Handlers
    const updateMouseWorld = (clientX, clientY) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouseNDC, camera);
      prevMouseWorldPos.copy(mouseWorldPos);
      raycaster.ray.intersectPlane(groundPlaneMath, mouseWorldPos);
    };

    const onPointerDown = (e) => {
      soundEngine.init();
      updateMouseWorld(e.clientX, e.clientY);
      prevPointer = { x: e.clientX, y: e.clientY };

      const currentRole = stateRef.current.role;
      const currentFogMode = stateRef.current.fogMode;

      // GM Fog Brush Mode
      if (
        e.button === 0 &&
        currentRole === 'gm' &&
        (currentFogMode === 'brush_reveal' || currentFogMode === 'brush_hide')
      ) {
        interactionMode = 'paint_fog';
        paintManualFogAt(mouseWorldPos.x, mouseWorldPos.z, currentFogMode === 'brush_reveal');
        return;
      }

      // Right-click (button === 2)
      if (e.button === 2) {
        // Check if right-clicking on the physical door
        const doorHits = raycaster.intersectObject(doorGroup, true);
        if (doorHits.length > 0) {
          if (currentRole === 'gm') {
            const nextLocked = !stateRef.current.doorLocked;
            setDoorLocked(nextLocked);
            soundEngine.playSFX('door_locked');
            onNotification(
              nextLocked
                ? '🔒 Porta Trancada pelo Mestre!'
                : '🔓 Porta Destrancada pelo Mestre!'
            );
          } else {
            onNotification('⚠️ Apenas o Mestre pode trancar/destrancar portas diretamente.');
          }
          return;
        }
        interactionMode = 'orbit_camera';
        return;
      }

      // Middle click or Shift+Left click -> Pan camera
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        interactionMode = 'pan_camera';
        return;
      }

      if (e.button !== 0) return;

      // 1. Check if clicking an Inspectable 3D Clue / Handout
      const clueMeshList = Array.from(clueMeshes.values());
      const clueHits = raycaster.intersectObjects(clueMeshList, true);
      if (clueHits.length > 0) {
        let obj = clueHits[0].object;
        while (obj && !obj.userData?.isClue) obj = obj.parent;
        if (obj && obj.userData?.clueId && obj.visible) {
          const clue = stateRef.current.handouts.find((h) => h.id === obj.userData.clueId);
          if (clue) {
            onInspectHandout(clue);
            return;
          }
        }
      }

      // 2. Check if clicking the Physical Hinge-Joint Door
      const doorHits = raycaster.intersectObject(doorGroup, true);
      if (doorHits.length > 0) {
        if (stateRef.current.doorLocked && currentRole !== 'gm') {
          soundEngine.playSFX('door_locked');
          onNotification('🔒 A porta está TRANCADA! Arraste seu agente ou peça ao Mestre para destrancar.');
          // Slight rattle impulse
          doorBody.angularVelocity.set(0, (Math.random() - 0.5) * 2.5, 0);
          return;
        }
        interactionMode = 'drag_door';
        soundEngine.playSFX('door_creak');
        return;
      }

      // 3. Check if clicking a 3D Token Miniature
      const tokenMeshList = Array.from(tokenRecords.values()).map((r) => r.mesh);
      const tokenHits = raycaster.intersectObjects(tokenMeshList, true);
      if (tokenHits.length > 0) {
        let obj = tokenHits[0].object;
        while (obj && !obj.userData?.tokenId) obj = obj.parent;
        if (obj && obj.userData?.tokenId && obj.visible) {
          const clickedId = obj.userData.tokenId;
          const tokenObj = stateRef.current.tokens.find((t) => t.id === clickedId);
          setSelectedTokenId(clickedId);

          // Permission check: GM can move all; Player can only move their own token
          if (currentRole !== 'gm' && tokenObj?.owner !== currentRole) {
            onNotification(
              `🚫 Permissão Negada: No modo Jogador (${currentRole.toUpperCase()}), você só pode mover seu próprio token!`
            );
            return;
          }

          interactionMode = 'drag_token';
          draggedTokenId = clickedId;
          const rec = tokenRecords.get(clickedId);
          if (rec) {
            dragStartWorld.set(rec.body.position.x, 0, rec.body.position.z);
          }
          return;
        }
      }

      // 4. Otherwise, left-drag on empty space orbits the camera smoothly
      interactionMode = 'orbit_camera';
    };

    const onPointerMove = (e) => {
      updateMouseWorld(e.clientX, e.clientY);
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      prevPointer = { x: e.clientX, y: e.clientY };

      if (interactionMode === 'paint_fog') {
        paintManualFogAt(
          mouseWorldPos.x,
          mouseWorldPos.z,
          stateRef.current.fogMode === 'brush_reveal'
        );
        return;
      }

      if (interactionMode === 'orbit_camera') {
        camSpherical.theta -= dx * 0.0065;
        camSpherical.phi -= dy * 0.0055;
        updateCameraFromSpherical();
        return;
      }

      if (interactionMode === 'pan_camera') {
        const panSpeed = 0.018;
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        camSpherical.target.addScaledVector(right, -dx * panSpeed);
        camSpherical.target.addScaledVector(forward, dy * panSpeed);
        updateCameraFromSpherical();
        return;
      }

      if (interactionMode === 'drag_door') {
        // Compute desired door angle from hinge (0, -1.05) toward the 3D Hand Cursor position
        const relX = mouseWorldPos.x - hingeX;
        const relZ = mouseWorldPos.z - hingeZ;
        let desiredAngle = Math.atan2(relX, Math.max(0.15, relZ));
        desiredAngle = Math.max(-1.95, Math.min(1.95, desiredAngle));

        // Apply physical torque/angular velocity to the Cannon door body toward desiredAngle
        const angleError = desiredAngle - doorCurrentAngle;
        doorBody.angularVelocity.set(0, angleError * 14, 0);
        return;
      }

      if (interactionMode === 'drag_token' && draggedTokenId) {
        const rec = tokenRecords.get(draggedTokenId);
        if (rec) {
          const hitPt = new THREE.Vector3();
          raycaster.ray.intersectPlane(dragPlaneMath, hitPt);

          // Clamp inside map walls and avoid crossing closed door
          let targetX = Math.max(-6.9, Math.min(6.9, hitPt.x));
          let targetZ = Math.max(-3.9, Math.min(3.9, hitPt.z));

          // Block player from dragging token directly through the dividing wall (x = 0) if not in doorway or if door is closed
          const inDoorwayZ = targetZ > -0.95 && targetZ < 0.85;
          const doorIsOpenEnough = Math.abs(doorCurrentAngle) > 0.42;
          if (stateRef.current.role !== 'gm') {
            const startX = dragStartWorld.x;
            if (startX < 0 && targetX > -0.35 && (!inDoorwayZ || !doorIsOpenEnough)) {
              targetX = -0.38;
            }
          }

          // Smoothly rotate token toward movement direction or mouse direction
          const moveDx = targetX - rec.body.position.x;
          const moveDz = targetZ - rec.body.position.z;
          if (Math.hypot(moveDx, moveDz) > 0.04) {
            rec.targetRotation = Math.atan2(-moveDz, moveDx);
          }

          rec.body.position.set(targetX, 1.45, targetZ);
          rec.body.velocity.set(0, 0, 0);

          // Update Tactical 3D Ruler if Tab/Alt is held or ruler button is active
          const showRuler =
            engineRef.current?.isMeasureKeyHold || stateRef.current.rulerForcedOn;
          if (showRuler) {
            rulerGroup.visible = true;
            rulerStartSphere.position.set(dragStartWorld.x, 0.18, dragStartWorld.z);
            rulerEndSphere.position.set(targetX, 0.18, targetZ);
            rulerLine.geometry.setFromPoints([
              new THREE.Vector3(dragStartWorld.x, 0.18, dragStartWorld.z),
              new THREE.Vector3(targetX, 0.18, targetZ),
            ]);

            // Rebuild 1.5m square tick markers along the line
            while (rulerTicksGroup.children.length > 0) {
              rulerTicksGroup.remove(rulerTicksGroup.children[0]);
            }
            const distUnits = Math.hypot(
              targetX - dragStartWorld.x,
              targetZ - dragStartWorld.z
            );
            // 1.5 world units = 1 square = 1.5 meters in Ordem Paranormal
            const meters = distUnits;
            const squares = meters / 1.5;
            const wholeSquares = Math.floor(squares);

            for (let s = 1; s <= wholeSquares; s++) {
              const t = (s * 1.5) / (distUnits || 1);
              const tx = dragStartWorld.x + (targetX - dragStartWorld.x) * t;
              const tz = dragStartWorld.z + (targetZ - dragStartWorld.z) * t;
              const tick = new THREE.Mesh(
                new THREE.SphereGeometry(0.08, 8, 8),
                new THREE.MeshBasicMaterial({
                  color: s <= 6 ? '#22c55e' : s <= 12 ? '#f59e0b' : '#ef4444',
                })
              );
              tick.position.set(tx, 0.18, tz);
              rulerTicksGroup.add(tick);
            }

            // Project midpoint to screen for floating Ruler HUD
            const mid = new THREE.Vector3(
              (dragStartWorld.x + targetX) / 2,
              0.9,
              (dragStartWorld.z + targetZ) / 2
            );
            mid.project(camera);
            const sx = (mid.x * 0.5 + 0.5) * renderer.domElement.clientWidth;
            const sy = (-mid.y * 0.5 + 0.5) * renderer.domElement.clientHeight;
            setRulerInfo({
              x: sx,
              y: sy,
              meters: meters.toFixed(1),
              squares: squares.toFixed(1),
              status:
                meters <= 9.0
                  ? 'Deslocamento Normal (≤ 9m / 6q)'
                  : meters <= 18.0
                  ? 'Corrida Completa (≤ 18m / 12q)'
                  : 'Acima do Limite de Turno',
            });
          } else {
            rulerGroup.visible = false;
            setRulerInfo(null);
          }
        }
        return;
      }

      // Hover detection when not dragging
      const doorHover = raycaster.intersectObject(doorGroup, true);
      if (doorHover.length > 0) {
        doorGroup.userData.knobMat.emissiveIntensity = 0.95;
        setHoveredInfo({
          title: stateRef.current.doorLocked ? '🔒 Porta de Carvalho (Trancada)' : '🚪 Porta Física (Destrancada)',
          hint: 'Segure e arraste com a mãozinha para entreabrir ou escancarar • Clique Direito (GM): Trancar',
        });
        stateRef.current.hoveredClueId = null;
        setHoveredClueId(null);
        return;
      } else {
        doorGroup.userData.knobMat.emissiveIntensity = 0.35;
      }

      const clueMeshList = Array.from(clueMeshes.values());
      const clueHover = raycaster.intersectObjects(clueMeshList, true);
      if (clueHover.length > 0) {
        let obj = clueHover[0].object;
        while (obj && !obj.userData?.isClue) obj = obj.parent;
        if (obj && obj.userData?.clueId && obj.visible) {
          const clue = stateRef.current.handouts.find((h) => h.id === obj.userData.clueId);
          stateRef.current.hoveredClueId = obj.userData.clueId;
          setHoveredClueId(obj.userData.clueId);
          setHoveredInfo({
            title: `🔍 Pista: ${clue?.title || 'Documento'}`,
            hint: 'Clique ou pressione [ESPAÇO] para inspecionar em Alta Resolução 3D',
          });
          return;
        }
      }

      stateRef.current.hoveredClueId = null;
      setHoveredClueId(null);
      setHoveredInfo(null);
    };

    const onPointerUp = () => {
      if (interactionMode === 'drag_token' && draggedTokenId) {
        const rec = tokenRecords.get(draggedTokenId);
        if (rec) {
          // Commit updated token coordinates to React state
          const finalX = Number(rec.body.position.x.toFixed(2));
          const finalZ = Number(rec.body.position.z.toFixed(2));
          const finalRot = rec.targetRotation || 0;
          setTokens((prev) =>
            prev.map((t) =>
              t.id === draggedTokenId
                ? { ...t, x: finalX, z: finalZ, rotation: finalRot }
                : t
            )
          );
        }
      }
      interactionMode = null;
      draggedTokenId = null;
      rulerGroup.visible = false;
      setRulerInfo(null);
    };

    const onWheel = (e) => {
      e.preventDefault();
      camSpherical.radius += e.deltaY * 0.01;
      updateCameraFromSpherical();
    };

    const onContextMenu = (e) => e.preventDefault();

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });
    domEl.addEventListener('contextmenu', onContextMenu);

    // Expose camera & physics controls to parent ref
    engineRef.current = {
      scene,
      camera,
      world,
      camSpherical,
      updateCameraFromSpherical,
      tokenRecords,
      clueMeshes,
      diceRecords,
      particleSystems,
      customPropMeshes,
      doorBody,
      doorGroup,
      manualMaskCtx,
      room2Objects,
      isMeasureKeyHold: false,
      setDoorTargetAngle: (rad) => {
        doorCurrentAngle = rad;
        doorBody.angularVelocity.set(0, 0, 0);
        doorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rad);
      },
      clearManualFog: (revealRoom2 = false) => {
        manualMaskCtx.clearRect(0, 0, 512, 512);
        if (revealRoom2) {
          manualMaskCtx.fillStyle = '#ffffff';
          manualMaskCtx.fillRect(256, 0, 256, 512);
        }
      },
    };

    // 12. MAIN 60FPS ANIMATION, PHYSICS & RAYCAST FOG OF WAR LOOP
    let animationFrameId;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Step Cannon.js Physics World
      world.step(1 / 60, dt, 3);

      // Enforce Hinge Door Constraints & Lock State
      const q = doorBody.quaternion;
      // Extract Y rotation angle of the door around its hinge
      const rawAngle = 2 * Math.atan2(q.y, q.w);
      if (stateRef.current.doorLocked && Math.abs(rawAngle) < 0.08) {
        doorCurrentAngle = 0;
        doorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0);
        doorBody.angularVelocity.scale(0.1, doorBody.angularVelocity);
      } else {
        // Clamp door swing within [-1.95, +1.95] rad (~112 degrees each way)
        const clamped = Math.max(-1.95, Math.min(1.95, rawAngle));
        if (clamped !== rawAngle) {
          doorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), clamped);
          doorBody.angularVelocity.set(0, 0, 0);
        }
        // Slam sound if door crosses closed position at high angular velocity
        if (
          Math.abs(clamped) < 0.05 &&
          Math.abs(doorBody.angularVelocity.y) > 2.2 &&
          elapsed - lastDoorSlamTime > 0.6
        ) {
          lastDoorSlamTime = elapsed;
          soundEngine.playSFX('door_knock');
        }
        doorCurrentAngle = clamped;
      }

      // Keep doorBody anchored cleanly to its hinge pivot at (0, doorHeight/2, -1.05)
      const halfLen = doorLength / 2;
      doorBody.position.set(
        hingeX + Math.sin(doorCurrentAngle) * halfLen,
        doorHeight / 2,
        hingeZ + Math.cos(doorCurrentAngle) * halfLen
      );
      doorBody.velocity.set(0, 0, 0);

      doorGroup.position.copy(doorBody.position);
      doorGroup.quaternion.copy(doorBody.quaternion);
      doorGroup.userData.lockIndicatorMat.color.set(
        stateRef.current.doorLocked ? '#ef4444' : '#22c55e'
      );

      // Sync door angle readout to React UI occasionally
      const degRounded = Math.round((doorCurrentAngle * 180) / Math.PI);
      setDoorAngleDeg((prev) => (prev !== degRounded ? degRounded : prev));

      // Update 3D Hand Cursor ("Mãozinha") position, color & finger grabbing animation
      const roleColors = {
        gm: '#ef4444',
        arthur: '#f59e0b',
        dante: '#a855f7',
      };
      const activeHandColor = roleColors[stateRef.current.role] || '#f59e0b';
      mainHandCursor.userData.skinMat.color.set(activeHandColor);
      mainHandCursor.userData.skinMat.emissive.set(activeHandColor);
      mainHandCursor.userData.ringMat.color.set(activeHandColor);
      mainHandCursor.userData.beamMat.color.set(activeHandColor);

      const targetHandY =
        interactionMode === 'drag_token' || interactionMode === 'drag_door' ? 1.45 : 1.72;
      mainHandCursor.position.x += (mouseWorldPos.x - mainHandCursor.position.x) * 0.35;
      mainHandCursor.position.z += (mouseWorldPos.z - mainHandCursor.position.z) * 0.35;
      mainHandCursor.position.y +=
        (targetHandY + Math.sin(elapsed * 4) * 0.04 - mainHandCursor.position.y) * 0.25;

      // Tilt hand slightly based on pointer velocity
      const velX = mouseWorldPos.x - prevMouseWorldPos.x;
      const velZ = mouseWorldPos.z - prevMouseWorldPos.z;
      mainHandCursor.rotation.z = THREE.MathUtils.clamp(-velX * 1.4, -0.45, 0.45);
      mainHandCursor.rotation.x = THREE.MathUtils.clamp(velZ * 1.4, -0.45, 0.45);

      const isGrabbingNow =
        interactionMode === 'drag_token' || interactionMode === 'drag_door';
      updateHandCursorPose(mainHandCursor, isGrabbingNow, dt);

      // Simulated Peer 3D Hand Cursor ("Mãozinha da Equipe")
      peerHandCursor.visible = Boolean(stateRef.current.showTeamCursors);
      if (peerHandCursor.visible) {
        peerHandCursor.position.x = -2.4 + Math.cos(elapsed * 0.9) * 1.4;
        peerHandCursor.position.z = -1.1 + Math.sin(elapsed * 1.3) * 1.1;
        peerHandCursor.position.y = 1.68 + Math.sin(elapsed * 3.2) * 0.06;
        updateHandCursorPose(peerHandCursor, Math.sin(elapsed * 2.5) > 0.75, dt);
      }

      // Compute Current Wall + Door Obstacle Segments for Real-Time Raycasting
      const activeSegments = [
        ...STATIC_WALL_SEGMENTS,
        getDoorSegment(doorCurrentAngle, hingeX, hingeZ, doorLength),
      ];

      // Determine active viewer tokens for Line-of-Sight (LoS)
      const allTokens = stateRef.current.tokens;
      const viewerTokens = allTokens.filter((t) => {
        if (stateRef.current.role === 'arthur') return t.id === 'arthur' || t.type === 'player';
        if (stateRef.current.role === 'dante') return t.id === 'dante' || t.type === 'player';
        return t.type === 'player';
      });

      // Update Tokens (Physics sync + Flashlight SpotLights + Visibility)
      const projectedLabels = [];
      tokenRecords.forEach((rec, id) => {
        const tokenData = allTokens.find((t) => t.id === id);
        if (!tokenData) return;

        if (draggedTokenId !== id) {
          // Keep token upright on the table while allowing vertical gravity drop
          rec.body.quaternion.set(0, 0, 0, 1);
          rec.body.angularVelocity.set(0, 0, 0);
          rec.body.velocity.x *= 0.8;
          rec.body.velocity.z *= 0.8;
        }

        rec.mesh.position.set(
          rec.body.position.x,
          Math.max(0, rec.body.position.y - 0.08),
          rec.body.position.z
        );

        // Smoothly point player token toward the door or mouse cursor when selected
        if (
          tokenData.type === 'player' &&
          stateRef.current.selectedTokenId === id &&
          interactionMode !== 'drag_token'
        ) {
          const dxToMouse = mouseWorldPos.x - rec.mesh.position.x;
          const dzToMouse = mouseWorldPos.z - rec.mesh.position.z;
          if (Math.hypot(dxToMouse, dzToMouse) > 0.4) {
            rec.targetRotation = Math.atan2(-dzToMouse, dxToMouse);
          }
        }

        const currentRot = rec.mesh.rotation.y;
        const diffRot = Math.atan2(
          Math.sin((rec.targetRotation || 0) - currentRot),
          Math.cos((rec.targetRotation || 0) - currentRot)
        );
        rec.mesh.rotation.y += diffRot * 0.18;

        // Update Token's Tactical Flashlight SpotLight
        if (rec.spotLight) {
          const flashOn = tokenData.flashlightOn !== false;
          rec.spotLight.visible = flashOn;
          if (rec.mesh.userData.flashlightCone) {
            rec.mesh.userData.flashlightCone.visible = flashOn;
          }
          rec.spotLight.position.set(
            rec.mesh.position.x,
            rec.mesh.position.y + 0.95,
            rec.mesh.position.z
          );
          const lookAngle = -rec.mesh.rotation.y;
          rec.spotLight.target.position.set(
            rec.mesh.position.x + Math.cos(lookAngle) * 6,
            0.3,
            rec.mesh.position.z + Math.sin(lookAngle) * 6
          );
          rec.spotLight.target.updateMatrixWorld();
        }

        // Check if token is visible to current user (hide Room 2 monsters from Players until LoS reveals them!)
        const isVisible =
          stateRef.current.role === 'gm' ||
          stateRef.current.fogMode === 'reveal_all' ||
          tokenData.type === 'player' ||
          isPointVisibleToViewers(
            rec.mesh.position.x,
            rec.mesh.position.z,
            viewerTokens.map((vt) => {
              const vr = tokenRecords.get(vt.id);
              return vr
                ? { x: vr.mesh.position.x, z: vr.mesh.position.z }
                : { x: vt.x, z: vt.z };
            }),
            activeSegments,
            stateRef.current.manualRoom2Revealed
          );

        rec.mesh.visible = isVisible;

        if (isVisible) {
          const headPos = new THREE.Vector3(
            rec.mesh.position.x,
            rec.mesh.position.y + 1.55,
            rec.mesh.position.z
          );
          headPos.project(camera);
          if (headPos.z < 1) {
            projectedLabels.push({
              id: tokenData.id,
              name: tokenData.name,
              type: tokenData.type,
              hp: tokenData.hp,
              maxHp: tokenData.maxHp,
              san: tokenData.san,
              maxSan: tokenData.maxSan,
              conditions: tokenData.conditions || [],
              isSelected: stateRef.current.selectedTokenId === tokenData.id,
              x: (headPos.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
              y: (-headPos.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
            });
          }
        }
      });
      setTokenLabels(projectedLabels);

      // Update Room 2 Clues & Props visibility + Clue Hover Pulse
      const liveViewers = viewerTokens.map((vt) => {
        const vr = tokenRecords.get(vt.id);
        return vr
          ? {
              x: vr.mesh.position.x,
              z: vr.mesh.position.z,
              facing: -vr.mesh.rotation.y,
              flashlightOn: vt.flashlightOn !== false,
            }
          : { x: vt.x, z: vt.z, facing: 0, flashlightOn: true };
      });

      clueMeshes.forEach((mesh, clueId) => {
        const isHovered = stateRef.current.hoveredClueId === clueId;
        mesh.userData.aura.scale.setScalar(
          isHovered ? 1.25 + Math.sin(elapsed * 8) * 0.12 : 1.0 + Math.sin(elapsed * 3) * 0.05
        );
        mesh.userData.auraMat.opacity = isHovered ? 0.95 : 0.42;
        mesh.userData.auraMat.color.set(isHovered ? '#fef08a' : '#eab308');

        // Hide Room 2 clues from Players until LoS reveals them
        if (mesh.position.x > 0.1 && stateRef.current.role !== 'gm') {
          mesh.visible = isPointVisibleToViewers(
            mesh.position.x,
            mesh.position.z,
            liveViewers,
            activeSegments,
            stateRef.current.manualRoom2Revealed
          );
        } else {
          mesh.visible = true;
        }
      });

      // Slowly rotate Room 2 Occult Sigil
      sigilMesh.rotation.z = elapsed * 0.18;
      ritualRoomLight.intensity = 2.2 + Math.sin(elapsed * 4.5) * 0.5;

      // 13. RENDER REAL-TIME RAYCASTING FOG OF WAR CANVAS TEXTURE
      fogCtx.clearRect(0, 0, 512, 512);
      if (stateRef.current.fogMode !== 'reveal_all') {
        // Fill entire map with Unexplored Darkness (Black Shadow)
        // GM gets semi-transparent shadow (0.48) to see through the darkness; Players get dense black (0.985)
        const shadowAlpha = stateRef.current.role === 'gm' ? 0.48 : 0.985;
        fogCtx.fillStyle = `rgba(5, 5, 9, ${shadowAlpha})`;
        fogCtx.fillRect(0, 0, 512, 512);

        fogCtx.save();
        fogCtx.globalCompositeOperation = 'destination-out';

        // Soft ambient visibility in Room 1 (starting room X < 0) so investigation furniture is dimly visible
        const r1Grad = fogCtx.createLinearGradient(0, 0, 260, 0);
        r1Grad.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
        r1Grad.addColorStop(0.95, 'rgba(255, 255, 255, 0.72)');
        r1Grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        fogCtx.fillStyle = r1Grad;
        fogCtx.fillRect(0, 0, 256, 512);

        // If GM manually revealed Room 2
        if (stateRef.current.manualRoom2Revealed) {
          fogCtx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          fogCtx.fillRect(255, 0, 257, 512);
        }

        // Dynamic Raycast Visibility Polygon for each Viewer Token (slices through open door crack!)
        liveViewers.forEach((viewer) => {
          const poly = computeVisibilityPolygon(
            viewer.x,
            viewer.z,
            viewer.facing,
            activeSegments,
            viewer.flashlightOn
          );
          if (poly.length > 2) {
            const originPx = worldToFogCanvas(viewer.x, viewer.z);
            const radGrad = fogCtx.createRadialGradient(
              originPx.x,
              originPx.y,
              12,
              originPx.x,
              originPx.y,
              215
            );
            radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            radGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.94)');
            radGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            fogCtx.fillStyle = radGrad;
            fogCtx.beginPath();
            poly.forEach((pt, idx) => {
              const cPt = worldToFogCanvas(pt.x, pt.z);
              if (idx === 0) fogCtx.moveTo(cPt.x, cPt.y);
              else fogCtx.lineTo(cPt.x, cPt.y);
            });
            fogCtx.closePath();
            fogCtx.fill();
          }
        });

        // Apply GM Manual Brush Mask
        fogCtx.drawImage(manualMaskCanvas, 0, 0);
        fogCtx.restore();
      }
      fogTexture.needsUpdate = true;

      // 14. Update 3D Physics Polyhedral Dice
      diceRecords.forEach((d) => {
        d.mesh.position.copy(d.body.position);
        d.mesh.quaternion.copy(d.body.quaternion);
      });

      // 15. Update Paranormal Ritual Particle Systems
      for (let i = particleSystems.length - 1; i >= 0; i--) {
        const ps = particleSystems[i];
        ps.age += dt;
        if (ps.age > ps.maxAge) {
          scene.remove(ps.group);
          particleSystems.splice(i, 1);
          continue;
        }
        const progress = ps.age / ps.maxAge;
        ps.ringMesh.rotation.z += dt * 2.8;
        ps.ringMesh.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.35);
        ps.ringMat.opacity = (1 - progress) * 0.9;
        ps.light.intensity = (1 - progress) * 4.5;

        const posArr = ps.points.geometry.attributes.position.array;
        for (let p = 0; p < ps.count; p++) {
          const i3 = p * 3;
          const angle = ps.angles[p] + ps.age * ps.speeds[p];
          const radius = ps.radii[p] * (1 - progress * 0.3);
          posArr[i3] = Math.cos(angle) * radius;
          posArr[i3 + 1] += dt * ps.upSpeeds[p];
          posArr[i3 + 2] = Math.sin(angle) * radius;
        }
        ps.points.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('wheel', onWheel);
      domEl.removeEventListener('contextmenu', onContextMenu);
      renderer.dispose();
    };
  }, []);

  // Sync Tokens state with Three.js + Cannon-es bodies
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    const currentIds = new Set(tokens.map((t) => t.id));

    // Remove deleted tokens
    eng.tokenRecords.forEach((rec, id) => {
      if (!currentIds.has(id)) {
        eng.scene.remove(rec.mesh);
        if (rec.spotLight) {
          eng.scene.remove(rec.spotLight);
          eng.scene.remove(rec.spotLight.target);
        }
        eng.world.removeBody(rec.body);
        eng.tokenRecords.delete(id);
      }
    });

    // Add or update tokens
    tokens.forEach((tokenData) => {
      let rec = eng.tokenRecords.get(tokenData.id);
      if (!rec) {
        const mesh = createTokenMesh3D(tokenData);
        mesh.position.set(tokenData.x, 1.8, tokenData.z);
        eng.scene.add(mesh);

        const body = new CANNON.Body({
          mass: 5,
          shape: new CANNON.Cylinder(0.55, 0.55, 0.2, 16),
          linearDamping: 0.4,
        });
        body.position.set(tokenData.x, 1.8, tokenData.z);
        eng.world.addBody(body);

        let spotLight = null;
        if (tokenData.type === 'player') {
          spotLight = new THREE.SpotLight('#fef9c3', 3.4, 13.5, Math.PI / 4.2, 0.45, 1.2);
          spotLight.castShadow = true;
          eng.scene.add(spotLight);
          eng.scene.add(spotLight.target);
        }

        eng.tokenRecords.set(tokenData.id, {
          mesh,
          body,
          spotLight,
          targetRotation: tokenData.rotation || 0,
        });
      }
    });
  }, [tokens]);

  // Sync Inspectable 3D Handouts / Clues
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    handouts.forEach((clue) => {
      if (!eng.clueMeshes.has(clue.id)) {
        const mesh = createHandoutMesh3D(clue);
        eng.scene.add(mesh);
        eng.clueMeshes.set(clue.id, mesh);
      }
    });
  }, [handouts]);

  // Sync External Door Angle Slider / Buttons
  useEffect(() => {
    if (manualDoorTargetRad !== null && engineRef.current) {
      engineRef.current.setDoorTargetAngle(manualDoorTargetRad);
      soundEngine.playSFX('door_creak');
      setManualDoorTargetRad(null);
    }
  }, [manualDoorTargetRad, setManualDoorTargetRad]);

  // Sync Manual Room 2 Fog Reveal
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.clearManualFog(manualRoom2Revealed);
    }
  }, [manualRoom2Revealed]);

  // Spawn 3D Physical Polyhedral Dice when `rollRequest` triggers
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !rollRequest) return;

    soundEngine.playSFX('dice_roll');

    // Clear previous dice from table
    eng.diceRecords.forEach((d) => {
      eng.scene.remove(d.mesh);
      eng.world.removeBody(d.body);
    });
    eng.diceRecords.length = 0;

    const { diceList = [] } = rollRequest;
    diceList.forEach((dieSpec, idx) => {
      const mesh = createDieMesh3D(dieSpec.sides || 20, dieSpec.color || '#dc2626');
      eng.scene.add(mesh);

      const body = new CANNON.Body({
        mass: 1.2,
        shape: new CANNON.Sphere(0.32),
        linearDamping: 0.15,
        angularDamping: 0.15,
      });

      // Spawn above the investigation room table and throw toward center
      const startX = -5.2 + (idx % 3) * 0.65;
      const startZ = 0.8 + Math.floor(idx / 3) * 0.65;
      body.position.set(startX, 3.2 + idx * 0.35, startZ);
      body.velocity.set(
        2.2 + Math.random() * 1.8,
        -1.5,
        -1.2 + (Math.random() - 0.5) * 2.2
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );

      eng.world.addBody(body);
      eng.diceRecords.push({ mesh, body });
    });
  }, [rollRequest]);

  // Spawn 3D Paranormal Ritual Particle Effect (`Sangue`, `Morte`, `Conhecimento`, `Energia`, `Medo`)
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng || !activeRitualEffect) return;

    soundEngine.playSFX('ritual');

    const colorMap = {
      Sangue: '#dc2626',
      Morte: '#52525b',
      Conhecimento: '#eab308',
      Energia: '#06b6d4',
      Medo: '#f4f4f5',
    };
    const hexColor = colorMap[activeRitualEffect.element] || '#dc2626';

    // Spawn at selected token or center of Room 1
    const selToken = tokens.find((t) => t.id === selectedTokenId) || tokens[0];
    const originX = selToken ? selToken.x : -2.5;
    const originZ = selToken ? selToken.z : 0;

    const group = new THREE.Group();
    group.position.set(originX, 0.05, originZ);

    const sigilTex = createOccultSigilTexture(hexColor);
    const ringMat = new THREE.MeshBasicMaterial({
      map: sigilTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    group.add(ringMesh);

    const count = 90;
    const positions = new Float32Array(count * 3);
    const angles = [];
    const radii = [];
    const speeds = [];
    const upSpeeds = [];

    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 0.25 + Math.random() * 1.35;
      angles.push(ang);
      radii.push(rad);
      speeds.push((Math.random() * 2 + 1.5) * (i % 2 === 0 ? 1 : -1));
      upSpeeds.push(0.5 + Math.random() * 1.1);
      positions[i * 3] = Math.cos(ang) * rad;
      positions[i * 3 + 1] = Math.random() * 0.4;
      positions[i * 3 + 2] = Math.sin(ang) * rad;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: hexColor,
      size: 0.14,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(pGeo, pMat);
    group.add(points);

    const light = new THREE.PointLight(hexColor, 4.5, 8.0);
    light.position.set(0, 1.2, 0);
    group.add(light);

    eng.scene.add(group);
    eng.particleSystems.push({
      group,
      ringMesh,
      ringMat,
      points,
      light,
      count,
      angles,
      radii,
      speeds,
      upSpeeds,
      age: 0,
      maxAge: 4.0,
    });
  }, [activeRitualEffect]);

  // Spawn Workshop 3D Props (Desks, Bookshelves, Occult Sigils, Blood Stains, Candles)
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;

    while (eng.customPropMeshes.length < spawnedProps.length) {
      const prop = spawnedProps[eng.customPropMeshes.length];
      const g = new THREE.Group();
      g.position.set(prop.x, 0, prop.z);

      if (prop.propKind === 'sigil') {
        const tex = createOccultSigilTexture(prop.color || '#dc2626');
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 2.6),
          new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.03;
        g.add(m);
      } else if (prop.propKind === 'blood') {
        const m = new THREE.Mesh(
          new THREE.CircleGeometry(0.85, 18),
          new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.25 })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.02;
        g.add(m);
      } else if (prop.propKind === 'candles') {
        for (let c = 0; c < 3; c++) {
          const candle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.06, 0.28, 10),
            new THREE.MeshStandardMaterial({ color: '#fef3c7' })
          );
          candle.position.set((c - 1) * 0.16, 0.14, (c % 2) * 0.1);
          g.add(candle);
        }
        const ptLight = new THREE.PointLight('#f59e0b', 1.8, 5.5);
        ptLight.position.set(0, 0.45, 0);
        g.add(ptLight);
      } else if (prop.propKind === 'bookshelf') {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 1.9, 1.6),
          new THREE.MeshStandardMaterial({ color: '#3b1f0e', roughness: 0.7 })
        );
        m.position.y = 0.95;
        m.castShadow = true;
        g.add(m);
      } else {
        // Desk
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.82, 1.0),
          new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.65 })
        );
        m.position.y = 0.41;
        m.castShadow = true;
        g.add(m);
      }

      eng.scene.add(g);
      eng.customPropMeshes.push(g);
    }
  }, [spawnedProps]);

  // Camera Quick Presets
  const setCameraPreset = (preset) => {
    const eng = engineRef.current;
    if (!eng) return;
    if (preset === 'isometric') {
      eng.camSpherical.target.set(-0.5, 0, 0.2);
      eng.camSpherical.radius = 15.5;
      eng.camSpherical.theta = -0.22;
      eng.camSpherical.phi = 0.68;
    } else if (preset === 'topdown') {
      eng.camSpherical.target.set(0, 0, 0);
      eng.camSpherical.radius = 16.5;
      eng.camSpherical.theta = 0;
      eng.camSpherical.phi = 0.19;
    } else if (preset === 'door_closeup') {
      eng.camSpherical.target.set(-0.2, 0.8, -0.1);
      eng.camSpherical.radius = 7.2;
      eng.camSpherical.theta = -0.58;
      eng.camSpherical.phi = 0.85;
    } else if (preset === 'focus_token') {
      const tok = tokens.find((t) => t.id === selectedTokenId) || tokens[0];
      if (tok) {
        eng.camSpherical.target.set(tok.x, 0.4, tok.z);
        eng.camSpherical.radius = 9.0;
        eng.camSpherical.phi = 0.72;
      }
    }
    eng.updateCameraFromSpherical();
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Three.js WebGL Viewport */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Projected 3D Floating Token Bars (PV, SAN, Conditions) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {tokenLabels.map((lbl) => {
          const hpPct = Math.max(0, Math.min(100, (lbl.hp / (lbl.maxHp || 1)) * 100));
          const sanPct =
            lbl.maxSan > 0
              ? Math.max(0, Math.min(100, (lbl.san / lbl.maxSan) * 100))
              : 0;
          const isHurt = lbl.hp > 0 && lbl.hp <= lbl.maxHp / 2;
          const isDying = lbl.hp <= 0;

          return (
            <div
              key={lbl.id}
              style={{
                transform: `translate3d(${lbl.x}px, ${lbl.y}px, 0) translate(-50%, -100%)`,
              }}
              className="absolute top-0 left-0 flex flex-col items-center transition-transform duration-75"
            >
              {/* Conditions Badges */}
              {lbl.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1 justify-center">
                  {lbl.conditions.map((c) => (
                    <span
                      key={c}
                      className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-red-950/90 text-red-200 border border-red-500/50 shadow"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Token Name & Mini Bars */}
              <div
                className={`px-2.5 py-1 rounded-md backdrop-blur-md border shadow-lg ${
                  lbl.isSelected
                    ? 'bg-zinc-900/95 border-amber-400/80'
                    : 'bg-zinc-950/85 border-zinc-700/70'
                }`}
              >
                <div className="flex items-center gap-1.5 justify-between text-[11px] font-semibold text-zinc-100 whitespace-nowrap">
                  <span>{lbl.name}</span>
                  {isDying && (
                    <span className="text-[9px] px-1 rounded bg-red-600 text-white animate-pulse">
                      MORRENDO
                    </span>
                  )}
                  {!isDying && isHurt && (
                    <span className="text-[9px] px-1 rounded bg-amber-600/90 text-white">
                      MACHUCADO
                    </span>
                  )}
                </div>

                {/* PV Bar */}
                <div className="w-28 h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-red-600 transition-all duration-300"
                    style={{ width: `${hpPct}%` }}
                  />
                </div>

                {/* SAN Bar (Players only) */}
                {lbl.maxSan > 0 && (
                  <div className="w-28 h-1 bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="h-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${sanPct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Projected 3D Tactical Ruler Readout (1.5m = 1 square) */}
        {rulerInfo && (
          <div
            style={{
              transform: `translate3d(${rulerInfo.x}px, ${rulerInfo.y}px, 0) translate(-50%, -120%)`,
            }}
            className="absolute top-0 left-0 px-3 py-1.5 rounded-lg bg-zinc-950/95 border border-amber-400/80 text-zinc-100 shadow-2xl"
          >
            <div className="text-xs font-mono font-bold text-amber-300">
              📏 {rulerInfo.meters} m ({rulerInfo.squares} quadrados)
            </div>
            <div className="text-[10px] text-zinc-300">{rulerInfo.status}</div>
          </div>
        )}
      </div>

      {/* Hover Contextual Prompt (Door / Clues) */}
      {hoveredInfo && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-2xl text-center max-w-md">
          <div className="text-xs font-bold text-amber-300">{hoveredInfo.title}</div>
          <div className="text-[11px] text-zinc-300 mt-0.5">{hoveredInfo.hint}</div>
        </div>
      )}

      {/* Bottom Floating Camera & Door Physics Controls Bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-950/90 backdrop-blur-md border border-zinc-800 shadow-2xl">
        <button
          onClick={() => setCameraPreset('isometric')}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 transition"
          title="Visão Orbital Padrão"
        >
          🎥 Câmera Orbital
        </button>
        <button
          onClick={() => setCameraPreset('topdown')}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 transition"
          title="Visão Tática 90°"
        >
          🗺️ Tática 90°
        </button>
        <button
          onClick={() => setCameraPreset('door_closeup')}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 transition"
          title="Focar na Porta Física"
        >
          🚪 Focar na Porta ({doorAngleDeg}°)
        </button>
        <button
          onClick={() => setCameraPreset('focus_token')}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 transition"
        >
          🎯 Focar Agente
        </button>

        <div className="h-4 w-px bg-zinc-800 mx-1" />

        {/* Quick Physical Door Interaction Controls */}
        <button
          onClick={() => {
            if (doorLocked && role !== 'gm') {
              soundEngine.playSFX('door_locked');
              onNotification('🔒 Porta Trancada! O Mestre precisa destrancá-la primeiro.');
              return;
            }
            setManualDoorTargetRad(0.45); // ~26 deg peek crack
          }}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-600/50 transition"
          title="Entreabrir uma fresta para iluminar com a lanterna"
        >
          🔦 Espiar Fresta (25°)
        </button>
        <button
          onClick={() => {
            if (doorLocked && role !== 'gm') {
              soundEngine.playSFX('door_locked');
              onNotification('🔒 Porta Trancada! O Mestre precisa destrancá-la primeiro.');
              return;
            }
            setManualDoorTargetRad(doorAngleDeg > 35 ? 0 : 1.45);
          }}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 transition"
        >
          {Math.abs(doorAngleDeg) > 35 ? '🚪 Fechar Porta' : '🚪 Escancarar (85°)'}
        </button>

        {role === 'gm' && (
          <button
            onClick={() => {
              const next = !doorLocked;
              setDoorLocked(next);
              soundEngine.playSFX('door_locked');
            }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
              doorLocked
                ? 'bg-red-950/80 border-red-500/60 text-red-200'
                : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
            }`}
          >
            {doorLocked ? '🔒 Trancada (GM)' : '🔓 Destrancada (GM)'}
          </button>
        )}
      </div>
    </div>
  );
}
