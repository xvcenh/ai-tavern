// AI Tavern - Dice System
// D&D-style dice: D4, D6, D8, D10, D12, D20, D100
// Skill checks with advantage/disadvantage

const Dice = {
  roll(sides) {
    return Math.floor(Math.random() * sides) + 1;
  },

  d4()  { return this.roll(4); },
  d6()  { return this.roll(6); },
  d8()  { return this.roll(8); },
  d10() { return this.roll(10); },
  d12() { return this.roll(12); },
  d20() { return this.roll(20); },
  d100(){ return this.roll(100); },

  // Roll with advantage (roll twice, take higher)
  advantage(sides) {
    const a = this.roll(sides);
    const b = this.roll(sides);
    return { result: Math.max(a, b), rolls: [a, b], type: 'advantage' };
  },

  // Roll with disadvantage (roll twice, take lower)
  disadvantage(sides) {
    const a = this.roll(sides);
    const b = this.roll(sides);
    return { result: Math.min(a, b), rolls: [a, b], type: 'disadvantage' };
  },

  // Ability check: D20 + modifier
  check(modifier, advantage = null) {
    let roll;
    if (advantage === 'advantage') {
      roll = this.advantage(20);
    } else if (advantage === 'disadvantage') {
      roll = this.disadvantage(20);
    } else {
      roll = { result: this.d20(), rolls: [this.d20()], type: 'normal' };
    }
    roll.total = roll.result + modifier;
    roll.modifier = modifier;
    roll.success = roll.total >= 15;
    roll.critical = roll.result === 20;
    roll.fumble = roll.result === 1;
    return roll;
  },

  // Damage roll: e.g., "2d6+3"
  damage(formula) {
    const match = formula.match(/(\d+)d(\d+)([+-]\d+)?/);
    if (!match) return 0;
    const [, count, sides, bonus] = match;
    let total = 0;
    const rolls = [];
    for (let i = 0; i < parseInt(count); i++) {
      const r = this.roll(parseInt(sides));
      rolls.push(r);
      total += r;
    }
    if (bonus) total += parseInt(bonus);
    return { total, rolls, formula };
  },

  // Ability modifier from score
  modifierFromScore(score) {
    return Math.floor((score - 10) / 2);
  }
};
