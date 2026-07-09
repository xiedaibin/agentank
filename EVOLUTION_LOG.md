# AgenTank Evolution Log

This file tracks the mutation history, win rates, and tactical adjustments of the XDB tank.

| Version | Date | Strategy Name | Goal / Problem Solved | Win Rate | Status | Improvement |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| V6 | 2026-05-15 | Strategic Assassin V6 | Initial modular refactor with EnemyProfile. | 63.33% | Adopted | N/A |
| V7 | 2026-05-15 | Strategic Assassin V7 | Enhanced threat detection & "Wait" logic. | 53.33% | Rejected | -10.00% |
| V8 | 2026-05-15 | Strategic Assassin V8 | Balanced defense + Emergency Fallback Teleport. | 76.67% | Adopted | +13.34% |
| V11-V22 | 2026-05-15 | Multiple Experiments | Defense, Aggression, Randomness, Potential Fields. | < 70% | Rejected | N/A |
| **V8** | 2026-05-15 | **Stable Release** | Final consolidation of the best stable architecture. | **76.67%** | **Final** | N/A |

---

## Technical Retrospective

### V8: Balanced Strategy (Adopted as Final)
- **Wins**: 23/30
- **Losses**: 7/30
- **Key Success**: The emergency fallback teleport successfully prevented several close-range deaths. Grass preference improved stealth. This version represents the current performance ceiling for generic opponents.
- **Weakness**: Still struggles against the highest tier of predictive bots like `azure-hunter`.

### V9-V22: The Complexity Trap
- **Finding**: Increasing logic complexity (Phase shifts, Threat maps, Path perturbation) consistently led to performance degradation in generic matches.
- **Reason**: The 30ms engine constraint and the compact 15x15 map favor deterministic, high-efficiency pathfinding over granular micro-dodging.

