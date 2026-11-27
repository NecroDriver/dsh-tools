# dsh-tools 交付报告（2026-11-27，v0.8.2）

## 状态

- 插件 `dsh-tools` v0.8.0 编码/测试完成，profile 内为 Junction 直连本仓库（`link:D:/Workspace/personal/dsh-tools`），重启 DSH 生效。
- **按钮重启已端到端验证成功**（v0.2.3 起多次实测）：点击「更多 → 重启 DSH」→ 两级启动 → 杀 app/host/孤儿子进程 → relaunch → 应用回来。
- v0.2.4：WMI 助手「大黑框」→ `ShowWindow=0` + `-WindowStyle Hidden` 隐藏；helper relaunch 观测行。
- v0.3.0：**输入栏「生成」按钮**（slot `conversation.input.right`）——最后一轮 AI 回复经 Host `suggest`（`ctx.llm` 流式，模型取自 `agentDefaultModel.currentSelection()`）生成 1–3 句意向回复填入 Lexical composer。
- v0.4.0：**输入历史 ↑/↓**（终端式）——光标在输入框时 ↑ 载入上一条**用户已发送消息**（DOM `[data-chat-flow-kind="user"]` 实时读取），↓ 向最新回走，越过最新恢复原草稿。v0.4.3：历史文本清洗（时间戳/隐藏重复块折叠）。
- v0.5.0：**输入栏「优化」按钮**（提示词改写，composer 生成/优化期间锁定）+ **系统设置 → 工具设置**（每功能开关、自定义模型 provider+model、模型目录来自 `models.list`）。
- v0.6.0：**「资源控制」面板**（类 VSCode；见下节）。
- v0.6.1：**「更多 → 重载插件」**——热重载入口（见下节），回应「每次都重启打断任务」的问题；实证 install 即热替换，零重启。
- v0.6.2：**资源控制入口迁至右侧「开始」工具栏**（与 工作区文件/新建终端/浏览网页 同级），面板改为右栏标签页（见下节）。
- v0.6.4：**输入框上方常用语悬浮条**（点击插入光标处、最多 5 条、工具设置可编辑）+ **热替换根因修复（ctx.effect teardown）** + **资源控制分组默认折叠**（见下节）。
- v0.6.5：**资源控制只扫当前工作区**（主视图会话根互斥 registry，修复跨工作区父级/兄弟项目污染）+ 主视图切换自动重扫 + 空态显示实际扫描根（见下节）。
- v0.6.6：**常用语条重叠修复第一轮**（官方 `bottom:100%`+gap 定位 + 弹层避让 + a11y）——定位数学上与旧版同位，用户无感（详见 v0.6.7 节）。
- v0.6.7：**常用语条改卡片内文档流**——彻底放弃悬浮定位（见下节）。
- v0.7.0：**侧栏「今日 Token 用量」组件** + **常用语条卡片定位修复**（见下节）。
- v0.7.5：**资源控制「更新代码 / 更新数据库」按钮**（面板顶栏 + 每个分组头，见下节）。
- v0.7.6：**布局调整**——v0.7.5 的独立顶栏工具条并入标题行（刷新按钮旁），批量进度/摘要改为条件显示的细行（见下节）；另修复跨安装边界不生效问题（重装进 profile，见节内说明）。
- v0.7.7：**面板设计/交互优化**（ui-ux-pro-max 规范评审驱动）——无障碍（图标按钮 aria-label、分组折叠 aria-expanded、批量进度 role=status、面板 aria-busy、勾选框 aria-label）、指针与反馈（全部可点元素 cursor:pointer + 120ms 过渡 + :active 按压态 + :focus-visible 焦点环）、scMini 提至 24px 命中高度、标题行与分组头的图标簇前加细分隔线（按钮分组辨识度）、文件行 `content-visibility:auto` 长列表渲染优化、加载中禁用刷新防双触发（见下节）。
- v0.7.8：**图标对齐修复**（用户反馈：图标文字过近、中线不对齐、图标上飘）——icon() 包装 span 默认 `dsh-tools-scIco`（居中 flex 盒 + svg display:block，消除内联 svg 骑基线导致的下坠空隙），scMini gap 4→6px（见下节）。
- v0.7.9：**diff 比对方向切换**（用户需求：改动详情页加按钮切换 横向/纵向）——diff 详情上方工具条新增切换按钮（scMini，图标+「横向」/「纵向」，aria-pressed），横向=side-by-side 双栏网格（旧/新行号+配对内容，连续 -/+ 段逐行配对、短侧留空），纵向=原 unified 逐行；偏好经 localStorage 持久化（无 DOM 环境自动降级为会话级）（见下节）。

- v0.7.11：**推送图标更换**（用户反馈：旧的双向循环箭头与刷新图标太像、易误解）——改为上传式上箭头（arrow-up-out-of-tray），与「更新代码」的下载式下拉形成 拉取/推送 一对。
- v0.7.10：**横向比对修正 + VSCode 风格 diff 视觉**（用户反馈：新文件横向展示错乱、布局丑）——根因=合成 untracked diff 缺 `@@` hunk 头（客户端全 `+` 行堆尾配对、左栏整列空、行号从 0 起）+ git preamble（diff --git/---/+++）被当内容渲染；服务端 syntheticNewFileDiff 补标准 hunk 头，客户端两种布局都过滤 preamble 并给无 hunk 兜底行号；视觉上 unified/split 的增删行加整行半透明色块 + 左缘指示条、hunk 头低调灰底小字、split 新侧行号列前加 1px 中线、行号 tabular-nums、diff 格 content-visibility（见下节）。
- v0.7.11（续）：**工具设置新增「新会话默认展开右侧栏」开关**（默认开；用户需求：DSH 本身没有该设置，新增会话一律收起）——客户端 `registerSidebarAutoOpen` 监听 `sidebarRight.mounted` + `sessions.list`，只对"新"会话（启动基线之后出现、或 `blank === true` 的新建会话）调用 `sidebarRight.toggleExpanded()`，每个会话仅一次、子代理会话跳过、启动时恢复出来的既有会话保持持久化状态（启动恰好落在空白新会话上则视为新会话照常展开）、焦点留在输入框（见下节）。

- v0.8.0：**资源控制「撤销改动」**（用户需求：「dsh-tools需要支持选中文件撤销改动，单文件撤销改动，如果本身是新增，就直接删除」）——每个文件行悬停显现撤销小图标（单文件），提交栏新增红色「撤销」按钮（撤销全部勾选）；确认弹层分两栏列出两种处置（还原 M/D/R vs 删除新增）；Host `sc.revert` 复用 `resolveSelection` 防陈旧/防遍历；顺带修复 untracked 目录折叠问题（`git status` 改 `-uall`，嵌套新增文件逐个列出）（见下节）。
- v0.8.1：**资源控制「进程控制台」**（用户需求：同步数据库报错要手动跑命令、拉代码会冲突，「最好能接个终端显示和输入支持」）——单仓「更新代码/更新数据库」从一次性调用升级为交互式进程会话：分组内嵌终端式控制台（实时输出流 + 运行中可输 stdin + 终止按钮 + 退出码），prisma 数据损失错误一键「接受数据损失并重试」（`-- --accept-data-loss`），rebase 冲突一键「放弃本次更新」（`git rebase --abort`），另有「复制输出」；批量（标题行）按钮沿用同会话机制逐仓执行（见下节）。
- v0.8.2：**修复 AI 生成 commit message 撞校验**（用户反馈：AI 生成的提交信息被 `[bad-request] Commit message must be 1-500 characters (no control characters)` 拒绝）——系统提示词补硬性长度约束（首行 ≤72、全文 ≤400 字符、正文只挑要点不逐文件罗列）；新增 `cleanCommitDraft` 把 CRLF/CR 归一为 LF（`\r` 是控制字符，正是被拒的一类根因）、剥离残余控制字符、超 500 按行边界截断保首行（见下节）。

## v0.8.2（2026-11-27）

### 修复：AI 生成的 commit message 撞提交校验

用户反馈原文：AI 生成提交信息后点提交报 `[bad-request] Commit message must be 1-500 characters (no control characters).`（当时正提交 dsh-tools v0.8.1 的 11 个文件）。

