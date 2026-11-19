# dsh-tools

Desktop utilities for [DeepSeek Harness](https://dsh.ai) — currently three
tools: **Restart DSH**, **生成 / Generate**, and **↑/↓ input history**.

## What it adds

### 1. Restart DSH (titlebar)

A **更多 / More** button in the Windows caption bar (the strip at the top of the
window that renders **应用** and **编辑**), with a dropdown that offers **重启
DSH / Restart DSH**. Choosing it restarts immediately — no confirmation dialog;
the ⚠ hint on the item warns that running tasks will be interrupted — and stops
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

### 3. Input history (composer, ↑/↓)

Terminal-style: with the caret in the composer, **ArrowUp** loads the previous
message you sent into the input box (replacing its content), **ArrowDown**
walks back toward the newest, and cycling past the newest restores the draft
you were typing. History mode only engages when the box is empty or the caret
is at the very start of the text, so plain caret movement in multi-line drafts
keeps working; any other key hands control back to normal editing. History is
read live from the transcript (`[data-chat-flow-kind="user"]` rows), so it
always matches what the session shows.

## How it works

- The Client half waits for the preload-owned caption menubar
  (`[data-windows-menu]`, an open shadow root) and appends one button that
  matches the existing 应用/编辑 styles, plus its own dropdown.
- The dropdown calls the Host half through `ctx.connection.rpc.call('/api',
  'dsh-tools', …)`. The Host route is loopback-only and same-origin, and
  validates that its parent process really is the DeepSeek Harness executable
  recorded in `DSH_NODE_EXECUTABLE` before doing anything.
- A short-lived PowerShell wrapper (spawned hidden) starts the real helper via
  WMI `Win32_Process.Create` (`ShowWindow=0`), so it survives the process tree
  teardown: it stops the app and the Host (plus the Host's children), waits for
  all PIDs to exit, relaunches the executable, and confirms the relaunch. It
  logs to `%TEMP%\dsh-tools-restart.log`.
- The Generate button registers into the `conversation.input.right` slot. The
  Host's `suggest` method reads the reply text sent by the client (capped at
  24 000 chars), calls `ctx.llm.prepareCall` with the model from
  `agentDefaultModel.currentSelection()`, streams the answer, strips quotes and
  code fences, and returns the draft. The client inserts it into the Lexical
  composer via select-all + `insertText`.

## Verify / debug

- `node scripts/smoke.mjs` — exercises the Host route handler offline
  (envelope validation, loopback/same-origin rejection, dry-run restart plan,
  suggest happy path + failure codes).
- The dropdown's error state shows the Host's failure message (for example when
  DSH runs outside the desktop app).
- Host-side diagnostics go to `%TEMP%\dsh-tools-debug.log` (module load,
  dispatch results, suggest timing).

## Limitations

- Windows desktop app only; restart is refused (with a clear message) when the
  Host was not started by the desktop shell.
- Restart is a force stop: running tasks are interrupted, though sessions stay
  durable and reopen after relaunch.
- Generate needs the Host-side `llm` service (present in the desktop Web Host);
  without it the button reports `llm-unavailable` instead of guessing a route.
- The draft is a starting point: the model only sees the last assistant reply,
  not the whole conversation.
