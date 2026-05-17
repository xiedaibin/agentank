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