**两个根因**：
1. `COMMIT_SYSTEMS` 系统提示词没有任何总长约束——大 diff 面前模型会写很长的正文，轻松超过 500 字符上限（`sc.commit` 行为正确，是生成侧越界）。
2. `cleanSuggestDraft`（suggest/optimize/commit 共用的清洗函数）不处理行结束符——模型流可携带 CRLF，`\r`（U+000D）落在提交校验的控制字符区间 `[\u0000-\u0008\u000b-\u001f]` 内，即使总长合规也会被拒。

**修复**（全在 index.js）：
- `COMMIT_SYSTEMS` zh/en 补硬性长度约束：首行 ≤72 字符；全文（首行+空行+正文）≤400 字符（留 100 字符余量给 500 上限）；正文只挑 2~4 个关键点、绝不逐文件罗列；小改动只写首行。其余风格指令不变。
- 新增 `cleanCommitDraft(raw)`（仅 commit 管道使用，suggest/optimize 不受影响）：在 `cleanSuggestDraft` 去围栏/引号基础上——CRLF/CR 归一为 `\n`；剥离残余控制字符（换空白）；双空格折叠；超 500 时先截到 500 再回退到最后一个行边界（边界 ≥72 时）保住完整首行。`runAssist` 对 `kind === 'commit'` 改走此清洗。
- `handleScCommit` 的 500 字面量改为共享常量 `SC_COMMIT_MSG_MAX`（生成侧与校验侧同一预算）。
- 版本 v0.8.2（MODULE_VERSION + package.json）。

**测试**（test-sc.mjs 新增 4 项，全量 59 项 ALL CHECKS PASSED）：
- CRLF 草稿归一：fake llm 产出 `feat: multi\r\n\r\nbody one\r\nbody two\r` → 草稿无任何控制字符且换行为 `\n`；
- 系统提示词含硬性长度约束（400/72 断言）；
- 700 字符草稿（超长首行 + 超长正文）→ 截断保首行（106 字符、行边界切割）；
- `sc.commit` 对 501 字符消息仍拒绝（校验侧行为不回归）。
- render 84/84、usage 23、smoke、node --check 全绿。

**生效方式**：仅 Host 侧（index.js）改动——「更多 → 重载插件」或重启 DSH 生效；客户端无改动无需 F5。

## v0.8.1（2026-11-27）

### 资源控制：进程控制台（终端式输出 + stdin 输入 + 失败一键处置）

用户需求原文：「我点击同步数据库，出现异常，需要手动输入命令解决。拉新代码通用会出现冲突的情况，也会导致失败。最好能接个终端显示和出入支持。但是放在哪里，怎么展示这些需要设计下。」（附图：prisma push 报 `Use the --accept-data-loss flag`；用户手动终端跑命令输 `yes` 成功）

**设计**（dsh-doc 查证：DSH 无终端 slot、无 Host→Client 推送通道，只能 RPC 请求-响应 + 轮询）：
- 控制台放在**仓库分组内**（分组头下方、文件列表上方）——终端上下文跟仓库走，天然解决"放哪里"。
- 深底等宽输出块（自动滚底、max-height 220px）；运行中显示 stdin 输入行（回车发送）+ 停止按钮；结束后显示 `退出码 N` 状态 + 关闭按钮。
- 失败智能操作：输出含 `--accept-data-loss` → 红色「接受数据损失并重试」（Prisma 非 TTY 不读 stdin，实证 pipe 下直接报 flag 提示，故用 flag 重跑而非模拟输入）；输出含 `CONFLICT` → 红色「放弃本次更新」；恒有「复制输出」。

**Host（index.js）**：
- 新 RPC 五个：`sc.run`（启动会话：pull=spawn git 直连；prisma=cmd.exe `/d /s /c` 字面常量命令串 `pnpm run prisma:generate && pnpm run prisma:push [-- --accept-data-loss]`，同 v0.7.5 的注入面姿态；同 repo 活跃会话 → `proc-busy`，并发上限 4 → `proc-limit`）、`sc.procOutput`（`since` 增量返回 output/total/done/exitCode/error/killReason/kind/command）、`sc.procInput`（行写入子进程 stdin，cap 1024）、`sc.procKill`（Windows `taskkill /pid /T /F` 树杀 cmd→pnpm→node 全链）、`sc.rebaseAbort`（`git rebase --abort`）。
- 会话基建：`scProcSessions` Map；输出 ring buffer 200KB 保尾；超时（pull 5min / prisma 10min）自动树杀并标 `killReason='timeout'`；结束后 10min GC（`unref` 不阻退出）；**teardown 时全量树杀**（插件卸载/热重载不留孤儿进程）。
- 旧 `sc.pull`/`sc.prisma` 保留（零调用方——客户端已全走会话；保留仅为兼容潜在外部调用）。

**Client（client.js）**：
- `consolesRef`（真值）+ `consoleMap`（state 镜像）；`pollSession` 400ms 轮询链（sessionId 比对失效即自停，防重扫后旧链写新会话）；`runRepoSession` 统一入口：单仓按钮（pull/prisma）与批量 `runBatch` 逐仓顺序执行都走它；成功 note `代码已更新`/`数据库已更新` + `refreshRepo`；失败 note 优先显示 `已终止`/`超时终止`，否则 `退出码 N`。
- `loadAll`（重扫）清空 console 会话——面板重置语义。
- 控制台 UI：命令行头（`$ command` 椭圆截断 + 三态色状态 + 停止/关闭按钮）、输出 pre、运行中输入行（Enter 发送 + 发送按钮）、动作行（数据损失重试 / 放弃 rebase / 复制输出，`is-danger` 红）。
- 字典 zh/en 各 18 键；`SC_STOP_GLYPH`（方形停止钮）；CSS 16 条规则。

**测试**：
- test-sc.mjs 新增 16 项：交互 stdin 端到端（ask.mjs 脚本 prompt→`sc.procInput 'y'`→exit 0 `YOU SAID y`；answer n→exit 3 透传）、`since` 增量不重放、`proc-done`/`bad-request` 守卫、`proc-busy`（同 repo 二连）、`proc-limit`（4 sleep 会话占满后第 5 个拒绝）、`procKill` 树杀（killReason='user'、exit 1）、`acceptDataLoss` 拼进命令行（实测 pnpm/cmd 链 stdin 贯通）、真实 rebase 冲突仓库（pull 会话 exit 1 + CONFLICT 输出 → `sc.rebaseAbort` → 无 rebase 残留 + 工作区干净）。全量 54 项 ALL CHECKS PASSED。
- test-client-render.cjs 更新至 84 项 PASS：sc.run stub 返回会话、procOutput 奇偶轮模拟增量流（验证客户端增量拼接）、console 块/状态/复制动作渲染断言、批量计数改数 `sc.run`。踩坑（v0.7.5 老坑再现）：console 断言必须在 `runEffects` 前采样——fake harness 每步重放 mount effect → `loadAll` 会清刚建立的会话。
- smoke / test-usage 23 / node --check 全绿。

**生效方式**：profile `node_modules\dsh-tools` 为 Junction 直连本仓库——Host（index.js）改动需重启 DSH（或插件页重载），Client（client.js）改动刷新页面即可。

## v0.8.0（2026-11-26）

### 资源控制：撤销改动（单文件 / 多选；新增直接删除）

用户需求原文：「dsh-tools需要支持选中文件撤销改动，单文件撤销改动，如果本身是新增，就直接删除。」

**Host（index.js）**：
- 新 RPC `sc.revert`（dispatch 表 + `handleScRevert`）：`requireScRepo` → `resolveSelection`（fresh status 复核，陈旧勾选/路径遍历/非变更文件一律 bad-request，与 commit 同口径）。
- 处置规则（按 porcelain 状态）：
  - `A`（新增，untracked 或已暂存）：无基线可回 → **直接删除**。staged → `git rm -f -- <path>`（index+worktree 一步）；untracked → `rmSync(force)`。
  - `M`/`D`：`git checkout HEAD -- <path>`（index+worktree 都回 HEAD，部分暂存也一并还原）。
  - `R`（重命名，staged）：还原旧侧 `git checkout HEAD -- <orig>` + 新侧按 staged 与否 `git rm -f` 或 `rmSync`——完整撤销重命名。
  - 删除文件后 `removeEmptyDirs`：从文件目录向上清空目录（`rmdirSync`，非空即停），止于 repo root。
