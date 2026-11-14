import React, { useState, useCallback } from 'react';
import {
  INITIAL_CHARACTERS,
  INITIAL_TOKENS,
  INITIAL_HANDOUTS,
  ELEMENT_THEMES,
} from './data/ordoData';
import InitiativeTracker from './components/InitiativeTracker';
import WorkshopAndAudioPanel from './components/WorkshopAndAudioPanel';
import CharacterSheetPanel from './components/CharacterSheetPanel';
import Tabletop3D from './components/Tabletop3D';
import HandoutInspectorModal from './components/HandoutInspectorModal';
import { soundEngine } from './utils/soundEngine';
import { Dices, X, HelpCircle } from 'lucide-react';

export default function App() {
  // 1. Permission Role ('gm' | 'arthur' | 'dante')
  const [role, setRole] = useState('arthur');

  // 2. Characters & 3D Tokens State
  const [characters, setCharacters] = useState(INITIAL_CHARACTERS);
  const [activeCharId, setActiveCharId] = useState('arthur');
  const [tokens, setTokens] = useState(INITIAL_TOKENS);
  const [selectedTokenId, setSelectedTokenId] = useState('arthur');

  // 3. Physical Hinge Door & Dynamic Fog of War State
  const [doorLocked, setDoorLocked] = useState(false);
  const [doorAngleDeg, setDoorAngleDeg] = useState(0);
  const [manualDoorTargetRad, setManualDoorTargetRad] = useState(null);
  const [fogMode, setFogMode] = useState('dynamic'); // 'dynamic' | 'reveal_all' | 'brush_reveal' | 'brush_hide'
  const [manualRoom2Revealed, setManualRoom2Revealed] = useState(false);

  // 4. Inspectable 3D Handouts & Workshop Props
  const [handouts, setHandouts] = useState(INITIAL_HANDOUTS);
  const [inspectedHandout, setInspectedHandout] = useState(null);
  const [spawnedProps, setSpawnedProps] = useState([]);

  // 5. Combat Initiative, 3D Dice Rolls & Ritual Particle Effects
  const [turnIndex, setTurnIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [rollRequest, setRollRequest] = useState(null);
  const [lastRollResult, setLastRollResult] = useState(null);
  const [activeRitualEffect, setActiveRitualEffect] = useState(null);

  // 6. Tabletop UI Toggles & Toast Notifications
  const [showTeamCursors, setShowTeamCursors] = useState(true);
  const [rulerForcedOn, setRulerForcedOn] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showControlsHint, setShowControlsHint] = useState(true);

  const triggerNotification = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 4200);
  }, []);

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    if (nextRole === 'arthur' || nextRole === 'dante') {
      setActiveCharId(nextRole);
      setSelectedTokenId(nextRole);
      setFogMode('dynamic');
    }
    triggerNotification(
      nextRole === 'gm'
        ? '👑 Visão do Mestre (GM) ativada: Controle total, Sombra Preta translúcida e Tranca de Portas.'
        : `🕵️ Visão do Jogador (${nextRole.toUpperCase()}) ativada: Campo de Visão restrito pela porta e lanternas.`
    );
  };

  // Sync Character Sheet updates (PV, SAN, PE) with 3D Tokens & Automatic Conditions
  const handleUpdateCharacter = (charId, updatedChar) => {
    const prevChar = characters[charId];
    setCharacters((prev) => ({ ...prev, [charId]: updatedChar }));

    // Trigger atmospheric SFX if character enters Enlouquecendo (0 SAN) or Morrendo (0 PV)
    if (updatedChar.san.current <= 0 && prevChar?.san.current > 0) {
      soundEngine.playSFX('whispers');
      triggerNotification(`👁️ ${updatedChar.name} chegou a 0 de Sanidade e está ENLOUQUECENDO!`);
    } else if (updatedChar.hp.current <= 0 && prevChar?.hp.current > 0) {
      soundEngine.playSFX('heartbeat');
      triggerNotification(`🩸 ${updatedChar.name} caiu a 0 PV e está MORRENDO / INCONSCIENTE!`);
    }

    setTokens((prevTokens) =>
      prevTokens.map((t) => {
        if (t.id !== charId) return t;
        const nextConds = new Set(t.conditions || []);
        if (updatedChar.hp.current <= 0) nextConds.add('Morrendo');
        else nextConds.delete('Morrendo');

        if (updatedChar.san.current <= 0) nextConds.add('Enlouquecendo');
        else nextConds.delete('Enlouquecendo');

        return {
          ...t,
          hp: updatedChar.hp.current,
          maxHp: updatedChar.hp.max,
          san: updatedChar.san.current,
          maxSan: updatedChar.san.max,
          pe: updatedChar.pe.current,
          maxPe: updatedChar.pe.max,
          conditions: Array.from(nextConds),
        };
      })
    );
  };

  // Official Jambô Editora Rule for Skill / Attribute Rolls:
  // If Attribute > 0: Roll [Attribute] d20s and take the HIGHEST + Skill Training Bonus (+0/+5/+10/+15).
  // If Attribute === 0: Roll 2d20 and take the LOWEST + Skill Training Bonus.
  const handleRollOrdemTest = ({ label, attrKey, attrValue, skillBonus = 0, rank = '' }) => {
    const isZeroAttr = attrValue <= 0;
    const diceCount = isZeroAttr ? 2 : attrValue;
    const rolls = [];
    for (let i = 0; i < diceCount; i++) {
      rolls.push(Math.floor(Math.random() * 20) + 1);
    }

    const chosenDie = isZeroAttr ? Math.min(...rolls) : Math.max(...rolls);
    const total = chosenDie + skillBonus;
    const activeChar = characters[activeCharId];
    const elementColor = ELEMENT_THEMES[activeChar?.affinity]?.color || '#dc2626';

    setRollRequest({
      id: Date.now(),
      diceList: rolls.map(() => ({ sides: 20, color: elementColor })),
    });

    setLastRollResult({
      id: Date.now(),
      characterName: activeChar?.name || 'Agente',
      label,
      ruleSummary: isZeroAttr
        ? `Atributo ${attrKey} 0 → 2d20 (Pega o MENOR)`
        : `${diceCount}d20 (${attrKey}) → Pega o MAIOR + ${skillBonus} (${rank})`,
      rolls,
      chosenDie,
      bonus: skillBonus,
      total,
      isCrit: chosenDie === 20,
      isFumble: chosenDie === 1,
    });
  };

  // Roll Damage or Custom Polyhedral Dice (d4, d6, d8, d10, d12, d20)
  const handleRollDamageDice = ({ label, formula = '1d20', bonus = 0, element = 'Sangue' }) => {
    const match = formula.toLowerCase().match(/(\d+)d(\d+)/);
    const count = match ? Math.min(12, Math.max(1, parseInt(match[1], 10))) : 1;
    const sides = match ? parseInt(match[2], 10) : 20;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }
    const sumDice = rolls.reduce((a, b) => a + b, 0);
    const total = sumDice + bonus;
    const color = ELEMENT_THEMES[element]?.color || '#dc2626';

    setRollRequest({
      id: Date.now(),
      diceList: rolls.map(() => ({ sides, color })),
    });

    setLastRollResult({
      id: Date.now(),
      characterName: characters[activeCharId]?.name || 'Agente',
      label,
      ruleSummary: `Soma de Dados Físicos (${count}d${sides}${bonus ? ` + ${bonus}` : ''})`,
      rolls,
      chosenDie: sumDice,
      bonus,
      total,
      isDamage: true,
    });
  };

  // Cast Paranormal Ritual: Spend PE, Spawn 3D Element Particles & Roll Dice
  const handleCastRitual = (char, ritual) => {
    if (char.pe.current < ritual.peCost) {
      triggerNotification(`⚠️ PE Insuficiente para conjurar ${ritual.name} (Requer ${ritual.peCost} PE).`);
      return;
    }

    handleUpdateCharacter(char.id, {
      ...char,
      pe: {
        ...char.pe,
        current: Math.max(0, char.pe.current - ritual.peCost),
      },
    });

    setActiveRitualEffect({
      id: Date.now(),
      element: ritual.element,
      name: ritual.name,
    });

    handleRollDamageDice({
      label: `Ritual: ${ritual.name} (${ritual.element})`,
      formula: ritual.damageDice || '2d6',
      bonus: ritual.damageBonus || 0,
      element: ritual.element,
    });

    triggerNotification(
      `✨ ${char.name} conjurou ${ritual.name} (-${ritual.peCost} PE) • Partículas de ${ritual.element} ativadas!`
    );
  };

  // Toggle Flashlight on active character token
  const handleToggleFlashlight = () => {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === activeCharId ? { ...t, flashlightOn: t.flashlightOn === false } : t
      )
    );
  };

  // Toggle Condition on a Token in Initiative Tracker
  const handleToggleCondition = (tokenId, condId) => {
    setTokens((prev) =>
      prev.map((t) => {
        if (t.id !== tokenId) return t;
        const exists = t.conditions?.includes(condId);
        const nextConds = exists
          ? t.conditions.filter((c) => c !== condId)
          : [...(t.conditions || []), condId];
        return { ...t, conditions: nextConds };
      })
    );
  };

  // Spawn Item from Steam-style Workshop into the 3D Scene
  const handleSpawnWorkshopItem = (item) => {
    const randX = -2.2 + (Math.random() - 0.5) * 2.4;
    const randZ = (Math.random() - 0.5) * 2.6;

    if (item.spawnType === 'token') {
      const newToken = {
        id: `tok_${Date.now()}`,
        name: item.name,
        subtitle: `${item.element} • Spawnado`,
        type: 'monster',
        owner: 'gm',
        element: item.element,
        color: item.color,
        ringColor: item.color,
        x: randX,
        z: randZ,
        rotation: 0,
        hp: item.hp || 100,
        maxHp: item.hp || 100,
        san: 0,
        maxSan: 0,
        pe: 0,
        maxPe: 0,
        conditions: [],
        flashlightOn: false,
      };
      setTokens((prev) => [...prev, newToken]);
      setSelectedTokenId(newToken.id);
      triggerNotification(`👹 Miniatura 3D "${item.name}" adicionada à mesa com gravidade!`);
    } else if (item.spawnType === 'clue') {
      const newClue = {
        id: `clue_${Date.now()}`,
        title: `Dossiê Confidencial #${handouts.length + 1}`,
        subtitle: 'Pista Adicionada via Workshop',
        type: 'diary',
        room: 1,
        x: randX,
        y: 0.12,
        z: randZ,
        revealedToAll: false,
        frontHeader: 'RELATÓRIO DE CAMPO — ORDO REALITAS',
        frontDate: 'Documento Recém-Descoberto',
        frontBody:
          'Registros apontam que a oscilação da Membrana neste local foi provocada por um símbolo de Transcender oculto na sala ao lado.',
        backTitle: 'VERSO DO DOSSIÊ — ANOTAÇÃO DO AGENTE',
        backSecret: 'Use rituais ou armas com afinidade oposta para romper a proteção da entidade.',
        backStamp: 'VERIFICADO PELA BASE DA ORDEM',
      };
      setHandouts((prev) => [...prev, newClue]);
      triggerNotification(`📄 Nova Pista 3D "${newClue.title}" colocada no tabuleiro!`);
    } else {
      setSpawnedProps((prev) => [
        ...prev,
        {
          id: `prop_${Date.now()}`,
          propKind: item.propKind,
          color: item.color,
          x: randX,
          z: randZ,
        },
      ]);
      triggerNotification(`🪑 Objeto 3D "${item.name}" instanciado no cenário!`);
    }
  };

  // Share Handout with all players
  const handleShareHandout = (clue) => {
    setHandouts((prev) =>
      prev.map((h) => (h.id === clue.id ? { ...h, revealedToAll: true } : h))
    );
    triggerNotification(`📢 Pista "${clue.title}" revelada na tela de todos os jogadores!`);
  };

  const activeCharacter = characters[activeCharId] || characters.arthur;
  const activeToken = tokens.find((t) => t.id === activeCharId);
  const isPerturbado =
    activeCharacter.san.current > 0 &&
    activeCharacter.san.current <= Math.floor(activeCharacter.san.max / 2);
  const isEnlouquecendo = activeCharacter.san.current <= 0;

  return (
    <div
      className={`w-screen h-screen flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden ${
        isEnlouquecendo ? 'screen-insane-glitch' : ''
      }`}
    >
      {/* Top Bar: Role Switcher, Combat Initiative Tracker & Tactical Tools */}
      <InitiativeTracker
        role={role}
        setRole={handleRoleChange}
        tokens={tokens}
        selectedTokenId={selectedTokenId}
        setSelectedTokenId={setSelectedTokenId}
        turnIndex={turnIndex}
        setTurnIndex={setTurnIndex}
        round={round}
        setRound={setRound}
        onToggleCondition={handleToggleCondition}
        rulerForcedOn={rulerForcedOn}
        setRulerForcedOn={setRulerForcedOn}
        showTeamCursors={showTeamCursors}
        setShowTeamCursors={setShowTeamCursors}
      />

      {/* Main Workspace: Left Workshop/Audio Panel + Center 3D Tabletop + Right Character Sheet */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar: Workshop, Fog/Rituals, Clues & Soundboard */}
        <WorkshopAndAudioPanel
          role={role}
          fogMode={fogMode}
          setFogMode={setFogMode}
          manualRoom2Revealed={manualRoom2Revealed}
          setManualRoom2Revealed={setManualRoom2Revealed}
          doorLocked={doorLocked}
          setDoorLocked={setDoorLocked}
          onSpawnWorkshopItem={handleSpawnWorkshopItem}
          onTriggerRitualEffect={(element) =>
            setActiveRitualEffect({ id: Date.now(), element, name: `Pulso de ${element}` })
          }
          handouts={handouts}
          onInspectHandout={(clue) => setInspectedHandout(clue)}
        />

        {/* Center 3D Virtual Tabletop Canvas */}
        <main className="flex-1 relative h-full overflow-hidden">
          <Tabletop3D
            role={role}
            tokens={tokens}
            setTokens={setTokens}
            selectedTokenId={selectedTokenId}
            setSelectedTokenId={setSelectedTokenId}
            handouts={handouts}
            onInspectHandout={(clue) => setInspectedHandout(clue)}
            doorLocked={doorLocked}
            setDoorLocked={setDoorLocked}
            doorAngleDeg={doorAngleDeg}
            setDoorAngleDeg={setDoorAngleDeg}
            manualDoorTargetRad={manualDoorTargetRad}
            setManualDoorTargetRad={setManualDoorTargetRad}
            fogMode={fogMode}
            manualRoom2Revealed={manualRoom2Revealed}
            rollRequest={rollRequest}
            activeRitualEffect={activeRitualEffect}
            spawnedProps={spawnedProps}
            showTeamCursors={showTeamCursors}
            rulerForcedOn={rulerForcedOn}
            onNotification={triggerNotification}
          />

          {/* Sanity Distortion Vignette Overlay (Perturbado / Enlouquecendo) */}
          {(isPerturbado || isEnlouquecendo) && (
            <div
              className={`pointer-events-none absolute inset-0 z-10 ${
                isEnlouquecendo ? 'sanity-vignette-insane' : 'sanity-vignette-perturbed'
              }`}
            />
          )}

          {/* Top-Left Interactive Guide Overlay */}
          {showControlsHint && (
            <div className="absolute top-3 left-3 z-20 max-w-sm bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-3 shadow-xl text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Guia Rápido de Interação 3D
                </span>
                <button
                  onClick={() => setShowControlsHint(false)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <ul className="text-[11px] text-zinc-300 space-y-1 leading-snug">
                <li>
                  • <strong>Porta Física (Hinge Joint):</strong> Clique na porta/maçaneta com a
                  mãozinha e arraste para entreabrir e iluminar a Sala 2 pela fresta!
                </li>
                <li>
                  • <strong>Tokens & Régua 1,5m:</strong> Arraste seu token. Segure{' '}
                  <kbd className="px-1 py-0.2 bg-zinc-800 text-amber-300 rounded font-mono text-[10px]">
                    Tab
                  </kbd>{' '}
                  ou{' '}
                  <kbd className="px-1 py-0.2 bg-zinc-800 text-amber-300 rounded font-mono text-[10px]">
                    Alt
                  </kbd>{' '}
                  para medir em metros e quadrados.
                </li>
                <li>
                  • <strong>Pistas 3D (Handouts):</strong> Passe o mouse nas pistas sobre as mesas
                  e clique ou aperte{' '}
                  <kbd className="px-1 py-0.2 bg-zinc-800 text-amber-300 rounded font-mono text-[10px]">
                    Espaço
                  </kbd>
                  .
                </li>
              </ul>
            </div>
          )}

          {/* Notification Toast */}
          {notification && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-zinc-950/95 border border-red-500/60 text-xs font-semibold text-zinc-100 shadow-2xl">
              {notification}
            </div>
          )}

          {/* Floating 3D Dice Roll Result Card (Official Jambô Editora Rules) */}
          {lastRollResult && (
            <div className="absolute top-3 right-3 z-20 w-72 bg-zinc-950/95 backdrop-blur-md border border-amber-500/60 rounded-xl p-3.5 shadow-2xl animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Dices className="w-4 h-4 text-red-400" />
                  <span>{lastRollResult.label}</span>
                </div>
                <button
                  onClick={() => setLastRollResult(null)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-[10px] font-mono text-zinc-400 mb-2">
                {lastRollResult.characterName} • {lastRollResult.ruleSummary}
              </div>

              {/* Individual Rolled Dice Pills */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {lastRollResult.rolls.map((val, idx) => {
                  const isSelected =
                    !lastRollResult.isDamage && val === lastRollResult.chosenDie;
                  return (
                    <span
                      key={idx}
                      className={`px-2 py-1 rounded-md font-mono text-xs font-extrabold border ${
                        isSelected
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 scale-105 shadow'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      [{val}]
                    </span>
                  );
                })}
              </div>

              {/* Final Total Banner */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <div className="text-[11px] text-zinc-300 font-mono">
                  Dado: <strong>{lastRollResult.chosenDie}</strong>
                  {lastRollResult.bonus !== 0 && (
                    <span> + Bônus: {lastRollResult.bonus}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {lastRollResult.isCrit && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-[9px] font-bold text-white uppercase">
                      20 Natural!
                    </span>
                  )}
                  {lastRollResult.isFumble && (
                    <span className="px-1.5 py-0.5 rounded bg-red-700 text-[9px] font-bold text-white uppercase">
                      Desastre!
                    </span>
                  )}
                  <span className="text-xl font-mono font-black text-amber-300">
                    = {lastRollResult.total}
                  </span>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar: Official Ordem Paranormal Character Sheet & Dice Roller */}
        <CharacterSheetPanel
          character={activeCharacter}
          activeCharId={activeCharId}
          setActiveCharId={(id) => {
            setActiveCharId(id);
            setSelectedTokenId(id);
          }}
          allCharacters={characters}
          onUpdateCharacter={handleUpdateCharacter}
          onRollOrdemTest={handleRollOrdemTest}
          onRollDamageDice={handleRollDamageDice}
          onCastRitual={handleCastRitual}
          onToggleFlashlight={handleToggleFlashlight}
          flashlightOn={activeToken?.flashlightOn !== false}
        />
      </div>

      {/* High-Resolution 3D Handout / Clue Inspector Modal */}
      {inspectedHandout && (
        <HandoutInspectorModal
          handout={inspectedHandout}
          onClose={() => setInspectedHandout(null)}
          role={role}
          onShareWithPlayers={handleShareHandout}
        />
      )}
    </div>
  );
}
