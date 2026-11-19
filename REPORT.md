# dsh-tools 交付报告（2026-11-19，v0.3.0）

## 状态

- 插件 `dsh-tools` v0.3.0 已安装在 desktop profile（**github:NecroDriver/dsh-tools git 安装**），Host fiber **active**。
- **按钮重启已端到端验证成功**（v0.2.3，14:05 实测）：点击「更多 → 重启 DSH」→ 两级启动 → 杀 app/host/孤儿子进程 → relaunch → 应用回来。
- v0.2.4 修复：重启过程中 WMI 助手弹「大黑框」→ `ShowWindow=0` + `-WindowStyle Hidden` 隐藏；helper 新增 relaunch 观测行（`relaunch observed pid=N` / `NOT observed`）。
- v0.3.0 新增：**输入栏「生成」按钮**（slot `conversation.input.right`）——点击后按最后一轮 AI 回复（DOM `[data-chat-flow-kind="assistant-step"]` 倒序取文本）经 Host `suggest` 方法调用 `ctx.llm`（模型取自 `agentDefaultModel.currentSelection()`）流式生成 1–3 句意向回复，剥引号/代码围栏后经 selectAll+insertText 填入 Lexical composer。失败显示 `[code] message`；无 AI 回复时报 `empty-context`；Host 无 llm 服务报 `llm-unavailable`。客户端 React require 失败时按钮静默降级（不影响标题栏 More 菜单）。

## v0.3.0（2026-11-19 18:4x–19:0x）

- Host（`index.js`）：`suggest` 方法 + `captureService()` 运行时子 fiber 捕获 `llm`/`agentDefaultModel`（服务缺席不炸 fiber，报 `llm-unavailable`）；输入截断 24000 字符、输出 220 tokens/60s 超时；zh/en 系统提示词（口语化、直接输出正文）。
- Client（`client.js`）：`GenerateButton` 组件（idle/busy/done/error 状态机 + flash 复位）、`findLastAssistantText()`、`insertDraftIntoComposer()`；注册进 `conversation.input.right`（order:10）；`inject:['connection','slots']`。
- 测试：smoke 17 项全过（新增 suggest 4 用例：无 llm/空上下文/正常流累积+剥引号+路由来自 selection）；two-stage 回归通过。
- 部署：commit + push GitHub → `plugin_manager` 重装（git 源）→ 一次性脚本重启 → Web Host 载 v0.3.0 → 用户点击「生成」端到端验证。

## v0.2.4 修复（2026-11-19 14:1x）

### 黑框 + 无 relaunch 证据

- 现象：重启功能正常，但期间弹出可见 PowerShell 控制台（WMI `Win32_Process.Create` 对控制台程序默认开窗），且「没自动启动」类报告无证据可查。
- 修复（`index.js`）：
  - wrapper 的 `Invoke-CimMethod Create` 传 `ProcessStartupInformation = (Win32_ProcessStartup, ShowWindow=0)`；
  - 内层 powershell 参数追加 `-WindowStyle Hidden`（双保险）；
  - helper 在 relaunch 后轮询 ≤10s 观测同名新进程，写 `relaunch observed pid=N` 或 `relaunch NOT observed within 10s` 到 `%TEMP%\dsh-tools-restart.log`。
- 测试：smoke 14 项 + two-stage 全过（helper 日志出现 `relaunch observed pid=…`）。
- 14:10 左右一次应用关闭未经插件（restart/debug log 均无记录，Application 事件日志无崩溃）——如再次发生，观测行会给出 relaunch 证据。

## v0.2.3 修复（2026-11-19 13:5x–14:0x）

### 根因：`detached:true` 子进程在 Electron RUN_AS_NODE 运行时下静默死亡

