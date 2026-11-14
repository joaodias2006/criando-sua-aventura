// Official Data, Sheets, Multi-Map Floors ("O Segredo na Floresta"), Frameless Character Cutouts, Handouts & Rules

export const ELEMENT_THEMES = {
  Sangue: {
    name: 'Sangue',
    color: '#dc2626',
    accent: '#ef4444',
    bg: 'rgba(220, 38, 38, 0.14)',
    border: 'rgba(239, 68, 68, 0.45)',
    quote: 'O Sangue é a entidade do sentimento. Ele busca a intensidade: dor, obsessão, paixão e fome.',
  },
  Morte: {
    name: 'Morte',
    color: '#71717a',
    accent: '#a1a1aa',
    bg: 'rgba(39, 39, 42, 0.45)',
    border: 'rgba(161, 161, 170, 0.4)',
    quote: 'Tudo tem um começo e um fim, e o Tempo leva todas as coisas. Espiral de Santo Berço.',
  },
  Conhecimento: {
    name: 'Conhecimento',
    color: '#eab308',
    accent: '#facc15',
    bg: 'rgba(234, 179, 8, 0.14)',
    border: 'rgba(250, 204, 21, 0.45)',
    quote: 'Saber tudo é perder tudo. A entidade da consciência, da razão e dos segredos proibidos.',
  },
  Energia: {
    name: 'Energia',
    color: '#06b6d4',
    accent: '#d946ef',
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(217, 70, 239, 0.45)',
    quote: 'O Caos é inevitável. Tudo que não pode ser controlado, a transformação constante e a anarquia.',
  },
  Medo: {
    name: 'Medo',
    color: '#f4f4f5',
    accent: '#ffffff',
    bg: 'rgba(244, 244, 245, 0.12)',
    border: 'rgba(255, 255, 255, 0.45)',
    quote: 'O Medo é infinito. A entidade desconhecida que enfraquece a Membrana.',
  },
};

/**
 * Generates a transparent-background FRAMELESS character cutout SVG (ONLY the person, NO circle and NO border)
 */
export function makeCharacterCutoutSvg(label = '', accentHex = '#f59e0b') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">
    <!-- Agent Person Cutout (No Circle, No Border - High Contrast Figure) -->
    <path d="M26 132 L32 66 Q34 54 48 52 L72 52 Q86 54 88 66 L94 132 L74 132 L70 98 L50 98 L46 132 Z" fill="#18181b" stroke="#f4f4f5" stroke-width="2" stroke-linejoin="round"/>
    <path d="M44 52 L60 82 L76 52 L84 64 L78 118 L42 118 L36 64 Z" fill="${accentHex}" opacity="0.88"/>
    <polygon points="50,52 70,52 60,78" fill="#09090b"/>
    <circle cx="60" cy="32" r="17" fill="#fde68a" stroke="#18181b" stroke-width="2"/>
    <path d="M42 29 Q60 10 78 29 L79 20 Q60 6 41 20 Z" fill="#18181b"/>
    <circle cx="54" cy="33" r="2.2" fill="#18181b"/>
    <circle cx="66" cy="33" r="2.2" fill="#18181b"/>
    <rect x="84" y="76" width="22" height="8" rx="3" fill="#e4e4e7" stroke="#18181b" stroke-width="1.5"/>
    <circle cx="105" cy="80" r="4" fill="#fef08a"/>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function makeAvatarSvg(initials, _bgHex, ringHex) {
  return makeCharacterCutoutSvg(initials, ringHex);
}

