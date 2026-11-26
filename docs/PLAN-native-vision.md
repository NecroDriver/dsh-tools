# dsh-tools「视觉直通」方案（原生图片输入直通）

- 版本：v1（方案评审稿，未实施）
- 日期：2026-11-26
- 需求来源：用户截图 + 原话（m00001）——「参考modlens插件，在dsh-tools里面增加dsh优化。当我选择独立视觉模型，比如GLM5.4时，输入框是不支持图片预览、删除等这些功能，只能把路径靠进来，用起来很麻烦。先出方案」
- 实施容器：`D:\Workspace\personal\dsh-tools`（v0.7.11，Host=index.js / Client=client.js）

## 0. 一句话结论

**根因不在客户端，而在模型目录声明**：用户 pty 路由（newapi 网关）的 `models[]` 条目没有 `input` 字段，pi-ai 按 `DEFAULT_INPUT=["text"]` 判为纯文本，于是「modlens 粘贴劫持」+「发送准入拒绝」+「适配器流内硬门」三处一起封死图片。**修复 = 给该模型条目写入 `input: ["text","image"]`（2 行 YAML，全链路自动解锁，零客户端改动）**；dsh-tools 的价值是把它做成「视觉直通」一键功能（状态诊断 → configEditor 安全写入 → 声明守护），而不是让用户手改 profile patch。

## 1. 问题与场景

用户在 DSH Web GUI（http://127.0.0.1:8326）选择独立视觉模型（如 pty 路由的 `glm-5.4`，上游 newapi 网关实际支持图片）时：

- 粘贴图片 → 输入框里出现的不是缩略图，而是**一张图片的本地路径文本**（modlens paste-to-path 劫持）；
- 没有缩略图 → 也就没有**预览、删除、重试**这些原生附件 UX；
- 即使拖拽绕过劫持得到缩略图，**发送时**也会被 host 准入拒绝（`session/attachment-invalid` / MODEL_DOES_NOT_SUPPORT_IMAGES，toast「当前模型不支持图片，请切换支持图片的模型」）。

对照组：选 `glm-5.3 (modlens vision)` twin 时图片可用，但那是 modlens 视觉桥把图**转成文字证据**发给独立视觉引擎——不是把原图发给 GLM 本尊，且依赖外部引擎配置。用户要的是「独立视觉模型原生吃图」。

## 2. 根因分析（证据链）

### 2.1 原生图片链路与四道门

```
粘贴/拖拽/+  →  composer 附件条（缩略图/预览/删除 = 原生，不按模型 gating）
      ↓ paste 事件（capture 阶段）
[门1] modlens paste-to-path 劫持：宿主 verdict 确认所选模型 text-only → POST 字节→插入路径文本
      ↓ （未被劫持时）
发送 prompt → host admission
[门2] dsh-api-session-controller prompt()：resolveModelInfo().inputModalities 不含 "image"
      → RemoteError session/attachment-invalid { reason: MODEL_DOES_NOT_SUPPORT_IMAGES }
      ↓ （声明含 image 时）
dsh-llm 请求装配
[门3] dsh-llm/lib/index.js:2448：inputModalities 已知且不含 image → projectImagesForTextModel（图被投影掉）
      ↓ （声明含 image 时）
pi-ai 适配器
[门4] dsh-llm-pi-ai streamWithSnapshot：model.input（来自路由配置）不含 "image"
      → LlmError UNSUPPORTED_CONTENT；含 image → 图片按 20MiB/2048px 预算重编码上 wire
```

**门1 才是用户看到的「不能预览/删除」**：composer 原生 UX 本身与模型无关（`canAcceptDrop = !uploadDenied && !locked && !machineBusy && addFiles!==void 0`，不看模型；`imageLimits` 是静态全局投影）。modlens 在 capture 阶段劫持 paste，文件根本没进附件条。

### 2.2 模型为何被判 text-only（本机实况）

pi-ai 模型 input 数组解析链（`dsh-llm-pi-ai/lib/index.js`）：