- 现象：点击到达 v0.2.2 handler 且 RPC 返回 ok，但 helper 从未执行（restart log 零记录）。
- 复现矩阵（`scripts/test-matrix.cjs`，Electron exe 当 node 跑）：`detached:true` 全灭（无 stderr、无执行痕迹），非 detached+`stdio:ignore`+`windowsHide` 成功 → v0.2.2 的 spawn 选项是凶手。
- 修复：两级启动 `launchRestartHelper(facts, payload)`——非 detach 短命 wrapper powershell，wrapper 里 `Invoke-CimMethod Win32_Process.Create` 真正的 helper（挂 WmiPrvSE 名下，脱离 app 进程树/job object）；wrapper 挂了有 Start-Process Hidden 兜底。helper 含子进程清理（快照 host 子 pid，杀后补杀，防会话 Host 孤儿）。
- 14:05 用户点击实测：debug log `restart scheduled (two-stage)` → `wrapper exited code=0` → helper 全程 → relaunch ✓ → 新 Web Host 载入 v0.2.3。

## v0.2.2 修复（2026-11-19 12:4x–13:0x）

- 双 Host 架构真相：Electron 主进程 + **Web Host**（拥有 web 端口，fiber 在应用启动时从磁盘加载）+ 会话 Host 子进程。`plugin_manager` 热重载只作用于会话 Host，**Web Host 不受影响** → 插件 host 半改动必须真重启应用。此前 404/协议错全是 Web Host 跑旧版所致。
- v0.2.0 的 404 根因：Cordis ctx 未声明 `inject` 的服务属性读取直接抛错（`cannot get property "connection" without inject`）→ apply 失败 → fiber failed。修复：`export const inject = ['webServer','connection'];`。
- helper 杀进程前快照并清理 host 子进程（会话 Host），否则孤儿泄漏。
- WMI `Win32_Process.Create` 是从工具 shell 逃逸进程树回收的可靠方式（13:04 实证）。

## v0.2.1 修复（2026-11-19 12:4x）

### 根因：失败信封缺 `details` → "connection: invalid server-response failure"

现象：v0.2.0 下点击「重启 DSH」报 `重启失败 connection: invalid server-response failure`，且应用未重启。
协议事实（`dsh-client-connection\lib\client.node.js` `parseConnectionResponse`）：失败结果 `result.error` 必须是 `{code: string, message: string, details: record}` 三件套——缺 `details` 会在客户端抛 TypeError。v0.2.0 的 `failure()` 只返回 `{code, message}`。该 TypeError 还掩盖了真实拒绝原因（handler 确实返回了某个失败，但 UI 只显示协议错误）。

### 修复

- `index.js`：`failure(code, message, details)` 补上 record `details`；所有失败路径携带诊断详情（envExe/appExe/appPid/parentPath/hostPid）。
- `index.js`：新增 `%TEMP%\dsh-tools-debug.log` 文件诊断日志（Host stdout 不落盘）：模块加载、每次方法调用结果、restart 决策（env 是否有 DSH_NODE_EXECUTABLE、父进程镜像）全部落盘。
- `index.js`：`DSH_NODE_EXECUTABLE` 缺失时的自举回退——用 PowerShell 探针读父进程镜像路径，文件名匹配 deepseek*.exe 即接受为重启目标（Host 子进程可能不继承该环境变量）。
- `client.js`：错误显示改为 `[code] message`，下次失败直接暴露真实原因。
- `scripts/smoke.mjs`：新增**真实客户端校验器复刻**（照抄 `parseConnectionResponse` 逻辑），所有 200 响应必须通过；拒绝断言升级为带 diag details。14 项全过。

## v0.2.0 修复（2026-11-19 12:0x）

### 根因：Host fiber 加载即失败 → 404

现象：客户端按钮正常，但 `POST /api/dsh-tools` → HTTP 404。
诊断（`plugin_manager list_plugins` 第三页）：

```
{"entryId":"include:dsh-tools","moduleName":"dsh-tools","enabled":true,
 "fiberPhase":"failed","diagnostic":"cannot get property \"connection\" without inject"}
```

