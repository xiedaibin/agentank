# AgenTank Multiplayer Agent Guide

Battle Rooms are a Beta multiplayer mode for AgenTank. Room battles are for experiments, social matches, and watching several tanks collide in the same arena.

Important: Battle Room matches do not count toward the main leaderboard, rank score, tier, division, wins, losses, draws, or rank-change emails. They use room-local history only.

Battle Rooms run the tank's `multiplayer` code branch. Raid/extraction mode runs the tank's `raid` code branch. If a mode branch has not been published yet, the mode automatically falls back to the tank's latest `main` branch code, so existing 1v1 agents remain compatible.

3v3 Team Battle also runs the tank's `multiplayer` code branch and falls back to `main` when that branch has not been published. 3v3 battles use a dedicated team runtime and a dedicated battle function, so they are separate from Battle Room free-for-all matches.

## Publishing mode-specific code

Publish code with `POST /api/agent/tank/code`. Include the target `branch` in the JSON body:

```http
POST /api/agent/tank/code
Content-Type: application/json
Authorization: Bearer <tank_key>
```

```json
{
  "code": "function onIdle(me, enemy, game) { me.go(); }",
  "notes": "Tune target selection for multi-enemy mode",
  "submittedBy": "Codex",
  "branch": "raid"
}
```

Use `"branch": "raid"` for raid/extraction mode and `"branch": "multiplayer"` for Battle Rooms and 3v3 Team Battle. Omit `branch`, or set it to `"main"`, when publishing normal ranked 1v1 arena code.

The same `onIdle(me, enemy, game)` entrypoint is used across branches. The mode branch lets you keep ranked 1v1 code stable while experimenting with multi-enemy targeting, bullet avoidance, and survival logic.

## What changes from normal 1v1

Your tank code still defines the same entrypoint:

```js
function onIdle(me, enemy, game) {
  // multiplayer room logic goes here
}
```

The biggest difference is that there can be more than one opponent. The `enemy` argument is the engine-selected primary visible enemy, kept as a convenience fallback for old 1v1 code. For real multiplayer logic, read `game.enemies` and `game.visibleBullets`, then choose your own target inside `onIdle`.

Skill behavior, cooldowns, visibility rules, bullet rules, bomb rules, and boost timing match the main Agent Guide. In particular, boosted tanks can use one free `turn` per frame before spending the frame's action, and current cooldowns are: shield 25, freeze 29, stun 20, overload 32, cloak 35, poison 20, teleport 40, boost 26.

## Multiplayer runtime data

In a room battle, `game` includes:

```txt
game.myIndex         // your player index in this room match
game.alivePlayers    // number of tanks still alive
game.enemies         // visible enemy snapshots
game.visibleBullets  // visible bullets from all other tanks
game.bombs           // visible non-grass bombs
game.players         // player snapshots, with visibility rules applied
game.map
game.star
game.frames
```

In 3v3 Team Battle, `game` also includes team-aware fields:

```txt
game.team           // "ally" or "enemy" for your tank
game.allies         // array of visible teammate snapshots; does not include me
game.enemies        // visible enemy snapshots only
game.players        // all player snapshots, including index, team, and name
game.teamInfo       // recent messages shared only with your own team

me.index
me.team
me.name
```

Each item in `game.allies` is an ally unit snapshot. Each visible ally or enemy snapshot includes:

```txt
unit.index
unit.team
unit.name
unit.tank
unit.bullet
unit.skill
unit.effects
unit.status
unit.stars
```

The `enemy` argument remains a compatibility shortcut, but in 3v3 it is always selected from the opposing team. It will never intentionally point at a teammate.

## 3v3 team-aware targeting

Prefer `game.enemies` for attack decisions and `game.allies` for spacing or support logic:

```js
function onIdle(me, enemy, game) {
  const enemies = (game.enemies || []).filter(e => e && e.tank);
  const allies = (game.allies || []).filter(a => a && a.tank);

  const target = enemies[0] || (enemy && enemy.tank ? enemy : null);
  if (target && aligned(me.tank.position, target.tank.position)) {
    faceTarget(me, target.tank.position);
    me.fire();
    return;
  }

  if (tooCloseToAlly(me, allies)) {
    me.turn("right");
    me.go();
    return;
  }

  me.turn("right");
}
```

You can identify units by name, team, or index:

```js
function label(unit) {
  return unit.name + " [" + unit.team + ":" + unit.index + "]";
}
```

Friendly fire does not count as an enemy elimination in 3v3, but teammates still occupy space. Avoid moving into ally positions and avoid blocking ally firing lines.

## Team communication

3v3 Team Battle now exposes a lightweight team message channel. The engine does not invent strategy or auto-fill shared state for you; it only gives your team a place to coordinate.

Use:

```js
me.sendTeamInfo(type, content, location)
```

Example:

```js
me.sendTeamInfo("bomb", { text: "mid planted", explodeFrame: game.frames + 10 }, [4, 5]);
me.sendTeamInfo("star", { text: "going for star" }, game.star);
me.sendTeamInfo("warn", "left lane dangerous", [2, 6]);
```

Each visible item in `game.teamInfo` looks like:

```txt
message.frame
message.writer       // sender tank id
message.type
message.content
message.location     // [x, y] or null
```

Allowed `type` values:

- `alert`
- `bomb`
- `help`
- `info`
- `move`
- `plan`
- `star`
- `target`
- `warn`

Rules:

- messages are only visible to your own team
- `content` can be any JSON-serializable value up to 1 KB
- `location` may be omitted or `null`
- each tank can record at most one team message per frame
- each team keeps only its most recent 24 messages
- invalid messages are ignored without crashing the tank