```
input: declaredInput(entry.input) ?? base?.input ?? [...request.defaultInput]
```

- `models[]`/`modelOverrides` 条目的 `input` 字段缺失或空数组 → 问下一层；
- 安装目录（catalog）没有该模型 → 落到路由级 `defaultInput`，其 zod default = `[...DEFAULT_INPUT]`；
- **`DEFAULT_INPUT = ["text"]`**（@45934，注释明言：模型目录缺省按 text 对待，防止 provider 中途拒绝已入日志的消息）。

本机 `C:\Users\11934\.dsh\profiles\desktop\cordis.patch.yml` 的 llm-pi-ai 段：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      pty:                      # newapi.xyue.tech 网关，openai-completions
        models:
          - id: glm-5.3          # ← 无 input 字段 → text-only
          - id: deepseek-flash
          - id: glm-5.3-flash    # ← 上游原生多模态（2026-08-26 起），但声明 text-only
          - id: glm-5.4          # ← 用户痛点模型，同样 text-only
      elioo:                     # kdoo.ai 网关
        models: [ Coder, CoderMax ]
```

于是四道门全部按 text-only 生效：modlens verdict 判定可劫持（它要求「label 中出现的每个模型条目都确认 text-only」才 takeover），admission 拒发，pi-ai 流内抛错。

### 2.3 为什么 modlens twin 能用而原生不能

modlens wrapper（`dsh/index.js` registerWrapper :863）用 `llm.registerAdapter([providerId], …)` 注册 `modlens-pty` 组：twin 模型元数据声明 `inputModalities:['text','image']` → 门2/门3 解锁；stream 里 `convertImagesToEvidence()` 把图**转成文字证据**（走 modlens 引擎的独立视觉模型）→ 发给上游的 wire 消息里**没有 image blocks** → 门4 天然绕过。这是「文字桥」路线，不是「原图直通」。

**给「原图直通」试做同款 wrapper 会死在门4**：wrapper 声明 image 只解门2/门3；stream 转发 `llm.stream({provider:'pty',…})` 后，pi-ai `modelOf()` 从路由配置解析出 `input:['text']`，流内硬门直接抛 UNSUPPORTED_CONTENT。pi-ai 的 `model.input` 只认配置（settings 文档）与安装目录，插件层无 override 通道（DUPLICATE_ADAPTER 也不许顶替别人已注册的 adapter）。

**结论：pi-ai 路由的原图直通，唯一钥匙是配置层的 `input` 字段。**（DeepSeek 官方 adapter 另当别论——其模型元数据硬编码 text-only 且上游本就不吃图，不在本功能射程内。）

## 3. 证据索引（关键源码/配置坐标）

| 事实 | 位置 |
|---|---|
| 发送准入（门2）`inputModalities` 检查 + MODEL_DOES_NOT_SUPPORT_IMAGES | `dsh-api-session-controller/lib/index.js` prompt() admit（约 :921） |
| 请求装配投影（门3） | `dsh-llm/lib/index.js:2448` |
| 适配器流内硬门（门4） `containsImage && !model.input.includes("image")` | `dsh-llm-pi-ai/lib/index.js` streamWithSnapshot（@93944） |
| input 解析链 `declaredInput(entry.input) ?? base?.input ?? [...request.defaultInput]` | `dsh-llm-pi-ai/lib/index.js` resolveEntry（@33372） |
| `DEFAULT_INPUT = ["text"]` | `dsh-llm-pi-ai/lib/index.js`（@45934） |
| 路由 schema：`models[]/modelOverrides` 条目可声明 `input`；路由级 `defaultInput` | `dsh-llm-pi-ai/lib/index.js` profile zod（@48574/@49324） |
| `modelOverrides` 仅当路由**不**手列 models 时可用（catalog 默认模型合并 override） | `dsh-llm-pi-ai/lib/index.js`（@30421–31332） |
| providers 字段 `.volatile()`（原地热更新，不重启插件） | `dsh-llm-pi-ai/lib/index.js` Config schema（@49324 后） |
| modlens paste 劫持 + verdict 逻辑 | `@liustack/modlens/dsh/index.js` registerPasteRoute(:566)、pasteTakeoverVerdict(:486) |
| modlens wrapper 注册面（registerAdapter 调用形状） | `@liustack/modlens/dsh/index.js` registerWrapper(:863–981) |
| composer 原生附件条不按模型 gating | `dsh-client-ui-conversation/lib/client.js`（canAcceptDrop）+ `dsh-client-ui-attachment/lib/client.js` |
| 跨 entry 安全写配置 API | `ctx.get('configEditor')`；dsh-settings 的用法：`editor.entries().find(row=>row.options.id===ns)` → `editor.edit(entry, producer)`（`dsh-settings/lib/index.js` write() @20436/@20961；`@deepseek-ai/dsh-config-editor` README） |
| 用户实际路由（pty/elioo） | `C:\Users\11934\.dsh\profiles\desktop\cordis.patch.yml` llm-pi-ai 段 |

## 4. 目标 / 非目标

**目标**
1. 选 pty/glm-5.4（及其他启用模型）时：粘贴/拖拽出**原生缩略图**，可预览、可删除、可重试；发送后**原图**（经 pi-ai 重编码预算）直达上游模型。
2. 全程**零客户端代码改动**——解锁钥匙在 host 配置层，客户端原生 UX 自动恢复。
3. 与 modlens 共存不互踩：启用直通后 modlens 劫持自动解除（verdict 逻辑天然失效），modlens twin 仍可用于真·无视觉上游。
4. dsh-tools 内闭环：设置卡 UI + RPC + configEditor 安全写入 + 声明守护，遵循 dsh-doc 配置纪律（**禁止**插件自己改写 cordis.patch.yml）。

**非目标**
- 不做图片转文字的桥接（那是 modlens 的职责，已存在）。
- 不绕过/修改 DSH 原生 image limits（20MiB/2048px/数量上限照旧）。
- 不给 DeepSeek 官方 adapter 或安装目录（built-in catalog）模型做直通——前者上游无图，后者配置不可写（见 §8 边界）。

## 5. 候选方案对比

| 方案 | 做法 | 判定 |
|---|---|---|
| **A. 配置根修 + 一键 UX（推荐）** | dsh-tools 经 configEditor 给 pi-ai 路由模型条目写 `input:["text","image"]` | ✅ 唯一能过门4 的路；原生 UX 全自动恢复；可逆、可守护 |
| B. modlens 式直通 wrapper | `llm.registerAdapter` 建独立组声明 image，stream 原样转发 | ❌ **死在门4**：pi-ai 流内按**上游配置**的 model.input 硬门，wrapper 声明无效；modlens 自己也是为此才转文字证据（见 §2.3） |
| C. 纯客户端放开 UX | composer 侧不 gate | ❌ 死在门2：host 准入拒发；客户端 catalog 本就不暴露 inputModalities，无法预判 |
| D. 继续用 modlens twin | 现状 | ⚠️ 可用但非所求：图转文字证据发给桥接引擎，非原图直通 GLM 本尊，且依赖外部视觉引擎 |
| E. 手改 YAML | 用户自己给 models[] 加 input | ⚠️ 技术上即 A 的手工版；「麻烦」正是用户抱怨点，且无状态守护 |

**从 modlens 参考到的资产**（用户点名「参考modlens」）：门2/门3 的解锁钥匙是模型元数据声明 image（modlens 注释原文：*"This wrapper registers a NEW provider whose model metadata declares image input… that is how the wrapper unlocks admission"*）；verdict/劫持的自动解除条件（任一匹配条目含 image 即 veto）；`llm/adapters-updated` 事件 + activation 边界处理（`activationCanCommit`）；DUPLICATE_ADAPTER 容错。这些认知直接支撑了 A 的设计与其守护逻辑。

## 6. 推荐方案 A 详细设计：dsh-tools「视觉直通」

### 6.1 总体形态

dsh-tools 设置卡（settings.section「工具设置」，已存在）新增「视觉直通」区块：

```
视觉直通（原生图片输入）
  说明：为"上游实际支持图片、但 DSH 目录声明为纯文本"的模型补上 input 声明。
  启用后：粘贴/拖拽出原生缩略图（可预览/删除），原图直达模型；modlens 粘贴劫持自动解除。

  [provider ▾ pty]  [model ▾ glm-5.4]
  当前声明：text-only          [ 启用直通 ]   ← RPC vision.model.enable
  ─────────────────────────────
  已启用：
   pty / glm-5.4        image ✓   [ 禁用 ]
   pty / glm-5.3-flash  image ✓   [ 禁用 ]
  建议（疑似原生视觉）：glm-5.3-flash（glm-5.3-flash 为已知名原生多模态）
