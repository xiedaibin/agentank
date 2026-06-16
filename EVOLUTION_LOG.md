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
