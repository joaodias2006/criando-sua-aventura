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
import { PRESET_MAPS, makeAvatarSvg } from '../data/ordoData';

export default function MapAndTokenManagerModal({
  initialTab = 'map', // 'map' | 'tokens'
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

  // New Token creation state
  const [newTokName, setNewTokName] = useState('');
  const [newTokType, setNewTokType] = useState('player'); // 'player' | 'monster'
  const [newTokElement, setNewTokElement] = useState('Sangue');
  const [newTokColor, setNewTokColor] = useState('#f59e0b');
  const [newTokHp, setNewTokHp] = useState(65);
  const [newTokSize, setNewTokSize] = useState(1);
  const [newTokAvatar, setNewTokAvatar] = useState('');

  // Handle local PC file upload for Map Background
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
          subtitle: 'Mapa Importado do Computador',
          theme: 'custom_image',
          bgImageUrl: dataUrl,
          gridEnabled: true,
          gridOpacity: 0.16,
          walls: clearWallsOnUpload ? [] : currentMap.walls,
          doors: clearWallsOnUpload ? [] : currentMap.doors,
        });
        onNotification(`🗺️ Mapa "${file.name}" carregado na mesa com sucesso!`);
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

  // Handle local PC file upload for an existing Token's portrait
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
        onNotification('🖼️ Imagem do Token atualizada!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle local PC file upload for the New Token form
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
    const fallbackAvatar = makeAvatarSvg(
      finalName.slice(0, 6).toUpperCase(),
      '#18181b',
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
      sizeSquares: Number(newTokSize) || 1,
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
    onNotification(`🖼️ Token "${finalName}" colocado na mesa!`);
    setNewTokName('');
    setNewTokAvatar('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header & Tabs */}
        <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('map')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                tab === 'map'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Map className="w-4 h-4" />
              1. Mapas & Cenários (Subir Imagem ou Presets)
            </button>

            <button
              onClick={() => setTab('tokens')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                tab === 'tokens'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Users className="w-4 h-4" />
              2. Tokens & Personagens (Imagens Customizadas)
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {tab === 'map' ? (
            <>
              {/* Upload Custom Map from Computer */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-amber-500/40 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Trazer Qualquer Mapa ou Ambiente do seu Computador
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      Envie qualquer imagem (PNG, JPG, WEBP) de mapa que você criou ou baixou para
                      jogar exatamente como em <em>O Segredo na Floresta</em>.
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
                  {/* File Input Dropzone */}
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 cursor-pointer transition text-center">
                    <Upload className="w-6 h-6 text-amber-400 mb-1.5" />
                    <span className="text-xs font-bold text-zinc-100">
                      Clique para Escolher Imagem do Mapa no PC
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      Suporta PNG, JPG, WEBP, GIF (qualquer resolução)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleMapFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Or Paste Image URL */}
                  <form onSubmit={handleApplyMapUrl} className="flex flex-col justify-between gap-2 bg-zinc-950/80 p-3.5 rounded-xl border border-zinc-800">
                    <span className="text-xs font-bold text-zinc-200">
                      Ou cole o Link (URL) de um Mapa da Internet:
                    </span>
                    <input
                      type="text"
                      value={customMapUrl}
                      onChange={(e) => setCustomMapUrl(e.target.value)}
                      placeholder="https://exemplo.com/meu-mapa-floresta.jpg"
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

                {/* Quick Button to Clear All Walls/Doors on Current Map */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
                  <span className="text-zinc-400">
                    Dica: No <strong>Modo Mestre</strong>, você pode desenhar novas paredes (
                    <code>+ Parede</code>) e portas (<code>+ Porta</code>) em qualquer lugar do seu
                    mapa!
                  </span>
                  <button
                    onClick={() => {
                      onSelectOrUpdateMap({ ...currentMap, walls: [], doors: [] });
                      onNotification('🧹 Todas as paredes e portas foram removidas deste mapa!');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-zinc-950 hover:bg-red-950/70 text-red-300 border border-red-500/40 font-semibold flex items-center gap-1 shrink-0"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Deixar Mapa Atual 100% Livre (Sem Paredes)
                  </button>
                </div>
              </div>

              {/* Preset Maps from "O Segredo na Floresta" */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Cenários Prontos de "O Segredo na Floresta" (Clique para Carregar):
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {PRESET_MAPS.map((pm) => {
                    const isCurrent = currentMap.id === pm.id;
                    return (
                      <div
                        key={pm.id}
                        onClick={() => {
                          onSelectOrUpdateMap(pm);
                          onNotification(`🗺️ Cenário "${pm.name}" carregado na mesa!`);
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
                          Usar Mapa
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* TAB 2: TOKENS & CHARACTERS IMAGE MANAGER */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Create New Token with Custom Image */}
              <form
                onSubmit={handleCreateNewToken}
                className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3"
              >
                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4" />
                  Criar Novo Token com Imagem na Mesa
                </h3>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Nome do Personagem / Criatura:
                  </label>
                  <input
                    type="text"
                    value={newTokName}
                    onChange={(e) => setNewTokName(e.target.value)}
                    placeholder="Ex: Cristopher Cohen, Thiago Fritz, Carniçal..."
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
                      <option value="player">Agente / Jogador (Com Lanterna)</option>
                      <option value="monster">Criatura / NPC (Mestre)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Tamanho na Grade:
                    </label>
                    <select
                      value={newTokSize}
                      onChange={(e) => setNewTokSize(Number(e.target.value))}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value={1}>1x1 (Médio - 1,5m)</option>
                      <option value={1.4}>1.5x1.5 (Grande)</option>
                      <option value={2}>2x2 (Enorme - 3m)</option>
                      <option value={2.6}>3x3 (Colossal - 4,5m)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Elemento:</label>
                    <select
                      value={newTokElement}
                      onChange={(e) => setNewTokElement(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    >
                      <option value="Sangue">Sangue</option>
                      <option value="Morte">Morte</option>
                      <option value="Conhecimento">Conhecimento</option>
                      <option value="Energia">Energia</option>
                      <option value="Medo">Medo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">PV Máximo:</label>
                    <input
                      type="number"
                      value={newTokHp}
                      onChange={(e) => setNewTokHp(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">Cor da Borda:</label>
                    <input
                      type="color"
                      value={newTokColor}
                      onChange={(e) => setNewTokColor(e.target.value)}
                      className="w-full h-8 rounded bg-zinc-950 border border-zinc-800 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Upload Token Image */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 block">
                    Imagem / Foto do Token (Upload do PC ou URL):
                  </label>
                  <div className="flex items-center gap-3">
                    {newTokAvatar && (
                      <img
                        src={newTokAvatar}
                        alt="Preview"
                        className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0"
                      />
                    )}
                    <label className="flex-1 py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-dashed border-amber-500/50 text-xs font-bold text-amber-300 cursor-pointer flex items-center justify-center gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      Escolher Foto do Token no PC
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleNewTokenFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={newTokAvatar}
                    onChange={(e) => setNewTokAvatar(e.target.value)}
                    placeholder="Ou cole o link (URL) da imagem do personagem..."
                    className="w-full px-2.5 py-1 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition"
                >
                  ➕ Adicionar Token à Mesa
                </button>
              </form>

              {/* Right Column: Existing Tokens on the Table (Change Photo / Size / Delete) */}
              <div className="space-y-2.5">
                <h3 className="text-sm font-bold text-zinc-200">
                  Tokens Ativos na Mesa ({tokens.length}) — Trocar Foto ou Tamanho:
                </h3>
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {tokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={tok.avatar}
                          alt={tok.name}
                          className="w-11 h-11 rounded-full object-cover border-2 shrink-0 bg-zinc-950"
                          style={{ borderColor: tok.ringColor || '#f59e0b' }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-100 truncate">
                            {tok.name}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            PV: {tok.hp}/{tok.maxHp} • Escala: {tok.sizeSquares || 1}x
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Change Image Button */}
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

                        {/* Remove Token */}
                        <button
                          onClick={() =>
                            setTokens((prev) => prev.filter((t) => t.id !== tok.id))
                          }
                          className="p-1.5 rounded-lg bg-zinc-950 hover:bg-red-950 text-zinc-400 hover:text-red-300 border border-zinc-800"
                          title="Remover Token da Mesa"
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
