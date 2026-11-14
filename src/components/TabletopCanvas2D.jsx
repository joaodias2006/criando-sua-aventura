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
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Compass,
} from 'lucide-react';

export default function TabletopCanvas2D({
  role,
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
  fogMode,
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
  const [showGmToolsDropdown, setShowGmToolsDropdown] = useState(false);
  const [showBottomControls, setShowBottomControls] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState(null);

  const imageCacheRef = useRef(new Map());
  const floorCacheRef = useRef({ theme: null, bgUrl: null, canvas: null });
  const fogCanvasRef = useRef(null);
  const manualMaskCanvasRef = useRef(null);

  const cameraRef = useRef({
    centerX: 0,
    centerZ: 0,
    zoom: 1.0,
  });

  const animRef = useRef({
    mouseWorld: { x: -2, z: 0 },
    mouseScreen: { x: 400, y: 300 },
    isGrabbing: false,
    interactionType: null, // 'drag_token' | 'aim_flashlight' | 'drag_door' | 'drag_clue' | 'drag_prop' | 'pan_camera' | 'draw_wall' | 'add_door' | 'paint_fog'
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
      if (stateRef.current.currentMap?.bgImageUrl === url) {
        floorCacheRef.current.theme = null;
      }
    };
    img.src = url;
    return null;
  };

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

  useEffect(() => {
    if (!manualMaskCanvasRef.current) return;
    const ctx = manualMaskCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 512, 307);
    if (manualRoom2Revealed) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(256, 0, 256, 307);
    }
  }, [manualRoom2Revealed, currentMap?.id]);

  // Procedural Map Artwork Builder
  const buildStaticMapArtwork = (mapConfig) => {
    const off = document.createElement('canvas');
    off.width = 1200;
    off.height = 720;
    const ctx = off.getContext('2d');
    const theme = mapConfig.theme || 'wood_mansion';

    const wToPxX = (wx) => ((wx - MAP_BOUNDS.minX) / MAP_BOUNDS.width) * off.width;
    const wToPxY = (wz) => ((wz - MAP_BOUNDS.minZ) / MAP_BOUNDS.height) * off.height;

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
      ctx.fillStyle = '#111c14';
      ctx.fillRect(0, 0, off.width, off.height);

      ctx.fillStyle = '#1e1914';
      ctx.beginPath();
      ctx.ellipse(600, 360, 540, 140, 0.08, 0, Math.PI * 2);
      ctx.fill();

      const cx1 = wToPxX(1.5);
      const cy1 = wToPxY(-3.2);
      const cw = wToPxX(6.2) - cx1;
      const ch = wToPxY(3.2) - cy1;
      ctx.fillStyle = '#291b12';
      ctx.fillRect(cx1, cy1, cw, ch);

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
      ctx.fillStyle = '#182226';
      ctx.fillRect(0, 0, off.width, off.height);

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

      ctx.fillStyle = '#334155';
      ctx.fillRect(wToPxX(-6.2), wToPxY(-3.6), 140, 75);
      ctx.fillRect(wToPxX(-6.2), wToPxY(2.2), 140, 75);
      ctx.fillStyle = 'rgba(153, 27, 27, 0.55)';
      ctx.beginPath();
      ctx.arc(wToPxX(2.5), wToPxY(0.5), 95, 0, Math.PI * 2);
      ctx.fill();
    } else if (theme === 'suvaco_seco') {
      ctx.fillStyle = '#26170e';
      ctx.fillRect(0, 0, off.width, off.height);

      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < off.height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(off.width, y);
        ctx.stroke();
      }

      ctx.fillStyle = '#451a03';
      ctx.fillRect(wToPxX(-6.5), wToPxY(-3.8), 420, 75);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(wToPxX(-3.2), wToPxY(0.8), 190, 110);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(wToPxX(-3.2) + 12, wToPxY(0.8) + 12, 166, 86);
    } else {
      ctx.fillStyle = '#23160f';
      ctx.fillRect(0, 0, off.width, off.height);

      for (let r = 0; r < 24; r++) {
        const y = r * 30;
        ctx.fillStyle = r % 2 === 0 ? '#271811' : '#21140d';
        ctx.fillRect(0, y, off.width, 29);
      }

      ctx.fillStyle = '#4c1d24';
      ctx.fillRect(wToPxX(-5.8), wToPxY(-1.2), 310, 220);
      ctx.strokeStyle = '#9f1239';
      ctx.lineWidth = 3;
      ctx.strokeRect(wToPxX(-5.8) + 8, wToPxY(-1.2) + 8, 294, 204);

      ctx.fillStyle = '#3b1f0e';
      ctx.fillRect(wToPxX(-4.1), wToPxY(-3.2), 135, 185);
      ctx.fillRect(wToPxX(-2.4), wToPxY(1.7), 96, 96);
      ctx.fillStyle = '#291509';
      ctx.fillRect(wToPxX(-7.4), wToPxY(-2.8), 45, 250);

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

      ctx.fillStyle = '#27272a';
      ctx.fillRect(wToPxX(3.9), wToPxY(-3.2), 105, 165);
    }

    return off;
  };

  // Main 60FPS Render Loop
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

    const getTransformMetrics = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      const baseScale = Math.min((cw - 24) / MAP_BOUNDS.width, (ch - 24) / MAP_BOUNDS.height);
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

      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        animRef.current.interactionType = 'pan_camera';
        animRef.current.panStartScreen = { x: sx, y: sy };
        animRef.current.panStartCenter = { ...cameraRef.current };
        return;
      }

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
            onNotification('⚠️ Apenas o Mestre pode trancar/destrancar portas.');
          }
          return;
        }

        // Right-click on empty space aims the selected character's flashlight!
        const selTok = st.tokens.find((t) => t.id === st.selectedTokenId);
        if (selTok && (st.role === 'gm' || selTok.owner === st.role)) {
          const newRot = Math.atan2(wz - selTok.z, wx - selTok.x);
          setTokens((prev) =>
            prev.map((t) => (t.id === selTok.id ? { ...t, rotation: newRot } : t))
          );
          animRef.current.interactionType = 'aim_flashlight';
          animRef.current.activeId = selTok.id;
          return;
        }

        animRef.current.interactionType = 'pan_camera';
        animRef.current.panStartScreen = { x: sx, y: sy };
        animRef.current.panStartCenter = { ...cameraRef.current };
        return;
      }

      if (e.button !== 0) return;
      animRef.current.isGrabbing = true;

      if (
        st.role === 'gm' &&
        (st.fogMode === 'brush_reveal' || st.fogMode === 'brush_hide')
      ) {
        animRef.current.interactionType = 'paint_fog';
        paintManualFog(wx, wz, st.fogMode === 'brush_reveal');
        return;
      }

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

      // Check if clicking the Flashlight Aim Handle of the selected token
      const selTok = st.tokens.find((t) => t.id === st.selectedTokenId);
      if (selTok && selTok.flashlightOn !== false) {
        const handleX = selTok.x + Math.cos(selTok.rotation || 0) * 1.1;
        const handleZ = selTok.z + Math.sin(selTok.rotation || 0) * 1.1;
        if (Math.hypot(wx - handleX, wz - handleZ) < 0.42) {
          animRef.current.interactionType = 'aim_flashlight';
          animRef.current.activeId = selTok.id;
          return;
        }
      }

      // 1. Check if clicking a Token
      const clickedToken = [...st.tokens]
        .reverse()
        .find((t) => Math.hypot(wx - t.x, wz - t.z) < 0.72 * (t.sizeSquares || 1));

      if (clickedToken) {
        setSelectedTokenId(clickedToken.id);
        if (st.role !== 'gm' && clickedToken.owner !== st.role) {
          onNotification(
            `🚫 No modo Jogador, você só pode mover seu próprio personagem!`
          );
          return;
        }
        animRef.current.interactionType = 'drag_token';
        animRef.current.activeId = clickedToken.id;
        animRef.current.dragStartWorld = { x: clickedToken.x, z: clickedToken.z };
        return;
      }

      // 2. Check if clicking an Interactive Door
      const clickedDoor = (map.doors || []).find((d) => {
        const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
        const endX = d.hingeX + Math.sin(totalAngle) * (d.length || 2);
        const endZ = d.hingeZ + Math.cos(totalAngle) * (d.length || 2);
        return distToSegment(wx, wz, d.hingeX, d.hingeZ, endX, endZ) < 0.45;
      });

      if (clickedDoor) {
        if (clickedDoor.locked && st.role !== 'gm') {
          soundEngine.playSFX('door_locked');
          onNotification('🔒 Esta porta está TRANCADA!');
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

      // Otherwise: Pan Camera
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

      if (mode === 'aim_flashlight' && animRef.current.activeId) {
        const tokId = animRef.current.activeId;
        setTokens((prev) =>
          prev.map((t) => {
            if (t.id !== tokId) return t;
            const newRot = Math.atan2(wz - t.z, wx - t.x);
            return { ...t, rotation: newRot };
          })
        );
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
            const rot = Math.hypot(dx, dz) > 0.06 ? Math.atan2(dz, dx) : t.rotation;
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

      // Hover detection
      const hoveredClue = st.handouts.find((h) => Math.hypot(wx - h.x, wz - h.z) < 0.55);
      if (hoveredClue) {
        animRef.current.hoveredClueId = hoveredClue.id;
        setHoveredInfo({
          title: `🔍 Pista: ${hoveredClue.title}`,
          hint: 'Clique ou aperte [ESPAÇO] para ler Frente & Verso',
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
          title: hoveredDoor.locked ? '🔒 Porta Trancada' : '🚪 Porta Interativa',
          hint: 'Segure e arraste para abrir fresta • Botão Direito (GM): Trancar',
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
          onNotification('🧱 Parede adicionada!');
        }
      }

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
        onNotification('🚪 Porta adicionada!');
      }

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

    let rafId;
    let lastTime = performance.now();

    const renderFrame = (now) => {
      rafId = requestAnimationFrame(renderFrame);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsed = now / 1000;

      const parent = canvas.parentElement;
      if (parent && (canvas.width !== parent.clientWidth || canvas.height !== parent.clientHeight)) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }

      const st = stateRef.current;
      const map = st.currentMap;
      const { cw, ch, scale } = getTransformMetrics();

      // 1. Clear Table Surface
      ctx.fillStyle = '#09090d';
      ctx.fillRect(0, 0, cw, ch);

      const topLeft = worldToScreen(MAP_BOUNDS.minX, MAP_BOUNDS.minZ);
      const mapPixelW = MAP_BOUNDS.width * scale;
      const mapPixelH = MAP_BOUNDS.height * scale;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 32;
      ctx.fillStyle = '#18120d';
      ctx.fillRect(topLeft.x - 8, topLeft.y - 8, mapPixelW + 16, mapPixelH + 16);
      ctx.restore();

      // 2. Draw Map Floor Artwork
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

      // 3. Draw Tactical 1.5m Grid
      if (map.gridEnabled !== false) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${map.gridOpacity ?? 0.15})`;
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

      const activeSegments = buildActiveObstacleSegments(map.walls || [], map.doors || []);
      const viewerTokens = st.tokens.filter((t) => t.type === 'player');
      const liveViewers = viewerTokens.map((vt) => ({
        x: vt.x,
        z: vt.z,
        facing: vt.rotation || 0,
        flashlightOn: vt.flashlightOn !== false,
      }));

      // 4. Draw Spawned Workshop Props
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

      // 5. Draw Ritual Bursts
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

      (map.doors || []).forEach((d) => {
        const totalAngle = (d.baseAngle || 0) + (d.angleRad || 0);
        const len = d.length || 2.0;
        const endX = d.hingeX + Math.sin(totalAngle) * len;
        const endZ = d.hingeZ + Math.cos(totalAngle) * len;

        const pHinge = worldToScreen(d.hingeX, d.hingeZ);
        const pEnd = worldToScreen(endX, endZ);

        ctx.save();
        ctx.strokeStyle = d.locked ? '#991b1b' : '#92400e';
        ctx.lineWidth = Math.max(7, 0.18 * scale);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pHinge.x, pHinge.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();

        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(pHinge.x, pHinge.y, Math.max(4, 0.09 * scale), 0, Math.PI * 2);
        ctx.fill();

        const knobX = d.hingeX + Math.sin(totalAngle) * (len * 0.82);
        const knobZ = d.hingeZ + Math.cos(totalAngle) * (len * 0.82);
        const pKnob = worldToScreen(knobX, knobZ);
        ctx.fillStyle = d.locked ? '#ef4444' : '#facc15';
        ctx.beginPath();
        ctx.arc(pKnob.x, pKnob.y, Math.max(5, 0.11 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

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

      // 7. Draw Inspectable Handouts / Clues
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
        ctx.strokeStyle = isHovered ? '#fef08a' : 'rgba(250, 204, 21, 0.65)';
        ctx.fillStyle = isHovered ? 'rgba(250, 204, 21, 0.28)' : 'rgba(234, 179, 8, 0.14)';
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 0.36 * scale * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = clue.type === 'diary' ? '#991b1b' : '#fef3c7';
        ctx.fillRect(-0.2 * scale, -0.15 * scale, 0.4 * scale, 0.3 * scale);
        ctx.restore();
      });

      // 8. Draw Directional Flashlight Beams on Floor (ONLY the Flashlight Cone - NO light circle around character!)
      st.tokens.forEach((tok) => {
        if (tok.type === 'player' && tok.flashlightOn !== false) {
          const poly = computeVisibilityPolygon(
            tok.x,
            tok.z,
            tok.rotation || 0,
            activeSegments,
            true
          );
          if (poly.length > 2) {
            const pOrigin = worldToScreen(tok.x, tok.z);
            const beamGrad = ctx.createRadialGradient(
              pOrigin.x,
              pOrigin.y,
              4,
              pOrigin.x,
              pOrigin.y,
              9.5 * scale
            );
            beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.34)');
            beamGrad.addColorStop(0.6, 'rgba(254, 240, 138, 0.14)');
            beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');

            ctx.save();
            ctx.fillStyle = beamGrad;
            ctx.beginPath();
            poly.forEach((pt, idx) => {
              const sp = worldToScreen(pt.x, pt.z);
              if (idx === 0) ctx.moveTo(sp.x, sp.y);
              else ctx.lineTo(sp.x, sp.y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }
      });

      // 9. Draw Real-Time Flashlight-Only Fog of War Overlay BEFORE or around unseen tokens
      if (st.fogMode !== 'reveal_all') {
        const fCanvas = fogCanvasRef.current;
        const fCtx = fCanvas.getContext('2d');
        fCtx.clearRect(0, 0, 512, 307);

        const alpha = st.role === 'gm' ? 0.48 : 0.96;
        fCtx.fillStyle = `rgba(4, 4, 9, ${alpha})`;
        fCtx.fillRect(0, 0, 512, 307);

        fCtx.save();
        fCtx.globalCompositeOperation = 'destination-out';

        // Reveal ONLY the directional flashlight cone of each active player token (no radial circle around character!)
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
            const grad = fCtx.createRadialGradient(orig.x, orig.y, 4, orig.x, orig.y, 235);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.82, 'rgba(255,255,255,0.96)');
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

        fCtx.drawImage(manualMaskCanvasRef.current, 0, 0);
        fCtx.restore();

        ctx.drawImage(fCanvas, topLeft.x, topLeft.y, mapPixelW, mapPixelH);
      }

      // 10. Draw FRAMELESS CHARACTER TOKENS (ONLY the Person/Figure - NO circle and NO border!)
      // Drawn after the fog layer so the player's own character silhouette has maximum contrast on screen!
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

        const charW = 1.25 * (tok.sizeSquares || 1) * scale;
        const charH = 1.42 * (tok.sizeSquares || 1) * scale;
        const drawX = p.x;
        const drawY = isDragged ? p.y - 10 : p.y;

        ctx.save();
        // Ground shadow under feet
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + charH * 0.34, charW * 0.36, charH * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // High-contrast silhouette drop-shadow (NO circle, NO border around the person!)
        ctx.shadowColor = isSelected ? 'rgba(250, 204, 21, 0.9)' : 'rgba(0, 0, 0, 0.98)';
        ctx.shadowBlur = isDragged ? 22 : isSelected ? 16 : 12;
        ctx.shadowOffsetY = isDragged ? 10 : 3;

        const avatarImg = getCachedImage(tok.avatar);
        if (avatarImg) {
          // Preserve image aspect ratio cleanly without any circle clipping or border
          const imgAspect =
            avatarImg.naturalWidth && avatarImg.naturalHeight
              ? avatarImg.naturalWidth / avatarImg.naturalHeight
              : 0.86;
          let renderW = charW;
          let renderH = charH;
          if (imgAspect > 1) {
            renderH = charW / imgAspect;
          } else {
            renderW = charH * imgAspect;
          }
          ctx.drawImage(
            avatarImg,
            drawX - renderW / 2,
            drawY - renderH / 2,
            renderW,
            renderH
          );
        }
        ctx.restore();

        // Interactive Flashlight Aim Handle when token is selected
        if (isSelected && tok.flashlightOn !== false && tok.type === 'player') {
          const handlePos = worldToScreen(
            tok.x + Math.cos(tok.rotation || 0) * 1.1,
            tok.z + Math.sin(tok.rotation || 0) * 1.1
          );
          ctx.save();
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(drawX, drawY);
          ctx.lineTo(handlePos.x, handlePos.y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(handlePos.x, handlePos.y, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Compact Name & PV Bar under the character's feet
        const barW = Math.max(68, charW * 0.95);
        const barX = drawX - barW / 2;
        const barY = drawY + charH * 0.42;

        ctx.save();
        ctx.fillStyle = 'rgba(9, 9, 13, 0.85)';
        ctx.beginPath();
        ctx.roundRect(barX - 3, barY - 2, barW + 6, 20, 5);
        ctx.fill();

        ctx.fillStyle = '#f4f4f5';
        ctx.font = 'bold 10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tok.name.split(' ')[0]} (${tok.hp})`, drawX, barY + 9);

        const hpPct = Math.max(0, Math.min(1, tok.hp / (tok.maxHp || 1)));
        ctx.fillStyle = '#27272a';
        ctx.fillRect(barX, barY + 12, barW, 4);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(barX, barY + 12, barW * hpPct, 4);
        ctx.restore();
      });

      // 11. Draw Tactical 1.5m Ruler
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

          const mx = (pStart.x + pEnd.x) / 2;
          const my = (pStart.y + pEnd.y) / 2 - 20;
          ctx.fillStyle = 'rgba(9, 9, 13, 0.94)';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(mx - 64, my - 13, 128, 24, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 11px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`📏 ${distMeters.toFixed(1)}m (${squares.toFixed(1)}q)`, mx, my + 3);
          ctx.restore();
        }
      }

      // 12. Draw Animated Polyhedral Dice
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
        const r = Math.max(13, 0.26 * scale);
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

      // 13. Draw Floating "Mãozinha" Cursor
      const drawHandCursor = (screenX, screenY, colorHex, isClosed) => {
        ctx.save();
        ctx.translate(screenX, screenY);
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isClosed ? '✊' : '🖐️', 0, 0);
        ctx.restore();
      };

      const roleColor = st.role === 'gm' ? '#ef4444' : '#f59e0b';
      drawHandCursor(
        animRef.current.mouseScreen.x,
        animRef.current.mouseScreen.y,
        roleColor,
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
  const selectedToken = tokens.find((t) => t.id === selectedTokenId);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#09090d]">
      {/* Fullscreen 60FPS Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-none" />

      {/* COMPACT COLLAPSIBLE MASTER TOOLS FILTER BUTTON (Bottom-Left) */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1.5">
        {showGmToolsDropdown && (
          <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-2 w-64 animate-fadeIn">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold px-1">
              Opções Rápidas de Mapa & Mestre
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => {
                  setShowGmToolsDropdown(false);
                  onOpenMapModal();
                }}
                className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                Subir Mapa
              </button>

              <button
                onClick={() => {
                  setShowGmToolsDropdown(false);
                  onOpenTokenModal();
                }}
                className="p-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-100 text-xs font-bold flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                Add Token
              </button>
            </div>

            <button
              onClick={() =>
                setFogMode(fogMode === 'reveal_all' ? 'dynamic' : 'reveal_all')
              }
              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 ${
                fogMode === 'reveal_all'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-violet-950/80 border-violet-500/60 text-violet-200'
              }`}
            >
              {fogMode === 'reveal_all' ? (
                <>
                  <Sun className="w-3.5 h-3.5" /> Mapa Claro (Sem Sombra)
                </>
              ) : (
                <>
                  <Flashlight className="w-3.5 h-3.5" /> Só Luz da Lanterna
                </>
              )}
            </button>

            {role === 'gm' && (
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-zinc-800">
                <button
                  onClick={() => setGmTool('interact')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    gmTool === 'interact'
                      ? 'bg-red-900 text-white'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <Hand className="w-3 h-3" /> Mover Tudo
                </button>
                <button
                  onClick={() => setGmTool('draw_wall')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    gmTool === 'draw_wall'
                      ? 'bg-sky-900 text-white'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <BrickWall className="w-3 h-3" /> + Parede
                </button>
                <button
                  onClick={() => setGmTool('add_door')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    gmTool === 'add_door'
                      ? 'bg-amber-900 text-white'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <DoorOpen className="w-3 h-3" /> + Porta
                </button>
                <button
                  onClick={() => setGmTool('erase')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                    gmTool === 'erase'
                      ? 'bg-rose-900 text-white'
                      : 'bg-zinc-900 text-zinc-400'
                  }`}
                >
                  <Eraser className="w-3 h-3" /> Apagar
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setShowGmToolsDropdown(!showGmToolsDropdown)}
          className="px-3 py-2 rounded-xl bg-zinc-950/95 hover:bg-zinc-900 border border-zinc-700 text-xs font-bold text-amber-300 shadow-2xl flex items-center gap-1.5"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Opções de Mapa & Token</span>
          {showGmToolsDropdown ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* COMPACT COLLAPSIBLE CAMERA, FLASHLIGHT AIM & DOOR BUTTON (Bottom-Right) */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-1.5">
        {showBottomControls && (
          <div className="bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-2.5 shadow-2xl flex flex-col gap-2 w-64 animate-fadeIn">
            {/* Flashlight Direction Slider for Selected Character */}
            {selectedToken && selectedToken.type === 'player' && (
              <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                  <span className="flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" /> Girar Lanterna ({selectedToken.name.split(' ')[0]})
                  </span>
                </div>
                <input
                  type="range"
                  min={-3.14}
                  max={3.14}
                  step={0.08}
                  value={selectedToken.rotation || 0}
                  onChange={(e) => {
                    const rot = parseFloat(e.target.value);
                    setTokens((prev) =>
                      prev.map((t) =>
                        t.id === selectedToken.id ? { ...t, rotation: rot } : t
                      )
                    );
                  }}
                  className="w-full accent-amber-400"
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => {
                  cameraRef.current.zoom = Math.min(2.8, cameraRef.current.zoom * 1.18);
                }}
                className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1 border border-zinc-800"
              >
                <ZoomIn className="w-3.5 h-3.5" /> +
              </button>
              <button
                onClick={() => {
                  cameraRef.current.zoom = Math.max(0.55, cameraRef.current.zoom * 0.84);
                }}
                className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1 border border-zinc-800"
              >
                <ZoomOut className="w-3.5 h-3.5" /> -
              </button>
              <button
                onClick={() => {
                  cameraRef.current = { centerX: 0, centerZ: 0, zoom: 1.0 };
                }}
                className="py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1 border border-zinc-800"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <button
              onClick={() =>
                onUpdateMap({ ...currentMap, gridEnabled: currentMap.gridEnabled === false })
              }
              className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-1.5"
            >
              <Grid className="w-3.5 h-3.5 text-amber-400" />
              {currentMap.gridEnabled !== false ? 'Ocultar Grade 1,5m' : 'Mostrar Grade 1,5m'}
            </button>

            {primaryDoor && (
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-zinc-800">
                <button
                  onClick={() => {
                    if (primaryDoor.locked && role !== 'gm') {
                      soundEngine.playSFX('door_locked');
                      onNotification('🔒 Porta Trancada!');
                      return;
                    }
                    soundEngine.playSFX('door_creak');
                    const updated = currentMap.doors.map((d, i) =>
                      i === 0 ? { ...d, angleRad: 0.48 } : d
                    );
                    onUpdateMap({ ...currentMap, doors: updated });
                  }}
                  className="py-1.5 px-2 rounded-lg bg-amber-950/80 text-amber-200 border border-amber-500/40 text-[11px] font-bold"
                >
                  🔦 Espiar Fresta
                </button>
                <button
                  onClick={() => {
                    if (primaryDoor.locked && role !== 'gm') {
                      soundEngine.playSFX('door_locked');
                      onNotification('🔒 Porta Trancada!');
                      return;
                    }
                    soundEngine.playSFX('door_creak');
                    const isOpen = Math.abs(primaryDoor.angleRad || 0) > 0.35;
                    const updated = currentMap.doors.map((d, i) =>
                      i === 0 ? { ...d, angleRad: isOpen ? 0 : 1.45 } : d
                    );
                    onUpdateMap({ ...currentMap, doors: updated });
                  }}
                  className="py-1.5 px-2 rounded-lg bg-zinc-900 text-zinc-200 border border-zinc-700 text-[11px] font-bold"
                >
                  {Math.abs(primaryDoor.angleRad || 0) > 0.35 ? '🚪 Fechar' : '🚪 Abrir'}
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setShowBottomControls(!showBottomControls)}
          className="px-3 py-2 rounded-xl bg-zinc-950/95 hover:bg-zinc-900 border border-zinc-700 text-xs font-bold text-zinc-200 shadow-2xl flex items-center gap-1.5"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Lanterna, Zoom & Porta</span>
          {showBottomControls ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Hover Contextual Prompt */}
      {hoveredInfo && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-2xl text-center">
          <div className="text-xs font-bold text-amber-300">{hoveredInfo.title}</div>
          <div className="text-[10px] text-zinc-300">{hoveredInfo.hint}</div>
        </div>
      )}
    </div>
  );
}
