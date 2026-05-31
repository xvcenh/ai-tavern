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
  _libraryManifest: [],
  _LIBRARY_BASE: 'assets/svg-asset-library/assets',
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
    'slime-king':    { base: '🟢', scale: 2.5, filter: 'hue-rotate(100deg)', overlays9D�Q4�PЀL@�ߝvr�����ם��h]��]��֥ r.startDelay || 0);
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
