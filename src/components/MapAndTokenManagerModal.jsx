import React, { useState } from 'react';
import {
  X,
  Upload,
  Map,
  Users,
  Trash2,
  PlusCircle,
  Image as ImageIcon,
  Eraser,
  Grid,
  Flashlight,
  Layers,
} from 'lucide-react';
import { PRESET_MAP_TEMPLATES, makeCharacterCutoutSvg } from '../data/ordoData';

export default function MapAndTokenManagerModal({
  initialTab = 'map',
  onClose,
  currentMap,
  onSelectOrUpdateMap,
  tokens,
  setTokens,
  onNotification,
}) {
  const [tab, setTab] = useState(initialTab);
  const [customMapUrl, setCustomMapUrl] = useState('');
  const [customMapName, setCustomMapName] = useState('');
  const [customMapWidth, setCustomMapWidth] = useState(18);
  const [uploadMode, setUploadMode] = useState('add_floor'); // 'add_floor' | 'replace_all'

  // Universal Token Creator State (Works for both Characters & Monsters — just change the image!)
  const [newTokName, setNewTokName] = useState('');
  const [newTokColor, setNewTokColor] = useState('#f59e0b');
  const [newTokHp, setNewTokHp] = useState(65);
  const [newTokSize, setNewTokSize] = useState(0.95);
  const [newTokFlashlight, setNewTokFlashlight] = useState(true);
  const [newTokAvatar, setNewTokAvatar] = useState('');

  const placedMaps =
    Array.isArray(currentMap?.placedMaps) && currentMap.placedMaps.length > 0
      ? currentMap.placedMaps
      : [
          {
            id: currentMap?.id || 'floor_1',
            name: currentMap?.name || '1º Andar',
            theme: currentMap?.theme || 'wood_mansion',
            bgImageUrl: currentMap?.bgImageUrl || null,
            x: 0,
            z: 0,
            width: 15,
            height: 9,
            aspectRatio: 15 / 9,
          },
        ];

  // Computes a non-overlapping X coordinate to place a new floor right next to existing floors
  const getNextFloorPositionX = (newWidth) => {
    if (placedMaps.length === 0) return 0;
    const maxRightEdge = Math.max(
      ...placedMaps.map((m) => (Number(m.x) || 0) + (Number(m.width) || 15) / 2)
    );
    return Number((maxRightEdge + 2.0 + newWidth / 2).toFixed(1));
  };

  // Helper that reads natural image dimensions so the map is NEVER squished or compressed!
  const addOrReplaceMapWithImage = (dataUrl, floorName) => {
    const img = new Image();
    img.onload = () => {
      const aspect =
        img.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : 16 / 9;
      const w = Math.max(4, Number(customMapWidth) || 18);
      const h = Number((w / aspect).toFixed(2));

      const newFloor = {
        id: `floor_${Date.now()}`,
        name: floorName || `${placedMaps.length + 1}º Andar / Mapa`,
        theme: 'custom_image',
        bgImageUrl: dataUrl,
        x: uploadMode === 'replace_all' ? 0 : getNextFloorPositionX(w),
        z: 0,
        width: w,
        height: h,
        aspectRatio: aspect,
      };

      if (uploadMode === 'replace_all') {
        onSelectOrUpdateMap({
          ...currentMap,
          placedMaps: [newFloor],
          walls: [],
          doors: [],
        });
        onNotification(`🗺️ Mapa "${newFloor.name}" definido na proporção original sem cortes!`);
      } else {
        onSelectOrUpdateMap({
          ...currentMap,
          placedMaps: [...placedMaps, newFloor],
        });
        onNotification(
          `🗺️ Novo andar "${newFloor.name}" adicionado ao lado na proporção original!`
        );
      }
      setCustomMapName('');
      setCustomMapUrl('');
    };
    img.onerror = () => {
      const w = Math.max(4, Number(customMapWidth) || 18);
      const newFloor = {
        id: `floor_${Date.now()}`,
        name: floorName || `${placedMaps.length + 1}º Andar / Mapa`,
        theme: 'custom_image',
        bgImageUrl: dataUrl,
        x: uploadMode === 'replace_all' ? 0 : getNextFloorPositionX(w),
        z: 0,
        width: w,
        height: Number((w / 1.66).toFixed(2)),
        aspectRatio: 1.66,
      };
      onSelectOrUpdateMap({
        ...currentMap,
        placedMaps: uploadMode === 'replace_all' ? [newFloor] : [...placedMaps, newFloor],
      });
      onNotification(`🗺️ Mapa "${newFloor.name}" adicionado à mesa!`);
    };
    img.src = dataUrl;
  };

  const handleMapFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        const cleanName = customMapName.trim() || file.name.replace(/\.[^/.]+$/, '');
        addOrReplaceMapWithImage(dataUrl, cleanName);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceSingleFloorImage = (floorId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== 'string') return;
      const img = new Image();
      img.onload = () => {
        const aspect =
          img.naturalWidth && img.naturalHeight
            ? img.naturalWidth / img.naturalHeight
            : 16 / 9;
        const nextPlaced = placedMaps.map((fm) => {
          if (fm.id !== floorId) return fm;
          const w = Number(fm.width) || 18;
          return {
            ...fm,
            name: file.name.replace(/\.[^/.]+$/, '') || fm.name,
            bgImageUrl: dataUrl,
            aspectRatio: aspect,
            height: Number((w / aspect).toFixed(2)),
          };
        });
        onSelectOrUpdateMap({ ...currentMap, placedMaps: nextPlaced });
        onNotification('🗺️ Imagem do andar atualizada na proporção original!');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyMapUrl = (e) => {
    e.preventDefault();
    if (!customMapUrl.trim()) return;
    addOrReplaceMapWithImage(
      customMapUrl.trim(),
      customMapName.trim() || `${placedMaps.length + 1}º Andar (URL)`
    );
  };

  const handleUpdateFloorField = (floorId, changes) => {
    const nextPlaced = placedMaps.map((fm) => {
      if (fm.id !== floorId) return fm;
      const updated = { ...fm, ...changes };
      if (changes.width !== undefined) {
        const aspect = updated.aspectRatio || (fm.width || 15) / (fm.height || 9) || 1.66;
        updated.height = Number((Number(changes.width) / aspect).toFixed(2));
      }
      return updated;
    });
    onSelectOrUpdateMap({ ...currentMap, placedMaps: nextPlaced });
  };

  const handleRemoveFloor = (floorId) => {
    if (placedMaps.length <= 1) {
      onNotification('⚠️ A mesa precisa ter pelo menos 1 mapa ativo.');
      return;
    }
    onSelectOrUpdateMap({
      ...currentMap,
      placedMaps: placedMaps.filter((fm) => fm.id !== floorId),
    });
    onNotification('🗑️ Andar/Mapa removido da mesa.');
  };

  const handleAddTemplateFloor = (tpl) => {
    const w = tpl.width || 15;
    const h = tpl.height || 9;
    const newFloor = {
      id: `floor_${Date.now()}`,
      name: `${placedMaps.length + 1}º Andar — ${tpl.name}`,
      theme: tpl.theme,
      bgImageUrl: null,
      x: getNextFloorPositionX(w),
      z: 0,
      width: w,
      height: h,
      aspectRatio: w / h,
    };
    onSelectOrUpdateMap({
      ...currentMap,
      placedMaps: [...placedMaps, newFloor],
    });
    onNotification(`🗺️ "${newFloor.name}" adicionado ao lado na mesa!`);
  };

  const handleExistingTokenImageUpload = (tokenId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        setTokens((prev) =>
          prev.map((t) => (t.id === tokenId ? { ...t, avatar: dataUrl } : t))
        );
        onNotification('🖼️ Imagem do token atualizada (sem círculo/borda)!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNewTokenFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setNewTokAvatar(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNewToken = (e) => {
    e.preventDefault();
    const finalName = newTokName.trim() || `Token #${tokens.length + 1}`;
    const fallbackAvatar = makeCharacterCutoutSvg(
      finalName.slice(0, 6).toUpperCase(),
      newTokColor
    );

    const firstFloor = placedMaps[0] || { x: 0, z: 0 };
    const newTok = {
      id: `tok_${Date.now()}`,
      name: finalName,
      subtitle: 'Token na Mesa',
      type: 'player',
      owner: 'arthur',
      element: 'Sangue',
      color: newTokColor,
      ringColor: newTokColor,
      avatar: newTokAvatar || fallbackAvatar,
      sizeSquares: Number(newTokSize) || 0.95,
      x: (firstFloor.x || 0) + (Math.random() - 0.5) * 2,
      z: (firstFloor.z || 0) + (Math.random() - 0.5) * 2,
      rotation: 0,
      hp: Number(newTokHp) || 50,
      maxHp: Number(newTokHp) || 50,
      san: 50,
      maxSan: 50,
      pe: 30,
      maxPe: 30,
      conditions: [],
      flashlightOn: newTokFlashlight,
    };

    setTokens((prev) => [...prev, newTok]);
    onNotification(`🖼️ Token "${finalName}" colocado no mapa!`);
    setNewTokName('');
    setNewTokAvatar('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 select-none">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header & Tabs */}
        <div className="p-3.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setTab('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                tab === 'map'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Map className="w-4 h-4" />
              1. Mapas & Vários Andares (Sem Limite)
            </button>

            <button
              onClick={() => setTab('tokens')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                tab === 'tokens'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-4 h-4" />
              2. Tokens (Personagens / Monstros por Foto)
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {tab === 'map' ? (
            <>
              {/* Grid Size Adjustment Banner */}
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Grid className="w-4 h-4" />
                    Tamanho dos Quadrados da Grade (Mais Fina / Menor)
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Diminua ou aumente o tamanho da grade para encaixar perfeitamente nos seus mapas.
                  </p>
                </div>

                <div className="flex items-center gap-3 min-w-[220px]">
                  <input
                    type="range"
                    min={0.25}
                    max={2.0}
                    step={0.05}
                    value={currentMap.gridSize || 0.6}
                    onChange={(e) =>
                      onSelectOrUpdateMap({
                        ...currentMap,
                        gridSize: parseFloat(e.target.value),
                        gridEnabled: true,
                      })
                    }
                    className="flex-1 accent-amber-400"
                  />
                  <span className="font-mono text-xs font-bold text-amber-300 w-12 text-right">
                    {(currentMap.gridSize || 0.6).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Upload New Floor / Map without Compression */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-amber-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Subir Mapa (Mantém Proporção Original Sem Compactar!)
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Coloque vários mapas lado a lado (ex: 1º Andar e 2º Andar da Mansão) sem limite de tamanho.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setUploadMode('add_floor')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                        uploadMode === 'add_floor'
                          ? 'bg-amber-500 text-zinc-950'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      ➕ Adicionar Novo Andar
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('replace_all')}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                        uploadMode === 'replace_all'
                          ? 'bg-red-600 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      🔄 Substituir Tudo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Nome do Andar / Mapa (opcional):
                    </label>
                    <input
                      type="text"
                      value={customMapName}
                      onChange={(e) => setCustomMapName(e.target.value)}
                      placeholder="Ex: 1º Andar da Mansão, 2º Andar, Porão..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Tamanho Inicial (Largura — Sem Limite):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={8}
                        max={65}
                        step={1}
                        value={customMapWidth}
                        onChange={(e) => setCustomMapWidth(Number(e.target.value))}
                        className="flex-1 accent-amber-500"
                      />
                      <input
                        type="number"
                        min={4}
                        max={300}
                        value={customMapWidth}
                        onChange={(e) => setCustomMapWidth(Number(e.target.value) || 18)}
                        className="w-16 px-2 py-1 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-amber-300 text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 cursor-pointer transition text-center">
                    <Upload className="w-6 h-6 text-amber-400 mb-1.5" />
                    <span className="text-xs font-bold text-zinc-100">
                      {uploadMode === 'add_floor'
                        ? '➕ Escolher Imagem para Novo Andar / Mapa'
                        : '🔄 Escolher Imagem para Substituir Mapa'}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      PNG, JPG, WEBP (Sem espremer a imagem!)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMapFileUpload}
                      className="hidden"
                    />
                  </label>

                  <form
                    onSubmit={handleApplyMapUrl}
                    className="flex flex-col justify-between gap-2 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800"
                  >
                    <span className="text-xs font-bold text-zinc-200">
                      Ou cole o Link (URL) da Imagem do Mapa:
                    </span>
                    <input
                      type="text"
                      value={customMapUrl}
                      onChange={(e) => setCustomMapUrl(e.target.value)}
                      placeholder="https://exemplo.com/mansao-2-andar.jpg"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs transition"
                    >
                      {uploadMode === 'add_floor'
                        ? '➕ Adicionar Andar por URL'
                        : '🔄 Substituir por URL'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Active Placed Maps / Floors List (Resize without limit, Move, or Change Image) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" />
                    Mapas / Andares Ativos na Mesa ({placedMaps.length}) — Ajuste o Tamanho Sem Limite:
                  </h3>

                  <button
                    onClick={() => {
                      onSelectOrUpdateMap({ ...currentMap, walls: [], doors: [] });
                      onNotification('🧹 Paredes e portas removidas da mesa!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-red-950/70 text-red-300 border border-red-500/40 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Limpar Paredes/Portas
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {placedMaps.map((fm, idx) => (
                    <div
                      key={fm.id}
                      className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={fm.name || `Andar ${idx + 1}`}
                          onChange={(e) =>
                            handleUpdateFloorField(fm.id, { name: e.target.value })
                          }
                          className="flex-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-zinc-950 border border-zinc-800 text-amber-300"
                        />

                        <label className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-amber-500/40 text-amber-200 text-[11px] font-bold cursor-pointer flex items-center gap-1 shrink-0">
                          <Upload className="w-3 h-3" />
                          Trocar Imagem
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleReplaceSingleFloorImage(fm.id, e)}
                            className="hidden"
                          />
                        </label>

                        {placedMaps.length > 1 && (
                          <button
                            onClick={() => handleRemoveFloor(fm.id)}
                            className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-800"
                            title="Remover este Andar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Unlimited Size Control */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-zinc-300">
                          <span>Tamanho do Mapa (Sem Limite):</span>
                          <span className="font-mono text-amber-300 font-bold">
                            {Math.round(fm.width || 15)}x{Math.round(fm.height || 9)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={6}
                            max={80}
                            step={0.5}
                            value={fm.width || 15}
                            onChange={(e) =>
                              handleUpdateFloorField(fm.id, {
                                width: parseFloat(e.target.value),
                              })
                            }
                            className="flex-1 accent-amber-400"
                          />
                          <input
                            type="number"
                            min={4}
                            max={500}
                            value={fm.width || 15}
                            onChange={(e) =>
                              handleUpdateFloorField(fm.id, {
                                width: Math.max(4, Number(e.target.value) || 15),
                              })
                            }
                            className="w-16 px-2 py-0.5 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-100 text-center"
                          />
                        </div>
                      </div>

                      {/* Position X / Z Controls */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center justify-between bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px]">
                          <span className="text-zinc-400">Posição X:</span>
                          <input
                            type="number"
                            step={1}
                            value={fm.x || 0}
                            onChange={(e) =>
                              handleUpdateFloorField(fm.id, {
                                x: Number(e.target.value) || 0,
                              })
                            }
                            className="w-16 bg-transparent text-right font-mono font-bold text-zinc-100 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-between bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800 text-[11px]">
                          <span className="text-zinc-400">Posição Y:</span>
                          <input
                            type="number"
                            step={1}
                            value={fm.z || 0}
                            onChange={(e) =>
                              handleUpdateFloorField(fm.id, {
                                z: Number(e.target.value) || 0,
                              })
                            }
                            className="w-16 bg-transparent text-right font-mono font-bold text-zinc-100 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add Preset Floor Templates */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Adicionar Andar Pronto ao Lado:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {PRESET_MAP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleAddTemplateFloor(tpl)}
                      className="p-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 text-left transition flex flex-col justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-zinc-100">{tpl.name}</div>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{tpl.subtitle}</p>
                      </div>
                      <span className="text-[10px] font-bold text-amber-300">
                        ➕ Colocar ao Lado
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Universal Token Creator (Personagem ou Monstro pela Imagem!) */}
              <form
                onSubmit={handleCreateNewToken}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3.5"
              >
                <div>
                  <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4" />
                    Adicionar Novo Token (Personagem ou Monstro)
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Todo token funciona igual: basta escolher a imagem dele (personagem ou criatura) e arrastar pelo mapa!
                  </p>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Nome no Mapa:
                  </label>
                  <input
                    type="text"
                    value={newTokName}
                    onChange={(e) => setNewTokName(e.target.value)}
                    placeholder="Ex: Investigador, Monstro da Mansão, NPC..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Vida (PV Máx):
                    </label>
                    <input
                      type="number"
                      value={newTokHp}
                      onChange={(e) => setNewTokHp(Number(e.target.value) || 50)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Lanterna de Luz:
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewTokFlashlight(!newTokFlashlight)}
                      className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 ${
                        newTokFlashlight
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      {newTokFlashlight ? 'Com Lanterna' : 'Sem Lanterna'}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                    <span>Tamanho da Imagem no Mapa:</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {Number(newTokSize).toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={4.5}
                    step={0.05}
                    value={newTokSize}
                    onChange={(e) => setNewTokSize(parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 block">
                    Foto / PNG do Token (Aparece direto sem círculo/borda):
                  </label>
                  <div className="flex items-center gap-3">
                    {newTokAvatar && (
                      <img
                        src={newTokAvatar}
                        alt="Preview"
                        className="w-14 h-16 object-contain bg-zinc-950 rounded-lg p-1 border border-zinc-700 shrink-0"
                      />
                    )}
                    <label className="flex-1 py-2.5 px-3 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-dashed border-amber-500/50 text-xs font-bold text-amber-300 cursor-pointer flex items-center justify-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      Escolher Foto / PNG no Dispositivo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNewTokenFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition"
                >
                  ➕ Colocar Token no Mapa
                </button>
              </form>

              {/* Right Column: Existing Tokens on Map — Change Image, Size, HP or Delete */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-zinc-200">
                  Tokens Ativos no Mapa ({tokens.length}) — Mudar Visual ou Tamanho:
                </h3>
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {tokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={tok.avatar}
                            alt={tok.name}
                            className="w-12 h-12 object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
                          />
                          <div className="min-w-0">
                            <input
                              type="text"
                              value={tok.name}
                              onChange={(e) =>
                                setTokens((prev) =>
                                  prev.map((t) =>
                                    t.id === tok.id ? { ...t, name: e.target.value } : t
                                  )
                                )
                              }
                              className="text-xs font-bold text-zinc-100 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 w-full"
                            />
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                              <span>PV:</span>
                              <input
                                type="number"
                                value={tok.hp}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setTokens((prev) =>
                                    prev.map((t) =>
                                      t.id === tok.id ? { ...t, hp: val } : t
                                    )
                                  );
                                }}
                                className="w-12 px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-center"
                              />
                              <span>/</span>
                              <input
                                type="number"
                                value={tok.maxHp}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 1;
                                  setTokens((prev) =>
                                    prev.map((t) =>
                                      t.id === tok.id ? { ...t, maxHp: val } : t
                                    )
                                  );
                                }}
                                className="w-12 px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-center"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            Trocar Foto
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleExistingTokenImageUpload(tok.id, e)}
                              className="hidden"
                            />
                          </label>

                          <button
                            onClick={() =>
                              setTokens((prev) => prev.filter((t) => t.id !== tok.id))
                            }
                            className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-800"
                            title="Remover do Mapa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Token Size & Flashlight Toggle */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-zinc-800/80 text-[11px]">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-zinc-400 shrink-0">Tamanho:</span>
                          <input
                            type="range"
                            min={0.4}
                            max={4.5}
                            step={0.05}
                            value={tok.sizeSquares || 0.95}
                            onChange={(e) => {
                              const sz = parseFloat(e.target.value);
                              setTokens((prev) =>
                                prev.map((t) =>
                                  t.id === tok.id ? { ...t, sizeSquares: sz } : t
                                )
                              );
                            }}
                            className="flex-1 accent-amber-400"
                          />
                          <span className="font-mono text-amber-300 w-9 text-right">
                            {(tok.sizeSquares || 0.95).toFixed(1)}x
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setTokens((prev) =>
                              prev.map((t) =>
                                t.id === tok.id
                                  ? { ...t, flashlightOn: t.flashlightOn === false }
                                  : t
                              )
                            )
                          }
                          className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                            tok.flashlightOn !== false
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                          }`}
                        >
                          🔦 {tok.flashlightOn !== false ? 'Luz ON' : 'Luz OFF'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
