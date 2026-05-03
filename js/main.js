// AI Tavern - Main Game Engine
// Entry point, game loop, input handling, initialization

const Game = {
  lastTime: 0,
  keys: {},
  running: false,

  async init() {
    // Initialize subsystems
    Config.init();
    DM.init();
    UI.init();
    
    // Setup canvas
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      Map.init(canvas);
    }
    
    // Setup keyboard
    this.setupKeyboard();
    
    // Setup action buttons
    this.setupActions();
    
    // Start game loop
    this.lastTime = performance.now();
    this.running = true;
    this.loop(this.lastTime);
    
    // Check if player exists
    if (!Player.load()) {
      // First time - show setup flow
      this.showSetup();
    } else {
      // Load DM state
      DM.load();
      UI.hideLoading();
      UI.renderCharacterSheet();
      UI.renderInventory();
      UI.renderQuests();
      DM.sendToAI('我来到了月影镇。环顾四周。').then(response => {
        if (response.text) UI.addNarration(response.text, 'dm');
      });
    }
  },

  showSetup() {
    UI.hideLoading();
    
    if (!Config.isConfigured()) {
      UI.showAPIConfig();
      const checkInterval = setInterval(() => {
        if (Config.isConfigured()) {
          clearInterval(checkInterval);
          UI.showCharacterCreation();
        }
      }, 500);
    } else {
      UI.showCharacterCreation();
    }
  },

  onCharacterCreated() {
    DM.init();
    UI.renderCharacterSheet();
    UI.renderInventory();
    
    const raceName = RACES[Player.race]?.name || '';
    const className = CLASSES[Player.class]?.name || '';
    
    UI.addNarration(`欢迎，${Player.name}！你是一名${raceName}${className}，来到了月影镇...`, 'dm');
    
    DM.sendToAI(`我（${Player.name}，${raceName}${className}）刚刚到达月影镇。请描述我看到的第一幕场景。`).then(response => {
      if (response.text) UI.addNarration(response.text, 'dm');
    });
  },

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      
      // Prevent default for game keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','Tab','r','Escape',' '].includes(e.key)) {
        e.preventDefault();
      }
      
      // Special keys
      if (e.key === 'r') {
        const roll = Dice.d20();
        UI.showDiceRoll(roll);
        UI.addNarration(`🎲 你掷出了 D20 = ${roll}`, 'system');
      }
      
      if (e.key === 'Escape') {
        UI.showModal('菜单', `
          <div style="display:flex;flex-direction:column;gap:8px">
            <button onclick="UI.showAPIConfig();UI.closeModal();" style="width:100%">⚙️ API设置</button>
            <button onclick="UI.showKeyHints();UI.closeModal();" style="width:100%">❓ 操作指南</button>
            <button onclick="Game.saveGame();UI.closeModal();" style="width:100%">💾 保存游戏</button>
            <button onclick="Game.loadGame();UI.closeModal();" style="width:100%">📂 读取存档</button>
            <button onclick="Game.resetGame();UI.closeModal();" style="width:100%">🔄 重新开始</button>
          </div>
        `, [
          { id: 'close', text: '关闭', callback: () => {} }
        ]);
      }
      
      if (e.key === 'Tab') {
        const tabs = document.querySelectorAll('#side-tabs button');
        const activeIdx = Array.from(tabs).findIndex(t => t.classList.contains('active'));
        const nextIdx = (activeIdx + 1) % tabs.length;
        tabs[nextIdx].click();
      }
      
      // Interact with nearby NPC on Space
      if (e.key === ' ') {
        this.interactWithNearby();
      }
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
    
    // Click on canvas to interact
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('click', () => {
        this.interactWithNearby();
      });
    }
  },

  setupActions() {
    // Quick action buttons
    document.getElementById('btn-talk')?.addEventListener('click', () => this.interactWithNearby());
    document.getElementById('btn-search')?.addEventListener('click', () => {
      UI.addNarration('你仔细地搜索了周围...', 'player');
      DM.sendToAI('我仔细搜索当前所在的位置。请描述我发现了什么。需要的话进行察觉检定。').then(r => {
        if (r.text) UI.addNarration(r.text, 'dm');
      });
    });
    document.getElementById('btn-rest')?.addEventListener('click', () => {
      const healAmount = Dice.roll(6) + Player.getModifier('con');
      Player.heal(Math.max(1, healAmount));
      Map.timeOfDay += 2;
      if (Map.timeOfDay >= 24) Map.timeOfDay -= 24;
      UI.addNarration(`你休息了一会儿，恢复了 ${Math.max(1, healAmount)} 点生命。`, 'system');
    });
    document.getElementById('btn-dice')?.addEventListener('click', () => {
      const roll = Dice.d20();
      UI.showDiceRoll(roll);
      UI.addNarration(`🎲 你掷出了 D20 = ${roll}`, 'system');
    });
    document.getElementById('btn-send')?.addEventListener('click', () => {
      const text = document.getElementById('player-input')?.value?.trim();
      if (text) {
        document.getElementById('player-input').value = '';
        this.handlePlayerAction(text);
      }
    });
  },

  // Interact with nearest NPC
  interactWithNearby() {
    const nearby = Map.getNearbyNPC();
    if (nearby) {
     UI.addNarration(`你走向 ${nearby.npc.name}...`, 'player');
      const greeting = DM.getNPCGreeting(nearby.id);
      DM.sendToAI(`${Player.name} 走向 ${nearby.npc.name}（${nearby.npc.title}）。${nearby.npc.name} 说了开场白："${greeting}"。请以${nearby.npc.name}的身份继续对话，保持他的人设。`).then(response => {
        if (response.text) UI.addNarration(response.text, 'npc', nearby.npc.name);
      });
    } else {
      UI.addNarration('附近没有人可以交谈。', 'system');
    }
  },

  // Main player action handler
  async handlePlayerAction(text) {
    if (!Config.isConfigured()) {
      UI.addNarration('请先在设置中配置API密钥（按Esc打开菜单）。', 'system');
      return;
    }
    
    if (DM.isProcessing) {
      UI.addNarration('DM正在思考...请稍等。', 'system');
      return;
    }
    
    UI.addNarration(text, 'player', Player.name);
    
    // Check for combat actions
    if (Combat.active) {
      this.handleCombatAction(text);
      return;
    }
    
    // Send to AI DM
    const response = await DM.sendToAI(text);
    
    if (response.text) {
      UI.addNarration(response.text, response.type);
    }
    
    // Execute commands
    if (response.commands) {
      for (const cmd of response.commands) {
        if (cmd.type === 'roll') {
          const result = DM.executeRoll(cmd.stat, cmd.dc);
          UI.addNarration(result.text, 'system');
          // Re-send with roll result
          DM.sendToAI(`[检定结果] ${result.text}`).then(r => {
            if (r.text) UI.addNarration(r.text, 'dm');
          });
        }
        if (cmd.type === 'combat_start') {
          Combat.start(cmd.enemy, cmd.hp, cmd.ac);
        }
        if (cmd.type === 'reward') {
          const result = DM.executeReward(cmd.xp, cmd.gold, cmd.item);
          UI.addNarration(result.text, 'system');
        }
      }
    }
    
    DM.save();
    UI.renderCharacterSheet();
    UI.renderInventory();
  },

  // Handle combat-specific actions
  handleCombatAction(text) {
    const lower = text.toLowerCase();
    if (lower.includes('攻击') || lower.includes('attack') || lower.includes('打')) {
      Combat.playerAttack();
    } else if (lower.includes('逃跑') || lower.includes('flee') || lower.includes('逃')) {
      Combat.playerFlee();
    } else {
      UI.addNarration('战斗中！选择：攻击 / 逃跑', 'system');
    }
  },

  // Save game
  saveGame() {
    Player.save();
    DM.save();
    UI.showToast('游戏已保存！');
  },

  // Load game
  loadGame() {
    if (Player.load()) {
      DM.load();
      UI.renderCharacterSheet();
      UI.renderInventory();
      UI.renderQuests();
      UI.showToast('存档已加载！');
      DM.sendToAI('[玩家加载了存档] 请描述当前场景。').then(r => {
        if (r.text) UI.addNarration(r.text, 'dm');
      });
    } else {
      UI.showToast('没有找到存档！');
    }
  },

  // Reset game
  resetGame() {
    UI.showModal('确认重置', '<p style="text-align:center">这将删除所有存档数据。确定吗？</p>', [
      {
        id: 'confirm',
        text: '确认重置',
        callback: () => {
          Player.reset();
          localStorage.removeItem('ai-tavern-dm');
          localStorage.removeItem('ai-tavern-history');
          location.reload();
        }
      },
      { id: 'cancel', text: '取消', cls: 'action-btn', callback: () => {} }
    ]);
  },

  // Main game loop
  loop(timestamp) {
    if (!this.running) return;
    
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // Cap delta time
    this.lastTime = timestamp;
    
    // Handle movement input
    let moved = false;
    if (this.keys['w'] || this.keys['ArrowUp'])    { moved = Map.movePlayer(0, -1) || moved; }
    if (this.keys['s'] || this.keys['ArrowDown'])  { moved = Map.movePlayer(0, 1) || moved; }
    if (this.keys['a'] || this.keys['ArrowLeft'])  { moved = Map.movePlayer(-1, 0) || moved; }
    if (this.keys['d'] || this.keys['ArrowRight']) { moved = Map.movePlayer(1, 0) || moved; }
    
    // Update game state
    Map.updateNPCs(dt);
    Map.updateTime(dt);
    Map.animFrame++;
    
    // Render
    Map.render();
    
    // Update HUD periodically (every 30 frames ~ 0.5s)
    if (Map.animFrame % 30 === 0) {
      UI.updateHUD();
    }
    
    requestAnimationFrame((t) => this.loop(t));
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  Game.init();
});

// Service Worker for PWA (offline capability)
if ('serviceWorker' in navigator) {
  // Could add PWA support here
}
