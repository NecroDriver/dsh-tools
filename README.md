# dsh-tools

Desktop utilities for [DeepSeek Harness](https://dsh.ai) — seven tools:
**Reload plugins & Restart DSH**, **生成 / Generate**, **优化 / Optimize**,
**↑/↓ input history**, **资源控制 / Source Control**, **常用语 / Quick phrases**,
and a **Tools settings** panel.

## What it adds

### 1. Reload plugins / Restart DSH (titlebar)

A **更多 / More** button in the Windows caption bar (the strip at the top of the
window that renders **应用** and **编辑**), with a dropdown that offers two
actions:

- **重载插件 / Reload plugins** — hot-reloads installed plugin code through the
  Host's `hmr` service (`reconcileProfile()`): DSH recomposes the profile and
  replaces running plugins whose files changed on disk. Sessions keep running;
  the menu confirms success by watching the module version reported by
  `dev.ping` change. UI (client) code fully lands after a page refresh (F5).
- **重启 DSH / Restart DSH** — restarts immediately: no confirmation dialog;
  the ⚠ hint on the item warns that running tasks will be interrupted. It stops
  the DeepSeek Harness desktop app (the Electron shell and its Host process) and
  relaunches it.

The button only exists in the desktop app's title bar. In a plain browser
session (`dsh web`) nothing is rendered.

### 2. Generate draft reply (composer)

A **生成 / Generate** button in the composer's trailing controls (between the
model picker and the send button). Clicking it sends the last assistant reply
to the Host, which asks the configured model for a short intended-reply draft
(1–3 sentences, same language as the conversation) and fills it into the input
box, replacing whatever was typed. The button shows a spinner while streaming
and surfaces `[code] message` on failure. If no assistant reply exists yet it
says so and does nothing.

### 3. Optimize prompt (composer)

An **优化 / Optimize** button next to Generate. It takes the current composer
text and rewrites it into a prompt the AI understands and executes more easily
(goal, context, constraints, structured steps — intent, language, and tech
choices preserved). While Generate or Optimize is streaming, the composer is
locked (read-only) so the draft cannot race your keystrokes; it unlocks on
success or failure.

### 4. Input history (composer, ↑/↓)

Terminal-style: with the caret in the composer, **ArrowUp** loads the previous
message you sent into the input box (replacing its content), **ArrowDown**
walks back toward the newest, and cycling past the newest restores the draft
you were typing. History mode only engages when the box is empty or the caret
is at the very start of the text, so plain caret movement in multi-line drafts
keeps working; any other key hands control back to normal editing. History is
read live from the transcript (`[data-chat-flow-kind="user"]` rows, timestamps
and duplicated hidden blocks stripped), so it always matches what the session
shows.

### 5. Source Control (right "Start" toolbar)

A **资源控制** entry in the right sidebar's **开始 / Start** guide — the same
list that offers 工作区文件 / 新建终端 / 浏览网页 — opens a VSCode-style tab in
the right sidebar pane:

- Discovery mirrors **the workspace you are actually in**: the client hints
  the main-view session's `cwd` live, and that root is exclusive — no other
  workspaces' directories are scanned. (When no hint can be obtained the host
  falls back to the durable workspace registry.) Custom roots from Tools
  settings are always merged on top. Each root is checked for being a
  repository itself first; otherwise the scan descends up to three levels,
  skipping `node_modules`/build directories. Switching the main-view
  session/workspace rescans automatically, and the empty state lists the
  roots that were actually scanned.
- Repository groups start **collapsed** (only the repo name, branch and change
  count are shown); click a group header to expand its file list.
- Changes are grouped per repository with branch name and count; each file row
  shows a status badge — **A**dded (green), **M**odified (blue), **D**eleted
  (red), **R**enamed (amber, with original path) — plus staged indication.
- Clicking a file renders its diff (tracked files: `git diff HEAD`; untracked
  files: a synthetic all-plus new-file diff).
- Check a subset of files, then **commit** — the commit stages and commits only
  the checked paths, so unselected changes stay untouched in the working copy.
- **AI 生成 / Generate message** asks the model to draft a commit message in
  this repository's own style: the Host reads the last 20 commit subjects as a
  style reference and includes the per-file diffs of exactly the selected
  files. The draft is editable before committing.
- After committing, a **push** button appears on the group header.

### 6. Quick phrases (composer)

