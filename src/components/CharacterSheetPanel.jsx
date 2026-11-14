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
  FileUp,
  UserPlus,
  Trash2,
  X,
  Upload,
  FileText,
  Swords,
  Check,
} from 'lucide-react';
import { ELEMENT_THEMES, makeCharacterCutoutSvg } from '../data/ordoData';
import { extractTextFromUploadedFile, parseCharacterFromText } from '../utils/sheetParser';

const PENTAGRAM_NODES = [
  { key: 'AGI', name: 'Agilidade', x: 50, y: 12, color: '#f59e0b' },
  { key: 'INT', name: 'Intelecto', x: 88, y: 38, color: '#eab308' },
  { key: 'VIG', name: 'Vigor', x: 74, y: 84, color: '#22c55e' },
  { key: 'PRE', name: 'Presença', x: 26, y: 84, color: '#a855f7' },
  { key: 'FOR', name: 'Força', x: 12, y: 38, color: '#ef4444' },
];

export default function CharacterSheetPanel({
  isOpen,
  onClose,
  character,
  activeCharId,
  setActiveCharId,
  allCharacters,
  onUpdateCharacter,
  onCreateCharacter,
  onDeleteCharacter,
  onRollOrdemTest,
  onRollDamageDice,
  onCastRitual,
  onToggleFlashlight,
  flashlightOn,
  onNotification,
}) {
  const [activeTab, setActiveTab] = useState('combate'); // 'combate' | 'pericias' | 'rituais' | 'inventario' | 'docs'
  const [skillFilter, setSkillFilter] = useState('');

  // Direct Damage / Heal calculator inputs (C.R.I.S. style)
  const [hpDeltaInput, setHpDeltaInput] = useState('');
  const [sanDeltaInput, setSanDeltaInput] = useState('');
  const [peDeltaInput, setPeDeltaInput] = useState('');

  // Docs (.docx / .txt / pasted text) importer state
  const [docText, setDocText] = useState('');
  const [docAvatar, setDocAvatar] = useState(null);
  const [docFileName, setDocFileName] = useState('');
  const [isParsingDoc, setIsParsingDoc] = useState(false);

  // New Weapon / Item inputs
  const [newItemName, setNewItemName] = useState('');
  const [newItemDice, setNewItemDice] = useState('1d10');
  const [newItemSpaces, setNewItemSpaces] = useState(1);

  if (!isOpen || !character) return null;

  const hpPct = Math.max(0, Math.min(100, (character.hp.current / (character.hp.max || 1)) * 100));
  const sanPct = Math.max(0, Math.min(100, (character.san.current / (character.san.max || 1)) * 100));
  const pePct = Math.max(0, Math.min(100, (character.pe.current / (character.pe.max || 1)) * 100));

  const isMachucado = character.hp.current > 0 && character.hp.current <= Math.floor(character.hp.max / 2);
  const isMorrendo = character.hp.current <= 0;
  const isPerturbado = character.san.current > 0 && character.san.current <= Math.floor(character.san.max / 2);
  const isEnlouquecendo = character.san.current <= 0;

  const maxSpaces = character.attributes.FOR > 0 ? character.attributes.FOR * 5 : 2;
  const usedSpaces = (character.inventory || []).reduce(
    (acc, item) => acc + (Number(item.spaces) || 0),
    0
  );
  const isOverloaded = usedSpaces > maxSpaces;

  // Update Current or Max stat directly
  const adjustStat = (statKey, delta) => {
    const cur = character[statKey].current;
    const max = character[statKey].max;
    const next = Math.max(0, Math.min(max + 50, cur + delta));
    onUpdateCharacter(character.id, {
      ...character,
      [statKey]: { ...character[statKey], current: next },
    });
  };

  const setExactStat = (statKey, field, rawVal) => {
    const num = Math.max(0, parseInt(rawVal, 10) || 0);
    onUpdateCharacter(character.id, {
      ...character,
      [statKey]: {
        ...character[statKey],
        [field]: num,
      },
    });
  };

  // Apply typed damage or heal from input box
  const applyTypedDelta = (statKey, sign, inputVal, clearFn) => {
    const amount = Math.abs(parseInt(inputVal, 10) || 0);
    if (amount <= 0) return;
    adjustStat(statKey, sign * amount);
    clearFn('');
    if (statKey === 'hp') {
      onNotification(
        sign < 0
          ? `🩸 ${character.name} sofreu ${amount} de Dano na Vida!`
          : `💚 ${character.name} recuperou +${amount} PV!`
      );
    }
  };

  const adjustAttribute = (attrKey, delta) => {
    const cur = character.attributes[attrKey] ?? 1;
    const next = Math.max(0, Math.min(8, cur + delta));
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

  // Upload Character Cutout Image (No Circle, No Border)
  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        onUpdateCharacter(character.id, {
          ...character,
          avatar: ev.target.result,
        });
        onNotification(`🖼️ Foto de ${character.name} atualizada (sem borda circular)!`);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle .docx / .txt file upload for Character Sheet Import
  const handleDocsFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingDoc(true);
    setDocFileName(file.name);
    try {
      const { text, avatar } = await extractTextFromUploadedFile(file);
      setDocText(text);
      if (avatar) setDocAvatar(avatar);
      onNotification(`📄 Arquivo "${file.name}" lido! Clique em Criar Novo ou Atualizar Ficha Atual.`);
    } catch (err) {
      onNotification('⚠️ Não foi possível ler este arquivo. Tente .docx ou .txt.');
    } finally {
      setIsParsingDoc(false);
    }
  };

  const handleImportAsNewCharacter = () => {
    if (!docText.trim()) {
      onNotification('⚠️ Suba um arquivo .docx/.txt ou cole os dados da ficha primeiro.');
      return;
    }
    const newChar = parseCharacterFromText(docText, null, docAvatar);
    onCreateCharacter(newChar);
    setDocText('');
    setDocFileName('');
    setActiveTab('combate');
  };

  const handleImportUpdateCurrent = () => {
    if (!docText.trim()) {
      onNotification('⚠️ Suba um arquivo .docx/.txt ou cole os dados da ficha primeiro.');
      return;
    }
    const updated = parseCharacterFromText(docText, character, docAvatar);
    onUpdateCharacter(character.id, updated);
    onNotification(`✅ Ficha de "${updated.name}" atualizada a partir do documento!`);
    setDocText('');
    setDocFileName('');
    setActiveTab('combate');
  };

  const handleCreateBlankCharacter = () => {
    const id = `char_${Date.now()}`;
    const newChar = {
      id,
      name: 'Novo Agente',
      player: 'Jogador',
      class: 'Especialista',
      subclass: 'Agente de Campo',
      origin: 'Acadêmico',
      patente: 'Recruta',
      nex: 25,
      pePerTurn: 5,
      movementMeters: 9,
      affinity: 'Conhecimento',
      cursorColor: '#facc15',
      tokenColor: '#eab308',
      avatar: makeCharacterCutoutSvg('AGENTE', '#facc15', 'agent'),
      hp: { current: 40, max: 40 },
      san: { current: 45, max: 45 },
      pe: { current: 25, max: 25 },
      defense: 15,
      protection: 'Colete Leve',
      resistances: 'Nenhuma',
      attributes: { AGI: 2, FOR: 1, INT: 3, PRE: 2, VIG: 2 },
      skills: character.skills.map((s) => ({ ...s, bonus: 0, rank: 'Destreinado' })),
      inventory: [
        {
          id: `w_${Date.now()}`,
          name: 'Pistola Tática',
          category: 'I',
          spaces: 1,
          type: 'weapon',
          skill: 'Pontaria',
          damageDice: '1d12',
          damageBonus: 0,
          crit: '18/x2',
        },
      ],
      rituals: [],
      notes: '',
    };
    onCreateCharacter(newChar);
  };

  const handleAddInventoryItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const isWeapon = Boolean(newItemDice.trim());
    const newItem = {
      id: `item_${Date.now()}`,
      name: newItemName.trim(),
      category: 'I',
      spaces: Number(newItemSpaces) || 1,
      type: isWeapon ? 'weapon' : 'gear',
      skill: 'Pontaria',
      damageDice: newItemDice.trim() || '1d8',
      damageBonus: 0,
      crit: '19/x2',
    };
    onUpdateCharacter(character.id, {
      ...character,
      inventory: [...(character.inventory || []), newItem],
    });
    setNewItemName('');
  };

  const filteredSkills = (character.skills || []).filter((s) =>
    s.name.toLowerCase().includes(skillFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[450px] bg-[#0b0b0f]/98 backdrop-blur-2xl border-l border-zinc-800 shadow-2xl flex flex-col select-none animate-fadeIn">
      {/* 1. C.R.I.S. TOP BAR: CHARACTER SWITCHER, IMPORT DOCS BUTTON & CLOSE */}
      <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {Object.values(allCharacters).map((ch) => (
              <button
                key={ch.id}
                onClick={() => setActiveCharId(ch.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition border ${
                  activeCharId === ch.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {ch.name.split(' ')[0]} ({ch.nex}%)
              </button>
            ))}
            <button
              onClick={handleCreateBlankCharacter}
              className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 text-xs font-bold shrink-0 flex items-center gap-1"
              title="Criar novo personagem do zero"
            >
              <UserPlus className="w-3.5 h-3.5" /> + Novo
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-red-950 text-zinc-300 hover:text-white border border-zinc-800 shrink-0"
            title="Fechar Ficha e voltar para o Mapa"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* C.R.I.S. Agent Identity Header (Editable Name, Class, NEX, Frameless Photo) */}
        <div className="flex items-center gap-3 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/90">
          {/* Frameless Character Image Preview (Click to upload new PNG/photo) */}
          <label
            className="relative w-14 h-16 rounded-lg bg-zinc-950/90 border border-dashed border-zinc-700 hover:border-amber-400 flex items-center justify-center cursor-pointer shrink-0 overflow-hidden group"
            title="Clique para trocar a imagem do personagem (aparece sem círculo no mapa)"
          >
            <img
              src={character.avatar}
              alt={character.name}
              className="w-full h-full object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]"
            />
            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] font-bold text-amber-300 text-center leading-tight p-1 transition">
              Trocar Foto
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={character.name}
                onChange={(e) =>
                  onUpdateCharacter(character.id, { ...character, name: e.target.value })
                }
                className="w-full bg-transparent font-serif text-base font-extrabold text-zinc-100 border-b border-transparent hover:border-zinc-700 focus:border-amber-500 focus:outline-none truncate"
                placeholder="Nome do Agente"
              />
              <div className="flex items-center gap-0.5 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 shrink-0">
                <span className="text-[10px] font-mono text-amber-400 font-bold">NEX</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={character.nex}
                  onChange={(e) =>
                    onUpdateCharacter(character.id, {
                      ...character,
                      nex: Math.min(99, Math.max(0, parseInt(e.target.value, 10) || 0)),
                    })
                  }
                  className="w-8 bg-transparent font-mono text-xs font-bold text-zinc-100 text-right focus:outline-none"
                />
                <span className="text-[10px] font-mono text-zinc-400">%</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <select
                value={character.class}
                onChange={(e) =>
                  onUpdateCharacter(character.id, { ...character, class: e.target.value })
                }
                className="bg-zinc-950 text-zinc-300 px-1.5 py-0.5 rounded border border-zinc-800 text-[11px]"
              >
                <option value="Combatente">Combatente</option>
                <option value="Especialista">Especialista</option>
                <option value="Ocultista">Ocultista</option>
                <option value="Mundano">Mundano</option>
              </select>

              <select
                value={character.affinity}
                onChange={(e) =>
                  onUpdateCharacter(character.id, { ...character, affinity: e.target.value })
                }
                className="bg-zinc-950 text-amber-300 px-1.5 py-0.5 rounded border border-zinc-800 text-[11px]"
              >
                <option value="Sangue">Sangue</option>
                <option value="Morte">Morte</option>
                <option value="Conhecimento">Conhecimento</option>
                <option value="Energia">Energia</option>
                <option value="Medo">Medo</option>
              </select>

              <button
                onClick={onToggleFlashlight}
                className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border transition ${
                  flashlightOn
                    ? 'bg-amber-950/90 text-amber-200 border-amber-500/60'
                    : 'bg-zinc-950 text-zinc-500 border-zinc-800'
                }`}
              >
                <Flashlight className="w-3 h-3" />
                {flashlightOn ? 'Lanterna ON' : 'Lanterna OFF'}
              </button>

              {Object.keys(allCharacters).length > 1 && (
                <button
                  onClick={() => onDeleteCharacter(character.id)}
                  className="p-1 rounded bg-zinc-950 hover:bg-red-950 text-zinc-500 hover:text-red-300 border border-zinc-800 ml-auto"
                  title="Excluir este personagem da mesa"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE C.R.I.S. SHEET BODY */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* C.R.I.S. STATUS BARS WITH DIRECT DAMAGE / HEAL CALCULATOR */}
        <div className="space-y-3 bg-zinc-950/90 p-3 rounded-xl border border-zinc-800">
          {/* VIDA (PV) + CALCULADORA DE DANO */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-red-400">
                <Heart className="w-3.5 h-3.5 fill-red-500/30" />
                <span>VIDA (PV)</span>
                {isMorrendo && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] rounded animate-pulse">
                    MORRENDO
                  </span>
                )}
                {!isMorrendo && isMachucado && (
                  <span className="px-1.5 py-0.2 bg-amber-600 text-white text-[9px] rounded">
                    MACHUCADO
                  </span>
                )}
              </div>

              {/* Editable Current / Max PV */}
              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  value={character.hp.current}
                  onChange={(e) => setExactStat('hp', 'current', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-center font-bold text-zinc-100"
                  title="Vida Atual (clique para digitar)"
                />
                <span className="text-zinc-500">/</span>
                <input
                  type="number"
                  value={character.hp.max}
                  onChange={(e) => setExactStat('hp', 'max', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-center text-zinc-300"
                  title="Vida Máxima (clique para digitar)"
                />
              </div>
            </div>

            <div className="w-full h-3 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-red-800 to-red-500 transition-all duration-300"
                style={{ width: `${hpPct}%` }}
              />
            </div>

            {/* Direct Damage / Heal Input Bar */}
            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                type="number"
                min="1"
                value={hpDeltaInput}
                onChange={(e) => setHpDeltaInput(e.target.value)}
                placeholder="Valor do Dano/Cura..."
                className="flex-1 px-2 py-1 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
              <button
                onClick={() => applyTypedDelta('hp', -1, hpDeltaInput, setHpDeltaInput)}
                className="px-2.5 py-1 rounded-lg bg-red-950/90 hover:bg-red-800 text-red-100 border border-red-500/50 text-[11px] font-bold transition"
                title="Subtrair o dano digitado da Vida atual"
              >
                💥 Dano (-PV)
              </button>
              <button
                onClick={() => applyTypedDelta('hp', +1, hpDeltaInput, setHpDeltaInput)}
                className="px-2.5 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/50 text-[11px] font-bold transition"
                title="Somar a cura digitada na Vida atual"
              >
                💚 Curar (+PV)
              </button>
              <div className="flex gap-0.5">
                {[-5, -1, +1, +5].map((d) => (
                  <button
                    key={d}
                    onClick={() => adjustStat('hp', d)}
                    className="px-1.5 py-1 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SANIDADE (SAN) */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-violet-400">
                <Brain className="w-3.5 h-3.5" />
                <span>SANIDADE (SAN)</span>
                {isEnlouquecendo && (
                  <span className="px-1.5 py-0.2 bg-fuchsia-600 text-white text-[9px] rounded animate-pulse">
                    ENLOUQUECENDO
                  </span>
                )}
                {!isEnlouquecendo && isPerturbado && (
                  <span className="px-1.5 py-0.2 bg-violet-700 text-white text-[9px] rounded">
                    PERTURBADO
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  value={character.san.current}
                  onChange={(e) => setExactStat('san', 'current', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-center font-bold text-zinc-100"
                />
                <span className="text-zinc-500">/</span>
                <input
                  type="number"
                  value={character.san.max}
                  onChange={(e) => setExactStat('san', 'max', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-center text-zinc-300"
                />
              </div>
            </div>

            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-800 to-violet-500 transition-all duration-300"
                style={{ width: `${sanPct}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                value={sanDeltaInput}
                onChange={(e) => setSanDeltaInput(e.target.value)}
                placeholder="Dano mental..."
                className="flex-1 px-2 py-1 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500"
              />
              <button
                onClick={() => applyTypedDelta('san', -1, sanDeltaInput, setSanDeltaInput)}
                className="px-2 py-1 rounded-lg bg-violet-950/90 hover:bg-violet-800 text-violet-100 border border-violet-500/50 text-[11px] font-bold"
              >
                🧠 -SAN
              </button>
              <button
                onClick={() => applyTypedDelta('san', +1, sanDeltaInput, setSanDeltaInput)}
                className="px-2 py-1 rounded-lg bg-indigo-950/90 hover:bg-indigo-800 text-indigo-100 border border-indigo-500/50 text-[11px] font-bold"
              >
                +SAN
              </button>
              <div className="flex gap-0.5">
                {[-5, -1, +1, +5].map((d) => (
                  <button
                    key={d}
                    onClick={() => adjustStat('san', d)}
                    className="px-1.5 py-1 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ESFORÇO (PE) */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-900">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-amber-400">
                <Zap className="w-3.5 h-3.5" />
                <span>ESFORÇO (PE)</span>
              </div>

              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="number"
                  value={character.pe.current}
                  onChange={(e) => setExactStat('pe', 'current', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-center font-bold text-zinc-100"
                />
                <span className="text-zinc-500">/</span>
                <input
                  type="number"
                  value={character.pe.max}
                  onChange={(e) => setExactStat('pe', 'max', e.target.value)}
                  className="w-12 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-center text-zinc-300"
                />
              </div>
            </div>

            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-amber-700 to-yellow-400 transition-all duration-300"
                style={{ width: `${pePct}%` }}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                value={peDeltaInput}
                onChange={(e) => setPeDeltaInput(e.target.value)}
                placeholder="Gastar PE..."
                className="flex-1 px-2 py-1 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500"
              />
              <button
                onClick={() => applyTypedDelta('pe', -1, peDeltaInput, setPeDeltaInput)}
                className="px-2 py-1 rounded-lg bg-amber-950/90 hover:bg-amber-800 text-amber-100 border border-amber-500/50 text-[11px] font-bold"
              >
                ⚡ -PE
              </button>
              <button
                onClick={() => applyTypedDelta('pe', +1, peDeltaInput, setPeDeltaInput)}
                className="px-2 py-1 rounded-lg bg-emerald-950/90 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/50 text-[11px] font-bold"
              >
                +PE
              </button>
              <div className="flex gap-0.5">
                {[-3, -2, -1, +2].map((d) => (
                  <button
                    key={d}
                    onClick={() => adjustStat('pe', d)}
                    className="px-1.5 py-1 text-[10px] font-mono rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                  >
                    {d > 0 ? `+${d}` : d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. C.R.I.S. PENTAGRAM OF ATTRIBUTES (AGI, FOR, INT, PRE, VIG) + DEFESA */}
        <div className="bg-zinc-950/90 p-3 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              Pentagrama C.R.I.S. (Clique no Atributo para Rolar)
            </span>
            <div className="flex items-center gap-1 text-xs">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-400 text-[11px]">Defesa:</span>
              <input
                type="number"
                value={character.defense}
                onChange={(e) =>
                  onUpdateCharacter(character.id, {
                    ...character,
                    defense: parseInt(e.target.value, 10) || 10,
                  })
                }
                className="w-10 px-1 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-center font-mono font-bold text-amber-300 text-xs"
              />
            </div>
          </div>

          {/* Interactive Pentagon Visual Layout */}
          <div className="relative w-full h-48 my-1">
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              {/* Outer Pentagon Lines */}
              <polygon
                points="50,12 88,38 74,84 26,84 12,38"
                fill="rgba(24, 24, 27, 0.55)"
                stroke="#3f3f46"
                strokeWidth="0.8"
              />
              {/* Inner Pentagram Star Lines */}
              <polygon
                points="50,12 74,84 12,38 88,38 26,84"
                fill="none"
                stroke="rgba(234, 179, 8, 0.25)"
                strokeWidth="0.6"
              />
            </svg>

            {PENTAGRAM_NODES.map((node) => {
              const val = character.attributes[node.key] ?? 0;
              return (
                <div
                  key={node.key}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                >
                  <div className="flex items-center gap-0.5 bg-zinc-900/95 border border-zinc-700 hover:border-amber-400 rounded-xl px-2 py-1 shadow-lg">
                    <button
                      onClick={() => adjustAttribute(node.key, -1)}
                      className="text-zinc-500 hover:text-zinc-200 p-0.5"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() =>
                        onRollOrdemTest({
                          label: `Atributo: ${node.name}`,
                          attrKey: node.key,
                          attrValue: val,
                          skillBonus: 0,
                          rank: 'Atributo',
                        })
                      }
                      className="flex flex-col items-center px-1.5 group"
                      title={`Rolar ${node.name} (${val > 0 ? `${val}d20 maior` : '2d20 menor'})`}
                    >
                      <span
                        className="text-[9px] font-extrabold tracking-wider leading-none"
                        style={{ color: node.color }}
                      >
                        {node.key}
                      </span>
                      <span className="text-base font-mono font-black text-zinc-100 group-hover:text-amber-300 leading-tight">
                        {val}
                      </span>
                    </button>
                    <button
                      onClick={() => adjustAttribute(node.key, +1)}
                      className="text-zinc-500 hover:text-zinc-200 p-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. C.R.I.S. NAVIGATION TABS (INCLUINDO IMPORTAR DOCS) */}
        <div>
          <div className="grid grid-cols-5 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 mb-3">
            <button
              onClick={() => setActiveTab('docs')}
              className={`py-1.5 px-1 text-[11px] font-bold rounded-lg flex flex-col items-center gap-0.5 transition ${
                activeTab === 'docs'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow'
                  : 'text-amber-400/90 hover:text-amber-200'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>Docs/Importar</span>
            </button>

            <button
              onClick={() => setActiveTab('combate')}
              className={`py-1.5 px-1 text-[11px] font-bold rounded-lg flex flex-col items-center gap-0.5 transition ${
                activeTab === 'combate'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Combate</span>
            </button>

            <button
              onClick={() => setActiveTab('pericias')}
              className={`py-1.5 px-1 text-[11px] font-bold rounded-lg flex flex-col items-center gap-0.5 transition ${
                activeTab === 'pericias'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Perícias</span>
            </button>

            <button
              onClick={() => setActiveTab('rituais')}
              className={`py-1.5 px-1 text-[11px] font-bold rounded-lg flex flex-col items-center gap-0.5 transition ${
                activeTab === 'rituais'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Rituais</span>
            </button>

            <button
              onClick={() => setActiveTab('inventario')}
              className={`py-1.5 px-1 text-[11px] font-bold rounded-lg flex flex-col items-center gap-0.5 transition ${
                activeTab === 'inventario'
                  ? 'bg-zinc-800 text-amber-300 shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>Inventário</span>
            </button>
          </div>

          {/* TAB: IMPORTAR ARQUIVO .DOCX / .TXT / TEXTO DO GOOGLE DOCS OU C.R.I.S. */}
          {activeTab === 'docs' && (
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-amber-500/40 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <FileUp className="w-4 h-4" />
                  Importar Personagem de Arquivo Docs (.docx / .txt) ou Texto
                </h3>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                  Suba um arquivo <strong>Word / Google Docs (`.docx`)</strong> ou `.txt` com a
                  ficha do seu personagem (ou cole o texto abaixo). O sistema lê automaticamente{' '}
                  <strong>Nome, Classe, NEX, PV, SAN, PE, Atributos, Perícias e Armas</strong>!
                </p>
              </div>

              <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-amber-500/50 hover:border-amber-400 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 cursor-pointer transition text-center">
                <Upload className="w-5 h-5 text-amber-400 mb-1" />
                <span className="text-xs font-bold text-zinc-100">
                  {isParsingDoc
                    ? 'Lendo documento...'
                    : docFileName
                    ? `Arquivo lido: ${docFileName}`
                    : 'Escolher Arquivo .docx ou .txt da Ficha'}
                </span>
                <span className="text-[10px] text-zinc-400">
                  Suporta .docx (Word / Google Docs), .txt e .json
                </span>
                <input
                  type="file"
                  accept=".docx,.txt,.md,.json"
                  onChange={handleDocsFileUpload}
                  className="hidden"
                />
              </label>

              <textarea
                rows={6}
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                placeholder={`Ou cole aqui o texto da sua ficha (do Google Docs ou C.R.I.S.):\nExemplo:\nNome: Dante\nClasse: Ocultista\nNEX: 55%\nPV: 44/44 | SAN: 70/82 | PE: 66/72\nAGI: 2 | FOR: 0 | INT: 4 | PRE: 4 | VIG: 1\nOcultismo +15\nVontade +15`}
                className="w-full p-2.5 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleImportAsNewCharacter}
                  className="py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Criar Novo Personagem
                </button>
                <button
                  onClick={handleImportUpdateCurrent}
                  className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  Atualizar "{character.name.split(' ')[0]}"
                </button>
              </div>
            </div>
          )}

          {/* TAB: COMBATE, ARMAS & DADOS RÁPIDOS */}
          {activeTab === 'combate' && (
            <div className="space-y-3">
              {/* Quick Polyhedral Dice Launcher */}
              <div className="bg-zinc-950/90 p-2.5 rounded-xl border border-zinc-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
                  <Dices className="w-3.5 h-3.5 text-red-400" />
                  Rolador Rápido de Dados
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {[4, 6, 8, 10, 12, 20].map((sides) => (
                    <button
                      key={sides}
                      onClick={() =>
                        onRollDamageDice({
                          label: `Dado 1d${sides}`,
                          formula: `1d${sides}`,
                          bonus: 0,
                          element: character.affinity,
                        })
                      }
                      className="py-1.5 rounded-lg bg-zinc-900 hover:bg-red-950/80 border border-zinc-800 hover:border-red-500/60 text-xs font-mono font-bold text-zinc-200 transition"
                    >
                      d{sides}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weapons List */}
              <div className="space-y-2">
                {(character.inventory || [])
                  .filter((i) => i.type === 'weapon')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{item.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          Crítico {item.crit || '19/x2'}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            const sk = (character.skills || []).find(
                              (s) => s.name === item.skill
                            ) || {
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
                          className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-amber-300 border border-amber-500/40 text-xs font-bold"
                        >
                          🎯 Testar {item.skill || 'Ataque'}
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
                          className="flex-1 py-1.5 px-2 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-500/50 text-xs font-bold"
                        >
                          💥 Rolar Dano ({item.damageDice}
                          {item.damageBonus ? `+${item.damageBonus}` : ''})
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB: PERÍCIAS OFICIAIS */}
          {activeTab === 'pericias' && (
            <div className="space-y-2">
              <input
                type="text"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder="Buscar perícia (ex: Ocultismo, Pontaria, Luta)..."
                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 placeholder-zinc-500"
              />
              <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
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
                        <span className="w-6 h-6 rounded bg-zinc-950 border border-zinc-700 flex items-center justify-center text-xs">
                          🎲
                        </span>
                        <div>
                          <div className="text-xs font-bold text-zinc-100 group-hover:text-amber-300">
                            {sk.name}{' '}
                            <span className="text-[10px] font-mono text-zinc-400">
                              ({sk.attr}: {attrVal}d20)
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-400">{sk.rank}</div>
                        </div>
                      </button>

                      <button
                        onClick={() => cycleSkillRank(sk.name)}
                        title="Clique para mudar o grau (+0 / +5 / +10 / +15)"
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

          {/* TAB: RITUAIS */}
          {activeTab === 'rituais' && (
            <div className="space-y-2">
              {(character.rituals || []).length === 0 && (
                <p className="text-xs text-zinc-400 p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                  Nenhum ritual cadastrado para este agente.
                </p>
              )}
              {(character.rituals || []).map((rit) => {
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
                        {rit.element} • {rit.peCost} PE
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-snug">{rit.description}</p>
                    <button
                      onClick={() => onCastRitual(character, rit)}
                      className="w-full py-1 rounded-md bg-zinc-950/90 hover:bg-zinc-900 text-xs font-bold border transition"
                      style={{
                        borderColor: theme.accent,
                        color: theme.accent,
                      }}
                    >
                      ✨ Conjurar Ritual (-{rit.peCost} PE)
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB: INVENTÁRIO & NOTAS DO DOCS */}
          {activeTab === 'inventario' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs">
                <span>
                  Carga: <strong className="font-mono">{usedSpaces}</strong> / {maxSpaces} espaços
                </span>
                {isOverloaded && (
                  <span className="flex items-center gap-1 text-red-400 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5" /> SOBRECARREGADO
                  </span>
                )}
              </div>

              <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                {(character.inventory || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-zinc-100">{item.name}</div>
                      <div className="text-[10px] text-zinc-400">
                        {item.spaces} esp. {item.damageDice ? `• Dano: ${item.damageDice}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Weapon / Item Form */}
              <form onSubmit={handleAddInventoryItem} className="grid grid-cols-12 gap-1.5 pt-1">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nova arma ou item..."
                  className="col-span-6 px-2 py-1 text-xs rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                />
                <input
                  type="text"
                  value={newItemDice}
                  onChange={(e) => setNewItemDice(e.target.value)}
                  placeholder="Ex: 2d8"
                  className="col-span-3 px-2 py-1 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                  title="Dados de dano (deixe vazio se for item comum)"
                />
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={newItemSpaces}
                  onChange={(e) => setNewItemSpaces(e.target.value)}
                  className="col-span-1 px-1 py-1 text-xs font-mono rounded bg-zinc-950 border border-zinc-800 text-zinc-200 text-center"
                />
                <button
                  type="submit"
                  className="col-span-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-xs font-bold text-zinc-950"
                >
                  + Add
                </button>
              </form>

              {character.notes && (
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="text-[10px] font-bold uppercase text-amber-400 flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Texto Importado do Documento:
                  </div>
                  <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                    {character.notes}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
