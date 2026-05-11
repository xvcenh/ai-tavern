// SVG Scene Engine - SVG Renderer
// Renders scenes by compositing SVG asset layers
// Enhanced: stateful characters, walking animations, reactions, layer ordering, auto-fit viewBox

const SVGRenderer = {
  container: null,
  svgRoot: null,          // The root <svg> element for auto-fit viewBox
  assets: {},             // id -> svg string
  assetMeta: {},          // id -> { layer, tags, origin }
  currentScene: null,
  loadedCount: 0,
  characterStates: {},    // assetId -> current state string (e.g. 'idle','surprised')
  _animationTimers: {},   // assetId -> setTimeout id for reaction cleanup
  _layerOrder: ['scene-background', 'scene-objects', 'scene-characters', 'scene-effects'],

  async init() {
    this.container = document.getElementById('scene-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'scene-container';
      this.container.className = 'scene-container';
      const gameView = document.getElementById('game-view');
      if (gameView) gameView.prepend(this.container);
    }

    // Inject CSS for walking/reaction animations and auto-fit
    this._injectStyles();

    // Scan and register all SVG assets
    await this.loadAssetManifest();
    console.log(`[SVGRenderer] Loaded ${this.loadedCount} SVG assets`);

    // Set up auto-fit viewBox on window resize
    this._setupAutoFit();
  },

  // ----------------------------------------------------------------
  // Style injection (once)
  // ----------------------------------------------------------------

  _injectStyles() {
    if (document.getElementById('svg-renderer-styles')) return;
    const style = document.createElement('style');
    style.id = 'svg-renderer-styles';
    style.textContent = `
      /* Auto-fit scene container */
      #scene-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }
      #scene-container svg.scene-svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Layer z-ordering */
      .scene-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
      .scene-background { z-index: 1; }
      .scene-objects     { z-index: 10; }
      .scene-characters  { z-index: 20; }
      .scene-effects     { z-index: 30; }

      /* Asset positioning */
      .scene-asset {
        position: absolute;
        pointer-events: auto;
        transition: left 0.8s ease-in-out, top 0.8s ease-in-out, opacity 0.3s ease-in-out;
      }

      /* Walk-in from off-screen left */
      @keyframes walkInLeft {
        0%   { transform: translate(-150%, -100%); opacity: 0; }
        30%  { opacity: 1; }
        100% { transform: translate(-50%, -100%); opacity: 1; }
      }
      /* Walk-in from off-screen right */
      @keyframes walkInRight {
        0%   { transform: translate(50%, -100%); opacity: 0; }
        30%  { opacity: 1; }
        100% { transform: translate(-50%, -100%); opacity: 1; }
      }
      /* Generic walk-in (fade + slide up) */
      @keyframes walkIn {
        0%   { transform: translate(-50%, -50%); opacity: 0; }
        100% { transform: translate(-50%, -100%); opacity: 1; }
      }

      /* Walk-out */
      @keyframes walkOutLeft {
        0%   { transform: translate(-50%, -100%); opacity: 1; }
        100% { transform: translate(-200%, -100%); opacity: 0; }
      }
      @keyframes walkOutRight {
        0%   { transform: translate(-50%, -100%); opacity: 1; }
        100% { transform: translate(100%, -100%); opacity: 0; }
      }

      /* Fade in / out */
      @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }

      /* Shock / surprise bounce */
      @keyframes shock {
        0%, 100% { transform: translate(-50%, -100%) scale(1); }
        15%      { transform: translate(-50%, -100%) scale(1.15) rotate(-3deg); }
        30%      { transform: translate(-50%, -100%) scale(1.1) rotate(3deg); }
        50%      { transform: translate(-50%, -100%) scale(1.05) rotate(-2deg); }
        70%      { transform: translate(-50%, -100%) scale(1.02); }
      }

      /* Casting glow pulse */
      @keyframes casting {
        0%, 100% { filter: brightness(1) drop-shadow(0 0 0px transparent); }
        50%      { filter: brightness(1.4) drop-shadow(0 0 12px #7b68ee); }
      }

      /* Fighting shake */
      @keyframes fighting {
        0%, 100% { transform: translate(-50%, -100%); }
        25%      { transform: translate(calc(-50% + 3px), -100%); }
        75%      { transform: translate(calc(-50% - 3px), -100%); }
      }

      /* Eating bob */
      @keyframes eating {
        0%, 100% { transform: translate(-50%, -100%); }
        50%      { transform: translate(-50%, calc(-100% + 4px)); }
      }

      /* Idle subtle breathing */
      @keyframes idle {
        0%, 100% { transform: translate(-50%, -100%) scale(1); }
        50%      { transform: translate(-50%, -100%) scale(1.015); }
      }

      .anim-walkInLeft   { animation: walkInLeft 0.8s ease-out forwards; }
      .anim-walkInRight  { animation: walkInRight 0.8s ease-out forwards; }
      .anim-walkIn       { animation: walkIn 0.6s ease-out forwards; }
      .anim-walkOutLeft  { animation: walkOutLeft 0.6s ease-in forwards; }
      .anim-walkOutRight { animation: walkOutRight 0.6s ease-in forwards; }
      .anim-fadeIn       { animation: fadeIn 0.4s ease-in forwards; }
      .anim-fadeOut      { animation: fadeOut 0.4s ease-out forwards; }
      .anim-shock        { animation: shock 0.6s ease-in-out; }
      .anim-casting      { animation: casting 1.2s ease-in-out infinite; }
      .anim-fighting     { animation: fighting 0.3s ease-in-out infinite; }
      .anim-eating       { animation: eating 0.8s ease-in-out infinite; }
      .anim-idle         { animation: idle 3s ease-in-out infinite; }

      /* Transition helpers */
      .scene-transition-fade {
        transition: opacity 0.6s ease-in-out;
      }
    `;
    document.head.appendChild(style);
  },

  // ----------------------------------------------------------------
  // Auto-fit viewBox
  // ----------------------------------------------------------------

  _setupAutoFit() {
    const resizeHandler = () => this._fitViewBox();
    window.addEventListener('resize', resizeHandler);
    // Initial fit after first render
    setTimeout(() => this._fitViewBox(), 100);
  },

  _fitViewBox() {
    // This is a no-op if we're using div-based layout (percentage positioning).
    // But if svgRoot exists (SVG compositing mode), adjust its viewBox.
    if (this.svgRoot) {
      const rect = this.container.getBoundingClientRect();
      const w = rect.width || 800;
      const h = rect.height || 500;
      this.svgRoot.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svgRoot.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
  },

  // ----------------------------------------------------------------
  // Asset loading
  // ----------------------------------------------------------------

  async loadAssetManifest() {
    const manifest = this.getAssetManifest();
    for (const asset of manifest) {
      try {
        const resp = await fetch(asset.path);
        if (resp.ok) {
          const svg = await resp.text();
          this.assets[asset.id] = svg;
          this.assetMeta[asset.id] = {
            layer: asset.layer,
            tags: asset.tags,
            origin: asset.origin || 'center-bottom'
          };
          this.loadedCount++;
        }
      } catch (e) {
        // Asset not found - skip silently
      }
    }
  },

  // Built-in asset manifest (all 37 SVG assets)
  getAssetManifest() {
    return [
      // Backgrounds (15)
      { id: 'bg-forest-day',     path: 'assets/svg/backgrounds/forest-day.svg',     layer: 'background', tags: ['forest', 'day', 'nature', 'woods'] },
      { id: 'bg-forest-night',   path: 'assets/svg/backgrounds/forest-night.svg',   layer: 'background', tags: ['forest', 'night', 'dark'] },
      { id: 'bg-tavern-interior',path: 'assets/svg/backgrounds/tavern-interior.svg',layer: 'background', tags: ['tavern', 'interior', 'inn', 'bar'] },
      { id: 'bg-crossroad',      path: 'assets/svg/backgrounds/crossroad.svg',      layer: 'background', tags: ['crossroad', 'road', 'intersection'] },
      { id: 'bg-town-square',    path: 'assets/svg/backgrounds/town-square.svg',    layer: 'background', tags: ['town', 'square', 'plaza'] },
      { id: 'bg-cave-entrance',  path: 'assets/svg/backgrounds/cave-entrance.svg',  layer: 'background', tags: ['cave', 'entrance', 'dungeon'] },
      { id: 'bg-market',         path: 'assets/svg/backgrounds/market.svg',         layer: 'background', tags: ['market', 'shop', 'trade'] },
      { id: 'bg-castle-gate',    path: 'assets/svg/backgrounds/castle-gate.svg',    layer: 'background', tags: ['castle', 'gate', 'fortress'] },
      { id: 'bg-castle',         path: 'assets/svg/backgrounds/castle.svg',         layer: 'background', tags: ['castle', 'fortress', 'tower'] },
      { id: 'bg-cave',           path: 'assets/svg/backgrounds/cave.svg',           layer: 'background', tags: ['cave', 'dungeon', 'underground'] },
      { id: 'bg-forest',         path: 'assets/svg/backgrounds/forest.svg',         layer: 'background', tags: ['forest', 'woods', 'tree', 'nature'] },
      { id: 'bg-mountain',       path: 'assets/svg/backgrounds/mountain.svg',       layer: 'background', tags: ['mountain', 'peak', 'highland'] },
      { id: 'bg-river',          path: 'assets/svg/backgrounds/river.svg',          layer: 'background', tags: ['river', 'water', 'stream', 'bridge'] },
      { id: 'bg-tavern',         path: 'assets/svg/backgrounds/tavern.svg',         layer: 'background', tags: ['tavern', 'inn', 'bar', 'drink'] },
      { id: 'bg-village',        path: 'assets/svg/backgrounds/village.svg',        layer: 'background', tags: ['village', 'town', 'houses'] },

      // Characters (14)
      { id: 'warrior-idle',   path: 'assets/svg/characters/warrior-idle.svg',   layer: 'character', tags: ['warrior', 'fighter', 'soldier', 'knight', 'hero'] },
      { id: 'mage-idle',      path: 'assets/svg/characters/mage-idle.svg',      layer: 'character', tags: ['mage', 'wizard', 'sorcerer', 'magic'] },
      { id: 'npc-merchant',   path: 'assets/svg/characters/npc-merchant.svg',   layer: 'character', tags: ['merchant', 'trader', 'shopkeeper', 'vendor'] },
      { id: 'npc-guard',      path: 'assets/svg/characters/npc-guard.svg',      layer: 'character', tags: ['guard', 'sentinel', 'patrol', 'soldier'] },
      { id: 'animal-sheep',   path: 'assets/svg/characters/animal-sheep.svg',   layer: 'character', tags: ['sheep', 'animal', 'wool', 'farm'] },
      { id: 'animal-horse',   path: 'assets/svg/characters/animal-horse.svg',   layer: 'character', tags: ['horse', 'mount', 'ride', 'animal'] },
      { id: 'bard',           path: 'assets/svg/characters/bard.svg',           layer: 'character', tags: ['bard', 'musician', 'singer', 'entertainer'] },
      { id: 'guard',          path: 'assets/svg/characters/guard.svg',          layer: 'character', tags: ['guard', 'sentinel', 'soldier'] },
      { id: 'healer',         path: 'assets/svg/characters/healer.svg',         layer: 'character', tags: ['healer', 'priest', 'cleric', 'medic'] },
      { id: 'mage',           path: 'assets/svg/characters/mage.svg',           layer: 'character', tags: ['mage', 'wizard', 'sorcerer', 'magic'] },
      { id: 'merchant',       path: 'assets/svg/characters/merchant.svg',       layer: 'character', tags: ['merchant', 'trader', 'shopkeeper'] },
      { id: 'rogue',          path: 'assets/svg/characters/rogue.svg',          layer: 'character', tags: ['rogue', 'thief', 'assassin', 'shadow'] },
      { id: 'villager',       path: 'assets/svg/characters/villager.svg',       layer: 'character', tags: ['villager', 'citizen', 'commoner'] },
      { id: 'warrior',        path: 'assets/svg/characters/warrior.svg',        layer: 'character', tags: ['warrior', 'fighter', 'soldier', 'knight'] },

      // Objects (5)
      { id: 'table',       path: 'assets/svg/objects/table.svg',       layer: 'object', tags: ['table', 'furniture'] },
      { id: 'chest',       path: 'assets/svg/objects/chest.svg',       layer: 'object', tags: ['chest', 'treasure', 'loot'] },
      { id: 'torch',       path: 'assets/svg/objects/torch.svg',       layer: 'object', tags: ['torch', 'fire', 'light'] },
      { id: 'sword',       path: 'assets/svg/objects/sword.svg',       layer: 'object', tags: ['sword', 'weapon', 'blade'] },
      { id: 'potion',      path: 'assets/svg/objects/potion.svg',      layer: 'object', tags: ['potion', 'heal', 'drink', 'bottle'] },

      // Effects (3)
      { id: 'fire',            path: 'assets/svg/effects/fire.svg',            layer: 'effect', tags: ['fire', 'flame', 'burn'] },
      { id: 'fog',             path: 'assets/svg/effects/fog.svg',             layer: 'effect', tags: ['fog', 'mist', 'atmosphere'] },
      { id: 'magic-sparkle',   path: 'assets/svg/effects/magic-sparkle.svg',   layer: 'effect', tags: ['magic', 'sparkle', 'glow', 'shine'] },
    ];
  },

  // ----------------------------------------------------------------
  // Tag-based asset search
  // ----------------------------------------------------------------

  findAssets(tags) {
    const results = [];
    for (const [id, meta] of Object.entries(this.assetMeta)) {
      const matchScore = tags.filter(t => meta.tags.includes(t)).length;
      if (matchScore > 0) {
        results.push({ id, score: matchScore, ...meta });
      }
    }
    return results.sort((a, b) => b.score - a.score);
  },

  // ----------------------------------------------------------------
  // Layer management (ensure correct z-order)
  // ----------------------------------------------------------------

  _ensureLayer(layerClass) {
    let layer = this.container.querySelector(`.${layerClass}`);
    if (!layer) {
      layer = document.createElement('div');
      layer.className = `scene-layer ${layerClass}`;
      this.container.appendChild(layer);
      this._reorderLayers();
    }
    return layer;
  },

  _reorderLayers() {
    // Ensure layers are in the correct DOM order (background < objects < characters < effects)
    const children = Array.from(this.container.children);
    for (const layerClass of this._layerOrder) {
      const el = children.find(c => c.classList.contains(layerClass));
      if (el) {
        this.container.appendChild(el); // moves to end (correct order)
      }
    }
  },

  _getLayerForAsset(assetId) {
    const meta = this.assetMeta[assetId];
    if (!meta) return 'scene-characters';
    switch (meta.layer) {
      case 'background': return 'scene-background';
      case 'object':     return 'scene-objects';
      case 'character':  return 'scene-characters';
      case 'effect':     return 'scene-effects';
      default:           return 'scene-characters';
    }
  },

  // ----------------------------------------------------------------
  // Character state system
  // ----------------------------------------------------------------

  /**
   * Get the current state of a character asset.
   * @param {string} assetId
   * @returns {string} state name (e.g. 'idle','surprised','eating')
   */
  getCharacterState(assetId) {
    return this.characterStates[assetId] || 'idle';
  },

  /**
   * Set a character's visual state. Modifies SVG elements dynamically.
   * Supported states: idle, surprised, eating, drinking, casting, fighting, look_left, spit_drink
   *
   * How it works: we wrap the original SVG in a container and apply CSS classes
   * that trigger state-specific animations and overlays.
   */
  setCharacterState(assetId, state) {
    if (!this.container) return;

    const el = this.container.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;

    const prevState = this.characterStates[assetId] || 'idle';
    this.characterStates[assetId] = state;

    // Remove previous state classes
    el.classList.remove(`state-${prevState}`, `anim-${prevState}`);
    // Remove any state overlay
    const oldOverlay = el.querySelector('.state-overlay');
    if (oldOverlay) oldOverlay.remove();

    // Apply new state
    el.classList.add(`state-${state}`);

    // Map states to animation classes and overlays
    const stateConfig = {
      idle:       { anim: 'idle',       overlay: null },
      surprised:  { anim: 'shock',      overlay: '❗' },
      eating:     { anim: 'eating',     overlay: '🍖' },
      drinking:   { anim: 'eating',     overlay: '🍺' },
      casting:    { anim: 'casting',    overlay: '✨' },
      fighting:   { anim: 'fighting',   overlay: '⚔️' },
      look_left:  { anim: null,         overlay: null, cssTransform: 'scaleX(1)' },
      spit_drink: { anim: 'shock',      overlay: '💦' },
    };

    const config = stateConfig[state] || stateConfig.idle;

    if (config.anim) {
      el.classList.add(`anim-${config.anim}`);
    }
    if (config.cssTransform) {
      el.style.transform = config.cssTransform;
    }

    // Add emoji overlay for visual feedback
    if (config.overlay) {
      const overlay = document.createElement('div');
      overlay.className = 'state-overlay';
      overlay.style.cssText = 'position:absolute;top:-10px;right:-10px;font-size:18px;pointer-events:none;z-index:99;';
      overlay.textContent = config.overlay;
      el.appendChild(overlay);
    }

    EventBus.emit('character:state', { id: assetId, state, prevState });
  },

  // ----------------------------------------------------------------
  // Render a complete scene (full re-render)
  // ----------------------------------------------------------------

  renderScene(sceneData) {
    if (!this.container) return;

    const { background, characters = [], objects = [], effects = [], transition = 'fade' } = sceneData;

    // Build layers HTML in correct z-order
    let html = '';

    // Background layer
    if (background && this.assets[background]) {
      html += `<div class="scene-layer scene-background">${this.assets[background]}</div>`;
    } else if (background) {
      html += `<div class="scene-layer scene-background scene-bg-default" data-scene="${background}"></div>`;
    }

    // Objects layer
    html += '<div class="scene-layer scene-objects">';
    for (const obj of objects) {
      if (this.assets[obj.id]) {
        html += `<div class="scene-asset scene-object" 
          style="left:${obj.x||50}%;top:${obj.y||50}%;transform:translate(-50%,-100%) scale(${obj.scale||1})"
          data-id="${obj.id}">
          ${this.assets[obj.id]}
        </div>`;
      }
    }
    html += '</div>';

    // Characters layer
    html += '<div class="scene-layer scene-characters">';
    for (const char of characters) {
      if (this.assets[char.id]) {
        const state = this.characterStates[char.id] || char.state || 'idle';
        html += `<div class="scene-asset scene-character state-${state} ${char.animation ? 'anim-' + char.animation : ''}" 
          style="left:${char.x||50}%;top:${char.y||60}%;transform:translate(-50%,-100%) scale(${char.scale||1})"
          data-id="${char.id}"
          data-state="${state}">
          ${this.assets[char.id]}
        </div>`;
      }
    }
    html += '</div>';

    // Effects layer
    html += '<div class="scene-layer scene-effects">';
    for (const fx of effects) {
      if (this.assets[fx.id]) {
        html += `<div class="scene-asset scene-effect ${fx.animation ? 'anim-' + fx.animation : ''}" 
          style="left:${fx.x||50}%;top:${fx.y||50}%;transform:translate(-50%,-50%) scale(${fx.scale||1})"
          data-id="${fx.id}">
          ${this.assets[fx.id]}
        </div>`;
      }
    }
    html += '</div>';

    // Apply transition
    this.container.className = `scene-container scene-transition-${transition}`;
    this.container.innerHTML = html;
    this.currentScene = sceneData;

    // Trigger transition
    requestAnimationFrame(() => {
      this.container.classList.add('scene-visible');
      this._fitViewBox();
    });

    EventBus.emit('scene:rendered', sceneData);
  },

  // ----------------------------------------------------------------
  // Dynamic add asset (with walk-in animation)
  // ----------------------------------------------------------------

  /**
   * Dynamically add an asset to the current scene.
   *
   * @param {string} assetId   - The asset ID (e.g. 'warrior', 'chest')
   * @param {object} options   - { x, y, scale, animation, state, fromX, fromY, duration }
   *   fromX/fromY: starting position for walk-in animation (CSS transition-based)
   *   duration: walk-in duration in ms (default 800)
   *   state: initial character state (default 'idle')
   */
  addAsset(assetId, options = {}) {
    if (!this.container || !this.assets[assetId]) return;

    const meta = this.assetMeta[assetId];
    const layerClass = this._getLayerForAsset(assetId);
    const layer = this._ensureLayer(layerClass);

    const el = document.createElement('div');
    el.className = `scene-asset scene-${meta.layer}`;
    el.dataset.id = assetId;
    el.innerHTML = this.assets[assetId];

    const targetX = options.x || 50;
    const targetY = options.y || (meta.layer === 'effect' ? 50 : 60);
    const scale = options.scale || 1;

    // --- Walk-in animation from fromX/fromY ---
    if (options.fromX !== undefined || options.fromY !== undefined) {
      const fromX = options.fromX !== undefined ? options.fromX : targetX;
      const fromY = options.fromY !== undefined ? options.fromY : targetY;
      const duration = options.duration || 800;

      // Start at origin position
      el.style.left = fromX + '%';
      el.style.top = fromY + '%';
      el.style.transform = `translate(-50%,-100%) scale(${scale})`;
      el.style.transition = `left ${duration}ms ease-in-out, top ${duration}ms ease-in-out`;
      el.style.opacity = '0';

      layer.appendChild(el);

      // Trigger walk-in on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.left = targetX + '%';
          el.style.top = targetY + '%';
        });
      });

      // Clean up transition after walk-in
      setTimeout(() => {
        el.style.transition = '';
      }, duration + 50);

    } else if (options.animation) {
      // CSS keyframe animation (walkIn, fadeIn, etc.)
      el.style.left = targetX + '%';
      el.style.top = targetY + '%';
      el.style.transform = `translate(-50%,-100%) scale(${scale})`;
      el.classList.add(`anim-${options.animation}`);

      layer.appendChild(el);

      el.addEventListener('animationend', () => {
        el.className = el.className.replace(`anim-${options.animation}`, '').trim();
      }, { once: true });

    } else {
      // No animation — place directly
      el.style.left = targetX + '%';
      el.style.top = targetY + '%';
      el.style.transform = `translate(-50%,-100%) scale(${scale})`;
      layer.appendChild(el);
    }

    // Set initial character state
    if (meta.layer === 'character') {
      const state = options.state || 'idle';
      this.characterStates[assetId] = state;
      el.classList.add(`state-${state}`);
    }

    EventBus.emit('asset:added', { id: assetId, ...options });
  },

  // ----------------------------------------------------------------
  // Remove asset (with optional walk-out animation)
  // ----------------------------------------------------------------

  removeAsset(assetId, animation = 'fadeOut') {
    if (!this.container) return;
    const el = this.container.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;

    // Clean up character state
    delete this.characterStates[assetId];
    if (this._animationTimers[assetId]) {
      clearTimeout(this._animationTimers[assetId]);
      delete this._animationTimers[assetId];
    }

    el.classList.add(`anim-${animation}`);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    EventBus.emit('asset:removed', { id: assetId });
  },

  // ----------------------------------------------------------------
  // Reaction animation (temporarily change state)
  // ----------------------------------------------------------------

  /**
   * Temporarily change a character's state, then revert after delay.
   * Supports chained reactions via array input.
   *
   * @param {string} assetId  - Character asset ID
   * @param {string} state    - Temporary state ('surprised', 'casting', etc.)
   * @param {number} delay    - How long to hold the state (ms), default 2000
   * @param {string} revertTo - State to revert to (default 'idle')
   */
  addReaction(assetId, state, delay = 2000, revertTo = 'idle') {
    if (!this.container) return;

    // Clear any existing reaction timer for this asset
    if (this._animationTimers[assetId]) {
      clearTimeout(this._animationTimers[assetId]);
    }

    // Apply the reaction state immediately
    this.setCharacterState(assetId, state);

    // Schedule revert
    this._animationTimers[assetId] = setTimeout(() => {
      this.setCharacterState(assetId, revertTo);
      delete this._animationTimers[assetId];
    }, delay);

    EventBus.emit('character:reaction', { id: assetId, state, delay, revertTo });
  },

  /**
   * Execute a chain of reactions with delays.
   * @param {Array} reactions - [{id, state, delay, revertTo}]
   */
  addReactionChain(reactions) {
    if (!Array.isArray(reactions)) return;

    for (const r of reactions) {
      const startDelay = r.startDelay || 0;
      setTimeout(() => {
        this.addReaction(r.id, r.state, r.duration || 2000, r.revertTo || 'idle');
      }, startDelay);
    }
  },

  // ----------------------------------------------------------------
  // Update an existing asset in-place (position, scale, state)
  // ----------------------------------------------------------------

  updateAsset(assetId, options = {}) {
    if (!this.container) return;
    const el = this.container.querySelector(`[data-id="${assetId}"]`);
    if (!el) return;

    if (options.x !== undefined) el.style.left = options.x + '%';
    if (options.y !== undefined) el.style.top = options.y + '%';
    if (options.scale !== undefined) {
      el.style.transform = `translate(-50%,-100%) scale(${options.scale})`;
    }
    if (options.state !== undefined && this.assetMeta[assetId]?.layer === 'character') {
      this.setCharacterState(assetId, options.state);
    }
    if (options.animation) {
      el.classList.add(`anim-${options.animation}`);
      el.addEventListener('animationend', () => {
        el.classList.remove(`anim-${options.animation}`);
      }, { once: true });
    }
  },

  // ----------------------------------------------------------------
  // Time-of-day filter
  // ----------------------------------------------------------------

  setTimeFilter(phase) {
    if (!this.container) return;
    this.container.dataset.timePhase = phase;
  },

  // ----------------------------------------------------------------
  // Weather effects
  // ----------------------------------------------------------------

  setWeatherEffect(weather) {
    if (!this.container) return;
    this.container.querySelectorAll('.scene-weather').forEach(el => el.remove());

    if (weather === 'rain' && this.assets['rain']) {
      const el = document.createElement('div');
      el.className = 'scene-layer scene-weather';
      el.innerHTML = this.assets['rain'];
      this.container.appendChild(el);
    }
  },

  // ----------------------------------------------------------------
  // Bulk effect application
  // ----------------------------------------------------------------

  applyEffects(effects) {
    if (!this.container || !effects || !Array.isArray(effects)) return;

    for (const effect of effects) {
      const assetId = effect.id;
      if (!this.assets[assetId]) {
        console.warn(`[SVGRenderer] Effect asset not found: ${assetId}`);
        continue;
      }

      const existing = this.container.querySelector(`.scene-effect[data-id="${assetId}"]`);
      if (existing) continue;

      const layer = this._ensureLayer('scene-effects');

      const el = document.createElement('div');
      el.className = `scene-asset scene-effect ${effect.animation ? 'anim-' + effect.animation : ''}`;
      el.style.left = (effect.x || 50) + '%';
      el.style.top = (effect.y || 50) + '%';
      el.style.transform = `translate(-50%,-50%) scale(${effect.scale || 1})`;
      el.dataset.id = assetId;
      el.innerHTML = this.assets[assetId];

      layer.appendChild(el);

      if (effect.duration) {
        setTimeout(() => {
          el.classList.add('anim-fadeOut');
          el.addEventListener('animationend', () => el.remove(), { once: true });
        }, effect.duration);
      }

      el.addEventListener('animationend', function handler() {
        if (el.classList.contains('anim-fadeOut')) {
          el.remove();
        } else {
          el.className = 'scene-asset scene-effect';
        }
        el.removeEventListener('animationend', handler);
      });
    }

    EventBus.emit('effects:applied', effects);
  },

  // ----------------------------------------------------------------
  // Scene transition
  // ----------------------------------------------------------------

  transition(type = 'fade', duration = 600) {
    if (!this.container) return Promise.resolve();

    return new Promise((resolve) => {
      this.container.classList.remove('scene-visible', 'scene-transition-fade', 'scene-transition-slide', 'scene-transition-zoom', 'scene-transition-none');
      this.container.style.transition = `opacity ${duration}ms ease-in-out`;

      switch (type) {
        case 'fade':
          this.container.style.opacity = '0';
          break;
        case 'slide-left':
          this.container.style.transform = 'translateX(-100%)';
          this.container.style.opacity = '0';
          break;
        case 'slide-right':
          this.container.style.transform = 'translateX(100%)';
          this.container.style.opacity = '0';
          break;
        case 'slide-up':
          this.container.style.transform = 'translateY(-100%)';
          this.container.style.opacity = '0';
          break;
        case 'zoom':
          this.container.style.transform = 'scale(0.1)';
          this.container.style.opacity = '0';
          break;
        case 'none':
          this.container.style.opacity = '1';
          this.container.style.transform = '';
          resolve();
          return;
        default:
          this.container.style.opacity = '0';
      }

      setTimeout(() => {
        this.container.style.transform = '';
        if (this.currentScene) {
          this.renderScene(this.currentScene);
        }
        requestAnimationFrame(() => {
          this.container.style.opacity = '1';
          setTimeout(() => {
            this.container.style.transition = '';
            resolve();
          }, duration);
        });
      }, duration);

      EventBus.emit('scene:transition', { type, duration });
    });
  },

  // ----------------------------------------------------------------
  // Clear all scene content
  // ----------------------------------------------------------------

  clearScene() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.characterStates = {};
    for (const key of Object.keys(this._animationTimers)) {
      clearTimeout(this._animationTimers[key]);
    }
    this._animationTimers = {};
    this.currentScene = null;
    EventBus.emit('scene:cleared');
  }
};
