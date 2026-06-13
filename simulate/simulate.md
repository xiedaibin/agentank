# AgenTank 本地确定性对战模拟器 (Simulator & Player)

本模拟器是在本地建立的、与官方游戏规则完全一致的确定性坦克 1v1 对战物理仿真引擎与极简 Canvas 播放器。其核心目标是提供一个 **0 外部包依赖、0 成本、100% 本地化** 的开发联调沙盒，用于高效率评估坦克 AI 代码、验证战术、复盘对局及捕获异常。

---

## 📂 目录与文件分工

模拟器所有核心文件均存放在 [simulate/](file:///d:/MyGit/agentank/simulate/) 目录下：

1. **[maps.js](file:///d:/MyGit/agentank/simulate/maps.js) (地图数据模块)**
   * 录入官方经典地图模板（如 `classic` 经典图、`corridor` 走廊图）。
   * 提供物理转置矩阵，自动将便于人读的行字符串转置为物理碰撞所需的 `[x][y]` 二维数组。
   * 配置对称的红蓝双军预设出生点。

2. **[engine.js](file:///d:/MyGit/agentank/simulate/engine.js) (确定性物理仿真引擎)**
   * 基于 Node.js 原生 `vm` 沙盒环境实现双坦克 `onIdle` 独立隔离执行。
   * 精确模拟物理层移动、碰撞检测（墙壁、土堆、坦克相撞）、星星随机生成与抢星判定、子弹每帧飞行两格物理演进与撞击摧毁。
   * 搭载完整的 8 大技能状态机与冷却衰减（护盾阻挡、传送落点与 Manhattan 距离开火锁定、过载双弹、隐身、冰冻定身、中毒阻断、眩晕方向错乱、Boost 走两格等）。
   * 最终在演算结束后，输出与官方完全兼容的对局 JSON Replay。

3. **[run.js](file:///d:/MyGit/agentank/simulate/run.js) (仿真启动与本地服务)**
   * 负责从本地装载两份坦克源码，调用物理引擎运行，并将演算数据保存至 [local_replay.json](file:///d:/MyGit/agentank/simulate/local_replay.json)。
   * 内置原生极简 HTTP 服务（无任何 `npm` 包依赖），自动在本地 **3000 端口** 提供回放网页的可视化读取与渲染传输。

4. **[viewer.html](file:///d:/MyGit/agentank/simulate/viewer.html) (极简 Canvas 播放器)**
   * **几何级极简渲染**：使用 Canvas 以深色极客调绘制网格战局（灰色石墙、裂纹棕色土堆、绿色草丛、红蓝坦克与子弹、黄色吃星）。
   * **可视化调试 (Speak 气泡)**：完美支持官方的可视化调试协议，坦克播报的 `speak("文字")` 会在坦克头顶以半透明圆角文字框弹出（持续 5 帧），并在右侧高亮滚动日志输出。
   * **完美适配官方 Replay**：内置 `convertOfficialReplay` 适配器，支持一键上传并直接播放从官网下载的扁平 event 录像文件，并会自动动态绑定真实的坦克昵称。
   * **播放控制器**：支持播放、暂停、进度滑动条、◀/▶逐帧微调、一键重置及 1x/2x/5x/10x 多倍速切换。

---

## 🚀 本地仿真运行指南

### 1. 启动仿真对决
在终端项目根目录下，运行以下命令（传入 Challenger 源码路径、Defender 源码路径以及地图 ID）：
```bash
node simulate/run.js ./new_tank.js ./new_tank.js classic
```
* **工作机制**：引擎将开始 300 帧的沙盒仿真。仿真完成后会输出 Winner 及 Winner 原因，并将详细帧数据保存至 [local_replay.json](file:///d:/MyGit/agentank/simulate/local_replay.json)，最后尝试监听 3000 端口服务。
* *注：若终端提示 `EADDRINUSE` 端口占用，表明后台服务器已开启，但物理演算与 JSON 导出依然是 100% 成功且已更新的，可直接在网页刷新查看。*

### 2. 网页可视化回放
用任意浏览器打开：👉 [http://localhost:3000/viewer.html](http://localhost:3000/viewer.html)
* **播放本地模拟**：网页加载时会自动 fetch 拉取最新的 [local_replay.json](file:///d:/MyGit/agentank/simulate/local_replay.json) 渲染。您可点击“播放”或拖动进度条。
* **播放官方对局**：点击右上角 **“加载外部 Replay 文件”** 按钮，选择下载的官方 `events.json` 即可直接播放。

---

## 🧠 AI 开发者需知 (核心架构与设计精髓)

如果您是正在进行迭代的 AI 代理，请在后续代码修改和功能扩展中，牢记并遵循以下设计准则：

### 1. 双沙盒独立持久化
```javascript
const sandboxes = [ createSandbox(challengerCode), createSandbox(defenderCode) ];
```
* **原理**：我们在 `while` 循环外只调用 `createSandbox` 一次。两台坦克的沙盒上下文在整个 300 帧的游戏过程中是**持久且不销毁**的。
* **开发约束**：这使得坦克代码在顶层声明的全局变量（如 `G_History` 和 `G_Blueprint`）能够跨帧记录状态。禁止在每帧的 VM 调用中重置沙盒，以防历史状态丢失。

### 2. 精准技能匹配机制
因为坦克源码是对抗 8 种技能的通用源码，文件内必定包含 `enemy.skill.type === "shield"` 等所有 8 个技能的条件判断。
* **原理**：为了避免普通正则包含匹配的误判，在 [engine.js](file:///d:/MyGit/agentank/simulate/engine.js) 中我们使用 `codeText.includes("me.teleport")` 这种带有 `me.` 动作前缀的特征串进行精确识别。在新增或修改技能探测时，必须使用这种精准的匹配格式。

### 3. 防御式 API 注入 (Defensive API Injection)
* **原理**：由于在战术代码分支里可能会在某些特定时刻直接调用非当前识别技能的 API（如由于延迟或战术计算错误），如果在沙盒里没有提供该属性，前端会报 `is not a function` 错误并挂掉。
* **开发约束**：在构建 `me` 运行时对象时，我们**防御性地挂载了全部 8 种技能方法**。即使坦克调用了非本尊技能（如强行 teleport），也仅仅在物理校验层被悄无声息地过滤忽略，决不会发生 Javascript Runtime 崩溃中断执行。

### 4. 静默异常重定向暴露
* **原理**：坦克在代码中包裹了 `try-catch` 并调用 `print("Error: " + e.message)`。这会吞掉执行中的崩溃信息。
* **开发约束**：我们在沙盒初始化中重写了 `print` 和 `console.log`，将它们重定向并打在 Node.js 控制台上（前缀为 `[Code Print]`），这能让我们在终端运行时轻松捕捉到被吞掉的异常隐患。
