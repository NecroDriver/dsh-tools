![More menu with restart](preview.svg)

Seven tools (see README for details):

1. **More → Restart DSH** — titlebar dropdown restarts the desktop app immediately (⚠ running tasks are interrupted); also **Reload plugins** hot-reloads installed plugin code without interrupting sessions.
2. **Generate** — composer button drafting an intended reply from the last assistant message.
3. **Optimize** — composer button rewriting your prompt into a clearer, more executable version; the composer locks while generating/optimizing.
4. **Input history** — ArrowUp/ArrowDown in the composer cycles through your own sent messages.
5. **Source Control** — an entry in the right "Start" toolbar opens a VSCode-style tab in the right sidebar: git changes grouped per repository (groups start collapsed, click to expand; A/M/D/R badges), per-file diffs, checked-subset partial commits, AI-generated commit messages following the repo's own style, and push.
6. **Quick phrases** — a bar of phrase pills floating above the composer; clicking one inserts it at the caret. Up to five shown, editable in Tools settings.
7. **Tools settings** — Settings → Tools: per-feature switches, quick-phrase editor, custom model override, Source Control scan roots.

Host-side diagnostics: `%TEMP%\dsh-tools-debug.log`; restart helper log: `%TEMP%\dsh-tools-restart.log`.
