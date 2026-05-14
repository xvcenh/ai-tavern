// SVG Scene Engine - Scene Manager
// Parses scene DSL, manages transitions, coordinates renderer
// Enhanced: richer DSL commands, scene diff, react chains, getState()

const SceneManager = {
  currentScene: null,
  sceneHistory: [],
  _sceneAssets: new Map(), // track all currently active assets for diff
  _instanceCounter: 0,

  init() {
    EventBus.on('scene:update', (data) => this.applyUpdate(data));
  },

  // ----------------------------------------------------------------
  // DSL command types supported:
  //   init_scene  - full scene setup (background + all assets)
  //   spawn       - add asset with optional walk-in animation
  //   update      - modify existing asset (position, state, scale)
  //   remove      - remove asset with optional animation
  //   react       - chain of [{id, state, delay}] reactions
  //   clear       - clear entire scene
  //   background  - change background (triggers re-render)
  //   effects     - add visual effects
  //   weather     - set weather effect
  //   time_phase  - set time-of-day filter
  // ----------------------------------------------------------------

  /**
   * Apply a scene update. Supports both full and partial (diff) updates.
   * @param {object} update - DSL command object
   */
  applyUpdate(update) {
    if (!update) return;

    const scene = this.currentScene || this.getDefaultScene();

    // --- init_scene: full reset and setup ---
    if (update.init_scene) {
      this._applyInitScene(update.init_scene);
      return;
    }

    // --- clear: wipe scene ---
    if (update.clear === true || update.clear === 'true') {
      this._applyClear();
      return;
    }

    // --- background change ---
    if (update.background) {
      scene.background = update.background;
      // Full re-render for background change
      SVGRenderer.renderScene(scene);
    }

    // --- spawn: add assets (with optional walk-in animation) ---
    if (update.add_assets || update.spawn) {
      const spawns = update.add_assets || update.spawn;
      for (const asset of spawns) {
        this._applySpawn(asset, scene);
      }
    }

    // --- remove: remove assets ---
    if (update.remove_assets || update.remove) {
      const removals = update.remove_assets || update.remove;
      for (const assetId of removals) {
        this._applyRemove(assetId, scene);
      }
    }

    // --- update: modify existing assets (position, state) ---
    if (update.update_assets || update.update) {
      const updates = update.update_assets || update.update;
      for (const upd of updates) {
        this._applyUpdateAsset(upd);
      }
    }

    // --- react: chain of reactions with delays ---
    if (update.reactions || update.react) {
      const reactions = update.reactions || update.react;
      this._applyReactions(reactions);
    }

    // --- effects: visual effects ---
    if (update.effects) {
      scene.effects = update.effects;
      SVGRenderer.applyEffects(update.effects);
    }

    // --- weather ---
    if (update.weather) {
      SVGRenderer.setWeatherEffect(update.weather);
    }

    // --- time_phase ---
    if (update.time_phase) {
      SVGRenderer.setTimeFilter(update.time_phase);
    }

    this.currentScene = scene;
    this.sceneHistory.push({ timestamp: Date.now(), update });
    EventBus.emit('scene:updated', scene);
  },

  // ----------------------------------------------------------------
  // DSL command implementations
  // ----------------------------------------------------------------

  /**
   * init_scene: Full scene setup. Clears existing and renders from scratch.
   * @param {object} data - { background, characters, objects, effects }
   */
  _applyInitScene(data) {
    const scene = {
      background: data.background || 'bg-village',
      characters: [],
      objects: [],
      effects: data.effects || [],
      transition: data.transition || 'fade'
    };

    // Place characters
    if (data.characters) {
      for (const char of data.characters) {
        scene.characters.push({
          id: char.id,
          x: char.x || char.toX || 50,
          y: char.y || 60,
          scale: char.scale || 1,
          state: char.state || 'idle'
        });
      }
    }

    // Place objects
    if (data.objects) {
      for (const obj of data.objects) {
        scene.objects.push({
          id: obj.id,
          x: obj.x || 50,
          y: obj.y || 50,
          scale: obj.scale || 1
        });
      }
    }

    // Track assets for diff
    this._sceneAssets.clear();
    for (const c of scene.characters) this._sceneAssets.set(c.id, c);
    for (const o of scene.objects) this._sceneAssets.set(o.id, o);

    this.currentScene = scene;
    SVGRenderer.renderScene(scene);

    // Apply walk-in animations after full render
    if (data.characters) {
      for (const char of data.characters) {
        if (char.fromX !== undefined || char.fromY !== undefined) {
          const el = SVGRenderer.container?.querySelector(`[data-id="${char.id}"]`);
          if (el) {
            const fromX = char.fromX !== undefined ? char.fromX : (char.x || 50);
            const fromY = char.fromY !== undefined ? char.fromY : (char.y || 60);
            const duration = char.duration || 800;
            el.style.left = fromX + '%';
            el.style.top = fromY + '%';
            el.style.transition = `left ${duration}ms ease-in-out, top ${duration}ms ease-in-out`;
            el.style.opacity = '0';
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                el.style.opacity = '1';
                el.style.left = (char.x || char.toX || 50) + '%';
                el.style.top = (char.y || 60) + '%';
              });
            });
            setTimeout(() => { el.style.transition = ''; }, duration + 50);
          }
        }
      }
    }
  },

  /**
   * spawn: Add a single asset with optional walk-in animation.
   * @param {object} asset - { id, x, y, fromX, fromY, toX, duration, scale, state, animation }
   * @param {object} scene  - current scene to update
   */
  _applySpawn(asset, scene) {
    // Support gx/gy grid coordinates
    if (asset.gx !== undefined || asset.gy !== undefined) {
      const grid = SVGRenderer.gridToPercent(
        asset.gx ?? Math.floor(SVGRenderer.GRID_COLS / 2),
        asset.gy ?? Math.floor(SVGRenderer.GRID_ROWS * 0.6)
      );
      asset.x = grid.x;
      asset.y = grid.y;
      if (asset.toX === undefined) asset.toX = grid.x;
    }

    let meta = SVGRenderer.assetMeta[asset.id];
    // Dynamic asset: resolve via renderer (emoji fallback)
    if (!meta && SVGRenderer._resolveAsset) {
      meta = SVGRenderer._resolveAsset(asset.id);
    }
    if (!meta) {
      console.warn(`[SceneManager] Unknown asset: ${asset.id}`);
      return;
    }

    // Determine final position with auto-spacing
    let targetX = asset.toX !== undefined ? asset.toX : (asset.x || 50);
    const targetY = asset.y || (meta.layer === 'effect' ? 50 : 60);
    const instanceKey = `${asset.id}#${++this._instanceCounter}`;

    // Auto-space: avoid overlapping entities in the same layer
    if (meta.layer === 'character' || meta.layer === 'object') {
      const MIN_GAP = meta.layer === 'character' ? 12 : 8;
      let attempts = 0;
      let adjustedX = targetX;
      while (attempts < 15) {
        let overlap = false;
        for (const [key, tracked] of this._sceneAssets) {
          if (key === instanceKey) continue; // skip self only
          if (tracked._layer !== meta.layer) continue;
          if (Math.abs(tracked.x - adjustedX) < MIN_GAP) {
            overlap = true;
            break;
          }
        }
        if (!overlap) { targetX = adjustedX; break; }
        const offset = MIN_GAP * (Math.floor(attempts / 2) + 1);
        adjustedX = attempts % 2 === 0 ? targetX + offset : targetX - offset;
        if (adjustedX < 5) adjustedX = 5;
        if (adjustedX > 95) adjustedX = 95;
        attempts++;
      }
    }
    const assetData = {
      id: asset.id,
      _instanceKey: instanceKey,
      _layer: meta.layer,
      x: targetX,
      y: targetY,
      scale: asset.scale || 1,
      state: asset.state || 'idle',
      animation: asset.animation || ''
    };

    // Add to scene data
    if (meta.layer === 'character') {
      scene.characters = scene.characters || [];
      scene.characters.push(assetData);
    } else if (meta.layer === 'object') {
      scene.objects = scene.objects || [];
      scene.objects.push(assetData);
    } else if (meta.layer === 'effect') {
      scene.effects = scene.effects || [];
      scene.effects.push(assetData);
    }

    // Track for diff (keyed by instance, not id)
    this._sceneAssets.set(instanceKey, assetData);

    // Dynamically add to renderer
    SVGRenderer.addAsset(asset.id, {
      x: targetX,
      y: targetY,
      scale: asset.scale || 1,
      state: asset.state || 'idle',
      animation: asset.animation || (asset.fromX !== undefined ? undefined : 'fadeIn'),
      fromX: asset.fromX,
      fromY: asset.fromY,
      duration: asset.duration
    });
  },

  /**
   * remove: Remove an asset by ID.
   * @param {string} assetId
   * @param {object} scene
   */
  _applyRemove(assetId, scene) {
    scene.characters = (scene.characters || []).filter(a => a.id !== assetId);
    scene.objects = (scene.objects || []).filter(a => a.id !== assetId);
    scene.effects = (scene.effects || []).filter(a => a.id !== assetId);

    // Remove all instances with matching ID
    for (const [key, tracked] of this._sceneAssets) {
      if (tracked.id === assetId) this._sceneAssets.delete(key);
    }
    SVGRenderer.removeAsset(assetId);
  },

  /**
   * update: Modify an existing asset (position, state, scale).
   * @param {object} upd - { id, x?, y?, state?, scale?, animation? }
   */
  _applyUpdateAsset(upd) {
    if (!upd.id) return;

    SVGRenderer.updateAsset(upd.id, {
      x: upd.x,
      y: upd.y,
      state: upd.state,
      scale: upd.scale,
      animation: upd.animation
    });

    // Update tracked data
    const tracked = this._sceneAssets.get(upd.id);
    if (tracked) {
      if (upd.x !== undefined) tracked.x = upd.x;
      if (upd.y !== undefined) tracked.y = upd.y;
      if (upd.state !== undefined) tracked.state = upd.state;
      if (upd.scale !== undefined) tracked.scale = upd.scale;
    }
  },

  /**
   * react: Apply a chain of reactions with delays.
   * @param {Array} reactions - [{id, state, delay?, duration?, startDelay?, revertTo?}]
   *   delay / startDelay: ms before applying this reaction (for chaining)
   *   duration: how long the reaction state lasts before reverting
   *   revertTo: state to revert to (default 'idle')
   */
  _applyReactions(reactions) {
    if (!Array.isArray(reactions)) {
      reactions = [reactions];
    }

    // Chain: each reaction starts after the previous one's delay
    let cumulativeDelay = 0;

    for (const r of reactions) {
      const startDelay = r.startDelay || r.delay || 0;
      cumulativeDelay += startDelay;

      const entry = {
        id: r.id,
        state: r.state,
        startDelay: cumulativeDelay,
        duration: r.duration || 2000,
        revertTo: r.revertTo || 'idle'
      };

      SVGRenderer.addReactionChain([entry]);
    }
  },

  /**
   * clear: Wipe entire scene.
   */
  _applyClear() {
    this.currentScene = this.getDefaultScene();
    this._sceneAssets.clear();
    SVGRenderer.clearScene();
    EventBus.emit('scene:cleared');
  },

  // ----------------------------------------------------------------
  // Scene diff: compare desired state vs current, only update changes
  // ----------------------------------------------------------------

  /**
   * Apply a scene diff — given desired asset lists, figure out what changed.
   * @param {object} desired - { background, characters, objects, effects }
   */
  applyDiff(desired) {
    const current = this.currentScene || this.getDefaultScene();

    // Background diff
    if (desired.background && desired.background !== current.background) {
      current.background = desired.background;
      SVGRenderer.renderScene(current);
    }

    // Character diff
    if (desired.characters) {
      const currentIds = new Set((current.characters || []).map(c => c.id));
      const desiredIds = new Set(desired.characters.map(c => c.id));

      // Remove characters not in desired
      for (const id of currentIds) {
        if (!desiredIds.has(id)) {
          this._applyRemove(id, current);
        }
      }

      // Add or update characters
      for (const char of desired.characters) {
        if (currentIds.has(char.id)) {
          this._applyUpdateAsset(char);
        } else {
          this._applySpawn(char, current);
        }
      }
    }

    // Object diff (same pattern)
    if (desired.objects) {
      const currentIds = new Set((current.objects || []).map(o => o.id));
      const desiredIds = new Set(desired.objects.map(o => o.id));

      for (const id of currentIds) {
        if (!desiredIds.has(id)) {
          this._applyRemove(id, current);
        }
      }

      for (const obj of desired.objects) {
        if (currentIds.has(obj.id)) {
          this._applyUpdateAsset(obj);
        } else {
          this._applySpawn(obj, current);
        }
      }
    }

    this.currentScene = current;
  },

  // ----------------------------------------------------------------
  // Text-based scene extraction (legacy fallback)
  // ----------------------------------------------------------------

  extractSceneFromText(text) {
    if (!text) return null;

    const result = {};
    const lower = text.toLowerCase();

    const sceneKeywords = {
      'bg-tavern-interior': ['酒馆内部', 'tavern interior'],
      'bg-tavern':    ['酒馆', 'tavern', '酒吧', '吧台', '麦酒'],
      'bg-forest-day': ['森林白天', 'forest day'],
      'bg-forest-night': ['森林夜晚', '森林夜', 'forest night', 'night forest'],
      'bg-forest':    ['森林', '树林', '树丛', '林中', 'forest', 'woods'],
      'bg-cave-entrance': ['洞口', 'cave entrance'],
      'bg-cave':      ['洞穴', '洞窟', '地下', 'cave', 'dungeon'],
      'bg-market':    ['集市', '市场', '摊位', 'market', 'shop'],
      'bg-castle-gate': ['城堡大门', 'castle gate'],
      'bg-castle':    ['城堡', '宫殿', '塔楼', 'castle', 'tower'],
      'bg-crossroad': ['十字路口', '岔路', '路口', 'crossroad', 'intersection'],
      'bg-town-square': ['广场', 'town square'],
      'bg-village':   ['村庄', '小镇', '村落', 'village', 'town'],
      'bg-river':     ['河边', '河岸', '桥上', 'river', 'bridge'],
      'bg-mountain':  ['山顶', '山峰', '高地', 'mountain', 'peak']
    };

    for (const [bgId, keywords] of Object.entries(sceneKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        result.background = bgId;
        break;
      }
    }

    const charKeywords = {
      'animal-sheep':  ['羊', '绵羊', 'sheep'],
      'animal-horse':  ['马', 'horse', '骏马'],
      'warrior':       ['战士', 'warrior', '勇士'],
      'warrior-idle':  ['战士', 'warrior', '勇士'],
      'mage':          ['法师', 'mage', 'wizard'],
      'mage-idle':     ['法师', 'mage', 'wizard'],
      'merchant':      ['商人', 'merchant', '小贩'],
      'npc-merchant':  ['商人', 'merchant', '小贩'],
      'guard':         ['卫兵', 'guard', '守卫'],
      'npc-guard':     ['卫兵', 'guard', '守卫'],
      'bard':          ['诗人', 'bard', '吟游'],
      'healer':        ['治疗师', 'healer', '牧师'],
      'rogue':         ['盗贼', 'rogue', '刺客'],
      'villager':      ['村民', 'villager', '平民'],
    };

    const detectedChars = [];
    for (const [charId, keywords] of Object.entries(charKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        detectedChars.push({
          id: charId,
          x: 30 + Math.random() * 40,
          y: 50 + Math.random() * 20,
          animation: 'fadeIn'
        });
      }
    }
    if (detectedChars.length > 0) {
      result.add_assets = detectedChars;
    }

    return Object.keys(result).length > 0 ? result : null;
  },

  // ----------------------------------------------------------------
  // Tag-based asset matching
  // ----------------------------------------------------------------

  matchAssets(description) {
    if (!description || typeof description !== 'string') return [];

    const lower = description.toLowerCase();
    const results = [];

    for (const [id, meta] of Object.entries(SVGRenderer.assetMeta)) {
      let score = 0;

      for (const tag of meta.tags) {
        if (lower.includes(tag)) score += 2;
      }

      const idParts = id.replace(/^(bg-|char-|mon-|obj-|fx-|animal-|npc-)/, '').split('-');
      for (const part of idParts) {
        if (part.length > 2 && lower.includes(part)) score += 1;
      }

      const synonyms = {
        'bg-forest':     ['树林', '树木', '林间', '森林深处'],
        'bg-tavern':     ['酒馆', '小酌', '饮酒', '酒吧'],
        'bg-cave':       ['山洞', '地牢', '黑暗', '洞穴深处'],
        'bg-crossroad':  ['岔路', '路口', '分叉', '十字路口'],
        'bg-market':     ['买卖', '商品', '摆摊', '集市'],
        'bg-castle':     ['王宫', '塔楼', '城墙', '城堡'],
        'bg-village':    ['民居', '小屋', '村庄', '小镇'],
        'bg-river':      ['溪流', '流水', '桥', '河边'],
        'bg-mountain':   ['山峰', '高处', '悬崖', '山顶'],
        'animal-sheep':  ['绵羊', '羊群', '羊毛'],
        'animal-horse':  ['骏马', '坐骑', '马匹'],
        'warrior':       ['勇士', '剑士', '战士'],
        'mage':          ['魔法师', '巫师', '术士'],
        'merchant':      ['小贩', '店主', '商贩'],
        'guard':         ['守卫', '士兵', '警卫'],
        'bard':          ['吟游', '歌者', '乐师'],
        'healer':        ['牧师', '治疗者', '祭司'],
        'rogue':         ['刺客', '小偷', '暗影'],
        'villager':      ['平民', '村民', '百姓'],
      };

      if (synonyms[id]) {
        for (const syn of synonyms[id]) {
          if (lower.includes(syn)) score += 3;
        }
      }

      if (score > 0) {
        results.push({ id, score, layer: meta.layer, tags: meta.tags });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  },

  // ----------------------------------------------------------------
  // Default scene
  // ----------------------------------------------------------------

  getDefaultScene() {
    return {
      background: 'bg-village',
      characters: [],
      objects: [],
      effects: [],
      transition: 'fade'
    };
  },

  // ----------------------------------------------------------------
  // DSL scene loading
  // ----------------------------------------------------------------

  loadSceneFromDSL(sceneData) {
    const scene = {
      background: sceneData.background?.asset || sceneData.background,
      characters: [],
      objects: [],
      effects: [],
      transition: sceneData.transitions?.enter || 'fade'
    };

    if (sceneData.layers) {
      for (const layer of sceneData.layers) {
        const items = (layer.items || []).map(item => ({
          id: item.asset,
          x: item.position?.x ? (item.position.x / 800 * 100) : 50,
          y: item.position?.y ? (item.position.y / 500 * 100) : 60,
          scale: item.scale || 1,
          animation: item.animation || '',
          state: item.state || 'idle'
        }));

        if (layer.layer === 'characters') scene.characters.push(...items);
        else if (layer.layer === 'objects') scene.objects.push(...items);
        else if (layer.layer === 'effects') scene.effects.push(...items);
      }
    }

    this.currentScene = scene;
    SVGRenderer.renderScene(scene);
    return scene;
  },

  // ----------------------------------------------------------------
  // State serialization (for save system)
  // ----------------------------------------------------------------

  /**
   * Get the complete serializable scene state.
   * Call this to persist scene to localStorage or save file.
   */
  getState() {
    const scene = this.currentScene || this.getDefaultScene();
    return {
      ...scene,
      characterStates: { ...SVGRenderer.characterStates },
      activeAssets: Array.from(this._sceneAssets.entries()).map(([id, data]) => ({ id, ...data })),
      timestamp: Date.now()
    };
  },

  /**
   * Restore scene state (for load system).
   */
  setState(state) {
    if (!state) return;

    this.currentScene = {
      background: state.background || 'bg-village',
      characters: state.characters || [],
      objects: state.objects || [],
      effects: state.effects || [],
      transition: state.transition || 'fade'
    };

    // Restore character states
    if (state.characterStates) {
      Object.assign(SVGRenderer.characterStates, state.characterStates);
    }

    // Rebuild asset tracking
    this._sceneAssets.clear();
    if (state.activeAssets) {
      for (const a of state.activeAssets) {
        this._sceneAssets.set(a.id, a);
      }
    }

    SVGRenderer.renderScene(this.currentScene);

    // Re-apply character states after render
    if (state.characterStates) {
      for (const [id, charState] of Object.entries(state.characterStates)) {
        SVGRenderer.setCharacterState(id, charState);
      }
    }

    EventBus.emit('scene:restored', this.currentScene);
  }
};