// Initial Multi-Map Canvas State: Supports placing multiple maps side-by-side (e.g. 1º Andar + 2º Andar) with NO size limit!
export const INITIAL_MAP_STATE = {
  id: 'mansao_multi_andar',
  name: 'Mansão (1º e 2º Andar)',
  gridEnabled: true,
  gridSize: 0.6, // Smaller, finer grid squares by default (adjustable from 0.25 to 2.0!)
  gridOpacity: 0.16,
  // Array of maps placed on the infinite table! Each has its own position (x, z), width, and natural aspect ratio.
  placedMaps: [
    {
      id: 'floor_1',
      name: '1º Andar — Térreo da Mansão',
      theme: 'wood_mansion',
      bgImageUrl: null,
      x: -8.5,
      z: 0,
      width: 15,
      height: 9,
      aspectRatio: 15 / 9,
    },
    {
      id: 'floor_2',
      name: '2º Andar — Ala Superior',
      theme: 'sanatorio',
      bgImageUrl: null,
      x: 8.5,
      z: 0,
      width: 15,
      height: 9,
      aspectRatio: 15 / 9,
    },
  ],
  walls: [
    // 1º Andar walls (around x: -16 to -1)
    { id: 'w1', x1: -16, z1: -4.5, x2: -1, z2: -4.5 },
    { id: 'w2', x1: -1, z1: -4.5, x2: -1, z2: 4.5 },
    { id: 'w3', x1: -1, z1: 4.5, x2: -16, z2: 4.5 },
    { id: 'w4', x1: -16, z1: 4.5, x2: -16, z2: -4.5 },
    { id: 'w5', x1: -8.5, z1: -4.5, x2: -8.5, z2: -1.0 },
    { id: 'w6', x1: -8.5, z1: 1.0, x2: -8.5, z2: 4.5 },
    // 2º Andar walls (around x: 1 to 16)
    { id: 'w7', x1: 1, z1: -4.5, x2: 16, z2: -4.5 },
    { id: 'w8', x1: 16, z1: -4.5, x2: 16, z2: 4.5 },
    { id: 'w9', x1: 16, z1: 4.5, x2: 1, z2: 4.5 },
    { id: 'w10', x1: 1, z1: 4.5, x2: 1, z2: -4.5 },
    { id: 'w11', x1: 8.5, z1: -4.5, x2: 8.5, z2: -1.0 },
    { id: 'w12', x1: 8.5, z1: 1.0, x2: 8.5, z2: 4.5 },
  ],
  doors: [
    {
      id: 'door_floor1',
      hingeX: -8.5,
      hingeZ: -1.0,
      length: 2.0,
      baseAngle: 0,
      angleRad: 0,
      locked: false,
    },
    {
      id: 'door_floor2',
      hingeX: 8.5,
      hingeZ: -1.0,
      length: 2.0,
      baseAngle: 0,
      angleRad: 0,
      locked: false,
    },
  ],
};

export const PRESET_MAP_TEMPLATES = [
  {
    id: 'tpl_mansion',
    name: 'Mansão de Madeira (Interior)',
    subtitle: 'Piso de tábuas corridas, tapete, escrivaninha e sala ocultista',
    theme: 'wood_mansion',
    width: 15,
    height: 9,
  },
  {
    id: 'tpl_sanatorio',
    name: '2º Andar / Corredor & quartos',
    subtitle: 'Piso frio quadriculado e salas divididas',
    theme: 'sanatorio',
    width: 15,
    height: 9,
  },
  {
    id: 'tpl_suvaco_seco',
    name: 'Bar "Suvaco Seco" (Carpazinha)',
    subtitle: 'Balcão de madeira, mesa de sinuca e depósito',
    theme: 'suvaco_seco',
    width: 15,
    height: 9,
  },
  {
    id: 'tpl_floresta',
    name: 'Floresta de Névoa & Cabana',
    subtitle: 'Área externa com árvores, trilha de terra e cabana',
    theme: 'floresta',
    width: 16,
    height: 10,
  },
];

