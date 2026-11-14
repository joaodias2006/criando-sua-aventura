import { unzipSync, strFromU8 } from 'fflate';
import { makeCharacterCutoutSvg } from '../data/ordoData';

const OFFICIAL_SKILL_LIST = [
  { name: 'Acrobacia', attr: 'AGI' },
  { name: 'Adestramento', attr: 'PRE' },
  { name: 'Artes', attr: 'PRE' },
  { name: 'Atletismo', attr: 'FOR' },
  { name: 'Atualidades', attr: 'INT' },
  { name: 'Ciências', attr: 'INT' },
  { name: 'Crime', attr: 'AGI' },
  { name: 'Diplomacia', attr: 'PRE' },
  { name: 'Enganação', attr: 'PRE' },
  { name: 'Fortitude', attr: 'VIG' },
  { name: 'Furtividade', attr: 'AGI' },
  { name: 'Iniciativa', attr: 'AGI' },
  { name: 'Intimidação', attr: 'PRE' },
  { name: 'Intuição', attr: 'PRE' },
  { name: 'Investigação', attr: 'INT' },
  { name: 'Luta', attr: 'FOR' },
  { name: 'Medicina', attr: 'INT' },
  { name: 'Ocultismo', attr: 'INT' },
  { name: 'Percepção', attr: 'PRE' },
  { name: 'Pilotagem', attr: 'AGI' },
  { name: 'Pontaria', attr: 'AGI' },
  { name: 'Profissão', attr: 'INT' },
  { name: 'Reflexos', attr: 'AGI' },
  { name: 'Religião', attr: 'PRE' },
  { name: 'Sobrevivência', attr: 'INT' },
  { name: 'Tática', attr: 'INT' },
  { name: 'Tecnologia', attr: 'INT' },
  { name: 'Vontade', attr: 'PRE' },
];

/**
 * Extracts plain text (and any embedded image if present) from a .docx, .txt, or .json File
 */
export async function extractTextFromUploadedFile(file) {
  const fileName = file.name.toLowerCase();

  // If it's a .docx (ZIP containing word/document.xml and optionally word/media/*)
  if (fileName.endsWith('.docx')) {
    const buffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const unzipped = unzipSync(uint8);

    let extractedText = '';
    if (unzipped['word/document.xml']) {
      const xmlStr = strFromU8(unzipped['word/document.xml']);
      // Replace paragraph and table cell endings with newlines before stripping XML tags
      extractedText = xmlStr
        .replace(/<\/w:p>/g, '\n')
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:tc>/g, ' | ')
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }

    // Also check if the .docx has an embedded character image in word/media/
    let extractedAvatarDataUrl = null;
    const mediaKeys = Object.keys(unzipped).filter((k) =>
      /^word\/media\/.*\.(png|jpe?g|webp)$/i.test(k)
    );
    if (mediaKeys.length > 0) {
      const firstMediaKey = mediaKeys[0];
      const imgBytes = unzipped[firstMediaKey];
      const ext = firstMediaKey.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      let binary = '';
      for (let i = 0; i < imgBytes.byteLength; i++) {
        binary += String.fromCharCode(imgBytes[i]);
      }
      extractedAvatarDataUrl = `data:${mime};base64,${btoa(binary)}`;
    }

    return { text: extractedText, avatar: extractedAvatarDataUrl };
  }

  // Otherwise read as plain UTF-8 text (.txt, .md, .json, .html)
  const text = await file.text();
  return { text, avatar: null };
}

/**
 * Parses raw text from a Google Docs / Word (.docx) / C.R.I.S. sheet into a structured Ordem Paranormal Character object
 */
