# AI Tavern 🏰🎲

**An open-source D&D-style AI town where an LLM acts as Dungeon Master.**

> Walk into a living fantasy town. Talk to NPCs with real personalities. Roll dice. Fight monsters. Go on quests. Every action has consequences — the AI DM remembers everything.

## ✨ Features

- 🗺️ **Living Town Map** — Canvas-rendered fantasy town with 10+ locations
- 🤖 **AI Dungeon Master** — Powered by any OpenAI-compatible LLM (DeepSeek, GPT-4, etc.)
- 👥 **10 Unique NPCs** — Each with personality, backstory, secrets, daily schedules
- 🎲 **Dice System** — D20 skill checks, advantage/disadvantage, combat rolls
- ⚔️ **Turn-Based Combat** — Initiative, AC, damage, spells, status effects
- 📜 **Dynamic Quests** — AI-generated quests that evolve based on your choices
- 🌙 **Day/Night Cycle** — Time passes, NPCs follow schedules
- 💾 **Save/Load** — LocalStorage persistence
- 🎭 **Extreme Freedom** — Do anything. The AI DM will handle it.

## 🚀 Quick Start

1. Open `index.html` in your browser
2. Enter your API key (DeepSeek, OpenAI, or any compatible provider)
3. Create your character
4. Explore the town!

Or play instantly on GitHub Pages:
**[Play AI Tavern](https://xvcenh.github.io/ai-tavern)**

## 🎮 How to Play

- **WASD / Arrow Keys** — Move your character
- **Click NPCs** — Talk to them
- **Click objects** — Interact
- **Space** — Open action menu
- **Tab** — Open character sheet
- **R** — Roll a D20

The AI Dungeon Master responds to natural language. Type anything you want to do:
- "I want to sneak into the blacksmith's shop at night"
- "I challenge the stranger to a duel"
- "I ask the innkeeper about the old tower"

## 🛠️ Tech Stack

- Pure HTML5 + CSS3 + Vanilla JavaScript
- Canvas 2D for rendering
- OpenAI-compatible API for AI DM
- Zero dependencies, zero build step
- Deployable to any static host (GitHub Pages, Netlify, Vercel)

## 📁 Project Structure

```
ai-tavern/
  index.html          # Main entry point
  css/style.css       # All styles
  js/
    main.js           # Entry point
    config.js         # API configuration
    map.js            # Map rendering & interaction
    characters.js     # NPC data & AI
    player.js         # Player character
    dice.js           # Dice rolling
    combat.js         # Combat system
    dm.js             # AI Dungeon Master
    quests.js         # Quest system
    ui.js             # UI rendering
  README.md
```

## 🔧 API Setup

Supports any OpenAI-compatible API endpoint:
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI: `https://api.openai.com/v1`
- Local LLM: `http://localhost:1234/v1`

Configure in-game via the Settings panel.

## 🤝 Contributing

Contributions welcome! Open an issue or PR. Ideas:
- More NPCs and locations
- Better sprites and art
- Multiplayer support
- Mobile optimization
- Sound effects and music

## 📄 License

MIT — do whatever you want, just keep the attribution.

---

*Built with ❤️ by [xvcenh](https://github.com/xvcenh)*