```

### 6.2 Host：RPC 面（扩展现有 dispatch 表，index.js:342 一带）

| method | payload | 返回/效果 |
|---|---|---|
| `vision.catalog` | `{}` | 遍历 `llm.listProviders()` + `listModels(provider)` + `resolveModelInfo(provider, model)`，返回 `[{provider, model, declared: 'image'\|'text'\|'unknown', patchable: bool, wrappedByModlens: bool}]`（llm 不可用时返回现有风格的 `llm-unavailable` failure） |
| `vision.model.enable` | `{provider, model}` | 经 configEditor 写入（见 6.3）；写入前先 `resolveModelInfo` 确认当前 text-only（幂等：已 image 则 no-op 返回 ok）；返回 `{applied, entry}` |
| `vision.model.disable` | `{provider, model}` | 移除该条目 `input` 字段（恢复缺省 text）；若无原值记录则删字段而非写 `["text"]`（保持 YAML 干净、回落链一致） |
| `vision.state` | `{}` | 复核全部已启用条目声明仍在（守护，见 6.5） |

现有基建复用：`captureService(ctx,'llm',…)`（index.js:1731）已捕获 llmService；RPC 双腿（webServer exact + connection.fetch）与 loopback/Sec-Fetch-Site 安全面原样复用；设置持久化 `getSettings/saveSettings` 增加 `visionPassthrough` 段（记录用户启用清单与启用时的原 input 值，供禁用恢复）。

### 6.3 Host：configEditor 写入（核心，遵循 dsh-doc 配置纪律）

**不读不写 cordis.patch.yml**，全部经 configEditor（原子、串行 HMR、保留注释与 `!!js`、写入后验证候选）：

```js
// index.js — captureService 风格捕获 configEditor（同 llm 的做法）
let configEditorService = null;
// apply(ctx): captureService(ctx, 'configEditor', s => { configEditorService = s; })