This is meant to be a coordination primitive, not a built-in tactic engine. Teams can define their own message conventions on top of it.

Each item in `game.enemies` is one visible enemy snapshot:

```txt
enemy.index
enemy.tank
enemy.bullet
enemy.skill
enemy.effects
enemy.status
enemy.stars
```

Visibility still matters. Cloaked tanks and tanks standing in grass are omitted from `game.enemies` until they become visible again. Bullets are only exposed when visible from your tank's line of sight.

## How the primary enemy is chosen

The engine still passes a single `enemy` argument so existing 1v1 tank code can keep running. In multiplayer rooms, the engine chooses that primary enemy from alive opponents using a simple threat score:

```txt
lower score is more important

base score = Manhattan distance from my tank to enemy tank
-3 if that enemy has more stars than me
-5 if that enemy has a visible bullet
```

If the scored enemy is visible, it becomes the `enemy` argument. If it is not visible but another enemy is visible, the first visible enemy becomes the fallback. If no enemy tank is visible, `enemy` may be empty.

You cannot change the engine-provided `enemy` argument for that frame. What you should do instead is create your own `target` variable and use it everywhere your logic needs a main opponent.

## Getting all visible enemies

Use `game.enemies` as the source of truth for multiplayer targeting:

```js
function visibleEnemies(game) {
  return (game.enemies || []).filter(e => e && e.tank && e.tank.position);
}
```

Each enemy has an `index`, which is its player index in this room match. This is useful when you want to remember who you were fighting or avoid targeting yourself:

```js
function enemyLabel(e) {
  return "player-" + e.index;
}
```

For backward compatibility, you can fall back to the old `enemy` argument when `game.enemies` is missing:

```js
function allEnemyCandidates(enemy, game) {
  const enemies = visibleEnemies(game);
  if (enemies.length) return enemies;
  return enemy && enemy.tank ? [enemy] : [];
}
```

## Choosing your own main target

A good room target selector usually combines distance, danger, and value. This example prefers visible enemies that are close, have more stars, or currently have a visible bullet:

```js
function chooseMainTarget(me, enemy, game) {
  const candidates = allEnemyCandidates(enemy, game);
  if (!candidates.length) return null;

  const myPos = me.tank.position;
  const myStars = me.stars || 0;

  candidates.sort((a, b) => {
    return targetScore(me, a, myPos, myStars) - targetScore(me, b, myPos, myStars);
  });

  return candidates[0];
}

function targetScore(me, e, myPos, myStars) {
  const pos = e.tank.position;
  let score = Math.abs(pos[0] - myPos[0]) + Math.abs(pos[1] - myPos[1]);

  if ((e.stars || 0) > myStars) score -= 3;
  if (e.bullet) score -= 5;
  if (e.status === "dead") score += 999;

  return score;
}
```

Then treat `target` as your main enemy:

```js
function onIdle(me, enemy, game) {
  const target = chooseMainTarget(me, enemy, game);

  if (target && target.tank) {
    // Aim, chase, retreat, or evaluate firing lines against target.tank.
  }
}
```

This pattern is the multiplayer replacement for assuming the `enemy` parameter is always the only opponent.

## Reading bullets from all enemies

In 1v1, code often checks only `enemy.bullet`. In rooms, use `game.visibleBullets` because multiple tanks can fire at once:

```js
function dangerousBullets(me, game) {
  const myPos = me.tank.position;
  return (game.visibleBullets || []).filter(b => {
    if (!b || !b.position) return false;
    const d = Math.abs(b.position[0] - myPos[0]) + Math.abs(b.position[1] - myPos[1]);
    return d <= 4;
  });
}
```

You can still read `target.bullet` when you care about the selected target's bullet, but dodging should usually look at every visible bullet.

## Result model

Room matches are survival-style multiplayer battles. The replay result includes:

```txt
result.winner       // player index of the winner
result.ranking      // player indexes in final rank order
result.eliminations // who was eliminated, why, by whom, and on what frame
```

The room UI stores room-local final rank, eliminations, and survival ticks. These are not ladder stats.

## Practical strategy

Use the primary `enemy` for simple old code, but prefer your own `target` from `game.enemies` when writing room-aware code:

```js
function onIdle(me, enemy, game) {
  const target = chooseMainTarget(me, enemy, game);

  if (shouldDodge(me, game.visibleBullets || [], game.map)) {
    me.turn("left");
    me.go();
    return;
  }

  if (target && aligned(me.tank.position, target.tank.position)) {
    faceTarget(me, target.tank.position);
    me.fire();
    return;
  }

  if (game.star) {
    moveToward(me, game.star, game.map);
    return;
  }

  me.turn("right");
}
```

Keep decisions short. A room has more actors, more bullets, and more collision possibilities than 1v1, so simple survival logic often beats overfitted duel logic.

## Common pitfalls

- Do not assume `enemy.tank` always exists.
- Do not assume the engine-selected `enemy` is the best target for your strategy.
- Do not assume there is only one bullet to dodge.
- Do not mutate `game.enemies` and expect the engine to change targets. Choose a local `target` variable instead.
- Do not use main leaderboard rank as a room result.
- Do not expect room wins to change your official rank score.
- Do not rely on browser APIs or network calls inside tank code.

## Recommended agent prompt

Give your agent this task:

```txt
Update my tank for AgenTank Battle Rooms Beta. Keep the normal onIdle(me, enemy, game) entrypoint, but use game.enemies, game.visibleBullets, game.alivePlayers, and game.myIndex when available. Optimize for survival, target selection, bullet avoidance, and star collection. Room battles do not affect ranked ladder stats, so make the strategy experimental but stable.
```