- 逐文件 try/catch：`results:[{path,status,action,ok,error}]`（error=stderr 尾 300 字符）；**部分失败仍返回 ok:true**（带 restored/deleted/failed 计数，客户端展示首条错误）；全部失败 → `gitFailure`。debugLog 摘要行。
- **顺带根修**：`currentChanges` 的 `git status --porcelain=v1 -z` → 加 `-uall`。旧行为把整个未跟踪目录折叠成一条 `dir/` 记录——无法逐文件 diff/撤销、勾选提交语义也含糊；现在嵌套新增文件逐个列出（与 VSCode 源代码管理一致；`SC_MAX_FILES` 截断兜底大目录）。

**Client（client.js）**：
- 文件行：状态徽章后新增 `scFileRevert` 小图标（undo 箭头，悬停显现、红色 hover；`title`/`aria-label` 齐全）→ `askRevert(repo,[file])`。
- 提交栏 `scActions` 行首新增红色危险按钮「撤销」（`is-danger` 样式，busy 禁用）→ `askRevert(repo, 勾选文件)`。
- 确认弹层（`revertAsk` state + `scModalWrap/scModal` 固定定位遮罩）：两栏列表明确两种处置——「还原以下改动（回到最近提交）」（M/D/R，常规色）与「删除以下新增文件（不可恢复）」（A，红色）；每栏最多 12 条 + `… +N` 折叠；Esc/遮罩点击/取消按钮 → 关闭；确认 → `doRevert`。
- `doRevert`：busy op `'revert'`；成功 note=`已撤销 · 还原 N · 删除 M`（部分失败附首条 per-file error）；成功后清勾选、关 diff、按 path 清 diffState 缓存、`refreshRepo`。
- 字典（zh/en）`scRevert*` 系列 13 键；`SC_REVERT_GLYPH`（undo 箭头）；CSS：`is-danger` 按钮、行内撤销图标、弹层 8 类。
- 图标风格修正（用户反馈：「你这图标风格一下差太多了」）：初版 undo 箭头是自绘的截断弧线（`v1` 悬空短线脚），与 feather 系其它图标不搭；改为 feather 原生 `corner-up-left` 几何（`polyline 9 14 4 9 9 4` + `M20 20v-7a4 4 0 0 0-4-4H4`，完整曲线收笔）。且尺寸对齐家族惯例：文件行图标按钮用 13px（与 pull/push/db/refresh 同），提交栏文字按钮用 12px（与 AI 生成的 spark 同）——拆成 `SC_REVERT_GLYPH`/`SC_REVERT_SM_GLYPH` 两个常量。

**测试（scripts/test-sc.mjs 新增 7 项断言）**：5 文件混合撤销（b untracked-A / c D / e R+orig / f staged-A / nested/n.txt untracked-A）→ restored=2、deleted=3、failed=0；断言 b/f/e/嵌套目录全消失、c.txt/d.txt 内容回 HEAD（CRLF 归一后比对——Git for Windows autocrlf 会把 LF 检出为 CRLF）；撤销后 `sc.status` 干净；非变更文件/路径遍历/非绝对 repo 三种 bad-request。全量回归：test-sc 29 项 ALL CHECKS PASSED；smoke / test-usage 23 / test-client-render / test-two-stage / test-sidebar-auto-open 全绿。

**生效方式**：profile `node_modules\dsh-tools` 为 Junction 直连本仓库——Host（index.js）改动需重启 DSH（或插件页重载），Client（client.js）改动刷新页面即可。

## v0.7.11（2026-11-24）

### 工具设置：新会话默认展开右侧栏（开关，默认开）

用户需求：「先检查当前 dsh 有没有配置能够控制新增会话时默认打开右侧侧边栏的设置，没有的话在 dsh-tools 新增配置项，默认打开」。

**排查结论**：DSH 没有该设置。右栏实现在 `@deepseek-ai/dsh-client-ui-sidebar-right`：每个会话的布局（`expanded`/`mode`）按会话持久化在 `localStorage['dsh.sidebar-right.v1.<sessionId>']`，新会话的初始面（`createSurface()`）固定为"收起、单窗格、无标签"，首次展开时由 settle 规则播种默认引导页；`dsh-client-ui-settings-*` / `dsh-settings` 全部源码中没有任何右栏默认态相关的 schema/开关（设置页的"通用"区只是渲染 `settings.general.item` 槽位）。右栏唯一的公开控制面是 `ctx.sidebarRight`（`isExpanded()` / `toggleExpanded()` / `openTab()` / `openResource()` 等）。

**实现**：
- 配置：`features.openSidebar: true` 加入 `DEFAULT_SETTINGS.features`（index.js；`mergeSettings` / `handleSettingsSet` 按 key 泛化处理，无需改动），客户端 `featureFlags.openSidebar`、工具设置面板 TOGGLES 新增一行「新会话默认展开右侧栏 / Open the right sidebar on new sessions」（内联 DICTS zh/en）。
- 行为（client.js `registerSidebarAutoOpen`）：注入 `sidebarRight` + `sessions`；记录启动基线（会话列表首次 `phase === 'ready'` 时的 id 集合，兜底 3 秒后取样）。启动选择：插件启动后 `sidebarRight.mounted` 的首次 `undefined → <会话>` 变化就是 DSH 的启动选择——非空白会话记为 `bootExempt`（保留其持久化状态，用户切到别的会话后失效）；空白会话（`blank === true`）本身就是新会话，照常展开；插件启动时已有会话在屏（HMR / 插件重载）则一律不动。`isNewSession(id)`：子代理（`origin === 'subagent'` 或有 `parentId`）→ 否；`blank === true`（点「新建会话」复用/新建的空白会话）→ 是；基线内 → 否；否则 `updatedAt` 在 10 分钟内 → 是。
- 触发：只响应 `sidebarRight.mounted` 的**变化**（初值不触发），以及会话列表变化（覆盖"先上屏、后入列表"的时序）。每个会话最多展开一次（`handled`：展开成功或放弃重试后都记入）——用户手动收起后再切回来不会再次展开；开关在执行前实时读取（设置页关闭立即生效）。
- 时序/焦点：因 `mounted` 在 React 渲染前变化、会话 store 要到 `rightbar.session` 槽位渲染时才被 adopt，`toggleExpanded()` 首次可能抛 `sidebarRight: no session surface is mounted` → 以 `setTimeout(0)` 起步（不在应用 store 的监听器内同步执行 flushSync）、40ms 间隔最多重试 25 次；`isExpanded()` 已为真则跳过；DSH 的 `toggleExpanded()` 会把 DOM 焦点移进侧栏，故先记录 `document.activeElement`（非 body/documentElement）否则取 `[data-composer-card] [contenteditable="true"]`，展开后立即 + 下一拍把焦点还回去（仅当焦点落在侧栏区域或 body 时才抢回）。
- 注册：apply 中与其它模块一致 `try { keep(registerSidebarAutoOpen()) } catch (error) { console.warn('[dsh-tools] sidebar auto-open unavailable:', error) }`，cleanup 取消计时器、退订、释放 fiber。

**测试**：新增 `scripts/test-sidebar-auto-open.cjs`（vm 沙箱 + 伪 `sidebarRight`/`sessions`，29 项：插件启动时已在屏的会话不动、启动选择四态（既有会话不动 / 空白会话展开且收起后切回不再展开 / 先经过首页再进空白会话也展开 / 开关关闭不展开）、既有会话/仅在列表未上屏的会话不触发、新空白会话展开一次、收起后切回不再展开、后到的 blank 也算、子代理永不触发、首条已发送的新会话展开、先上屏后入列表时在入列时展开、后入列表的旧会话不展开、焦点回到输入框/原元素、已展开不重复、adopt 竞态重试、中途离开停止重试且回来重试、重试预算恰 25 次后放弃且不再重试、dispose 退订、开关关闭 0 次调用）→ SIDEBAR AUTO-OPEN TEST PASS；smoke.mjs 增加 `openSidebar` 默认 true、可关闭并落盘的断言；`node --check` client.js/index.js 通过；test-client-render.cjs PASS（既有 SC/usage 流程不受影响）。注意 Windows 定时器最小粒度 ≈15ms，预算场景需等待 ≥600ms。
**实机验证**（Playwright 连本机 GUI，真实应用）：开关开——冷启动落在空白会话 → 展开、焦点在输入框；切到既有会话后刷新（启动选择 = 既有会话）→ 保持收起；点「新建会话」→ 展开；手动收起 → 切到既有会话 → 再点「新建会话」→ 保持收起。开关关（设置页取消勾选并保存）——冷启动空白会话收起、「新建会话」保持收起，`settings.json` 的 `features.openSidebar` 随保存落盘；重新勾选保存后冷启动恢复展开。设置 → 工具设置面板可见「新会话默认展开右侧栏」一行（默认勾选）。

