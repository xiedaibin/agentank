# AgenTank - XDB AI 代理开发指南 (GEMINI.md)

本文件是 **XDB** 坦克 AI 代理（ID: 230）的开发指南、项目结构规范和架构约束指南。

---

## 🛠️ 起步与配置

### 1. Token 配置
本项目的自动化脚本均需与 AgenTank API 交互。您必须在根目录的 `.env` 文件中配置您的 API token：
- 参考 [.env.example](.env.example) 作为模板。
- 复制为 `.env` 并填写您的 `AGENTANK_TOKEN`。

### 2. 初始化流程约束（启动必做）
在开启任何新的战术迭代或代码修改前，AI 代理**必须**完成以下步骤：
1. **同步最新规则**：运行“同步坦克规则”协议，将官方最新机制覆盖保存至 [AGENT_GUIDE.md](AGENT_GUIDE.md)。
2. **熟读核心文档**：完全理解 [AGENT_GUIDE.md](AGENT_GUIDE.md)（坦克 API 与游戏机制）和 [STRATEGY.md](STRATEGY.md)（技能博弈与具体战术）。
3. **读取并执行 AGENTS.md 规范**：AI 代理必须严格读取并无条件执行 [AGENTS.md](AGENTS.md) 中规定的全部要求，包含价值观约束、转向 API 特化、Speak 调试埋点以及各项自动化进化/排位赛挑战与分析规范。

---

## 📂 项目结构与关键文件

### 核心坦克代码
*   **[new_tank.js](new_tank.js)**: 生产环境坦克脚本，包含 `onIdle(me, enemy, game)` 入口函数、**双层分析师系统**、A* 寻路、物理避弹以及各技能针对性防守逻辑。
*   **[STRATEGY.md](STRATEGY.md)**: 战略与战术总纲，规定了胜负价值函数、蓝图细节以及 8 大反技能模块。

### 自动化与进化脚本
*   **[batch_evolution.js](batch_evolution.js)**: 执行 30 场随机对手挑战测试以确定基准胜率。若胜率提升 $\ge 5\%$ 则自动发布并提交代码，若下降 $\ge 5\%$ 则自动执行回滚（`git restore`）。
*   **[targeted_evolution.js](targeted_evolution.js)**: 定向挑战特定对手（例如：`node targeted_evolution.js <tankId>`）20 场进行特化训练。
*   **[batch_battleforscore.js](batch_battleforscore.js)**: 批量对战上分脚本，支持传入 `best` 自动挑战当前最高分对手。
*   **[ranked_battle.js](ranked_battle.js)**: 挂机挑战排位赛。
*   **[battle_first.js](battle_first.js)**: 循环挑战全服第一名。

### 诊断与分析工具
*   **[summarize_rank_losses.js](summarize_rank_losses.js)** 与 **[summarize_evolution_losses.js](summarize_evolution_losses.js)**: 聚合和提取失败对局的特征与败因。
*   **[analyze_replay.js](analyze_replay.js)**: 解析并详细检查具体的对局录像 JSON。
*   **[simulate_match.js](simulate_match.js)**: 在本地/API 模拟运行与训练机器人的对局，以便快速调试。

---

## 📐 架构规则与编码约束

> [!IMPORTANT]
> **坐标格式强制约束**
> 地图上的所有位置必须严格使用数组表示（例如 `[x, y]`），**绝对不能**使用对象（例如 `{x: x, y: y}`）。使用对象会导致 A*、LoS 以及物理避弹逻辑彻底失效。

### 1. 双层分析师架构
*   **战略分析师 (Strategic Analyst - 静态层)**: 在第 0 帧或首次发现敌人时运行。构建 `EnemyProfile`（缓存敌方技能属性、威胁等级），分析全图障碍物与草丛并生成静态视线缓存，将结果存入全局蓝图 `G_Blueprint`。
*   **战术分析师 (Tactical Analyst - 动态层)**: 在每一帧的 `onIdle` 中运行。评估候选决策并进行评分（`Assassination > Stars > Dodge > Ambush/Survival`），最后执行评分最高的动作。

### 2. 转向 API 封装与耗时
*   **转向 API 封装**: 原生的 `me.turn(dir)` 仅合法支持 `"left"` 和 `"right"`（相对旋转 90 度）。在任何时候，都必须使用 `getTurnDir` 包装函数对目标朝向进行分流映射，转换成合法的 `"left"` 或 `"right"`。
*   **转向耗时**: 180 度掉头需要消耗 2 帧。近距离物理避弹时，必须依靠传送（`teleport`）或智能选择“不朝向敌人方向转动”的缓冲朝向，因为常规转向躲避在时间上完全来不及。

### 3. 可视化 Speak 调试协议 (Visual Debugging Protocol)
在编写决策、避让或拦截分支时，必须在关键入口调用 `me.speak("调试标识")`。Speech 效果不消耗帧数且不影响行为。常用埋点：
- 物理/轴线避弹：`me.speak("Ghost Evasion")` 或 `me.speak("CoAxial Evasion")`
- 安全避让：`me.speak("SO: Evasion")`
- 特化防守：例如草丛盲射 `me.speak("Blind Fire")`

---

## 💬 交流语言规范
*   **中文交流**: 在与用户进行任何沟通、反馈或输出报告时，**必须且只能**使用中文进行对话。

---

## 📈 进化日志与提交规则
- 所有批量对局测试结果均会输出至 `evolution_report.json` 并记录至 [EVOLUTION_LOG.md](EVOLUTION_LOG.md)。
- 保证策略模块化，将针对性技能应对模块与底层寻路/A* 逻辑解耦，每次迭代均需使用进化脚本验证是否发生退化。