export function parseCharacterFromText(rawText, existingChar = null, extractedAvatar = null) {
  const text = rawText || '';
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. Try JSON first if user uploaded a JSON export
  try {
    if (text.trim().startsWith('{')) {
      const parsed = JSON.parse(text);
      if (parsed.name || parsed.nome) {
        return normalizeParsedJson(parsed, existingChar);
      }
    }
  } catch {
    // Continue with natural text parsing
  }

  // 2. Extract Character Name
  const nameMatch =
    text.match(/(?:personagem|agente|nome)\s*[:=-]\s*([^\n|]+)/i) ||
    text.match(/^#\s*([^\n]+)/m);
  let name = nameMatch ? nameMatch[1].trim() : null;
  if (!name && lines.length > 0 && lines[0].length < 40 && !lines[0].includes(':')) {
    name = lines[0];
  }
  if (!name) name = existingChar?.name || 'Novo Agente';

  // 3. Player, Class, Subclass, Origin, Patente
  const playerMatch = text.match(/(?:jogador|player)\s*[:=-]\s*([^\n|]+)/i);
  const player = playerMatch ? playerMatch[1].trim() : existingChar?.player || 'Jogador';

  let charClass = existingChar?.class || 'Especialista';
  if (/\bcombatente\b/i.test(text)) charClass = 'Combatente';
  else if (/\bocultista\b/i.test(text)) charClass = 'Ocultista';
  else if (/\bespecialista\b/i.test(text)) charClass = 'Especialista';
  else if (/\bmundano\b/i.test(text)) charClass = 'Mundano';

  const subclassMatch = text.match(/(?:trilha|subclasse)\s*[:=-]\s*([^\n|]+)/i);
  const subclass = subclassMatch
    ? subclassMatch[1].trim()
    : existingChar?.subclass || 'Agente de Campo';

  const originMatch = text.match(/(?:origem)\s*[:=-]\s*([^\n|]+)/i);
  const origin = originMatch ? originMatch[1].trim() : existingChar?.origin || 'Desconhecida';

  const patenteMatch = text.match(/(?:patente)\s*[:=-]\s*([^\n|]+)/i);
  const patente = patenteMatch ? patenteMatch[1].trim() : existingChar?.patente || 'Operador';

  // 4. NEX %
  const nexMatch =
    text.match(/nex\s*[:=-]?\s*(\d{1,3})\s*%?/i) ||
    text.match(/(\d{1,2}0|\d5)\s*%\s*(?:de\s*)?nex/i);
  const nex = nexMatch
    ? Math.min(99, Math.max(5, parseInt(nexMatch[1], 10)))
    : existingChar?.nex || 50;

  // 5. Affinity / Element
  let affinity = existingChar?.affinity || 'Sangue';
  const affMatch = text.match(/(?:afinidade|elemento)\s*[:=-]?\s*(sangue|morte|conhecimento|energia|medo)/i);
  if (affMatch) {
    const raw = affMatch[1].toLowerCase();
    affinity = raw.charAt(0).toUpperCase() + raw.slice(1);
  } else if (/\bmorte\b/i.test(text)) affinity = 'Morte';
  else if (/\bconhecimento\b/i.test(text)) affinity = 'Conhecimento';
  else if (/\benergia\b/i.test(text)) affinity = 'Energia';
  else if (/\bsangue\b/i.test(text)) affinity = 'Sangue';

  // 6. Attributes: AGI, FOR, INT, PRE, VIG
  const extractAttr = (patterns, fallback) => {
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        const val = parseInt(m[1], 10);
        if (!Number.isNaN(val) && val >= 0 && val <= 10) return val;
      }
    }
    return fallback;
  };

  const attributes = {
    AGI: extractAttr(
      [
        /(?:agilidade|agi)\s*[:=-]?\s*(\d+)/i,
        /(\d+)\s*(?:de\s*)?(?:agilidade|\bagi\b)/i,
      ],
      existingChar?.attributes?.AGI ?? 2
    ),
    FOR: extractAttr(
      [
        /(?:for[çc]a|\bfor\b)\s*[:=-]?\s*(\d+)/i,
        /(\d+)\s*(?:de\s*)?(?:for[çc]a|\bfor\b)/i,
      ],
      existingChar?.attributes?.FOR ?? 2
    ),
    INT: extractAttr(
      [
        /(?:intelecto|\bint\b)\s*[:=-]?\s*(\d+)/i,
        /(\d+)\s*(?:de\s*)?(?:intelecto|\bint\b)/i,
      ],
      existingChar?.attributes?.INT ?? 2
    ),
    PRE: extractAttr(
      [
        /(?:presen[çc]a|\bpre\b)\s*[:=-]?\s*(\d+)/i,
        /(\d+)\s*(?:de\s*)?(?:presen[çc]a|\bpre\b)/i,
      ],
      existingChar?.attributes?.PRE ?? 2
    ),
    VIG: extractAttr(
      [
        /(?:vigor|\bvig\b)\s*[:=-]?\s*(\d+)/i,
        /(\d+)\s*(?:de\s*)?(?:vigor|\bvig\b)/i,
      ],
      existingChar?.attributes?.VIG ?? 2
    ),
  };

  // 7. PV (Vida), SAN (Sanidade), PE (Esforço)
  const extractPool = (labels, defaultMax) => {
    const slashRegex = new RegExp(
      `(?:${labels})\\s*[:=-]?\\s*(\\d+)\\s*\\/\\s*(\\d+)`,
      'i'
    );
    const singleRegex = new RegExp(`(?:${labels})\\s*[:=-]?\\s*(\\d+)`, 'i');
    const mSlash = text.match(slashRegex);
    if (mSlash) {
      return {
        current: parseInt(mSlash[1], 10),
        max: parseInt(mSlash[2], 10),
      };
    }
    const mSingle = text.match(singleRegex);
    if (mSingle) {
      const v = parseInt(mSingle[1], 10);
      return { current: v, max: v };
    }
    return { current: defaultMax, max: defaultMax };
  };

  const hp = extractPool(
    'pontos de vida|vida|\\bpv\\b',
    existingChar?.hp?.max || 40 + attributes.VIG * 10
  );
  const san = extractPool(
    'sanidade|\\bsan\\b',
    existingChar?.san?.max || 50
  );
  const pe = extractPool(
    'pontos de esfor[çc]o|esfor[çc]o|\\bpe\\b',
    existingChar?.pe?.max || Math.max(10, Math.floor(nex / 5) * (2 + attributes.PRE))
  );

  // 8. Defense, Protection & Resistances
  const defMatch = text.match(/(?:defesa|\bdef\b)\s*[:=-]?\s*(\d+)/i);
  const defense = defMatch
    ? parseInt(defMatch[1], 10)
    : existingChar?.defense || 10 + attributes.AGI;

  const protMatch = text.match(/(?:prote[çc][ãa]o|armadura)\s*[:=-]\s*([^\n|]+)/i);
  const protection = protMatch
    ? protMatch[1].trim()
    : existingChar?.protection || 'Sem proteção pesada';

  const resMatch = text.match(/(?:resist[êe]ncias?|\brd\b)\s*[:=-]\s*([^\n|]+)/i);
  const resistances = resMatch ? resMatch[1].trim() : existingChar?.resistances || 'Nenhuma';

  // 9. Skills (Perícias)
  const skills = OFFICIAL_SKILL_LIST.map((sk) => {
    const escaped = sk.name.replace(/[çãáéíóúê]/gi, '.');
    const regex = new RegExp(
      `\\b${escaped}\\b[^\\n]*?(?:\\+\\s*(15|10|5)|\\b(expert|veterano|treinado)\\b)`,
      'i'
    );
    const m = text.match(regex);
    let bonus = 0;
    let rank = 'Destreinado';
    if (m) {
      if (m[1] === '15' || /expert/i.test(m[2] || '')) {
        bonus = 15;
        rank = 'Expert';
      } else if (m[1] === '10' || /veterano/i.test(m[2] || '')) {
        bonus = 10;
        rank = 'Veterano';
      } else if (m[1] === '5' || /treinado/i.test(m[2] || '')) {
        bonus = 5;
        rank = 'Treinado';
      }
    } else if (existingChar) {
      const prevSk = existingChar.skills?.find((s) => s.name === sk.name);
      if (prevSk) {
        bonus = prevSk.bonus;
        rank = prevSk.rank;
      }
    }
    return { name: sk.name, attr: sk.attr, bonus, rank };
  });

  // 10. Detect Weapons & Items with dice formulas (e.g. "Katana 1d10+5", "Pistola 1d12")
  const inventory = existingChar?.inventory ? [...existingChar.inventory] : [];
  const weaponLines = lines.filter(
    (l) => /\b\d+d(?:4|6|8|10|12|20)\b/i.test(l) && l.length < 95
  );
  if (weaponLines.length > 0) {
    const parsedWeapons = [];
    weaponLines.slice(0, 6).forEach((line, idx) => {
      const diceMatch = line.match(/(\d+d\d+)(?:\s*\+\s*(\d+))?/i);
      if (diceMatch) {
        const cleanName = line
          .replace(/(\d+d\d+)(?:\s*\+\s*\d+)?/gi, '')
          .replace(/[:|-]/g, ' ')
          .trim();
        parsedWeapons.push({
          id: `w_doc_${Date.now()}_${idx}`,
          name: cleanName || `Arma / Ataque #${idx + 1}`,
          category: 'I',
          spaces: 1,
          type: 'weapon',
          skill: /luta|faca|espada|katana|punhal|soco/i.test(line) ? 'Luta' : 'Pontaria',
          damageDice: diceMatch[1],
          damageBonus: diceMatch[2] ? parseInt(diceMatch[2], 10) : 0,
          crit: '19/x2',
        });
      }
    });
    if (parsedWeapons.length > 0) {
      inventory.splice(0, inventory.length, ...parsedWeapons);
    }
  }

  const colorMap = {
    Sangue: '#ef4444',
    Morte: '#a1a1aa',
    Conhecimento: '#facc15',
    Energia: '#06b6d4',
    Medo: '#f4f4f5',
  };
  const accentColor = colorMap[affinity] || '#f59e0b';
  const id = existingChar?.id || `char_${Date.now()}`;
  const avatar =
    extractedAvatar ||
    existingChar?.avatar ||
    makeCharacterCutoutSvg(name, accentColor, 'agent');

  return {
    id,
    name,
    player,
    class: charClass,
    subclass,
    origin,
    patente,
    nex,
    pePerTurn: Math.max(1, Math.floor(nex / 5)),
    movementMeters: 9,
    affinity,
    cursorColor: accentColor,
    tokenColor: accentColor,
    avatar,
    hp,
    san,
    pe,
    defense,
    protection,
    resistances,
    attributes,
    skills,
    inventory:
      inventory.length > 0
        ? inventory
        : [
            {
              id: 'w_default',
              name: 'Arma Principal',
              category: 'I',
              spaces: 1,
              type: 'weapon',
              skill: charClass === 'Combatente' ? 'Luta' : 'Pontaria',
              damageDice: '1d10',
              damageBonus: 2,
              crit: '19/x2',
            },
          ],
    rituals: existingChar?.rituals || [],
    notes: text.slice(0, 6000),
  };
}

function normalizeParsedJson(json, existingChar) {
  const name = json.name || json.nome || existingChar?.name || 'Agente Importado';
  return {
    ...(existingChar || {}),
    ...json,
    id: existingChar?.id || json.id || `char_${Date.now()}`,
    name,
  };
}
