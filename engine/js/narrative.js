// AI Tavern v2.0 - Narrative Engine
// Migrated from v1.0 DM: manages LLM conversation, parses commands, drives story.
// Uses EventBus for decoupled communication and LLMClient for API calls.
// World state is managed via WorldState module (separate file).

const Narrative = {
  conversationHistory: [],
  pendingAction: null,
  isProcessing: false,
  _worldData: null,
  _npcs: null,

  // ----------------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------------

  init(worldData, npcs) {
    this._worldData = worldData || {};
    this._npcs = npcs || {};
    this.conversationHistory = [];
    this.pendingAction = null;
    this.isProcessing = false;

    // Initialize WorldState if available, otherwise maintain local fallback
    if (typeof WorldState !== 'undefined') {
      WorldState.init(this._npcs);
    }

    // Subscribe to events from other modules
    EventBus.on('player:action', (data) => this.handlePlayerAction(data));
    EventBus.on('narrative:save', () => this.save());
    EventBus.on('narrative:load', () => this.load());

    console.log('[Narrative] Initialized.');
    EventBus.emit('narrative:ready', {});
  },

  // ----------------------------------------------------------------
  // System prompt construction
  // ----------------------------------------------------------------

  /**
   * Build the system prompt for the AI DM.
   * Accepts an optional worldData object; falls back to this._worldData.
   * Also pulls live state from Player, Map, WorldState, etc.
   */
  buildSystemPrompt(worldData) {
    const world = worldData || this._worldData || {};
    const meta = world.meta || {};
    const lore = world.lore || {};
    const rules = world.rules || {};

    // Gather player info (Player global from v1.0)
    const player = typeof Player !== 'undefined' ? Player : null;
    // Gather map context (Map global from v1.0)
    const nearby = typeof Map !== 'undefined' && Map.getNearbyNPC ? Map.getNearbyNPC() : null;
    const nearLoc = typeof Map !== 'undefined' && Map.getNearbyLocation ? Map.getNearbyLocation() : null;
    const dayPhase = typeof Map !== 'undefined' ? Map.dayPhase : 'day';

    // World state (WorldState module or local fallback)
    const ws = (typeof WorldState !== 'undefined') ? WorldState : null;

    const worldName = meta.name || '月影镇';
    const dayNum = ws ? ws.day : 1;
    const weather = ws ? ws.weather : 'clear';

    // --- Player section ---
    let playerSection = '暂无玩家信息。';
    if (player) {
      const statLine = ['str','dex','con','int','wis','cha'].map(s => {
        const val = player.stats[s];
        const mod = player.getModifier(s);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        const names = { str:'力量', dex:'敏捷', con:'体质', int:'智力', wis:'感知', cha:'魅力' };
        return `${names[s]}${val}(${modStr})`;
      }).join(' ');

      playerSection = [
        `- 名字：${player.name || '冒险者'}`,
        `- 种族：${typeof RACES !== 'undefined' ? RACES[player.race]?.name : player.race || '未知'}`,
        `- 职业：${typeof CLASSES !== 'undefined' ? CLASSES[player.class]?.name : player.class || '未知'}`,
        `- 等级：${player.level}`,
        `- 生命值：${player.hp}/${player.maxHp}`,
        `- 属性：${statLine}`,
        `- 金币：${player.gold}`,
        `- 物品：${player.inventory.map(i => i.name + 'x' + i.qty).join('、') || '无'}`
      ].join('\n');
    }

    // --- NPC section ---
    const npcsData = this._npcs || (typeof NPCS !== 'undefined' ? NPCS : {});
    const npcSection = Object.values(npcsData).map(n =>
      `- ${n.name}（${n.title}）：${(n.personality || '').substring(0, 80)}`
    ).join('\n') || '（无）';

    // --- Nearby NPC ---
    const nearbyNpcLine = nearby
      ? `- ${nearby.npc.name}（${nearby.npc.title}）：${nearby.npc.personality}`
      : '- 附近没有人';

    // --- Nearby location ---
    const nearbyLocLine = nearLoc
      ? `- ${nearLoc.location.name}：${nearLoc.location.description}`
      : '- 旷野';

    // --- Phase label ---
    const phaseLabel = { day: '白天', night: '深夜', dusk: '黄昏', dawn: '黎明' }[dayPhase] || '白天';

    // --- Lore ---
    const loreHistory = lore.history || '一个充满神秘的幻想世界。';
    const magicSystem = lore.magic_system || '标准魔法体系。';

    // --- Rules ---
    const diceSystem = rules.dice_system || 'd20';
    const combatEnabled = rules.combat_enabled !== false;
    const difficulty = rules.difficulty || 'normal';

    let prompt = `你是一个龙与地下城风格的AI Dungeon Master。你主持一个名为"${worldName}"的世界。

## 世界设定
- 历史：${loreHistory}
- 魔法体系：${magicSystem}
- 骰子系统：${diceSystem}
- 难度：${difficulty}

## 当前世界状态
- 第 ${dayNum} 天
- 时间：${phaseLabel}
- 天气：${weather}

## 玩家信息
${playerSection}

## 附近NPC
${nearbyNpcLine}

## 附近地点
${nearbyLocLine}

## 你的职责
1. 根据玩家的行动描述世界反应
2. 控制NPC的对话和行为
3. 在需要时要求技能检定（格式：[ROLL:属性名:难度]）${combatEnabled ? '\n4. 管理战斗（格式：[COMBAT:开始:敌人名:HP:AC]）' : ''}
5. 推进剧情和任务
6. 保持叙事沉浸感，像真正的DM一样讲故事
7. 使用scene_update控制视觉场景的变化

## 重要规则
- NPC必须保持其预设性格，不要违背他们的人设
- 每个NPC都有秘密，不会轻易透露
- 玩家行为要有后果，好的行为有奖励，坏的行为有惩罚
- 鼓励探索和创造力，不要限制玩家的自由
- 用${meta.language === 'en' ? '英文' : '中文'}回复，保持幻想文学的风格
- 回复要简洁但生动（控制在2-4句），不要过度冗长

## 可用SVG资源列表（37个）
### 背景 (backgrounds) — 用于scene_update.background
- bg-forest-day, bg-forest-night, bg-tavern-interior, bg-crossroad, bg-town-square, bg-cave-entrance, bg-market, bg-castle-gate, bg-castle, bg-cave, bg-forest, bg-mountain, bg-river, bg-tavern, bg-village

### 角色 (characters) — 用于scene_update.add_assets中的id
- warrior-idle, mage-idle, npc-merchant, npc-guard, animal-sheep, animal-horse, bard, guard, healer, mage, merchant, rogue, villager, warrior

### 物品 (objects) — 用于scene_update.add_assets中的id
- table, chest, torch, sword, potion

### 特效 (effects) — 用于scene_update.effects中的id
- fire, fog, magic-sparkle

## 角色状态系统 (Character States)
角色可以处于以下状态，通过scene_update.update中的state字段设置：
- idle（默认站立）
- surprised（惊讶，配合emoji ❗）
- eating（吃东西 🍖）
- drinking（喝酒 🍺）
- casting（施法中 ✨，会发光）
- fighting（战斗中 ⚔️，会抖动）
- look_left（向左看）
- spit_drink（喷酒 💦）

## 输出格式要求
你必须以纯JSON格式回复，不要包含markdown代码块标记。严格使用以下JSON结构：
{
  "narration": "你的叙事文本（必填，2-4句生动描述）",
  "scene_update": {
    "background": "背景资源ID（仅在场景变化时提供）",
    "add_assets": [
      {
        "id": "资源ID",
        "x": 50,
        "y": 60,
        "fromX": -20,
        "fromY": 60,
        "duration": 800,
        "scale": 1,
        "state": "idle",
        "animation": "fadeIn"
      }
    ],
    "remove_assets": ["要移除的资源ID"],
    "update": [
      {
        "id": "已有资源ID",
        "state": "surprised",
        "x": 40
      }
    ],
    "reactions": [
      {
        "id": "角色资源ID",
        "state": "surprised",
        "startDelay": 0,
        "duration": 2000,
        "revertTo": "idle"
      }
    ],
    "effects": [
      {
        "id": "特效ID",
        "x": 50,
        "y": 30,
        "scale": 1.5,
        "duration": 3000,
        "animation": "fadeIn"
      }
    ],
    "init_scene": {
      "background": "背景ID",
      "characters": [
        {"id": "角色ID", "x": 30, "y": 60, "fromX": -20, "toX": 30, "duration": 1000, "state": "idle"},
        {"id": "角色ID2", "x": 70, "y": 60, "fromX": 120, "toX": 70, "duration": 1000, "state": "idle"}
      ],
      "objects": [
        {"id": "物品ID", "x": 50, "y": 50}
      ]
    },
    "clear": false
  },
  "choices": ["玩家可选的行动选项1", "选项2", "选项3"],
  "state_changes": {"weather": "rain", "time_advance": 1}
}

### 字段说明
- narration: 必填。叙事文本。
- scene_update: 可选。控制视觉场景。支持以下子命令：
  - background: 更换背景（完全重新渲染）
  - init_scene: 完整场景初始化（清空后重新设置所有元素）
  - add_assets: 添加新元素到场景（支持fromX/fromY走路入场动画）
  - remove_assets: 移除元素
  - update: 修改已有元素的状态/位置（不重新渲染）
  - reactions: 触发反应动画链（延迟触发，自动恢复）
  - effects: 添加视觉特效
  - clear: 设为true清空整个场景
- choices: 可选。玩家行动选项（3-4个）。
- state_changes: 可选。世界状态变化（weather, time_advance等）。
- 如果不需要某个字段，完全省略（不要设为null）。

### scene_update示例

#### 示例1：玩家进入酒馆
{
  "narration": "你推开吱呀作响的木门，温暖的壁炉光芒洒在你的脸上。酒馆里弥漫着麦酒和烤肉的香气，角落里一位吟游诗人在低声弹奏。",
  "scene_update": {
    "init_scene": {
      "background": "bg-tavern-interior",
      "characters": [
        {"id": "bard", "x": 25, "y": 60, "fromX": -10, "toX": 25, "duration": 600, "state": "idle"},
        {"id": "merchant", "x": 70, "y": 60, "state": "idle"}
      ],
      "objects": [
        {"id": "table", "x": 45, "y": 65},
        {"id": "torch", "x": 15, "y": 40},
        {"id": "torch", "x": 85, "y": 40}
      ]
    }
  },
  "choices": ["走向吧台要一杯麦酒", "走向吟游诗人听他弹奏", "在角落找个位置坐下", "询问店主有没有房间"]
}

#### 示例2：NPC惊讶反应
{
  "narration": "商人瞪大了眼睛，手中的酒杯差点滑落。他显然没有预料到你会提出这样的问题。",
  "scene_update": {
    "reactions": [
      {"id": "merchant", "state": "surprised", "startDelay": 0, "duration": 2500, "revertTo": "idle"}
    ]
  }
}

#### 示例3：战斗开始
{
  "narration": "你拔出剑，对面的哥布林发出刺耳的尖叫，挥舞着生锈的短刀向你扑来！",
  "scene_update": {
    "add_assets": [
      {"id": "rogue", "x": 75, "y": 60, "fromX": 130, "toX": 75, "duration": 500, "state": "fighting"}
    ],
    "update": [
      {"id": "warrior", "state": "fighting"}
    ],
    "effects": [
      {"id": "fire", "x": 75, "y": 45, "scale": 1.2, "duration": 5000}
    ]
  }
}

#### 示例4：角色离开
{
  "narration": "卫兵向你点了点头，转身沿着石板路走远了。",
  "scene_update": {
    "reactions": [
      {"id": "guard", "state": "look_left", "startDelay": 0, "duration": 500}
    ],
    "remove_assets": ["guard"]
  }
}

#### 示例5：魔法施放
{
  "narration": "法师举起法杖，紫色的能量在杖尖汇聚，空气中充满了噼啪作响的魔力。一道炫目的光束射向了远处的敌人。",
  "scene_update": {
    "reactions": [
      {"id": "mage", "state": "casting", "startDelay": 0, "duration": 3000, "revertTo": "idle"}
    ],
    "effects": [
      {"id": "magic-sparkle", "x": 60, "y": 40, "scale": 2.0, "duration": 3000, "animation": "fadeIn"}
    ]
  }
}

## NPC人设速查
${npcSection}

现在，描述玩家看到的情况并等待他的行动。`;

    return prompt;
  },

  // ----------------------------------------------------------------
  // Send to LLM
  // ----------------------------------------------------------------

  /**
   * Send a user message to the AI and return the parsed response.
   * Uses LLMClient.chat() instead of raw fetch.
   */
  async sendToAI(userMessage) {
    if (!LLMClient.isReady()) {
      const msg = '请先在设置中配置API密钥。';
      EventBus.emit('narration:text', { text: msg, type: 'system' });
      return { text: msg, type: 'system' };
    }

    this.isProcessing = true;
    EventBus.emit('narrative:processing', { active: true });

    // Build messages array
    const messages = [
      { role: 'system', content: this.buildSystemPrompt() }
    ];

    // Add conversation history (last 20 messages for context window management)
    const recentHistory = this.conversationHistory.slice(-20);
    for (const entry of recentHistory) {
      messages.push({ role: entry.role, content: entry.content });
    }

    // Current user message
    messages.push({ role: 'user', content: userMessage });
    this.conversationHistory.push({ role: 'user', content: userMessage });

    try {
      // Use structured output for JSON responses
      const structured = await LLMClient.chatStructured(messages);
      const aiText = structured.narration || '';

      this.conversationHistory.push({ role: 'assistant', content: aiText });

      // Parse special commands embedded in the AI response text (legacy support)
      const parsed = this.parseCommands(aiText);

      // Emit the narration text so the UI can display it
      EventBus.emit('narration:text', parsed);

      // Execute any embedded commands from text parsing
      for (const cmd of parsed.commands) {
        this._executeCommand(cmd);
      }

      // Handle structured scene_update if present
      if (structured.scene_update) {
        EventBus.emit('scene:update', structured.scene_update);
      }

      // Handle structured choices if present
      if (structured.choices && structured.choices.length > 0) {
        EventBus.emit('choices:presented', { choices: structured.choices });
      }

      // Handle state_changes if present
      if (structured.state_changes) {
        this._applyStateChanges(structured.state_changes);
      }

      this.isProcessing = false;
      EventBus.emit('narrative:processing', { active: false });
      return parsed;

    } catch (error) {
      console.error('[Narrative] LLM error:', error);
      this.isProcessing = false;
      EventBus.emit('narrative:processing', { active: false });

      const errResult = {
        text: `DM暂时无法回应...（${error.message}）`,
        type: 'system'
      };
      EventBus.emit('narration:text', errResult);
      return errResult;
    }
  },

  // ----------------------------------------------------------------
  // High-level player action handler
  // ----------------------------------------------------------------

  /**
   * Called when the player performs an action (via EventBus).
   * Builds the message and delegates to sendToAI.
   */
  async handlePlayerAction(data) {
    const message = data.message || data.text || data.action || '';
    if (!message) return;

    // If it's an NPC greeting, prepend context
    if (data.type === 'npc_greet' && data.npcId) {
      const greeting = this.getNPCGreeting(data.npcId);
      if (greeting) {
        await this.sendToAI(`[与NPC ${data.npcId} 对话] ${greeting}`);
        return;
      }
    }

    await this.sendToAI(message);
  },

  // ----------------------------------------------------------------
  // Command parsing (preserved from v1.0)
  // ----------------------------------------------------------------

  /**
   * Parse special commands embedded in AI response text.
   * Supported commands:
   *   [ROLL:stat:DC]              - Skill check request
   *   [COMBAT:开始:name:HP:AC]    - Start combat encounter
   *   [REWARD:xp:gold:item]       - Grant reward to player
   */
  parseCommands(text) {
    const result = { text, type: 'dm', commands: [] };

    // Dice roll: [ROLL:stat:DC]
    const rollMatch = text.match(/\[ROLL:(\w+):(\d+)\]/);
    if (rollMatch) {
      const stat = rollMatch[1].toLowerCase();
      const dc = parseInt(rollMatch[2]);
      result.commands.push({ type: 'roll', stat, dc });
    }

    // Combat start: [COMBAT:开始:name:HP:AC]
    const combatMatch = text.match(/\[COMBAT:开始:(.+?):(\d+):(\d+)\]/);
    if (combatMatch) {
      result.commands.push({
        type: 'combat_start',
        enemy: combatMatch[1],
        hp: parseInt(combatMatch[2]),
        ac: parseInt(combatMatch[3])
      });
    }

    // Reward: [REWARD:xp:gold:item]
    const rewardMatch = text.match(/\[REWARD:(\d+):(\d+):?(.*)?\]/);
    if (rewardMatch) {
      result.commands.push({
        type: 'reward',
        xp: parseInt(rewardMatch[1]),
        gold: parseInt(rewardMatch[2]),
        item: rewardMatch[3] || null
      });
    }

    // Scene update: [SCENE:location:description]
    const sceneMatch = text.match(/\[SCENE:(.+?):(.*?)\]/);
    if (sceneMatch) {
      result.commands.push({
        type: 'scene_update',
        location: sceneMatch[1],
        description: sceneMatch[2]
      });
    }

    return result;
  },

  // ----------------------------------------------------------------
  // Command execution
  // ----------------------------------------------------------------

  /**
   * Internal dispatcher: executes a parsed command and emits events.
   */
  _executeCommand(cmd) {
    switch (cmd.type) {
      case 'roll':
        this.executeRoll(cmd.stat, cmd.dc);
        break;
      case 'combat_start':
        this._startCombat(cmd);
        break;
      case 'reward':
        this.executeReward(cmd.xp, cmd.gold, cmd.item);
        break;
      case 'scene_update':
        EventBus.emit('scene:update', {
          location: cmd.location,
          description: cmd.description
        });
        break;
      default:
        console.warn('[Narrative] Unknown command type:', cmd.type);
    }
  },

  /**
   * Execute a dice roll and emit the result.
   */
  executeRoll(stat, dc) {
    const statNames = {
      str: '力量', dex: '敏捷', con: '体质',
      int: '智力', wis: '感知', cha: '魅力'
    };

    const modifier = typeof Player !== 'undefined' ? Player.getModifier(stat) : 0;
    const roll = typeof Dice !== 'undefined' ? Dice.check(modifier) : { result: Math.ceil(Math.random() * 20), total: 0, critical: false, fumble: false };
    if (typeof Dice === 'undefined') {
      roll.total = roll.result + modifier;
      roll.success = roll.total >= dc;
      roll.critical = roll.result === 20;
      roll.fumble = roll.result === 1;
    }

    let resultText;
    const modStr = modifier >= 0 ? `+${modifier}` : `${modifier}`;
    if (roll.critical) {
      resultText = `🎲 自然20！大成功！`;
    } else if (roll.fumble) {
      resultText = `🎲 自然1...大失败...`;
    } else if (roll.success) {
      resultText = `🎲 D20=${roll.result} + ${statNames[stat]}调整(${modStr}) = ${roll.total} ≥ ${dc} ✅ 成功！`;
    } else {
      resultText = `🎲 D20=${roll.result} + ${statNames[stat]}调整(${modStr}) = ${roll.total} < ${dc} ❌ 失败`;
    }

    const rollResult = { text: resultText, roll, type: 'system', stat, dc };
    EventBus.emit('narration:text', rollResult);
    EventBus.emit('dice:rolled', rollResult);
    return rollResult;
  },

  /**
   * Execute a reward and emit the result.
   */
  executeReward(xp, gold, item) {
    if (typeof Player !== 'undefined') {
      Player.addXP(xp);
      Player.addGold(gold);
      if (item) {
        Player.addItem({
          id: item.toLowerCase().replace(/\s/g, '_'),
          name: item,
          icon: '📦',
          qty: 1,
          desc: ''
        });
      }
    }

    let msg = `✨ 获得 ${xp} 经验值`;
    if (gold > 0) msg += `, ${gold} 金币`;
    if (item) msg += `, ${item}`;

    const rewardResult = { text: msg, type: 'system', xp, gold, item };
    EventBus.emit('narration:text', rewardResult);
    EventBus.emit('reward:given', { xp, gold, item });
    return rewardResult;
  },

  /**
   * Apply state changes from structured AI response to world state.
   */
  _applyStateChanges(changes) {
    if (!changes || typeof changes !== 'object') return;

    const ws = (typeof WorldState !== 'undefined') ? WorldState : null;

    // Handle weather changes
    if (changes.weather && ws) {
      ws.weather = changes.weather;
    }

    // Handle time advancement
    if (changes.time_advance && ws) {
      ws.advanceTime(changes.time_advance);
    }

    // Apply arbitrary state changes
    for (const [key, value] of Object.entries(changes)) {
      if (key === 'weather' || key === 'time_advance') continue;
      if (ws && typeof ws.set === 'function') {
        ws.set(key, value);
      } else if (ws) {
        ws[key] = value;
      }
    }

    EventBus.emit('state:changed', changes);
  },

  /**
   * Emit a combat start event.
   */
  _startCombat(cmd) {
    const combatData = {
      enemy: cmd.enemy,
      hp: cmd.hp,
      ac: cmd.ac
    };
    EventBus.emit('narration:text', {
      text: `⚔️ 战斗开始！${cmd.enemy} 出现了！(HP: ${cmd.hp}, AC: ${cmd.ac})`,
      type: 'system'
    });
    EventBus.emit('combat:start', combatData);
  },

  // ----------------------------------------------------------------
  // NPC interaction
  // ----------------------------------------------------------------

  /**
   * Get an NPC's greeting. Marks them as talked to in WorldState.
   */
  getNPCGreeting(npcId) {
    const npcsData = this._npcs || (typeof NPCS !== 'undefined' ? NPCS : {});
    const npc = npcsData[npcId];
    if (!npc) return '';

    // Update world state
    if (typeof WorldState !== 'undefined' && WorldState.npcStates) {
      if (WorldState.npcStates[npcId]) {
        WorldState.npcStates[npcId].talkedTo = true;
      }
    }

    return npc.greet || '';
  },

  // ----------------------------------------------------------------
  // Persistence
  // ----------------------------------------------------------------

  /**
   * Save narrative state (conversation history) to localStorage.
   * World state is saved by WorldState module.
   */
  save() {
    try {
      localStorage.setItem('ai-tavern-narrative-history', JSON.stringify(this.conversationHistory.slice(-50)));
      if (typeof WorldState !== 'undefined' && WorldState.save) {
        WorldState.save();
      } else {
        // Legacy fallback
        localStorage.setItem('ai-tavern-dm', JSON.stringify(this._worldState || {}));
      }
      EventBus.emit('narrative:saved', {});
      console.log('[Narrative] State saved.');
    } catch (e) {
      console.error('[Narrative] Save failed:', e);
    }
  },

  /**
   * Load narrative state from localStorage.
   */
  load() {
    try {
      const hist = localStorage.getItem('ai-tavern-narrative-history');
      if (hist) this.conversationHistory = JSON.parse(hist);

      if (typeof WorldState !== 'undefined' && WorldState.load) {
        WorldState.load();
      } else {
        const saved = localStorage.getItem('ai-tavern-dm');
        if (saved) this._worldState = JSON.parse(saved);
      }
      EventBus.emit('narrative:loaded', {});
      console.log('[Narrative] State loaded.');
    } catch (e) {
      console.error('[Narrative] Load failed:', e);
    }
  },

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------

  /**
   * Update world data (e.g., when user switches worlds or creator saves).
   */
  setWorldData(worldData, npcs) {
    this._worldData = worldData;
    if (npcs) this._npcs = npcs;
  },

  /**
   * Reset conversation history (new game).
   */
  reset() {
    this.conversationHistory = [];
    this.pendingAction = null;
    this.isProcessing = false;
    if (typeof WorldState !== 'undefined') WorldState.init(this._npcs);
    EventBus.emit('narrative:reset', {});
  }
};
