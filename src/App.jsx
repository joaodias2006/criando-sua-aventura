import React, { useState, useCallback } from 'react';
import {
  INITIAL_MAP_STATE,
  INITIAL_CHARACTERS,
  INITIAL_TOKENS,
  INITIAL_HANDOUTS,
  ELEMENT_THEMES,
  makeCharacterCutoutSvg,
} from './data/ordoData';
import InitiativeTracker from './components/InitiativeTracker';
import WorkshopAndAudioPanel from './components/WorkshopAndAudioPanel';
import CharacterSheetPanel from './components/CharacterSheetPanel';
import TabletopCanvas2D from './components/TabletopCanvas2D';
import HandoutInspectorModal from './components/HandoutInspectorModal';
import MapAndTokenManagerModal from './components/MapAndTokenManagerModal';
import { soundEngine } from './utils/soundEngine';
import { Dices, X } from 'lucide-react';

export default function App() {
  // 1. Permission Role ('gm' or player character id)
  const [role, setRole] = useState('gm');

  // 2. Collapsible Drawers (Closed by default so 100% of the Map is visible on Mobile & Desktop!)
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightSheetOpen, setIsRightSheetOpen] = useState(false);

  // 3. Active Multi-Floor Map / Environment State (Supports multiple maps side-by-side without size limit!)
  const [currentMap, setCurrentMap] = useState(INITIAL_MAP_STATE);
  const [studioModalTab, setStudioModalTab] = useState(null);

  // 4. Characters & Frameless Tokens State
  const [characters, setCharacters] = useState(INITIAL_CHARACTERS);
  const [activeCharId, setActiveCharId] = useState('arthur');
  const [tokens, setTokens] = useState(INITIAL_TOKENS);
  const [selectedTokenId, setSelectedTokenId] = useState('arthur');

  // 5. Fog of War State ('dynamic' = Flashlight-Only | 'reveal_all' = Clear Map)
  const [fogMode, setFogMode] = useState('dynamic');
  const [manualRoom2Revealed, setManualRoom2Revealed] = useState(false);

  // 6. Inspectable Handouts & Spawned Props
  const [handouts, setHandouts] = useState(INITIAL_HANDOUTS);
  const [inspectedHandout, setInspectedHandout] = useState(null);
  const [spawnedProps, setSpawnedProps] = useState([]);

  // 7. Combat Initiative, Dice Rolls & Ritual Visuals
  const [turnIndex, setTurnIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [rollRequest, setRollRequest] = useState(null);
  const [lastRollResult, setLastRollResult] = useState(null);
  const [activeRitualEffect, setActiveRitualEffect] = useState(null);

  // 8. Tabletop Toggles & Toast Notifications
  const [showTeamCursors, setShowTeamCursors] = useState(false);
  const [rulerForcedOn, setRulerForcedOn] = useState(false);
  const [notification, setNotification] = useState(null);

  const triggerNotification = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    if (nextRole !== 'gm' && characters[nextRole]) {
      setActiveCharId(nextRole);
      setSelectedTokenId(nextRole);
      setFogMode('dynamic');
    }
    triggerNotification(
      nextRole === 'gm'
        ? '👑 Modo Mestre: Mova tudo, desenhe paredes e suba mapas!'
        : '🔦 Visão do Jogador: Apenas o feixe da Lanterna ilumina o mapa.'
    );
  };

  // Sync Character Sheet updates (Name, Avatar, PV, SAN, PE) with Map Tokens
  const handleUpdateCharacter = (charId, updatedChar) => {
    const prevChar = characters[charId];
    setCharacters((prev) => ({ ...prev, [charId]: updatedChar }));

    if (updatedChar.san.current <= 0 && prevChar?.san.current > 0) {
      soundEngine.playSFX('whispers');
      triggerNotification(`👁️ ${updatedChar.name} chegou a 0 SAN (ENLOUQUECENDO)!`);
    } else if (updatedChar.hp.current <= 0 && prevChar?.hp.current > 0) {
      soundEngine.playSFX('heartbeat');
      triggerNotification(`🩸 ${updatedChar.name} caiu a 0 PV (MORRENDO)!`);
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
          name: updatedChar.name,
          avatar: updatedChar.avatar || t.avatar,
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

  // Create a brand new Character (from .docx import or blank button) & spawn their frameless Token on the map
  const handleCreateCharacter = (newChar) => {
    setCharacters((prev) => ({ ...prev, [newChar.id]: newChar }));
    setActiveCharId(newChar.id);
    setSelectedTokenId(newChar.id);

    const firstFloor = currentMap?.placedMaps?.[0] || { x: -8.5, z: 0 };
    const newToken = {
      id: newChar.id,
      name: newChar.name,
      subtitle: `${newChar.class} • NEX ${newChar.nex}%`,
      type: 'player',
      owner: newChar.id,
      element: newChar.affinity || 'Sangue',
      color: newChar.tokenColor || '#f59e0b',
      ringColor: newChar.cursorColor || '#f59e0b',
      avatar:
        newChar.avatar ||
        makeCharacterCutoutSvg(newChar.name.slice(0, 6), '#f59e0b'),
      sizeSquares: 0.95,
      x: (firstFloor.x || 0) - 2 + (Math.random() - 0.5) * 1.5,
      z: (firstFloor.z || 0) + (Math.random() - 0.5) * 1.5,
      rotation: 0,
      hp: newChar.hp.current,
      maxHp: newChar.hp.max,
      san: newChar.san.current,
      maxSan: newChar.san.max,
      pe: newChar.pe.current,
      maxPe: newChar.pe.max,
      conditions: [],
      flashlightOn: true,
    };

    setTokens((prev) => [...prev, newToken]);
    triggerNotification(`✅ Personagem "${newChar.name}" criado e colocado no mapa!`);
  };

  // Delete a Character and remove their token from the map
  const handleDeleteCharacter = (charId) => {
    const remainingIds = Object.keys(characters).filter((id) => id !== charId);
    if (remainingIds.length === 0) return;

    setCharacters((prev) => {
      const copy = { ...prev };
      delete copy[charId];
      return copy;
    });
    setTokens((prev) => prev.filter((t) => t.id !== charId));
    setActiveCharId(remainingIds[0]);
    setSelectedTokenId(remainingIds[0]);
    triggerNotification('🗑️ Personagem removido da mesa.');
  };

  // Official Jambô Editora Rule for Skill / Attribute Rolls
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
        ? `Atributo ${attrKey} 0 → 2d20 (Menor)`
        : `${diceCount}d20 (${attrKey}) → Maior + ${skillBonus} (${rank})`,
      rolls,
      chosenDie,
      bonus: skillBonus,
      total,
      isCrit: chosenDie === 20,
      isFumble: chosenDie === 1,
    });
  };

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
      ruleSummary: `Soma (${count}d${sides}${bonus ? ` + ${bonus}` : ''})`,
      rolls,
      chosenDie: sumDice,
      bonus,
      total,
      isDamage: true,
    });
  };

  const handleCastRitual = (char, ritual) => {
    if (char.pe.current < ritual.peCost) {
      triggerNotification(`⚠️ PE Insuficiente para conjurar ${ritual.name}.`);
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
      label: `Ritual: ${ritual.name}`,
      formula: ritual.damageDice || '2d6',
      bonus: ritual.damageBonus || 0,
      element: ritual.element,
    });
  };

  const handleToggleFlashlight = () => {
    setTokens((prev) =>
      prev.map((t) =>
        t.id === activeCharId ? { ...t, flashlightOn: t.flashlightOn === false } : t
      )
    );
  };

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

  const handleSpawnWorkshopItem = (item) => {
    const randX = -1.8 + (Math.random() - 0.5) * 2.5;
    const randZ = (Math.random() - 0.5) * 2.5;

    if (item.spawnType === 'token') {
      const fallbackAvatar = makeCharacterCutoutSvg(
        item.name.slice(0, 6).toUpperCase(),
        item.color,
        'monster'
      );
      const newToken = {
        id: `tok_${Date.now()}`,
        name: item.name,
        subtitle: `${item.element} • Na Mesa`,
        type: 'monster',
        owner: 'gm',
        element: item.element,
        color: item.color,
        ringColor: item.color,
        avatar: item.avatar || fallbackAvatar,
        sizeSquares: item.sizeSquares || 1.15,
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
      triggerNotification(`🖼️ "${item.name}" colocado no mapa!`);
    } else if (item.spawnType === 'clue') {
      const newClue = {
        id: `clue_${Date.now()}`,
        title: `Pista #${handouts.length + 1}`,
        subtitle: 'Documento no Mapa',
        type: 'diary',
        room: 1,
        x: randX,
        y: 0.12,
        z: randZ,
        revealedToAll: false,
        frontHeader: 'RELATÓRIO DE CAMPO — CARPAZINHA',
        frontDate: 'Documento Descoberto',
        frontBody:
          'Anotações encontradas no local indicam a presença do símbolo espiral.',
        backTitle: 'VERSO DO DOCUMENTO',
        backSecret: 'Procure a passagem oculta atrás da porta principal.',
        backStamp: 'ORDO REALITAS',
      };
      setHandouts((prev) => [...prev, newClue]);
      triggerNotification(`📄 Nova Pista colocada no mapa!`);
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
      triggerNotification(`🪑 "${item.name}" adicionado ao mapa!`);
    }
  };

  const handleSpawnImageProp = (name, dataUrl) => {
    setSpawnedProps((prev) => [
      ...prev,
      {
        id: `imgprop_${Date.now()}`,
        name,
        imageUrl: dataUrl,
        sizeMeters: 2.4,
        x: 0,
        z: 0,
      },
    ]);
    triggerNotification(`🪑 Imagem "${name}" adicionada ao mapa!`);
  };

  const handleShareHandout = (clue) => {
    setHandouts((prev) =>
      prev.map((h) => (h.id === clue.id ? { ...h, revealedToAll: true } : h))
    );
    triggerNotification(`📢 Pista "${clue.title}" revelada para todos!`);
  };

  const activeCharacter =
    characters[activeCharId] || Object.values(characters)[0];
  const activeToken = tokens.find((t) => t.id === activeCharId);
  const isPerturbado =
    activeCharacter &&
    activeCharacter.san.current > 0 &&
    activeCharacter.san.current <= Math.floor(activeCharacter.san.max / 2);
  const isEnlouquecendo =
    activeCharacter && activeCharacter.san.current <= 0;

  return (
    <div
      className={`w-screen h-screen flex flex-col bg-[#09090b] text-zinc-100 overflow-hidden ${
        isEnlouquecendo ? 'screen-insane-glitch' : ''
      }`}
    >
      {/* Compact Header (Works cleanly on Mobile & Desktop) */}
      <InitiativeTracker
        role={role}
        setRole={handleRoleChange}
        tokens={tokens}
        selectedTokenId={selectedTokenId}
        setSelectedTokenId={(id) => {
          setSelectedTokenId(id);
          if (characters[id]) setActiveCharId(id);
        }}
        turnIndex={turnIndex}
        setTurnIndex={setTurnIndex}
        round={round}
        setRound={setRound}
        onToggleCondition={handleToggleCondition}
        rulerForcedOn={rulerForcedOn}
        setRulerForcedOn={setRulerForcedOn}
        onToggleLeftDrawer={() => {
          setIsLeftDrawerOpen((v) => !v);
          setIsRightSheetOpen(false);
        }}
        onToggleRightSheet={() => {
          setIsRightSheetOpen((v) => !v);
          setIsLeftDrawerOpen(false);
        }}
        activeCharacter={activeCharacter}
      />

      {/* Fullscreen Map Container + Collapsible Drawers */}
      <div className="flex-1 relative overflow-hidden">
        {/* Left Collapsible Drawer: Menu, Scenario, Lighting, Clues & Audio */}
        <WorkshopAndAudioPanel
          isOpen={isLeftDrawerOpen}
          onClose={() => setIsLeftDrawerOpen(false)}
          role={role}
          fogMode={fogMode}
          setFogMode={setFogMode}
          manualRoom2Revealed={manualRoom2Revealed}
          setManualRoom2Revealed={setManualRoom2Revealed}
          onSpawnWorkshopItem={handleSpawnWorkshopItem}
          onSpawnImageProp={handleSpawnImageProp}
          onTriggerRitualEffect={(element) =>
            setActiveRitualEffect({ id: Date.now(), element, name: `Pulso de ${element}` })
          }
          handouts={handouts}
          onInspectHandout={(clue) => setInspectedHandout(clue)}
          onOpenMapModal={() => setStudioModalTab('map')}
          onOpenTokenModal={() => setStudioModalTab('tokens')}
        />

        {/* Fullscreen 60FPS Tabletop Canvas */}
        <main className="w-full h-full relative overflow-hidden">
          <TabletopCanvas2D
            role={role}
            currentMap={currentMap}
            onUpdateMap={setCurrentMap}
            onOpenMapModal={() => setStudioModalTab('map')}
            onOpenTokenModal={() => setStudioModalTab('tokens')}
            tokens={tokens}
            setTokens={setTokens}
            selectedTokenId={selectedTokenId}
            setSelectedTokenId={(id) => {
              setSelectedTokenId(id);
              if (characters[id]) setActiveCharId(id);
            }}
            handouts={handouts}
            setHandouts={setHandouts}
            onInspectHandout={(clue) => setInspectedHandout(clue)}
            fogMode={fogMode}
            setFogMode={setFogMode}
            manualRoom2Revealed={manualRoom2Revealed}
            rollRequest={rollRequest}
            activeRitualEffect={activeRitualEffect}
            spawnedProps={spawnedProps}
            setSpawnedProps={setSpawnedProps}
            showTeamCursors={showTeamCursors}
            rulerForcedOn={rulerForcedOn}
            onNotification={triggerNotification}
          />

          {/* Sanity Distortion Vignette Overlay */}
          {(isPerturbado || isEnlouquecendo) && (
            <div
              className={`pointer-events-none absolute inset-0 z-10 ${
                isEnlouquecendo ? 'sanity-vignette-insane' : 'sanity-vignette-perturbed'
              }`}
            />
          )}

          {/* Notification Toast */}
          {notification && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-xl bg-zinc-950/95 border border-amber-500/60 text-xs font-semibold text-zinc-100 shadow-2xl text-center max-w-xs sm:max-w-md">
              {notification}
            </div>
          )}

          {/* Floating Dice Roll Result Card */}
          {lastRollResult && (
            <div className="absolute top-3 left-3 z-20 w-64 sm:w-72 bg-zinc-950/95 backdrop-blur-md border border-amber-500/60 rounded-xl p-3 shadow-2xl animate-fadeIn">
              <div className="flex items-start justify-between gap-2 mb-1">
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

              <div className="flex flex-wrap gap-1 mb-2">
                {lastRollResult.rolls.map((val, idx) => {
                  const isSelected =
                    !lastRollResult.isDamage && val === lastRollResult.chosenDie;
                  return (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded font-mono text-xs font-extrabold border ${
                        isSelected
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      [{val}]
                    </span>
                  );
                })}
              </div>

              <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between">
                <span className="text-[11px] text-zinc-300 font-mono">
                  Dado: <strong>{lastRollResult.chosenDie}</strong>
                  {lastRollResult.bonus !== 0 && ` + ${lastRollResult.bonus}`}
                </span>
                <span className="text-lg font-mono font-black text-amber-300">
                  = {lastRollResult.total}
                </span>
              </div>
            </div>
          )}
        </main>

        {/* Right Collapsible Drawer: C.R.I.S. Character Sheet + .docx Importer + Damage Calculator */}
        <CharacterSheetPanel
          isOpen={isRightSheetOpen}
          onClose={() => setIsRightSheetOpen(false)}
          character={activeCharacter}
          activeCharId={activeCharId}
          setActiveCharId={(id) => {
            setActiveCharId(id);
            setSelectedTokenId(id);
          }}
          allCharacters={characters}
          onUpdateCharacter={handleUpdateCharacter}
          onCreateCharacter={handleCreateCharacter}
          onDeleteCharacter={handleDeleteCharacter}
          onRollOrdemTest={handleRollOrdemTest}
          onRollDamageDice={handleRollDamageDice}
          onCastRitual={handleCastRitual}
          onToggleFlashlight={handleToggleFlashlight}
          flashlightOn={activeToken?.flashlightOn !== false}
          onNotification={triggerNotification}
        />
      </div>

      {/* Handout / Clue Inspector Modal */}
      {inspectedHandout && (
        <HandoutInspectorModal
          handout={inspectedHandout}
          onClose={() => setInspectedHandout(null)}
          role={role}
          onShareWithPlayers={handleShareHandout}
        />
      )}

      {/* Map & Frameless Token Studio Modal */}
      {studioModalTab && (
        <MapAndTokenManagerModal
          initialTab={studioModalTab}
          onClose={() => setStudioModalTab(null)}
          currentMap={currentMap}
          onSelectOrUpdateMap={setCurrentMap}
          tokens={tokens}
          setTokens={setTokens}
          onNotification={triggerNotification}
        />
      )}
    </div>
  );
}