### 推送图标更换

用户反馈：「推送的图标换一下和刷新太像了，容易误解」。旧 push 图标是双向循环箭头（feather 循环样式），13px 下与刷新的旋转箭头易混。换成**上传式上箭头**（arrow-up-out-of-tray：托盘 + 上指箭头）——与「更新代码」的下载式下拉（arrow-down-into-tray）形成天然的 拉取/推送 语义对，三个图标（↓ 拉代码 / 圆柱 数据库 / ↑ 推送）+ 刷新（旋转箭头）互不混淆。仅改 SC_PUSH_GLYPH 常量，所有引用（分组头推送按钮）自动生效；测试断言走 title/aria-label，不受影响。

## v0.7.10（2026-11-24）

### 横向比对展示修正（bug）+ diff 视觉重做（用户：「点击了展示有问题，另外这布局好丑」）

**根因**（用户截图实证：新文件 `I18nConfig.java` 的 diff 在横向模式下头部元数据被渲染、左栏全空）：`syntheticNewFileDiff`（index.js）产出的 untracked 合成 diff **没有 `@@` hunk 头**——`diff --git`/`new file mode`/`--- /dev/null` 行被 parseSplitRows 当上下文/删增内容渲染；全部 `+` 行没有段边界，堆到结尾一次性配对（del 侧全空）；行号从 0 起算。

**修复**：
- 服务端（index.js）：syntheticNewFileDiff 补 `@@ -0,0 +1,N @@`（N=行数），与真实 `git diff` 新文件输出完全一致。
- 客户端（client.js）：① `isDiffPreamble` 识别 `diff --git /new file mode /deleted file mode /old mode /new mode /index /similarity index /dissimilarity index /rename from /rename to /Binary file /--- /+++ `，仅首个 hunk 前生效——两种布局都过滤（VSCode 式不渲染元数据；`(file no longer exists)` 提示行保留）；② 无 hunk 输入兜底：行号从 1 起（防旧缓存/异常来源）。

**视觉重做**（ui-ux-pro-max design_review 复查，VSCode 风格）：
- unified：`+`/`-` 行整行半透明色块（绿/红 10%，负 margin 从容器左缘铺满）+ 文字色不变；hunk 头缩为 10.5px 灰字。
- split：删/增格子整格色块 + `inset 2px` 左缘指示条（红/绿 55%）；新侧行号列前 1px 中线分隔两栏；行号 `tabular-nums`；hunk 头整行灰底 10.5px；diff 格 `content-visibility:auto`（长 diff 只渲染视口内，评审 Rendering 规范落地）。色块 rgba 刻意非令牌（需深浅主题同时可读，与编辑器 diff 底色做法一致；文字色保持主题令牌）。

**测试**：render stub 换真实 diff 形态（带 preamble、-/+ 正序），新增 3 断言（unified 过滤 preamble、split 过滤 preamble、split 行号跟随 hunk 头 `1,1,2,2`），80/80 PASS；test-sc.mjs 新增合成 diff hunk 头结构断言（`@@ -0,0 +1,N @@` 紧随 +++ 行），28 项 ALL CHECKS PASSED；usage 23、smoke 全绿。

## v0.7.9（2026-11-24）

### 改动详情页：比对方向切换（横向 side-by-side / 纵向 unified）

用户在 diff 详情（点文件展开）场景提出：「改动详情页添加一个按钮，支持切换比对风格 横向和纵向」。

- **入口**：diff 详情顶部新增 `scDiffBar` 细工具条（右对齐），一个 scMini 按钮：当前纵向时显示「纵向」+ 横分割线图标，当前横向时显示「横向」+ 竖分割线图标；`title` 提示两种方向，`aria-pressed` 反映 split 态。同一时刻仅影响打开的 diff（全局样式状态，切换即时生效）。
- **横向（side-by-side）**：`parseSplitRows` 解析 unified diff——hunk 头 `@@ -a +b @@` 重置两侧行号；连续 `-`/`+` 段按索引逐行配对（删除红/新增绿），短的一侧留空占位；上下文行两侧同号同文；`\ No newline` 标记丢弃。渲染为 CSS Grid 四列（旧行号 | 旧内容 | 新行号 | 新内容），`minmax(0,1fr)` 保证两栏等宽、长行 `pre-wrap + overflow-wrap:anywhere` 在窄面板内优雅折行；hunk 头整行横跨。
- **纵向（unified）**：原 DiffView 逐行 `<pre>` 不变。
- **持久化**：`localStorage['dsh-tools.scDiffStyle']`（try/catch 包裹，render 测试沙箱等无 DOM 环境降级为会话内状态，默认纵向）。
- **字典**：scDiffStyleTitle / scDiffSplit（横向/Side-by-side）/ scDiffUnified（纵向/Unified）。

**测试**：node --check 通过；test-client-render.cjs 新增 7 项断言（按钮存在且未按下→点击后 split 网格出现、hunk 头保留、-world/+hello 正确配对到 del/add 格、aria-pressed 翻转、再点回 unified），合计 77/77 PASS；smoke.mjs、test-sc.mjs 27/27、test-usage.mjs 23/23 全绿。

## v0.7.8（2026-11-24）

### 图标对齐修复

用户实测 v0.7.7 后反馈：「图标和文字相距过近，中线还不对齐，这图片都快飘天上去了」。根因：`icon(glyph, className)` 的包装 `<span>` 在未传 className 时无任何 display 规则，内嵌 `<svg>` 作为 inline 元素骑在文本基线上——基线下方还留着 descender 空隙，视觉上图标整体上飘、与旁边文字中线错位；且 scMini 的 `gap:4px` 偏紧。

- `client.js` icon()：未传 className 时默认 `dsh-tools-scIco`（全部 8 处无类调用点一次性受益：标题行两个更新按钮、刷新、分组头三图标、AI 生成、标题图标；chevron 自有 scChev 类不受影响）。
- CSS：`.dsh-tools-scIco{display:inline-flex;align-items:center;justify-content:center;flex:none;line-height:0}` + `.dsh-tools-scIco svg{display:block}`——svg 变块级、无基线问题，真正光学居中。
- scMini `gap:4px→6px`。

**测试**：node --check 通过；test-client-render.cjs 71/71、smoke.mjs 全绿（新增默认类不破坏既有断言）。

## v0.7.7（2026-11-24）

### 面板设计/交互优化（用户：「使用skill进行页面设计和交互优化」）

用 ui-ux-pro-max 的 design_review 对面板做针对性评审（桌面端、源控面板场景），按严重度逐条核对落地：

**无障碍（评审严重级）**
- 所有图标按钮（标题行刷新、分组头 更新代码/更新数据库/推送）补 `aria-label`（此前只有 title，读屏不可靠）。
- 分组折叠按钮补 `aria-expanded`；勾选框补 `aria-label`=文件路径；批量进度/摘要行补 `role="status"`（隐式 aria-live=polite，进度与最终摘要可被播报）；面板根补 `aria-busy`（加载中）。

**指针/反馈/焦点（交付前检查清单）**
- 此前按钮一律 `cursor:default`（视觉上不可点的错误信号）——scIconBtn/scMini/scGroupHeadMain/scFileMain 全部改 `cursor:pointer`，并统一加 120ms color/bg 过渡 + `:active:not(:disabled)` 按压态（背景加深，无布局位移）+ `:focus-visible` 焦点样式（scIconBtn 原有，scMini/scGroupHeadMain/scFileMain 本次补齐）。
- scMini 高度 22→24px（WCAG 2.5.8 web 24px CSS 最小命中尺寸；scIconBtn 26px 已达标）。

