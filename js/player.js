// AI Tavern - Player Character
// Player stats, inventory, abilities, and state management

const CLASSES = {
  fighter: {
    name: '战士',
    desc: '擅长近战和重甲，前排肉盾',
    baseStats: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    hpBonus: 10,
    skills: ['猛击', '格挡', '战吼'],
    weapon: '长剑 (1d8+力量)'
  },
  rogue: {
    name: '盗贼',
    desc: '敏捷灵活，擅长潜行和偷袭',
    baseStats: { str: 8, dex: 16, con: 10, int: 12, wis: 12, cha: 14 },
    hpBonus: 6,
    skills: ['偷袭', '开锁', '潜行'],
    weapon: '匕首 (1d4+敏捷)'
  },
  mage: {
    name: '法师',
    desc: '智力超群，操控魔法力量',
    baseStats: { str: 6, dex: 10, con: 8, int: 18, wis: 14, cha: 10 },
    hpBonus: 4,
    skills: ['火球术', '魔法护盾', '探测魔法'],
    weapon: '法杖 (1d6+智力)'
  },
  ranger: {
    name: '游侠',
    desc: '远程射击专家，与自然共生',
    baseStats: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    hpBonus: 8,
    skills: ['精准射击', '追踪', '驯兽'],
    weapon: '长弓 (1d8+敏捷)'
  },
  cleric: {
    name: '牧师',
    desc: '神圣治疗者，驱散黑暗',
    baseStats: { str: 12, dex: 8, con: 12, int: 10, wis: 18, cha: 12 },
    hpBonus: 8,
    skills: ['治疗术', '驱散亡灵', '神圣之光'],
    weapon: '钉头锤 (1d6+力量)'
  },
  bard: {
    name: '吟游诗人',
    desc: '魅力动人，用音乐鼓舞队友',
    baseStats: { str: 8, dex: 14, con: 10, int: 12, wis: 10, cha: 18 },
    hpBonus: 6,
    skills: ['激励之歌', '魅惑', '博学'],
    weapon: '细剑 (1d6+敏捷)'
  }
};

const RACES = {
  human:    { name: '人类', desc: '均衡全面，适应性最强', bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
  elf:      { name: '精灵', desc: '敏捷聪慧，感知敏锐', bonus: { dex: 2, int: 1, wis: 1 } },
  dwarf:    { name: '矮人', desc: '强壮坚韧，擅长锻造', bonus: { str: 2, con: 2 } },
  halfling: { name: '半身人', desc: '灵巧幸运，小巧精悍', bonus: { dex: 2, cha: 1 } },
  half_elf: { name: '半精灵', desc: '兼有人类与精灵之长', bonus: { dex: 1, int: 1, cha: 2 } }
};

const Player = {
  name: '',
  race: 'human',
  class: 'fighter',
  level: 1,
  xp: 0,
  xpToNext: 100,
  hp: 20,
  maxHp: 20,
  ac: 14,
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  inventory: [],
  gold: 10,
  statusEffects: [],
  reputation: {}, // npcId -> value (-10 to +10)
  knownSecrets: [],
  questLog: [],

  init(name, race, cls) {
    this.name = name;
    this.race = race;
    this.class = cls;
    
    const classInfo = CLASSES[cls];
    const raceInfo = RACES[race];
    
    // Set base stats from class
    this.stats = { ...classInfo.baseStats };
    
    // Apply racial bonuses
    if (raceInfo && raceInfo.bonus) {
      for (const [stat, bonus] of Object.entries(raceInfo.bonus)) {
        this.stats[stat] = (this.stats[stat] || 10) + bonus;
      }
    }
    
    this.maxHp = this.stats.con + classInfo.hpBonus;
    this.hp = this.maxHp;
    this.ac = 10 + Dice.modifierFromScore(this.stats.dex);
    this.inventory = [
      { id: 'rations', name: '干粮', icon: '🍞', qty: 3, desc: '普通的旅行干粮' },
      { id: 'torch', name: '火把', icon: '🔥', qty: 2, desc: '照亮黑暗' },
      { id: 'rope', name: '麻绳', icon: '🪢', qty: 1, desc: '50英尺长的绳子' }
    ];
    
    this.save();
  },

  getClassInfo() { return CLASSES[this.class]; },
  getRaceInfo() { return RACES[this.race]; },

  getModifier(stat) { return Dice.modifierFromScore(this.stats[stat]); },

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.save();
    return this.hp <= 0;
  },

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.save();
  },

  addItem(item) {
    const existing = this.inventory.find(i => i.id === item.id);
    if (existing) {
      existing.qty += item.qty || 1;
    } else {
      this.inventory.push({ ...item, qty: item.qty || 1 });
    }
    this.save();
  },

  removeItem(itemId, qty = 1) {
    const idx = this.inventory.findIndex(i => i.id === itemId);
    if (idx === -1) return false;
    this.inventory[idx].qty -= qty;
    if (this.inventory[idx].qty <= 0) {
      this.inventory.splice(idx, 1);
    }
    this.save();
    return true;
  },

  addGold(amount) {
    this.gold = Math.max(0, this.gold + amount);
    this.save();
  },

  addXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }
    this.save();
  },

  levelUp() {
    this.level++;
    this.xpToNext = Math.floor(this.xpToNext * 1.5);
    const hpGain = Math.max(1, Dice.roll(6) + this.getModifier('con'));
    this.maxHp += hpGain;
    this.hp = this.maxHp;
    return { level: this.level, hpGain };
  },

  save() {
    const data = {
      name: this.name,
      race: this.race,
      class: this.class,
      level: this.level,
      xp: this.xp,
      hp: this.hp,
      maxHp: this.maxHp,
      ac: this.ac,
      stats: this.stats,
      inventory: this.inventory,
      gold: this.gold,
      reputation: this.reputation,
      knownSecrets: this.knownSecrets,
      questLog: this.questLog
    };
    localStorage.setItem('ai-tavern-player', JSON.stringify(data));
  },

  load() {
    const saved = localStorage.getItem('ai-tavern-player');
    if (!saved) return false;
    const data = JSON.parse(saved);
    Object.assign(this, data);
    return true;
  },

  reset() {
    localStorage.removeItem('ai-tavern-player');
  }
};
