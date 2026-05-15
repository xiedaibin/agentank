# AgenTank 架构重组方案 (Refactoring Plan)

## 1. 核心设计模式：双层分析师系统
为了兼顾“深度对阵策略”与“极高性能机动性”，代码将重构为以下结构：

### A. 战略分析师 (Strategic Analyst - 静态/初始化层)
*   **输入**：首帧获取的 `enemy.skill` 和 `game.map`。
*   **职责**：
    *   **构建 `EnemyProfile`**：缓存敌方技能特性（冷却、距离、威胁模型）。
    *   **静态地图分析**：缓存障碍物位置、草丛分布、构建静态 LoS (视线) 矩阵。
    *   **设定 MatchBlueprint**：根据对阵技能设定全局战术常数（如 `minSafeDist`, `starPriorityWeight`）。
*   **存储**：将结果保存至全局变量 `G_Blueprint`，后续帧仅读取，不重复计算。

### B. 战术分析师 (Tactical Analyst - 动态/执行层)
*   **输入**：每一帧的实时坐标、子弹位置、星星状态。
*   **职责**：
    *   **状态感知 (Perception)**：解析当前子弹命中帧数、敌方枪线覆盖、自身状态（Stun/Freeze/FireLocked）。
    *   **动作评估 (Evaluation)**：基于 `Kill (10000) > Star (500) > Time` 的价值函数，对比以下动作评分：
        *   `Assassination` (背杀/必杀)
        *   `StarCollection` (高效抢星)
        *   `TacticalDodge` (生存规避)
        *   `Patrol` (巡逻控制)
    *   **执行输出 (Execution)**：调用 `me` 接口，执行最高分动作。

## 2. 策略模块化设计
*   **通用模块 (General)**：
    *   `AStarNav`：优化后的 A* 寻路，带转向惩罚。
    *   `ThreatAvoidance`：物理避弹，优先级最高。
*   **针对性插件 (Specific Plug-ins)**：
    *   `AssassinCore`：专注于 `Teleport` 刺客动作。
    *   `AntiSkillSet`：针对 8 大技能的微操代码块。

## 3. 性能优化方案
*   **零对象分配**：禁止 `pos = {x: 1, y: 2}`，强制使用 `pos = [1, 2]`。
*   **计算节流**：复杂的 `isLocationSafe` 判定优先使用静态 LoS 缓存。
*   **A* 软上限**：节点搜索上限 600，超时降级为贪心算法或盲巡逻。

## 4. 进化验证标准
*   **单次循环样本**：30 场对局。
*   **进化阈值**：胜率提升 >= 10% 自动 Commit；下降 >= 5% 自动回滚。

## 5. 实施步骤
1.  **Phase 1**: 定义全局数据结构与 `StrategicAnalyst` (初始化逻辑)。
2.  **Phase 2**: 实现 `TacticalAnalyst` 主循环与 `ValueFunction` 评分系统。
3.  **Phase 3**: 迁移并优化 `A*` 与 `Dodge` 通用模块。
4.  **Phase 4**: 注入 `Assassin` 与 `Anti-Skill` 针对性逻辑。
5.  **Phase 5**: 启动 30 场实战自动化测试。
