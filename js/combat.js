// AI Tavern - Combat System
// Turn-based combat with initiative, attacks, spells, and status effects

const Combat = {
  active: false,
  enemies: [],
  turnOrder: [],
  currentTurn: 0,
  round: 1,

  // Start a combat encounter
  start(enemyName, enemyHP, enemyAC) {
    this.active = true;
    this.round = 1;
    this.enemies = [{
      name: enemyName,
      hp: enemyHP,
      maxHp: enemyHP,
      ac: enemyAC,
      str: 14, dex: 12, con: 14, int: 8, wis: 10, cha: 8,
      attacks: [{ name: '攻击', damage: '1d6+2', hitBonus: 4 }]
    }];
    
    // Roll initiative
    this.rollInitiative();
    
    UI.addNarration(`⚔️ 战斗开始！${enemyName}出现了！`, 'combat');
    UI.addNarration(`先攻顺序：${this.turnOrder.map(t => t.name).join(' → ')}`, 'system');
    
    this.nextTurn();
  },

  rollInitiative() {
    this.turnOrder = [];
    // Player initiative
    const playerInit = Dice.d20() + Player.getModifier('dex');
    this.turnOrder.push({ name: Player.name || '你', type: 'player', initiative: playerInit });
    
    // Enemy initiative
    for (const enemy of this.enemies) {
      const init = Dice.d20() + Dice.modifierFromScore(enemy.dex);
      this.turnOrder.push({ name: enemy.name, type: 'enemy', enemyIndex: 0, initiative: init });
    }
    
    // Sort by initiative (highest first)
    this.turnOrder.sort((a, b) => b.initiative - a.initiative);
    this.currentTurn = 0;
  },

  nextTurn() {
    if (!this.active) return;
    
    // Check if combat is over
    if (this.enemies.every(e => e.hp <= 0)) {
      this.end(true);
      return;
    }
    if (Player.hp <= 0) {
      this.end(false);
      return;
    }
    
    const current = this.turnOrder[this.currentTurn];
    if (!current) {
      // Start new round
      this.round++;
      this.currentTurn = 0;
      UI.addNarration(`—— 第 ${this.round} 回合 ——`, 'system');
      this.nextTurn();
      return;
    }
    
    if (current.type === 'player') {
      UI.addNarration(`轮到你了！选择一个行动：`, 'system');
      // Player turn - handled by Game.handleCombatAction
    } else {
      // Enemy turn
      this.enemyTurn(current);
    }
  },

  enemyTurn(turnData) {
    const enemy = this.enemies[turnData.enemyIndex];
    if (!enemy || enemy.hp <= 0) {
      this.currentTurn++;
      setTimeout(() => this.nextTurn(), 500);
      return;
    }
    
    // Enemy attacks player
    const attack = enemy.attacks[0];
    const roll = Dice.d20() + attack.hitBonus;
    const hit = roll >= Player.ac;
    
    UI.addNarration(`${enemy.name} 发动攻击！`, 'combat');
    
    if (roll === 20 || (roll >= Player.ac && roll !== 1)) {
      const dmg = Dice.damage(attack.damage);
      const killed = Player.takeDamage(dmg.total);
      UI.addNarration(`命中！造成 ${dmg.total} 点伤害！（HP: ${Player.hp}/${Player.maxHp}）`, 'combat');
      
      if (killed) {
        UI.addNarration('💀 你被击败了...', 'combat');
        this.end(false);
        return;
      }
    } else {
      UI.addNarration(`未命中！（掷骰=${roll}，你的AC=${Player.ac}）`, 'combat');
    }
    
    this.currentTurn++;
    setTimeout(() => this.nextTurn(), 800);
  },

  // Player attacks
  playerAttack() {
    if (!this.active) return;
    
    const enemy = this.enemies[0];
    if (!enemy || enemy.hp <= 0) return;
    
    const strMod = Player.getModifier('str');
    const dexMod = Player.getModifier('dex');
    const attackMod = Player.class === 'rogue' || Player.class === 'ranger' ? dexMod : strMod;
    const roll = Dice.d20() + attackMod + 2; // Proficiency bonus
    
    UI.showDiceRoll(roll >= enemy.ac ? `${roll} ⚔️` : `${roll} 💨`);
    
    if (roll >= enemy.ac) {
      const dmgFormula = Player.class === 'rogue' ? '1d4' : Player.class === 'ranger' ? '1d8' : '1d8';
      const dmg = Dice.damage(dmgFormula);
      enemy.hp -= dmg.total + Math.max(0, attackMod);
      
      UI.addNarration(`命中！对 ${enemy.name} 造成 ${dmg.total + Math.max(0, attackMod)} 点伤害！`, 'combat');
      
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        UI.addNarration(`💀 ${enemy.name} 被击败了！`, 'combat');
        this.end(true);
        return;
      }
    } else {
      UI.addNarration(`未命中！（掷骰=${roll}，敌人AC=${enemy.ac}）`, 'combat');
    }
    
    this.currentTurn++;
    setTimeout(() => this.nextTurn(), 500);
  },

  // Player tries to flee
  playerFlee() {
    const dexCheck = Dice.check(Player.getModifier('dex'));
    if (dexCheck.success) {
      UI.addNarration('你成功逃脱了！', 'system');
      this.end(false, true);
    } else {
      UI.addNarration('逃跑失败！敌人趁机攻击！', 'combat');
      this.currentTurn++;
      this.nextTurn();
    }
  },

  // End combat
  end(victory, fled = false) {
    this.active = false;
    if (victory) {
      const enemy = this.enemies[0];
      UI.addNarration(`🎉 战斗胜利！`, 'system');
      if (enemy) {
        const xpReward = enemy.maxHp * 5 + 20;
        const goldReward = Dice.roll(10) + 5;
        DM.executeReward(xpReward, goldReward, null);
        UI.addNarration(`获得 ${xpReward} 经验值，${goldReward} 金币`, 'system');
      }
    } else if (!fled) {
      UI.addNarration('你被打晕了...醒来后发现自己被送到了草药师格蕾塔那里。', 'dm');
      Player.hp = Math.floor(Player.maxHp / 2);
      Player.addGold(-Math.floor(Player.gold / 3));
      Map.playerPos.x = 22;
      Map.playerPos.y = 16;
      Map.centerOnPlayer();
    }
    this.enemies = [];
    this.turnOrder = [];
    this.currentTurn = 0;
    this.round = 1;
  }
};