async function writeModelInput(ctx, { provider, modelId, input /* ['text','image'] | null=移除 */ }) {
  const editor = configEditorService;
  if (!editor) return { ok: false, error: 'configEditor-unavailable' };
  const entry = editor.entries().find(row => row.options.id === 'llm-pi-ai');
  if (!entry) return { ok: false, error: 'llm-pi-ai-entry-not-found' };   // 用户删了 patch 或换 profile
  let applied = false;
  await editor.edit(entry, (current) => {
    const providers = { ...(current.providers ?? {}) };
    const route = { ...(providers[provider] ?? {}) };
    const models = Array.isArray(route.models) ? [...route.models] : [];
    const idx = models.findIndex(m => m && m.id === modelId);
    if (idx === -1) throw Object.assign(new Error(`model "${modelId}" is not hand-listed in route "${provider}"`), { code: 'model-not-in-route' });
    const next = { ...models[idx] };
    if (input === null) delete next.input; else next.input = [...input];
    models[idx] = next;
    route.models = models;
    providers[provider] = route;
    applied = true;
    return { ...current, providers };
  });
  return { ok: true, applied };
}
```

要点：
- **只碰 `providers.<route>.models[]` 条目的 `input` 字段**（volatile 字段 → llm-pi-ai 原地热更新，不重启插件，不重启 app）。字段缺失等价 text（DEFAULT_INPUT），故 enable=写 `["text","image"]`、disable=删字段——语义与回落链完全一致。
- **手列 models 的路由才可写**（本机 pty/elioo 都是）。路由若靠 catalog 默认模型（models 空），则应走 `modelOverrides`（pi-ai 允许 override 装配 catalog 默认项）——P1 支持该分支；P0 明确报 `model-not-in-route` 并在 UI 提示「该路由未手列 models，暂不支持」。
- editor.edit 的 producer 抛错 → 整体原子回滚，不落半个配置（configEditor 保证）。
- 幂等：enable 前先 `resolveModelInfo(provider, model)` 查已声明 image 则 no-op；disable 时不存在 input 字段也 no-op。

### 6.4 生效链路（写入后发生什么）

```
configEditor.edit(llm-pi-ai entry, …providers.pty.models[glm-5.4].input=["text","image"])
  → volatile 原地更新 → pi-ai current() 下次读 config 重装配 snapshot
  → listModels/resolveModelInfo 返回 inputModalities 含 "image"
  → [门2] admission 放行            [门3] 不再投影，image blocks 保留
  → [门4] model.input 含 image → 图片按 20MiB/2048px 重编码入请求体 → 上游
  → [门1] modlens pasteTakeoverVerdict 复核 label 命中条目已声明 image → veto
       → 粘贴回归 composer 原生 intake → 缩略图/预览/删除/重试 全量恢复