**分组辨识度与列表性能**
- 标题行「更新代码/更新数据库」对与刷新按钮之间、分组头「全选/清空」与图标簇之间，加 1px 竖分隔线（`scVDiv`，主题边框色，aria-hidden）。
- 文件行 `content-visibility:auto; contain-intrinsic-size:auto 26px`——大仓库（数百变更行）时跳过视口外行的渲染/布局，Chromium/Electron 生效。

**防误触**
- 加载期间（repos===null）标题行刷新按钮 disabled，防止连点重复触发全量扫描（加载态本身已有可见反馈）。

**评审中核对过、无需改动的项**：loadAll 的 per-repo sc.status 已是 Promise.all 并行（并行拉取规范已达标）；状态徽标字母+颜色双通道（颜色非唯一指示）；「AI 生成」按钮文案已明示 AI（disclaimer 达标）；每仓 busy 时组内全部动作按钮已 disabled+note 反馈（加载指示达标）。虚拟长列表（>50 行 FlatList 级别）未做——面板以分组折叠为常态，content-visibility 已覆盖渲染成本，不引入虚拟化复杂度（刻意取舍）。

**测试**：node --check 通过；test-client-render.cjs 71/71、smoke.mjs、test-sc.mjs 27/27、test-usage.mjs 23/23 全绿（新增 aria 属性与分隔线不破坏既有断言）。

## v0.7.6（2026-11-24）

### 布局调整：两按钮并入标题行（用户：「你这按钮布局也太丑了，就不能放刷新按钮旁边吗」）

- 「更新代码」「更新数据库」两个批量按钮从独立 `scUpdateBar` 行（标题行与仓库列表之间、带边框占一整行）**移入 `scHeader` 标题行**，位于刷新图标按钮左侧；标题 `flex:1` 撑开，按钮靠右成组。
- 批量进度（`更新代码 2/5…`）与摘要（`代码已更新 4 · 跳过 1 · 失败 0`）改用**条件渲染的细行** `scNoteRow`（6px 内边距、次级文字色、超长省略），空闲时整行隐藏——默认视图回到 v0.7.4 的干净样子。
- CSS：`scUpdateBar` 规则删除，新增 `scNoteRow`；`scBatchNote` 去掉 `flex:1`（不再与按钮同行瓜分宽度）。
- 同轮排障记录：用户重启后看不到 v0.7.5 按钮——**插件在 profile（`C:\Users\<user>\.dsh\profiles\<profile>\node_modules\dsh-tools`）是独立拷贝而非源码链接**，改工作区源码对已安装副本无效；须 `plugin_manager` remove_bundle + install_bundle 重装（本次实证 v0.7.0→v0.7.5 `application: applied`，副本核实 MODULE_VERSION/sc.pull/scUpdateBar 均在位）。以后凡改完源码必须重装进 profile 再让用户 F5。
- 测试：node --check 两入口过；test-client-render.cjs 71 项 PASS（scMini/scBatchNote 类名未变，顶栏两按钮/批量扫全部/摘要断言原样通过）。

## v0.7.5（2026-11-24）

### 资源控制：更新代码 / 更新数据库按钮（用户 m00001：要求在「最上方和每个分组的右边」加两按钮）

- 入口两处：① **面板顶栏**（标题行与仓库列表之间新增 `scUpdateBar`）——「更新代码」「更新数据库」两个按钮对**全部仓库**顺序批量执行，按钮旁实时显示进度（`更新代码 2/5…`），完成后显示摘要（`代码已更新 4 · 跳过 1 · 失败 0`，工作区切换自动清除）；② **每个分组头右侧**——两个图标按钮（下载/数据库图标，title 提示完整命令）只对该仓库执行，与原 push 按钮并排。批量进行中或任一仓库忙时所有入口禁用。
- **更新代码** = `git pull --rebase --autostash`（沿用既有 `runGit` argv 数组通道，5 分钟超时）；**更新数据库** = `pnpm run prisma:generate` → `pnpm run prisma:push`（10 分钟超时，读仓库 package.json scripts，按序只跑存在的脚本）。
- 语义细节：两脚本都不存在的仓库批量时计为「跳过」（busy note 显示「无 prisma 脚本，已跳过」），不会报错；单脚本失败即停并回传 `pnpm-error`（details 带 script 名）；Windows 下经 `cmd.exe /d /s /c` 启动 pnpm（.cmd shim 无法 CreateProcess 直启），脚本名为常量无注入面；成功后自动刷新该仓库状态。
- Host 侧新增 RPC：`sc.pull` / `sc.prisma`（METHODS 表分发，`requireScRepo` 校验绝对路径 + .git）。
- 测试：test-sc.mjs **27/27**（+8：无远端 pull→git-error / 真实 origin upstream 场景 pull 后 log 含上游提交且 autostash 保住本地脏改 / 无 scripts→no-prisma-scripts / echo 脚本两连跑 ran 数组正确 / 单脚本只跑一个 / 失败脚本→pnpm-error / 非绝对路径 bad-request）；test-client-render.cjs **71/71**（+7：分组两按钮存在并带 repo 路径调用 / 顶栏两按钮 / 批量扫全部仓库 / 摘要文案）；smoke 33、test-usage 23 回归过。
- 测试踩坑（记录防复发）：render 桩的 `runEffects()` 每步无条件重放 mount effect→`loadAll()`，其开头的 `setBatchNote('')` 会清掉批量摘要——产品代码正确（真 React 仅在工作区切换重跑该 effect），测试改为在 runEffects 前 `tree = render()` 采样断言（已加注释）。

## v0.7.0（2026-11-23）

### 今日 Token 用量（侧栏底部组件）

- 侧栏左下角（账号行上方）`sidebar.footer.action` 注册「今日」小条：一眼显示当日总 token（输入+输出+缓存读+缓存写，`1.23M` 风格格式化）；点击弹出明细 popover——分项占比条（输入/输出/缓存读/缓存写）、近 7 天迷你柱状图（今日高亮）、请求数/活跃会话数 meta 行、更新时间+手动刷新。侧栏收起为图标栏时缩为 32×32 图标钮。`featureFlags.usage` 开关 + 工具设置面板对应项。
- Host 侧 `usage.today` RPC：语义与 `dsh-token-meter` 的 `tokenUsage` 投影（stateVersion 2）完全一致——同一 usageOf 提取（assistant/message data.usage，否则流内最后一个 'usage' chunk）、同一 addReplacing 对 (turn, step) 的结算、同一 llm/retry-started 槽关闭——扩展点：桶归因到提交事件的**本地日历日**（跨午夜正确切分）。数据来自 `sessionQuery` 服务（listSessions+readSession，逐条校验克隆）；每会话增量 checkpoint（只折叠新事件），`USAGE_FRESH_MS` 限频缓存；force 绕过缓存并修剪死会话；14 天系列保留。
- 客户端 SWR store：先展示过期数据再后台 revalidate；点击/切回标签页/每 5 分钟刷新；30s 读缓存。
- 测试：新增 `scripts/test-usage.mjs` 22 项（纯折叠语义：替换记账/重试槽/跨午夜切分/垃圾容忍/增量 checkpoint/日期修剪 + 路由级 fake sessionQuery：增长/死会话修剪/缓存窗口/force 绕过）；test-client-render.cjs +13（chip 注册/宽+rail 两态/popover 分项/图表/meta/Escape/销毁）。

### 常用语条卡片定位修复（用户 m04174：「提示词直接消失了」）

- 现象：v0.6.7 部署 + 用户重启后，常用语条整个不渲染（截图证实输入框上方无 pill）。
- 根因：v0.6.7 `attachBootstrap` 用固定「向上两级」假设（`node.parentElement.parentElement`）找 composer card；而 Cordis slot 渲染器经 RootEntry/entryKey 渲染条目，overlay 条目与 anchor 之间**存在包裹层级**——两跳落到了 anchor 上而非 card → `card.querySelector('[contenteditable]')` 落空 → `insertRow` 静默返回，行永不插入。
- 修复：`attachBootstrap` 改用 `node.closest('[data-composer-card]')`（生成/优化按钮同款、生产验证过的选择器）定位 card，closest 不可用/落空再回退两级上跳。其余（编辑器宿主爬升 insertBefore、MutationObserver 重插守卫、store 订阅）不变。
- 测试：test-client-render.cjs 步骤 7 的 fake DOM 链加 slot-entry wrapper 层（span→wrapper→anchor→card）+ `fakeSpanEl.closest` 返回 fakeCardEl——wrapper 层正是 v0.6.7 假设破裂的回归防护。
- 测试：render 59 项（+13 usage +wrapper 链）、test-usage 22 项、smoke 32、test-sc 20、two-stage 回归过。

