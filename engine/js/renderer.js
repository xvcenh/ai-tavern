// SVG Scene Engine - Hybrid Renderer
// SVG assets when available, emoji fallback for everything else
// Emoji size matches layer type: character > object, effect > character

const SVGRenderer = {
  container: null,
  assets: {},
  assetMeta: {},
  currentScene: null,
  loadedCount: 0,
  characterStates: {},
  _animationTimers: {},
  _svgCache: {},        // id -> SVG string
  _libraryManifest: [],  // loaded from asset-library manifest
  _LIBRARY_BASE: 'assets/svg-asset-library/assets',
  _layerOrder: ['scene-background', 'scene-objects', 'scene-characters', 'scene-effects'],

  // ── Layer sizing (pixels at scale=1) ─────────────────────────
  LAYER_SIZES: {
    character:  { w: 120, h: 160, emoji: 48 },
    object:     { w: 80,  h: 80,  emoji: 32 },
    effect:     { w: 160, h: 160, emoji: 64 },
  },

  // ── Keyword → emoji for LLM-invented assets ─────────────────
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
    // Clothed figures / NPCs
    hooded:'🫣',hood:'🫣',cloak:'🧣',mysterious:'🌑',stranger:'🌑',
    figure:'🧍',person:'🧑',man:'👨',woman:'👩',child:'👶',
    king:'👑',queen:'👸',knight:'⚔️',wizard:'🧙',witch:'🧙‍♀️',
    priest:'⛪',merchant:'💰',thief:'🥷',assassin:'🥷',
    bandit:'🗡️',pirate:'🏴‍☠️',soldier:'💂',guard:'💂',
    // More nature
    mushroom:'🍄',leaf:'🍃',branch:'🌿',root:'🌱',
    pond:'💧',ocean:'🌊',wave:'🌊',island:'🏝️',
    // More objects
    map:'🗺️',scroll:'📜',potion:'🧪',poison:'☠️',
    lantern:'🏮',mirror:'🪞',clock:'⏰',compass:'🧭',
    bag:'🎒',hat:'🎩',mask:'🎭',ring:'💍',
    // Atmosphere
    dark:'🌑',shadow:'👤',light:'💡',glow:'✨',
    danger:'⚠️',safe:'✅',secret:'🤫',trap:'🪤',
  },

  // ── Emoji Asset Registry ──────────────────────────────────────
  EMOJI_MAP: {
    // Backgrounds
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

    // Characters
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

    // Objects
    'table':   { emoji: '🪑', label: '桌子' },
    'chest':   { emoji: '📦', label: '宝箱' },
    'torch':   { emoji: '🔦', label: '火把' },
    'sword':   { emoji: '⚔️', label: '剑' },
    'potion':  { emoji: '🧪', label: '药水' },

    // Effects
    'fire':          { emoji: '🔥', label: '火焰', isEffect: true },
    'fog':           { emoji: '🌫️', label: '雾气', isEffect: true },
    'magic-sparkle': { emoji: '✨', label: '魔法闪光', isEffect: true },
  },

  // State → emoji overlay map
  STATE_EMOJI: {
    idle:       null,
    surprised:  '❗',
    eating:     '🍖',
    drinking:   '🍺',
    casting:    '✨',
    fighting:   '💥',
    look_left:  '👈',
    spit_drink: '💦',
    // Object states
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

  async init() {
    this.container = document.getElementById('scene-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'scene-container';
      document.body.prepend(this.container);
    }
    this._injectStyles();
    this._loadAllAssets();
    await this._loadAssetLibrary();
    await this._loadSvgAssets();
    this._renderDefaultScene();
    const svgCount = Object.keys(this._svgCache).length;
    console.log(`[HybridRenderer] ${this.loadedCount} assets (${svgCount} SVG + ${this.loadedCount - svgCount} emoji-only)`);
  },

  // ── SVG path builder (engine assets) ────────────────────────────
  _buildSvgPath(id, layer) {
    const dirs = {
      background: 'assets/svg/backgrounds',
      character: 'assets/svg/characters',
      object: 'assets/svg/objects',
      effect: 'assets/svg/effects',
    };
    const name = layer === 'background' ? id.replace(/^bg-/, '') : id;
    return `${dirs[layer] || 'assets/svg/characters'}/${name}.svg`;
  },

  // ── SVG path builder (asset-library) ──────────────────────────
  _buildLibraryPath(id, layer) {
    // Library uses consistent directory names
    const dirs = {
      background: `${this._LIBRARY_BASE}/backgrounds`,
      character:  `${this._LIBRARY_BASE}/characters`,
      creature:   `${this._LIBRARY_BASE}/creatures`,
      object:     `${this._LIBRARY_BASE}/objects`,
      effect:     `${this._LIBRARY_BASE}/effects`,
      item:       `${this._LIBRARY_BASE}/items`,
    };
    return `${dirs[layer] || dirs.character}/${id}.svg`;
  },

  // ── Fetch SVG files ──────────────────────────────────────────
  async _loadSvgAssets() {
    // Load engine's own SVGs first
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

    // Then load library SVGs for registered assets
    const libPromises = [];
    for (const asset of this._libraryManifest) {
      if (this._svgCache[asset.id]) continue; // already have engine SVG
      const libLayer = asset.layer;
      const path = this._buildLibraryPath(asset.id, libLayer);
      libPromises.push(
        fetch(path)
          .then(r => r.ok ? r.text() : null)
          .then(svg => { if (svg && svg.includes('<svg')) this._svgCache[asset.id] = svg; })
          .catch(() => {})
      );
    }
    await Promise.all(libPromises);
  },

  // ── Load asset-library manifest and register assets ──────────
  async _loadAssetLibrary() {
    try {
      const resp = await fetch('assets/svg-asset-library/manifest.json');
      if (!resp.ok) return;
      const data = await resp.json();
      this._libraryManifest = data.assets || [];

      // Map library layer names to engine layer names
      const layerMap = {
        background: 'background',
        character:  'character',
        creature:   'character',   // creatures render as characters
        object:     'object',
        effect:     'effect',
        item:       'object',      // items render as objects
      };

      for (const asset of this._libraryManifest) {
        const engineLayer = layerMap[asset.layer] || 'character';
        // Skip if already registered by engine's own EMOJI_MAP
        if (this.assetMeta[asset.id]) continue;

        // Register in assetMeta
        this.assetMeta[asset.id] = {
          layer: engineLayer,
          tags: (asset.tags || '').split(',').concat([asset.id]),
          origin: engineLayer === 'effect' ? 'center-center' : 'center-bottom',
          source: 'library',
        };

        // Register in EMOJI_MAP with keyword-guessed emoji fallback
        if (!this.EMOJI_MAP[asset.id]) {
          const emoji = this.KEYWORD_EMOJI[asset.id] || this._guessEmoji(asset.id);
          this.EMOJI_MAP[asset.id] = {
            emoji: emoji,
            label: asset.id.replace(/[-_]/g, ' '),
          };
          this.assets[asset.id] = emoji;
        }

        this.loadedCount++;
      }

      const svgDir = this._LIBRARY_BASE;
      console.log(`[HybridRenderer] Asset library loaded: ${this._libraryManifest.length} assets registered`);
    } catch (e) {
      console.warn('[HybridRenderer] Failed to load asset library:', e);
    }
  },

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

      /* Background layer */
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

      /* Entity layers */
      .scene-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 10;
      }
      .scene-objects { z-index: 10; }
      .scene-characters { z-index: 20; }
      .scene-effects { z-index: 30; }

      /* Entity (character/object/effect) */
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
      }

      /* SVG entity wrapper */
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

      /* Emoji entity */
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

      /* Effect entities */
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

      /* Shadow under characters/objects */
      .scene-entity .entity-shadow {
        width: 40px;
        height: 12px;
        background: radial-gradient(ellipse, rgba(0,0,0,0.4), transparent);
        border-radius: 50%;
        margin-top: 4px;
      }

      /* Animations */
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
      .anim-shatter {
        animation: shatter 0.5s ease forwards;
      }
      @keyframes shatter {
        0% { transform: translate(-50%, -100%) scale(1); opacity: 1; }
        50% { transform: translate(-50%, -100%) scale(1.3); opacity: 0.8; }
        100% { transform: translate(-50%, -100%) scale(0.5); opacity: 0; }
      }

      /* Particle effects */
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
    `;
    document.head.appendChild(style);
  },

  _loadAllAssets() {
    for (const [id, meta] of Object.entries(this.EMOJI_MAP)) {
      this.assets[id] = meta.emoji;
      this.assetMeta[id] = {
        layer: meta.isEffect ? 'effect' : (['table','chest','torch','sword','potion'].includes(id) ? 'object' : (id.startsWith('bg-') ? 'background' : 'character')),
        tags: [meta.label, id],
        origin: 'center-bottom'
      };
      this.loadedCount++;
    }
  },

  _renderDefaultScene() {
    this.renderScene({
      background: 'bg-village',
      characters: [],
      objects: [],
      effects: []
    });
  },

  // ── Resolve asset metadata (known or dynamic) ─────────────────
  _resolveAsset(id) {
    if (this.EMOJI_MAP[id]) {
      return { ...this.assetMeta[id], emoji: this.EMOJI_MAP[id].emoji, known: true };
    }
    // Dynamic: guess from keyword
    const emoji = this.KEYWORD_EMOJI[id] || this._guessEmoji(id);
    const layer = this._guessLayer(id);
    return { layer, emoji, tags: [id], origin: 'center-bottom', known: false };
  },

  _guessEmoji(id) {
    const lower = id.toLowerCase();
    // Direct match
    if (this.KEYWORD_EMOJI[lower]) return this.KEYWORD_EMOJI[lower];
    // Split by hyphen and try each part
    const parts = lower.split(/[-_]/);
    for (const part of parts) {
      if (this.KEYWORD_EMOJI[part]) return this.KEYWORD_EMOJI[part];
    }
    // Substring match
    for (const [keyword, emoji] of Object.entries(this.KEYWORD_EMOJI)) {
      if (lower.includes(keyword)) return emoji;
    }
    // Last resort: guess from first meaningful part
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

  // ── Render a complete scene ─────────────────────────────────

  renderScene(sceneData) {
    if (!this.container) return;
    const { background, characters = [], objects = [], effects = [] } = sceneData;
    this.container.innerHTML = '';

    this._renderBackground(background);

    const objLayer = this._createLayer('scene-objects');
    const charLayer = this._createLayer('scene-characters');
    const fxLayer = this._createLayer('scene-effects');

    for (const obj of objects) this._renderEntity(obj, objLayer, 'object');
    for (const char of characters) this._renderEntity(char, charLayer, 'character');
    for (const fx of effects) this._renderEntity(fx, fxLayer, 'effect');

    this.currentScene = sceneData;
    EventBus.emit('scene:rendered', sceneData);
  },

  _renderBackground(bgId) {
    const bg = this.EMOJI_MAP[bgId];
    const hasSvg = !!this._svgCache[bgId];
    const label = bg?.label || bgId;

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

    this.container.appendChild(div);
  },

  _createLayer(className) {
    const div = document.createElement('div');
    div.className = `scene-layer ${className}`;
    this.container.appendChild(div);
    return div;
  },

  // ── Main entity renderer (dispatches SVG or emoji) ────────────

  _renderEntity(data, layer, type) {
    const id = data.id;
    const resolved = this._resolveAsset(id);
    if (!resolved) return;

    const hasSvg = !!this._svgCache[id];
    const meta = this.EMOJI_MAP[id];
    const state = data.state || this.characterStates[id] || 'idle';

    let emoji = resolved.emoji;
    if (meta?.states && meta.states[state]) {
      emoji = meta.states[state];
    }

    const el = document.createElement('div');
    el.className = `scene-entity ${type}`;
    el.dataset.id = id;
    el.style.left = (data.x || 50) + '%';
    el.style.top = (data.y || (type === 'effect' ? 40 : 60)) + '%';

    const layerSize = this.LAYER_SIZES[type] || this.LAYER_SIZES.character;
    const scale = data.scale || 1;

    if (hasSvg) {
      // ── SVG rendering ──
      const w = Math.round(layerSize.w * scale);
      const h = Math.round(layerSize.h * scale);
      el.innerHTML = `
        <div class="entity-svg" style="width:${w}px;height:${h}px">${this._svgCache[id]}</div>
        ${type !== 'effect' ? '<div class="entity-shadow"></div>' : ''}
        ${type !== 'effect' ? `<span class="entity-label">${resolved.tags?.[0] || id}</span>` : ''}
      `;
    } else {
      // ── Emoji rendering (size matches layer type) ──
      const fontSize = Math.round(layerSize.emoji * scale);
      el.innerHTML = `
        <span class="entity-emoji" style="font-size:${fontSize}px">${emoji}</span>
        ${type !== 'effect' ? '<div class="entity-shadow"></div>' : ''}
        ${type !== 'effect' ? `<span class="entity-label">${resolved.tags?.[0] || id}</span>` : ''}
      `;
    }

    // Animation
    if (data.animation) el.classList.add(`anim-${data.animation}`);

    // Walk-in from offscreen
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
  },

  // ── Dynamic asset operations ────────────────────────────────

  addAsset(assetId, options = {}) {
    if (!this.container) return;
    const resolved = this._resolveAsset(assetId);
    if (!resolved) return;

    const type = resolved.layer === 'effect' ? 'effect' : (resolved.layer === 'object' ? 'object' : 'character');
    const layerClass = type === 'effect' ? 'scene-effects' : (type === 'object' ? 'scene-objects' : 'scene-characters');

    let layer = this.container.querySelector(`.${layerClass}`);
    if (!layer) layer = this._createLayer(layerClass);

    this._renderEntity({ id: assetId, ...options }, layer, type);
    EventBus.emit('asset:added', { id: assetId, ...options });
  },

  removeAsset(assetId, animation = 'fadeOut') {
    if (!this.container) return;
    const els = this.container.querySelectorAll(`[data-id="${assetId}"]`);
    if (els.length === 0) return;

    delete this.characterStates[assetId];
    els.forEach(el => {
      // Clear existing animations to avoid conflicts
      el.className = el.className.replace(/anim-\w+/g, '').trim();
      // Use direct style for reliable removal
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, -100%) scale(0.5)';
      setTimeout(() => el.remove(), 450);
    });
    EventBus.emit('asset:removed', { id: assetId, count: els.length });
  },

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
      el.addEventListener('animationend', () => {
        el.classList.remove(`anim-${options.animation}`);
      }, { once: true });
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

  // ── Character state system ──────────────────────────────────

  setCharacterState(assetId, state) {
    const el = this.container?.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;
    this._updateEntityState(el, assetId, state);
  },

  getCharacterState(assetId) {
    return this.characterStates[assetId] || 'idle';
  },

  // ── Reactions ───────────────────────────────────────────────

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

  // ── Effects ─────────────────────────────────────────────────

  applyEffects(effects) {
    if (!this.container || !effects) return;
    for (const fx of effects) {
      this.addAsset(fx.id, fx);
      if (fx.duration) {
        setTimeout(() => this.removeAsset(fx.id), fx.duration);
      }
    }
  },

  // ── Particle system ─────────────────────────────────────────

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

  // ── Clear ───────────────────────────────────────────────────

  clearScene() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.characterStates = {};
    for (const k of Object.keys(this._animationTimers)) clearTimeout(this._animationTimers[k]);
    this._animationTimers = {};
    this.currentScene = null;
    EventBus.emit('scene:cleared');
  },

  // ── Transition ──────────────────────────────────────────────

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

  // ── Time/Weather ────────────────────────────────────────────

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

  setWeatherEffect(weather) {
    this.container?.querySelectorAll('.weather-layer').forEach(el => el.remove());
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
    }
  },

  // ── Asset search ────────────────────────────────────────────

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
  }
};