```

客户端模型选择器刷新：模型目录经 buildModelCatalog 重建（pi-ai 配置变化路径与用户在设置里改 provider 相同）；P0 验证项=写入后不重启 GUI，选择器与会话模型即改即用（若实测需刷新，UI 上提示「刷新页面生效」即可，不影响 host 侧正确性）。

### 6.5 声明守护（防配置漂移）

- 写入后 settings 记账：`visionPassthrough = { enabled: [{provider, model, originalInput: null|['text']}], ts }`。
- 每次插件启动 + RPC `vision.state` 时复核：对每个 enabled 条目 `resolveModelInfo` 仍含 image；若用户手动改掉（或上游真支持后被目录自动声明）→ 状态卡如实显示当前声明，不强行覆写（**声明主权在用户配置，工具只负责一键与诊断**）。
- `llm/adapters-updated` 事件下重新拉 catalog（modlens 同款手法），驱动设置卡状态刷新。

### 6.6 与 modlens 的兼容矩阵

| 场景 | 行为 |
|---|---|
| 直通前选 pty/glm-5.4 | paste 被 modlens 劫持成路径文本（现状痛点） |
| **直通后**选 pty/glm-5.4 | verdict veto → 原生缩略图；原图直达上游；modlens 工具（read_image 等）照常可用 |
| 直通前选 modlens-pty twin | 不受影响（twin 走文字证据桥） |
| **直通后**已 pinned 到 `modlens-pty/glm-5.4` twin 的旧会话 | modlens shouldWrap 见 image 声明 → twin 从模型组消失；旧会话再发消息时 modlens resolveModel 报「select the same model from the provider group without "(modlens vision)"」→ 用户切回 pty/glm-5.4 原生组即可（一次性迁移成本，UI 文案说明） |
| modlens 已卸载/禁用 | 门1 本不存在；门2-4 链路照常被本方案解锁 |

### 6.7 Client：设置卡 UI（client.js，settings.section 已有容器）

- 「视觉直通」卡片：provider/model 两个下拉（数据 `vision.catalog`）、当前声明徽章（`image ✓` / `text-only` / `unknown` / `桥接中(modlens)`）、启用/禁用按钮、已启用清单 + 每行禁用操作。
- 「建议」行：对命中启发式（复用 modlens VISION_ID 知识：glm-5.3-flash 无 v 名但原生多模态等）的 text-only 模型打「疑似原生视觉」标记——**只建议，绝不自动启用**（上游真实能力只有用户知道）。
- RPC 走现有 fetch 通道（/api/dsh-tools），错误映射为卡片内文案（llm-unavailable / configEditor-unavailable / llm-pi-ai-entry-not-found / model-not-in-route）。
- i18n：locale/zh.json + en.json 新增 `vision.*` 键（现有 8 功能同款做法）。

### 6.8 错误与安全面

- 沿用现有 RPC 安全面（loopback + Sec-Fetch-Site）。
- configEditor 不可用（老版本 DSH）→ 功能降级为「诊断只读」：catalog 照给，按钮禁用 + 提示版本要求。
- 上游模型实际不支持图片而用户强行启用 → 发送时上游报错，原生错误 toast 面板照常展示（不吞不转译）；设置卡文案明确「启用前请确认上游网关该模型接受图片输入」。

## 7. 风险与边界

| 风险 | 等级 | 缓解 |
|---|---|---|
| 上游模型不吃图（用户误开） | 中 | 文案警示 + 不自动启用 + 上游错误原样透出；P1 可选「发 1×1 测试图探针」按钮（显式手动，不自动） |
| 写用户 profile patch（cordis.patch.yml） | 中 | 全经 configEditor（原子/串行/保留注释/写后验证）；dsh-doc 纪律=禁止自行读写 YAML；disable 恢复 originalInput 原值 |
| 旧会话 pinned modlens twin 失效 | 低 | 一次性迁移：modlens 自带明确报错指路；设置卡兼容矩阵文案 |
| 客户端模型目录刷新不及时 | 低 | host 侧已正确；UI 提示刷新；验证项 §9 |
| built-in catalog 模型（非手列） | 透出 | catalog 里 `patchable:false`，按钮禁用+原因提示 |
| configEditor 仅限 profile 根 Include 拥有的 entry | 低 | entry 找不到 → 明确报错，不静默 |

## 8. 分期实施

- **P0（一屏可用）**：vision.catalog / vision.model.enable / disable + 设置卡区块 + 守护记账；只支持手列 models 的路由（本机 pty/elioo 全覆盖）。
- **P1**：modelOverrides 分支（catalog 默认模型路由）；建议启发式标记；可选探针测试；`vision.state` 主动校验 + adapters-updated 联动。
- **P2（观察后）**：多 profile 场景的编辑目标选择；卸载时询问是否还原 input 声明。

## 9. 验证计划（实施后）

1. `node scripts/smoke.mjs` 扩展：mock ctx 验证 writeModelInput 的 enable/disable/幂等/原子回滚（producer 抛错不入账）。
2. 本机实测（pty/glm-5.4）：启用 → 不重启粘贴截图 → 出现原生缩略图 → 删除/重试可用 → 发送成功且上游收到 image blocks（durable log 保留真实 image blocks，对照 modlens 文字桥的差异）。
3. modlens 共存：直通后粘贴不再出路径文本；twin 旧会话报错文案指路正确；modlens 引擎工具不受影响。
4. disable 还原：input 字段删除 → YAML diff 仅该字段（configEditor 保留其余注释/排序）→ 模型回落 text-only → 粘贴回归劫持/发送被拒（回到现状，证明可逆）。
5. 现有 8 功能回归：scripts/test-sc.mjs 等全绿 + 设置卡其余区块无回归。

## 10. 附录：本机实况

- pty = newapi.xyue.tech/v1（openai-completions），models: glm-5.3 / deepseek-flash / glm-5.3-flash / glm-5.4，全无 `input` 字段；elioo = kdoo.ai/api/v1（Coder/CoderMax）。
- 用户当前默认模型 = `modlens-pty/glm-5.3`（twin 文字桥路线）。
- glm-5.3-flash：modlens 注释记载 2026-08-26 起原生多模态（名字无 v、无 vision 字样）——「建议」启发式的头号样例；glm-5.4/glm-5.4v 同理按上游实际能力判断。
- 参考实现对照：modlens 3.27.6（@liustack/modlens/dsh/index.js 2699 行）——本方案复用其「元数据声明即钥匙」「verdict veto」「activation 边界」认知，否决其「wrapper 直通」路线（pi-ai 流内硬门）。

<!-- END OF PLAN v1 -->


