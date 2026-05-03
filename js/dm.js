// AI Tavern - AI Dungeon Master
// Manages all AI interactions: narration, NPC dialogue, world state, quest generation

const DM = {
  conversationHistory: [],  // Full context for the AI
  worldState: {},           // Persistent world state
  pendingAction: null,      // Current action being processed
  isProcessing: false,
  
  init() {
    this.conversationHistory = [];
    this.worldState = {
      day: 1,
      time: 'morning',
      weather: 'clear',
      events: [],
      activeQuests: [],
      completedQuests: [],
      npcStates: {}
    };
    
    // Initialize NPC states
    for (const [id, npc] of Object.entries(NPCS)) {
      this.worldState.npcStates[id] = {
        alive: true,
        location: npc.schedule[0]?.loc || 'unknown',
        mood: 'neutral',
        playerReputation: 0,
        talkedTo: false
      };
    }
  },

  // Build the system prompt for the AI DM
  buildSystemPrompt() {
    const player = Player;
    const nearby = Map.getNearbyNPC();
    const nearLoc = Map.getNearbyLocation();
    
    let prompt = `你是一个龙与地下城风格的AI Dungeon Master。你主持一个名为"月影镇"的幻想小镇。

## 当前世界状态
- 第 ${this.worldState.day} 天
- 时间：${Map.dayPhase === 'day' ? '白天' : Map.dayPhase === 'night' ? '深夜' : Map.dayPhase === 'dusk' ? '黄昏' : '黎明'}
- 天气：${this.worldState.weather}

## 玩家信息
- 名字：${player.name || '冒险者'}
- 种族：${RACES[player.race]?.name || '未知'}
- 职业：${CLASSES[player.class]?.name || '未知'}
- 等级：${player.level}
- 生命值：${player.hp}/${player.maxHp}
- 属性：力量${player.stats.str}(${player.getModifier('str')>=0?'+':''}${player.getModifier('str')}) 敏捷${player.stats.dex}(${player.getModifier('dex')>=0?'+':''}${player.getModifier('dex')}) 体质${player.stats.con}(${player.getModifier('con')>=0?'+':''}${player.getModifier('con')}) 智力${player.stats.int}(${player.getModifier('int')>=0?'+':''}${player.getModifier('int')}) 感知${player.stats.wis}(${player.getModifier('wis')>=0?'+':''}${player.getModifier('wis')}) 魅力${player.stats.cha}(${player.getModifier('cha')>=0?'+':''}${player.getModifier('cha')})
- 金币：${player.gold}
- 物品：${player.inventory.map(i => i.name + 'x' + i.qty).join('、') || '无'}

## 附近NPC
${nearby ? `- ${nearby.npc.name}（${nearby.npc.title}）：${nearby.npc.personality}` : '- 附近没有人'}

## 附近地点
${nearLoc ? `- ${nearLoc.location.name}：${nearLoc.location.description}` : '- 旷野'}

## 你的职责
1. 根据玩家的行动描述世界反应
2. 控制NPC的对话和行为
3. 在需要时要求技能检定（格式：[ROLL:属性名:难度]）
4. 管理战斗（格式：[COMBAT:开始:敌人名:HP:AC]）
5. 推进剧情和任务
6. 保持叙事沉浸感，像真正的DM一样讲故事

## 重要规则
- NPC必须保持其预设性格，不要违背他们的人设
- 每个NPC都有秘密，不会轻易透露
- 玩家行为要有后果，好的行为有奖励，坏的行为有惩罚
- 鼓励探索和创造力，不要限制玩家的自由
- 用中文回复，保持幻想文学的风格
- 回复要简洁但生动（控制在2-4句），不要过度冗长

## NPC人设速查
${Object.values(NPCS).map(n => `- ${n.name}（${n.title}）：${n.personality.substring(0,80)}`).join('\n')}

现在，描述玩家看到的情况并等待他的行动。`;

    return prompt;
  },

  // Send message to AI and get response
  async sendToAI(userMessage) {
    if (!Config.isConfigured()) {
      return { text: '请先在设置中配置API密钥。', type: 'system' };
    }
    
    this.isProcessing = true;
    
    // Build messages array
    const messages = [
      { role: 'system', content: this.buildSystemPrompt() }
    ];
    
    // Add conversation history (last 20 messages to stay within token limits)
    const recentHistory = this.conversationHistory.slice(-20);
    for (const entry of recentHistory) {
      messages.push({ role: entry.role, content: entry.content });
    }
    
    // Add current user message
    messages.push({ role: 'user', content: userMessage });
    this.conversationHistory.push({ role: 'user', content: userMessage });
    
    try {
      const response = await fetch(`${Config.get('apiEndpoint')}/chat/completions`, {
        method: 'POST',
        headers: Config.getHeaders(),
        body: JSON.stringify({
          model: Config.get('model'),
          messages: messages,
          temperature: Config.get('temperature'),
          max_tokens: Config.get('maxTokens')
        })
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error ${response.status}: ${errText}`);
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      this.conversationHistory.push({ role: 'assistant', content: aiResponse });
      
      // Parse special commands from AI response
      const parsed = this.parseCommands(aiResponse);
      
      this.isProcessing = false;
      return parsed;
      
    } catch (error) {
      this.isProcessing = false;
      return { 
        text: `DM暂时无法回应...（${error.message}）`, 
        type: 'system' 
      };
    }
  },

  // Parse special commands in AI response
  parseCommands(text) {
    const result = { text, type: 'dm', commands: [] };
    
    // Check for dice roll command: [ROLL:stat:DC]
    const rollMatch = text.match(/\[ROLL:(\w+):(\d+)\]/);
    if (rollMatch) {
      const stat = rollMatch[1].toLowerCase();
      const dc = parseInt(rollMatch[2]);
      const modifier = Player.getModifier(stat);
      const roll = Dice.check(modifier);
      result.commands.push({ type: 'roll', stat, dc, roll, modifier });
    }
    
    // Check for combat start: [COMBAT:开始:name:HP:AC]
    const combatMatch = text.match(/\[COMBAT:开始:(.+?):(\d+):(\d+)\]/);
    if (combatMatch) {
      result.commands.push({
        type: 'combat_start',
        enemy: combatMatch[1],
        hp: parseInt(combatMatch[2]),
        ac: parseInt(combatMatch[3])
      });
    }
    
    // Check for reward: [REWARD:xp:gold:item]
    const rewardMatch = text.match(/\[REWARD:(\d+):(\d+):?(.*)?\]/);
    if (rewardMatch) {
      result.commands.push({
        type: 'reward',
        xp: parseInt(rewardMatch[1]),
        gold: parseInt(rewardMatch[2]),
        item: rewardMatch[3] || null
      });
    }
    
    return result;
  },

  // Handle dice roll command
  executeRoll(stat, dc) {
    const statNames = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
    const modifier = Player.getModifier(stat);
    const roll = Dice.check(modifier);
    
    let resultText;
    if (roll.critical) {
      resultText = `🎲 自然20！大成功！`;
    } else if (roll.fumble) {
      resultText = `🎲 自然1...大失败...`;
    } else if (roll.success) {
      resultText = `🎲 D20=${roll.result} + ${statNames[stat]}调整(${modifier>=0?'+':''}${modifier}) = ${roll.total} ≥ ${dc} ✅ 成功！`;
    } else {
      resultText = `🎲 D20=${roll.result} + ${statNames[stat]}调整(${modifier>=0?'+':''}${modifier}) = ${roll.total} < ${dc} ❌ 失败`;
    }
    
    return { text: resultText, roll, type: 'system' };
  },

  // Execute rewards
  executeReward(xp, gold, item) {
    Player.addXP(xp);
    Player.addGold(gold);
    if (item) {
      Player.addItem({ id: item.toLowerCase().replace(/\s/g,'_'), name: item, icon: '📦', qty: 1, desc: '' });
    }
    
    let msg = `✨ 获得 ${xp} 经验值`;
    if (gold > 0) msg += `, ${gold} 金币`;
    if (item) msg += `, ${item}`;
    return { text: msg, type: 'system' };
  },

  // Generate NPC greeting
  getNPCGreeting(npcId) {
    const npc = NPCS[npcId];
    if (!npc) return '';
    const state = this.worldState.npcStates[npcId];
    state.talkedTo = true;
    return npc.greet;
  },

  // Save DM state
  save() {
    localStorage.setItem('ai-tavern-dm', JSON.stringify(this.worldState));
    localStorage.setItem('ai-tavern-history', JSON.stringify(this.conversationHistory.slice(-50)));
  },

  load() {
    const saved = localStorage.getItem('ai-tavern-dm');
    if (saved) this.worldState = JSON.parse(saved);
    const hist = localStorage.getItem('ai-tavern-history');
    if (hist) this.conversationHistory = JSON.parse(hist);
  }
};
