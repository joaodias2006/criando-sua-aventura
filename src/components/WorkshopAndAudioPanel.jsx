import React, { useState } from 'react';
import {
  Boxes,
  Flame,
  Eye,
  Volume2,
  VolumeX,
  FileSearch,
  Lock,
  Unlock,
  Paintbrush,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import { WORKSHOP_CATALOG, ELEMENT_THEMES } from '../data/ordoData';
import { soundEngine } from '../utils/soundEngine';

export default function WorkshopAndAudioPanel({
  role,
  fogMode,
  setFogMode,
  manualRoom2Revealed,
  setManualRoom2Revealed,
  doorLocked,
  setDoorLocked,
  onSpawnWorkshopItem,
  onTriggerRitualEffect,
  handouts,
  onInspectHandout,
}) {
  const [activeTab, setActiveTab] = useState('workshop'); // 'workshop' | 'fog_rituals' | 'audio' | 'clues'
  const [activeTrack, setActiveTrack] = useState(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const categories = ['Todos', 'Criaturas', 'Móveis 3D', 'Paranormal', 'Iluminação', 'Investigação'];
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

  return (
    <aside className="w-[310px] h-full bg-[#101014]/95 backdrop-blur-xl border-r border-zinc-800/90 flex flex-col z-20 select-none">
      {/* Left Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-zinc-950 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('workshop')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'workshop'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Workshop</span>
        </button>

        <button
          onClick={() => setActiveTab('fog_rituals')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'fog_rituals'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Flame className="w-4 h-4" />
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
          <FileSearch className="w-4 h-4" />
          <span>Pistas 3D</span>
        </button>

        <button
          onClick={() => setActiveTab('audio')}
          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold flex flex-col items-center gap-0.5 transition ${
            activeTab === 'audio'
              ? 'bg-zinc-800 text-amber-300 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Soundboard</span>
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* TAB 1: STEAM WORKSHOP ASSET SPAWNER */}
        {activeTab === 'workshop' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-amber-400" />
                Biblioteca / Workshop 3D
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Instancie criaturas paranormais, móveis, símbolos ocultistas e velas direto na mesa 3D.
              </p>
            </div>

            {/* Category Pills */}
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

            {/* Asset Cards */}
            <div className="space-y-2">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 flex items-center justify-between gap-2 transition"
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
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-amber-950/80 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Spawnar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: FOG OF WAR, DOOR LOCK & PARANORMAL RITUAL PARTICLES */}
        {activeTab === 'fog_rituals' && (
          <div className="space-y-4">
            {/* Paranormal Ritual Particle Emitters */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Efeitos de Rituais & Partículas 3D
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Dispare auras, sigilos no chão e vórtices de partículas dos 5 elementos no token ativo.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {Object.entries(ELEMENT_THEMES).map(([elKey, theme]) => (
                  <button
                    key={elKey}
                    onClick={() => onTriggerRitualEffect(elKey)}
                    className="p-2 rounded-lg border text-left flex items-center justify-between transition hover:scale-[1.01]"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    }}
                  >
                    <div>
                      <div className="text-xs font-bold" style={{ color: theme.accent }}>
                        ✨ Manifesto de {theme.name}
                      </div>
                      <div className="text-[10px] text-zinc-300 line-clamp-1">
                        {theme.quote}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/50 text-zinc-200">
                      Disparar
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fog of War & Door Controls */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-violet-400" />
                  Névoa de Guerra (Fog of War)
                </h3>
                <span className="text-[10px] font-mono text-amber-400">Raycasting 360°</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setFogMode('dynamic')}
                  className={`p-2 rounded-lg border text-xs font-bold transition ${
                    fogMode === 'dynamic'
                      ? 'bg-violet-950/80 border-violet-500 text-violet-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  🔦 Visão Dinâmica (LoS)
                </button>
                <button
                  onClick={() => setFogMode('reveal_all')}
                  className={`p-2 rounded-lg border text-xs font-bold transition ${
                    fogMode === 'reveal_all'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  ☀️ Revelar Tudo
                </button>
              </div>

              {role === 'gm' && (
                <>
                  <div className="text-[10px] font-mono uppercase text-zinc-400 pt-1">
                    Ferramentas Manuais do Mestre (GM):
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() =>
                        setFogMode(fogMode === 'brush_reveal' ? 'dynamic' : 'brush_reveal')
                      }
                      className={`p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                        fogMode === 'brush_reveal'
                          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Pincel Revelar
                    </button>
                    <button
                      onClick={() =>
                        setFogMode(fogMode === 'brush_hide' ? 'dynamic' : 'brush_hide')
                      }
                      className={`p-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 transition ${
                        fogMode === 'brush_hide'
                          ? 'bg-red-950/90 border-red-400 text-red-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <Paintbrush className="w-3.5 h-3.5" />
                      Pincel Ocultar
                    </button>
                  </div>

                  <button
                    onClick={() => setManualRoom2Revealed(!manualRoom2Revealed)}
                    className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-semibold text-zinc-200 transition"
                  >
                    {manualRoom2Revealed
                      ? '🌑 Ocultar Sala 2 (Voltar para Sombra Preta)'
                      : '🌕 Revelar Sala 2 Inteira Manualmente'}
                  </button>

                  <button
                    onClick={() => {
                      setDoorLocked(!doorLocked);
                      soundEngine.playSFX('door_locked');
                    }}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      doorLocked
                        ? 'bg-red-950/80 border-red-500/60 text-red-200'
                        : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                    }`}
                  >
                    {doorLocked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" /> Porta Central: TRANCADA (Destrancar)
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" /> Porta Central: DESTRANCADA (Trancar)
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INSPECTABLE 3D HANDOUTS & CLUES */}
        {activeTab === 'clues' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                <FileSearch className="w-3.5 h-3.5 text-amber-400" />
                Documentos & Pistas 3D na Cena
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Passe a mãozinha sobre os objetos brilhantes nas mesas e aperte{' '}
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px]">
                  ESPAÇO
                </kbd>{' '}
                ou inspecione abaixo:
              </p>
            </div>

            <div className="space-y-2">
              {handouts.map((h) => {
                const isSecretRoom = h.room === 2 && role !== 'gm' && !manualRoom2Revealed && !h.revealedToAll;
                return (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-zinc-100">
                          {isSecretRoom ? '❓ Pista Oculta na Escuridão (Sala 2)' : h.title}
                        </span>
                        <p className="text-[10px] text-zinc-400">{h.subtitle}</p>
                      </div>
                      {h.revealedToAll && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Compartilhada
                        </span>
                      )}
                    </div>

                    <button
                      disabled={isSecretRoom}
                      onClick={() => onInspectHandout(h)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold border transition ${
                        isSecretRoom
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-600 cursor-not-allowed'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
                      }`}
                    >
                      {isSecretRoom
                        ? 'Abra a porta para iluminar a Sala 2 primeiro'
                        : '🔍 Inspecionar em 3D (Frente & Verso)'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MASTER AUDIO MIXER & SOUNDBOARD */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  Trilhas de Clima & Tensão
                </h3>
                <button
                  onClick={handleMute}
                  className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                >
                  {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 text-[11px]">Volume:</span>
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
                  { id: 'investigacao', label: '🕵️ Investigação Noir (Sub-Drone)', desc: 'Grave tenso contínuo para exploração' },
                  { id: 'membrana', label: '👁️ Membrana Fragilizada', desc: 'Acorde dissonante do Outro Lado' },
                  { id: 'combate', label: '⚔️ Combate Paranormal (132 BPM)', desc: 'Pulso agressivo industrial' },
                  { id: 'chuva', label: '🌧️ Chuva Noturna na Mansão', desc: 'Ruído acústico de tempestade' },
                ].map((tr) => {
                  const isPlaying = activeTrack === tr.id;
                  return (
                    <button
                      key={tr.id}
                      onClick={() => handleToggleTrack(tr.id)}
                      className={`w-full p-2 rounded-lg border text-left transition flex items-center justify-between ${
                        isPlaying
                          ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{tr.label}</div>
                        <div className="text-[10px] text-zinc-400">{tr.desc}</div>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/50">
                        {isPlaying ? '⏹ PARAR' : '▶ TOCAR'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instant Soundboard SFX */}
            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                🔊 Soundboard Instantâneo (SFX)
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'door_knock', label: '🚪 Batida na Porta' },
                  { id: 'door_creak', label: '🗝️ Porta Rangendo' },
                  { id: 'glass_break', label: '🪟 Vidro Quebrando' },
                  { id: 'whispers', label: '👻 Sussurros' },
                  { id: 'heartbeat', label: '💓 Batimento Cardíaco' },
                  { id: 'door_locked', label: '🔒 Tranca Metálica' },
                  { id: 'ritual', label: '✨ Pulso de Ritual' },
                  { id: 'dice_roll', label: '🎲 Dados na Mesa' },
                ].map((sfx) => (
                  <button
                    key={sfx.id}
                    onClick={() => soundEngine.playSFX(sfx.id)}
                    className="p-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-zinc-800 hover:border-red-500/50 text-xs font-semibold text-zinc-200 text-left transition"
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
