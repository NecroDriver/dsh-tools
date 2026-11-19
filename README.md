# dsh-tools

Desktop utilities for [DeepSeek Harness](https://dsh.ai) — currently one tool:
**Restart DSH**.

## What it adds

A **更多 / More** button in the Windows caption bar (the strip at the top of the
window that renders **应用** and **编辑**), with a dropdown that offers **重启
DSH / Restart DSH**. Choosing it restarts immediately — no confirmation dialog;
the ⚠ hint on the item warns that running tasks will be interrupted — and stops
the DeepSeek Harness desktop app (the Electron shell and its Host process) and
relaunches it.

The button only exists in the desktop app's title bar. In a plain browser
session (`dsh web`) nothing is rendered.

## How it works

- The Client half waits for the preload-owned caption menubar
  (`[data-windows-menu]`, an open shadow root) and appends one button that
  matches the existing 应用/编辑 styles, plus its own dropdown.
- The dropdown calls the Host half through `ctx.connection.rpc.call('/api',
  'dsh-tools', …)`. The Host route is loopback-only and same-origin, and
  validates that its parent process really is the DeepSeek Harness executable
  recorded in `DSH_NODE_EXECUTABLE` before doing anything.
- A detached PowerShell helper then stops the app and the Host, waits for both
  PIDs to exit, and relaunches the executable. It logs to
  `%TEMP%\dsh-tools-restart.log`.

## Verify / debug

- `node scripts/smoke.mjs` — exercises the Host route handler offline
  (envelope validation, loopback/same-origin rejection, dry-run restart plan).
- The dropdown's error state shows the Host's failure message (for example when
  DSH runs outside the desktop app).

## Limitations

- Windows desktop app only; restart is refused (with a clear message) when the
  Host was not started by the desktop shell.
- Restart is a force stop: running tasks are interrupted, though sessions stay
  durable and reopen after relaunch.