A bar of **常用语 / quick phrase** pills sits inside the composer card, directly
above the input field. Clicking a pill inserts that phrase at the caret
(focuses the editor first — it never replaces the whole draft). Up to five
phrases are shown; the bar hides itself when none are configured. Phrases are
edited in Tools settings (add, edit inline, remove) and persisted on the Host.
The bar lives in the card's normal flow (it never floats over the message list
or fights DSH popups): a hidden bootstrap span registers into the overlay slot,
climbs to the composer card, and inserts a plain-DOM row right above the draft
editor; a MutationObserver re-inserts the row if a React re-render ever drops
it.

### 7. Tools settings (Settings → Tools)

A **工具设置** section in the app settings: one switch per feature (More menu,
Generate, Optimize, Input history, Source Control, Quick phrases), a custom
model override (provider + model picked from the live `models.list` catalog —
used by Generate/Optimize/commit-message instead of the session default), the
quick-phrases editor (up to five entries), and the Source Control scan-roots
editor (add via the native directory picker, remove individually).

## How it works

- The Client half waits for the preload-owned caption menubar
  (`[data-windows-menu]`, an open shadow root) and appends one button that
  matches the existing 应用/编辑 styles, plus its own dropdown.
- All Host calls go through `ctx.connection.rpc.call('/api', 'dsh-tools', …)`.
  The Host route is loopback-only and same-origin; the restart path additionally
  validates that its parent process really is the DeepSeek Harness executable.
- A short-lived PowerShell wrapper (spawned hidden) starts the real helper via
  WMI `Win32_Process.Create` (`ShowWindow=0`), so it survives the process tree
  teardown: it stops the app and the Host (plus the Host's children), waits for
  all PIDs to exit, relaunches the executable, and confirms the relaunch. It
  logs to `%TEMP%\dsh-tools-restart.log`.
- Generate/Optimize register into the `conversation.input.right` slot; the
  quick-phrases bootstrap registers into `conversation.input.overlay` and
  injects a plain-DOM pill row in normal flow inside the composer card, above
  the draft editor (re-inserted by a MutationObserver if React drops it);
  Source Control registers a
  right-sidebar tab type through the `sidebarRightTabs` service (guide entry +
  tab body in `sidebar.right.pane.tab`); the settings section into
  `settings.section`.
- Source Control runs real `git` via `git -C <repo> …` (`status
  --porcelain=v1 -z`, `diff HEAD --`, `add -A -- <paths>` + `commit -m … --
  <paths>` for pathspec-scoped partial commits, `log --pretty=format:%s`,
  `push`). File paths are validated against traversal and must be current
  working-copy changes at commit time.
- LLM features use `ctx.llm.prepareCall` with the model from
  `agentDefaultModel.currentSelection()` or the Tools-settings override,
  stream the answer, and strip quotes/code fences. The composer draft is
  inserted into the Lexical composer via select-all + `insertText`.

## Verify / debug

- `node scripts/smoke.mjs` — Host route handler offline: envelope validation,
  loopback/same-origin rejection, dry-run restart plan, suggest/optimize
  happy paths + failure codes, settings persistence, models.list, dev.ping /
  dev.reconcile (hot-reload scheduling).
- `node scripts/test-sc.mjs` — Source Control against real temporary git
  repositories: scan/skip rules, status parsing (M/A/D/R + orig), tracked and
  synthetic diffs, partial-commit isolation, log, AI commit-message prompt
  composition, traversal guards.
- `node scripts/test-client-render.cjs` — renders the client bundle in a VM
  with a mini React: guide-type registration, tab body mount, groups, badges,
  diff view, checkboxes, partial commit flow, push, disposal.
- `node scripts/test-two-stage.cjs` — the hidden two-stage restart helper
  against dummy processes (needs the Electron node binary wiring it uses).
- Host-side diagnostics go to `%TEMP%\dsh-tools-debug.log` (module load,
  dispatch results, suggest timing, restart decisions).

## Limitations

- Windows desktop app only; restart is refused (with a clear message) when the
  Host was not started by the desktop shell.
- Restart is a force stop: running tasks are interrupted, though sessions stay
  durable and reopen after relaunch.
- Generate/Optimize need the Host-side `llm` service (present in the desktop
  Web Host); without it the buttons report `llm-unavailable`.
- Generate only sees the last assistant reply, not the whole conversation.
- Source Control reads one workspace level of git metadata: submodules are not
  recursed, and `.gitignore`d files are skipped by git itself.
