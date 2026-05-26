// SVG Scene Engine - Enhanced Hybrid Renderer
// Camera system, parallax backgrounds, dynamic lighting, canvas particles,
// screen effects, weather system, RAF render loop
// Drop-in replacement for renderer.js

const SVGRenderer = {
  container: null,
  assets: {},
  assetMeta: {},
  currentScene: null,
  loadedCount: 0,
  characterStates: {},
  _animationTimers: {},
  _svgCache: {},
  _layerOrder: ['scene-background', 'scene-characters', 'scene-objects', 'scene-effects'],

  // ── Camera System ──────────────────────────────────────────────
  camera: { x: 0, y: 0, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1, smoothing: 0.08 },
  _cameraPanStart: null,
  _cameraTweens: [],

  // ── Parallax ───────────────────────────────────────────────────
  _parallaxLayers: {},

  // ── Dynamic Lighting ───────────────────────────────────────────
  lightSources: new Map(),

  // ── Canvas Particles ───────────────────────────────────────────
  _canvas: null,
  _ctx: null,
  _particlePool: [],
  _particleAlive: [],
  _particleEmitters: [],
  POOL_SIZE: 300,

  // ── Screen Effects ─────────────────────────────────────────────
  _shakeIntensity: 0,
  _shakeDuration: 0,
  _shakeElapsed: 0,
  _flashEl: null,
  _vignetteEl: null,
  _letterboxEl: null,

  // ── RAF ────────────────────────────────────────────────────────
  _frameId: null,
  _lastTime: 0,
  _weatherType: null,

  // ── Cached DOM ─────────────────────────────────────────────────
  _layers: {},
  _lastLightCount: 0,

  // ── Layer sizing ───────────────────────────────────────────────
  LAYER_SIZES: {
    character:  { w: 120, h: 160, emoji: 48 },
    object:     { w: 80,  h: 80,  emoji: 32 },
    effect:     { w: 160, h: 160, emoji: 64 },
  },

  // ── Grid System (16 cols × 9 rows, matching 16:9) ─────────────
  GRID_COLS: 16,
  GRID_ROWS: 9,
  _gridOverlay: null,
  _showGrid: false,

  // ── Keyword → emoji ───────────────────────────────────────────
  KEYWORD_EMOJI: {
    dragon:'🐉',wolf:'🐺',bear:'🐻',cat:'🐱',dog:'🐶',bird:'🐦',fish:'🐟',
    spider:'🕷️',snake:'🐍',bat:'🦇',rat:'🐀',eagle:'🦅',lion:'🦁',
    tree:'🌳',flower:'🌸',rock:'🪨',water:'💧',fire:'🔥',ice:'🧊',
    door:'🚪',window:'🪟',book:'📖',key:'🔑',coin:'🪙',gem:'💎',
    crown:'👑',ring:'💍',shield:'🛡️',bow:'🏹',staff:'🪄',axe:'🪓',
    moon:'🌙',sun:'☀️',star:'⭐',cloud:'☁️',lightning:'⚡',
    skull:'💀',bone:'🦴',chest:'📦',barrel:'🛢️',rope:'🪢',
    boat:'⛵',ship:'🏴‍☠️',flag:'🚩',
    food:'🍗',bread:'🍞',cheese:'🧀',apple:'🍎',meat:'🥩',
    chair:'🪑',bed:'🛏️',candle:'🕯️',bell:'🔔',
    ghost:'👻',angel:'👼',demon:'👹',fairy:'🧚',
    sword:'⚔️',dagger:'🗡️',wand:'🪄',hammer:'🔨',
    hooded:'🫣',hood:'🫣',cloak:'🧣',mysterious:'🌑',stranger:'🌑',
    figure:'🧍',person:'🧑',man:'👨',woman:'👩',child:'👶',
    king:'👑',queen:'👸',knight:'⚔️',wizard:'🧙',witch:'🧙‍♀️',
    priest:'⛪',merchant:'💰',thief:'🥷',assassin:'🥷',
    bandit:'🗡️',pirate:'🏴‍☠️',soldier:'💂',guard:'💂',
    mushroom:'🍄',leaf:'🍃',branch:'🌿',root:'🌱',
    pond:'💧',ocean:'🌊',wave:'🌊',island:'🏝️',
    map:'🗺️',scroll:'📜',potion:'🧪',poison:'☠️',
    lantern:'🏮',mirror:'🪞',clock:'⏰',compass:'🧭',
    bag:'🎒',hat:'🎩',mask:'🎭',ring:'💍',
    dark:'🌑',shadow:'👤',light:'💡',glow:'✨',
    danger:'⚠️',safe:'✅',secret:'🤫',trap:'🪤',
  },

  // ── Emoji Asset Registry ──────────────────────────────────────
  EMOJI_MAP: {
    'bg-forest-day':     { emoji: '🌳', gradient: ['#1a4a1a','#2d5a1e','#87ceeb'], label: '森林·白天' },
    'bg-forest-night':   { emoji: '🌲', gradient: ['#0a1a0a','#1a2a1a','#1a1a3a'], label: '森林·夜晚' },
    'bg-tavern-interior':{ emoji: '🍺', gradient: ['#3a2010','#5a3020','#2a1508'], label: '酒馆内部' },
    'bg-crossroad':      { emoji: '🛤️', gradient: ['#3a3a2a','#5a5a3a','#8a8a6a'], label: '十字路口' },
    'bg-town-square':    { emoji: '🏛️', gradient: ['#4a4a5a','#6a6a7a','#8a8a9a'], label: '小镇广场' },
    'bg-cave-entrance':  { emoji: '🕳️', gradient: ['#1a1a1a','#2a2a2a','#3a3a3a'], label: '洞穴入口' },
    'bg-market':         { emoji: '🏪', gradient: ['#5a4a2a','#7a6a3a','#9a8a5a'], label: '集市' },
    'bg-castle-gate':    { emoji: '🏰', gradient: ['#3a3a4a','#5a5a6a','#7a7a8a'], label: '城堡大门' },
    'bg-castle':         { emoji: '🏯', gradient: ['#2a2a3a','#4a4a5a','#6a6a7a'], label: '城堡' },
    'bg-cave':           { emoji: '⛰️', gradient: ['#0a0a0a','#1a1a1a','#2a2a2a'], label: '洞穴' },
    'bg-forest':         { emoji: '🌿', gradient: ['#1a3a1a','#2a4a2a','#3a5a3a'], label: '森林' },
    'bg-mountain':       { emoji: '🏔️', gradient: ['#4a4a5a','#7a7a8a','#b0b0c0'], label: '山峰' },
    'bg-river':          { emoji: '🌊', gradient: ['#1a3a5a','#2a5a8a','#4a8ab0'], label: '河边' },
    'bg-tavern':         { emoji: '🍻', gradient: ['#4a2a10','#6a3a18','#8a5a28'], label: '酒馆' },
    'bg-village':        { emoji: '🏘️', gradient: ['#3a4a2a','#5a6a3a','#8a9a5a'], label: '村庄' },
    'warrior-idle':  { emoji: '⚔️', label: '战士', states: { idle:'⚔️', fighting:'🗡️', surprised:'😵' } },
    'warrior':       { emoji: '🗡️', label: '战士', states: { idle:'🗡️', fighting:'⚔️', surprised:'😵' } },
    'mage-idle':     { emoji: '🧙', label: '法师', states: { idle:'🧙', casting:'🔮', surprised:'😲' } },
    'mage':          { emoji: '🔮', label: '法师', states: { idle:'🔮', casting:'✨', surprised:'😲' } },
    'npc-merchant':  { emoji: '🧛', label: '商人', states: { idle:'🧛', surprised:'😱', drinking:'🍺' } },
    'merchant':      { emoji: '💰', label: '商人', states: { idle:'💰', surprised:'😱', drinking:'🍺' } },
    'npc-guard':     { emoji: '💂', label: '卫兵', states: { idle:'💂', fighting:'🛡️', surprised:'😨' } },
    'guard':         { emoji: '🛡️', label: '守卫', states: { idle:'🛡️', fighting:'⚔️', surprised:'😨' } },
    'animal-sheep':  { emoji: '🐑', label: '绵羊', states: { idle:'🐑', surprised:'🐏', eating:'🐑' } },
    'animal-horse':  { emoji: '🐴', label: '马', states: { idle:'🐴', fighting:'🦄' } },
    'bard':          { emoji: '🎵', label: '吟游诗人', states: { idle:'🎵', drinking:'🎶', surprised:'😲' } },
    'healer':        { emoji: '💉', label: '治疗师', states: { idle:'💉', casting:'✨', surprised:'😨' } },
    'rogue':         { emoji: '🥷', label: '盗贼', states: { idle:'🥷', fighting:'🗡️', surprised:'😰' } },
    'villager':      { emoji: '🧑', label: '村民', states: { idle:'🧑', surprised:'😨', eating:'😋' } },
    'table':   { emoji: '🪑', label: '桌子' },
    'chest':   { emoji: '📦', label: '宝箱' },
    'torch':   { emoji: '🔦', label: '火把' },
    'sword':   { emoji: '⚔️', label: '剑' },
    'potion':  { emoji: '🧪', label: '药水' },
    'fire':          { emoji: '🔥', label: '火焰', isEffect: true },
    'fog':           { emoji: '🌫️', label: '雾气', isEffect: true },
    'magic-sparkle': { emoji: '✨', label: '魔法闪光', isEffect: true },
    'rain':          { emoji: '🌧️', label: '雨', isEffect: true },
    'smoke':         { emoji: '💨', label: '烟雾', isEffect: true },
    'magic-circle':  { emoji: '⭕', label: '法阵', isEffect: true },
    // New backgrounds
    'bg-smithy':     { emoji: '⚒️', gradient: ['#2a1a0a','#4a2a10','#1a0a00'], label: '铁匠铺' },
    'bg-mage-tower': { emoji: '🗼', gradient: ['#1a1030','#2a1a4a','#0a0820'], label: '法师塔' },
    'bg-desert':     { emoji: '🏜️', gradient: ['#c4a055','#e8c875','#f5e0a0'], label: '沙漠' },
    // New characters
    'warrior-combat':{ emoji: '🗡️', label: '战士(战斗)', states: { idle:'🗡️', fighting:'⚔️', surprised:'😵' } },
    'king':          { emoji: '👑', label: '国王', states: { idle:'👑', surprised:'😨', fighting:'⚔️' } },
    // New objects
    'shield':  { emoji: '🛡️', label: '盾牌' },
    'bow':     { emoji: '🏹', label: '弓' },
    'scroll':  { emoji: '📜', label: '卷轴' },
    'key':     { emoji: '🔑', label: '钥匙' },
    'barrel':  { emoji: '🛢️', label: '木桶' },
  },

  // ── Composition keyword modifiers ────────────────────────────
  COMPOSITION_MODS: {
    'giant':   { scale: 2.5, shadow: true },
    'huge':    { scale: 2.0, shadow: true },
    'boss':    { scale: 3.0, shadow: true, glow: true },
    'large':   { scale: 1.5, shadow: true },
    'tiny':    { scale: 0.5 },
    'small':   { scale: 0.7 },
    'massive': { scale: 3.5, shadow: true, glow: true },
    'gem':     { filter: 'saturate(1.8) brightness(1.3)', overlays: ['💎'] },
    'crystal': { filter: 'hue-rotate(180deg) saturate(1.5) brightness(1.2)', overlays: ['🔮'] },
    'ruby':    { filter: 'hue-rotate(-30deg) saturate(2) brightness(1.1)', overlays: ['💎'] },
    'emerald': { filter: 'hue-rotate(100deg) saturate(2) brightness(1.2)', overlays: ['💎'] },
    'sapphire':{ filter: 'hue-rotate(200deg) saturate(2) brightness(1.1)', overlays: ['💎'] },
    'golden':  { filter: 'sepia(0.8) saturate(2) brightness(1.2)', overlays: ['✨'] },
    'silver':  { filter: 'saturate(0.3) brightness(1.4)', overlays: ['✨'] },
    'fire':    { filter: 'hue-rotate(-10deg) saturate(1.5)', overlays: ['🔥'] },
    'ice':     { filter: 'hue-rotate(180deg) saturate(0.8) brightness(1.4)', overlays: ['❄️'] },
    'shadow':  { filter: 'brightness(0.5) saturate(0.3)', overlays: ['🌑'] },
    'dark':    { filter: 'brightness(0.6) saturate(0.5)', overlays: ['🌑'] },
    'holy':    { filter: 'brightness(1.4) saturate(0.3)', overlays: ['✝️'] },
    'poison':  { filter: 'hue-rotate(80deg) saturate(1.5)', overlays: ['☠️'] },
    'electric':{ filter: 'hue-rotate(60deg) saturate(2) brightness(1.3)', overlays: ['⚡'] },
    'ancient': { filter: 'sepia(0.4) saturate(0.8)', overlays: ['🏛️'] },
    'corrupted':{filter: 'hue-rotate(270deg) saturate(1.5) brightness(0.8)', overlays: ['💀'] },
    'frozen':  { filter: 'hue-rotate(180deg) brightness(1.3)', overlays: ['🧊'] },
    'burning': { filter: 'saturate(2) brightness(1.2)', overlays: ['🔥','🔥'] },
    'crowned': { overlays: ['👑'], overlayY: -35 },
    'armored': { overlays: ['🛡️'], overlayX: 25 },
    'winged':  { overlays: ['🪽','🪽'], overlaySpread: 'left-right' },
    'horned':  { overlays: ['📯'], overlayY: -30 },
    'masked':  { overlays: ['🎭'], overlayY: -15 },
    'cloaked': { overlays: ['🧣'] },
    'armed':   { overlays: ['⚔️'], overlayX: 30 },
    'enchanted':{overlays: ['✨','💫'], overlaySpread: 'around' },
    'cursed':  { overlays: ['💀'], overlayY: -25 },
    'blessed': { overlays: ['✨'], overlayY: -20 },
    'mounted': { overlays: ['🐴'], overlayY: 20, overlayScale: 1.5 },
  },

  // ── Pre-defined compositions for known creatures ──────────────
  COMPOSITION_PRESETS: {
    'gem-serpent':   { base: '🐍', scale: 2.5, filter: 'hue-rotate(120deg) saturate(2) brightness(1.3)', overlays: ['💎','💎','✨'], shadow: true, glow: true, label: '宝石巨蛇' },
    'fire-dragon':   { base: '🐉', scale: 2.8, filter: 'hue-rotate(-20deg) saturate(1.5)', overlays: ['🔥','🔥','💥'], shadow: true, glow: true, label: '火龙' },
    'ice-dragon':    { base: '🐉', scale: 2.8, filter: 'hue-rotate(180deg) brightness(1.3)', overlays: ['❄️','❄️','🧊'], shadow: true, glow: true, label: '冰龙' },
    'shadow-lord':   { base: '🧛', scale: 2.5, filter: 'brightness(0.4) saturate(0.2)', overlays: ['🌑','💀','✨'], shadow: true, glow: true, label: '暗影领主' },
    'golden-king':   { base: '🤴', scale: 2.2, filter: 'sepia(0.8) saturate(2) brightness(1.3)', overlays: ['👑','✨','⚜️'], shadow: true, label: '黄金之王' },
    'skeleton-army': { base: '💀', scale: 1.5, overlays: ['⚔️','🛡️','💀'], shadow: true, label: '骷髅军团' },
    'spider-queen':  { base: '🕷️', scale: 2.5, filter: 'hue-rotate(270deg)', overlays: ['🕸️','🕸️','👁️'], shadow: true, glow: true, label: '蛛后' },
    'wolf-pack':     { base: '🐺', scale: 1.8, overlays: ['🐺','🐺'], shadow: true, label: '狼群' },
    'treant':        { base: '🌳', scale: 2.5, overlays: ['🍃','🌿','🐛'], shadow: true, label: '树人' },
    'golem':         { base: '🗿', scale: 2.8, filter: 'saturate(0.5)', overlays: ['⛏️','💎'], shadow: true, glow: true, label: '石像鬼' },
    'phoenix':       { base: '🦅', scale: 2.0, filter: 'hue-rotate(-20deg) saturate(2) brightness(1.3)', overlays: ['🔥','🔥','✨'], glow: true, label: '凤凰' },
    'lich':          { base: '🧙', scale: 2.0, filter: 'brightness(0.6) hue-rotate(270deg)', overlays: ['💀','📜','✨'], shadow: true, glow: true, label: '巫妖' },
    'kraken':        { base: '🐙', scale: 3.0, filter: 'hue-rotate(180deg) saturate(1.3)', overlays: ['🌊','⚓','💀'], shadow: true, label: '海妖' },
    'demon-lord':    { base: '👹', scale: 2.8, filter: 'saturate(1.5)', overlays: ['🔥','💀','⚔️'], shadow: true, glow: true, label: '魔王' },
    'angel':         { base: '👼', scale: 2.2, filter: 'brightness(1.4) saturate(0.5)', overlays: ['✨','✨','🕊️'], glow: true, label: '天使' },
    'mimic':         { base: '📦', scale: 1.5, overlays: ['👅','👁️','🦷'], shadow: true, label: '宝箱怪' },
    'slime-king':    { base: '🟢', scale: 2.5, filter: 'hue-rotate(100deg)', overlays: ['👑','💚','💧'], shadow: true, label: '史莱姆王' },
    'vampire':       { base: '🧛', scale: 2.0, filter: 'brightness(0.7)', overlays: ['🦇','🩸','🌙'], shadow: true, glow: true, label: '吸血鬼' },
  },

  // ── Semantic compositions (common objects → visual recipe) ────
  // Layout types: overlays=circle around base, ring=stone ring, top=above, side=left-right
  SEMANTIC: {
    // ── Structures ───────────────────────────────────────────
    'well':      { base:'🕳️', ring:['🪨','🪨','🪨','🪨','🪨','🪨'], label:'井' },
    'fountain':  { base:'💧', ring:['🪨','🪨','🪨','🪨'], overlays:['💧','💧'], label:'喷泉' },
    'campfire':  { base:'🔥', ring:['🪵','🪵','🪵'], overlays:['✨','✨'], label:'篝火' },
    'altar':     { base:'🪨', top:['🕯️','🕯️'], overlays:['✨'], label:'祭坛' },
    'forge':     { base:'🔥', top:['🔨','⚔️'], label:'铁匠铺' },
    'cauldron':  { base:'🫕', top:['💨','💨','💨'], label:'大锅' },
    'throne':    { base:'🪑', top:['👑'], overlays:['✨'], label:'王座' },
    'statue':    { base:'🗿', ring:['🪨','🪨'], label:'雕像' },
    'pillar':    { base:'🏛️', label:'石柱' },
    'gate':      { base:'🚪', top:['🏰'], label:'大门' },
    'bridge':    { base:'🌉', label:'桥' },
    'grave':     { base:'🪦', label:'墓碑' },
    'tomb':      { base:'🪦', ring:['💀','💀','💀'], label:'古墓' },
    'crypt':     { base:'🕳️', ring:['💀','💀'], overlays:['🕸️'], label:'地穴' },
    'shrine':    { base:'⛩️', top:['✨','✨'], label:'神龛' },
    'tent':      { base:'⛺', label:'帐篷' },
    'cart':      { base:'🛒', label:'推车' },
    'wagon':     { base:'🛒', label:'马车' },
    'ladder':    { base:'🪜', label:'梯子' },
    'sign':      { base:'🪧', label:'告示牌' },
    'stocks':    { base:'🪵', label:'刑具' },
    'cage':      { base:'🔒', ring:['🔩','🔩','🔩'], label:'笼子' },
    'cell':      { base:'🔒', ring:['🧱','🧱','🧱','🧱'], label:'牢房' },
    'pier':      { base:'🪵', top:['⚓'], label:'码头' },
    'raft':      { base:'🪵', ring:['🪵','🪵','🪵'], label:'木筏' },
    'boat':      { base:'⛵', label:'小船' },
    'ship':      { base:'🚢', label:'大船' },
    'dock':      { base:'⚓', top:['🪵','🪵'], label:'码头' },
    'scaffold':  { base:'🪵', top:['🪢'], label:'绞刑架' },
    'gallows':   { base:'🪵', top:['🪢','💀'], label:'绞刑台' },
    'pillory':   { base:'🪵', label:'枷锁' },
    'pyre':      { base:'🔥', ring:['🪵','🪵','🪵','🪵'], label:'火刑台' },
    'obelisk':   { base:'🗿', top:['✨'], label:'方尖碑' },
    'totem':     { base:'🗿', top:['🔥'], label:'图腾' },
    'banner':    { base:'🚩', label:'旗帜' },
    'flag':      { base:'🚩', label:'旗帜' },
    'torch':     { base:'🔥', label:'火把' },
    'lamp':      { base:'🏮', label:'灯' },
    'chandelier':{ base:'🪔', top:['✨','✨'], label:'吊灯' },
    'candelabra':{ base:'🕯️', label:'烛台' },
    'bell':      { base:'🔔', label:'钟' },
    'bellows':   { base:'🪭', label:'风箱' },
    'anvil':     { base:'🔨', label:'铁砧' },
    'mill':      { base:'🏗️', label:'磨坊' },
    'windmill':  { base:'🏗️', label:'风车' },
    'stable':    { base:'🐴', label:'马厩' },
    'kennel':    { base:'🐕', label:'狗窝' },
    'coop':      { base:'🐔', label:'鸡窝' },
    'nest':      { base:'🪹', top:['🥚','🥚'], label:'鸟巢' },
    'hive':      { base:'🍯', top:['🐝','🐝'], label:'蜂巢' },
    'den':       { base:'🕳️', top:['💀'], label:'兽穴' },
    'burrow':    { base:'🕳️', top:['🐰'], label:'兔窝' },
    'pond':      { base:'💧', ring:['🌿','🌿','🌿'], label:'池塘' },
    'pool':      { base:'💧', ring:['🪨','🪨','🪨'], label:'水池' },
    'spring':    { base:'💧', ring:['🪨','🪨'], label:'泉水' },
    'oasis':     { base:'🌴', ring:['💧','💧'], label:'绿洲' },
    'stump':     { base:'🪵', label:'树桩' },
    'bush':      { base:'🌿', ring:['🌿','🌿'], label:'灌木' },
    'thicket':   { base:'🌿', ring:['🌿','🌿','🌿'], label:'树丛' },
    'rock':      { base:'🪨', label:'岩石' },
    'boulder':   { base:'🪨', scale:1.5, label:'巨石' },
    'mushroom':  { base:'🍄', ring:['🍄','🍄'], label:'蘑菇丛' },
    'flowers':   { base:'🌸', ring:['🌼','🌻','🌷'], label:'花丛' },
    'herb':      { base:'🌿', label:'草药' },
    'vine':      { base:'🌱', label:'藤蔓' },
    'web':       { base:'🕸️', label:'蛛网' },
    'cocoon':    { base:'🪱', label:'虫茧' },
    'corpse':    { base:'💀', label:'尸体' },
    'skeleton':  { base:'💀', ring:['🦴','🦴','🦴'], label:'骷髅' },
    'bones':     { base:'🦴', ring:['🦴','🦴'], label:'骸骨' },
    'rubble':    { base:'🪨', ring:['🧱','🧱'], label:'瓦砾' },
    'debris':    { base:'🪵', ring:['🍂','🍂'], label:'残骸' },
    'chest':     { base:'📦', top:['✨'], label:'宝箱' },
    'barrel':    { base:'🛢️', label:'木桶' },
    'crate':     { base:'📦', label:'箱子' },
    'sack':      { base:'🎒', label:'麻袋' },
    'bag':       { base:'🎒', label:'袋子' },
    'coffin':    { base:'⚰️', label:'棺材' },
    'casket':    { base:'⚰️', top:['✨'], label:'华丽棺材' },
    'mirror':    { base:'🪞', label:'镜子' },
    'painting':  { base:'🖼️', label:'画' },
    'tapestry':  { base:'🖼️', label:'挂毯' },
    'carpet':    { base:'🧶', label:'地毯' },
    'curtain':   { base:'🪟', label:'帘子' },
    'door':      { base:'🚪', label:'门' },
    'window':    { base:'🪟', label:'窗' },
    'wall':      { base:'🧱', label:'墙' },
    'floor':     { base:'⬛', label:'地板' },
    'ceiling':   { base:'🔲', label:'天花板' },
    'roof':      { base:'🏠', label:'屋顶' },
    'stairs':    { base:'🪜', label:'楼梯' },
    'ramp':      { base:'📐', label:'斜坡' },
    'pit':       { base:'🕳️', label:'深坑' },
    'hole':      { base:'🕳️', label:'洞' },
    'tunnel':    { base:'🕳️', ring:['🧱','🧱','🧱'], label:'隧道' },
    'passage':   { base:'🚪', label:'通道' },
    'corridor':  { base:'🚪', label:'走廊' },
    'room':      { base:'🚪', label:'房间' },
    'chamber':   { base:'🚪', label:'密室' },
    'vault':     { base:'🔒', label:'金库' },
    'treasury':  { base:'💰', top:['👑','💎'], label:'宝库' },
    'library':   { base:'📚', label:'图书馆' },
    'study':     { base:'📖', label:'书房' },
    'workshop':  { base:'🔨', label:'工坊' },
    'laboratory':{ base:'🧪', top:['⚗️'], label:'实验室' },
    'kitchen':   { base:'🍳', label:'厨房' },
    'pantry':    { base:'🫙', label:'储藏室' },
    'cellar':    { base:'🍷', label:'酒窖' },
    'dungeon':   { base:'⛓️', ring:['💀','💀'], label:'地牢' },
    'prison':    { base:'🔒', ring:['🧱','🧱','🧱','🧱'], label:'监狱' },
    'arena':     { base:'🏟️', label:'竞技场' },
    'colosseum': { base:'🏟️', label:'斗兽场' },
    'market':    { base:'🏪', label:'市场' },
    'shop':      { base:'🏪', label:'商店' },
    'inn':       { base:'🏨', label:'旅店' },
    'tavern':    { base:'🍺', label:'酒馆' },
    'pub':       { base:'🍻', label:'酒吧' },
    'temple':    { base:'⛪', label:'神殿' },
    'church':    { base:'⛪', label:'教堂' },
    'chapel':    { base:'⛪', label:'小教堂' },
    'cathedral': { base:'⛪', label:'大教堂' },
    'monastery': { base:'⛪', label:'修道院' },
    'tower':     { base:'🗼', label:'塔' },
    'castle':    { base:'🏰', label:'城堡' },
    'palace':    { base:'🏯', label:'宫殿' },
    'fortress':  { base:'🏰', label:'要塞' },
    'keep':      { base:'🏰', label:'主堡' },
    'wall':      { base:'🧱', label:'城墙' },
    'rampart':   { base:'🧱', label:'壁垒' },
    'moat':      { base:'💧', label:'护城河' },
    'garden':    { base:'🏡', label:'花园' },
    'park':      { base:'🏞️', label:'公园' },
    'cemetery':  { base:'⚰️', ring:['🪦','🪦','🪦'], label:'墓地' },
    'graveyard': { base:'🪦', ring:['💀','💀','💀'], label:'坟场' },
    'battlefield':{ base:'⚔️', ring:['💀','💀','💀','💀'], label:'战场' },
    'ruins':     { base:'🏛️', ring:['🧱','🧱','🧱'], label:'废墟' },
    'wreckage':  { base:'🪵', ring:['💥','💥'], label:'残骸' },
    'camp':      { base:'🏕️', label:'营地' },
    'base':      { base:'🏕️', label:'基地' },
    'outpost':   { base:'🗼', label:'哨站' },
    'watchtower':{ base:'🗼', top:['🔭'], label:'瞭望塔' },
    'lighthouse':{ base:'🗼', top:['💡'], label:'灯塔' },
    'windmill':  { base:'🏗️', label:'风车' },
    'watermill': { base:'🏗️', top:['💧'], label:'水车' },
    'mine':      { base:'⛏️', label:'矿井' },
    'quarry':    { base:'⛏️', ring:['🪨','🪨'], label:'采石场' },
    'farm':      { base:'🌾', label:'农场' },
    'field':     { base:'🌾', label:'田地' },
    'vineyard':  { base:'🍇', label:'葡萄园' },
    'orchard':   { base:'🍎', label:'果园' },
    'pasture':   { base:'🐑', label:'牧场' },
    'meadow':    { base:'🌾', label:'草地' },
    'marsh':     { base:'🌿', ring:['💧','💧'], label:'沼泽' },
    'swamp':     { base:'🌿', ring:['💧','💧','💀'], label:'湿地' },
    'desert':    { base:'🏜️', label:'沙漠' },
    'dune':      { base:'🏜️', label:'沙丘' },
    'cliff':     { base:'🪨', label:'悬崖' },
    'canyon':    { base:'🪨', ring:['🪨','🪨'], label:'峡谷' },
    'ravine':    { base:'🕳️', ring:['🪨','🪨'], label:'深谷' },
    'volcano':   { base:'🌋', label:'火山' },
    'glacier':   { base:'🧊', label:'冰川' },
    'iceberg':   { base:'🧊', label:'冰山' },
    'waterfall': { base:'💧', top:['💧','💧'], label:'瀑布' },
    'rapids':    { base:'🌊', label:'急流' },
    'whirlpool': { base:'🌀', label:'漩涡' },
    'island':    { base:'🏝️', label:'岛屿' },
    'peninsula': { base:'🏝️', label:'半岛' },
    'reef':      { base:'🪸', label:'珊瑚礁' },
    'lagoon':    { base:'💧', ring:['🌴','🌴'], label:'泻湖' },
    'harbor':    { base:'⚓', label:'港口' },
    'port':      { base:'🚢', label:'码头' },
    'lighthouse':{ base:'🗼', top:['💡'], label:'灯塔' },
    'signal':    { base:'🔥', label:'烽火' },
    'beacon':    { base:'🔥', top:['✨'], label:'灯塔' },
    'waypoint':  { base:'🚩', label:'路标' },
    'marker':    { base:'🪧', label:'标记' },
    'crossroads':{ base:'🛤️', label:'十字路口' },
    'junction':  { base:'🛤️', label:'岔路' },
    'fork':      { base:'🛤️', label:'岔口' },
    'path':      { base:'🛤️', label:'小路' },
    'trail':     { base:'🛤️', label:'小径' },
    'road':      { base:'🛣️', label:'大路' },
    'highway':   { base:'🛣️', label:'公路' },
    'tunnel':    { base:'🕳️', label:'隧道' },
    'mine':      { base:'⛏️', label:'矿洞' },
    'shaft':     { base:'🕳️', label:'竖井' },
    'pit':       { base:'🕳️', label:'陷阱坑' },
    'trap':      { base:'🪤', label:'陷阱' },
    'snare':     { base:'🪤', label:'圈套' },
    'ward':      { base:'✨', label:'结界' },
    'barrier':   { base:'🛡️', label:'屏障' },
    'rune':      { base:'✨', label:'符文' },
    'glyph':     { base:'✨', label:'符文' },
    'circle':    { base:'⭕', label:'法阵' },
    'pentagram': { base:'⭐', label:'五芒星' },
    'sigil':     { base:'✨', label:'印记' },
    'portal':    { base:'🌀', label:'传送门' },
    'gate':      { base:'🚪', label:'大门' },
    'archway':   { base:'🏛️', label:'拱门' },
    'entrance':  { base:'🚪', label:'入口' },
    'exit':      { base:'🚪', label:'出口' },
    'threshold': { base:'🚪', label:'门槛' },
    'foyer':     { base:'🚪', label:'门厅' },
    'lobby':     { base:'🚪', label:'大厅' },
    'hall':      { base:'🏛️', label:'大厅' },
    'gallery':   { base:'🖼️', label:'画廊' },
    'auditorium':{ base:'🏛️', label:'礼堂' },
    'throne':    { base:'👑', label:'王座' },
    'seat':      { base:'🪑', label:'座位' },
    'bench':     { base:'🪑', label:'长凳' },
    'stool':     { base:'🪑', label:'凳子' },
    'table':     { base:'🪑', label:'桌子' },
    'desk':      { base:'🪑', label:'书桌' },
    'counter':   { base:'🪑', label:'柜台' },
    'shelf':     { base:'📚', label:'书架' },
    'bookcase':  { base:'📚', label:'书柜' },
    'cabinet':   { base:'🗄️', label:'柜子' },
    'wardrobe':  { base:'🚪', label:'衣柜' },
    'dresser':   { base:'🗄️', label:'梳妆台' },
    'bed':       { base:'🛏️', label:'床' },
    'cot':       { base:'🛏️', label:'简易床' },
    'hammock':   { base:'🛏️', label:'吊床' },
    'pillow':    { base:'🛋️', label:'枕头' },
    'blanket':   { base:'🧣', label:'毯子' },
    'rug':       { base:'🧶', label:'地毯' },
    'mat':       { base:'🧶', label:'垫子' },
    'basket':    { base:'🧺', label:'篮子' },
    'bucket':    { base:'🪣', label:'水桶' },
    'bowl':      { base:'🥣', label:'碗' },
    'plate':     { base:'🍽️', label:'盘子' },
    'cup':       { base:'☕', label:'杯子' },
    'mug':       { base:'🍺', label:'马克杯' },
    'goblet':    { base:'🏆', label:'酒杯' },
    'chalice':   { base:'🏆', label:'圣杯' },
    'jug':       { base:'🏺', label:'水壶' },
    'vase':      { base:'🏺', label:'花瓶' },
    'jar':       { base:'🫙', label:'罐子' },
    'bottle':    { base:'🍾', label:'瓶子' },
    'flask':     { base:'🧪', label:'烧瓶' },
    'vial':      { base:'🧪', label:'试管' },
    'potion':    { base:'🧪', label:'药水' },
    'philtre':   { base:'🧪', label:'魔药' },
    'elixir':    { base:'🧪', label:'灵药' },
    'herbs':     { base:'🌿', label:'草药' },
    'ingredients':{ base:'🧪', label:'材料' },
    'reagents':  { base:'🧪', label:'试剂' },
    'scroll':    { base:'📜', label:'卷轴' },
    'tome':      { base:'📖', label:'典籍' },
    'grimoire':  { base:'📖', label:'魔法书' },
    'journal':   { base:'📓', label:'日记' },
    'letter':    { base:'✉️', label:'信件' },
    'note':      { base:'📝', label:'纸条' },
    'map':       { base:'🗺️', label:'地图' },
    'compass':   { base:'🧭', label:'指南针' },
    'key':       { base:'🔑', label:'钥匙' },
    'lock':      { base:'🔒', label:'锁' },
    'chain':     { base:'⛓️', label:'锁链' },
    'rope':      { base:'🪢', label:'绳子' },
    'ladder':    { base:'🪜', label:'梯子' },
    'rope':      { base:'🪢', label:'绳索' },
    'grapple':   { base:'🪝', label:'抓钩' },
    'hook':      { base:'🪝', label:'钩子' },
    'pulley':    { base:'⚙️', label:'滑轮' },
    'lever':     { base:'⚙️', label:'杠杆' },
    'switch':    { base:'🔘', label:'开关' },
    'button':    { base:'🔴', label:'按钮' },
    'crank':     { base:'⚙️', label:'曲柄' },
    'gear':      { base:'⚙️', label:'齿轮' },
    'spring':    { base:'🔧', label:'弹簧' },
    'mechanism': { base:'⚙️', label:'机关' },
    'device':    { base:'⚙️', label:'装置' },
    'machine':   { base:'⚙️', label:'机器' },
    'contraption':{ base:'⚙️', label:'奇妙装置' },
    'gadget':    { base:'🔧', label:'小工具' },
    'tool':      { base:'🔧', label:'工具' },
    'instrument':{ base:'🔧', label:'器具' },
    'apparatus': { base:'⚙️', label:'器械' },

    // ── Chinese keywords (中文关键词) ──────────────────────────
    '井':    { base:'🕳️', ring:['🪨','🪨','🪨','🪨','🪨','🪨'], label:'井' },
    '泉水':  { base:'💧', ring:['🪨','🪨'], label:'泉水' },
    '喷泉':  { base:'💧', ring:['🪨','🪨','🪨','🪨'], label:'喷泉' },
    '祭坛':  { base:'🪨', top:['🕯️','🕯️'], label:'祭坛' },
    '篝火':  { base:'🔥', ring:['🪵','🪵','🪵'], label:'篝火' },
    '铁匠铺':{ base:'🔥', top:['🔨'], label:'铁匠铺' },
    '王座':  { base:'🪑', top:['👑'], label:'王座' },
    '雕像':  { base:'🗿', ring:['🪨','🪨'], label:'雕像' },
    '石柱':  { base:'🏛️', label:'石柱' },
    '大门':  { base:'🚪', top:['🏰'], label:'大门' },
    '桥':    { base:'🌉', label:'桥' },
    '墓碑':  { base:'🪦', label:'墓碑' },
    '古墓':  { base:'🪦', ring:['💀','💀','💀'], label:'古墓' },
    '神龛':  { base:'⛩️', top:['✨','✨'], label:'神龛' },
    '帐篷':  { base:'⛺', label:'帐篷' },
    '梯子':  { base:'🪜', label:'梯子' },
    '笼子':  { base:'🔒', ring:['🔩','🔩','🔩'], label:'笼子' },
    '牢房':  { base:'🔒', ring:['🧱','🧱','🧱','🧱'], label:'牢房' },
    '木筏':  { base:'🪵', ring:['🪵','🪵','🪵'], label:'木筏' },
    '小船':  { base:'⛵', label:'小船' },
    '大船':  { base:'🚢', label:'大船' },
    '码头':  { base:'⚓', top:['🪵','🪵'], label:'码头' },
    '绞刑架':{ base:'🪵', top:['🪢'], label:'绞刑架' },
    '火刑台':{ base:'🔥', ring:['🪵','🪵','🪵','🪵'], label:'火刑台' },
    '方尖碑':{ base:'🗿', top:['✨'], label:'方尖碑' },
    '图腾':  { base:'🗿', top:['🔥'], label:'图腾' },
    '旗帜':  { base:'🚩', label:'旗帜' },
    '火把':  { base:'🔥', label:'火把' },
    '灯笼':  { base:'🏮', label:'灯笼' },
    '吊灯':  { base:'🪔', top:['✨','✨'], label:'吊灯' },
    '烛台':  { base:'🕯️', label:'烛台' },
    '钟':    { base:'🔔', label:'钟' },
    '铁砧':  { base:'🔨', label:'铁砧' },
    '磨坊':  { base:'🏗️', label:'磨坊' },
    '风车':  { base:'🏗️', label:'风车' },
    '马厩':  { base:'🐴', label:'马厩' },
    '鸟巢':  { base:'🪹', top:['🥚','🥚'], label:'鸟巢' },
    '蜂巢':  { base:'🍯', top:['🐝','🐝'], label:'蜂巢' },
    '兽穴':  { base:'🕳️', top:['💀'], label:'兽穴' },
    '池塘':  { base:'💧', ring:['🌿','🌿','🌿'], label:'池塘' },
    '水池':  { base:'💧', ring:['🪨','🪨','🪨'], label:'水池' },
    '灌木':  { base:'🌿', ring:['🌿','🌿'], label:'灌木' },
    '树丛':  { base:'🌿', ring:['🌿','🌿','🌿'], label:'树丛' },
    '岩石':  { base:'🪨', label:'岩石' },
    '巨石':  { base:'🪨', scale:1.5, label:'巨石' },
    '蘑菇丛':{ base:'🍄', ring:['🍄','🍄'], label:'蘑菇丛' },
    '花丛':  { base:'🌸', ring:['🌼','🌻','🌷'], label:'花丛' },
    '草药':  { base:'🌿', label:'草药' },
    '藤蔓':  { base:'🌱', label:'藤蔓' },
    '蛛网':  { base:'🕸️', label:'蛛网' },
    '骷髅':  { base:'💀', ring:['🦴','🦴','🦴'], label:'骷髅' },
    '骸骨':  { base:'🦴', ring:['🦴','🦴'], label:'骸骨' },
    '瓦砾':  { base:'🪨', ring:['🧱','🧱'], label:'瓦砾' },
    '残骸':  { base:'🪵', ring:['🍂','🍂'], label:'残骸' },
    '宝箱':  { base:'📦', top:['✨'], label:'宝箱' },
    '木桶':  { base:'🛢️', label:'木桶' },
    '箱子':  { base:'📦', label:'箱子' },
    '麻袋':  { base:'🎒', label:'麻袋' },
    '棺材':  { base:'⚰️', label:'棺材' },
    '镜子':  { base:'🪞', label:'镜子' },
    '画':    { base:'🖼️', label:'画' },
    '挂毯':  { base:'🖼️', label:'挂毯' },
    '地毯':  { base:'🧶', label:'地毯' },
    '门':    { base:'🚪', label:'门' },
    '窗':    { base:'🪟', label:'窗' },
    '墙':    { base:'🧱', label:'墙' },
    '地板':  { base:'⬛', label:'地板' },
    '天花板':{ base:'🔲', label:'天花板' },
    '屋顶':  { base:'🏠', label:'屋顶' },
    '楼梯':  { base:'🪜', label:'楼梯' },
    '深坑':  { base:'🕳️', label:'深坑' },
    '洞':    { base:'🕳️', label:'洞' },
    '隧道':  { base:'🕳️', ring:['🧱','🧱','🧱'], label:'隧道' },
    '通道':  { base:'🚪', label:'通道' },
    '走廊':  { base:'🚪', label:'走廊' },
    '密室':  { base:'🚪', label:'密室' },
    '金库':  { base:'🔒', label:'金库' },
    '宝库':  { base:'💰', top:['👑','💎'], label:'宝库' },
    '图书馆':{ base:'📚', label:'图书馆' },
    '书房':  { base:'📖', label:'书房' },
    '工坊':  { base:'🔨', label:'工坊' },
    '实验室':{ base:'🧪', top:['⚗️'], label:'实验室' },
    '厨房':  { base:'🍳', label:'厨房' },
    '酒窖':  { base:'🍷', label:'酒窖' },
    '地牢':  { base:'⛓️', ring:['💀','💀'], label:'地牢' },
    '监狱':  { base:'🔒', ring:['🧱','🧱','🧱','🧱'], label:'监狱' },
    '竞技场':{ base:'🏟️', label:'竞技场' },
    '市场':  { base:'🏪', label:'市场' },
    '商店':  { base:'🏪', label:'商店' },
    '旅店':  { base:'🏨', label:'旅店' },
    '酒馆':  { base:'🍺', label:'酒馆' },
    '神殿':  { base:'⛪', label:'神殿' },
    '教堂':  { base:'⛪', label:'教堂' },
    '塔':    { base:'🗼', label:'塔' },
    '城堡':  { base:'🏰', label:'城堡' },
    '宫殿':  { base:'🏯', label:'宫殿' },
    '要塞':  { base:'🏰', label:'要塞' },
    '花园':  { base:'🏡', label:'花园' },
    '墓地':  { base:'⚰️', ring:['🪦','🪦','🪦'], label:'墓地' },
    '坟场':  { base:'🪦', ring:['💀','💀','💀'], label:'坟场' },
    '战场':  { base:'⚔️', ring:['💀','💀','💀','💀'], label:'战场' },
    '废墟':  { base:'🏛️', ring:['🧱','🧱','🧱'], label:'废墟' },
    '营地':  { base:'🏕️', label:'营地' },
    '哨站':  { base:'🗼', label:'哨站' },
    '瞭望塔':{ base:'🗼', top:['🔭'], label:'瞭望塔' },
    '灯塔':  { base:'🗼', top:['💡'], label:'灯塔' },
    '矿井':  { base:'⛏️', label:'矿井' },
    '采石场':{ base:'⛏️', ring:['🪨','🪨'], label:'采石场' },
    '农场':  { base:'🌾', label:'农场' },
    '田地':  { base:'🌾', label:'田地' },
    '葡萄园':{ base:'🍇', label:'葡萄园' },
    '果园':  { base:'🍎', label:'果园' },
    '牧场':  { base:'🐑', label:'牧场' },
    '草地':  { base:'🌾', label:'草地' },
    '沼泽':  { base:'🌿', ring:['💧','💧'], label:'沼泽' },
    '沙漠':  { base:'🏜️', label:'沙漠' },
    '悬崖':  { base:'🪨', label:'悬崖' },
    '峡谷':  { base:'🪨', ring:['🪨','🪨'], label:'峡谷' },
    '火山':  { base:'🌋', label:'火山' },
    '冰川':  { base:'🧊', label:'冰川' },
    '瀑布':  { base:'💧', top:['💧','💧'], label:'瀑布' },
    '漩涡':  { base:'🌀', label:'漩涡' },
    '岛屿':  { base:'🏝️', label:'岛屿' },
    '港口':  { base:'⚓', label:'港口' },
    '十字路口':{ base:'🛤️', label:'十字路口' },
    '岔路':  { base:'🛤️', label:'岔路' },
    '小路':  { base:'🛤️', label:'小路' },
    '陷阱':  { base:'🪤', label:'陷阱' },
    '结界':  { base:'✨', label:'结界' },
    '符文':  { base:'✨', label:'符文' },
    '法阵':  { base:'⭕', label:'法阵' },
    '传送门':{ base:'🌀', label:'传送门' },
    '拱门':  { base:'🏛️', label:'拱门' },
    '入口':  { base:'🚪', label:'入口' },
    '出口':  { base:'🚪', label:'出口' },
    '大厅':  { base:'🏛️', label:'大厅' },
    '桌子':  { base:'🪑', label:'桌子' },
    '椅子':  { base:'🪑', label:'椅子' },
    '床':    { base:'🛏️', label:'床' },
    '书架':  { base:'📚', label:'书架' },
    '柜子':  { base:'🗄️', label:'柜子' },
    '水桶':  { base:'🪣', label:'水桶' },
    '碗':    { base:'🥣', label:'碗' },
    '杯子':  { base:'☕', label:'杯子' },
    '酒杯':  { base:'🏆', label:'酒杯' },
    '圣杯':  { base:'🏆', label:'圣杯' },
    '花瓶':  { base:'🏺', label:'花瓶' },
    '罐子':  { base:'🫙', label:'罐子' },
    '瓶子':  { base:'🍾', label:'瓶子' },
    '药水':  { base:'🧪', label:'药水' },
    '卷轴':  { base:'📜', label:'卷轴' },
    '魔法书':{ base:'📖', label:'魔法书' },
    '地图':  { base:'🗺️', label:'地图' },
    '钥匙':  { base:'🔑', label:'钥匙' },
    '锁':    { base:'🔒', label:'锁' },
    '锁链':  { base:'⛓️', label:'锁链' },
    '绳子':  { base:'🪢', label:'绳子' },
    '齿轮':  { base:'⚙️', label:'齿轮' },
    '机关':  { base:'⚙️', label:'机关' },
    '工具':  { base:'🔧', label:'工具' },
  },

  // ── State → emoji overlay ─────────────────────────────────────
  STATE_EMOJI: {
    idle:       null,
    surprised:  '❗',
    eating:     '🍖',
    drinking:   '🍺',
    casting:    '✨',
    fighting:   '💥',
    look_left:  '👈',
    spit_drink: '💦',
    overturn:   '💫',
    overturned: '💫',
    shatter:    '💥',
    broken:     '💔',
    push:       '💨',
    open:       '🔓',
    closed:     '🔒',
    empty:      '🫗',
    lit:        '🔥',
    extinguished:'💨',
  },

  // ── Init ──────────────────────────────────────────────────────
  async init() {
    this.container = document.getElementById('scene-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'scene-container';
      document.body.prepend(this.container);
    }
    this.container.style.cssText += ';will-change:transform;';
    this._injectStyles();
    this._buildDOMStructure();
    this._initCanvas();
    this._initParticlePool();
    this._loadAllAssets();
    await this._loadSvgAssets();
    this._renderDefaultScene();
    this.startLoop();
    const svgCount = Object.keys(this._svgCache).length;
    console.log(`[HybridRenderer] ${this.loadedCount} assets (${svgCount} SVG + ${this.loadedCount - svgCount} emoji-only) | Grid: ${this.GRID_COLS}×${this.GRID_ROWS}`);
  },

  // ── DOM structure with parallax layers ────────────────────────
  _buildDOMStructure() {
    this.container.innerHTML = '';
    this._layers = {};

    const lc = document.createElement('div');
    lc.className = 'scene-camera';
    lc.style.cssText = 'position:absolute;inset:0;transform-origin:center center;will-change:transform;';
    this.container.appendChild(lc);
    this._cameraContainer = lc;

    const layers = [
      'parallax-far', 'parallax-mid', 'parallax-near',
      'scene-background', 'scene-objects', 'scene-characters', 'scene-effects'
    ];
    for (const name of layers) {
      const div = document.createElement('div');
      div.className = `scene-layer ${name}`;
      lc.appendChild(div);
      this._layers[name] = div;
    }
  },

  // ── Canvas particle overlay ───────────────────────────────────
  _initCanvas() {
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'particle-canvas';
    this._canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:40;width:100%;height:100%;';
    this._ctx = this._canvas.getContext('2d');
    this.container.appendChild(this._canvas);
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());
  },

  _resizeCanvas() {
    if (!this._canvas) return;
    const rect = this.container.getBoundingClientRect();
    this._canvas.width = rect.width * devicePixelRatio;
    this._canvas.height = rect.height * devicePixelRatio;
    this._canvas.style.width = rect.width + 'px';
    this._canvas.style.height = rect.height + 'px';
    this._ctx = this._canvas.getContext('2d');
    this._ctx.scale(devicePixelRatio, devicePixelRatio);
  },

  // ── Particle pool ──────────────────────────────────────────────
  _initParticlePool() {
    this._particlePool = [];
    this._particleAlive = [];
    for (let i = 0; i < this.POOL_SIZE; i++) {
      this._particlePool.push(this._createParticle());
    }
  },

  _createParticle() {
    return { x:0, y:0, vx:0, vy:0, life:0, maxLife:0, size:0, color:'#fff', alpha:1, rotation:0, type:'dust', alive:false };
  },

  _getParticle() {
    for (const p of this._particlePool) {
      if (!p.alive) return p;
    }
    // Pool exhausted: reuse oldest alive particle
    const p = this._particleAlive.shift();
    if (p) p.alive = false;
    return p || this._createParticle();
  },

  // ── Styles injection ──────────────────────────────────────────
  _injectStyles() {
    if (document.getElementById('hybrid-renderer-styles')) return;
    const style = document.createElement('style');
    style.id = 'hybrid-renderer-styles';
    style.textContent = `
      #scene-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
      }
      #scene-container .scene-camera {
        position: absolute;
        inset: 0;
      }
      .scene-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .parallax-far  { z-index: 1; will-change: transform; }
      .parallax-mid  { z-index: 2; will-change: transform; }
      .parallax-near { z-index: 3; will-change: transform; }
      .scene-background { z-index: 4; }
      .scene-objects   { z-index: 10; }
      .scene-characters { z-index: 20; }
      .scene-effects   { z-index: 30; }

      .scene-bg {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
        transition: opacity 0.6s ease;
        overflow: hidden;
      }
      .scene-bg .bg-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .scene-bg .bg-svg svg {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .scene-bg .bg-emoji {
        font-size: min(40vw, 40vh);
        opacity: 0.15;
        filter: blur(2px);
        position: absolute;
      }
      .scene-bg .bg-label {
        position: absolute;
        bottom: 12px;
        left: 12px;
        font-size: 14px;
        color: rgba(255,255,255,0.4);
        letter-spacing: 2px;
        z-index: 2;
      }
      .scene-bg .bg-grid {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 60px 60px;
      }

      .scene-entity {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
        cursor: default;
        transition: left 0.8s cubic-bezier(.4,0,.2,1),
                    top 0.8s cubic-bezier(.4,0,.2,1),
                    opacity 0.4s ease,
                    transform 0.3s ease;
        transform: translate(-50%, -100%);
        will-change: transform, opacity;
      }
      .scene-entity .entity-svg {
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      .scene-entity .entity-svg svg {
        width: 100%;
        height: 100%;
      }
      .scene-entity .entity-emoji {
        line-height: 1;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
        transition: transform 0.3s ease, filter 0.3s ease;
      }
      .scene-entity .entity-label {
        font-size: 10px;
        color: rgba(255,255,255,0.7);
        margin-top: 2px;
        white-space: nowrap;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      }
      .scene-entity .state-overlay {
        position: absolute;
        top: -8px;
        right: -8px;
        font-size: 20px;
        animation: overlayPop 0.4s ease;
      }
      .scene-entity.effect {
        transform: translate(-50%, -50%);
        transform-origin: center center;
      }
      .scene-entity.effect .entity-emoji {
        animation: effectPulse 2s ease-in-out infinite;
      }
      .scene-entity.effect .entity-svg {
        animation: effectPulse 2s ease-in-out infinite;
      }
      .scene-entity .entity-shadow {
        width: 40px;
        height: 12px;
        background: radial-gradient(ellipse, rgba(0,0,0,0.4), transparent);
        border-radius: 50%;
        margin-top: 4px;
      }

      @keyframes fadeIn { from { opacity:0; transform:translate(-50%,-80%); } to { opacity:1; transform:translate(-50%,-100%); } }
      @keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
      @keyframes walkIn { from { opacity:0; transform:translate(-200%,-100%); } to { opacity:1; transform:translate(-50%,-100%); } }
      @keyframes walkInRight { from { opacity:0; transform:translate(100%,-100%); } to { opacity:1; transform:translate(-50%,-100%); } }
      @keyframes shock { 0%,100%{transform:translate(-50%,-100%) scale(1)} 20%{transform:translate(-50%,-100%) scale(1.2) rotate(-5deg)} 40%{transform:translate(-50%,-100%) scale(1.1) rotate(5deg)} 60%{transform:translate(-50%,-100%) scale(1.05)} }
      @keyframes fighting { 0%,100%{transform:translate(-50%,-100%)} 25%{transform:translate(calc(-50% + 4px),-100%)} 75%{transform:translate(calc(-50% - 4px),-100%)} }
      @keyframes eating { 0%,100%{transform:translate(-50%,-100%)} 50%{transform:translate(-50%,calc(-100% + 5px))} }
      @keyframes casting { 0%,100%{filter:brightness(1) drop-shadow(0 0 0 transparent)} 50%{filter:brightness(1.5) drop-shadow(0 0 20px #a78bfa)} }
      @keyframes idle { 0%,100%{transform:translate(-50%,-100%) scale(1)} 50%{transform:translate(-50%,-100%) scale(1.02)} }
      @keyframes effectPulse { 0%,100%{transform:translate(-50%,-50%) scale(1);opacity:0.8} 50%{transform:translate(-50%,-50%) scale(1.15);opacity:1} }
      @keyframes overlayPop { 0%{transform:scale(0)} 60%{transform:scale(1.3)} 100%{transform:scale(1)} }

      .anim-fadeIn { animation: fadeIn 0.5s ease forwards; }
      .anim-fadeOut { animation: fadeOut 0.4s ease forwards; }
      .anim-walkIn { animation: walkIn 0.8s ease-out forwards; }
      .anim-walkInRight { animation: walkInRight 0.8s ease-out forwards; }
      .anim-shock { animation: shock 0.6s ease-in-out; }
      .anim-fighting { animation: fighting 0.3s ease-in-out infinite; }
      .anim-eating { animation: eating 0.8s ease-in-out infinite; }
      .anim-casting { animation: casting 1.2s ease-in-out infinite; }
      .anim-idle { animation: idle 3s ease-in-out infinite; }
      .anim-overturn {
        animation: overturn 0.6s ease forwards;
        transform-origin: left bottom;
      }
      @keyframes overturn {
        0% { transform: translate(-50%, -100%) rotate(0deg); }
        100% { transform: translate(-50%, -100%) rotate(90deg); opacity: 0.6; }
      }
      .anim-shatter { animation: shatter 0.5s ease forwards; }
      @keyframes shatter {
        0% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -100%) scale(1.3); opacity: 0.8; }
        100% { transform: translate(-50%, -100%) scale(0.5); opacity: 0; }
      }

      .particle {
        position: absolute;
        pointer-events: none;
        font-size: 16px;
        z-index: 40;
        animation: particleFloat 2s ease-out forwards;
      }
      @keyframes particleFloat {
        0% { opacity:1; transform: translate(0,0) scale(1); }
        100% { opacity:0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
      }

      .particle-canvas {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 40;
      }

      .screen-flash {
        position: absolute;
        inset: 0;
        z-index: 50;
        pointer-events: none;
        transition: opacity 0.1s ease;
      }
      .vignette-overlay {
        position: absolute;
        inset: 0;
        z-index: 45;
        pointer-events: none;
      }
      .letterbox-overlay {
        position: absolute;
        left: 0;
        right: 0;
        z-index: 46;
        pointer-events: none;
      }
      .letterbox-top { top: 0; }
      .letterbox-bottom { bottom: 0; }

      .grid-overlay {
        position: absolute;
        inset: 0;
        z-index: 99;
        pointer-events: none;
      }

      .light-overlay {
        position: absolute;
        inset: 0;
        z-index: 25;
        pointer-events: none;
        mix-blend-mode: screen;
      }

      .weather-fog {
        position: absolute;
        inset: 0;
        z-index: 35;
        pointer-events: none;
        opacity: 0.4;
      }
      .weather-fog-inner {
        position: absolute;
        inset: -20%;
        background: radial-gradient(ellipse at 50% 50%, rgba(200,200,220,0.3), transparent 70%);
        animation: fogDrift 20s ease-in-out infinite alternate;
      }
      @keyframes fogDrift {
        0% { transform: translate(-5%, 0) scale(1); }
        100% { transform: translate(5%, -2%) scale(1.1); }
      }
      .weather-layer {
        z-index: 35;
        pointer-events: none;
      }

      .composed-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease;
      }
      .composed-base {
        line-height: 1;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
      }
      .composed-overlay {
        position: absolute;
        line-height: 1;
        pointer-events: none;
        animation: overlayFloat 3s ease-in-out infinite;
      }
      .composed-ring {
        animation: none;
        transform: translate(-50%, -50%);
      }
      .composed-top {
        animation: none;
        transform: translate(-50%, -100%);
      }
      .composed-glow .composed-base {
        filter: drop-shadow(0 0 15px currentColor) drop-shadow(0 4px 8px rgba(0,0,0,0.5));
      }
      @keyframes overlayFloat {
        0%,100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }
    `;
    document.head.appendChild(style);
  },

  // ── SVG loading ───────────────────────────────────────────────
  _buildSvgPath(id, layer) {
    const dirs = { background: 'assets/svg/backgrounds', character: 'assets/svg/characters', object: 'assets/svg/objects', effect: 'assets/svg/effects' };
    const name = layer === 'background' ? id.replace(/^bg-/, '') : id;
    return `${dirs[layer] || 'assets/svg/characters'}/${name}.svg`;
  },

  async _loadSvgAssets() {
    const promises = [];
    for (const [id, meta] of Object.entries(this.assetMeta)) {
      const path = this._buildSvgPath(id, meta.layer);
      promises.push(
        fetch(path)
          .then(r => r.ok ? r.text() : null)
          .then(svg => { if (svg && svg.includes('<svg')) this._svgCache[id] = svg; })
          .catch(() => {})
      );
    }
    await Promise.all(promises);
  },

  _loadAllAssets() {
    for (const [id, meta] of Object.entries(this.EMOJI_MAP)) {
      this.assets[id] = meta.emoji;
      this.assetMeta[id] = {
        layer: meta.isEffect ? 'effect' : (['table','chest','torch','sword','potion','shield','bow','scroll','key','barrel'].includes(id) ? 'object' : (id.startsWith('bg-') ? 'background' : 'character')),
        tags: [meta.label, id],
        origin: 'center-bottom'
      };
      this.loadedCount++;
    }
  },

  _renderDefaultScene() {
    this.renderScene({ background: 'bg-village', characters: [], objects: [], effects: [] });
  },

  // ── Asset resolution ──────────────────────────────────────────
  _resolveAsset(id) {
    if (this.EMOJI_MAP[id]) {
      return { ...this.assetMeta[id], emoji: this.EMOJI_MAP[id].emoji, known: true };
    }
    const emoji = this.KEYWORD_EMOJI[id] || this._guessEmoji(id);
    const layer = this._guessLayer(id);
    const unknown = emoji === '❓';
    return { layer, emoji, tags: [id], origin: 'center-bottom', known: false, unknown };
  },

  _guessEmoji(id) {
    const lower = id.toLowerCase();
    if (this.KEYWORD_EMOJI[lower]) return this.KEYWORD_EMOJI[lower];
    const parts = lower.split(/[-_]/);
    for (const part of parts) {
      if (this.KEYWORD_EMOJI[part]) return this.KEYWORD_EMOJI[part];
    }
    for (const [keyword, emoji] of Object.entries(this.KEYWORD_EMOJI)) {
      if (lower.includes(keyword)) return emoji;
    }
    for (const part of parts) {
      if (part.length > 3) {
        for (const [keyword, emoji] of Object.entries(this.KEYWORD_EMOJI)) {
          if (keyword.startsWith(part.substring(0, 4))) return emoji;
        }
      }
    }
    return '❓';
  },

  _guessLayer(id) {
    const lower = id.toLowerCase();
    if (lower.startsWith('bg-')) return 'background';
    const parts = lower.split(/[-_]/);
    const objWords = ['table','chest','torch','sword','potion','door','key','book','barrel','rope','chair','bed','candle','coin','gem','ring','crown','shield','bow','axe','hammer','wand','staff','dagger','food','bread','meat','apple','cheese','bone','map','scroll','lantern','mirror','bag','hat','mask','lantern','mushroom','poison'];
    for (const w of objWords) { if (parts.includes(w) || lower.includes(w)) return 'object'; }
    const fxWords = ['fire','fog','smoke','sparkle','rain','snow','glow','light','dark','magic','effect','aura','wind','dust','shadow','glow','danger','secret'];
    for (const w of fxWords) { if (parts.includes(w) || lower.includes(w)) return 'effect'; }
    return 'character';
  },

  // ── Grid coordinate conversion ────────────────────────────────
  gridToPercent(gx, gy) {
    const x = ((gx + 0.5) / this.GRID_COLS) * 100;
    const y = ((gy + 0.5) / this.GRID_ROWS) * 100;
    return { x, y };
  },

  percentToGrid(px, py) {
    const gx = Math.max(0, Math.min(this.GRID_COLS - 1, Math.floor(px / 100 * this.GRID_COLS)));
    const gy = Math.max(0, Math.min(this.GRID_ROWS - 1, Math.floor(py / 100 * this.GRID_ROWS)));
    return { gx, gy };
  },

  snapToGrid(px, py) {
    const { gx, gy } = this.percentToGrid(px, py);
    return this.gridToPercent(gx, gy);
  },

  getGridCellSize() {
    if (!this.container) return { w: 60, h: 60 };
    const rect = this.container.getBoundingClientRect();
    return {
      w: rect.width / this.GRID_COLS,
      h: rect.height / this.GRID_ROWS
    };
  },

  showGrid(visible) {
    this._showGrid = visible;
    if (visible) {
      this._renderGridOverlay();
    } else if (this._gridOverlay) {
      this._gridOverlay.remove();
      this._gridOverlay = null;
    }
  },

  _renderGridOverlay() {
    if (this._gridOverlay) this._gridOverlay.remove();
    const overlay = document.createElement('div');
    overlay.className = 'grid-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;z-index:99;pointer-events:none;';
    for (let i = 1; i < this.GRID_COLS; i++) {
      const line = document.createElement('div');
      const pct = (i / this.GRID_COLS * 100);
      line.style.cssText = `position:absolute;left:${pct}%;top:0;width:1px;height:100%;background:rgba(255,255,255,0.15);`;
      overlay.appendChild(line);
    }
    for (let i = 1; i < this.GRID_ROWS; i++) {
      const line = document.createElement('div');
      const pct = (i / this.GRID_ROWS * 100);
      line.style.cssText = `position:absolute;top:${pct}%;left:0;height:1px;width:100%;background:rgba(255,255,255,0.15);`;
      overlay.appendChild(line);
    }
    for (let gx = 0; gx < this.GRID_COLS; gx++) {
      for (let gy = 0; gy < this.GRID_ROWS; gy++) {
        const { x, y } = this.gridToPercent(gx, gy);
        const label = document.createElement('span');
        label.textContent = `${gx},${gy}`;
        label.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);font-size:8px;color:rgba(255,255,255,0.25);font-family:monospace;`;
        overlay.appendChild(label);
      }
    }
    this.container.appendChild(overlay);
    this._gridOverlay = overlay;
  },

  _composeEntity(id) {
    const lower = id.toLowerCase().replace(/[-_]/g, ' ');
    const parts = lower.split(/\s+/);

    // 1. Check boss presets (gem-serpent, fire-dragon, etc.)
    for (const [key, preset] of Object.entries(this.COMPOSITION_PRESETS)) {
      if (lower.includes(key) || key.split('-').every(p => parts.includes(p))) {
        return { ...preset, isComposition: true };
      }
    }

    // 2. Check semantic compositions (well, fountain, altar, etc.)
    //    Try exact match first, then partial match
    if (this.SEMANTIC[lower]) {
      return { ...this.SEMANTIC[lower], isComposition: true };
    }
    for (const part of parts) {
      if (this.SEMANTIC[part]) {
        return { ...this.SEMANTIC[part], isComposition: true };
      }
    }
    // Also check Chinese: the raw id might be Chinese
    const rawLower = id.toLowerCase();
    if (this.SEMANTIC[rawLower]) {
      return { ...this.SEMANTIC[rawLower], isComposition: true };
    }

    // 3. Build from keywords + modifiers
    let base = '❓';
    let scale = 1;
    let filters = [];
    let overlays = [];
    let shadow = false;
    let glow = false;
    let label = id;

    for (const part of parts) {
      if (this.KEYWORD_EMOJI[part]) { base = this.KEYWORD_EMOJI[part]; break; }
    }
    // Also try raw id for Chinese keywords
    if (base === '❓' && this.KEYWORD_EMOJI[id]) {
      base = this.KEYWORD_EMOJI[id];
    }

    for (const part of parts) {
      const mod = this.COMPOSITION_MODS[part];
      if (!mod) continue;
      if (mod.scale) scale *= mod.scale;
      if (mod.filter) filters.push(mod.filter);
      if (mod.overlays) overlays.push(...mod.overlays);
      if (mod.shadow) shadow = true;
      if (mod.glow) glow = true;
    }

    return { base, scale, filter: filters.join(' '), overlays, shadow, glow, isComposition: true, label };
  },

  // ── Scene rendering ──────────────────────────────────────────
  renderScene(sceneData) {
    if (!this.container) return;
    if (this.currentScene === sceneData) return;
    const { background, characters = [], objects = [], effects = [] } = sceneData;
    this.currentScene = sceneData;

    const bgLayer = this._layers['scene-background'];
    bgLayer.innerHTML = '';
    this._renderBackground(background);

    const objLayer = this._layers['scene-objects'];
    const charLayer = this._layers['scene-characters'];
    const fxLayer = this._layers['scene-effects'];
    objLayer.innerHTML = '';
    charLayer.innerHTML = '';
    fxLayer.innerHTML = '';

    for (const obj of objects) this._renderEntity(obj, objLayer, 'object');
    for (const char of characters) this._renderEntity(char, charLayer, 'character');
    for (const fx of effects) this._renderEntity(fx, fxLayer, 'effect');

    this._updateParallax();
    EventBus.emit('scene:rendered', sceneData);
  },

  _renderBackground(bgId) {
    const bg = this.EMOJI_MAP[bgId];
    const hasSvg = !!this._svgCache[bgId];
    const label = bg?.label || bgId;
    const bgLayer = this._layers['scene-background'];

    const div = document.createElement('div');
    div.className = 'scene-bg';

    if (hasSvg) {
      const colors = bg?.gradient || ['#1a1a2e','#16213e','#0f3460'];
      div.style.background = `linear-gradient(180deg, ${colors.join(', ')})`;
      div.innerHTML = `
        <div class="bg-grid"></div>
        <div class="bg-svg">${this._svgCache[bgId]}</div>
        <span class="bg-label">${label}</span>
      `;
    } else if (bg) {
      const colors = bg.gradient || ['#1a1a2e','#16213e','#0f3460'];
      div.style.background = `linear-gradient(180deg, ${colors.join(', ')})`;
      div.innerHTML = `
        <div class="bg-grid"></div>
        <span class="bg-emoji">${bg.emoji}</span>
        <span class="bg-label">${label}</span>
      `;
    } else {
      div.style.background = 'linear-gradient(180deg, #0a0a1a, #1a1a2e)';
      div.innerHTML = `<span class="bg-label">${bgId}</span>`;
    }
    bgLayer.appendChild(div);
  },

  // ── Entity rendering ──────────────────────────────────────────
  _renderEntity(data, layer, type) {
    const id = data.id;
    const resolved = this._resolveAsset(id);
    if (!resolved) return;

    const hasSvg = !!this._svgCache[id];
    const meta = this.EMOJI_MAP[id];
    const state = data.state || this.characterStates[id] || 'idle';

    const composition = (!hasSvg && resolved.unknown) ? this._composeEntity(id) : null;

    let emoji = resolved.emoji;
    if (meta?.states && meta.states[state]) {
      emoji = meta.states[state];
    }

    const el = document.createElement('div');
    el.className = `scene-entity ${type}`;
    el.dataset.id = id;
    const rawX = data.x ?? 50;
    const rawY = data.y ?? (type === 'effect' ? 40 : 60);
    const snapped = (type === 'effect') ? { x: rawX, y: rawY } : this.snapToGrid(rawX, rawY);
    el.style.left = snapped.x + '%';
    el.style.top = snapped.y + '%';

    const layerSize = this.LAYER_SIZES[type] || this.LAYER_SIZES.character;
    const scale = data.scale || 1;

    if (composition) {
      const compScale = composition.scale || 1;
      const compFilter = composition.filter || '';
      const finalScale = scale * compScale;
      const cell = this.getGridCellSize();
      const baseFontSize = Math.round(Math.min(cell.w, cell.h) * 0.7 * finalScale);
      const fontSize = Math.max(24, Math.min(120, baseFontSize));
      el.innerHTML = `<div class="composed-wrapper${composition.glow ? ' composed-glow' : ''}" style="transform:scale(${finalScale});filter:${compFilter}">
        <span class="composed-base" style="font-size:${fontSize}px">${composition.base}</span>
      </div>
      <div class="entity-shadow" style="width:${Math.round(cell.w * (composition.shadow ? 0.7 : 0.35))}px;height:${Math.round(cell.h * (composition.shadow ? 0.15 : 0.08))}px"></div>
      <span class="entity-label">${composition.label || id}</span>`;

      const wrapper = el.querySelector('.composed-wrapper');
      const baseSize = Math.min(cell.w, cell.h) * 0.8;

      // Render ring items (tight circle around base, e.g. stones around a well)
      if (composition.ring && composition.ring.length > 0) {
        const ringRadius = baseSize * 0.55;
        composition.ring.forEach((emoji, i) => {
          const angle = (i / composition.ring.length) * Math.PI * 2 - Math.PI / 2;
          const span = document.createElement('span');
          span.className = 'composed-overlay composed-ring';
          const sz = Math.round(baseSize * 0.3);
          span.style.cssText = `left:${Math.cos(angle)*ringRadius}px;top:${Math.sin(angle)*ringRadius}px;font-size:${sz}px;opacity:0.9`;
          span.textContent = emoji;
          wrapper.appendChild(span);
        });
      }

      // Render top items (positioned above the base)
      if (composition.top && composition.top.length > 0) {
        composition.top.forEach((emoji, i) => {
          const span = document.createElement('span');
          span.className = 'composed-overlay composed-top';
          const sz = Math.round(baseSize * 0.35);
          const xOff = (i - (composition.top.length - 1) / 2) * sz * 0.8;
          span.style.cssText = `left:${xOff}px;top:${-baseSize*0.45}px;font-size:${sz}px;opacity:0.85`;
          span.textContent = emoji;
          wrapper.appendChild(span);
        });
      }

      // Render free overlays (scattered around, e.g. sparkles)
      if (composition.overlays && composition.overlays.length > 0) {
        const overlayPositions = composition.overlays.map((ov, i) => {
          const angle = (i / composition.overlays.length) * Math.PI * 2 - Math.PI / 2;
          const dist = baseSize * (0.5 + Math.random() * 0.2);
          return { emoji: ov, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
        });
        for (const pos of overlayPositions) {
          const span = document.createElement('span');
          span.className = 'composed-overlay';
          const ovSize = Math.round(baseSize * 0.3 + Math.random() * baseSize * 0.1);
          span.style.cssText = `left:${pos.x}px;top:${pos.y}px;font-size:${ovSize}px;opacity:${0.5 + Math.random() * 0.3}`;
          span.textContent = pos.emoji;
          wrapper.appendChild(span);
        }
      }
    } else if (hasSvg) {
      const w = Math.round(layerSize.w * scale);
      const h = Math.round(layerSize.h * scale);
      el.innerHTML = `
        <div class="entity-svg" style="width:${w}px;height:${h}px">${this._svgCache[id]}</div>
        ${type !== 'effect' ? '<div class="entity-shadow"></div>' : ''}
        ${type !== 'effect' ? `<span class="entity-label">${resolved.tags?.[0] || id}</span>` : ''}
      `;
    } else {
      const fontSize = Math.round(layerSize.emoji * scale);
      el.innerHTML = `
        <span class="entity-emoji" style="font-size:${fontSize}px">${emoji}</span>
        ${type !== 'effect' ? '<div class="entity-shadow"></div>' : ''}
        ${type !== 'effect' ? `<span class="entity-label">${resolved.tags?.[0] || id}</span>` : ''}
      `;
    }

    if (data.animation) el.classList.add(`anim-${data.animation}`);

    if (data.fromX !== undefined) {
      el.style.left = data.fromX + '%';
      el.style.transition = `left ${data.duration || 800}ms cubic-bezier(.4,0,.2,1)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.left = (data.x || 50) + '%';
        });
      });
      setTimeout(() => { el.style.transition = ''; }, (data.duration || 800) + 50);
    }

    layer.appendChild(el);

    if (type === 'character') {
      this.characterStates[id] = state;
    }

    if (type === 'effect' || state === 'casting') {
      this._spawnParticles(el, id);
    }

    // Auto-register light for fire/torch
    if (id === 'fire' || id === 'torch') {
      this.addLight('light-' + id, data.x || 50, data.y || 60, 200, '#ff8800', 0.6);
      if (!this._entityLightMap) this._entityLightMap = {};
      this._entityLightMap[id] = 'light-' + id;
    }
  },

  // ── Dynamic assets (identical API) ────────────────────────────
  addAsset(assetId, options = {}) {
    if (!this.container) return;
    const resolved = this._resolveAsset(assetId);
    if (!resolved) return;
    if (options.gx !== undefined || options.gy !== undefined) {
      const { x, y } = this.gridToPercent(
        options.gx ?? Math.floor(this.GRID_COLS / 2),
        options.gy ?? Math.floor(this.GRID_ROWS * 0.6)
      );
      options.x = x;
      options.y = y;
    }
    const type = resolved.layer === 'effect' ? 'effect' : (resolved.layer === 'object' ? 'object' : 'character');
    const layerClass = type === 'effect' ? 'scene-effects' : (type === 'object' ? 'scene-objects' : 'scene-characters');
    const layer = this._layers[layerClass] || this._createLayer(layerClass);
    this._renderEntity({ id: assetId, ...options }, layer, type);
    EventBus.emit('asset:added', { id: assetId, ...options });
  },

  removeAsset(assetId, animation = 'fadeOut') {
    if (!this.container) return;
    const els = this.container.querySelectorAll(`[data-id="${assetId}"]`);
    if (els.length === 0) return;
    delete this.characterStates[assetId];

    // Auto-remove light
    if (this._entityLightMap && this._entityLightMap[assetId]) {
      this.removeLight(this._entityLightMap[assetId]);
      delete this._entityLightMap[assetId];
    }

    els.forEach(el => {
      el.className = el.className.replace(/anim-\w+/g, '').trim();
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -100%) scale(0.5)';
      setTimeout(() => el.remove(), 450);
    });
    EventBus.emit('asset:removed', { id: assetId, count: els.length });
  },

  _entityLightMap: {},

  updateAsset(assetId, options = {}) {
    if (!this.container) return;
    const el = this.container.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;
    if (options.x !== undefined) el.style.left = options.x + '%';
    if (options.y !== undefined) el.style.top = options.y + '%';
    if (options.scale !== undefined) {
      const svgWrap = el.querySelector('.entity-svg');
      const emojiEl = el.querySelector('.entity-emoji');
      const type = el.classList.contains('effect') ? 'effect' : (el.classList.contains('object') ? 'object' : 'character');
      const layerSize = this.LAYER_SIZES[type] || this.LAYER_SIZES.character;
      if (svgWrap) {
        svgWrap.style.width = Math.round(layerSize.w * options.scale) + 'px';
        svgWrap.style.height = Math.round(layerSize.h * options.scale) + 'px';
      }
      if (emojiEl) emojiEl.style.fontSize = Math.round(layerSize.emoji * options.scale) + 'px';
    }
    if (options.state !== undefined) {
      this._updateEntityState(el, assetId, options.state);
    }
    if (options.animation) {
      el.classList.add(`anim-${options.animation}`);
      el.addEventListener('animationend', () => el.classList.remove(`anim-${options.animation}`), { once: true });
    }
  },

  _updateEntityState(el, assetId, state) {
    const meta = this.EMOJI_MAP[assetId];
    if (!meta) return;
    const prevState = this.characterStates[assetId] || 'idle';
    this.characterStates[assetId] = state;
    const emojiEl = el.querySelector('.entity-emoji');
    if (emojiEl && meta.states) {
      emojiEl.textContent = meta.states[state] || meta.emoji;
    }
    el.classList.remove(`state-${prevState}`, `anim-${prevState}`);
    const oldOverlay = el.querySelector('.state-overlay');
    if (oldOverlay) oldOverlay.remove();
    const animMap = {
      surprised: 'shock', fighting: 'fighting', eating: 'eating',
      casting: 'casting', idle: 'idle',
      overturn: 'overturn', overturned: 'overturn',
      shatter: 'shatter', broken: 'shatter',
      slide: 'walkIn', push: 'walkIn',
    };
    if (animMap[state]) el.classList.add(`anim-${animMap[state]}`);
    const overlayEmoji = this.STATE_EMOJI[state];
    if (overlayEmoji) {
      const overlay = document.createElement('span');
      overlay.className = 'state-overlay';
      overlay.textContent = overlayEmoji;
      el.appendChild(overlay);
    }
    EventBus.emit('character:state', { id: assetId, state, prevState });
  },

  setCharacterState(assetId, state) {
    const el = this.container?.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;
    this._updateEntityState(el, assetId, state);
  },

  getCharacterState(assetId) {
    return this.characterStates[assetId] || 'idle';
  },

  addReaction(assetId, state, delay = 2000, revertTo = 'idle') {
    if (this._animationTimers[assetId]) clearTimeout(this._animationTimers[assetId]);
    this.setCharacterState(assetId, state);
    this._animationTimers[assetId] = setTimeout(() => {
      this.setCharacterState(assetId, revertTo);
      delete this._animationTimers[assetId];
    }, delay);
  },

  addReactionChain(reactions) {
    if (!Array.isArray(reactions)) return;
    for (const r of reactions) {
      setTimeout(() => {
        this.addReaction(r.id, r.state, r.duration || 2000, r.revertTo || 'idle');
      }, r.startDelay || 0);
    }
  },

  applyEffects(effects) {
    if (!this.container || !effects) return;
    for (const fx of effects) {
      this.addAsset(fx.id, fx);
      if (fx.duration) {
        setTimeout(() => this.removeAsset(fx.id), fx.duration);
      }
    }
  },

  clearScene() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.characterStates = {};
    for (const k of Object.keys(this._animationTimers)) clearTimeout(this._animationTimers[k]);
    this._animationTimers = {};
    this.currentScene = null;
    this._entityLightMap = {};
    this.lightSources.clear();
    this._buildDOMStructure();
    this._initCanvas();
    this.container.appendChild(this._canvas);
    EventBus.emit('scene:cleared');
  },

  transition(type = 'fade', duration = 600) {
    if (!this.container) return Promise.resolve();
    return new Promise(resolve => {
      this.container.style.transition = `opacity ${duration}ms ease`;
      this.container.style.opacity = '0';
      setTimeout(() => {
        if (this.currentScene) this.renderScene(this.currentScene);
        requestAnimationFrame(() => {
          this.container.style.opacity = '1';
          setTimeout(() => {
            this.container.style.transition = '';
            resolve();
          }, duration);
        });
      }, duration);
    });
  },

  setTimeFilter(phase) {
    if (!this.container) return;
    const filters = {
      day: 'brightness(1) saturate(1)',
      dusk: 'brightness(0.8) saturate(0.8) sepia(0.2)',
      night: 'brightness(0.5) saturate(0.6) hue-rotate(20deg)',
      dawn: 'brightness(0.9) saturate(0.9) sepia(0.1)'
    };
    this.container.style.filter = filters[phase] || '';
  },

  // ── Weather System (enhanced) ─────────────────────────────────
  setWeatherEffect(weather) {
    this.container?.querySelectorAll('.weather-layer, .weather-fog').forEach(el => el.remove());
    this._weatherType = weather;

    if (weather === 'rain') {
      const layer = document.createElement('div');
      layer.className = 'scene-layer weather-layer';
      layer.style.cssText = 'z-index:35;pointer-events:none;';
      for (let i = 0; i < 30; i++) {
        const drop = document.createElement('span');
        drop.textContent = '💧';
        drop.style.cssText = `position:absolute;font-size:12px;left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:0.5;animation:particleFloat 1.5s linear infinite;animation-delay:${Math.random()*2}s`;
        layer.appendChild(drop);
      }
      this.container.appendChild(layer);
    } else if (weather === 'snow') {
      // Snow uses canvas particles (handled in RAF loop via continuous emitter)
      this._startSnow();
    } else if (weather === 'fog') {
      const fog = document.createElement('div');
      fog.className = 'weather-fog';
      for (let i = 0; i < 3; i++) {
        const inner = document.createElement('div');
        inner.className = 'weather-fog-inner';
        inner.style.cssText = `animation-delay:${i * 6}s;opacity:${0.3 + i * 0.1};`;
        inner.style.background = `radial-gradient(ellipse at ${40 + i * 20}% ${30 + i * 20}%, rgba(200,200,220,0.3), transparent 70%)`;
        fog.appendChild(inner);
      }
      this.container.appendChild(fog);
    } else if (weather === 'storm') {
      // Rain layer
      const layer = document.createElement('div');
      layer.className = 'scene-layer weather-layer';
      layer.style.cssText = 'z-index:35;pointer-events:none;';
      for (let i = 0; i < 40; i++) {
        const drop = document.createElement('span');
        drop.textContent = '💧';
        drop.style.cssText = `position:absolute;font-size:14px;left:${Math.random()*100}%;top:${Math.random()*100}%;opacity:0.6;animation:particleFloat 1s linear infinite;animation-delay:${Math.random()*1.5}s`;
        layer.appendChild(drop);
      }
      this.container.appendChild(layer);
      // Periodic lightning + shake
      this._stormInterval = setInterval(() => {
        this.screenFlash('#fff', 150);
        this.screenShake(8, 300);
      }, 4000 + Math.random() * 6000);
    } else if (weather === 'clear') {
      if (this._stormInterval) { clearInterval(this._stormInterval); this._stormInterval = null; }
      this._stopSnow();
      this._weatherType = null;
    }
  },

  _snowRunning: false,
  _snowEmitter: null,

  _startSnow() {
    this._snowRunning = true;
    // Will be emitted each frame via continuous emitter
  },

  _stopSnow() {
    this._snowRunning = false;
  },

  // ── Legacy emoji particle spawning ────────────────────────────
  _spawnParticles(el, type) {
    const particles = type === 'fire' ? ['🔥','💥','⭐'] :
                      type === 'magic-sparkle' ? ['✨','💫','⭐','🌟'] :
                      type === 'casting' ? ['✨','💫','🔮'] :
                      ['✨','💫'];
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = document.createElement('span');
        p.className = 'particle';
        p.textContent = particles[Math.floor(Math.random() * particles.length)];
        p.style.left = (Math.random() * 60 - 30) + 'px';
        p.style.top = (Math.random() * 40 - 20) + 'px';
        p.style.setProperty('--dx', (Math.random() * 80 - 40) + 'px');
        p.style.setProperty('--dy', -(Math.random() * 60 + 20) + 'px');
        el.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
      }, i * 300);
    }
  },

  _createLayer(className) {
    const div = document.createElement('div');
    div.className = `scene-layer ${className}`;
    this._cameraContainer.appendChild(div);
    this._layers[className] = div;
    return div;
  },

  // ── Asset search (identical API) ──────────────────────────────
  findAssets(tags) {
    const results = [];
    for (const [id, meta] of Object.entries(this.assetMeta)) {
      const score = tags.filter(t => meta.tags.includes(t)).length;
      if (score > 0) results.push({ id, score, ...meta });
    }
    return results.sort((a, b) => b.score - a.score);
  },

  getAssetManifest() {
    return Object.entries(this.EMOJI_MAP).map(([id, meta]) => ({
      id,
      layer: meta.isEffect ? 'effect' : (['table','chest','torch','sword','potion'].includes(id) ? 'object' : (id.startsWith('bg-') ? 'background' : 'character')),
      tags: [meta.label, id],
      origin: 'center-bottom'
    }));
  },

  // ══════════════════════════════════════════════════════════════
  // CAMERA SYSTEM
  // ══════════════════════════════════════════════════════════════

  setCameraTarget(entityId) {
    const el = this.container?.querySelector(`[data-id="${entityId}"]`);
    if (!el) return;
    // Convert percentage positions to camera target coords
    const left = parseFloat(el.style.left) || 50;
    const top = parseFloat(el.style.top) || 50;
    // Normalize: center of viewport is (50%, 50%) -> camera (0, 0)
    this.camera.targetX = (left - 50) * 2;
    this.camera.targetY = (top - 50) * 1.5;
    this.camera.targetZoom = 1;
  },

  panTo(x, y, duration = 1000) {
    const startX = this.camera.targetX;
    const startY = this.camera.targetY;
    const startTime = performance.now();
    this._cameraTweens.push({ startX, startY, targetX: x, targetY: y, startTime, duration });
  },

  zoomTo(level, duration = 1000) {
    const startZoom = this.camera.targetZoom;
    const startTime = performance.now();
    this._cameraTweens.push({ startZoom, targetZoom: Math.max(0.5, Math.min(3, level)), startTime, duration, isZoom: true });
  },

  resetCamera() {
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.camera.targetZoom = 1;
    this._cameraTweens = [];
  },

  _updateCameraTweens(now) {
    for (let i = this._cameraTweens.length - 1; i >= 0; i--) {
      const t = this._cameraTweens[i];
      const elapsed = now - t.startTime;
      const progress = Math.min(1, elapsed / t.duration);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      if (t.isZoom) {
        this.camera.targetZoom = t.startZoom + (t.targetZoom - t.startZoom) * ease;
      } else {
        this.camera.targetX = t.startX + (t.targetX - t.startX) * ease;
        this.camera.targetY = t.startY + (t.targetY - t.startY) * ease;
      }

      if (progress >= 1) {
        this._cameraTweens.splice(i, 1);
      }
    }
  },

  // ══════════════════════════════════════════════════════════════
  // PARALLAX BACKGROUND
  // ══════════════════════════════════════════════════════════════

  _updateParallax() {
    const cx = this.camera.x;
    const cy = this.camera.y;
    const multipliers = { 'parallax-far': 0.3, 'parallax-mid': 0.6, 'parallax-near': 1.0 };

    // Place decorative emoji on parallax layers if available
    for (const [layerName, mult] of Object.entries(multipliers)) {
      const layer = this._layers[layerName];
      if (!layer) continue;
      // Apply parallax offset via transform
      layer.style.transform = `translate(${cx * mult}px, ${cy * mult}px)`;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // DYNAMIC LIGHTING
  // ══════════════════════════════════════════════════════════════

  addLight(id, x, y, radius = 200, color = '#ff8800', intensity = 0.6) {
    const light = { x, y, radius, color, intensity, flicker: true };
    this.lightSources.set(id, light);
    this._renderLights();
    return light;
  },

  removeLight(id) {
    this.lightSources.delete(id);
    this._renderLights();
  },

  _renderLights() {
    if (this.lightSources.size === 0) {
      this._cameraContainer?.querySelectorAll('.light-overlay').forEach(el => el.remove());
      this._lastLightCount = 0;
      return;
    }

    if (this.lightSources.size === this._lastLightCount) return;
    this._lastLightCount = this.lightSources.size;

    this._cameraContainer?.querySelectorAll('.light-overlay').forEach(el => el.remove());

    // Create a single overlay with multiple radial gradients
    const overlay = document.createElement('div');
    overlay.className = 'light-overlay';

    const gradients = [];
    for (const [id, light] of this.lightSources) {
      // Convert world coords (%) to CSS relative coords
      const lx = light.x + '%';
      const ly = light.y + '%';
      const r = light.radius + 'px';
      const col = light.color;
      const inten = light.intensity;
      gradients.push(`radial-gradient(circle at ${lx} ${ly}, ${col} 0%, ${col} ${r}, transparent ${r})`);
    }

    overlay.style.background = gradients.join(', ');
    overlay.style.opacity = '0.7';
    this._cameraContainer.appendChild(overlay);
  },

  _flickerLights() {
    for (const [id, light] of this.lightSources) {
      if (!light.flicker) continue;
      // Randomize intensity ±15% every ~100ms
      const flickerAmount = (Math.random() - 0.5) * 0.3;
      const baseIntensity = light.intensity;
      const currentOp = baseIntensity + flickerAmount;
      light._currentOpacity = Math.max(0.2, Math.min(1, currentOp));
    }

    // Batch update: set overlay opacity based on first light's flicker
    const overlay = this._cameraContainer?.querySelector('.light-overlay');
    if (overlay && this.lightSources.size > 0) {
      const firstLight = this.lightSources.values().next().value;
      overlay.style.opacity = (firstLight._currentOpacity || 0.7) * 0.7;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // CANVAS PARTICLE SYSTEM
  // ══════════════════════════════════════════════════════════════

  PARTICLE_CONFIGS: {
    ember:   { vxRange: [-5,5], vyRange: [-8,-2], sizeRange: [2,6], colors: ['#ff6600','#ff8800','#ffaa00','#ff4400'], lifeRange: [40,80], alphaDecay: 0.02 },
    spark:   { vxRange: [-12,12], vyRange: [-15,5], sizeRange: [1,3], colors: ['#fff','#ffcc00','#ff8800'], lifeRange: [15,40], alphaDecay: 0.04 },
    smoke:   { vxRange: [-3,3], vyRange: [-4,-1], sizeRange: [8,18], colors: ['#888','#aaa','#666','#999'], lifeRange: [60,120], alphaDecay: 0.01, growRate: 0.3 },
    snow:    { vxRange: [-2,2], vyRange: [1,3], sizeRange: [2,5], colors: ['#fff','#eef','#dde'], lifeRange: [120,200], alphaDecay: 0.005, sineAmp: 2, sineFreq: 0.05 },
    raindrop:{ vxRange: [-1,1], vyRange: [10,18], sizeRange: [1,2], colors: ['#aaccff','#88aadd','#6699cc'], lifeRange: [20,50], alphaDecay: 0.03, thin: true },
    magic:   { vxRange: [-6,6], vyRange: [-8,8], sizeRange: [3,7], colors: ['#a78bfa','#f0abfc','#c084fc','#fef08a'], lifeRange: [40,80], alphaDecay: 0.02, spiral: true },
    dust:    { vxRange: [-1,1], vyRange: [-1,-0.3], sizeRange: [1,3], colors: ['#8B7355','#A0896E','#7A6548'], lifeRange: [100,180], alphaDecay: 0.008 },
  },

  emitParticles(type, worldX, worldY, count, config = {}) {
    const cfg = { ...this.PARTICLE_CONFIGS[type], ...config };
    if (!cfg) return;
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;
      p.alive = true;
      p.type = type;
      p.x = worldX;
      p.y = worldY;
      p.vx = (cfg.vxRange[0] + Math.random() * (cfg.vxRange[1] - cfg.vxRange[0])) * (config.speed || 1);
      p.vy = (cfg.vyRange[0] + Math.random() * (cfg.vyRange[1] - cfg.vyRange[0])) * (config.speed || 1);
      p.life = 0;
      p.maxLife = cfg.lifeRange[0] + Math.random() * (cfg.lifeRange[1] - cfg.lifeRange[0]);
      p.size = cfg.sizeRange[0] + Math.random() * (cfg.sizeRange[1] - cfg.sizeRange[0]);
      p.color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      p.alpha = 1;
      p.rotation = Math.random() * Math.PI * 2;
      p._cfg = cfg;
      this._particleAlive.push(p);
    }
  },

  _updateParticles(dt) {
    const ctx = this._ctx;
    if (!ctx) return;
    const rect = this.container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Apply camera transform to particles (world space)
    const cam = this.camera;
    ctx.translate(w / 2, h / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x - w / 2, -cam.y - h / 2);

    // Snow continuous emission
    if (this._snowRunning && this._weatherType === 'snow') {
      this.emitParticles('snow', Math.random() * w, -10, 2, { speed: 1 });
    }

    // Batch draw by color
    const byColor = {};
    for (let i = this._particleAlive.length - 1; i >= 0; i--) {
      const p = this._particleAlive[i];
      if (!p.alive) { this._particleAlive.splice(i, 1); continue; }

      p.life++;
      const progress = p.life / p.maxLife;

      if (progress >= 1) {
        p.alive = false;
        this._particleAlive.splice(i, 1);
        continue;
      }

      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);

      if (p._cfg.sineAmp) {
        p.x += Math.sin(p.life * p._cfg.sineFreq) * p._cfg.sineAmp;
      }

      if (p._cfg.spiral) {
        const angle = p.life * 0.1;
        p.x += Math.cos(angle) * 0.5;
        p.y += Math.sin(angle) * 0.5;
      }

      if (p._cfg.growRate) {
        p.size += p._cfg.growRate * (dt / 16);
      }

      p.alpha = Math.max(0, 1 - progress - (p._cfg.alphaDecay || 0) * p.life);

      if (!byColor[p.color]) byColor[p.color] = [];
      byColor[p.color].push(p);
    }

    for (const [color, particles] of Object.entries(byColor)) {
      ctx.fillStyle = color;
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p._cfg.thin) {
          ctx.strokeStyle = color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(0, 4);
          ctx.stroke();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        ctx.restore();
      }
    }

    ctx.restore();
  },

  // ══════════════════════════════════════════════════════════════
  // SCREEN EFFECTS
  // ══════════════════════════════════════════════════════════════

  screenShake(intensity = 5, duration = 300) {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeElapsed = 0;
  },

  screenFlash(color = '#fff', duration = 200) {
    if (!this._flashEl) {
      this._flashEl = document.createElement('div');
      this._flashEl.className = 'screen-flash';
      this.container.appendChild(this._flashEl);
    }
    this._flashEl.style.background = color;
    this._flashEl.style.opacity = '0.6';
    setTimeout(() => {
      if (this._flashEl) this._flashEl.style.opacity = '0';
    }, 50);
    setTimeout(() => {
      if (this._flashEl) this._flashEl.style.background = 'transparent';
    }, duration);
  },

  setVignette(intensity = 0.5) {
    if (intensity <= 0) {
      if (this._vignetteEl) { this._vignetteEl.remove(); this._vignetteEl = null; }
      return;
    }
    if (!this._vignetteEl) {
      this._vignetteEl = document.createElement('div');
      this._vignetteEl.className = 'vignette-overlay';
      this.container.appendChild(this._vignetteEl);
    }
    const alpha = Math.min(1, intensity);
    this._vignetteEl.style.background = `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,${alpha}) 100%)`;
  },

  letterbox(ratio = 0) {
    if (ratio <= 0) {
      if (this._letterboxEl) { this._letterboxEl.remove(); this._letterboxEl = null; }
      return;
    }
    if (!this._letterboxEl) {
      this._letterboxEl = document.createElement('div');
      this._letterboxEl.className = 'letterbox-overlay';
      this.container.appendChild(this._letterboxEl);
      this._letterboxEl.innerHTML = `
        <div class="letterbox-top letterbox-overlay" style="height:0;background:#000;"></div>
        <div class="letterbox-bottom letterbox-overlay" style="height:0;background:#000;"></div>
      `;
    }
    const pct = Math.min(0.5, Math.max(0, ratio));
    const top = this._letterboxEl.querySelector('.letterbox-top');
    const bottom = this._letterboxEl.querySelector('.letterbox-bottom');
    if (top) top.style.height = (pct * 100) + '%';
    if (bottom) bottom.style.height = (pct * 100) + '%';
  },

  // ══════════════════════════════════════════════════════════════
  // RAF RENDER LOOP
  // ══════════════════════════════════════════════════════════════

  startLoop() {
    if (this._frameId) return;
    this._lastTime = performance.now();
    const loop = (now) => {
      this._frameId = requestAnimationFrame(loop);
      this._tick(now);
    };
    this._frameId = requestAnimationFrame(loop);
  },

  stopLoop() {
    if (this._frameId) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
  },

  _tick(now) {
    const dt = Math.min(50, now - this._lastTime);
    this._lastTime = now;

    // 1. Lerp camera toward target
    const cam = this.camera;
    this._updateCameraTweens(now);
    cam.x += (cam.targetX - cam.x) * cam.smoothing;
    cam.y += (cam.targetY - cam.y) * cam.smoothing;
    cam.zoom += (cam.targetZoom - cam.zoom) * cam.smoothing;

    // 2. Apply camera transform to scene container
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    if (this._cameraContainer) {
      // Screen shake offset
      let shakeX = 0, shakeY = 0;
      if (this._shakeElapsed < this._shakeDuration) {
        this._shakeElapsed += dt;
        const shakeProgress = 1 - (this._shakeElapsed / this._shakeDuration);
        shakeX = (Math.random() - 0.5) * 2 * this._shakeIntensity * shakeProgress;
        shakeY = (Math.random() - 0.5) * 2 * this._shakeIntensity * shakeProgress;
      }
      this._cameraContainer.style.transform =
        `scale(${cam.zoom}) translate(${-cam.x}px, ${-cam.y}px) translate(${shakeX}px, ${shakeY}px)`;
    }

    // 3. Update parallax offsets
    this._updateParallax();

    // 4. Flicker lights
    if (this.lightSources.size > 0) {
      this._flickerLights();
    }

    // 5. Update and draw particles
    this._updateParticles(dt);

    // 6. Continuous emitters for fire/smoke
    for (const [id, light] of this.lightSources) {
      if (id.startsWith('light-fire') || id.startsWith('light-torch')) {
        // Emit ember + smoke particles
        const el = this.container.querySelector(`[data-id="${id.replace('light-', '')}"]`);
        if (el) {
          const left = parseFloat(el.style.left) || 50;
          const top = parseFloat(el.style.top) || 50;
          // Convert % to pixel coords relative to container
          const px = (left / 100) * rect.width;
          const py = (top / 100) * rect.height;
          if (Math.random() < 0.3) {
            this.emitParticles('ember', px, py, 1 + Math.floor(Math.random() * 2));
          }
          if (Math.random() < 0.1) {
            this.emitParticles('smoke', px, py - 20, 1);
          }
        }
      }
    }
  }
};
