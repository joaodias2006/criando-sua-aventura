import React, { useState } from 'react';
import {
  Boxes,
  Flame,
  Eye,
  Volume2,
  VolumeX,
  FileSearch,
  Paintbrush,
  Sparkles,
  PlusCircle,
  Upload,
  Map,
  UserPlus,
  X,
} from 'lucide-react';
import { WORKSHOP_CATALOG, ELEMENT_THEMES } from '../data/ordoData';
import { soundEngine } from '../utils/soundEngine';

export default function WorkshopAndAudioPanel({
  isOpen,
  onClose,
  role,
  fogMode,
  setFogMode,
  manualRoom2Revealed,
  setManualRoom2Revealed,
  onSpawnWorkshopItem,
  onSpawnImageProp,
  onTriggerRitualEffect,
  handouts,
  onInspectHandout,
  onOpenMapModal,
  onOpenTokenModal,
}) {
  const [activeTab, setActiveTab] = useState('workshop');
  const [activeTrack, setActiveTrack] = useState(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  if (!isOpen) return null;

  const categories = ['Todos', 'Móveis & Cenário', 'Paranormal', 'Iluminação', 'Investigação'];
  const filteredCatalog =
    selectedCategory === 'Todos'
      ? WORKSHOP_CATALOG
      : WORKSHOP_CATALOG.filter((item) => item.category === selectedCategory);

  const handleToggleTrack = (trackId) => {
    const nowPlaying = soundEngine.playAmbient(trackId);
    setActiveTrack(nowPlaying);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val);
  };

  const handleMute = () => {
    const m = soundEngine.toggleMute();
    setMuted(m);
  };

  const handlePropImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        onSpawnImageProp(file.name.replace(/\.[^/.]+$/, ''), ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-full sm:w-[340px] bg-[#0b0b0f]/98 backdrop-blur-2xl border-r border-zinc-800 shadow-2xl flex flex-col select-none animate-fadeIn">
      {/* Header with Close Button */}
      <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Boxes className="w-4 h-4 text-amber-400" />
          <span className="font-serif text-xs font-extrabold uppercase tracking-wider text-zinc-100">
            Menu do Mestre & Cenário
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 text-zinc-300 hover:text-white border border-zinc-800"
          title="Fechar Menu e ver o Mapa"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-zinc-950/70 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('workshop')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'workshop'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Cenário</span>
        </button>

        <button
          onClick={() => setActiveTab('fog_rituals')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'fog_rituals'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Luz & Rituais</span>
        </button>

        <button
          onClick={() => setActiveTab('clues')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'clues'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileSearch className="w-3.5 h-3.5" />
          <span>Pistas</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'audio'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Áudio</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {activeTab === 'workshop' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-amber-500/40 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Mapas & Imagens Customizadas
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenMapModal();
                }}
                className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Map className="w-3.5 h-3.5" />
                🗺️ Subir Meu Mapa ou Trocar Cenário
              </button>

              <button
                onClick={() => {
                  onClose();
                  onOpenTokenModal();
                }}
                className="w-full py-2 px-3 rounded-lg bg-red-950/70 hover:bg-red-900/80 border border-red-500/50 text-red-100 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                🖼️ Gerenciar Tokens (Fotos Sem Borda)
              </button>

              <label className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                🪑 Subir Imagem de Objeto / Móvel
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePropImageUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-bold text-zinc-100 truncate">
                        {item.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                      {item.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => onSpawnWorkshopItem(item)}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Colocar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'fog_rituals' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-violet-400" />
                Iluminação & Lanterna
              </h3>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setFogMode('reveal_all')}
                  className={`p-2 rounded-lg border text-xs font-bold transition ${
                    fogMode === 'reveal_all'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  ☀️ Mapa Claro
                </button>
                <button
                  onClick={() => setFogMode('dynamic')}
                  className={`p-2 rounded-lg border text-xs font-bold transition ${
                    fogMode === 'dynamic'
                      ? 'bg-violet-950/80 border-violet-500 text-violet-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  🔦 Só Lanterna
                </button>
              </div>

              {role === 'gm' && (
                <>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() =>
                        setFogMode(fogMode === 'brush_reveal' ? 'dynamic' : 'brush_reveal')
                      }
                      className={`p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${
                        fogMode === 'brush_reveal'
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Pintar Luz
                    </button>
                    <button
                      onClick={() =>
                        setFogMode(fogMode === 'brush_hide' ? 'dynamic' : 'brush_hide')
                      }
                      className={`p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 ${
                        fogMode === 'brush_hide'
                          ? 'bg-red-950/90 border-red-400 text-red-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Pintar Sombra
                    </button>
                  </div>

                  <button
                    onClick={() => setManualRoom2Revealed(!manualRoom2Revealed)}
                    className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200"
                  >
                    {manualRoom2Revealed
                      ? '🌑 Cobrir Sala Leste com Sombra'
                      : '🌕 Revelar Sala Leste Inteira'}
                  </button>
                </>
              )}
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Efeitos de Rituais no Mapa
              </h3>
              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(ELEMENT_THEMES).map(([elKey, theme]) => (
                  <button
                    key={elKey}
                    onClick={() => onTriggerRitualEffect(elKey)}
                    className="p-2 rounded-lg border text-left flex items-center justify-between"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    }}
                  >
                    <span className="text-xs font-bold" style={{ color: theme.accent }}>
                      ✨ Símbolo de {theme.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/50 text-zinc-200">
                      Ativar
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clues' && (
          <div className="space-y-2.5">
            {handouts.map((h) => (
              <div
                key={h.id}
                className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5"
              >
                <div className="text-xs font-bold text-zinc-100">{h.title}</div>
                <p className="text-[10px] text-zinc-400">{h.subtitle}</p>
                <button
                  onClick={() => {
                    onClose();
                    onInspectHandout(h);
                  }}
                  className="w-full py-1.5 rounded-lg text-xs font-bold border bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300"
                >
                  🔍 Inspecionar (Frente & Verso)
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-zinc-200">
                  Trilhas de Fundo
                </h3>
                <button
                  onClick={handleMute}
                  className="p-1 rounded bg-zinc-900 text-zinc-300"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="flex-1 accent-amber-500"
                />
                <span className="font-mono text-[11px] text-zinc-300">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              <div className="space-y-1.5">
                {[
                  { id: 'investigacao', label: '🕵️ Investigação em Carpazinha' },
                  { id: 'membrana', label: '🌀 Hipnose de Santo Berço' },
                  { id: 'combate', label: '⚔️ Combate contra O Carente' },
                  { id: 'chuva', label: '🌧️ Chuva & Vento na Floresta' },
                ].map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => handleToggleTrack(tr.id)}
                    className={`w-full p-2 rounded-lg border text-left text-xs font-bold flex items-center justify-between ${
                      activeTrack === tr.id
                        ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                    }`}
                  >
                    <span>{tr.label}</span>
                    <span className="text-[10px] font-mono">
                      {activeTrack === tr.id ? '⏹' : '▶'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
              <h3 className="text-xs font-bold uppercase text-zinc-200">
                🔊 Efeitos Sonoros (SFX)
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'door_knock', label: '🚪 Batida Porta' },
                  { id: 'door_creak', label: '🗝️ Rangido' },
                  { id: 'glass_break', label: '🪟 Vidro' },
                  { id: 'whispers', label: '👻 Sussurros' },
                  { id: 'heartbeat', label: '💓 Coração' },
                  { id: 'dice_roll', label: '🎲 Dados' },
                ].map((sfx) => (
                  <button
                    key={sfx.id}
                    onClick={() => soundEngine.playSFX(sfx.id)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 text-xs font-semibold text-zinc-200 text-left"
                  >
                    {sfx.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
