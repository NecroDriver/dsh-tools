# dsh-tools 交付报告（2026-11-23，v0.6.6）

## 状态

- 插件 `dsh-tools` v0.6.6 编码/测试完成，待安装（**github:NecroDriver/dsh-tools git 安装**）。v0.6.5 已上线验证：重启后 `webServer route mounted`（无 duplicate——ctx.effect 修复生效）、`sc.repos roots=1` 随会话切换、用户已配置两条常用语。
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
- v0.6.6：**常用语条重叠修复**（官方 `bottom:100%`+gap 定位 + 弹层避让）+ a11y（aria-label/focus-visible/pointer/按压反馈）（见下节）。

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