---
*End of current iteration cycle.*
| V8 | 2026-05-15 | Proactive LoS Defense & Teleport Safety | Proactive LoS Defense & Teleport Safety (自动生成) | 0.00% | Rejected | -58.00% |
| V8 | 2026-05-15 | Proactive LoS Defense & Teleport Safety (Sequential Fix) | Proactive LoS Defense & Teleport Safety (Sequential Fix) (自动生成) | 53.33% | Pending | -4.67% |
| V8 | 2026-05-15 | Dynamic LoS Dist & Defense Consistency | Dynamic LoS Dist & Defense Consistency (自动生成) | 80.00% | Adopted | 20.33% |
| V8 | 2026-05-16 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Rejected | -6.67% |
| V8 | 2026-05-16 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Rejected | -6.67% |
| V8 | 2026-05-16 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Rejected | -6.67% |
| V8 | 2026-05-16 | 未命名策略 | 未命名策略 (自动生成) | 43.33% | Rejected | -36.67% |
| V8 | 2026-05-16 | 综合战术优化 (躲避+安全+后期+分治) | 综合战术优化 (躲避+安全+后期+分治) (自动生成) | 50.00% | Rejected | -17.00% |
| V8 | 2026-05-16 | 精简战术优化 (躲避+预测安全+后期+分治) | 精简战术优化 (躲避+预测安全+后期+分治) (自动生成) | 56.67% | Rejected | -10.33% |
| V8 | 2026-05-16 | Final_Surgical_Opt | Final_Surgical_Opt (自动生成) | 66.67% | Pending | -0.33% |
| V8 | 2026-05-16 | Final_Micro_Adjustment | Final_Micro_Adjustment (自动生成) | 56.67% | Rejected | -10.33% |
| V12 | 2026-05-17 | V12.6 Optimize Dodge & Grass Silence | V12.6 Optimize Dodge & Grass Silence (自动生成) | 50.00% | Pending | 5.00% |
| V12 | 2026-05-17 | V12.7 Precision Axis Evasion & Anti-Turn | V12.7 Precision Axis Evasion & Anti-Turn (自动生成) | 63.33% | Adopted | 13.33% |
| V12 | 2026-05-17 | V12.8 Suicidal Turn Prevention & Strict Evasion | V12.8 Suicidal Turn Prevention & Strict Evasion (自动生成) | 70.00% | Pending | 6.67% |
| V12 | 2026-05-17 | V12.8 Final Validation | V12.8 Final Validation (自动生成) | 46.67% | Rejected | -16.66% |
| V12 | 2026-05-17 | V12.9 Anti-Control & Mound Refinement | V12.9 Anti-Control & Mound Refinement (自动生成) | 63.33% | Pending | 0.00% |
| V12 | 2026-05-17 | V12.10 Emergency TP & Stability Fix | V12.10 Emergency TP & Stability Fix (自动生成) | 66.67% | Pending | 3.34% |
| V12 | 2026-05-17 | V12.11 Early Game protection & Defense Acceleration | V12.11 Early Game protection & Defense Acceleration (自动生成) | 46.67% | Rejected | -16.66% |
| V12 | 2026-05-17 | V12.12 Late Game Aggression & Mound suppression | V12.12 Late Game Aggression & Mound suppression (自动生成) | 50.00% | Rejected | -13.33% |
| V12 | 2026-05-17 | V12.13 Dodge Locking & Control Precision | V12.13 Dodge Locking & Control Precision (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-05-17 | V12.13 Stabilization Run | V12.13 Stabilization Run (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-05-17 | V12.14 Mound Pressure & Dodge Acceleration | V12.14 Mound Pressure & Dodge Acceleration (自动生成) | 50.00% | Rejected | -13.33% |
| V12 | 2026-05-17 | V12.15 Opportunistic Assassination | V12.15 Opportunistic Assassination (自动生成) | 56.67% | Rejected | -6.66% |
| V12 | 2026-05-17 | V12.16 Aggressive Tele-Star & Mound Pressure | V12.16 Aggressive Tele-Star & Mound Pressure (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-05-17 | V12.16 Stabilization Run | V12.16 Stabilization Run (自动生成) | 66.67% | Pending | 3.34% |
| V12 | 2026-05-17 | V12.17 Ultra-Safe Anti-Control & Late Game | V12.17 Ultra-Safe Anti-Control & Late Game (自动生成) | 56.67% | Rejected | -6.66% |
| V12 | 2026-05-17 | V12.18 Star-Grab boost & Control (7) | V12.18 Star-Grab boost & Control (7) (自动生成) | 46.67% | Rejected | -16.66% |
| V12 | 2026-05-17 | V12.19 Dodge Depth & Mound Safety | V12.19 Dodge Depth & Mound Safety (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-05-17 | V12.20 Grass Start & Tele-7 | V12.20 Grass Start & Tele-7 (自动生成) | 70.00% | Pending | 6.67% |
| V12 | 2026-05-17 | V12.20 Stabilization Run | V12.20 Stabilization Run (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-05-17 | V12.21 Star Abandonment & 300 Nodes | V12.21 Star Abandonment & 300 Nodes (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-05-17 | V12.7 Re-Anchoring | V12.7 Re-Anchoring (自动生成) | 50.00% | Rejected | -13.33% |
| V12 | 2026-05-17 | V12.22 Final Combined Strategy | V12.22 Final Combined Strategy (自动生成) | 50.00% | Rejected | -13.33% |
| V12 | 2026-05-17 | V12.23 Path Jittering | V12.23 Path Jittering (自动生成) | 36.67% | Rejected | -26.66% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 0.00% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 55.17% | Rejected | -8.16% |
| V12.25 | 2026-05-17 | Dodge Priority & Pre-Aim | Refined dodging priority + Pre-Aim logic | 70.00% | Adopted | +6.67% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 55.17% | Rejected | -14.83% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -20.00% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -16.67% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -16.67% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 51.72% | Rejected | -18.28% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Rejected | -13.33% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 36.67% | Rejected | -26.66% |
| V12 | 2026-05-17 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -13.33% |
| V12 | 2026-05-17 | V12.7 High-Rank Baseline | V12.7 High-Rank Baseline (自动生成) | 43.33% | Adopted | 43.33% |
| V12 | 2026-05-17 | Star Safety & Bullet Interception | Star Safety & Bullet Interception (自动生成) | 50.00% | Pending | 6.67% |
| V12 | 2026-05-22 | V12.26 Cloak Bugfix | V12.26 Cloak Bugfix (自动生成) | 50.00% | Rejected | -26.00% |
| V12 | 2026-05-22 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Adopted | 10.00% |
| V12 | 2026-05-22 | 未命名策略 | 未命名策略 (自动生成) | 43.33% | Rejected | -10.00% |
| V12 | 2026-05-22 | V12.27 Star Teleport Fix | V12.27 Star Teleport Fix (自动生成) | 60.00% | Rejected | -16.00% |
| V12 | 2026-05-22 | Decouple star safety | Decouple star safety (自动生成) | 66.67% | Adopted | 11.67% |
| V12 | 2026-05-22 | Flank assassination & A* prune | Flank assassination & A* prune (自动生成) | 43.33% | Rejected | -23.34% |
| V12 | 2026-05-22 | A* Queue Pruning Only | A* Queue Pruning Only (自动生成) | 56.67% | Rejected | -10.00% |
| V12 | 2026-05-22 | Safe Star Teleporting | Safe Star Teleporting (自动生成) | 60.71% | Rejected | -5.96% |
| V12 | 2026-05-22 | Safe Star Teleporting | Safe Star Teleporting (自动生成) | 30.00% | Rejected | -36.67% |
| V12 | 2026-05-23 | Safe Star Teleport V2 | Safe Star Teleport V2 (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-05-23 | Safe Star Teleport V2 | Safe Star Teleport V2 (自动生成) | 33.33% | Rejected | -26.67% |
| V12 | 2026-05-23 | Decoupled Safety Fixes | Decoupled Safety Fixes (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-05-23 | Decoupled Safety Null Guards | Decoupled Safety Null Guards (自动生成) | 51.72% | Pending | -4.95% |
| V12 | 2026-05-23 | 步履后撤规避隐身突袭 | 步履后撤规避隐身突袭 (自动生成) | 58.62% | Pending | -1.38% |
| V12 | 2026-05-23 | 步履后撤规避隐身突袭稳定性测试 | 步履后撤规避隐身突袭稳定性测试 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-05-23 | 同轴暴露自动规避 | 同轴暴露自动规避 (自动生成) | 43.33% | Rejected | -16.67% |
| V12 | 2026-05-23 | 同轴暴露自动规避优化版 | 同轴暴露自动规避优化版 (自动生成) | 43.33% | Rejected | -16.67% |
| V12 | 2026-05-23 | 安全函数同轴规避优化 | 安全函数同轴规避优化 (自动生成) | 66.67% | Pending | 6.67% |
| V12 | 2026-05-23 | 安全函数同轴规避优化 | 安全函数同轴规避优化 (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-05-23 | 安全函数同轴规避优化稳定性验证 | 安全函数同轴规避优化稳定性验证 (自动生成) | 56.67% | Pending | -3.33% |
| V13 | 2026-05-24 | Overload Evasion Strategy | Overload Evasion Strategy (自动生成) | 60.00% | Rejected | -6.67% |
| V12 | 2026-05-24 | Base V12.30 baseline measurement | Base V12.30 baseline measurement (自动生成) | 53.33% | Adopted | 53.33% |
| V13 | 2026-05-24 | Overload Evasion Strategy | Overload Evasion Strategy (自动生成) | 56.67% | Pending | 3.34% |
| V13 | 2026-05-24 | Grass Evasion & Safe Targeting | Grass Evasion & Safe Targeting (自动生成) | 23.33% | Rejected | -30.00% |
| V12 | 2026-05-27 | Assassination Overhaul - Rear Priority & Direction Matching | Assassination Overhaul - Rear Priority & Direction Matching (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-05-27 | Rear Assassination V2 - Minimal Reorder + Fallback Safety | Rear Assassination V2 - Minimal Reorder + Fallback Safety (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-05-27 | Rear Priority Only - Offset Reorder + Fallback Safety | Rear Priority Only - Offset Reorder + Fallback Safety (自动生成) | 66.67% | Pending | 6.67% |
| V12 | 2026-05-27 | Rear Priority Only - Stabilization Run | Rear Priority Only - Stabilization Run (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-05-27 | Fallback Fire - canShoot gated turn and fire | Fallback Fire - canShoot gated turn and fire (自动生成) | 53.33% | Rejected | -11.67% |
| V12 | 2026-05-27 | Stuck Fix - Grass Ambush Tolerance + Safe Teleport | Stuck Fix - Grass Ambush Tolerance + Safe Teleport (自动生成) | 63.33% | Pending | -1.67% |
| V12 | 2026-05-27 | Safe Teleport Distance 4 - Anti Close Range Death | Safe Teleport Distance 4 - Anti Close Range Death (自动生成) | 63.33% | Pending | -1.67% |
| V12 | 2026-05-27 | Target Lock Anti-Oscillation - 4 Frame Lock + 500 Inertia | Target Lock Anti-Oscillation - 4 Frame Lock + 500 Inertia (自动生成) | 60.00% | Rejected | -5.00% |
| V12 | 2026-05-27 | Gentle Target Lock - 200 Inertia 2 Frame | Gentle Target Lock - 200 Inertia 2 Frame (自动生成) | 56.67% | Rejected | -8.33% |
| V12 | 2026-05-27 | Star Safety Fix - EnemyDist 3 + Hard Score Floor | Star Safety Fix - EnemyDist 3 + Hard Score Floor (自动生成) | 66.67% | Pending | 1.67% |
| V12 | 2026-05-27 | Cloak Ambush Fix - Window 8 + Grass Hold on Cloak Nearby | Cloak Ambush Fix - Window 8 + Grass Hold on Cloak Nearby (自动生成) | 50.00% | Rejected | -15.00% |
| V12 | 2026-05-27 | Cloak Grass Hold - Stay in Grass on Nearby Cloak | Cloak Grass Hold - Stay in Grass on Nearby Cloak (自动生成) | 53.33% | Rejected | -11.67% |
| V12 | 2026-05-27 | Star Safety Fix Rebase - EnemyDist 3 + Score Floor (baseline 50%) | Star Safety Fix Rebase - EnemyDist 3 + Score Floor (baseline 50%) (自动生成) | 60.00% | Pending | 10.00% |
| V12 | 2026-05-27 | No Greedy Fallback + Aim Enemy on Stuck | No Greedy Fallback + Aim Enemy on Stuck (自动生成) | 63.33% | Adopted | 13.33% |
| V12 | 2026-05-27 | Smart Shooting - Axis Guard 6 + Star Lead Score Reduction | Smart Shooting - Axis Guard 6 + Star Lead Score Reduction (自动生成) | 53.33% | Pending | 3.33% |
| V12 | 2026-05-27 | Fix enemyStars and turn safety | Fix enemyStars and turn safety (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-05-27 | Fix enemyStars only | Fix enemyStars only (自动生成) | 43.33% | Rejected | -16.67% |
| V12 | 2026-05-27 | Fix enemyStars and unify usage | Fix enemyStars and unify usage (自动生成) | 46.67% | Rejected | -13.33% |
| V12 | 2026-05-27 | User current version V12.31 | User current version V12.31 (自动生成) | 70.00% | Adopted | 20.00% |
| V12 | 2026-05-27 | Re-test current version | Re-test current version (自动生成) | 60.00% | Rejected | -10.00% |
| V12 | 2026-05-29 | Baseline Measurement V12.31 | Baseline Measurement V12.31 (自动生成) | 36.67% | Pending | -3.33% |
| V12 | 2026-05-29 | Ghost Bullet Axis Defense V12.32 | Ghost Bullet Axis Defense V12.32 (自动生成) | 60.00% | Adopted | 23.33% |
| V12 | 2026-05-29 | V12.32 Stability Verification | V12.32 Stability Verification (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-05-29 | Ghost Bullet Tightened V12.33 | Ghost Bullet Tightened V12.33 (自动生成) | 56.67% | Adopted | 20.00% |
| V12 | 2026-05-29 | Safety Override V12.34 | Safety Override V12.34 (自动生成) | 50.00% | Rejected | -6.67% |
| V12 | 2026-05-29 | Safety Override V12.34 non-strict | Safety Override V12.34 non-strict (自动生成) | 53.33% | Pending | -3.34% |
| V12 | 2026-05-29 | Safety Speak Debug V12.35 | Safety Speak Debug V12.35 (自动生成) | 50.00% | Rejected | -6.67% |
| V12 | 2026-05-29 | Baseline V12.33 Verification | Baseline V12.33 Verification (自动生成) | 62.07% | Adopted | 12.07% |
| V12 | 2026-05-29 | Turn Bug Fix V12.36 | Turn Bug Fix V12.36 (自动生成) | 41.38% | Rejected | -20.69% |
| V12 | 2026-05-29 | Turn Translation V12.36 | Turn Translation V12.36 (自动生成) | 63.33% | Adopted | 1.26% |
| V12 | 2026-06-02 | V12.36 Baseline | V12.36 Baseline (自动生成) | 60.00% | Pending | 10.00% |
| V12 | 2026-06-02 | Star Suppression | Star Suppression (自动生成) | 50.00% | Rejected | -10.00% |
| V12 | 2026-06-02 | Star Suppression | Star Suppression (自动生成) | 56.67% | Pending | 6.67% |
| V12 | 2026-06-02 | Star Suppression relaxed | Star Suppression relaxed (自动生成) | 50.00% | Pending | 0.00% |
| V12 | 2026-06-02 | Star Suppression fixed | Star Suppression fixed (自动生成) | 60.00% | Pending | 10.00% |
| V12 | 2026-06-02 | Star Suppression & Grass Safety | Star Suppression & Grass Safety (自动生成) | 46.67% | Rejected | -8.33% |
| V12 | 2026-06-02 | Star Suppression & Grass Pathing V12.40 | Star Suppression & Grass Pathing V12.40 (自动生成) | 50.00% | Rejected | -5.00% |
| V12 | 2026-06-02 | LoS Penalty Evasion | LoS Penalty Evasion (自动生成) | 56.67% | Adopted | 6.67% |
| V12 | 2026-06-02 | Grass Blind Fire | Grass Blind Fire (自动生成) | 51.72% | Pending | 1.72% |
| V12 | 2026-06-02 | Evasion Tie-Breaker | Evasion Tie-Breaker (自动生成) | 60.00% | Adopted | 10.00% |
| V_Auto | 2026-06-03 | Targeted_Optimization | 专项达标(70.00%)并校验通过 | 63.33% | Adopted | 3.33% |
| V_Auto | 2026-06-03 | Targeted_Optimization | 专项达标(73.68%)并校验通过 | 63.33% | Adopted | 0.00% |
| V12 | 2026-06-10 | 未命名策略 | 未命名策略 (自动生成) | 46.67% | Pending | -3.33% |
| V12 | 2026-06-10 | 优化传送吃星延迟 | 优化传送吃星延迟 (自动生成) | 76.67% | Adopted | 30.67% |
| V12 | 2026-06-10 | 实现守星压制策略 | 实现守星压制策略 (自动生成) | 63.33% | Adopted | 13.33% |
| V12 | 2026-06-13 | 撞击反击与性能优化并合并守星传送 | 撞击反击与性能优化并合并守星传送 (自动生成) | 80.00% | Adopted | 16.67% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -26.67% |
| V12 | 2026-06-14 | V12.70: 防御锁定与草丛避弹优化 | V12.70: 防御锁定与草丛避弹优化 (自动生成) | 76.67% | Adopted | 23.34% |
| V12 | 2026-06-14 | V12.80: 隐身十字禁区与内战后手保留 | V12.80: 隐身十字禁区与内战后手保留 (自动生成) | 40.00% | Rejected | -36.67% |
| V12 | 2026-06-14 | V12.80: 传送草丛精准识别与盲射优化 | V12.80: 传送草丛精准识别与盲射优化 (自动生成) | 60.00% | Rejected | -16.67% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 48.28% | Rejected | -28.39% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -26.67% |
| V12 | 2026-06-14 | Bullet tracing & Co-axial safety | Bullet tracing & Co-axial safety (自动生成) | 46.67% | Rejected | -30.00% |
| V12 | 2026-06-14 | Refined Co-axial safety valve & Bullet tracing | Refined Co-axial safety valve & Bullet tracing (自动生成) | 50.00% | Rejected | -26.67% |
| V12 | 2026-06-14 | V12.71: 动态传送流清零及隐身暗杀收紧防错判定 | V12.71: 动态传送流清零及隐身暗杀收紧防错判定 (自动生成) | 63.33% | Rejected | -13.34% |
| V12 | 2026-06-14 | V12.72: 动态传送流清零及隐身安全刺杀 | V12.72: 动态传送流清零及隐身安全刺杀 (自动生成) | 70.00% | Rejected | -6.67% |
| V12 | 2026-06-14 | V12.73: 动态传送流清零及隐身安全刺杀 (MAX_NODES 优化为 180) | V12.73: 动态传送流清零及隐身安全刺杀 (MAX_NODES 优化为 180) (自动生成) | 73.33% | Pending | -3.34% |
| V12 | 2026-06-14 | V12.74: 动态传送流清零与隐身安全刺杀，加防挂起卡死机制 (MAX_NODES 优化为 180) | V12.74: 动态传送流清零与隐身安全刺杀，加防挂起卡死机制 (MAX_NODES 优化为 180) (自动生成) | 46.67% | Rejected | -26.66% |
| V12 | 2026-06-14 | V12.75: 动态传送流清零及隐身安全刺杀，加防死锁下线判定 (MAX_NODES 优化为 180) | V12.75: 动态传送流清零及隐身安全刺杀，加防死锁下线判定 (MAX_NODES 优化为 180) (自动生成) | 46.67% | Rejected | -26.66% |
| V12 | 2026-06-14 | V12.76: 动态传送流清零与隐身安全刺杀 | V12.76: 动态传送流清零与隐身安全刺杀 (自动生成) | 50.00% | Rejected | -26.67% |
| V12 | 2026-06-14 | V12.77: 控制技能防守优化与A*搜索性能优化 | V12.77: 控制技能防守优化与A*搜索性能优化 (自动生成) | 60.00% | Rejected | -16.67% |
| V12 | 2026-06-14 | V12.78: 防御同轴近距送死与草丛性能超级剪枝 | V12.78: 防御同轴近距送死与草丛性能超级剪枝 (自动生成) | 66.67% | Rejected | -10.00% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -26.67% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Rejected | -16.67% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Pending | -3.34% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Rejected | -13.34% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 62.07% | Rejected | -14.60% |
| V12 | 2026-06-14 | 未命名策略 | 未命名策略 (自动生成) | 76.67% | Pending | -0.00% |
| V12 | 2026-06-15 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Rejected | -13.34% |
| V12 | 2026-06-15 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Pending | -3.34% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Adopted | 13.33% |
| V12 | 2026-06-16 | V12.61 转向地形通行性校验 | V12.61 转向地形通行性校验 (自动生成) | 53.33% | Rejected | -20.00% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-06-16 | V12.62 卡死脱困判定优化 | V12.62 卡死脱困判定优化 (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-06-16 | V12.63 草丛伏击与提前量预射 | V12.63 草丛伏击与提前量预射 (自动生成) | 58.62% | Pending | -1.38% |
| V12 | 2026-06-16 | V12.64 路径伏击与通道提前量拦截 | V12.64 路径伏击与通道提前量拦截 (自动生成) | 63.33% | Adopted | 5.33% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 0.00% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Pending | -3.33% |
| V12 | 2026-06-16 | 优化普通坦克避嫌半径 | 优化普通坦克避嫌半径 (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-06-16 | 优势防御模式升级 | 优势防御模式升级 (自动生成) | 60.00% | Pending | 0.00% |
| V12 | 2026-06-16 | 领先一星盲区伏击防御升级 | 领先一星盲区伏击防御升级 (自动生成) | 55.17% | Pending | -4.83% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 46.67% | Rejected | -13.33% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 66.67% | Adopted | 6.67% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 40.00% | Rejected | -20.00% |
| V12 | 2026-06-16 | 未命名策略 | 未命名策略 (自动生成) | 53.33% | Rejected | -6.67% |
| V12 | 2026-06-18 | 未命名策略 | 未命名策略 (自动生成) | 43.33% | Rejected | -23.34% |
| V12 | 2026-06-18 | 未命名策略 | 未命名策略 (自动生成) | 43.33% | Rejected | -23.34% |
| V12 | 2026-06-18 | 未命名策略 | 未命名策略 (自动生成) | 66.67% | Adopted | 23.67% |
| V12 | 2026-06-24 | 传送新规适配 | 传送新规适配 (自动生成) | 76.67% | Adopted | 6.67% |
| V12 | 2026-06-24 | 对方传送speak位置 | 对方传送speak位置 (自动生成) | 63.33% | Rejected | -6.67% |
| V12 | 2026-06-24 | 废除传送伏击流猜测与重构 | 废除传送伏击流猜测与重构 (自动生成) | 46.67% | Rejected | -23.33% |
| V12 | 2026-06-24 | 传送新规speak加防重复 | 传送新规speak加防重复 (自动生成) | 73.33% | Pending | 3.33% |
| V12 | 2026-06-24 | 剔除传送伏击流残留与寻路CD避险 | 剔除传送伏击流残留与寻路CD避险 (自动生成) | 43.33% | Rejected | -26.67% |
| V12 | 2026-06-24 | 修正Overload方向与引入空地逃跑惯性阻尼 | 修正Overload方向与引入空地逃跑惯性阻尼 (自动生成) | 63.33% | Adopted | 20.00% |
| V12 | 2026-06-24 | 全面适配绝对坐标下的Overload双轨投影和避弹逻辑 | 全面适配绝对坐标下的Overload双轨投影和避弹逻辑 (自动生成) | 56.67% | Rejected | -6.66% |
| V12 | 2026-06-24 | 剔除isTeleportAmbushStream逻辑 | 剔除isTeleportAmbushStream逻辑 (自动生成) | 44.83% | Rejected | -11.84% |
| V12 | 2026-06-24 | 吃星优先级优化与canShoot单帧缓存 | 吃星优先级优化与canShoot单帧缓存 (自动生成) | 53.33% | Adopted | 8.50% |
| V12 | 2026-06-24 | 内战后手保留与吃星限制 | 内战后手保留与吃星限制 (自动生成) | 50.00% | Pending | -3.33% |
| V12 | 2026-06-24 | 传送落点与步行拉扯共轴分治安全策略 | 传送落点与步行拉扯共轴分治安全策略 (自动生成) | 40.00% | Rejected | -13.33% |
| V12 | 2026-06-24 | 传送落点与步行拉扯共轴分治安全策略V2 | 传送落点与步行拉扯共轴分治安全策略V2 (自动生成) | 40.00% | Rejected | -13.33% |
| V12 | 2026-06-24 | 剔除isTeleportAmbushStream与传参残留 | 剔除isTeleportAmbushStream与传参残留 (自动生成) | 43.33% | Rejected | -10.00% |
| V12 | 2026-06-24 | 根治A*抖动与修复enemyStars缺失与传送CD估计 | 根治A*抖动与修复enemyStars缺失与传送CD估计 (自动生成) | 53.33% | Pending | 0.00% |
| V12 | 2026-06-24 | 未命名策略 | 未命名策略 (自动生成) | 58.62% | Adopted | 8.62% |
| V12 | 2026-06-24 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Pending | 2.00% |
| V12 | 2026-06-24 | 未命名策略 | 未命名策略 (自动生成) | 33.33% | Rejected | -26.67% |
| V12 | 2026-06-24 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-06-25 | 预瞄超时维持 | 预瞄超时维持 (自动生成) | 58.62% | Pending | 3.62% |
| V12 | 2026-06-26 | 基准测试 | 基准测试 (自动生成) | 63.33% | Pending | 4.71% |
| V12 | 2026-06-26 | 紧急抢星优化 | 紧急抢星优化 (自动生成) | 53.33% | Rejected | -10.00% |
| V12 | 2026-06-26 | 仅传送紧急抢星 | 仅传送紧急抢星 (自动生成) | 55.17% | Rejected | -8.16% |
| V12 | 2026-06-27 | 未命名策略 | 未命名策略 (自动生成) | 62.07% | Pending | 3.45% |
| V12 | 2026-06-27 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Pending | 1.38% |
| V12 | 2026-06-27 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-06-27 | 未命名策略 | 未命名策略 (自动生成) | 66.67% | Adopted | 6.67% |
| V12 | 2026-06-30 | 测试当前的胜率 | 测试当前的胜率 (自动生成) | 56.67% | Pending | 1.67% |
| V12 | 2026-06-30 | 双步避险与超载副弹道修复 | 双步避险与超载副弹道修复 (自动生成) | 71.43% | Adopted | 15.43% |
| V12 | 2026-07-01 | 修复通道起点与近距离通道预判限制 | 修复通道起点与近距离通道预判限制 (自动生成) | 50.00% | Rejected | -5.00% |
| V12 | 2026-07-01 | 优化精准星格预瞄跳过与近距伏击限制 | 优化精准星格预瞄跳过与近距伏击限制 (自动生成) | 56.67% | Pending | 1.67% |
| V12 | 2026-07-01 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Rejected | -14.76% |
| V12 | 2026-07-01 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Rejected | -14.76% |
| V12 | 2026-07-01 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Rejected | -14.76% |
| V12 | 2026-07-01 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -21.43% |
| V12.65 | 2026-07-01 | XDB-Registry 回归与动态星防伏击 | 修复 pre_aim 覆盖伏击 Bug，引入 predictedEnemyPos 起点预测，引入 isStarAmbush 守星伏击距离自适应松弛 (d>=1)，通过全部回归测试。实战胜率相比同对手池原版基准（50%）提升至 56.67%。 | 56.67% | Adopted | +6.67% |
| V12 | 2026-07-01 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Adopted | 16.66% |
| V12 | 2026-07-02 | 修复console.log导致的防守僵直 | 修复console.log导致的防守僵直 (自动生成) | 56.67% | Pending | 1.67% |
| V12 | 2026-07-02 | 修复console.log导致的防守僵直 | 修复console.log导致的防守僵直 (自动生成) | 66.67% | Adopted | 11.67% |
| V12 | 2026-07-02 | 优化A*剪枝减少Runtime开销 | 优化A*剪枝减少Runtime开销 (自动生成) | 63.33% | Adopted | 8.33% |
| V12 | 2026-07-02 | 优化草丛防盲区超载避弹与转向 | 优化草丛防盲区超载避弹与转向 (自动生成) | 73.33% | Adopted | 10.33% |
| V12 | 2026-07-02 | 优化避让草丛加分 | 优化避让草丛加分 (自动生成) | 73.33% | Pending | 0.33% |
| V12 | 2026-07-02 | 限制暗杀开启条件防抢星打乱 | 限制暗杀开启条件防抢星打乱 (自动生成) | 51.72% | Rejected | -21.28% |
| V12 | 2026-07-02 | 优化暗杀背后优先与偏轴草丛加分 | 优化暗杀背后优先与偏轴草丛加分 (自动生成) | 64.29% | Rejected | -8.71% |
| V12 | 2026-07-02 | 放宽最后阶段传送抢星限制 | 放宽最后阶段传送抢星限制 (自动生成) | 50.00% | Rejected | -23.00% |
| V12 | 2026-07-02 | 优化微调避让草丛加分 | 优化微调避让草丛加分 (自动生成) | 62.07% | Rejected | -10.93% |
| V12 | 2026-07-02 | 测试当前Baseline胜率水位 | 测试当前Baseline胜率水位 (自动生成) | 80.00% | Adopted | 25.00% |
| V12 | 2026-07-02 | 合入精细避让草丛加分与最后关头拼死抢星 | 合入精细避让草丛加分与最后关头拼死抢星 (自动生成) | 60.00% | Rejected | -20.00% |
| V12 | 2026-07-02 | 测试当前Baseline水位(50场) | 测试当前Baseline水位(50场) (自动生成) | 76.00% | Adopted | 16.00% |
| V12 | 2026-07-02 | 合入精细避让与落后死抢星(50场) | 合入精细避让与落后死抢星(50场) (自动生成) | 64.00% | Rejected | -12.00% |
| V12 | 2026-07-02 | 落后时直行抢星优于转身对枪 | 落后时直行抢星优于转身对枪 (自动生成) | 59.18% | Rejected | -16.82% |
| V12 | 2026-07-02 | 落后且传送不可用时直行抢星优于转身对枪 | 落后且传送不可用时直行抢星优于转身对枪 (自动生成) | 68.00% | Rejected | -8.00% |
| V12 | 2026-07-02 | 落后且传送不可用时直行抢星优于转身对枪 | 落后且传送不可用时直行抢星优于转身对枪 (自动生成) | 54.00% | Pending | 1.00% |
| V12 | 2026-07-02 | 简化落后且传送不可用时禁止对枪转身 | 简化落后且传送不可用时禁止对枪转身 (自动生成) | 64.00% | Adopted | 11.00% |
| V12 | 2026-07-02 | 紧急严格落后且有传送时无视安全锁强抢 | 紧急严格落后且有传送时无视安全锁强抢 (自动生成) | 69.39% | Adopted | 5.39% |
| V12 | 2026-07-02 | 合入控制9格危险警戒与解除被眩晕指令封锁 | 合入控制9格危险警戒与解除被眩晕指令封锁 (自动生成) | 62.00% | Rejected | -7.00% |
| V12 | 2026-07-02 | 合入控制9格警戒与共线对枪非共线装死眩晕反击 | 合入控制9格警戒与共线对枪非共线装死眩晕反击 (自动生成) | 70.00% | Pending | 1.00% |
| V12 | 2026-07-02 | 特化控制Stance拦截且限制对方子弹就绪 | 特化控制Stance拦截且限制对方子弹就绪 (自动生成) | 65.31% | Pending | -4.69% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -19.39% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Rejected | -9.39% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 68.97% | Adopted | 13.97% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Adopted | 5.33% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 58.62% | Rejected | -14.38% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Rejected | -9.67% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 66.67% | Rejected | -6.33% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 64.29% | Rejected | -8.71% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 70.00% | Pending | -3.00% |
| V12 | 2026-07-03 | 基准胜率评估 | 基准胜率评估 (自动生成) | 73.33% | Adopted | 18.33% |
| V12 | 2026-07-03 | 金蝉脱壳转移 | 金蝉脱壳转移 (自动生成) | 70.00% | Pending | -3.33% |
| V12 | 2026-07-03 | 基准胜率评估 | 基准胜率评估 (自动生成) | 55.17% | Pending | -4.83% |
| V12 | 2026-07-03 | 金蝉脱壳传送Bug修复 | 金蝉脱壳传送Bug修复 (自动生成) | 58.62% | Pending | 3.45% |
| V12 | 2026-07-03 | 超载防御与测试框架修复 | 超载防御与测试框架修复 (自动生成) | 60.00% | Pending | 1.38% |
| V12 | 2026-07-03 | 1步步行吃星安全放宽 | 1步步行吃星安全放宽 (自动生成) | 70.00% | Adopted | 10.00% |
| V12 | 2026-07-03 | 终盘步行吃星与超载防御优化 | 终盘步行吃星与超载防御优化 (自动生成) | 70.00% | Pending | 0.00% |
| V12 | 2026-07-03 | A*帧内缓存优化 | A*帧内缓存优化 (自动生成) | 50.00% | Rejected | -20.00% |
| V12 | 2026-07-03 | A*防御性拷贝缓存优化 | A*防御性拷贝缓存优化 (自动生成) | 62.07% | Rejected | -7.93% |
| V12 | 2026-07-04 | 帧内缓存与防隐身规避优化 (V12.93) | 引入 A* 双层帧内缓存与防隐身潜在枪线前瞻避弹，重构 1步吃星临门一脚，修复高消耗 runtime 虚拟机异常 | 100.00% | Adopted | +37.93% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 50.00% | Rejected | -10.00% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | 3.33% |
| V12 | 2026-07-03 | 未命名策略 | 未命名策略 (自动生成) | 80.00% | Adopted | 20.00% |
| V12 | 2026-07-06 | Close Range Overload desensitization bypass | Close Range Overload desensitization bypass (自动生成) | 66.67% | Adopted | -2.33% |
| V12 | 2026-07-06 | Performance optimization caching | 引入 canShoot, isLoS 以及 isOnEnemyGunLine 的帧内缓存优化，降低运行开销 | 58.00% | Adopted | -8.67% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 73.33% | Adopted | 13.33% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 55.17% | Rejected | -9.83% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 63.33% | Pending | -1.67% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 62.07% | Pending | 2.07% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 56.67% | Pending | -3.33% |
| V12 | 2026-07-06 | 未命名策略 | 未命名策略 (自动生成) | 60.00% | Pending | 0.00% |
| V12 | 2026-07-07 | 基准胜率测试 | 基准胜率测试 (自动生成) | 76.67% | Adopted | 16.67% |
| V12 | 2026-07-07 | 避险锁定3帧优化 | 避险锁定3帧优化 (自动生成) | 70.00% | Rejected | -6.67% |
| V12 | 2026-07-07 | 精细化避险锁定3帧优化 | 精细化避险锁定3帧优化 (自动生成) | 62.07% | Rejected | -14.60% |
| V12 | 2026-07-07 | 精细化避险防回头2.0 | 精细化避险防回头2.0 (自动生成) | 66.67% | Rejected | -10.00% |
| V12 | 2026-07-07 | 精细化避险折返拦截3.0 | 精细化避险折返拦截3.0 (自动生成) | 66.67% | Rejected | -10.00% |
| V12 | 2026-07-07 | 草丛与星格精细化防折返4.0 | 草丛与星格精细化防折返4.0 (自动生成) | 62.07% | Pending | -3.93% |
| V12 | 2026-07-07 | 特化危险半径及技能应对参数 | 特化危险半径及技能应对参数 (自动生成) | 70.00% | Adopted | 8.00% |
| V12 | 2026-07-07 | 解决守星震荡与延长消失视线感知 | 解决守星震荡与延长消失视线感知 (自动生成) | 80.00% | Adopted | 20.00% |
| V12 | 2026-07-07 | 嘴边星防预瞄抢戏漏洞与测试追加 | 嘴边星防预瞄抢戏漏洞与测试追加 (自动生成) | 72.41% | Pending | 2.41% |
| V12 | 2026-07-07 | 金蝉脱壳共轴拦截与预瞄保护细化 | 金蝉脱壳共轴拦截与预瞄保护细化 (自动生成) | 83.33% | Adopted | 11.33% |
| V12 | 2026-07-07 | TestAuto | TestAuto (自动生成) | 100.00% | Adopted | 15.00% |
| V12 | 2026-07-07 | TestCompat | TestCompat (自动生成) | 100.00% | Adopted | 15.00% |
| V12 | 2026-07-07 | auto | auto (自动生成) | 70.00% | Adopted | 10.00% |
| V12 | 2026-07-07 | auto | auto (自动生成) | 57.14% | Pending | -2.86% |
| V12 | 2026-07-07 | auto | auto (自动生成) | 66.67% | Adopted | 6.67% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 51.72% | Rejected | -8.28% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 60.00% | Pending | 0.00% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 56.67% | Pending | -3.33% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 70.00% | Adopted | 10.00% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 73.33% | Adopted | 13.33% |
| V13 | 2026-07-07 | auto | auto (自动生成) | 70.00% | Adopted | 10.00% |
| V13 | 2026-07-09 | 看当前代码的胜率 | 看当前代码的胜率 (自动生成) | 70.00% | Adopted | 15.00% |
| V13 | 2026-07-09 | V13.40: 性能与转向避险优化 | V13.40: 性能与转向避险优化 (自动生成) | 65.00% | Adopted | 5.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 60.00% | Pending | 0.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 55.00% | Pending | -5.00% |
| V13 | 2026-07-09 | V13.50: 清理传送预判冗余逻辑 | V13.50: 清理传送预判冗余逻辑 (自动生成) | 52.63% | Rejected | -12.37% |
| V13 | 2026-07-09 | V13.50: 传送清理 | V13.50: 传送清理 (自动生成) | 65.00% | Pending | 0.00% |
| V13 | 2026-07-09 | V13.65: 极致数字降开销 | V13.65: 极致数字降开销 (自动生成) | 55.00% | Rejected | -10.00% |
| V13 | 2026-07-09 | V13.65: 星格不安全早剪枝 | V13.65: 星格不安全早剪枝 (自动生成) | 65.00% | Pending | 0.00% |
| V13 | 2026-07-09 | V13.70: 传送冗余清理与剪枝 | V13.70: 传送冗余清理与剪枝 (自动生成) | 75.00% | Adopted | 10.00% |
| V13 | 2026-07-09 | V13.80: 避让闪现突脸 | V13.80: 避让闪现突脸 (自动生成) | 47.37% | Rejected | -17.63% |
| V13 | 2026-07-09 | V13.80: 重新验证避让闪现突脸 | V13.80: 重新验证避让闪现突脸 (自动生成) | 55.00% | Rejected | -10.00% |
| V13 | 2026-07-09 | 测试当前胜率 | 测试当前胜率 (自动生成) | 60.00% | Pending | 0.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 80.00% | Adopted | 20.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 55.00% | Pending | -5.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 70.00% | Adopted | 10.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 60.00% | Pending | 0.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 55.00% | Pending | -5.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 65.00% | Adopted | 5.00% |
| V13 | 2026-07-09 | 未命名策略 | 未命名策略 (自动生成) | 76.67% | Adopted | 11.67% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 65.00% | Adopted | 5.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 42.11% | Rejected | -27.89% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 50.00% | Rejected | -20.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 63.16% | Pending | 3.16% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 45.00% | Rejected | -15.00% |
| V13 | 2026-07-09 | auto | auto (自动生成) | 75.00% | Adopted | 15.00% |
