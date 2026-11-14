import React, { useState } from 'react';
import {
  X,
  Upload,
  Map,
  Users,
  Trash2,
  PlusCircle,
  CheckCircle2,
  Image as ImageIcon,
  Eraser,
} from 'lucide-react';
import { PRESET_MAPS, makeCharacterCutoutSvg } from '../data/ordoData';

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
  const [customMapName, setCustomMapName] = useState('Meu Mapa Customizado');
  const [clearWallsOnUpload, setClearWallsOnUpload] = useState(true);

  const [newTokName, setNewTokName] = useState('');
  const [newTokType, setNewTokType] = useState('player');
  const [newTokElement, setNewTokElement] = useState('Sangue');
  const [newTokColor, setNewTokColor] = useState('#f59e0b');
  const [newTokHp, setNewTokHp] = useState(65);
  const [newTokSize, setNewTokSize] = useState(1.15);
  const [newTokAvatar, setNewTokAvatar] = useState('');

  const handleMapFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        onSelectOrUpdateMap({
          id: `custom_${Date.now()}`,
          name: file.name.replace(/\.[^/.]+$/, '') || customMapName,
          subtitle: 'Mapa Importado do Dispositivo',
          theme: 'custom_image',
          bgImageUrl: dataUrl,
          gridEnabled: true,
          gridOpacity: 0.16,
          walls: clearWallsOnUpload ? [] : currentMap.walls,
          doors: clearWallsOnUpload ? [] : currentMap.doors,
        });
        onNotification(`🗺️ Mapa "${file.name}" carregado na mesa!`);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyMapUrl = (e) => {
    e.preventDefault();
    if (!customMapUrl.trim()) return;
    onSelectOrUpdateMap({
      id: `custom_url_${Date.now()}`,
      name: customMapName || 'Mapa via URL',
      subtitle: 'Mapa Importado via Link',
      theme: 'custom_image',
      bgImageUrl: customMapUrl.trim(),
      gridEnabled: true,
      gridOpacity: 0.16,
      walls: clearWallsOnUpload ? [] : currentMap.walls,
      doors: clearWallsOnUpload ? [] : currentMap.doors,
    });
    onNotification('🗺️ Mapa via URL aplicado na mesa!');
    onClose();
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
        onNotification('🖼️ Imagem do personagem atualizada (sem círculo/borda)!');
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
    const finalName = newTokName.trim() || 'Novo Personagem';
    const fallbackAvatar = makeCharacterCutoutSvg(
      finalName.slice(0, 6).toUpperCase(),
      newTokColor,
      newTokType === 'monster' ? 'monster' : 'agent'
    );

    const newTok = {
      id: `tok_${Date.now()}`,
      name: finalName,
      subtitle: newTokType === 'player' ? 'Agente na Mesa' : 'Criatura / NPC',
      type: newTokType,
      owner: newTokType === 'player' ? 'arthur' : 'gm',
      element: newTokElement,
      color: newTokColor,
      ringColor: newTokColor,
      avatar: newTokAvatar || fallbackAvatar,
      sizeSquares: Number(newTokSize) || 1.15,
      x: -1.5 + (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
      rotation: 0,
      hp: Number(newTokHp) || 50,
      maxHp: Number(newTokHp) || 50,
      san: newTokType === 'player' ? 50 : 0,
      maxSan: newTokType === 'player' ? 50 : 0,
      pe: newTokType === 'player' ? 30 : 0,
      maxPe: newTokType === 'player' ? 30 : 0,
      conditions: [],
      flashlightOn: newTokType === 'player',
    };

    setTokens((prev) => [...prev, newTok]);
    onNotification(`🖼️ Personagem "${finalName}" colocado no mapa (sem borda circular)!`);
    setNewTokName('');
    setNewTokAvatar('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 select-none">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
              1. Mapas & Cenários
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
              2. Personagens no Mapa (Sem Borda Circular)
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
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-amber-500/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Subir Qualquer Mapa do Celular ou PC
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Envie qualquer imagem (PNG, JPG, WEBP) para usar como cenário da sua sessão.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                    <input
                      type="checkbox"
                      checked={clearWallsOnUpload}
                      onChange={(e) => setClearWallsOnUpload(e.target.checked)}
                      className="accent-amber-500"
                    />
                    <span>Vir com mapa limpo (sem paredes antigas)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 cursor-pointer transition text-center">
                    <Upload className="w-6 h-6 text-amber-400 mb-1.5" />
                    <span className="text-xs font-bold text-zinc-100">
                      Escolher Imagem do Mapa no Dispositivo
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      Suporta PNG, JPG, WEBP, GIF
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
                      Ou cole o Link (URL) de um Mapa:
                    </span>
                    <input
                      type="text"
                      value={customMapUrl}
                      onChange={(e) => setCustomMapUrl(e.target.value)}
                      placeholder="https://exemplo.com/meu-mapa.jpg"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                    />
                    <button
                      type="submit"
                      className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs transition"
                    >
                      Carregar Mapa por URL
                    </button>
                  </form>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
                  <button
                    onClick={() => {
                      onSelectOrUpdateMap({ ...currentMap, walls: [], doors: [] });
                      onNotification('🧹 Paredes e portas removidas deste mapa!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-red-950/70 text-red-300 border border-red-500/40 font-semibold flex items-center gap-1"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Deixar Mapa Atual 100% Livre (Sem Paredes)
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Cenários Prontos de "O Segredo na Floresta":
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_MAPS.map((pm) => {
                    const isCurrent = currentMap.id === pm.id;
                    return (
                      <div
                        key={pm.id}
                        onClick={() => {
                          onSelectOrUpdateMap(pm);
                          onNotification(`🗺️ Cenário "${pm.name}" carregado!`);
                          onClose();
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                          isCurrent
                            ? 'bg-amber-950/40 border-amber-400 shadow-lg'
                            : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                            <span>{pm.name}</span>
                            {isCurrent && (
                              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1">{pm.subtitle}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-zinc-950 text-amber-300 text-[10px] font-bold border border-zinc-800 shrink-0">
                          Usar
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Add Frameless Character / Monster */}
              <form
                onSubmit={handleCreateNewToken}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4" />
                  Adicionar Personagem no Mapa (Sem Círculo/Borda)
                </h3>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Nome do Personagem / Criatura:
                  </label>
                  <input
                    type="text"
                    value={newTokName}
                    onChange={(e) => setNewTokName(e.target.value)}
                    placeholder="Ex: Meu Agente, Carniçal..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Tipo:</label>
                    <select
                      value={newTokType}
                      onChange={(e) => setNewTokType(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="player">Personagem (Com Lanterna)</option>
                      <option value="monster">Criatura / NPC (Mestre)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Tamanho no Mapa:
                    </label>
                    <select
                      value={newTokSize}
                      onChange={(e) => setNewTokSize(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value={1.15}>Padrão (1x1)</option>
                      <option value={1.5}>Grande (1.5x1.5)</option>
                      <option value={2.0}>Enorme (2x2)</option>
                      <option value={2.6}>Colossal (3x3)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 block">
                    Imagem / PNG Transparente do Personagem (Aparece direto sem borda):
                  </label>
                  <div className="flex items-center gap-3">
                    {newTokAvatar && (
                      <img
                        src={newTokAvatar}
                        alt="Preview"
                        className="w-12 h-14 object-contain bg-zinc-950 rounded p-1 border border-zinc-700 shrink-0"
                      />
                    )}
                    <label className="flex-1 py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-dashed border-amber-500/50 text-xs font-bold text-amber-300 cursor-pointer flex items-center justify-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      Subir Imagem / PNG do Personagem
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
                  className="w-full py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition"
                >
                  ➕ Colocar Personagem no Mapa
                </button>
              </form>

              {/* Right Column: Existing Tokens on Map */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-zinc-200">
                  Personagens no Mapa ({tokens.length}) — Trocar Foto ou Excluir:
                </h3>
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {tokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={tok.avatar}
                          alt={tok.name}
                          className="w-11 h-12 object-contain shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-100 truncate">
                            {tok.name}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            PV: {tok.hp}/{tok.maxHp}
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
