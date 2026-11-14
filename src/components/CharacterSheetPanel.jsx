import React, { useState } from 'react';
import {
  Heart,
  Brain,
  Zap,
  Shield,
  Dices,
  Backpack,
  Sparkles,
  ScrollText,
  Plus,
  Minus,
  Flashlight,
  AlertTriangle,
} from 'lucide-react';
import { ELEMENT_THEMES } from '../data/ordoData';

const ATTR_LABELS = {
  AGI: { name: 'Agilidade', short: 'AGI', color: '#f59e0b' },
  FOR: { name: 'Força', short: 'FOR', color: '#ef4444' },
  INT: { name: 'Intelecto', short: 'INT', color: '#eab308' },
  PRE: { name: 'Presença', short: 'PRE', color: '#a855f7' },
  VIG: { name: 'Vigor', short: 'VIG', color: '#22c55e' },
};

export default function CharacterSheetPanel({
  character,
  activeCharId,
  setActiveCharId,
  allCharacters,
  onUpdateCharacter,
  onRollOrdemTest,
  onRollDamageDice,
  onCastRitual,
  onToggleFlashlight,
  flashlightOn,
}) {
  const [activeTab, setActiveTab] = useState('pericias'); // 'pericias' | 'inventario' | 'rituais'
  const [skillFilter, setSkillFilter] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemSpaces, setNewItemSpaces] = useState(1);

  if (!character) return null;

  // Official Ordem Paranormal RPG status automation
  const hpPct = Math.max(0, Math.min(100, (character.hp.current / character.hp.max) * 100));
  const sanPct = Math.max(0, Math.min(100, (character.san.current / character.san.max) * 100));
  const pePct = Math.max(0, Math.min(100, (character.pe.current / character.pe.max) * 100));

  const isMachucado = character.hp.current > 0 && character.hp.current <= Math.floor(character.hp.max / 2);
  const isMorrendo = character.hp.current <= 0;
  const isPerturbado = character.san.current > 0 && character.san.current <= Math.floor(character.san.max / 2);
  const isEnlouquecendo = character.san.current <= 0;

  // Official Inventory Load Rule: FOR * 5 spaces (or 2 spaces if FOR === 0)
  const maxSpaces = character.attributes.FOR > 0 ? character.attributes.FOR * 5 : 2;
  const usedSpaces = character.inventory.reduce((acc, item) => acc + (Number(item.spaces) || 0), 0);
  const isOverloaded = usedSpaces > maxSpaces;

  const adjustStat = (statKey, delta) => {
    const cur = character[statKey].current;
    const max = character[statKey].max;
    const next = Math.max(0, Math.min(max, cur + delta));
    onUpdateCharacter(character.id, {
      ...character,
      [statKey]: { ...character[statKey], current: next },
    });
  };

  const adjustAttribute = (attrKey, delta) => {
    const cur = character.attributes[attrKey] ?? 1;
    const next = Math.max(0, Math.min(6, cur + delta));
    onUpdateCharacter(character.id, {
      ...character,
      attributes: {
        ...character.attributes,
        [attrKey]: next,
      },
    });
  };

  const cycleSkillRank = (skillName) => {
    const ranks = [
      { bonus: 0, rank: 'Destreinado' },
      { bonus: 5, rank: 'Treinado' },
      { bonus: 10, rank: 'Veterano' },
      { bonus: 15, rank: 'Expert' },
    ];
    const updatedSkills = character.skills.map((sk) => {
      if (sk.name !== skillName) return sk;
      const idx = ranks.findIndex((r) => r.bonus === sk.bonus);
      const nextRank = ranks[(idx + 1) % ranks.length];
      return { ...sk, ...nextRank };
    });
    onUpdateCharacter(character.id, { ...character, skills: updatedSkills });
  };

  const handleAddInventoryItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const newItem = {
      id: `item_${Date.now()}`,
      name: newItemName.trim(),
      category: 'I',
      spaces: Number(newItemSpaces) || 1,
      type: 'gear',
    };
    onUpdateCharacter(character.id, {
      ...character,
      inventory: [...character.inventory, newItem],
    });
    setNewItemName('');
    setNewItemSpaces(1);
  };

  const filteredSkills = character.skills.filter((s) =>
    s.name.toLowerCase().includes(skillFilter.toLowerCase())
  );

  return (
    <aside className="w-[370px] h-full bg-[#101014]/95 backdrop-blur-xl border-l border-zinc-800/90 flex flex-col z-20 select-none">
      {/* Top Character Selector & Header */}
      <div className="p-3.5 border-b border-zinc-800/90 bg-zinc-950/60">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex gap-1.5">
            {Object.values(allCharacters).map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveCharId(ch.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition border ${
                  activeCharId === ch.id
                    ? 'bg-red-950/80 text-red-200 border-red-500/60 shadow'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {ch.name.split(' ')[0]} (NEX {ch.nex}%)
              </button>
            ))}
          </div>

          <button
            onClick={onToggleFlashlight}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border transition ${
              flashlightOn
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/60'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800'
            }`}
            title="Ligar/Desligar Lanterna Tática 3D"
          >
            <Flashlight className="w-3.5 h-3.5" />
            {flashlightOn ? 'Lanterna ON' : 'Lanterna OFF'}
          </button>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-base font-bold text-zinc-100 tracking-wide">
              {character.name}
            </h2>
            <p className="text-[11px] text-zinc-400">
              {character.class} ({character.subclass}) • Origem: {character.origin}
            </p>
          </div>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded uppercase border"
            style={{
              backgroundColor: ELEMENT_THEMES[character.affinity]?.bg,
              borderColor: ELEMENT_THEMES[character.affinity]?.border,
              color: ELEMENT_THEMES[character.affinity]?.accent,
            }}
          >
            Afinidade: {character.affinity}
          </span>
        </div>
      </div>

      {/* Scrollable Sheet Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* 1. DYNAMIC STATUS BARS (PV, SAN, PE) WITH OFFICIAL AUTOMATION */}
        <div className="space-y-2.5 bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80">
          {/* PV - Pontos de Vida */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5 font-bold text-red-400">
                <Heart className="w-3.5 h-3.5 fill-red-500/30" />
                <span>PV (VIDA)</span>
                {isMorrendo && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white text-[10px] rounded animate-pulse">
                    MORRENDO / INCONSCIENTE
                  </span>
                )}
                {!isMorrendo && isMachucado && (
                  <span className="px-1.5 py-0.2 bg-amber-600/90 text-white text-[10px] rounded">
                    MACHUCADO (≤ 50%)
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-zinc-100">
                {character.hp.current} / {character.hp.max}
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-300"
                style={{ width: `${hpPct}%` }}
              />
            </div>
            <div className="flex justify-end gap-1 mt-1">
              {[-5, -1, +1, +5].map((d) => (
                <button
                  key={d}
                  onClick={() => adjustStat('hp', d)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>

          {/* SAN - Sanidade */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5 font-bold text-violet-400">
                <Brain className="w-3.5 h-3.5" />
                <span>SAN (SANIDADE)</span>
                {isEnlouquecendo && (
                  <span className="px-1.5 py-0.2 bg-fuchsia-600 text-white text-[10px] rounded animate-pulse">
                    ENLOUQUECENDO (0 SAN)
                  </span>
                )}
                {!isEnlouquecendo && isPerturbado && (
                  <span className="px-1.5 py-0.2 bg-violet-700 text-white text-[10px] rounded">
                    PERTURBADO
                  </span>
                )}
              </div>
              <span className="font-mono font-bold text-zinc-100">
                {character.san.current} / {character.san.max}
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-800 to-violet-500 transition-all duration-300"
                style={{ width: `${sanPct}%` }}
              />
            </div>
            <div className="flex justify-end gap-1 mt-1">
              {[-5, -1, +1, +5].map((d) => (
                <button
                  key={d}
                  onClick={() => adjustStat('san', d)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
            </div>
          </div>

          {/* PE - Pontos de Esforço */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-400">
                <Zap className="w-3.5 h-3.5" />
                <span>PE (ESFORÇO • Limite/Turno: {character.pePerTurn})</span>
              </div>
              <span className="font-mono font-bold text-zinc-100">
                {character.pe.current} / {character.pe.max}
              </span>
            </div>
            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-700 to-yellow-400 transition-all duration-300"
                style={{ width: `${pePct}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className="text-[10px] text-zinc-400">Gasto Rápido:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => adjustStat('pe', -1)}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-600/50"
                >
                  -1 PE
                </button>
                <button
                  onClick={() => adjustStat('pe', -2)}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-600/50"
                >
                  -2 PE
                </button>
                <button
                  onClick={() => adjustStat('pe', -3)}
                  className="px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-600/50"
                >
                  -3 PE
                </button>
                <button
                  onClick={() => adjustStat('pe', +5)}
                  className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-emerald-300 border border-zinc-800"
                >
                  +5 PE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. OFFICIAL 5 BASE ATTRIBUTES (AGI, FOR, INT, PRE, VIG) */}
        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Atributos Base (Clique para Rolar d20 3D)
            </span>
            <span className="text-[10px] text-zinc-500">0 = 2d20 (Menor)</span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(ATTR_LABELS).map(([key, meta]) => {
              const val = character.attributes[key] ?? 0;
              return (
                <div
                  key={key}
                  className="flex flex-col items-center p-1.5 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-600 transition"
                >
                  <button
                    onClick={() =>
                      onRollOrdemTest({
                        label: `Atributo: ${meta.name}`,
                        attrKey: key,
                        attrValue: val,
                        skillBonus: 0,
                        rank: 'Puro',
                      })
                    }
                    className="flex flex-col items-center w-full group"
                    title={`Rolar ${meta.name} (${val > 0 ? `${val}d20 maior` : '2d20 menor'})`}
                  >
                    <span
                      className="text-[10px] font-bold tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {key}
                    </span>
                    <span className="text-lg font-mono font-extrabold text-zinc-100 group-hover:text-amber-300">
                      {val}
                    </span>
                  </button>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => adjustAttribute(key, -1)}
                      className="w-4 h-4 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => adjustAttribute(key, +1)}
                      className="w-4 h-4 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Defense & Resistances Summary */}
          <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-zinc-200 font-semibold">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Defesa: {character.defense}</span>
            </div>
            <span className="text-[11px] text-zinc-400 truncate max-w-[200px]" title={character.resistances}>
              RD: {character.resistances}
            </span>
          </div>
        </div>

        {/* 3. QUICK 3D POLYHEDRAL DICE LAUNCHER (d4, d6, d8, d10, d12, d20) */}
        <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <Dices className="w-3.5 h-3.5 text-red-400" />
              Rolador Físico Rápido 3D
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[4, 6, 8, 10, 12, 20].map((sides) => (
              <button
                key={sides}
                onClick={() =>
                  onRollDamageDice({
                    label: `Dado Manual 1d${sides}`,
                    formula: `1d${sides}`,
                    bonus: 0,
                    element: character.affinity,
                  })
                }
                className="py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/70 border border-zinc-800 hover:border-red-500/60 text-xs font-mono font-bold text-zinc-200 transition"
              >
                d{sides}
              </button>
            ))}
          </div>
        </div>

        {/* 4. SHEET TABS: PERÍCIAS | INVENTÁRIO & ARMAS | RITUAIS PARANORMAIS */}
        <div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 mb-2.5">
            <button
              onClick={() => setActiveTab('pericias')}
              className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition ${
                activeTab === 'pericias'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              Perícias
            </button>
            <button
              onClick={() => setActiveTab('inventario')}
              className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition ${
                activeTab === 'inventario'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              Carga ({usedSpaces}/{maxSpaces})
            </button>
            <button
              onClick={() => setActiveTab('rituais')}
              className={`py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition ${
                activeTab === 'rituais'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Rituais ({character.rituals.length})
            </button>
          </div>

          {/* TAB 1: OFFICIAL SKILLS (PERÍCIAS) */}
          {activeTab === 'pericias' && (
            <div className="space-y-2">
              <input
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="Filtrar perícia (ex: Ocultismo, Pontaria, Luta)..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <div className="space-y-1 max-h-[270px] overflow-y-auto pr-1">
                {filteredSkills.map((sk) => {
                  const attrVal = character.attributes[sk.attr] ?? 0;
                  return (
                    <div
                      key={sk.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/75 hover:bg-zinc-900 border border-zinc-800/80 transition"
                    >
                      <button
                        onClick={() =>
                          onRollOrdemTest({
                            label: `Perícia: ${sk.name}`,
                            attrKey: sk.attr,
                            attrValue: attrVal,
                            skillBonus: sk.bonus,
                            rank: sk.rank,
                          })
                        }
                        className="flex items-center gap-2 text-left flex-1 group"
                      >
                        <span className="w-6 h-6 rounded bg-zinc-950 border border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-amber-300 group-hover:border-amber-400">
                          🎲
                        </span>
                        <div>
                          <div className="text-xs font-bold text-zinc-100 group-hover:text-amber-300">
                            {sk.name}{' '}
                            <span className="text-[10px] font-mono text-zinc-400">
                              ({sk.attr}: {attrVal}d20)
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Grau: {sk.rank}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => cycleSkillRank(sk.name)}
                        title="Clique para alternar Grau de Treinamento (+0 / +5 / +10 / +15)"
                        className={`px-2 py-1 rounded text-xs font-mono font-bold border transition ${
                          sk.bonus === 15
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-300'
                            : sk.bonus === 10
                            ? 'bg-violet-950/80 border-violet-500/60 text-violet-300'
                            : sk.bonus === 5
                            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                        }`}
                      >
                        +{sk.bonus}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & WEAPONS WITH SPACE/WEIGHT CALCULATION */}
          {activeTab === 'inventario' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                <span className="text-zinc-300 font-medium">
                  Espaços Ocupados: <strong className="font-mono">{usedSpaces}</strong> / {maxSpaces}
                </span>
                {isOverloaded ? (
                  <span className="flex items-center gap-1 text-red-400 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" /> SOBRECARREGADO (-5 Defesa / -3m)
                  </span>
                ) : (
                  <span className="text-emerald-400 text-[11px] font-semibold">Carga Normal</span>
                )}
              </div>

              <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                {character.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-zinc-100">{item.name}</div>
                        <div className="text-[10px] text-zinc-400">
                          Cat. {item.category} • {item.spaces} {item.spaces === 1 ? 'espaço' : 'espaços'}
                          {item.crit ? ` • Crítico ${item.crit}` : ''}
                        </div>
                      </div>
                    </div>

                    {item.type === 'weapon' && (
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            const sk = character.skills.find((s) => s.name === item.skill) || {
                              attr: 'AGI',
                              bonus: 5,
                              rank: 'Treinado',
                            };
                            onRollOrdemTest({
                              label: `Ataque: ${item.name}`,
                              attrKey: sk.attr,
                              attrValue: character.attributes[sk.attr] ?? 1,
                              skillBonus: sk.bonus,
                              rank: sk.rank,
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-[11px] font-semibold"
                        >
                          🎯 Testar {item.skill}
                        </button>
                        <button
                          onClick={() =>
                            onRollDamageDice({
                              label: `Dano: ${item.name}`,
                              formula: item.damageDice,
                              bonus: item.damageBonus || 0,
                              element: character.affinity,
                            })
                          }
                          className="flex-1 py-1 px-2 rounded bg-red-950/70 hover:bg-red-900/80 text-red-200 border border-red-500/40 text-[11px] font-semibold"
                        >
                          💥 Dano ({item.damageDice}
                          {item.damageBonus ? `+${item.damageBonus}` : ''})
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Item Form */}
              <form onSubmit={handleAddInventoryItem} className="flex gap-1.5 pt-1">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Novo equipamento ou pista..."
                  className="flex-1 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newItemSpaces}
                  onChange={(e) => setNewItemSpaces(e.target.value)}
                  className="w-12 px-1.5 py-1 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-center"
                  title="Espaços de carga"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-100"
                >
                  +
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: PARANORMAL RITUALS (SANGUE, MORTE, CONHECIMENTO, ENERGIA, MEDO) */}
          {activeTab === 'rituais' && (
            <div className="space-y-2 max-h-[265px] overflow-y-auto pr-1">
              {character.rituals.map((rit) => {
                const theme = ELEMENT_THEMES[rit.element] || ELEMENT_THEMES.Sangue;
                return (
                  <div
                    key={rit.id}
                    className="p-2.5 rounded-xl border space-y-1.5"
                    style={{
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-100">{rit.name}</span>
                      <span
                        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-950/80"
                        style={{ color: theme.accent }}
                      >
                        {rit.element} • {rit.circle}º Círculo ({rit.peCost} PE)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug">{rit.description}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-zinc-400">
                        Execução: {rit.execution} • Alcance: {rit.range}
                      </span>
                      <button
                        onClick={() => onCastRitual(character, rit)}
                        className="px-2.5 py-1 rounded-md bg-zinc-950/90 hover:bg-zinc-900 text-xs font-bold border transition shadow"
                        style={{
                          borderColor: theme.accent,
                          color: theme.accent,
                        }}
                      >
                        ✨ Conjurar (-{rit.peCost} PE)
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