## v0.6.7（2026-11-23）

### 常用语条改「卡片内文档流」（用户 m03888：「重启了，感觉没变化啊」）

- 背景：v0.6.6 把悬浮条改成官方 `bottom:100%`+gap 定位并加了弹层避让——热替换+重启后用户仍无感。数学复盘：`top:0;transform:translateY(-100%)` 与 `bottom:100%` 都把 pill 行底边放在卡片顶边，仅 padding 7→8px 差 1px；避让修复只在弹出层打开瞬间可见。**结论：悬浮方案本身是问题——换位置，不再调间距。**
- 槽位调研（决定性，`dsh-client-ui-conversation` 源码）：composer 槽位全景=`conversation.input.attachments`(**single** 槽，插件注册会顶掉官方附件 UI，不可用)/`overlay`(list，即悬浮带)/`left`/`right`(list，但在底部操作行)/`permission`/`plan`/`model`/`activity`(single)/`composer.dock`。**不存在「卡片内输入框上方」的官方 list 槽** → 文档流位置只能自取。
- 方案（纯 DOM 注入）：overlay 槽注册一个隐形 bootstrap `<span>`（`PhrasesHost`，`display:none` + `aria-hidden`）；ref 回调 `attachBootstrap` 从 span 爬到 composer card（`anchor.parentElement.parentElement`），在 card 内找 `[contenteditable="true"]` 沿 parentElement 爬到 card 直接子节点，`insertBefore(rowEl, host)` 把 pill 行插到输入区正上方、随文档流。React 不碰外来节点；`MutationObserver(card childList)` 在 React 重渲染丢节点时自动重插（`rowEl.parentElement!==cardEl` 才插）。hero 态（无编辑器）静默跳过。
- pill 行=纯 DOM（`document.createElement` + `addEventListener`，不经 React/ReactDOM）：`phraseStore.subscribe(syncPills)` 驱动重建（`replaceChildren`）；0 条或 flag 关→`display:none`；点击→`insertPhraseAtCaret`（不变：card→contenteditable→focus+`execCommand insertText`）。清理：ref(null)/槽注销→移除行+退订+断开 observer。
- CSS：`.dsh-tools-phraseBar{display:flex;gap:6px;padding:6px 12px 0;overflow-x:auto;scrollbar-width:none}`（去 absolute/bottom/z-index/is-hidden）；pill 样式沿用 v0.6.6 的 a11y 三件套。
- 测试排障记录（本轮唯一深坑）：面板保存回程两项 FAIL——DBG 探针显示保存后 store 收到 `[]` 而非保存值 → 根因在 **test-client-render.cjs 的 call 桩 `(stubs[method] ?? …)()` 调用 stub 时不传 payload**，echo 型 `settings.set` 桩恒见 `payload=undefined` 回 `[]` → 修复为 `(stubs[method] ?? …)(payload)`。两个探针（client.js phraseStore.set/syncPills + 测试内 DBG 行）已全部移除。
- 测试：test-client-render.cjs 重写步骤 7（bootstrap ref 手动触发+fake DOM 链（fakeCardEl.querySelector→fakeEd→fakeEdHost）/行插在编辑器宿主前/2 pills/点击插入/守卫 observer 重插/ref(null) 卸载）+ 8b 面板回程（删 1 条保存→行缩到 1 pill→删空→行隐藏→再加→重现）46 项过；smoke 32、test-sc 20、two-stage 回归过。

## v0.6.6（2026-11-23）

### 常用语条重叠修复（用户 m03747：「这个地方会有重叠」——pill 压输入容器顶边、与弹出层共带冲突）

- 根因（源码实证 `dsh-client-ui-conversation` InputBar.module.css）：`[data-composer-overlay]` 锚点是钉在 composer 卡片顶边的零高绝对条带，官方注释明确该条带同时是 **menu / popupSelect shell**——条目约定 `bottom:100% + gap` 定位。v0.6.4 用 `top:0; transform:translateY(-100%)` 且永远占带：视觉上压卡片顶边，且斜杠菜单/弹出选择器打开时必然重叠。附件预览在卡片内独立 slot（`conversation.input.attachments`），与本条无关。
- 修复三件套：
  1. **官方定位**：`bottom:100%` + `padding-bottom:8px`（去 transform，严格按官方约定留 gap）；
  2. **弹层避让**：稳定 ref 回调 `attachBarNode` 向上找 `[data-composer-overlay]` 锚点，`MutationObserver(childList)` 监听锚点兄弟节点——出现非自身元素节点（弹出 shell）→ 整条 `display:none`（渲染 `is-hidden` 占位 div 保住 observer 生命周期，不能 return null 否则无法感知弹出层关闭）；弹出层移除 → 自动恢复；
  3. **a11y/交互**（ui-ux-pro-max design_review 清单）：pill 加 `aria-label` 全文（截断披露）、独立 `:focus-visible` outline、`cursor:pointer`（原 default 是 bug）、`:active` 按压反馈。
- 测试：test-client-render.cjs +4（MutationObserver 桩升级为记录实例+手动 trigger；锚点观察建立 / 兄弟弹出→is-hidden 且无 chips / 移除→恢复 / ref(null) 卸载断开 observer）40 项过；smoke 32 项、test-sc 20 项、two-stage 回归过。
- 设计审查：按用户要求经 ui-ux-pro-max skill 跑 design_review（desktop），非相关规则（RSC/AI disclaimer 等）不适用已说明。

## v0.6.5（2026-11-23）

### SC 层级污染修复：客户端根与 registry 互斥（用户 m03593：「层级不对啊，我现在项目是在一个没有git的项目中，然后你在右边打开显示的是上层的同级目录结构」）

- 根因（两层叠加）：①client `scClientRoots()` 除主视图行外还兜底收集「其余行」cwd（cap 4）→ 同窗口侧栏其他会话的 cwd（personal、AICX-V3、Elioo…）全被当根；②host `collectScRoots` 无条件叠加 workspace registry（= 本机所有工作区目录）。用户在 reader 工作区（非 git 项目）→ 面板显示父级兄弟项目。
- 修复：client 根 = **仅主视图会话 cwd（单根）**；host = 客户端有根时 EXCLUSIVE（完全跳过 registry），无根才回退 registry（host-only/无头调用）；settings 自定义根永远合并（用户显式配置）。目录事实核查：reader 无 .git、app/design 均非 git → 修复后 reader 工作区面板为空态（正确语义）；截图「dsh-tools×2」实为 dsh-tools + dsh-im-notify（OCR 误差），无重复 bug。
- 附带：`waitForSessions`（热更新后 sessions 捕获竞态，最多 2s/50ms 轮询，服务已捕获时零开销——否则会平移一个微任务导致面板加载时序变化，渲染测试捕捉到该回归）；面板经 `list.subscribe` + `useSyncExternalStore` 订阅 sessions store，主视图会话/工作区切换自动重扫；空态显示实际扫描根（host 响应 `value.roots`）。
- 测试：test-sc.mjs +3（假 registry 注入 `fiber.cb({workspaceRegistry:…})`：有 hint 时 regRoot 仓不出现/无 hint 时出现/capture fiber 存在）20 项过；test-client-render.cjs 改造 sessions stub（mainView 行 cwd=reader + 普通行 cwd=personal → payload.roots===['D:/Workspace/personal/reader']，快照对象固定引用避免 useSyncExternalStore 不稳定）36 项过；smoke 32 项、two-stage 回归过。

## v0.6.4（2026-11-23）

### 常用语悬浮条（用户 m02760：「在输入框上方悬浮一些常用语……支持编辑，最多展示5个，我一点击某个框，就把对应的语言添加到输入框光标后面」）

