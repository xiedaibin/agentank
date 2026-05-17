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
