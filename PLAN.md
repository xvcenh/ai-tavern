# AI Tavern / AI小镇 — 龙与地下城风格的AI互动小镇

## 概念
一个纯前端HTML游戏，AI作为Dungeon Master主持，管理一个幻想小镇。NPC有独立人设、自主行动，玩家创建角色进入世界，掷骰决定命运，极高自由度。

## 技术栈
- 纯HTML + CSS + Vanilla JS（单文件部署到GitHub Pages）
- Canvas 2D 渲染地图和角色
- WebSocket或Polling连接AI DM
- OpenAI兼容API（DeepSeek/OpenAI/任意）
- LocalStorage 存档

## 核心系统

### 1. 地图系统 (map.js)
- 瓦片地图（32x32 tiles），小镇+周边
- 地点：酒馆、广场、铁匠铺、魔法塔、森林、洞穴、墓地
- Canvas渲染，支持缩放/拖拽
- 昼夜循环视觉效果

### 2. 角色系统 (characters.js)
- 8-12个NPC，各有完整人设：
  - 老铁匠布鲁诺：脾气暴躁但技术精湛
  - 酒馆老板娘艾拉：消息灵通，神秘过往
  - 流浪法师泽菲尔：疯癫但偶尔说出惊人真相
  - 镇长老莫里斯：表面公正，暗藏秘密
  - 冒险者工会的莉娜：年轻气盛，渴望证明自己
  - 森林游侠卡尔：沉默寡言，与狼为伴
  - 草药师婆婆格蕾塔：知晓一切秘密的老妇人
  - 吟游诗人菲林：花言巧语，欠了一屁股债
  - 神秘的陌生人：来历不明，总在关键时出现
- 每个NPC有：性格、目标、秘密、日程表、关系网
- 玩家自定义角色：种族、职业、属性

### 3. AI Dungeon Master (dm.js)
- 管理世界状态和叙事
- 处理玩家动作的因果
- NPC自主行为决策
- 生成对话、描述、事件
- 记住玩家所有行为影响世界

### 4. 掷骰系统 (dice.js)
- D4, D6, D8, D10, D12, D20, D100
- 技能检定（力量/敏捷/智力/魅力/感知/体质）
- 优势/劣势机制
- 战斗骰
- 随机事件表
- 华丽的骰子动画

### 5. 战斗系统 (combat.js)
- 回合制战斗
- 先攻顺序
- AC/命中/伤害
- 法术系统
- 状态效果

### 6. 任务系统 (quests.js)
- 动态生成任务
- 主线暗线
- 分支结局
- 声望系统

### 7. UI系统 (ui.js)
- 对话面板（NPC对话、DM叙述）
- 角色面板（属性、物品栏、技能）
- 行动菜单（调查、交谈、攻击、使用物品、等待）
- 日志面板
- API配置面板

## 文件结构
```
ai-tavern/
  index.html          # 主入口
  css/
    style.css         # 全部样式
  js/
    main.js           # 入口，初始化
    config.js         # 配置（API key等，从localStorage读取）
    map.js            # 地图渲染与交互
    characters.js     # 角色数据与NPC AI
    player.js         # 玩家角色管理
    dice.js           # 掷骰系统
    combat.js         # 战斗系统
    dm.js             # AI DM引擎
    quests.js         # 任务系统
    ui.js             # UI渲染
    audio.js          # 音效/氛围音乐（可选）
  assets/
    sprites/          # 角色/地图精灵
  README.md
```

## 开发阶段
- Phase 1: 地图+角色+基础移动
- Phase 2: NPC对话+AI DM集成
- Phase 3: 掷骰+技能系统
- Phase 4: 战斗系统
- Phase 5: 任务+世界状态
- Phase 6: 美术优化+部署

## GitHub营销策略
- 标题："AI Tavern: An Open-Source D&D World Run by AI"
- 卖点：AI当DM、HTML可直接玩、极高自由度、开源可定制
- 标签：ai, game, rpg, dungeons-and-dragons, llm, html5