- 挂载点：slot `conversation.input.overlay`（composer card 内首个子元素 `[data-composer-overlay]`，CSS `height:0;position:absolute;inset:0 0 auto` 的零高锚条）；chips 行 `position:absolute;top:0;transform:translateY(-100%)` 悬浮在输入框上方（card 无 overflow/contain 裁剪，探针实证）。
- 插入语义：`insertPhraseAtCaret` = 找 card → `[contenteditable]` → `focus()` → `execCommand('insertText')`（**不 selectAll**，即插入光标处而非整体替换，与「生成/优化/历史」的替换语义不同）；失败兜底 beforeinput InputEvent。
- 条数上限：`PHRASES_MAX=5`、单条 `PHRASE_MAX_LEN=200`；host `normalizePhrases`（trim/截断/去空/去重/cap 5）在 `settings.set` 与落盘合并两处生效；0 条或开关关闭时整条隐藏。
- 编辑：工具设置面板新增常用语编辑区（逐行 input + 移除 + 添加，满 5 禁用），保存经 `settings.set {phrases:[…]}`；模块级 `phraseStore`（`useSyncExternalStore`）保存后即时刷新所有 composer 的悬浮条。
- 开关：`featureFlags.phrases`（默认开）+ 工具设置新增独立开关。

### 热替换根因修复：teardown 必须经 ctx.effect 注册

- 决定性证据：对线上 `/api/dsh-tools` 直接 POST `dev.ping` → `Unknown method: dev.ping`（dev.ping 为 v0.6.1 新增）→ **实际服务的仍是 v0.6.0 fiber 的路由**；三次「热替换」（v0.6.1/2/3）只是导入了新模块（module loaded 日志 + captures），路由注册权从未移交。
- 根因：apply() 一直用「返回值当清理函数」，Cordis 停 fiber 只调用 `ctx.effect()` 注册的 disposer，返回值被忽略 → 老 fiber 停止时 webServer/fetch 路由不注销 → 新 fiber `register` 同名路径抛「重复」被 try/catch 静默吞掉 → 永远老代码服务。旁证：dsh-im-notify/dshmarket 都用 `ctx.effect` 注册。
- 修复：apply() 的 composite teardown（stopHmr→stopRegistry→stopSelector→stopLlm→stopFetch→stopRoute，幂等 guard）改为 `ctx.effect(() => teardown)` 注册（无 effect 的测试桩仍走返回值兜底）；路由 mount 成功/失败均 debugLog（`webServer route mounted` / `FAILED`）。
- 影响：v0.6.4 起热替换真正生效（今后 install → 重载插件即可完整换代）；**本次上线仍需一次重启**——现网 v0.6.3 fiber 是老式清理，其路由只能由重启清除。

### 资源控制分组默认折叠（用户 m03007：「打开资源控制页面的时候默认所有栏目关闭状态」）

- ScPanel 折叠态反转为展开态：`collapsed[repo.id]===true` → `expanded[repo.id]===true`（默认全部折叠，仅用户显式展开的仓库打开）；chevron/文件区逻辑同步翻转。
- 测试：test-client-render.cjs 新增「repo group collapsed by default」→ 点击组头展开 → 文件行出现，全套重跑通过。

### v0.6.4 测试与部署

- smoke.mjs 32 项全过（新增：phrases 归一化/落盘持久化、ctx.effect teardown 注册与幂等）；test-client-render.cjs 36 项全过（phrase bar 注册/chips 渲染/光标插入（无 selectAll）/编辑区/添加钮）；test-sc.mjs 17 项、test-two-stage.cjs 回归过。
- package.json 0.6.4；locale zh/en、README、REPORT、DETAIL 同步。

## v0.6.3（2026-11-23）

### SC 空列表修复：客户端工作区根提示

- 现象（用户 m02627）：面板显示「未发现 git 仓库」——debug log 证实 `sc.repos → ok` 但结果为空：根列表为空。源码核查 `@deepseek-ai/dsh-workspace`：`workspaceRegistry.list(): Workspace[]` 记录字段确实是 `.path`（zod `workspaceRecord = {path, title, sessionIds, createdAt, updatedAt}`），但 Web Host 里该 registry 可能未启动（`requireState()` 会 throw，旧代码静默吞掉）或为空 → 根列表空。
- 修复（双保险）：① **客户端根提示**——client 运行时捕获 `sessions` 服务（子 fiber，v0.2.0 教训：不静态 inject），`scClientRoots()` 读 `sessions.list.getSnapshot().byId`（与官方 workspace UI 同一数据源：主视图会话 `retainedBy.mainView>0` 的 `cwd` 优先，去重 cap 4），随 `sc.repos` 请求作为 `payload.roots` 发送——用户所在工作区永远被扫描，无论宿主 registry 状态；② host `collectScRoots(clientRoots)` 合并顺序=客户端提示→registry（异常时 debugLog 记录原因，不再静默）→settings 根；`SC_MAX_CLIENT_ROOTS=4`，非法提示（相对路径/非字符串）过滤。
- 层级语义（回应用户「先判断是不是单独项目，没有再深入一层」）：`scanForRepos` 本就先测根目录自身 `.git`（是 repo 即收、不再下钻），否则逐层下钻（3 层）——大工作区含多个子 git 项目正是该模型。
- 观测性：`sc.repos` 每次记录 `roots=N (paths) repos=M` 到 debug log。
- 测试：test-sc.mjs +2（客户端提示独力发现 repo / 非法提示忽略）17 项过；test-client-render.cjs +2（sessions fiber 请求 + sc.repos 收到 cwd 提示）28/28 过；smoke 27 过。

## v0.6.2（2026-11-23）

### SC 入口迁至右侧「开始」工具栏

- 背景：用户 m02352（截图红框）——「谁让你加左边侧边栏，我不说了在右侧工具栏吗，和工作区文件这些统一级别的」。
- 源码调查（决定性）：开始页按钮列表（工作区文件/新建终端/浏览网页）**不是 slot**，来自 **`sidebarRightTabs` 服务**（右栏包 `ctx.reflect.provide('sidebarRightTabs', tabs)` 的 SidebarRightTabRegistry）；各功能包注册 tab 类型时带 `guide` 数组（files=`{id:'workspace',order:10,...}`，terminal=order:20，browser 同构）；`refresh()` 把 active 定义 flatMap 成 guideEntries 按 order 排序；GuideBody 对每个 entry `renderSlot('sidebar.right.tab.guide.entry',...,{fallback:<EntryBox/>})`——**标准卡片+点击 openTab(kind) 全自动**。`RANKS={extension:3,builtin:2,fallback:1}`，第三方缺省=extension。tab 打开按类型 id dispatch `sidebar.right.pane.tab`（keyed）。
- Client（`client.js`）：运行时子 fiber 捕获 `sidebarRightTabs`（v0.2.0 教训：不静态 inject，缺席=pending 不炸）；`syncType()` 在 `featureFlags.sc` 开且服务可用时 `tabsService.register({id:SC_TAB_TYPE_ID('dsh-tools-sc'), kind, title:()=>t('sc'), guide:[{id:'sc', order:5, title, description:()=>t('scGuideDesc'), icon:ScGuideArt}]})`（order:5=列表最顶）；body 注册 `ctx.slots.inject('sidebar.right.pane.tab', ()=>ctx.slots.register({name:'sidebar.right.pane.tab', key:SC_TAB_TYPE_ID}, ScPanel))`；ScPanel 改造为 tab body（挂载即 loadAll，height:100%，去抽屉/关闭钮/Esc）；删旧 `sidebar.footer.action` 入口与 `shell.overlay` 抽屉、store/useOpen；flag 关或卸载时 dispose 类型注册（guide entry 即消失）。**注意 MAX_DESCRIBED_ENTRIES=4**：第 5 个 entry 会让所有 entry 的 description 隐藏（平台规则，接受）。
- 测试：test-client-render.cjs 重写断言（fakeTabs 注册表/slots 记录 key 注册）**26/26 过**——踩坑：render 是组件本体非 thunk，须 `materialize(react, react.createElement(paneTab.render,{}))` 包 element 走 hooks 上下文；runEffects 后需再 render() 取新树。smoke 27 项、two-stage 回归过。
- 部署：install_bundle github 源（v0.6.1 实证 install 自动热替换 Web Host，无需重启）→ F5 生效。

## v0.6.1（2026-11-23）

### 重载插件（热重载，不打断会话）