export const INITIAL_CHARACTERS = {
  arthur: {
    id: 'arthur',
    name: 'Arthur Cervero',
    player: 'Jogador 1',
    class: 'Especialista',
    subclass: 'Atirador de Elite',
    origin: 'Gaudério Abutre',
    patente: 'Agente Especial',
    nex: 50,
    pePerTurn: 10,
    movementMeters: 9,
    affinity: 'Sangue',
    cursorColor: '#f59e0b',
    tokenColor: '#d97706',
    avatar: makeCharacterCutoutSvg('ARTHUR', '#f59e0b'),
    position: { x: -12.5, z: 1.2, rotation: 0 },
    hp: { current: 64, max: 64 },
    san: { current: 52, max: 60 },
    pe: { current: 42, max: 50 },
    defense: 19,
    protection: 'Jaqueta dos Gaudérios (+5 Defesa)',
    resistances: 'Balístico 5, Mental 2, Sangue 5',
    attributes: {
      AGI: 4,
      FOR: 1,
      INT: 3,
      PRE: 2,
      VIG: 2,
    },
    skills: [
      { name: 'Acrobacia', attr: 'AGI', bonus: 5, rank: 'Treinado' },
      { name: 'Atletismo', attr: 'FOR', bonus: 5, rank: 'Treinado' },
      { name: 'Crime', attr: 'AGI', bonus: 5, rank: 'Treinado' },
      { name: 'Diplomacia', attr: 'PRE', bonus: 5, rank: 'Treinado' },
      { name: 'Fortitude', attr: 'VIG', bonus: 5, rank: 'Treinado' },
      { name: 'Furtividade', attr: 'AGI', bonus: 10, rank: 'Veterano' },
      { name: 'Iniciativa', attr: 'AGI', bonus: 10, rank: 'Veterano' },
      { name: 'Intuição', attr: 'PRE', bonus: 5, rank: 'Treinado' },
      { name: 'Investigação', attr: 'INT', bonus: 10, rank: 'Veterano' },
      { name: 'Luta', attr: 'FOR', bonus: 0, rank: 'Destreinado' },
      { name: 'Medicina', attr: 'INT', bonus: 5, rank: 'Treinado' },
      { name: 'Ocultismo', attr: 'INT', bonus: 5, rank: 'Treinado' },
      { name: 'Percepção', attr: 'PRE', bonus: 10, rank: 'Veterano' },
      { name: 'Pontaria', attr: 'AGI', bonus: 15, rank: 'Expert' },
      { name: 'Reflexos', attr: 'AGI', bonus: 10, rank: 'Veterano' },
      { name: 'Tecnologia', attr: 'INT', bonus: 5, rank: 'Treinado' },
      { name: 'Vontade', attr: 'PRE', bonus: 5, rank: 'Treinado' },
    ],
    inventory: [
      { id: 'w1', name: 'Rifle de Precisão (.308)', category: 'III', spaces: 2, type: 'weapon', skill: 'Pontaria', damageDice: '2d10', damageBonus: 4, crit: '19/x3' },
      { id: 'w2', name: 'Pistola Tática Silenciada', category: 'I', spaces: 1, type: 'weapon', skill: 'Pontaria', damageDice: '1d12', damageBonus: 2, crit: '18/x2' },
      { id: 'i2', name: 'Lanterna Tática da Ordem', category: 'I', spaces: 1, type: 'gear' },
    ],
    rituals: [
      {
        id: 'r_arma_atroz',
        name: 'Arma Atroz',
        element: 'Sangue',
        circle: 1,
        peCost: 1,
        execution: 'Padrão',
        range: 'Toque',
        damageDice: '2d6',
        description: 'Veias carmesins envolvem a arma, concedendo +2 em testes de ataque e +1 na margem de ameaça.',
      },
    ],
    notes: 'Use a aba "Docs/Importar" para subir o arquivo .docx da ficha dos seus personagens reais!',
  },
  joui: {
    id: 'joui',
    name: 'Joui Jouki',
    player: 'Jogador 2',
    class: 'Combatente',
    subclass: 'Guerreiro (Katana)',
    origin: 'Ginasta Olímpico',
    patente: 'Operador',
    nex: 50,
    pePerTurn: 10,
    movementMeters: 9,
    affinity: 'Sangue',
    cursorColor: '#ef4444',
    tokenColor: '#dc2626',
    avatar: makeCharacterCutoutSvg('JOUI', '#ef4444'),
    position: { x: -11.0, z: -0.2, rotation: 0 },
    hp: { current: 86, max: 86 },
    san: { current: 44, max: 48 },
    pe: { current: 38, max: 45 },
    defense: 22,
    protection: 'Proteção Leve Reforçada (+5 Defesa)',
    resistances: 'Corte 5, Impacto 5',
    attributes: {
      AGI: 4,
      FOR: 3,
      INT: 1,
      PRE: 2,
      VIG: 3,
    },
    skills: [
      { name: 'Acrobacia', attr: 'AGI', bonus: 15, rank: 'Expert' },
      { name: 'Atletismo', attr: 'FOR', bonus: 10, rank: 'Veterano' },
      { name: 'Fortitude', attr: 'VIG', bonus: 10, rank: 'Veterano' },
      { name: 'Iniciativa', attr: 'AGI', bonus: 10, rank: 'Veterano' },
      { name: 'Luta', attr: 'FOR', bonus: 15, rank: 'Expert' },
      { name: 'Pontaria', attr: 'AGI', bonus: 10, rank: 'Veterano' },
      { name: 'Reflexos', attr: 'AGI', bonus: 15, rank: 'Expert' },
      { name: 'Vontade', attr: 'PRE', bonus: 5, rank: 'Treinado' },
    ],
    inventory: [
      { id: 'j1', name: 'Katana Afiada (Shinokage)', category: 'II', spaces: 2, type: 'weapon', skill: 'Luta', damageDice: '1d10', damageBonus: 6, crit: '18/x2' },
    ],
    rituals: [],
    notes: '',
  },
};

// Only Universal Character/Creature Tokens — no separate locked "monster" system; any token can have any image!
export const INITIAL_TOKENS = [
  {
    id: 'arthur',
    name: 'Arthur Cervero',
    subtitle: 'Especialista • NEX 50%',
    type: 'player',
    owner: 'arthur',
    element: 'Sangue',
    color: '#d97706',
    ringColor: '#f59e0b',
    avatar: makeCharacterCutoutSvg('ARTHUR', '#f59e0b'),
    sizeSquares: 0.9,
    x: -12.5,
    z: 1.2,
    rotation: 0,
    hp: 64,
    maxHp: 64,
    san: 52,
    maxSan: 60,
    pe: 42,
    maxPe: 50,
    conditions: [],
    flashlightOn: true,
  },
  {
    id: 'joui',
    name: 'Joui Jouki',
    subtitle: 'Combatente • NEX 50%',
    type: 'player',
    owner: 'joui',
    element: 'Sangue',
    color: '#dc2626',
    ringColor: '#ef4444',
    avatar: makeCharacterCutoutSvg('JOUI', '#ef4444'),
    sizeSquares: 0.9,
    x: -11.0,
    z: -0.4,
    rotation: 0,
    hp: 86,
    maxHp: 86,
    san: 44,
    maxSan: 48,
    pe: 38,
    maxPe: 45,
    conditions: [],
    flashlightOn: true,
  },
];

