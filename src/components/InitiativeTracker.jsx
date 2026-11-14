import React, { useState } from 'react';
import {
  Crown,
  User,
  Swords,
  ChevronRight,
  Ruler,
  Tag,
  Menu,
  FileText,
  ChevronDown,
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
  onToggleLeftDrawer,
  onToggleRightSheet,
  activeCharacter,
}) {
  const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false);
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
    <header className="h-12 w-full bg-[#0b0b0f]/95 backdrop-blur-xl border-b border-zinc-800/90 px-2.5 sm:px-4 flex items-center justify-between gap-2 z-30 select-none">
      {/* Left: Open Scenario/Master Menu Button + Compact Mode Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onToggleLeftDrawer}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-100 flex items-center gap-1.5 transition"
          title="Abrir Menu de Mapas, Cenário, Luz e Áudio"
        >
          <Menu className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Menu & Cenário</span>
        </button>

        {/* Compact Role Selector (Modo Mestre vs Jogador) */}
        <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
          <button
            onClick={() => setRole('gm')}
            className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
              role === 'gm'
                ? 'bg-red-900/90 text-red-100 border border-red-500/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Modo Mestre: Alterar tudo"
          >
            <Crown className="w-3 h-3 text-amber-400" />
            <span>Mestre</span>
          </button>

          <button
            onClick={() => {
              const firstPlayer = tokens.find((t) => t.type === 'player');
              const targetId = firstPlayer?.id || 'arthur';
              setRole(targetId);
              setSelectedTokenId(targetId);
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition ${
              role !== 'gm'
                ? 'bg-amber-900/80 text-amber-100 border border-amber-500/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Visão do Jogador: Enxerga apenas o feixe da Lanterna"
          >
            <User className="w-3 h-3 text-amber-400" />
            <span>Jogador</span>
          </button>
        </div>
      </div>

      {/* Center: Collapsible Initiative & Turn Queue Pill (Click to open) */}
      <div className="relative">
        <button
          onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-200 flex items-center gap-1.5"
        >
          <Swords className="w-3.5 h-3.5 text-red-400" />
          <span className="font-mono text-[11px]">R{round}</span>
          <span className="hidden md:inline text-amber-300 truncate max-w-[110px]">
            • {tokens[turnIndex]?.name?.split(' ')[0] || 'Combate'}
          </span>
          <ChevronDown className="w-3 h-3 text-zinc-400" />
        </button>

        {showInitiativeDropdown && (
          <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 bg-zinc-950/98 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl p-3 z-50 space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-xs font-bold text-red-400 font-mono">
                ⚔️ INICIATIVA • RODADA {round}
              </span>
              <button
                onClick={handleNextTurn}
                className="px-2.5 py-1 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold flex items-center gap-1"
              >
                Próx. Turno <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 max-h-44 overflow-y-auto">
              {tokens.map((tok, idx) => {
                const isTurn = idx === turnIndex;
                return (
                  <button
                    key={tok.id}
                    onClick={() => setSelectedTokenId(tok.id)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between border transition ${
                      isTurn
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : selectedTokenId === tok.id
                        ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span>{tok.name}</span>
                    <span className="font-mono text-[10px] text-red-300">
                      {tok.hp}/{tok.maxHp} PV
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between gap-1.5">
              <button
                onClick={() => setRulerForcedOn(!rulerForcedOn)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-center gap-1 ${
                  rulerForcedOn
                    ? 'bg-amber-950 border-amber-400 text-amber-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <Ruler className="w-3 h-3" /> Régua 1,5m
              </button>

              <button
                onClick={() => setShowConditionMenu(!showConditionMenu)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-200 flex items-center justify-center gap-1"
              >
                <Tag className="w-3 h-3 text-amber-400" /> Condições
              </button>
            </div>

            {showConditionMenu && selectedToken && (
              <div className="space-y-1 pt-2 border-t border-zinc-800 max-h-40 overflow-y-auto">
                {OFFICIAL_CONDITIONS.map((cond) => {
                  const active = selectedToken.conditions?.includes(cond.id);
                  return (
                    <button
                      key={cond.id}
                      onClick={() => onToggleCondition(selectedToken.id, cond.id)}
                      className={`w-full text-left p-1.5 rounded-lg border text-[11px] flex items-center justify-between ${
                        active
                          ? 'bg-red-950/70 border-red-500/60 text-red-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span className="font-bold">{cond.label}</span>
                      <span className="text-[10px] font-mono">
                        {active ? 'ATIVO ✓' : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Open C.R.I.S. Sheet & .docx Importer Button */}
      <button
        onClick={onToggleRightSheet}
        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 shadow transition"
        title="Abrir Ficha Estilo C.R.I.S., Calculadora de Dano e Importador de Arquivo .docx"
      >
        <FileText className="w-4 h-4 text-amber-400" />
        <span>Ficha C.R.I.S.</span>
        {activeCharacter && (
          <span className="hidden sm:inline px-1.5 py-0.2 rounded bg-red-950/90 text-red-200 border border-red-500/40 font-mono text-[10px]">
            {activeCharacter.hp.current} PV
          </span>
        )}
      </button>
    </header>
  );
}