`index.js` 的 `installConnectionFetch` 直接读 `ctx.connection`，但模块未声明 `inject`。Cordis 对未声明服务的 ctx 属性读取会抛错 → `apply()` 抛出 → 整个 fiber 失败，两条腿（webServer exact 路由 + connection.fetch）都没挂上。客户端半在浏览器独立加载，所以按钮照常显示。
（对照：dshmarket 不写静态 inject 也能跑，是因为它把所有服务访问都包在运行时 `ctx.inject([...],...)` 回调里；我混用了「运行时 inject + 直接属性访问」两种模式才踩雷。）

### 修复

- `index.js`：新增 `export const inject = ['webServer', 'connection'];`；两腿改为直接访问 `ctx.webServer` / `ctx.connection`（静态 inject 保证 `apply()` 被调用时服务已就绪），各自 try/catch，一条腿失败不影响另一条。
- 生效方式：**无需重启应用** —— `plugin_manager set_plugin include:dsh-tools enabled=false → true` 促使 loader 重新从磁盘加载模块，fiberPhase 立即变 `active`。
- `scripts/smoke.mjs` 桩 ctx 同步改为静态 inject 形状，并新增 fetch 腿 2 项断言（共 14 项，全过）。

### 客户端：去掉二次确认框（用户需求）

- 点击「重启 DSH」**直接执行**，不再弹确认。
- 警告改为菜单项 hint：`⚠ 点击立即重启，正在运行的任务将会中断`（en 同步），颜色用 `--dsw-alias-state-warn-primary`。
- 移除 confirm 阶段相关代码与 CSS（`.dsh-tools-confirm*`、`.dsh-tools-btnPrimary`）。

## 已完成（v0.1.0 基础）

1. **插件项目** `D:\Workspace\personal\dsh-tools`：
   - `client.js` — 在 Windows 标题栏菜单（`[data-windows-menu]` 的 open shadow root，即 应用/编辑 所在条）追加「更多」按钮，样式自动继承原生按钮；点击弹出下拉：**重启 DSH**（v0.2.0 起直接执行，⚠ 警告在 hint 中）。语言跟随 `<html lang>`（zh/en），并注册进 Client locale 服务。
   - `index.js` — Host 半：`/api/dsh-tools` 路由（webServer exact + connection.fetch 双腿，仅回环 + 同源 Sec-Fetch-Site 校验）；`restart` 方法校验桌面环境（`DSH_NODE_EXECUTABLE` 存在、父进程镜像路径与之一致）后，派生分离的 PowerShell 助手：先停 Electron 主进程、再停 Host，等待两者退出后重新启动应用；日志写入 `%TEMP%\dsh-tools-restart.log`。支持 `payload.dryRun`（不执行，只返回计划）。
   - `scripts/smoke.mjs`（14 项全过）、`scripts/test-helper.mjs`（dummy 进程实测 杀停/等待/重启 链路，6 项全过）。
   - `locale/{zh,en}.json`、`icon.svg`（官方蓝渐变 + 白色重启箭头）、`docs/DETAIL{,.zh}.md` + `preview.svg`、`README.md`。

## 历史教训（保留备查）

- 工具 shell（agent 会话）里 spawn 的「分离」进程会被进程树回收杀死 —— 首次「自动重启」实际失败，是用户 11:41 手动重启生效的。插件真实路径（Host 进程内 spawn）不受影响。
- Host stdout 日志不落盘（Electron 内存 tail）；排查插件加载失败先看 `plugin_manager list_plugins` 的 `fiberPhase`/`diagnostic` 字段。

## 人工确认清单

- 标题栏 应用/编辑 旁「**更多**」→ 下拉「**重启 DSH**」（带 ⚠ 提示，无确认框）→ 应用自动重启。
- 插件页（Settings → Plugins）显示 DSH 工具箱 / DSH tools、图标、详情文档。
- `%TEMP%\dsh-tools-restart.log` 应出现 helper 记录（真实重启链路证据）。