export const INITIAL_HANDOUTS = [
  {
    id: 'clue_diary',
    title: 'Diário de Investigação',
    subtitle: 'Documento Físico • 1º Andar',
    type: 'diary',
    room: 1,
    x: -11.8,
    y: 0.94,
    z: -2.2,
    revealedToAll: false,
    frontHeader: 'CADERNO DE ANOTAÇÕES — MANSÃO',
    frontDate: 'Arquivo de Investigação',
    frontBody:
      '“Encontramos a chave da escadaria que leva ao 2º Andar da mansão. As luzes lá em cima estão apagadas — mantenham as lanternas ligadas.”',
    backTitle: 'VERSO DA PÁGINA (ANOTAÇÃO SECRETA)',
    backSecret: 'DICA: Você pode arrastar seus personagens livremente do 1º Andar (à esquerda) para o 2º Andar (à direita)!',
    backStamp: 'CONFIDENCIAL • ORDO REALITAS',
  },
  {
    id: 'clue_scroll',
    title: 'Documento do 2º Andar',
    subtitle: 'Evidência • 2º Andar da Mansão',
    type: 'scroll',
    room: 2,
    x: 12.5,
    y: 0.98,
    z: -2.0,
    revealedToAll: false,
    frontHeader: 'REGISTRO DO 2º ANDAR',
    frontDate: 'Ala Superior',
    frontBody:
      'Documentos deixados no segundo andar revelam a passagem secreta e os rituais realizados na mansão.',
    backTitle: 'VERSO DO DOCUMENTO',
    backSecret: 'Inspecionar este documento concede +2 PE aos investigadores.',
    backStamp: 'ORDO REALITAS',
  },
];

export const WORKSHOP_CATALOG = [
  {
    id: 'ws_desk',
    name: 'Mesa de Madeira',
    category: 'Móveis & Cenário',
    element: 'Neutro',
    spawnType: 'prop',
    propKind: 'desk',
    color: '#78350f',
    desc: 'Mesa de investigação que pode ser movida livremente.',
  },
  {
    id: 'ws_sigil',
    name: 'Símbolo Ocultista no Chão',
    category: 'Paranormal',
    element: 'Morte',
    spawnType: 'prop',
    propKind: 'sigil',
    color: '#dc2626',
    desc: 'Símbolo da Espiral / Transcender no chão.',
  },
  {
    id: 'ws_blood',
    name: 'Mancha de Sangue / Lodo',
    category: 'Paranormal',
    element: 'Sangue',
    spawnType: 'prop',
    propKind: 'blood',
    color: '#7f1d1d',
    desc: 'Rastro deixado no piso.',
  },
  {
    id: 'ws_candles',
    name: 'Velas & Ponto de Luz',
    category: 'Iluminação',
    element: 'Conhecimento',
    spawnType: 'prop',
    propKind: 'candles',
    color: '#f59e0b',
    desc: 'Conjunto de velas acesas no mapa.',
  },
  {
    id: 'ws_clue',
    name: 'Nova Pista / Documento',
    category: 'Investigação',
    element: 'Conhecimento',
    spawnType: 'clue',
    color: '#eab308',
    desc: 'Documento brilhante inspecionável com clique ou tecla Espaço.',
  },
];

export const OFFICIAL_CONDITIONS = [
  { id: 'Sangrando', label: 'Sangrando', color: '#dc2626', desc: 'Perde 1d6 PV no início do turno.' },
  { id: 'Abalado', label: 'Abalado', color: '#a855f7', desc: '-1d20 em testes.' },
  { id: 'Paralisado', label: 'Paralisado', color: '#06b6d4', desc: 'Imóvel e indefeso.' },
  { id: 'Vulnerável', label: 'Vulnerável', color: '#f59e0b', desc: '-5 na Defesa.' },
  { id: 'Perturbado', label: 'Perturbado', color: '#6366f1', desc: 'Sanidade abaixo da metade.' },
  { id: 'Enlouquecendo', label: 'Enlouquecendo', color: '#ec4899', desc: '0 de Sanidade!' },
  { id: 'Morrendo', label: 'Morrendo', color: '#991b1b', desc: '0 de PV!' },
];
