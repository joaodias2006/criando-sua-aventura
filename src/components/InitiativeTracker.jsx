import React, { useState } from 'react';
import {
  Crown,
  User,
  Swords,
  ChevronRight,
  Ruler,
  Hand,
  Sparkles,
  Tag,
} from 'lucide-react';
import { OFFICIAL_CONDITIONS } from '../data/ordoData';

export default function InitiativeTracker({
  role,
  setRole,
  tokens,
  selectedTokenId,
  setSelectedTokenId,
  turnIndex,
  setTurnIndex,
  round,
  setRound,
  onToggleCondition,
  rulerForcedOn,
  setRulerForcedOn,
  showTeamCursors,
  setShowTeamCursors,
}) {
  const [showConditionMenu, setShowConditionMenu] = useState(false);

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) || tokens[0];

  const handleNextTurn = () => {
    if (tokens.length === 0) return;
    const nextIdx = (turnIndex + 1) % tokens.length;
    if (nextIdx === 0) setRound((r) => r + 1);
    setTurnIndex(nextIdx);
    setSelectedTokenId(tokens[nextIdx].id);
  };

  return (
    <header className="h-14 w-full bg-[#0d0d11]/95 backdrop-blur-xl border-b border-zinc-800/90 px-4 flex items-center justify-between gap-3 z-30 select-none">
      {/* Left: Brand & Permission Mode Switcher (Modo Mestre vs Visão do Jogador) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-700 to-red-950 border border-red-500/60 flex items-center justify-center shadow-lg">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h1 className="font-serif text-sm font-extrabold tracking-wider text-zinc-100 leading-none">
              ORDO REALITAS <span className="text-red-500">VTT</span>
            </h1>
            <span className="text-[10px] font-mono text-emerald-400">
              O Segredo na Floresta • 60 FPS Fluido
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-zinc-800" />

        {/* Permission Switcher */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setRole('gm')}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
              role === 'gm'
                ? 'bg-red-900/90 text-red-100 border border-red-500/60 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Modo Mestre: Pode alterar tudo! Subir mapas, criar/mover qualquer token, desenhar paredes, colocar portas e controlar a névoa."
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            👑 Modo Mestre (Alterar Tudo)
          </button>

          <button
            onClick={() => {
              setRole('arthur');
              setSelectedTokenId('arthur');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
              role === 'arthur'
                ? 'bg-amber-900/80 text-amber-100 border border-amber-500/60 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Visão do Jogador: Só move o próprio personagem e enxerga o que a lanterna ilumina"
          >
            <User className="w-3.5 h-3.5 text-amber-400" />
            Visão Jogador (Arthur)
          </button>

          <button
            onClick={() => {
              setRole('joui');
              setSelectedTokenId('joui');
            }}
            className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition ${
              role === 'joui'
                ? 'bg-red-900/80 text-red-100 border border-red-500/60 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Visão do Jogador: Joui Jouki"
          >
            <User className="w-3.5 h-3.5 text-red-400" />
            Joui
          </button>
        </div>
      </div>

      {/* Center: Combat Initiative Tracker Queue */}
      <div className="hidden lg:flex items-center gap-2 bg-zinc-950/90 px-3 py-1 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 pr-2 border-r border-zinc-800">
          <Swords className="w-3.5 h-3.5" />
          <span className="font-mono">RODADA {round}</span>
        </div>

        <div className="flex items-center gap-1.5 max-w-[340px] overflow-x-auto">
          {tokens.map((tok, idx) => {
            const isCurrentTurn = idx === turnIndex;
            return (
              <button
                key={tok.id}
                onClick={() => setSelectedTokenId(tok.id)}
                className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition ${
                  isCurrentTurn
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-sm'
                    : selectedTokenId === tok.id
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: tok.ringColor || '#f59e0b' }}
                />
                <span>{tok.name.split(' ')[0]}</span>
                {tok.conditions?.length > 0 && (
                  <span className="px-1 rounded bg-red-900/90 text-[9px] text-red-200 font-mono">
                    {tok.conditions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNextTurn}
          className="ml-1 px-2.5 py-1 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 border border-red-500/50 text-xs font-bold flex items-center gap-1 transition"
          title="Avançar para o próximo turno da Iniciativa"
        >
          Turno
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Conditions Dropdown for Selected Token */}
        <div className="relative">
          <button
            onClick={() => setShowConditionMenu(!showConditionMenu)}
            className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1"
          >
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Condições
          </button>

          {showConditionMenu && selectedToken && (
            <div className="absolute right-0 mt-2 w-64 bg-zinc-950 border border-zinc-700 rounded-xl shadow-2xl p-2.5 z-50 space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-zinc-400 px-1 pb-1 border-b border-zinc-800">
                Aplicar em: <strong className="text-zinc-100">{selectedToken.name}</strong>
              </div>
              {OFFICIAL_CONDITIONS.map((cond) => {
                const active = selectedToken.conditions?.includes(cond.id);
                return (
                  <button
                    key={cond.id}
                    onClick={() => onToggleCondition(selectedToken.id, cond.id)}
                    className={`w-full text-left p-1.5 rounded-lg border text-xs flex flex-col transition ${
                      active
                        ? 'bg-red-950/70 border-red-500/60 text-red-200'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{cond.label}</span>
                      <span className="text-[10px] font-mono">
                        {active ? 'ATIVO ✓' : '+ Aplicar'}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 leading-tight mt-0.5">
                      {cond.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Tactical Ruler Toggle (1.5m/sq) & Hand Cursors Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setRulerForcedOn(!rulerForcedOn)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
            rulerForcedOn
              ? 'bg-amber-950/80 border-amber-400 text-amber-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
          }`}
          title="Medir distância ao arrastar tokens (ou segure TAB / ALT)"
        >
          <Ruler className="w-3.5 h-3.5 text-amber-400" />
          Régua 1,5m {rulerForcedOn ? 'ON' : '(Tab/Alt)'}
        </button>

        <button
          onClick={() => setShowTeamCursors(!showTeamCursors)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
            showTeamCursors
              ? 'bg-purple-950/80 border-purple-500/60 text-purple-200'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
          }`}
          title="Exibir cursores 'Mãozinhas' dos outros jogadores na mesa"
        >
          <Hand className="w-3.5 h-3.5 text-purple-400" />
          Mãozinhas
        </button>
      </div>
    </header>
  );
}
