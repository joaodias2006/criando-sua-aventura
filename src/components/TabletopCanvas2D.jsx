import React, { useEffect, useRef, useState } from 'react';
import {
  MAP_BOUNDS,
  buildActiveObstacleSegments,
  computeVisibilityPolygon,
  isPointVisibleToViewers,
} from '../utils/fogOfWarEngine';
import { soundEngine } from '../utils/soundEngine';
import {
  Upload,
  UserPlus,
  BrickWall,
  DoorOpen,
  Eraser,
  Hand,
  Sun,
  Flashlight,
  Grid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Lock,
  Unlock,
} from 'lucide-react';

export default function TabletopCanvas2D({
  role, // 'gm' | 'arthur' | 'joui' | 'dante'
  currentMap,
  onUpdateMap,
  onOpenMapModal,
  onOpenTokenModal,
  tokens,
  setTokens,
  selectedTokenId,
  setSelectedTokenId,
  handouts,
  setHandouts,
  onInspectHandout,
  fogMode, // 'dynamic' | 'reveal_all' | 'brush_reveal' | 'brush_hide'
  setFogMode,
  manualRoom2Revealed,
  rollRequest,
  activeRitualEffect,
  spawnedProps,
  setSpawnedProps,
  showTeamCursors,
  rulerForcedOn,
  onNotification,
}) {
  const canvasRef = useRef(null);

  // Master Map Builder Tool: 'interact' | 'draw_wall' | 'add_door' | 'erase'
  const [gmTool, setGmTool] = useState('interact');
  const [hoveredInfo, setHoveredInfo] = useState(null);

  // Image cache for custom uploaded maps and token portraits
  const imageCacheRef = useRef(new Map());
  // Offscreen static floor cache so procedural maps render at 60fps with zero CPU overhead
  const floorCacheRef = useRef({ theme: null, bgUrl: null, canvas: null });
  // Offscreen Fog of War canvas (512x307) & Manual GM Paint Mask
  const fogCanvasRef = useRef(null);
  const manualMaskCanvasRef = useRef(null);

  // Camera Pan & Zoom state (world coordinates center + pixels per meter scale)
  const cameraRef = useRef({
    centerX: 0,
    centerZ: 0,
    zoom: 1.0, // multiplier over auto-fit scale
  });

  // Live animation state for dice, particles, dragged objects, and wall/door drawing
  const animRef = useRef({
    mouseWorld: { x: -2, z: 0 },
    mouseScreen: { x: 400, y: 300 },
    isGrabbing: false,
    interactionType: null, // 'drag_token' | 'drag_door' | 'drag_clue' | 'drag_prop' | 'pan_camera' | 'draw_wall' | 'add_door' | 'paint_fog'
    activeId: null,
    dragStartWorld: { x: 0, z: 0 },
    drawStartWorld: null,
    panStartScreen: { x: 0, y: 0 },
    panStartCenter: { x: 0, z: 0 },
    isMeasureKeyHold: false,
    hoveredClueId: null,
    diceVisuals: [],
    ritualBursts: [],
  });

  // Keep latest props accessible in 60fps RAF loop
  const stateRef = useRef({
    role,
    currentMap,
    tokens,
    selectedTokenId,
    handouts,
    fogMode,
    manualRoom2Revealed,
    spawnedProps,
    showTeamCursors,
    rulerForcedOn,
    gmTool,
  });

  useEffect(() => {
    stateRef.current = {
      role,
      currentMap,
      tokens,
      selectedTokenId,
      handouts,
      fogMode,
      manualRoom2Revealed,
      spawnedProps,
      showTeamCursors,
      rulerForcedOn,
      gmTool,
    };
  }, [
    role,
    currentMap,
    tokens,
    selectedTokenId,
    handouts,
    fogMode,
    manualRoom2Revealed,
    spawnedProps,
    showTeamCursors,
    rulerForcedOn,
    gmTool,
  ]);

  // Helper: Load and cache HTMLImageElement from URL / Data URI
  const getCachedImage = (url) => {
    if (!url) return null;
    const cache = imageCacheRef.current;
    if (cache.has(url)) {
      const entry = cache.get(url);
      return entry.loaded ? entry.img : null;
    }
    const img = new Image();
    const entry = { img, loaded: false };
    cache.set(url, entry);
    img.onload = () => {
      entry.loaded = true;
      // Invalidate floor cache if this was a custom map background
      if (stateRef.current.currentMap?.bgImageUrl === url) {
        floorCacheRef.current.theme = null;
      }
    };
    img.src = url;
    return null;
  };

  // Keyboard shortcuts: Spacebar (Inspect hovered clue), Tab/Alt (Ruler)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Tab' || e.key === 'Alt') {
        if (e.key === 'Tab') e.preventDefault();
        animRef.current.isMeasureKeyHold = true;
      }
      if (e.code === 'Space' && animRef.current.hoveredClueId) {
        e.preventDefault();
        const clue = stateRef.current.handouts.find(
          (h) => h.id === animRef.current.hoveredClueId
        );
        if (clue) onInspectHandout(clue);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'Tab' || e.key === 'Alt') {
        animRef.current.isMeasureKeyHold = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onInspectHandout]);

  // Spawn lightweight 2D animated dice on table when rollRequest triggers
  useEffect(() => {
    if (!rollRequest) return;
    soundEngine.playSFX('dice_roll');
    const { diceList = [] } = rollRequest;
    animRef.current.diceVisuals = diceList.map((d, i) => ({
      sides: d.sides || 20,
      color: d.color || '#dc2626',
      x: -4.8 + (i % 4) * 0.85,
      z: 0.4 + Math.floor(i / 4) * 0.85,
      vx: 2.8 + Math.random() * 2.2,
      vz: -1.4 + (Math.random() - 0.5) * 2.5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 14,
      age: 0,
    }));
  }, [rollRequest]);

  // Spawn lightweight 2D ritual aura burst when activeRitualEffect triggers
  useEffect(() => {
    if (!activeRitualEffect) return;
    soundEngine.playSFX('ritual');
    const colorMap = {
      Sangue: '#dc2626',
      Morte: '#71717a',
      Conhecimento: '#eab308',
      Energia: '#06b6d4',
      Medo: '#f4f4f5',
    };
    const tok =
      tokens.find((t) => t.id === selectedTokenId) ||
      tokens[0] || { x: -2.5, z: 0 };
    animRef.current.ritualBursts.push({
      x: tok.x,
      z: tok.z,
      color: colorMap[activeRitualEffect.element] || '#dc2626',
      element: activeRitualEffect.element,
      age: 0,
      maxAge: 3.2,
    });
  }, [activeRitualEffect]);

  // Clear manual fog mask when switching maps or toggling manualRoom2Revealed
  useEffect(() => {
    if (!manualMaskCanvasRef.current) return;
    const ctx = manualMaskCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 512, 307);
    if (manualRoom2Revealed) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(256, 0, 256, 307);
    }
  }, [manualRoom2Revealed, currentMap?.id]);

  // Build Offscreen Procedural Map Artwork ("O Segredo na Floresta" themes)
  const buildStaticMapArtwork = (mapConfig) => {
    const off = document.createElement('canvas');
    off.width = 1200;
    off.height = 720; // 15m x 9m aspect ratio (80px per meter)
    const ctx = off.getContext('2d');
    const theme = mapConfig.theme || 'wood_mansion';

    const wToPxX = (wx) => ((wx - MAP_BOUNDS.minX) / MAP_BOUNDS.width) * off.width;
    const wToPxY = (wz) => ((wz - MAP_BOUNDS.minZ) / MAP_BOUNDS.height) * off.height;

    // If user uploaded a custom background image and it's loaded, draw it!
    if (mapConfig.bgImageUrl) {
      const customImg = getCachedImage(mapConfig.bgImageUrl);
      if (customImg) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, off.width, off.height);
        ctx.drawImage(customImg, 0, 0, off.width, off.height);
        return off;
      }
    }

    if (theme === 'floresta') {
      // Floresta de Névoa & Santo Berço
      ctx.fillStyle = '#111c14';
      ctx.fillRect(0, 0, off.width, off.height);

      // Muddy forest path & lodo trail
      ctx.fillStyle = '#1e1914';
      ctx.beginPath();
      ctx.ellipse(600, 360, 540, 140, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Cabin Wooden Floor on the East side (x: 1.5 to 6.2, z: -3.2 to 3.2)
      const cx1 = wToPxX(1.5);
      const cy1 = wToPxY(-3.2);
      const cw = wToPxX(6.2) - cx1;
      const ch = wToPxY(3.2) - cy1;
      ctx.fillStyle = '#291b12';
      ctx.fillRect(cx1, cy1, cw, ch);

      // Spiral Stone of Santo Berço inside Cabin
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 4;
      const sx = wToPxX(4.0);
      const sy = wToPxY(0);
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 7; a += 0.15) {
        const r = a * 4.5;
        const px = sx + Math.cos(a) * r;
        const py = sy + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Pine Trees around perimeter
      const treeCoords = [
        [-6.2, -3.4],
        [-4.5, -3.6],
        [-1.8, -3.5],
        [-6.4, 3.2],
        [-3.8, 3.5],
        [-1.2, 3.3],
        [6.6, -3.5],
        [6.6, 3.4],
      ];
      treeCoords.forEach(([tx, tz]) => {
        const px = wToPxX(tx);
        const py = wToPxY(tz);
        ctx.fillStyle = 'rgba(13, 38, 21, 0.92)';
        ctx.beginPath();
        ctx.arc(px, py, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else if (theme === 'sanatorio') {
      // Sanatório Abandonado de Carpazinha
      ctx.fillStyle = '#182226';
      ctx.fillRect(0, 0, off.width, off.height);

      // Cracked hospital tiles
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < off.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, off.height);
        ctx.stroke();
      }
      for (let y = 0; y < off.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(off.width, y);
        ctx.stroke();
      }

      // Rusty hospital beds & blood trails
      ctx.fillStyle = '#334155';
      ctx.fillRect(wToPxX(-6.2), wToPxY(-3.6), 140, 75);
      ctx.fillRect(wToPxX(-6.2), wToPxY(2.2), 140, 75);
      ctx.fillStyle = 'rgba(153, 27, 27, 0.55)';
      ctx.beginPath();
      ctx.arc(wToPxX(2.5), wToPxY(0.5), 95, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'suvaco_seco') {
      // Bar Suvaco Seco (Gaudérios Abutres)
      ctx.fillStyle = '#26170e';
      ctx.fillRect(0, 0, off.width, off.height);

      // Wood planks
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < off.height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(off.width, y);
        ctx.stroke();
      }

      // Long Bar Counter
      ctx.fillStyle = '#451a03';
      ctx.fillRect(wToPxX(-6.5), wToPxY(-3.8), 420, 75);
      // Pool Table (Mesa de Sinuca verde)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(wToPxX(-3.2), wToPxY(0.8), 190, 110);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(wToPxX(-3.2) + 12, wToPxY(0.8) + 12, 166, 86);
    } else {
      // Default: Mansão & Escritório de Investigação em Carpazinha
      ctx.fillStyle = '#23160f';
      ctx.fillRect(0, 0, off.width, off.height);

      // Detailed wood planks
      for (let r = 0; r < 24; r++) {
        const y = r * 30;
        ctx.fillStyle = r % 2 === 0 ? '#271811' : '#21140d';
        ctx.fillRect(0, y, off.width, 29);
      }

      // Worn crimson rug in Room 1
      ctx.fillStyle = '#4c1d24';
      ctx.fillRect(wToPxX(-5.8), wToPxY(-1.2), 310, 220);
      ctx.strokeStyle = '#9f1239';
      ctx.lineWidth = 3;
      ctx.strokeRect(wToPxX(-5.8) + 8, wToPxY(-1.2) + 8, 294, 204);

      // Investigation Desk in Room 1 (West)
      ctx.fillStyle = '#3b1f0e';
      ctx.fillRect(wToPxX(-4.1), wToPxY(-3.2), 135, 185);
      // South Side Table
      ctx.fillRect(wToPxX(-2.4), wToPxY(1.7), 96, 96);
      // West Bookshelf
      ctx.fillStyle = '#291509';
      ctx.fillRect(wToPxX(-7.4), wToPxY(-2.8), 45, 250);

      // Room 2 (East): Glowing Occult Transcendence & Spiral Circle on Floor
      const cx = wToPxX(3.8);
      const cy = wToPxY(0.2);
      ctx.save();
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.78)';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.5;
      [155, 135, 88].forEach((rad) => {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Hexagram
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
          const a = (i * 2 * Math.PI) / 3 + (k * Math.PI) / 3 - Math.PI / 2;
          const px = cx + Math.cos(a) * 134;
          const py = cy + Math.sin(a) * 134;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Stone Altar in Room 2
      ctx.fillStyle = '#27272a';
      ctx.fillRect(wToPxX(3.9), wToPxY(-3.2), 105, 165);
    }

    return off;
  };

  // Main 60FPS 2D Tactical Tabletop Render & Interaction Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (!fogCanvasRef.current) {
      const fc = document.createElement('canvas');
      fc.width = 512;
      fc.height = 307;
      fogCanvasRef.current = fc;
    }
    if (!manualMaskCanvasRef.current) {
      const mc = document.createElement('canvas');
      mc.width = 512;
      mc.height = 307;
      manualMaskCanvasRef.current = mc;
    }

    // Coordinate conversion helpers between Screen Pixels and World Meters (-7.5..7.5, -4.5..4.5)
    const getTransformMetrics = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      const baseScale = Math.min((cw - 48) / MAP_BOUNDS.width, (ch - 48) / MAP_BOUNDS.height);
      const scale = baseScale * cameraRef.current.zoom;
      const originX = cw / 2 - cameraRef.current.centerX * scale;
      const originY = ch / 2 - cameraRef.current.centerZ * scale;
      return { cw, ch, scale, originX, originY };
    };

    const worldToScreen = (wx, wz) => {
      const { scale, originX, originY } = getTransformMetrics();
      return {
        x: originX + wx * scale,
        y: originY + wz * scale,
        scale,
      };
    };

    const screenToWorld = (sx, sy) => {
      const { scale, originX, originY } = getTransformMetrics();
      return {
        x: (sx - originX) / scale,
        z: (sy - originY) / scale,
      };
    };

    const worldToFogPx = (wx, wz) => ({
      x: ((wx - MAP_BOUNDS.minX) / MAP_BOUNDS.width) * 512,
      y: ((wz - MAP_BOUNDS.minZ) / MAP_BOUNDS.height) * 307,
    });

    const paintManualFog = (wx, wz, reveal = true) => {
      const mCtx = manualMaskCanvasRef.current.getContext('2d');
      const pt = worldToFogPx(wx, wz);
      mCtx.save();
      mCtx.beginPath();
      mCtx.arc(pt.x, pt.y, 34, 0, Math.PI * 2);
      mCtx.globalCompositeOperation = reveal ? 'source-over' : 'destination-out';
      mCtx.fillStyle = '#ffffff';
      mCtx.fill();
      mCtx.restore();
    };

    // Distance from point (px, pz) to segment (x1, z1)-(x2, z2)
    const distToSegment = (px, pz, x1, z1, x2, z2) => {
      const A = px - x1;
      const B = pz - z1;
      const C = x2 - x1;
      const D = z2 - z1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      let xx, zz;
      if (param < 0) {
        xx = x1;
        zz = z1;
      } else if (param > 1) {
        xx = x2;
        zz = z2;
      } else {
        xx = x1 + param * C;
        zz = z1 + param * D;
      }
      return Math.hypot(px - xx, pz - zz);
    };

    // Pointer Events
    const getPointerWorld = (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      animRef.current.mouseScreen = { x: sx, y: sy };
      const w = screenToWorld(sx, sy);
      animRef.current.mouseWorld = w;
      return { sx, sy, wx: w.x, wz: w.z };
    };

    const onPointerDown = (e) => {
      soundEngine.init();
      const { sx, sy, wx, wz } = getPointerWorld(e);
      const st = stateRef.current;
      const map = st.currentMap;

      // Middle click, Right click (when not on a door), or Shift+Click -> Pan Camera
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        animRef.current.interactionType = 'pan_camera';
        animRef.current.panStartScreen = { x: sx, y: sy };
        animRef.current.panStartCenter = { ...cameraRef.current };
        return;
      }

      // Right-click on a Door -> Toggle Lock (GM only) or Pan Camera
      if (e.button === 2) {
        const hitDoor = (map.doors || []).find((d) => {
          const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
          const endX = d.hingeX + Math.sin(totalAngle) * (d.length || 2);
          const endZ = d.hingeZ + Math.cos(totalAngle) * (d.length || 2);
          return distToSegment(wx, wz, d.hingeX, d.hingeZ, endX, endZ) < 0.45;
        });

        if (hitDoor) {
          if (st.role === 'gm') {
            const updatedDoors = map.doors.map((d) =>
              d.id === hitDoor.id ? { ...d, locked: !d.locked } : d
            );
            onUpdateMap({ ...map, doors: updatedDoors });
            soundEngine.playSFX('door_locked');
            onNotification(
              !hitDoor.locked
                ? '🔒 Porta Trancada pelo Mestre!'
                : '🔓 Porta Destrancada pelo Mestre!'
            );
          } else {
            onNotification('⚠️ Apenas o Mestre pode trancar/destrancar portas com o botão direito.');
          }
          return;
        }

        animRef.current.interactionType = 'pan_camera';
        animRef.current.panStartScreen = { x: sx, y: sy };
        animRef.current.panStartCenter = { ...cameraRef.current };
        return;
      }

      if (e.button !== 0) return;
      animRef.current.isGrabbing = true;

      // GM Fog Brush Mode
      if (
        st.role === 'gm' &&
        (st.fogMode === 'brush_reveal' || st.fogMode === 'brush_hide')
      ) {
        animRef.current.interactionType = 'paint_fog';
        paintManualFog(wx, wz, st.fogMode === 'brush_reveal');
        return;
      }

      // GM Map Builder Tools: Draw Wall | Add Door | Erase
      if (st.role === 'gm' && st.gmTool === 'draw_wall') {
        animRef.current.interactionType = 'draw_wall';
        animRef.current.drawStartWorld = { x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)) };
        return;
      }

      if (st.role === 'gm' && st.gmTool === 'add_door') {
        animRef.current.interactionType = 'add_door';
        animRef.current.drawStartWorld = { x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)) };
        return;
      }

      if (st.role === 'gm' && st.gmTool === 'erase') {
        // Check if clicking near a door to delete it
        const doorToDelete = (map.doors || []).find((d) => {
          const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
          const endX = d.hingeX + Math.sin(totalAngle) * (d.length || 2);
          const endZ = d.hingeZ + Math.cos(totalAngle) * (d.length || 2);
          return distToSegment(wx, wz, d.hingeX, d.hingeZ, endX, endZ) < 0.45;
        });
        if (doorToDelete) {
          onUpdateMap({
            ...map,
            doors: map.doors.filter((d) => d.id !== doorToDelete.id),
          });
          onNotification('🗑️ Porta removida do mapa!');
          return;
        }

        // Check if clicking near a wall segment to delete it
        const wallToDelete = (map.walls || []).find(
          (w) => distToSegment(wx, wz, w.x1, w.z1, w.x2, w.z2) < 0.4
        );
        if (wallToDelete) {
          onUpdateMap({
            ...map,
            walls: map.walls.filter((w) => w.id !== wallToDelete.id),
          });
          onNotification('🗑️ Parede removida do mapa!');
          return;
        }

        // Check if clicking a spawned prop
        const propToDelete = (st.spawnedProps || []).find(
          (p) => Math.hypot(wx - p.x, wz - p.z) < 0.85
        );
        if (propToDelete) {
          setSpawnedProps((prev) => prev.filter((p) => p.id !== propToDelete.id));
          onNotification('🗑️ Objeto removido do cenário!');
          return;
        }
        return;
      }

      // 1. Check if clicking a Token
      const clickedToken = [...st.tokens]
        .reverse()
        .find((t) => Math.hypot(wx - t.x, wz - t.z) < 0.65 * (t.sizeSquares || 1));

      if (clickedToken) {
        setSelectedTokenId(clickedToken.id);
        if (st.role !== 'gm' && clickedToken.owner !== st.role) {
          onNotification(
            `🚫 No modo Jogador (${st.role.toUpperCase()}), você só pode mover seu próprio personagem!`
          );
          return;
        }
        animRef.current.interactionType = 'drag_token';
        animRef.current.activeId = clickedToken.id;
        animRef.current.dragStartWorld = { x: clickedToken.x, z: clickedToken.z };
        return;
      }

      // 2. Check if clicking an Interactive Door (drag handle / door leaf)
      const clickedDoor = (map.doors || []).find((d) => {
        const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
        const endX = d.hingeX + Math.sin(totalAngle) * (d.length || 2);
        const endZ = d.hingeZ + Math.cos(totalAngle) * (d.length || 2);
        return distToSegment(wx, wz, d.hingeX, d.hingeZ, endX, endZ) < 0.45;
      });

      if (clickedDoor) {
        if (clickedDoor.locked && st.role !== 'gm') {
          soundEngine.playSFX('door_locked');
          onNotification('🔒 Esta porta está TRANCADA! Peça ao Mestre para destrancar.');
          return;
        }
        soundEngine.playSFX('door_creak');
        animRef.current.interactionType = 'drag_door';
        animRef.current.activeId = clickedDoor.id;
        return;
      }

      // 3. Check if clicking an Inspectable Handout / Clue
      const clickedClue = st.handouts.find((h) => Math.hypot(wx - h.x, wz - h.z) < 0.55);
      if (clickedClue) {
        // In GM mode, dragging moves the clue; clicking without dragging opens it
        animRef.current.interactionType = 'drag_clue';
        animRef.current.activeId = clickedClue.id;
        animRef.current.dragStartWorld = { x: wx, z: wz };
        return;
      }

      // 4. Check if clicking a Spawned Prop in GM mode
      if (st.role === 'gm') {
        const clickedProp = (st.spawnedProps || []).find(
          (p) => Math.hypot(wx - p.x, wz - p.z) < 0.85
        );
        if (clickedProp) {
          animRef.current.interactionType = 'drag_prop';
          animRef.current.activeId = clickedProp.id;
          return;
        }
      }

      // Otherwise: Pan Camera smoothly
      animRef.current.interactionType = 'pan_camera';
      animRef.current.panStartScreen = { x: sx, y: sy };
      animRef.current.panStartCenter = { ...cameraRef.current };
    };

    const onPointerMove = (e) => {
      const { sx, sy, wx, wz } = getPointerWorld(e);
      const st = stateRef.current;
      const map = st.currentMap;
      const mode = animRef.current.interactionType;

      if (mode === 'paint_fog') {
        paintManualFog(wx, wz, st.fogMode === 'brush_reveal');
        return;
      }

      if (mode === 'pan_camera') {
        const { scale } = getTransformMetrics();
        const dx = sx - animRef.current.panStartScreen.x;
        const dy = sy - animRef.current.panStartScreen.y;
        cameraRef.current.centerX = animRef.current.panStartCenter.centerX - dx / scale;
        cameraRef.current.centerZ = animRef.current.panStartCenter.centerZ - dy / scale;
        return;
      }

      if (mode === 'drag_token' && animRef.current.activeId) {
        const tokId = animRef.current.activeId;
        const clampedX = Math.max(-7.1, Math.min(7.1, wx));
        const clampedZ = Math.max(-4.1, Math.min(4.1, wz));

        setTokens((prev) =>
          prev.map((t) => {
            if (t.id !== tokId) return t;
            const dx = clampedX - t.x;
            const dz = clampedZ - t.z;
            const rot = Math.hypot(dx, dz) > 0.05 ? Math.atan2(dz, dx) : t.rotation;
            return {
              ...t,
              x: Number(clampedX.toFixed(2)),
              z: Number(clampedZ.toFixed(2)),
              rotation: rot,
            };
          })
        );
        return;
      }

      if (mode === 'drag_door' && animRef.current.activeId) {
        const doorId = animRef.current.activeId;
        const targetDoor = (map.doors || []).find((d) => d.id === doorId);
        if (!targetDoor) return;

        const desiredWorldAngle = Math.atan2(
          wx - targetDoor.hingeX,
          wz - targetDoor.hingeZ
        );
        let relAngle = desiredWorldAngle - (targetDoor.baseAngle || 0);
        // Normalize to [-PI, PI] and clamp within realistic door swing [-2.1, +2.1]
        relAngle = Math.atan2(Math.sin(relAngle), Math.cos(relAngle));
        relAngle = Math.max(-2.1, Math.min(2.1, relAngle));

        const updatedDoors = map.doors.map((d) =>
          d.id === doorId ? { ...d, angleRad: relAngle } : d
        );
        onUpdateMap({ ...map, doors: updatedDoors });
        return;
      }

      if (mode === 'drag_clue' && animRef.current.activeId && st.role === 'gm') {
        const clueId = animRef.current.activeId;
        setHandouts((prev) =>
          prev.map((h) =>
            h.id === clueId
              ? { ...h, x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)) }
              : h
          )
        );
        return;
      }

      if (mode === 'drag_prop' && animRef.current.activeId && st.role === 'gm') {
        const propId = animRef.current.activeId;
        setSpawnedProps((prev) =>
          prev.map((p) =>
            p.id === propId
              ? { ...p, x: Number(wx.toFixed(2)), z: Number(wz.toFixed(2)) }
              : p
          )
        );
        return;
      }

      // Hover detection for clues & doors when idle
      const hoveredClue = st.handouts.find((h) => Math.hypot(wx - h.x, wz - h.z) < 0.55);
      if (hoveredClue) {
        animRef.current.hoveredClueId = hoveredClue.id;
        setHoveredInfo({
          title: `🔍 Pista: ${hoveredClue.title}`,
          hint: 'Clique ou pressione [ESPAÇO] para inspecionar Frente & Verso',
        });
        return;
      }
      animRef.current.hoveredClueId = null;

      const hoveredDoor = (map.doors || []).find((d) => {
        const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
        const endX = d.hingeX + Math.sin(totalAngle) * (d.length || 2);
        const endZ = d.hingeZ + Math.cos(totalAngle) * (d.length || 2);
        return distToSegment(wx, wz, d.hingeX, d.hingeZ, endX, endZ) < 0.45;
      });
      if (hoveredDoor) {
        setHoveredInfo({
          title: hoveredDoor.locked
            ? '🔒 Porta Trancada'
            : '🚪 Porta Interativa (Arraste com a Mãozinha)',
          hint: 'Segure e arraste para entreabrir fresta ou escancarar • Botão Direito (GM): Trancar/Destrancar',
        });
        return;
      }

      setHoveredInfo(null);
    };

    const onPointerUp = (e) => {
      const { wx, wz } = getPointerWorld(e);
      const st = stateRef.current;
      const map = st.currentMap;
      const mode = animRef.current.interactionType;

      // Finish drawing new Wall in GM Mode
      if (mode === 'draw_wall' && animRef.current.drawStartWorld) {
        const s = animRef.current.drawStartWorld;
        if (Math.hypot(wx - s.x, wz - s.z) > 0.35) {
          const newWall = {
            id: `wall_${Date.now()}`,
            x1: s.x,
            z1: s.z,
            x2: Number(wx.toFixed(2)),
            z2: Number(wz.toFixed(2)),
          };
          onUpdateMap({ ...map, walls: [...(map.walls || []), newWall] });
          onNotification('🧱 Nova parede adicionada ao mapa (bloqueia luz e visão)!');
        }
      }

      // Finish adding new Interactive Door in GM Mode
      if (mode === 'add_door' && animRef.current.drawStartWorld) {
        const s = animRef.current.drawStartWorld;
        const len = Math.max(1.2, Math.min(3.5, Math.hypot(wx - s.x, wz - s.z)));
        const baseAngle = Math.atan2(wx - s.x, wz - s.z);
        const newDoor = {
          id: `door_${Date.now()}`,
          hingeX: s.x,
          hingeZ: s.z,
          length: Number(len.toFixed(2)),
          baseAngle,
          angleRad: 0,
          locked: false,
        };
        onUpdateMap({ ...map, doors: [...(map.doors || []), newDoor] });
        onNotification('🚪 Nova porta interativa colocada no mapa!');
      }

      // If clicked a clue without dragging it far, open the Inspector Modal!
      if (mode === 'drag_clue' && animRef.current.activeId) {
        const distMoved = Math.hypot(
          wx - animRef.current.dragStartWorld.x,
          wz - animRef.current.dragStartWorld.z
        );
        if (distMoved < 0.25) {
          const clue = st.handouts.find((h) => h.id === animRef.current.activeId);
          if (clue) onInspectHandout(clue);
        }
      }

      animRef.current.isGrabbing = false;
      animRef.current.interactionType = null;
      animRef.current.activeId = null;
      animRef.current.drawStartWorld = null;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      cameraRef.current.zoom = Math.max(0.55, Math.min(2.8, cameraRef.current.zoom * factor));
    };

    const onContextMenu = (e) => e.preventDefault();

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // 60FPS Render Loop
    let rafId;
    let lastTime = performance.now();

    const renderFrame = (now) => {
      rafId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = now / 1000;

      // Resize canvas to container if needed
      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }

      const st = stateRef.current;
      const map = st.currentMap;
      const { cw, ch, scale } = getTransformMetrics();

      // 1. Clear Background Table Surface
      ctx.fillStyle = '#09090d';
      ctx.fillRect(0, 0, cw, ch);

      const topLeft = worldToScreen(MAP_BOUNDS.minX, MAP_BOUNDS.minZ);
      const mapPixelW = MAP_BOUNDS.width * scale;
      const mapPixelH = MAP_BOUNDS.height * scale;

      // Table drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 32;
      ctx.fillStyle = '#18120d';
      ctx.fillRect(topLeft.x - 10, topLeft.y - 10, mapPixelW + 20, mapPixelH + 20);
      ctx.restore();

      // 2. Draw Static or Custom Uploaded Map Artwork from Cache
      if (
        floorCacheRef.current.theme !== map.theme ||
        floorCacheRef.current.bgUrl !== map.bgImageUrl ||
        !floorCacheRef.current.canvas
      ) {
        floorCacheRef.current = {
          theme: map.theme,
          bgUrl: map.bgImageUrl,
          canvas: buildStaticMapArtwork(map),
        };
      }
      ctx.drawImage(
        floorCacheRef.current.canvas,
        topLeft.x,
        topLeft.y,
        mapPixelW,
        mapPixelH
      );

      // 3. Draw Tactical 1.5m Square Grid (10x6 squares) if enabled
      if (map.gridEnabled !== false) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${map.gridOpacity ?? 0.16})`;
        ctx.lineWidth = 1;
        for (let x = MAP_BOUNDS.minX; x <= MAP_BOUNDS.maxX + 0.01; x += 1.5) {
          const p1 = worldToScreen(x, MAP_BOUNDS.minZ);
          const p2 = worldToScreen(x, MAP_BOUNDS.maxZ);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        for (let z = MAP_BOUNDS.minZ; z <= MAP_BOUNDS.maxZ + 0.01; z += 1.5) {
          const p1 = worldToScreen(MAP_BOUNDS.minX, z);
          const p2 = worldToScreen(MAP_BOUNDS.maxX, z);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Compute Current Obstacle Segments (Walls + Doors) for Line-of-Sight
      const activeSegments = buildActiveObstacleSegments(map.walls || [], map.doors || []);
      const viewerTokens = st.tokens.filter((t) => t.type === 'player');
      const liveViewers = viewerTokens.map((vt) => ({
        x: vt.x,
        z: vt.z,
        facing: vt.rotation || 0,
        flashlightOn: vt.flashlightOn !== false,
      }));

      // 4. Draw Spawned Workshop Props (Desks, Blood, Spiral Sigils, Candles, Custom Images)
      (st.spawnedProps || []).forEach((prop) => {
        const p = worldToScreen(prop.x, prop.z);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (prop.imageUrl) {
          const img = getCachedImage(prop.imageUrl);
          if (img) {
            const sz = (prop.sizeMeters || 2.0) * scale;
            ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
          }
        } else if (prop.propKind === 'sigil') {
          ctx.rotate(elapsed * 0.4);
          ctx.strokeStyle = prop.color || '#dc2626';
          ctx.shadowColor = prop.color || '#dc2626';
          ctx.shadowBlur = 12;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 1.15 * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 0.75 * scale, 0, Math.PI * 2);
          ctx.stroke();
        } else if (prop.propKind === 'blood') {
          ctx.fillStyle = 'rgba(127, 29, 29, 0.82)';
          ctx.beginPath();
          ctx.arc(0, 0, 0.7 * scale, 0, Math.PI * 2);
          ctx.fill();
        } else if (prop.propKind === 'candles') {
          const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 1.4 * scale);
          grad.addColorStop(0, 'rgba(251, 191, 36, 0.55)');
          grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, 1.4 * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef3c7';
          ctx.beginPath();
          ctx.arc(0, 0, 0.14 * scale, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#451a03';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.fillRect(-0.7 * scale, -0.45 * scale, 1.4 * scale, 0.9 * scale);
          ctx.strokeRect(-0.7 * scale, -0.45 * scale, 1.4 * scale, 0.9 * scale);
        }
        ctx.restore();
      });

      // 5. Draw Paranormal Ritual Particle Bursts
      for (let i = animRef.current.ritualBursts.length - 1; i >= 0; i--) {
        const rb = animRef.current.ritualBursts[i];
        rb.age += dt;
        if (rb.age >= rb.maxAge) {
          animRef.current.ritualBursts.splice(i, 1);
          continue;
        }
        const prog = rb.age / rb.maxAge;
        const p = worldToScreen(rb.x, rb.z);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(rb.age * 2.4);
        ctx.strokeStyle = rb.color;
        ctx.globalAlpha = 1 - prog;
        ctx.lineWidth = 3;
        const rad = (0.8 + prog * 1.8) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6. Draw Walls & Interactive Hinge Doors
      ctx.save();
      ctx.strokeStyle = '#27201c';
      ctx.lineWidth = Math.max(6, 0.22 * scale);
      ctx.lineCap = 'round';
      (map.walls || []).forEach((w) => {
        const p1 = worldToScreen(w.x1, w.z1);
        const p2 = worldToScreen(w.x2, w.z2);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Inner highlight on wall
        ctx.save();
        ctx.strokeStyle = '#524137';
        ctx.lineWidth = Math.max(2, 0.06 * scale);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      });
      ctx.restore();

      // Interactive Doors with Hinge Swing Arc & Brass Handle
      (map.doors || []).forEach((d) => {
        const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
        const len = d.length || 2.0;
        const endX = d.hingeX + Math.sin(totalAngle) * len;
        const endZ = d.hingeZ + Math.cos(totalAngle) * len;

        const pHinge = worldToScreen(d.hingeX, d.hingeZ);
        const pEnd = worldToScreen(endX, endZ);

        // Dotted swing arc preview
        ctx.save();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.22)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pHinge.x, pHinge.y, len * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Wooden Door Leaf
        ctx.save();
        ctx.strokeStyle = d.locked ? '#991b1b' : '#92400e';
        ctx.lineWidth = Math.max(7, 0.18 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pHinge.x, pHinge.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();

        // Hinge Pivot Pin
        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(pHinge.x, pHinge.y, Math.max(4, 0.09 * scale), 0, Math.PI * 2);
        ctx.fill();

        // Brass Doorknob Handle near end
        const knobX = d.hingeX + Math.sin(totalAngle) * (len * 0.82);
        const knobZ = d.hingeZ + Math.cos(totalAngle) * (len * 0.82);
        const pKnob = worldToScreen(knobX, knobZ);
        ctx.fillStyle = d.locked ? '#ef4444' : '#facc15';
        ctx.shadowColor = d.locked ? '#ef4444' : '#facc15';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pKnob.x, pKnob.y, Math.max(5, 0.11 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Preview line when GM is drawing a new wall or door
      if (
        (animRef.current.interactionType === 'draw_wall' ||
          animRef.current.interactionType === 'add_door') &&
        animRef.current.drawStartWorld
      ) {
        const p1 = worldToScreen(
          animRef.current.drawStartWorld.x,
          animRef.current.drawStartWorld.z
        );
        const p2 = worldToScreen(
          animRef.current.mouseWorld.x,
          animRef.current.mouseWorld.z
        );
        ctx.save();
        ctx.strokeStyle =
          animRef.current.interactionType === 'draw_wall' ? '#38bdf8' : '#facc15';
        ctx.lineWidth = 5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
      }

      // 7. Draw Inspectable Handouts / Clues on Tables
      st.handouts.forEach((clue) => {
        const isVisible =
          st.role === 'gm' ||
          st.fogMode === 'reveal_all' ||
          isPointVisibleToViewers(
            clue.x,
            clue.z,
            liveViewers,
            activeSegments,
            st.manualRoom2Revealed
          );
        if (!isVisible) return;

        const p = worldToScreen(clue.x, clue.z);
        const isHovered = animRef.current.hoveredClueId === clue.id;
        const pulse = 1 + Math.sin(elapsed * 5) * 0.12;

        ctx.save();
        ctx.translate(p.x, p.y);
        // Glowing golden aura
        ctx.strokeStyle = isHovered ? '#fef08a' : 'rgba(250, 204, 21, 0.65)';
        ctx.fillStyle = isHovered ? 'rgba(250, 204, 21, 0.28)' : 'rgba(234, 179, 8, 0.14)';
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 0.38 * scale * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Document icon
        ctx.fillStyle = clue.type === 'diary' ? '#991b1b' : '#fef3c7';
        ctx.fillRect(-0.22 * scale, -0.16 * scale, 0.44 * scale, 0.32 * scale);
        ctx.strokeStyle = '#78350f';
        ctx.strokeRect(-0.22 * scale, -0.16 * scale, 0.44 * scale, 0.32 * scale);
        ctx.restore();
      });

      // 8. Draw Image Portrait Tokens ("O Segredo na Floresta" Style)
      st.tokens.forEach((tok) => {
        const isVisible =
          st.role === 'gm' ||
          st.fogMode === 'reveal_all' ||
          tok.type === 'player' ||
          isPointVisibleToViewers(
            tok.x,
            tok.z,
            liveViewers,
            activeSegments,
            st.manualRoom2Revealed
          );
        if (!isVisible) return;

        const p = worldToScreen(tok.x, tok.z);
        const isDragged =
          animRef.current.interactionType === 'drag_token' &&
          animRef.current.activeId === tok.id;
        const isSelected = st.selectedTokenId === tok.id;
        const tokenRadius = 0.56 * (tok.sizeSquares || 1) * scale;

        // Flashlight beam cone for player tokens
        if (tok.type === 'player' && tok.flashlightOn !== false) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(tok.rotation || 0);
          const coneGrad = ctx.createRadialGradient(0, 0, tokenRadius * 0.5, 0, 0, 4.2 * scale);
          coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.26)');
          coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = coneGrad;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 4.2 * scale, -0.52, 0.52);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        // Elevation shadow when dragged (2.5D Tabletop effect)
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = isDragged ? 22 : 10;
        ctx.shadowOffsetY = isDragged ? 12 : 4;

        const drawX = p.x;
        const drawY = isDragged ? p.y - 8 : p.y;

        // Circular clipped portrait image
        ctx.save();
        ctx.beginPath();
        ctx.arc(drawX, drawY, tokenRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const avatarImg = getCachedImage(tok.avatar);
        if (avatarImg) {
          ctx.drawImage(
            avatarImg,
            drawX - tokenRadius,
            drawY - tokenRadius,
            tokenRadius * 2,
            tokenRadius * 2
          );
        } else {
          ctx.fillStyle = tok.color || '#d97706';
          ctx.fillRect(
            drawX - tokenRadius,
            drawY - tokenRadius,
            tokenRadius * 2,
            tokenRadius * 2
          );
        }
        ctx.restore();

        // Outer Class / Element Ring
        ctx.strokeStyle = isSelected ? '#ffffff' : tok.ringColor || '#f59e0b';
        ctx.lineWidth = isSelected ? 4 : 3;
        ctx.beginPath();
        ctx.arc(drawX, drawY, tokenRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Facing Direction Pointer on Ring
        const dirAngle = tok.rotation || 0;
        const tipX = drawX + Math.cos(dirAngle) * (tokenRadius + 6);
        const tipY = drawY + Math.sin(dirAngle) * (tokenRadius + 6);
        ctx.fillStyle = tok.ringColor || '#f59e0b';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Token Nameplate & PV/SAN Bars below token
        const barW = Math.max(76, tokenRadius * 2.1);
        const barX = drawX - barW / 2;
        const barY = drawY + tokenRadius + 8;

        ctx.save();
        ctx.fillStyle = 'rgba(9, 9, 13, 0.88)';
        ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(63, 63, 70, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(barX - 4, barY - 2, barW + 8, tok.maxSan > 0 ? 30 : 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tok.name, drawX, barY + 10);

        // PV Bar
        const hpPct = Math.max(0, Math.min(1, tok.hp / (tok.maxHp || 1)));
        ctx.fillStyle = '#27272a';
        ctx.fillRect(barX, barY + 14, barW, 4.5);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(barX, barY + 14, barW * hpPct, 4.5);

        // SAN Bar
        if (tok.maxSan > 0) {
          const sanPct = Math.max(0, Math.min(1, tok.san / tok.maxSan));
          ctx.fillStyle = '#27272a';
          ctx.fillRect(barX, barY + 20, barW, 3.5);
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(barX, barY + 20, barW * sanPct, 3.5);
        }
        ctx.restore();
      });

      // 9. Draw Real-Time Raycasting Fog of War Overlay (if not in 'reveal_all' mode)
      if (st.fogMode !== 'reveal_all') {
        const fCanvas = fogCanvasRef.current;
        const fCtx = fCanvas.getContext('2d');
        fCtx.clearRect(0, 0, 512, 307);

        // GM sees translucent shadow (0.45) to edit the whole map; Players see dense black shadow (0.97)
        const alpha = st.role === 'gm' ? 0.45 : 0.97;
        fCtx.fillStyle = `rgba(5, 5, 10, ${alpha})`;
        fCtx.fillRect(0, 0, 512, 307);

        fCtx.save();
        fCtx.globalCompositeOperation = 'destination-out';

        // Reveal polygons for each viewer token
        liveViewers.forEach((v) => {
          const poly = computeVisibilityPolygon(
            v.x,
            v.z,
            v.facing,
            activeSegments,
            v.flashlightOn
          );
          if (poly.length > 2) {
            const orig = worldToFogPx(v.x, v.z);
            const grad = fCtx.createRadialGradient(orig.x, orig.y, 10, orig.x, orig.y, 195);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.8, 'rgba(255,255,255,0.95)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            fCtx.fillStyle = grad;
            fCtx.beginPath();
            poly.forEach((pt, idx) => {
              const fp = worldToFogPx(pt.x, pt.z);
              if (idx === 0) fCtx.moveTo(fp.x, fp.y);
              else fCtx.lineTo(fp.x, fp.y);
            });
            fCtx.closePath();
            fCtx.fill();
          }
        });

        // Apply GM Manual Fog Paint Mask
        fCtx.drawImage(manualMaskCanvasRef.current, 0, 0);
        fCtx.restore();

        ctx.drawImage(fCanvas, topLeft.x, topLeft.y, mapPixelW, mapPixelH);
      }

      // 10. Draw Tactical 1.5m Ruler when dragging a token with Tab/Alt or Ruler button ON
      const showRuler =
        animRef.current.interactionType === 'drag_token' &&
        (animRef.current.isMeasureKeyHold || st.rulerForcedOn);

      if (showRuler && animRef.current.activeId) {
        const tok = st.tokens.find((t) => t.id === animRef.current.activeId);
        if (tok) {
          const pStart = worldToScreen(
            animRef.current.dragStartWorld.x,
            animRef.current.dragStartWorld.z
          );
          const pEnd = worldToScreen(tok.x, tok.z);
          const distMeters = Math.hypot(
            tok.x - animRef.current.dragStartWorld.x,
            tok.z - animRef.current.dragStartWorld.z
          );
          const squares = distMeters / 1.5;

          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(pStart.x, pStart.y);
          ctx.lineTo(pEnd.x, pEnd.y);
          ctx.stroke();
          ctx.setLineDash([]);

          // Square tick dots every 1.5m
          const wholeSq = Math.floor(squares);
          for (let s = 1; s <= wholeSq; s++) {
            const t = (s * 1.5) / (distMeters || 1);
            const tx = pStart.x + (pEnd.x - pStart.x) * t;
            const ty = pStart.y + (pEnd.y - pStart.y) * t;
            ctx.fillStyle = s <= 6 ? '#22c55e' : s <= 12 ? '#f59e0b' : '#ef4444';
            ctx.beginPath();
            ctx.arc(tx, ty, 5, 0, Math.PI * 2);
            ctx.fill();
          }

          // Floating label at midpoint
          const mx = (pStart.x + pEnd.x) / 2;
          const my = (pStart.y + pEnd.y) / 2 - 22;
          const labelText = `📏 ${distMeters.toFixed(1)}m (${squares.toFixed(1)}q)`;
          ctx.fillStyle = 'rgba(9, 9, 13, 0.94)';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(mx - 68, my - 14, 136, 26, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 12px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(labelText, mx, my + 3);
          ctx.restore();
        }
      }

      // 11. Draw Animated Polyhedral Dice on the Table
      animRef.current.diceVisuals.forEach((d) => {
        if (d.age < 1.1) {
          d.age += dt;
          d.x += d.vx * dt;
          d.z += d.vz * dt;
          d.vx *= 0.92;
          d.vz *= 0.92;
          d.rot += d.vRot * dt;
          d.vRot *= 0.9;
        }
        const dp = worldToScreen(d.x, d.z);
        ctx.save();
        ctx.translate(dp.x, dp.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = '#18181b';
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2.5;
        const r = Math.max(14, 0.28 * scale);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`d${d.sides}`, 0, 3);
        ctx.restore();
      });

      // 12. Draw Floating "Mãozinhas" Cursors (Peer + Player/Master Hand)
      const drawHandCursor = (screenX, screenY, colorHex, label, isClosed) => {
        ctx.save();
        ctx.translate(screenX, screenY);

        // Glow circle
        ctx.fillStyle = colorHex;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Hand emoji / sculpted badge
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isClosed ? '✊' : '🖐️', 0, 0);

        // Player tag pill
        ctx.fillStyle = 'rgba(9, 9, 13, 0.9)';
        ctx.strokeStyle = colorHex;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(12, 8, 66, 18, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(label, 45, 17);
        ctx.restore();
      };

      if (st.showTeamCursors) {
        const peerPos = worldToScreen(
          -2.4 + Math.cos(elapsed * 0.85) * 1.4,
          -1.0 + Math.sin(elapsed * 1.15) * 1.0
        );
        drawHandCursor(peerPos.x, peerPos.y, '#a855f7', 'Kaiser', false);
      }

      const roleColor =
        st.role === 'gm' ? '#ef4444' : st.role === 'joui' ? '#ef4444' : '#f59e0b';
      const roleLabel =
        st.role === 'gm' ? 'Mestre' : st.role === 'joui' ? 'Joui' : 'Arthur';
      drawHandCursor(
        animRef.current.mouseScreen.x,
        animRef.current.mouseScreen.y,
        roleColor,
        roleLabel,
        animRef.current.isGrabbing
      );
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  const primaryDoor = currentMap?.doors?.[0];

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#09090d]">
      {/* 60FPS 2D/2.5D Tactical Canvas ("O Segredo na Floresta" Style) */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-none"
      />

      {/* TOP FLOATING BAR: Map Switcher, Image Upload, Token Creator & Master Editor Tools */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 px-3 py-1.5 rounded-xl shadow-2xl pointer-events-auto">
          <button
            onClick={onOpenMapModal}
            className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition"
            title="Trocar de ambiente ou subir qualquer imagem de mapa do seu PC"
          >
            <Upload className="w-3.5 h-3.5" />
            🗺️ Trocar / Subir Mapa ({currentMap.name.split('.')[1] || currentMap.name})
          </button>

          <button
            onClick={onOpenTokenModal}
            className="px-2.5 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900/80 border border-red-500/50 text-red-100 text-xs font-bold flex items-center gap-1.5 transition"
            title="Criar novo personagem/monstro ou colocar sua própria imagem no Token"
          >
            <UserPlus className="w-3.5 h-3.5" />
            🖼️ Criar / Editar Token (Imagem)
          </button>

          <button
            onClick={() =>
              setFogMode(fogMode === 'reveal_all' ? 'dynamic' : 'reveal_all')
            }
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
              fogMode === 'reveal_all'
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                : 'bg-violet-950/80 border-violet-500/60 text-violet-200'
            }`}
            title="Alternar entre Mapa Totalmente Aberto (sem sombra) ou Escuridão Dinâmica (Lanternas & Portas)"
          >
            {fogMode === 'reveal_all' ? (
              <>
                <Sun className="w-3.5 h-3.5" /> Mapa Aberto (Sem Sombra)
              </>
            ) : (
              <>
                <Flashlight className="w-3.5 h-3.5" /> Luz & Sombra Dinâmica
              </>
            )}
          </button>
        </div>

        {/* Master Map Builder Toolbar (Active when in GM Mode) */}
        {role === 'gm' && (
          <div className="flex flex-wrap items-center gap-1 bg-zinc-950/95 backdrop-blur-md border border-red-500/40 px-2.5 py-1.5 rounded-xl shadow-2xl pointer-events-auto">
            <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 px-1.5 font-bold">
              Editor do Mestre:
            </span>
            <button
              onClick={() => setGmTool('interact')}
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                gmTool === 'interact'
                  ? 'bg-red-900/80 text-white border border-red-400'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Mover qualquer token, abrir portas e arrastar pistas/objetos"
            >
              <Hand className="w-3.5 h-3.5" /> Mover Tudo
            </button>
            <button
              onClick={() => setGmTool('draw_wall')}
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                gmTool === 'draw_wall'
                  ? 'bg-sky-900/90 text-sky-100 border border-sky-400'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Clique e arraste no mapa para desenhar paredes que bloqueiam a visão"
            >
              <BrickWall className="w-3.5 h-3.5" /> + Parede
            </button>
            <button
              onClick={() => setGmTool('add_door')}
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                gmTool === 'add_door'
                  ? 'bg-amber-900/90 text-amber-100 border border-amber-400'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Clique e arraste no mapa para colocar uma porta interativa"
            >
              <DoorOpen className="w-3.5 h-3.5" /> + Porta
            </button>
            <button
              onClick={() => setGmTool('erase')}
              className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                gmTool === 'erase'
                  ? 'bg-rose-900/90 text-rose-100 border border-rose-400'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Clique em qualquer parede, porta ou objeto colocado para apagá-lo"
            >
              <Eraser className="w-3.5 h-3.5" /> Apagar
            </button>
          </div>
        )}
      </div>

      {/* Hover Contextual Prompt */}
      {hoveredInfo && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-2xl text-center">
          <div className="text-xs font-bold text-amber-300">{hoveredInfo.title}</div>
          <div className="text-[11px] text-zinc-300">{hoveredInfo.hint}</div>
        </div>
      )}

      {/* Bottom Floating Camera, Grid & Quick Door Controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/95 backdrop-blur-md border border-zinc-800 shadow-2xl">
        <button
          onClick={() => {
            cameraRef.current.zoom = Math.min(2.8, cameraRef.current.zoom * 1.18);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 flex items-center gap-1"
          title="Aproximar Zoom"
        >
          <ZoomIn className="w-3.5 h-3.5" /> Zoom +
        </button>
        <button
          onClick={() => {
            cameraRef.current.zoom = Math.max(0.55, cameraRef.current.zoom * 0.84);
          }}
          className="px-2 py-1 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 flex items-center gap-1"
          title="Afastar Zoom"
        >
          <ZoomOut className="w-3.5 h-3.5" /> Zoom -
        </button>
        <button
          onClick={() => {
            cameraRef.current = { centerX: 0, centerZ: 0, zoom: 1.0 };
          }}
          className="px-2 py-1 text-xs rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/70 flex items-center gap-1"
          title="Centralizar Mapa"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Centralizar
        </button>
        <button
          onClick={() =>
            onUpdateMap({ ...currentMap, gridEnabled: currentMap.gridEnabled === false })
          }
          className={`px-2 py-1 text-xs rounded-lg border flex items-center gap-1 ${
            currentMap.gridEnabled !== false
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
          title="Ligar/Desligar Grade de Quadrados (1,5m)"
        >
          <Grid className="w-3.5 h-3.5" /> Grade 1,5m
        </button>

        {primaryDoor && (
          <>
            <div className="h-4 w-px bg-zinc-800 mx-1" />
            <button
              onClick={() => {
                if (primaryDoor.locked && role !== 'gm') {
                  soundEngine.playSFX('door_locked');
                  onNotification('🔒 Porta Trancada! O Mestre precisa destrancá-la.');
                  return;
                }
                soundEngine.playSFX('door_creak');
                const updated = currentMap.doors.map((d, i) =>
                  i === 0 ? { ...d, angleRad: 0.48 } : d
                );
                onUpdateMap({ ...currentMap, doors: updated });
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-500/40"
            >
              🔦 Entreabrir Fresta (25°)
            </button>
            <button
              onClick={() => {
                if (primaryDoor.locked && role !== 'gm') {
                  soundEngine.playSFX('door_locked');
                  onNotification('🔒 Porta Trancada! O Mestre precisa destrancá-la.');
                  return;
                }
                soundEngine.playSFX('door_creak');
                const isOpen = Math.abs(primaryDoor.angleRad || 0) > 0.35;
                const updated = currentMap.doors.map((d, i) =>
                  i === 0 ? { ...d, angleRad: isOpen ? 0 : 1.45 } : d
                );
                onUpdateMap({ ...currentMap, doors: updated });
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700"
            >
              {Math.abs(primaryDoor.angleRad || 0) > 0.35
                ? '🚪 Fechar Porta'
                : '🚪 Escancarar Porta'}
            </button>

            {role === 'gm' && (
              <button
                onClick={() => {
                  soundEngine.playSFX('door_locked');
                  const updated = currentMap.doors.map((d, i) =>
                    i === 0 ? { ...d, locked: !d.locked } : d
                  );
                  onUpdateMap({ ...currentMap, doors: updated });
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 ${
                  primaryDoor.locked
                    ? 'bg-red-950/80 border-red-500/60 text-red-200'
                    : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                }`}
              >
                {primaryDoor.locked ? (
                  <>
                    <Lock className="w-3 h-3" /> Trancada
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3" /> Destrancada
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
