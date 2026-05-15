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