- 背景：用户反馈「为什么每次都要重启，其他任务都被停掉了；开发 dsh-im-notify 时没有这种情况」。源码调查：DSH 自带 HMR（`@deepseek-ai/dsh-hmr`）——`reconcileProfile()`（须在 `runExclusive` 内）recompose profile 并**热替换加载文件变化的运行中插件**；plugin-manager 的 install/开关即走此路径。此前必须重启是因为：① Web Host 只在启动时从磁盘加载插件代码；② v0.2.1 实证会话 Host 的 set_plugin 热重载不作用于 Web Host；③ 早期版本改了 link 包代码但 profile manifest/patch 未变，无人触发 reconcile。
- Host（`index.js`）：`dev.ping`（返回 `{version: MODULE_VERSION, pid}`——版本变化即热替换成功的证据）与 `dev.reconcile`（运行时捕获 `hmr` 服务→`hmr.runExclusive(() => hmr.reconcileProfile())`；**setTimeout(0) 异步执行**——自替换会停掉正在应答 RPC 的 fiber 吞掉回复，必须先回 `{scheduled:true}`；结果写 debug log：restartReason/pending/warnings）。`hmr` 缺席→`hmr-unavailable` 错误。
- Client（`client.js`）：「更多」菜单 idle 态两项=**重载插件**（旋转箭头图标，info 色 hint）+分隔线+原**重启 DSH**（⚠ warn hint）；`doReload()`=`dev.ping` 记 versionBefore→`dev.reconcile`→14×700ms 轮询 `dev.ping` 直到 version 变化→done（附「F5 后界面完全生效」提示行）；路由重注册窗口 RPC 可能瞬断→catch 继续轮询；超时→`reloadUnknown`。busy/done/error 按 `menuMode` 区分文案与图标。
- 测试：smoke 扩至 26 项全过（dev.ping 形状/无 hmr→hmr-unavailable+details 合法/fake hmr→scheduled 立即返回+reconcile 异步真跑）；client 渲染 22 项、two-stage 回归过。
- **新部署协议**：今后更新插件默认走 install→「重载插件」（或 Web Host 文件监听自动 reconcile），不再未经用户同意重启应用；重启仅保留给 reconcile 报 `restartReason`/`pending` 或 DSH 核心更新的场景。

## v0.6.0（2026-11-23）

### 资源控制（Source Control）

- 入口：`sidebar.footer.action` slot 图标按钮（aria-pressed，点击开/收）；面板：`shell.overlay` slot 右侧抽屉（min(440px,92vw)，200ms 滑入，Esc/再点收起，`useSyncExternalStore` 外部 store）。
- Host（`index.js`）7 个方法：`sc.repos`（扫描根=workspaceRegistry.list()+settings.sc.roots，BFS 3 层，SKIP 目录不下钻，遇 `.git` 即收）、`sc.status`（`status --porcelain=v1 -z` 自研解析：XY→A/M/D/R，R/C 双记录=当前路径+orig，`??`→A 未暂存，`!!` 忽略；分支 `rev-parse --abbrev-ref HEAD`）、`sc.diff`（tracked=`diff HEAD --`，untracked=合成全 `+` 新文件 diff——`ls-files` 判 tracked 抗陈旧；cap 80k）、`sc.log`（30 条 subjects）、`sc.commitMessage`（最近 20 条 subjects 作风格参考 + 选中文件逐个 diff（单文件 6k/总量 20k 预算）→ `runAssist('commit')`）、`sc.commit`（message 1–500 字符校验 → resolveSelection 以**新鲜 status** 精确匹配 → `add -A -- <paths>` + `commit -m -- <paths>` pathspec 限定部分提交，未选改动不动 → 短哈希）、`sc.push`（120s 超时）。
- 安全：`requireScRepo`（绝对路径+目录+.git）；`validateScFile`（拒 NUL/`-`开头/绝对路径/`..`·`./`；resolve 防逃逸）；commit 时文件必须是当前工作副本变更（防 TOCTOU）。
- Client（`client.js`）：`ScPanel` 按仓库分组（组头=折叠 chevron+仓库名+分支 chip+计数+全选/清空+推送），文件行=checkbox+状态徽标（A 绿/M 蓝/D 红/R 黄，字母+颜色双编码）+点击展开 diff（+/-/@@ 染色）；勾选后组脚 commit bar（textarea 可编辑 + AI 生成 + 提交）；busy/note/error 独立行（不随选择清空闪没）；`featureFlags.sc` 门控。
- 设置扩展：`settings.section` 面板加「资源控制扫描根目录」编辑器（`uiWorkspace.pickDirectory()` 原生目录选择 + 逐个移除），随 settings.set 持久化 `sc.roots`（cap 32）。
- 测试：**test-sc.mjs 15 项全过**（真 git 临时仓：扫描跳 node_modules/status M/A/D/R+orig/parsePorcelain 单测含 `!!` 过滤/diff tracked+synthetic+穿越拒绝+缺失文件优雅回退/部分提交隔离验证/sc.log/commitMessage 提示词含历史风格+选中 diff+路由模型/push 无远端 git-error）；**test-client-render.cjs 22 项全过**（VM+MiniReact 渲染：入口/抽屉/分组/徽标/diff/勾选/commit bar/AI 生成/提交只含选中/推送/Esc）；smoke 24 项、two-stage 回归过。
- 踩坑记录：git porcelain v1 `-z` 重命名记录顺序=**当前路径在 XY 记录内、orig 是下一个 NUL 记录**（probe 实证）；未暂存的 rename 在 status 中不配对（` D`+`??`）——配对只发生在 index；渲染测试 effects 闭包陈旧→step() 必须 render→runEffects→render。

## v0.5.0（2026-11-20）

- **优化按钮**：`conversation.input.right` 第二个注册（order:11，魔法棒图标）；读 composer 文本 → Host `optimize`（OPTIMIZE_SYSTEMS：明确目标/补上下文约束/可分点/不改意图语言选型/保留标识符；maxTokens 900）→ 结果写回输入框。生成/优化共享 `assistBusy` 互斥，期间 composer 锁定（`data-dsh-tools-locked` + contenteditable=false），完成/失败解锁。
- **工具设置面板**：`settings.section` slot（order:23）。四功能开关（含新 sc 前为三项）；模型自定义=跟随默认 / provider+model 级联选择（`models.list` 归一目录）；持久化 `<DSH_HOME>/integrations/dsh-tools/settings.json`（原子写；DSH_TOOLS_HOME 测试逃生门）；半覆盖（只填 provider）拒绝 bad-request。模型覆盖用于 suggest/optimize/commitMessage 三处（`resolveAssistRoute`：覆盖→`agentDefaultModel.currentSelection()`）。
- 测试：smoke 24 项全过（新增 8 项：settings 默认/半覆盖拒/落盘/optimize 覆盖模型/空输入/models.list 归一）。
- 事故记录：PS 5.1 `Set-Content -Encoding UTF8` 给 package.json 写入 BOM → 安装时 JSON 解析炸；修复=[System.IO.File]::WriteAllText+UTF8Encoding($false)，一律用 .NET API 写文件。.git 再次被掏空（复发问题），既定流程恢复（init→fetch→reset --soft→**git add -A**→commit→push）。


## v0.4.0（2026-11-19 19:3x）

- `client.js` 新增 `registerHistoryNavigation()`：document 级 keydown **捕获阶段**监听（capture:true + preventDefault + stopPropagation 压过 Lexical）；`readHistory()` 每次按键实时查询 user 行；`isCaretAtVeryStart()` 沿 firstChild 链找首个文本节点判定光标在最前；`loadInto()`=selectAll+insertText+InputEvent；指针语义：null=活草稿位，进入历史模式时暂存 draft，任何非↑/↓键即退出（不恢复草稿，用户接管）；IME 组合中/修饰键不拦截。
- 无 Host 改动、无新增文案（静默功能）。package.json 0.4.0。
- v0.4.1：修复 index.js 模块加载日志的版本串（一直打 v0.3.0，今晚排障时造成误读）。
- v0.4.2：刷新插件页描述（旧文案还写「点击后会先确认」，且未提生成/历史两个新功能）；仓库 git config 固定 credential.github.com.account=NecroDriver（GCM 不再弹账号选择）。

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
