// dsh-tools — client half: "更多/More" button in the Windows caption menubar.
//
// The Windows caption menubar (应用/编辑) is installed by the desktop preload as
// an open shadow root on <div data-windows-menu>. This module waits for that
// host, appends one matching button to its [role=menubar], and opens a dropdown
// with "重启 DSH". The restart itself runs on the Host half through
// ctx.connection.rpc.call('/api', 'dsh-tools', { method, payload }) — the same
// production-proven bus dsh-im-notify uses.
//
// In a plain browser (no preload menubar) the button has no home and nothing
// renders. All DOM lives inside the preload's shadow root with .dsh-tools-*
// class names; every listener/observer registered here is removed on cleanup.

window.__ModuleLoader__.load({
  id: 'dsh-tools',
  factory(require) {
    // React for the composer slot render; if the loader cannot resolve it the
    // generate button degrades away and the More menu still works.
    let React = null;
    try { React = require('react'); } catch { React = null; }

    const DICTS = {
      zh: {
        more: '更多',
        restart: '重启 DSH',
        restartHint: '⚠ 点击立即重启，正在运行的任务将会中断',
        reload: '重载插件',
        reloadHint: '热重载已安装的插件代码，不打断会话',
        reloadBusy: '正在重载…',
        reloadDone: '已重载',
        reloadDoneHint: '界面代码刷新（F5）后完全生效',
        reloadUnknown: '已触发，但未确认版本变化；详见日志或重启',
        actionFailed: '操作失败',
        scheduling: '正在安排重启…',
        restarting: '正在重启，请稍候…',
        close: '关闭',
        errorTitle: '重启失败',
        errorGeneric: '请求失败，请重试。',
        generate: '生成',
        generateTitle: '根据最后一轮 AI 回复起草一条意向回复',
        generating: '生成中…',
        generateNoReply: '未找到可参考的 AI 回复',
        generateFailed: '生成失败',
        optimize: '优化',
        optimizeTitle: '优化输入框中的提示词，使其更易于 AI 理解',
        optimizing: '优化中…',
        optimizeEmpty: '输入框为空，先写下提示词再优化',
        optimizeFailed: '优化失败',
        settingsTitle: '工具设置',
        settingsIntro: '单独开关 dsh-tools 的各项功能；生成/优化可选用更快的模型。',
        fMoreMenu: '标题栏「更多」菜单（重启 DSH）',
        fGenerate: '输入栏「生成」按钮（意向回复）',
        fOptimize: '输入栏「优化」按钮（提示词优化）',
        fHistory: '↑/↓ 输入历史',
        modelTitle: '生成 / 优化模型',
        modelFollow: '跟随应用默认模型',
        modelProvider: '提供方',
        modelModel: '模型',
        modelCustom: '自定义（选择更快的模型）',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        saveFailed: '保存失败',
        modelsLoading: '正在加载模型列表…',
        modelsFailed: '模型列表加载失败',
        modelsEmpty: '未发现可用模型',
        sc: '资源控制',
        scGuideDesc: '查看变更，生成提交信息并提交推送',
        scRefresh: '刷新',
        scLoading: '正在扫描仓库…',
        scEmpty: '未发现 git 仓库',
        scEmptyHint: '仅扫描当前工作区；如需其他目录请在工具设置里添加根目录。',
        scFailed: '加载失败',
        scClean: '没有变更',
        scTruncated: '变更过多，仅显示前一部分',
        scSelectAll: '全选',
        scClear: '清空',
        scStagedDot: '已暂存',
        stA: '新增',
        stM: '修改',
        stD: '删除',
        stR: '重命名',
        scMessagePlaceholder: '提交信息（可编辑）…',
        scGenMsg: 'AI 生成',
        scGenMsging: '生成中…',
        scCommit: '提交',
        scCommitting: '提交中…',
        scCommitted: '已提交',
        scPush: '推送',
        scPushing: '推送中…',
        scPushed: '已推送',
        scUpdateCode: '更新代码',
        scUpdateCodeTitle: '更新代码：git pull --rebase --autostash',
        scUpdateCodeAllTitle: '对所有仓库执行 git pull --rebase --autostash',
        scPulling: '更新代码中…',
        scPulled: '代码已更新',
        scUpdateDb: '更新数据库',
        scUpdateDbTitle: '更新数据库：pnpm prisma:generate → pnpm prisma:push',
        scUpdateDbAllTitle: '对所有仓库执行 pnpm prisma:generate → pnpm prisma:push',
        scDbRunning: '更新数据库中…',
        scDbDone: '数据库已更新',
        scNoPrisma: '无 prisma 脚本，已跳过',
        scBatchSkipped: '跳过',
        scBatchFailed: '失败',
        scNoMsg: '先填写或生成提交信息',
        scNoFiles: '勾选要提交的文件',
        scDiffFailed: 'diff 加载失败',
        scDiffStyleTitle: '切换比对方向（横向并排 / 纵向逐行）',
        scDiffSplit: '横向',
        scDiffUnified: '纵向',
        scSelectHint: '勾选文件后可单笔提交',
        scRevert: '撤销',
        scRevertHint: '撤销此文件的改动：修改/删除还原，新增删除',
        scRevertConfirmTitle: '撤销改动？',
        scRevertConfirmRestore: '还原以下改动（回到最近提交）：',
        scRevertConfirmDelete: '删除以下新增文件（不可恢复）：',
        scRevertConfirmCancel: '取消',
        scRevertConfirmOk: '撤销',
        scReverting: '撤销中…',
        scReverted: '已撤销',
        scRevertRestored: '还原',
        scRevertDeleted: '删除',
        fSc: '开始页「资源控制」入口',
        phrasesTitle: '常用语',
        phrasesIntro: '悬浮在输入框上方的快捷短语，点击即插入到光标处（最多 5 条）。',
        phrasesChipTitle: '点击插入到输入框光标处',
        phrasesAdd: '添加常用语',
        phrasesFull: '最多 5 条，先删除一条再添加',
        phrasesPlaceholder: '输入常用语，如：使用 xxx skill，优化这份代码',
        fPhrases: '输入框常用语悬浮条',
        scRootsTitle: '资源控制扫描根目录',
        scRootsIntro: '自动扫描所有工作区目录；可再添加其他根目录（向下最多 3 层）。',
        scAddRoot: '添加目录',
        scRemoveRoot: '移除',
        fUsage: '侧栏「今日用量」组件',
        fOpenSidebar: '新会话默认展开右侧栏',
        usageTodayLabel: '今日',
        usageTitle: '今日 Token 用量',
        usageInput: '输入',
        usageOutput: '输出',
        usageCacheRead: '缓存读',
        usageCacheWrite: '缓存写',
        usageRequests: '请求',
        usageSessions: '活跃会话',
        usageWeek: '近 7 天',
        usageUpdated: '更新于',
        usageRefresh: '刷新',
        usageEmpty: '今日暂无用量',
        usageError: '用量读取失败',
        usageRetry: '重试',
        usagePartial: '部分会话读取失败，统计可能不完整',
        usageDayNames: '周日,周一,周二,周三,周四,周五,周六',
        usageTodayShort: '今',
      },
      en: {
        more: 'More',
        restart: 'Restart DSH',
        restartHint: '⚠ Restarts immediately; running tasks will be interrupted',
        reload: 'Reload plugins',
        reloadHint: 'Hot-reload installed plugin code; sessions keep running',
        reloadBusy: 'Reloading…',
        reloadDone: 'Reloaded',
        reloadDoneHint: 'Refresh (F5) to pick up UI changes',
        reloadUnknown: 'Triggered, but no version change confirmed; check the log or restart',
        actionFailed: 'Action failed',
        scheduling: 'Scheduling restart…',
        restarting: 'Restarting…',
        close: 'Close',
        errorTitle: 'Restart failed',
        errorGeneric: 'Request failed; try again.',
        generate: 'Draft',
        generateTitle: 'Draft an intent reply from the latest AI reply',
        generating: 'Drafting…',
        generateNoReply: 'No AI reply found to reference',
        generateFailed: 'Draft failed',
        optimize: 'Optimize',
        optimizeTitle: 'Rewrite the prompt in the composer so the AI understands it better',
        optimizing: 'Optimizing…',
        optimizeEmpty: 'The composer is empty — write a prompt first',
        optimizeFailed: 'Optimize failed',
        settingsTitle: 'Tools',
        settingsIntro: 'Toggle each dsh-tools feature; pick a faster model for draft/optimize.',
        fMoreMenu: 'Titlebar "More" menu (restart DSH)',
        fGenerate: 'Composer "Draft" button (intent reply)',
        fOptimize: 'Composer "Optimize" button (prompt rewrite)',
        fHistory: '↑/↓ input history',
        modelTitle: 'Draft / Optimize model',
        modelFollow: 'Follow the app default model',
        modelProvider: 'Provider',
        modelModel: 'Model',
        modelCustom: 'Custom (pick a faster model)',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        saveFailed: 'Save failed',
        modelsLoading: 'Loading models…',
        modelsFailed: 'Failed to load models',
        modelsEmpty: 'No models discovered',
        sc: 'Source Control',
        scGuideDesc: 'Review changes, draft a message, commit and push',
        scRefresh: 'Refresh',
        scLoading: 'Scanning repositories…',
        scEmpty: 'No git repositories found',
        scEmptyHint: 'Only the current workspace is scanned; add extra roots in Tools settings.',
        scFailed: 'Failed to load',
        scClean: 'No changes',
        scTruncated: 'Too many changes; showing the first part only',
        scSelectAll: 'Select all',
        scClear: 'Clear',
        scStagedDot: 'Staged',
        stA: 'Added',
        stM: 'Modified',
        stD: 'Deleted',
        stR: 'Renamed',
        scMessagePlaceholder: 'Commit message (editable)…',
        scGenMsg: 'AI generate',
        scGenMsging: 'Generating…',
        scCommit: 'Commit',
        scCommitting: 'Committing…',
        scCommitted: 'Committed',
        scPush: 'Push',
        scPushing: 'Pushing…',
        scPushed: 'Pushed',
        scUpdateCode: 'Update code',
        scUpdateCodeTitle: 'Update code: git pull --rebase --autostash',
        scUpdateCodeAllTitle: 'Run git pull --rebase --autostash on every repository',
        scPulling: 'Updating code…',
        scPulled: 'Code updated',
        scUpdateDb: 'Update database',
        scUpdateDbTitle: 'Update database: pnpm prisma:generate → pnpm prisma:push',
        scUpdateDbAllTitle: 'Run pnpm prisma:generate → pnpm prisma:push on every repository',
        scDbRunning: 'Updating database…',
        scDbDone: 'Database updated',
        scNoPrisma: 'No prisma scripts; skipped',
        scBatchSkipped: 'skipped',
        scBatchFailed: 'failed',
        scNoMsg: 'Write or generate a commit message first',
        scNoFiles: 'Select files to commit',
        scDiffFailed: 'Failed to load diff',
        scDiffStyleTitle: 'Toggle diff layout (side-by-side / unified)',
        scDiffSplit: 'Side-by-side',
        scDiffUnified: 'Unified',
        scSelectHint: 'Select files to commit them alone',
        scRevert: 'Revert',
        scRevertHint: 'Revert this file: edits/deletions are restored, additions deleted',
        scRevertConfirmTitle: 'Revert changes?',
        scRevertConfirmRestore: 'Restore these changes (back to the last commit):',
        scRevertConfirmDelete: 'Delete these new files (cannot be undone):',
        scRevertConfirmCancel: 'Cancel',
        scRevertConfirmOk: 'Revert',
        scReverting: 'Reverting…',
        scReverted: 'Reverted',
        scRevertRestored: 'restored',
        scRevertDeleted: 'deleted',
        fSc: '"Start" page Source Control entry',
        phrasesTitle: 'Quick phrases',
        phrasesIntro: 'Phrases floating above the composer; click one to insert it at the caret (max 5).',
        phrasesChipTitle: 'Insert into the composer at the caret',
        phrasesAdd: 'Add phrase',
        phrasesFull: 'Maximum 5 phrases; remove one first',
        phrasesPlaceholder: 'Type a phrase, e.g.: Use the xxx skill to optimize this code',
        fPhrases: 'Composer quick-phrase bar',
        scRootsTitle: 'Source Control scan roots',
        scRootsIntro: 'Workspace directories are scanned automatically; add more roots (up to 3 levels deep).',
        scAddRoot: 'Add directory',
        scRemoveRoot: 'Remove',
        fUsage: 'Sidebar "Today\'s usage" widget',
        fOpenSidebar: 'Open the right sidebar on new sessions',
        usageTodayLabel: 'Today',
        usageTitle: 'Today\'s token usage',
        usageInput: 'Input',
        usageOutput: 'Output',
        usageCacheRead: 'Cache read',
        usageCacheWrite: 'Cache write',
        usageRequests: 'Requests',
        usageSessions: 'Active sessions',
        usageWeek: 'Last 7 days',
        usageUpdated: 'Updated',
        usageRefresh: 'Refresh',
        usageEmpty: 'No usage recorded today',
        usageError: 'Failed to load usage',
        usageRetry: 'Retry',
        usagePartial: 'Some sessions failed to load; totals may be incomplete',
        usageDayNames: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
        usageTodayShort: 'Now',
      },
    };

    // Shared feature flags, refreshed from the Host settings on boot and after
    // every save in the settings panel. Components and listeners read these
    // live, so a toggle applies without re-registering slots.
    const featureFlags = {
      moreMenu: true,
      generate: true,
      optimize: true,
      history: true,
      sc: true,
      phrases: true,
      usage: true,
      openSidebar: true,
    };
    const modelOverride = { provider: '', model: '' };
    // apply() installs a hook so flag changes can (un)mount the caption menu.
    const runtime = { applyFlags: null };
    // Set by registerScUi: re-evaluates the sidebarRightTabs type registration
    // against featureFlags.sc when settings change.
    let scFlagsHook = null;

    // Quick-phrase store: shared by the composer bar and the settings editor,
    // so saving in ToolsPanel updates every mounted bar immediately.
    const phraseStore = {
      items: [],
      listeners: new Set(),
      set(items) {
        phraseStore.items = Array.isArray(items) ? items.filter((t) => typeof t === 'string') : [];
        for (const listener of phraseStore.listeners) listener();
      },
      subscribe(listener) {
        phraseStore.listeners.add(listener);
        return () => phraseStore.listeners.delete(listener);
      },
      snapshot() { return phraseStore.items; },
    };

    // ---- today's token usage (sidebar footer widget) ----
    //
    // SWR store fed by the Host RPC 'usage.today' (per-day token aggregate
    // over every logical session; see index.js for the fold semantics).
    // `usageCall` is bound by registerUsageWidget so the store also works
    // before/after slot teardown. State object is REPLACED (not mutated) on
    // every change so useSyncExternalStore sees a new snapshot reference.
    let usageCall = null;
    // `usageBeacon` (bound by apply) writes diagnostic tags to the host debug
    // log; usageStore lives at factory scope so it cannot see apply locals.
    let usageBeacon = null;
    const usageStore = {
      state: { status: 'idle', data: null, error: '', updatedAt: 0 },
      listeners: new Set(),
      _inflight: null,
      _slowTimer: 0,
      subscribe(listener) {
        usageStore.listeners.add(listener);
        return () => usageStore.listeners.delete(listener);
      },
      snapshot() { return usageStore.state; },
      _set(patch) {
        usageStore.state = { ...usageStore.state, ...patch };
        for (const listener of usageStore.listeners) listener();
      },
      /** Refresh if no data yet or older than maxAge; concurrent calls coalesce. */
      ensure(maxAge = 300_000) {
        const { status, data, updatedAt } = usageStore.state;
        if (status === 'ready' && data !== null && Date.now() - updatedAt < maxAge) return Promise.resolve();
        return usageStore.refresh(false);
      },
      refresh(force) {
        if (usageStore._inflight !== null) return usageStore._inflight;
        if (usageCall === null) {
          usageBeacon?.('usage-rpc-null');
          usageStore._set({ status: 'error', error: 'rpc unavailable' });
          return Promise.resolve();
        }
        // Loading state only matters when there is nothing to show yet —
        // otherwise keep the stale numbers on screen (no flashing).
        if (usageStore.state.data === null && usageStore._slowTimer === 0) {
          usageStore._slowTimer = setTimeout(() => {
            usageStore._slowTimer = 0;
            if (usageStore.state.data === null) usageStore._set({ status: 'loading' });
          }, 250);
        }
        const startedAt = Date.now();
        usageStore._inflight = usageCall('usage.today', { force: force === true }).then((result) => {
          if (result?.ok === true && result.value !== null && typeof result.value === 'object') {
            usageStore._set({ status: 'ready', data: result.value, error: '', updatedAt: Date.now() });
          } else {
            const err = result?.error;
            const message = typeof err?.message === 'string' && err.message !== '' ? err.message : 'usage.today failed';
            usageStore._set({ status: 'error', error: message, updatedAt: startedAt });
          }
          return result;
        }).catch((error) => {
          usageStore._set({ status: 'error', error: error?.message ?? String(error), updatedAt: startedAt });
          return null;
        }).finally(() => {
          usageStore._inflight = null;
          if (usageStore._slowTimer !== 0) {
            clearTimeout(usageStore._slowTimer);
            usageStore._slowTimer = 0;
          }
        });
        return usageStore._inflight;
      },
    };

    // 1234 → '1234'; 12_500 → '12.5K'; 1_250_000 → '1.25M' ('.0' trimmed).
    const formatTokens = (n) => {
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return '—';
      if (n < 1000) return String(Math.round(n));
      const unit = n < 1e6 ? [1e3, 'K'] : n < 1e9 ? [1e6, 'M'] : [1e9, 'B'];
      const value = n / unit[0];
      const text = value >= 100 ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '');
      return `${text}${unit[1]}`;
    };

    const MENU_CSS = [
      '.dsh-tools-menu{position:absolute;top:calc(var(--dsh-windows-titlebar-height,40px) - 4px);z-index:1200;min-width:250px;padding:6px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 10px 30px rgba(0,0,0,.20);font:inherit;font-size:14px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-menu *{box-sizing:border-box;font:inherit;}',
      '.dsh-tools-sep{height:1px;margin:6px 8px;background:var(--dsw-alias-border-l1);}',
      '.dsh-tools-hintInfo{color:var(--dsw-alias-label-secondary,inherit);}',
      '.dsh-tools-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:7px;background:transparent;color:inherit;font-size:14px;text-align:left;cursor:default;}',
      '.dsh-tools-item:hover:not(:disabled),.dsh-tools-item:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));outline:none;}',
      '.dsh-tools-itemGlyph{display:inline-flex;color:var(--dsw-alias-label-secondary);flex:none;}',
      '.dsh-tools-itemMain{display:flex;flex-direction:column;min-width:0;gap:1px;}',
      '.dsh-tools-itemTitle{white-space:nowrap;}',
      '.dsh-tools-itemHint{font-size:12px;color:var(--dsw-alias-state-warn-primary,#b8860b);white-space:nowrap;}',
      '.dsh-tools-strong{font-weight:600;}',
      '.dsh-tools-actions{display:flex;gap:8px;justify-content:flex-end;}',
      '.dsh-tools-btn{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;border-radius:7px;padding:5px 13px;font-size:13px;cursor:default;}',
      '.dsh-tools-btn:hover{border-color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-status{display:flex;flex-direction:column;gap:7px;padding:10px 10px 8px;}',
      '.dsh-tools-statusTitle{display:flex;align-items:center;gap:9px;}',
      '.dsh-tools-errorText{font-size:12.5px;color:var(--dsw-alias-state-error-primary);word-break:break-word;}',
      '.dsh-tools-spin{animation:dsh-tools-rot 1s linear infinite;}',
      '@keyframes dsh-tools-rot{to{transform:rotate(360deg);}}',
    ].join('\n');

    const RESTART_GLYPH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';

    const GEN_CSS = [
      '.dsh-tools-gen{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:1px solid transparent;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:default;white-space:nowrap;}',
      '.dsh-tools-gen:hover:not(:disabled),.dsh-tools-gen:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary);outline:none;}',
      '.dsh-tools-gen:disabled{opacity:.6;}',
      '.dsh-tools-gen.is-error{color:var(--dsw-alias-state-error-primary);max-width:280px;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-gen .dsh-tools-genIcon{display:inline-flex;flex:none;}',
      '.dsh-tools-gen.is-busy .dsh-tools-genIcon{animation:dsh-tools-rot 1s linear infinite;}',
      // Composer lock while draft/optimize streams (user request 2026-11-20):
      // the contenteditable stops accepting input and dims; buttons stay alive
      // so the state is visible, and the lock releases on success OR failure.
      '[data-composer-card][data-dsh-tools-locked] [contenteditable]{opacity:.5;pointer-events:none;}',
      // ---- settings panel (settings.section slot) ----
      '.dsh-tools-panel{display:flex;flex-direction:column;gap:16px;font-size:14px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-panel section{display:flex;flex-direction:column;gap:10px;}',
      '.dsh-tools-panel h4{margin:0;font-size:13.5px;font-weight:600;}',
      '.dsh-tools-panel p{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-toggle{display:flex;align-items:center;gap:10px;padding:2px 0;}',
      '.dsh-tools-toggle input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary,#3b82f6);width:16px;height:16px;flex:none;}',
      '.dsh-tools-radio{display:flex;align-items:center;gap:8px;padding:2px 0;}',
      '.dsh-tools-radio input[type=radio]{accent-color:var(--dsw-alias-brand-primary,#3b82f6);width:15px;height:15px;flex:none;}',
      '.dsh-tools-selects{display:flex;gap:10px;flex-wrap:wrap;padding-left:23px;}',
      '.dsh-tools-select{flex:1;min-width:180px;padding:6px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:13px;}',
      '.dsh-tools-panelFooter{display:flex;align-items:center;gap:12px;}',
      '.dsh-tools-primary{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-brand-primary,#3b82f6);color:#fff;border-radius:7px;padding:6px 16px;font-size:13px;cursor:default;}',
      '.dsh-tools-primary:disabled{opacity:.6;}',
      '.dsh-tools-note{font-size:12.5px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-note.is-error{color:var(--dsw-alias-state-error-primary);}',
      // ---- quick phrases row (mounted in flow inside the composer card) ----
      // v0.6.7: the row renders in normal flow inside the composer card,
      // directly above the draft editor. It used to float above the card
      // through the overlay anchor (bottom:100% + gap), but that band is
      // shared with DSH popup shells and still read as overlapping the card
      // edge (user feedback 2026-11-23: "感觉没变化").
      '.dsh-tools-phraseBar{display:flex;gap:6px;padding:6px 12px 0;overflow-x:auto;scrollbar-width:none;}',
      '.dsh-tools-phraseBar::-webkit-scrollbar{display:none;}',
      '.dsh-tools-phrase{flex:none;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:24px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsh-specific-input-major,var(--dsw-alias-bg-layer-1,#fff));box-shadow:var(--dsw-elevation-soft,none);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:22px;cursor:pointer;}',
      '.dsh-tools-phrase:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary,#3b82f6);}',
      '.dsh-tools-phrase:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary,#3b82f6);outline:2px solid var(--dsw-alias-brand-primary,#3b82f6);outline-offset:1px;}',
      '.dsh-tools-phrase:active{filter:brightness(.95);}',
      // ---- quick phrases editor (settings panel section) ----
      '.dsh-tools-phraseRow{display:flex;align-items:center;gap:8px;}',
      '.dsh-tools-phraseInput{flex:1;min-width:0;padding:6px 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:13px;}',
    ].join('\n');

    const GEN_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';

    const OPT_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2L11 5"/></svg>';

    const SC_GLYPH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>';
    // v0.7.11: push = upload-style arrow (arrow up out of the tray) — the
    // previous two-arrow loop glyph read as "refresh" at 13px (user request).
    const SC_PUSH_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    const SC_REFRESH_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
    // v0.7.9 diff-layout toggle: split = vertical divider (side-by-side),
    // unified = horizontal divider (rows).
    const SC_COLS_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>';
    const SC_ROWS_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>';
    const SC_CLOSE_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const SC_CHEVRON_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    const SC_PLUS_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const SC_SPARK_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
    const SC_PULL_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    const SC_DB_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>';
    const SC_REVERT_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';
    const SC_REVERT_SM_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>';

    const SC_CSS = [
      // tab body inside the right-sidebar pane (sidebar.right.pane.tab slot);
      // the pane provides the box, this fills it edge to edge.
      '.dsh-tools-scTab{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13.5px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-scHeader{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;}',
      '.dsh-tools-scHeaderTitle{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;flex:1;min-width:0;}',
      // v0.7.5 update bar: 更新代码 / 更新数据库 sweep EVERY listed repository.
      '.dsh-tools-scNoteRow{display:flex;align-items:center;padding:6px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;}',
      '.dsh-tools-scBatchNote{min-width:0;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-scIconBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;transition:background-color 120ms ease,color 120ms ease;}',
      '.dsh-tools-scIconBtn:hover:not(:disabled),.dsh-tools-scIconBtn:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary);outline:none;}',
      '.dsh-tools-scIconBtn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.3));}',
      '.dsh-tools-scIconBtn:disabled{opacity:.55;}',
      '.dsh-tools-scBody{flex:1;overflow-y:auto;padding:8px 8px 16px;}',
      '.dsh-tools-scState{display:flex;flex-direction:column;gap:8px;padding:18px 10px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-scGroup{margin:4px 0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,transparent);}',
      '.dsh-tools-scGroupHead{display:flex;align-items:center;gap:7px;padding:7px 10px;background:transparent;}',
      '.dsh-tools-scGroupHeadMain{flex:1;min-width:0;display:flex;align-items:center;gap:7px;background:transparent;border:0;padding:2px 4px;border-radius:5px;color:inherit;font:inherit;text-align:left;cursor:pointer;}',
      '.dsh-tools-scGroupHeadMain:hover,.dsh-tools-scGroupHeadMain:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none;}',
      '.dsh-tools-scRepoName{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-scBranch{font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));border-radius:5px;padding:1px 6px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;flex:none;}',
      '.dsh-tools-scCount{font-size:11.5px;color:var(--dsw-alias-label-secondary);flex:none;}',
      '.dsh-tools-scChev{display:inline-flex;flex:none;color:var(--dsw-alias-label-secondary);transition:transform 150ms ease;}',
      // v0.7.8 default icon wrapper: svg as block inside a centered flex box
      // kills baseline alignment (no descender gap, true optical centering).
      '.dsh-tools-scIco{display:inline-flex;align-items:center;justify-content:center;flex:none;line-height:0;}',
      '.dsh-tools-scIco svg{display:block;}',
      '.dsh-tools-scChev.is-open{transform:rotate(180deg);}',
      '.dsh-tools-scMini{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:pointer;flex:none;white-space:nowrap;transition:color 120ms ease,border-color 120ms ease,background-color 120ms ease;}',
      '.dsh-tools-scMini:hover:not(:disabled),.dsh-tools-scMini:focus-visible:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary);outline:none;}',
      '.dsh-tools-scMini:active:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));}',
      '.dsh-tools-scMini:disabled{opacity:.55;}',
      '.dsh-tools-scVDiv{width:1px;height:16px;background:var(--dsw-alias-border-l2);flex:none;}',
      '.dsh-tools-scFiles{display:flex;flex-direction:column;}',
      '.dsh-tools-scFile{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 12px;cursor:default;content-visibility:auto;contain-intrinsic-size:auto 26px;}',
      '.dsh-tools-scFile:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));}',
      '.dsh-tools-scFile input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary,#3b82f6);width:14px;height:14px;flex:none;margin:0;}',
      '.dsh-tools-scFileMain{flex:1;min-width:0;background:transparent;border:0;padding:2px 3px;border-radius:4px;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;}',
      '.dsh-tools-scFileMain:hover,.dsh-tools-scFileMain:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));outline:none;}',
      '.dsh-tools-scFileName{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-scFileDir{display:block;font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-scBadge{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:4px;font-size:10.5px;font-weight:700;flex:none;}',
      '.dsh-tools-scBadge.is-A{color:var(--dsw-alias-state-success-primary,#3fb950);background:rgba(63,185,80,.14);}',
      '.dsh-tools-scBadge.is-M{color:var(--dsw-alias-brand-primary,#3b82f6);background:rgba(59,130,246,.14);}',
      '.dsh-tools-scBadge.is-D{color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.14);}',
      '.dsh-tools-scBadge.is-R{color:var(--dsw-alias-state-warn-primary,#d29922);background:rgba(210,153,34,.14);}',
      '.dsh-tools-scFile.is-selected{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.10));}',
      '.dsh-tools-scDiff{margin:0;padding:6px 10px;font-family:var(--dsh-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11.5px;line-height:1.55;background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.18));overflow-x:auto;white-space:pre;border-top:1px solid var(--dsw-alias-border-l1);max-height:300px;overflow-y:auto;}',
      '.dsh-tools-scDiff .dsh-tools-dl{display:block;}',
      '.dsh-tools-scDiff .dsh-tools-dl.is-add{color:var(--dsw-alias-state-success-primary,#3fb950);}',
      '.dsh-tools-scDiff .dsh-tools-dl.is-del{color:var(--dsw-alias-state-error-primary,#f85149);}',
      '.dsh-tools-scDiff .dsh-tools-dl.is-hunk{color:var(--dsw-alias-label-secondary);font-size:10.5px;}',
      // v0.7.9 diff-layout toggle: slim bar above the diff with the switch,
      // then either the classic unified <pre> or a side-by-side grid.
      '.dsh-tools-scDiffBar{display:flex;justify-content:flex-end;align-items:center;padding:3px 10px;border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.18));}',
      // v0.7.10 VSCode-style: full-row tint backgrounds + inset edge markers
      // instead of text color alone. The rgba tints are deliberately not
      // theme tokens — they must read on both light and dark aliases the way
      // editor diff views do (state colors stay tokenized for the text).
      '.dsh-tools-scDiff .dsh-tools-dl.is-add{color:var(--dsw-alias-state-success-primary,#3fb950);background:rgba(63,185,80,.10);margin:0 -10px;padding:0 10px;}',
      '.dsh-tools-scDiff .dsh-tools-dl.is-del{color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.10);margin:0 -10px;padding:0 10px;}',
      '.dsh-tools-scDiffSplit{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2,rgba(0,0,0,.18));max-height:300px;overflow:auto;display:grid;grid-template-columns:4ch minmax(0,1fr) 4ch minmax(0,1fr);font-family:var(--dsh-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11.5px;line-height:1.55;}',
      '.dsh-tools-scDiffSplit .dsh-tools-dh{grid-column:1 / -1;color:var(--dsw-alias-label-secondary);padding:0 10px;white-space:pre;font-size:10.5px;line-height:1.9;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08));}',
      '.dsh-tools-scDiffSplit .dsh-tools-dno{color:var(--dsw-alias-label-tertiary,rgba(128,128,128,.75));text-align:right;padding:0 4px 0 6px;user-select:none;font-variant-numeric:tabular-nums;}',
      '.dsh-tools-scDiffSplit .dsh-tools-dno.is-new{border-left:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-tools-scDiffSplit .dsh-tools-dc{white-space:pre-wrap;overflow-wrap:anywhere;padding-right:8px;content-visibility:auto;contain-intrinsic-size:auto 18px;}',
      '.dsh-tools-scDiffSplit .dsh-tools-dc.is-add{color:var(--dsw-alias-state-success-primary,#3fb950);background:rgba(63,185,80,.10);box-shadow:inset 2px 0 0 rgba(63,185,80,.55);}',
      '.dsh-tools-scDiffSplit .dsh-tools-dc.is-del{color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.10);box-shadow:inset 2px 0 0 rgba(248,81,73,.55);}',
      '.dsh-tools-scCommitBar{display:flex;flex-direction:column;gap:6px;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-tools-scMsgRow{display:flex;gap:6px;align-items:flex-start;}',
      '.dsh-tools-scMsg{flex:1;min-width:0;resize:vertical;min-height:34px;max-height:110px;padding:6px 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:12.5px;}',
      '.dsh-tools-scMsg:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary,#3b82f6);}',
      '.dsh-tools-scActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '.dsh-tools-scBtn{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 11px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:inherit;font-size:12.5px;cursor:default;}',
      '.dsh-tools-scBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-scBtn:disabled{opacity:.55;}',
      '.dsh-tools-scBtn.is-primary{background:var(--dsw-alias-brand-primary,#3b82f6);border-color:transparent;color:#fff;}',
      '.dsh-tools-scBtn.is-primary:disabled{opacity:.6;}',
      '.dsh-tools-scBtn.is-danger{color:var(--dsw-alias-state-error-primary,#f85149);border-color:rgba(248,81,73,.45);}',
      '.dsh-tools-scBtn.is-danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.08);}',
      '.dsh-tools-scFileRevert{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:0;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;flex:none;opacity:0;transition:opacity 120ms ease,color 120ms ease,background-color 120ms ease;}',
      '.dsh-tools-scFile:hover .dsh-tools-scFileRevert,.dsh-tools-scFileRevert:focus-visible{opacity:1;}',
      '.dsh-tools-scFileRevert:hover{color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.10);}',
      '.dsh-tools-scModalWrap{position:fixed;inset:0;z-index:2100;display:flex;align-items:center;justify-content:center;background:rgba(15,17,23,.40);}',
      '.dsh-tools-scModal{width:min(420px,calc(100vw - 48px));display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:12px;background:var(--dsw-alias-bg-overlay,#242428);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 12px 32px rgba(15,17,23,.24);font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-scModalTitle{font-size:13.5px;font-weight:600;}',
      '.dsh-tools-scModalHead{font-weight:600;}',
      '.dsh-tools-scModalHead.is-del{color:var(--dsw-alias-state-error-primary,#f85149);}',
      '.dsh-tools-scModalList{display:flex;flex-direction:column;gap:4px;max-height:180px;overflow:auto;padding:8px 10px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.10));font-family:var(--dsw-alias-font-family-mono,monospace);font-size:11.5px;word-break:break-all;}',
      '.dsh-tools-scModalList .is-del{color:var(--dsw-alias-state-error-primary,#f85149);}',
      '.dsh-tools-scModalList .is-dim{color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-scModalActions{display:flex;gap:8px;justify-content:flex-end;}',
      '.dsh-tools-scNote{font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:0;word-break:break-word;}',
      '.dsh-tools-scNote.is-dim{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));opacity:.75;font-family:var(--dsw-alias-font-family-mono,monospace);}',
      '.dsh-tools-scNote.is-error{color:var(--dsw-alias-state-error-primary);}',
      '.dsh-tools-scNote.is-ok{color:var(--dsw-alias-state-success-primary,#3fb950);}',
      '.dsh-tools-scFootHint{padding:2px 12px 0;font-size:11px;color:var(--dsw-alias-label-secondary);flex:none;}',
      '.dsh-tools-scRootRow{display:flex;align-items:center;gap:8px;padding:2px 0;}',
      '.dsh-tools-scRootPath{flex:1;min-width:0;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left;}',
      '.dsh-tools-scRootRemove{display:inline-flex;align-items:center;height:22px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:default;flex:none;}',
      '.dsh-tools-scRootRemove:hover{color:var(--dsw-alias-state-error-primary);border-color:currentColor;}',
    ].join('\n');

    function ensureScStyles() {
      if (document.getElementById('dsh-tools-sc-styles') !== null) return;
      const style = document.createElement('style');
      style.id = 'dsh-tools-sc-styles';
      style.textContent = SC_CSS;
      document.head.append(style);
    }

    // Lightning-in-circle: energy/usage meter for the sidebar footer widget.
    const USAGE_GLYPH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>';

    const USAGE_REFRESH_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';

    // Sidebar footer chip (sidebar.footer.action renders its occupants in a
    // horizontal flex row; wide = expanded sidebar, !wide = 56px rail) plus
    // the detail popover it opens (body-level fixed panel).
    const USAGE_CSS = [
      '.dsh-tools-usageChip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 9px;margin:0 0 4px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:default;white-space:nowrap;}',
      '.dsh-tools-usageChip:hover,.dsh-tools-usageChip:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));color:var(--dsw-alias-label-primary);outline:none;}',
      '.dsh-tools-usageChip:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary,#3b82f6);}',
      '.dsh-tools-usageChipIcon{display:inline-flex;flex:none;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));}',
      '.dsh-tools-usageChipIcon.is-error{color:var(--dsw-alias-state-warn-primary,#d29922);}',
      '.dsh-tools-usageChipLabel{flex:none;color:inherit;}',
      '.dsh-tools-usageChipValue{font-family:var(--dsh-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11.5px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageChipValue.is-empty{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));}',
      '.dsh-tools-usageChipValue.is-error{color:var(--dsw-alias-state-warn-primary,#d29922);}',
      // rail (collapsed sidebar): icon-only square, centered by the shell
      '.dsh-tools-usageChip.is-rail{width:32px;height:32px;justify-content:center;padding:0;margin:0 0 4px;}',
      // ---- popover (fixed, body-level) — theme-adaptive data card ----
      '.dsh-tools-usagePop{--u-line:var(--dsw-alias-border-l1,rgba(128,128,128,.24));--u-fill:rgba(128,128,128,.07);--u-fill:color-mix(in srgb,var(--dsw-alias-label-primary,#8f8f96) 7%,transparent);--u-bar:rgba(128,128,128,.32);--u-bar:color-mix(in srgb,var(--dsw-alias-label-primary,#8f8f96) 26%,transparent);--u-in:#0284c7;--u-out:#d97706;--u-cr:var(--dsw-alias-brand-primary,#3b82f6);--u-cw:#7c3aed;position:fixed;z-index:2000;width:280px;padding:16px 16px 12px;border-radius:14px;background:var(--dsw-alias-bg-overlay,#232327);border:1px solid var(--u-line);box-shadow:0 12px 32px rgba(15,17,23,.16),0 2px 6px rgba(15,17,23,.08);font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary,#f2f2f2);animation:dsh-tools-usageIn 180ms cubic-bezier(.16,1,.3,1);}',
      '@keyframes dsh-tools-usageIn{from{opacity:0;transform:translateY(6px) scale(.98);}to{opacity:1;transform:none;}}',
      '@media (prefers-reduced-motion: reduce){.dsh-tools-usagePop{animation:none;}}',
      '.dsh-tools-usagePop *{box-sizing:border-box;}',
      '.dsh-tools-usageEyebrow{margin-bottom:5px;font-size:10.5px;font-weight:600;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary,#78787f);}',
      '.dsh-tools-usageHead{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;}',
      '.dsh-tools-usageTotal{font-family:var(--dsh-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:24px;line-height:1.05;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageDelta{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums;background:rgba(128,128,128,.12);background:color-mix(in srgb,currentColor 11%,transparent);}',
      '.dsh-tools-usageDelta.is-up{color:#dc2626;}',
      '.dsh-tools-usageDelta.is-down{color:#16a34a;}',
      '.dsh-tools-usageComp{display:flex;gap:2px;height:8px;margin:14px 0 4px;}',
      '.dsh-tools-usageCompSeg{flex:none;min-width:0;border-radius:999px;transition:width 420ms cubic-bezier(.16,1,.3,1);}',
      '.dsh-tools-usageBuckets{display:flex;flex-direction:column;gap:1px;}',
      '.dsh-tools-usageBucketRow{display:flex;align-items:center;gap:8px;height:24px;padding:0 6px;margin:0 -6px;border-radius:7px;}',
      '.dsh-tools-usageBucketRow:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));}',
      '.dsh-tools-usageDot{width:8px;height:8px;border-radius:3px;flex:none;}',
      '.dsh-tools-usageBucketName{flex:1;min-width:0;color:var(--dsw-alias-label-secondary,#a8a8ad);font-size:12px;}',
      '.dsh-tools-usageBucketValue{flex:none;font-family:var(--dsw-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:12px;font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageBucketShare{width:44px;flex:none;text-align:right;color:var(--dsw-alias-label-tertiary,#78787f);font-size:11px;font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageStats{display:flex;gap:8px;margin:12px 0 0;}',
      '.dsh-tools-usageStat{flex:1;min-width:0;padding:8px 10px;border-radius:10px;background:var(--u-fill);}',
      '.dsh-tools-usageStatValue{font-family:var(--dsh-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageStatLabel{margin-top:1px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#78787f);}',
      '.dsh-tools-usageChartTitle{margin:14px 0 7px;font-size:10.5px;font-weight:600;letter-spacing:.06em;color:var(--dsw-alias-label-tertiary,#78787f);}',
      '.dsh-tools-usageChart{display:flex;flex-direction:column;}',
      '.dsh-tools-usageChartRow{position:relative;display:flex;align-items:flex-end;gap:6px;height:44px;padding-bottom:5px;border-bottom:1px solid var(--u-line);}',
      '.dsh-tools-usageCol{flex:1;display:flex;align-items:flex-end;justify-content:center;height:100%;min-width:0;}',
      '.dsh-tools-usageColBar{width:100%;max-width:18px;min-height:3px;border-radius:4px 4px 2px 2px;background:var(--u-bar);transition:height 300ms cubic-bezier(.16,1,.3,1);}',
      '.dsh-tools-usageCol.is-today .dsh-tools-usageColBar{background:var(--dsw-alias-brand-primary,#3b82f6);box-shadow:0 0 10px rgba(59,130,246,.35);}',
      '.dsh-tools-usageCol:hover .dsh-tools-usageColBar{filter:brightness(1.45);}',
      '.dsh-tools-usageChartTags{display:flex;gap:6px;margin-top:4px;}',
      '.dsh-tools-usageColTag{flex:1;min-width:0;text-align:center;font-size:9.5px;line-height:1;color:var(--dsw-alias-label-tertiary,#78787f);font-variant-numeric:tabular-nums;}',
      '.dsh-tools-usageColTag.is-today{color:var(--dsw-alias-label-secondary,#a8a8ad);font-weight:600;}',
      '.dsh-tools-usageTip{position:absolute;bottom:calc(100% + 9px);left:0;transform:translateX(-50%);padding:5px 9px;border-radius:7px;background:var(--dsw-alias-bg-overlay,#242428);border:1px solid var(--u-line);box-shadow:0 4px 14px rgba(15,17,23,.18);white-space:nowrap;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-primary,#f2f2f2);pointer-events:none;opacity:0;transition:opacity 120ms ease;z-index:3;}',
      '.dsh-tools-usageTip.is-open{opacity:1;}',
      '.dsh-tools-usageTipDate{color:var(--dsw-alias-label-tertiary,#78787f);font-size:10.5px;}',
      '.dsh-tools-usageTipValue{font-family:var(--dsw-alias-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-weight:600;}',
      '.dsh-tools-usageTipValue .dsh-tools-usageTipReq{margin-left:6px;color:var(--dsw-alias-label-secondary,#a8a8ad);font-weight:400;}',
      '.dsh-tools-usageFoot{display:flex;align-items:center;gap:6px;margin-top:12px;padding-top:9px;border-top:1px solid var(--u-line);color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;}',
      '.dsh-tools-usageStamp{flex:1;min-width:0;}',
      '.dsh-tools-usageRefresh{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:default;flex:none;}',
      '.dsh-tools-usageRefresh:hover:not(:disabled),.dsh-tools-usageRefresh:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary);outline:none;}',
      '.dsh-tools-usageRefresh:disabled{opacity:.5;}',
      '.dsh-tools-usageRefresh.is-busy svg{animation:dsh-tools-rot 1s linear infinite;}',
      '.dsh-tools-usageWarn{margin-top:6px;color:var(--dsw-alias-state-warn-primary,#d29922);font-size:11px;}',
      '.dsh-tools-usageState{display:flex;flex-direction:column;gap:8px;padding:10px 2px 6px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-usageStateText{font-size:12px;}',
      '.dsh-tools-usageRetry{align-self:flex-start;height:24px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:inherit;font-size:11.5px;cursor:default;}',
      '.dsh-tools-usageRetry:hover{border-color:var(--dsw-alias-label-secondary);color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-usageSkel{display:flex;flex-direction:column;gap:8px;padding:4px 0;}',
      '.dsh-tools-usageSkelBar{height:10px;border-radius:5px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.18));animation:dsh-tools-usagePulse 1.2s ease-in-out infinite;}',
      '.dsh-tools-usageSkelBar:nth-child(2){width:78%;animation-delay:.12s;}',
      '.dsh-tools-usageSkelBar:nth-child(3){width:56%;animation-delay:.24s;}',
      '@keyframes dsh-tools-usagePulse{0%,100%{opacity:.45;}50%{opacity:.9;}}',
      '@media (prefers-reduced-motion: reduce){.dsh-tools-usageCompSeg,.dsh-tools-usageColBar,.dsh-tools-usageTip{transition:none;}.dsh-tools-usageSkelBar{animation:none;}}',
    ].join('\n');

    function ensureUsageStyles() {
      if (document.getElementById('dsh-tools-usage-styles') !== null) return;
      const style = document.createElement('style');
      style.id = 'dsh-tools-usage-styles';
      style.textContent = USAGE_CSS;
      document.head.append(style);
    }

    // ---- usage popover (plain DOM, body-level, anchored to the chip) ----
    //
    // Managed outside React on purpose: the chip lives in the sidebar footer
    // slot, but the popover must escape any overflow container and survive
    // slot re-mounts. One popover at a time; re-renders ride usageStore.
    const usagePopover = {
      el: null,
      anchor: null,
      opts: null,
      unsubscribe: null,
      onPointerDown: null,
      onKeyDown: null,
      onLayout: null,

      open(anchor, opts) {
        if (usagePopover.el !== null) {
          if (usagePopover.anchor === anchor) return;
          usagePopover.close();
        }
        ensureUsageStyles();
        usagePopover.anchor = anchor;
        usagePopover.opts = opts ?? {};
        const pop = document.createElement('div');
        pop.className = 'dsh-tools-usagePop';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', usagePopover.opts.t?.('usageTitle') ?? 'usage');
        usagePopover.el = pop;
        usagePopover.render();
        document.body.append(pop);
        usagePopover.position();
        usagePopover.unsubscribe = usageStore.subscribe(() => usagePopover.render());
        usagePopover.onPointerDown = (event) => {
          const target = event.target;
          if (pop.contains(target) || (usagePopover.anchor !== null && usagePopover.anchor.contains(target))) return;
          usagePopover.close();
        };
        usagePopover.onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            usagePopover.close();
            usagePopover.anchor?.focus?.();
          }
        };
        usagePopover.onLayout = () => usagePopover.position();
        window.addEventListener('pointerdown', usagePopover.onPointerDown, true);
        window.addEventListener('keydown', usagePopover.onKeyDown, true);
        window.addEventListener('resize', usagePopover.onLayout, true);
        window.addEventListener('scroll', usagePopover.onLayout, true);
      },

      position() {
        const { el, anchor } = usagePopover;
        if (el === null || anchor === null || anchor.isConnected !== true) return;
        const rect = anchor.getBoundingClientRect();
        const margin = 8;
        const width = 280;
        let left = Math.round(rect.left);
        left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
        let top = Math.round(rect.top) - el.offsetHeight - 8;
        if (top < margin) top = Math.min(rect.bottom + 8, window.innerHeight - el.offsetHeight - margin);
        el.style.left = `${Math.max(margin, left)}px`;
        el.style.top = `${Math.max(margin, top)}px`;
      },

      render() {
        const { el, opts } = usagePopover;
        if (el === null) return;
        const t = typeof opts.t === 'function' ? opts.t : (key) => key;
        const { status, data, error, updatedAt } = usageStore.state;
        el.textContent = '';

        if (data === null && (status === 'idle' || status === 'loading')) {
          const box = document.createElement('div');
          box.className = 'dsh-tools-usageState';
          const skel = document.createElement('div');
          skel.className = 'dsh-tools-usageSkel';
          skel.append(
            Object.assign(document.createElement('div'), { className: 'dsh-tools-usageSkelBar' }),
            Object.assign(document.createElement('div'), { className: 'dsh-tools-usageSkelBar' }),
            Object.assign(document.createElement('div'), { className: 'dsh-tools-usageSkelBar' }),
          );
          box.append(skel);
          el.append(box);
          usagePopover.position();
          return;
        }
        if (status === 'error' && data === null) {
          const box = document.createElement('div');
          box.className = 'dsh-tools-usageState';
          const text = document.createElement('div');
          text.className = 'dsh-tools-usageStateText';
          text.textContent = `${t('usageError')} · ${error}`;
          const retry = document.createElement('button');
          retry.type = 'button';
          retry.className = 'dsh-tools-usageRetry';
          retry.textContent = t('usageRetry');
          retry.addEventListener('click', () => { usageStore.refresh(true); });
          box.append(text, retry);
          el.append(box);
          usagePopover.position();
          return;
        }

        const today = data?.today;
        const buckets = [
          ['usageInput', today?.inputTokens ?? 0, 'var(--u-in,#0284c7)'],
          ['usageOutput', today?.outputTokens ?? 0, 'var(--u-out,#d97706)'],
          ['usageCacheRead', today?.cacheReadTokens ?? 0, 'var(--u-cr,#3b82f6)'],
          ['usageCacheWrite', today?.cacheWriteTokens ?? 0, 'var(--u-cw,#7c3aed)'],
        ];
        const totalTokens = today?.total ?? 0;
        const isEmpty = totalTokens === 0 && (today?.requests ?? 0) === 0;

        // eyebrow + hero total + vs-yesterday delta chip
        const eyebrow = document.createElement('div');
        eyebrow.className = 'dsh-tools-usageEyebrow';
        eyebrow.textContent = t('usageTitle');
        const head = document.createElement('div');
        head.className = 'dsh-tools-usageHead';
        const total = document.createElement('div');
        total.className = 'dsh-tools-usageTotal';
        total.title = String(totalTokens);
        total.textContent = formatTokens(totalTokens);
        head.append(total);
        const allDays = Array.isArray(data?.days) ? data.days : [];
        const yesterday = allDays.length >= 2 ? allDays[allDays.length - 2] : null;
        if (yesterday !== null && (yesterday.total ?? 0) > 0 && totalTokens > 0) {
          const pct = Math.max(-999, Math.min(999, Math.round(((totalTokens - yesterday.total) / yesterday.total) * 100)));
          if (pct !== 0) {
            const delta = document.createElement('div');
            delta.className = `dsh-tools-usageDelta ${pct > 0 ? 'is-up' : 'is-down'}`;
            delta.title = `${t('usageWeek')} Δ`;
            delta.textContent = `${pct > 0 ? '↑' : '↓'}${Math.abs(pct)}%`;
            head.append(delta);
          }
        }
        el.append(eyebrow, head);

        if (isEmpty) {
          const empty = document.createElement('div');
          empty.className = 'dsh-tools-usageStateText';
          empty.style.marginTop = '10px';
          empty.textContent = t('usageEmpty');
          el.append(empty);
        } else {
          // stacked composition bar (proportions of today's total)
          const comp = document.createElement('div');
          comp.className = 'dsh-tools-usageComp';
          buckets.forEach(([, value], i) => {
            const seg = document.createElement('div');
            seg.className = 'dsh-tools-usageCompSeg';
            seg.style.background = buckets[i][2];
            seg.style.width = `${Math.max(0, Math.round((value / Math.max(1, totalTokens)) * 100))}%`;
            seg.style.transitionDelay = `${i * 40}ms`;
            comp.append(seg);
          });
          // legend rows: dot + label + value + share
          const rows = document.createElement('div');
          rows.className = 'dsh-tools-usageBuckets';
          for (const [key, value, color] of buckets) {
            const row = document.createElement('div');
            row.className = 'dsh-tools-usageBucketRow';
            const dot = document.createElement('div');
            dot.className = 'dsh-tools-usageDot';
            dot.style.background = color;
            const name = document.createElement('div');
            name.className = 'dsh-tools-usageBucketName';
            name.textContent = t(key);
            const valueEl = document.createElement('div');
            valueEl.className = 'dsh-tools-usageBucketValue';
            valueEl.textContent = formatTokens(value);
            const share = document.createElement('div');
            share.className = 'dsh-tools-usageBucketShare';
            share.textContent = `${Math.round((value / Math.max(1, totalTokens)) * 100)}%`;
            row.append(dot, name, valueEl, share);
            rows.append(row);
          }
          el.append(comp, rows);
        }

        // request / active-session stat cells
        const stats = document.createElement('div');
        stats.className = 'dsh-tools-usageStats';
        const statDefs = [
          [String((today?.requests ?? 0).toLocaleString()), t('usageRequests')],
          [String((data?.activeSessions ?? 0).toLocaleString()), t('usageSessions')],
        ];
        for (const [valueText, labelText] of statDefs) {
          const cell = document.createElement('div');
          cell.className = 'dsh-tools-usageStat';
          const v = document.createElement('div');
          v.className = 'dsh-tools-usageStatValue';
          v.textContent = valueText;
          const l = document.createElement('div');
          l.className = 'dsh-tools-usageStatLabel';
          l.textContent = labelText;
          cell.append(v, l);
          stats.append(cell);
        }
        el.append(stats);

        // last-7-days mini chart (payload carries 14; show the recent week)
        const days = Array.isArray(data?.days) ? data.days.slice(-7) : [];
        if (days.length > 0) {
          const chartTitle = document.createElement('div');
          chartTitle.className = 'dsh-tools-usageChartTitle';
          chartTitle.textContent = t('usageWeek');
          const chart = document.createElement('div');
          chart.className = 'dsh-tools-usageChart';
          const row = document.createElement('div');
          row.className = 'dsh-tools-usageChartRow';
          const tags = document.createElement('div');
          tags.className = 'dsh-tools-usageChartTags';
          const maxDay = Math.max(1, ...days.map((day) => day.total ?? 0));
          const dayNames = String(t('usageDayNames') || '').split(',');
          const weekdayOf = (key) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? ''));
            if (!m) return '';
            const idx = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay();
            return dayNames[idx] ?? '';
          };
          // one shared tooltip repositioned over the hovered column (instant, no native title lag)
          const tip = document.createElement('div');
          tip.className = 'dsh-tools-usageTip';
          tip.setAttribute('aria-hidden', 'true');
          const tipDate = document.createElement('div');
          tipDate.className = 'dsh-tools-usageTipDate';
          const tipValue = document.createElement('div');
          tipValue.className = 'dsh-tools-usageTipValue';
          tip.append(tipDate, tipValue);
          const hideTip = () => { tip.className = 'dsh-tools-usageTip'; };
          for (const day of days) {
            const col = document.createElement('div');
            col.className = `dsh-tools-usageCol${day.isToday ? ' is-today' : ''}`;
            const bar = document.createElement('div');
            bar.className = 'dsh-tools-usageColBar';
            const height = Math.max(3, Math.round(((day.total ?? 0) / maxDay) * 38));
            bar.style.height = `${height}px`;
            const mmdd = String(day.day ?? '').slice(5);
            const weekday = weekdayOf(day.day);
            const dateText = `${mmdd}${weekday ? ` ${weekday}` : ''}${day.isToday ? ` · ${t('usageTodayLabel')}` : ''}`;
            const totalText = formatTokens(day.total ?? 0);
            col.setAttribute('role', 'img');
            col.setAttribute('aria-label', `${dateText} · ${totalText} · ${t('usageRequests')} ${day.requests ?? 0}`);
            const showTip = () => {
              tipDate.textContent = dateText;
              tipValue.textContent = '';
              const valueText = document.createElement('span');
              valueText.textContent = totalText;
              const req = document.createElement('span');
              req.className = 'dsh-tools-usageTipReq';
              req.textContent = `${t('usageRequests')} ${day.requests ?? 0}`;
              tipValue.append(valueText, req);
              tip.className = 'dsh-tools-usageTip is-open';
              // clamp horizontally inside the chart so edge columns stay readable
              const rowWidth = row.offsetWidth || 0;
              const center = (col.offsetLeft ?? 0) + (col.offsetWidth || 0) / 2;
              let x = center;
              if (rowWidth > 0) {
                const half = (tip.offsetWidth || 0) / 2;
                if (x - half < 0) x = half;
                if (x + half > rowWidth) x = Math.max(half, rowWidth - half);
              }
              tip.style.left = `${Math.round(x)}px`;
            };
            col.addEventListener('mouseenter', showTip);
            col.addEventListener('mouseleave', hideTip);
            col.append(bar);
            row.append(col);
            const tag = document.createElement('div');
            tag.className = `dsh-tools-usageColTag${day.isToday ? ' is-today' : ''}`;
            tag.textContent = day.isToday ? t('usageTodayShort') : (weekday.length === 2 ? weekday.slice(1) : weekday);
            tags.append(tag);
          }
          row.append(tip);
          row.addEventListener('mouseleave', hideTip);
          chart.append(row, tags);
          el.append(chartTitle, chart);
        }

        const foot = document.createElement('div');
        foot.className = 'dsh-tools-usageFoot';
        const stamp = document.createElement('div');
        stamp.className = 'dsh-tools-usageStamp';
        stamp.textContent = updatedAt > 0
          ? `${t('usageUpdated')} ${new Date(updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          : '';
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.className = 'dsh-tools-usageRefresh';
        refresh.title = t('usageRefresh');
        refresh.setAttribute('aria-label', t('usageRefresh'));
        refresh.innerHTML = USAGE_REFRESH_GLYPH;
        if (usageStore.state.status === 'loading' || usageStore._inflight !== null) refresh.disabled = true;
        refresh.addEventListener('click', () => { usageStore.refresh(true); });
        foot.append(stamp, refresh);
        el.append(foot);

        if (data?.partial === true) {
          const warn = document.createElement('div');
          warn.className = 'dsh-tools-usageWarn';
          warn.textContent = t('usagePartial');
          el.append(warn);
        }
        usagePopover.position();
      },

      close() {
        if (usagePopover.unsubscribe !== null) {
          usagePopover.unsubscribe();
          usagePopover.unsubscribe = null;
        }
        if (usagePopover.onPointerDown !== null) {
          window.removeEventListener('pointerdown', usagePopover.onPointerDown, true);
          usagePopover.onPointerDown = null;
        }
        if (usagePopover.onKeyDown !== null) {
          window.removeEventListener('keydown', usagePopover.onKeyDown, true);
          usagePopover.onKeyDown = null;
        }
        if (usagePopover.onLayout !== null) {
          window.removeEventListener('resize', usagePopover.onLayout, true);
          window.removeEventListener('scroll', usagePopover.onLayout, true);
          usagePopover.onLayout = null;
        }
        if (usagePopover.el !== null) {
          usagePopover.el.remove();
          usagePopover.el = null;
        }
        const onClose = usagePopover.opts?.onClose;
        usagePopover.anchor = null;
        usagePopover.opts = null;
        if (typeof onClose === 'function') {
          try { onClose(); } catch { /* chip may already be gone */ }
        }
      },
    };

    function ensureGenStyles() {
      if (document.getElementById('dsh-tools-gen-styles') !== null) return;
      const style = document.createElement('style');
      style.id = 'dsh-tools-gen-styles';
      style.textContent = GEN_CSS;
      document.head.append(style);
    }

    // The chat flow renders one [data-chat-flow-kind] row per node; assistant
    // prose lives in kind="assistant-step" rows. innerText is the rendered
    // markdown, which is exactly what a reader would reply to.
    function findLastAssistantText() {
      const rows = document.querySelectorAll('[data-chat-flow-kind="assistant-step"]');
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const text = (rows[i].innerText ?? '').trim();
        if (text !== '') return text;
      }
      return '';
    }

    // The composer is a Lexical contenteditable inside [data-composer-card];
    // select-all + insertText goes through beforeinput, which Lexical applies.
    function insertDraftIntoComposer(startNode, draft) {
      const card = startNode?.closest?.('[data-composer-card]') ?? null;
      const editor = card?.querySelector('[contenteditable="true"]') ?? null;
      if (editor === null) return false;
      editor.focus();
      document.execCommand('selectAll', false, null);
      const inserted = document.execCommand('insertText', false, draft);
      if (inserted !== true) {
        editor.textContent = draft;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: draft }));
      }
      return true;
    }

    // Quick phrases insert at the caret instead of replacing the draft: focus
    // restores Lexical's last selection, and insertText without a prior
    // selectAll appends right after the caret (user request 2026-11-23).
    function insertPhraseAtCaret(startNode, text) {
      const card = startNode?.closest?.('[data-composer-card]') ?? null;
      const editor = card?.querySelector('[contenteditable="true"]') ?? null;
      if (editor === null) return false;
      editor.focus();
      const inserted = document.execCommand('insertText', false, text);
      if (inserted !== true) {
        // Rare fallback: append at the end via an input event Lexical accepts.
        editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
      }
      return true;
    }

    /** Current text of the composer nearest to startNode ('' when absent). */
    function readComposerText(startNode) {
      const card = startNode?.closest?.('[data-composer-card]') ?? null;
      const editor = card?.querySelector('[contenteditable]') ?? null;
      return editor === null ? '' : String(editor.innerText ?? '').trim();
    }

    /**
     * Lock/unlock the composer while a draft/optimize request streams, so the
     * user cannot race the model by typing over the box (user request
     * 2026-11-20). Toggling contenteditable also stops Lexical from accepting
     * beforeinput; pointer-events + dimming make the state visible.
     */
    function setComposerLock(startNode, locked) {
      const card = startNode?.closest?.('[data-composer-card]') ?? null;
      const editor = card?.querySelector('[contenteditable]') ?? null;
      if (card === null || editor === null) return;
      if (locked) {
        card.setAttribute('data-dsh-tools-locked', '');
        editor.setAttribute('contenteditable', 'false');
      } else {
        card.removeAttribute('data-dsh-tools-locked');
        editor.setAttribute('contenteditable', 'true');
      }
    }

    // Terminal-style input history: with the caret in the composer, ArrowUp
    // loads the previous message you sent, ArrowDown walks back toward the
    // newest; cycling past the newest restores the draft you were typing.
    // Reading the history from the DOM ([data-chat-flow-kind="user"] rows)
    // keeps it always in sync with what the session actually shows.
    function registerHistoryNavigation() {
      if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};

      const editorFor = (node) => {
        const card = node?.closest?.('[data-composer-card]');
        return card?.querySelector('[contenteditable="true"]') ?? null;
      };

      // A timestamp that can sit between the visible text and an extra copy of
      // it inside one row's innerText: zh dates, times, ISO dates, en dates.
      const STAMP_LINE = /^(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?|\d{1,2}月\s*\d{1,2}日(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?|\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?)$/;
      const STAMP_GAP = /^\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?|\d{1,2}月\s*\d{1,2}日(?:\s*\d{1,2}:\d{2}(?::\d{2})?)?|\d{4}-\d{1,2}-\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?|[A-Za-z]{3,9}\s+\d{1,2}(?:,?\s*\d{4})?|[A-Za-z]{3,9},?\s+\d{1,2},?\s+\d{4})\s*$/;

      // User rows can render the message text more than once (a visible copy
      // plus a hidden preview/edit copy) plus an inline clock stamp. The
      // preferred reader takes the bubble's own text — the clock lives outside
      // [data-message-bubble], so no stamp stripping is needed there. The full
      // row fallback additionally folds the "TEXT stamp TEXT" duplication so
      // only the plain text the user actually typed remains. Folding only ever
      // removes a copy separated from its twin by an actual timestamp, so real
      // repeated text ("哈哈哈哈哈哈哈哈") is never mangled.
      const cleanHistoryText = (raw, allowFold = false) => {
        let text = String(raw ?? '').replace(/\u00a0/g, ' ');
        // Standalone stamp lines are dropped; times inside a sentence
        // ("会议改到 14:30") survive because they are not whole lines.
        const lines = text.split('\n').map((line) => line.trim())
          .filter((line) => line !== '' && !STAMP_LINE.test(line));
        text = lines.join('\n').trim();
        if (!allowFold) return text;
        // Whole-line twins with only stamp lines between them.
        if (lines.length >= 2 && lines[0].length >= 2 && lines[0] === lines[lines.length - 1]
          && lines.slice(1, -1).every((line) => STAMP_LINE.test(line) || STAMP_GAP.test(line.trim()))) {
          return lines[0];
        }
        // Inline twins: identical head and tail with a timestamp-only gap
        // ("帮我安装 11:11帮我安装"). The gap must be a real timestamp, so
        // ordinary sentences with repeated phrases are left alone.
        const max = Math.floor(text.length / 2);
        for (let len = Math.min(max, 400); len >= 2; len -= 1) {
          const head = text.slice(0, len);
          const tail = text.slice(text.length - len);
          if (head !== tail) continue;
          const gap = text.slice(len, text.length - len);
          if (gap !== '' && STAMP_GAP.test(gap)) return head;
        }
        return text;
      };

      const readHistory = () => {
        // Durable user rows only: pending echoes render without the flow-kind
        // wrapper, so a message never appears twice from echo + durable.
        const rows = document.querySelectorAll('[data-chat-flow-kind="user"], [data-chat-flow-kind="steering"]');
        const items = [];
        for (const row of rows) {
          const bubble = row.querySelector('[data-message-bubble]');
          const fromBubble = bubble !== null;
          const text = cleanHistoryText(fromBubble ? bubble.innerText : row.innerText, !fromBubble);
          if (text !== '') items.push(text);
        }
        // Collapse adjacent twins (same text mounted in neighboring rows after
        // retries/rewind forks) so stepping through history is one step per
        // distinct message.
        return items.filter((text, index) => index === 0 || text !== items[index - 1]);
      };

      const isCaretAtVeryStart = (editor) => {
        const selection = window.getSelection();
        if (selection === null || !selection.isCollapsed) return false;
        if ((editor.textContent ?? '') === '') return true;
        let node = editor.firstChild;
        while (node !== null) {
          if (node.nodeType === Node.TEXT_NODE) {
            return selection.anchorNode === node && selection.anchorOffset === 0;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) { node = node.nextSibling; continue; }
          node = node.firstChild ?? node.nextSibling;
        }
        return false;
      };

      // Navigation tracks the recalled TEXT, not an array index: readHistory()
      // rebuilds the array on every keypress and rows mount/unmount as the
      // session streams, which used to shift a raw pointer and make ArrowUp
      // replay the same entry or get stuck. `hintIndex` only survives the
      // unlikely case of the recalled row vanishing between keypresses.
      let recalled = null;   // null = at the live draft; otherwise the history text in the box
      let hintIndex = null;  // last known index of `recalled` in the history array
      let draft = '';
      let loading = false;   // true while loadInto drives the editor itself
      const loadInto = (editor, text) => {
        loading = true;
        try {
          editor.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, text);
          editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        } finally {
          loading = false;
        }
      };

      const locateRecalled = (history) => {
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i] === recalled) return i;
        }
        const hint = hintIndex === null ? history.length : hintIndex;
        return Math.min(hint, history.length - 1);
      };

      const onKeyDown = (event) => {
        if (!featureFlags.history) return;
        const editor = editorFor(event.target);
        if (editor === null) return;
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          const history = readHistory();
          // The composer can also be rewritten from the outside without any
          // beforeinput (Lexical clears it after send). If the text on screen
          // no longer matches what we believe we recalled, the pointer is
          // stale: drop back to live-draft mode so the next ArrowUp re-enters
          // at the newest entry instead of walking from a dead position.
          if (recalled !== null && cleanHistoryText(editor.innerText) !== recalled) {
            recalled = null;
            hintIndex = null;
          }
          if (event.key === 'ArrowUp') {
            if (recalled === null) {
              if (history.length === 0) return;
              // Enter history from an empty box, any caret position in a
              // single-line draft (terminal habit: ↑ always recalls), or the
              // very start of a multiline draft — there ArrowUp must keep
              // moving the caret between lines instead.
              const singleLine = !(editor.innerText ?? '').includes('\n');
              if (!singleLine && !isCaretAtVeryStart(editor)) return;
              draft = editor.innerText ?? '';
              hintIndex = history.length - 1;
              recalled = history[hintIndex];
            } else {
              // Walk one distinct entry older; stay put at the oldest.
              let i = locateRecalled(history);
              let j = i - 1;
              while (j >= 0 && history[j] === recalled) j -= 1;
              if (j < 0) return; // already at the oldest distinct entry
              hintIndex = j;
              recalled = history[j];
            }
            event.preventDefault();
            event.stopPropagation();
            loadInto(editor, recalled);
            return;
          }
          if (recalled === null) return; // ArrowDown at the draft: caret moves normally
          event.preventDefault();
          event.stopPropagation();
          const i = locateRecalled(history);
          let j = i + 1;
          while (j < history.length && history[j] === recalled) j += 1;
          if (j >= history.length) {
            recalled = null;
            hintIndex = null;
            loadInto(editor, draft);
          } else {
            hintIndex = j;
            recalled = history[j];
            loadInto(editor, history[j]);
          }
          return;
        }
      };

      // Any real edit of the composer text (typing, IME, paste, cut, drop,
      // submit clearing the box) returns to live-draft mode. beforeinput fires
      // for all of those; loadInto's own execCommand writes are excluded via
      // the `loading` guard, so recalling never resets itself.
      const onBeforeInput = (event) => {
        if (loading || recalled === null) return;
        const target = event.target;
        if (target instanceof Element && target.closest?.('[data-composer-card]') != null) {
          recalled = null;
          hintIndex = null;
        }
      };

      document.addEventListener('keydown', onKeyDown, true);
      document.addEventListener('beforeinput', onBeforeInput, true);
      return () => {
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('beforeinput', onBeforeInput, true);
        recalled = null;
        hintIndex = null;
      };
    }


    function detectLang() {
      const lang = String(document.documentElement.lang ?? '').toLowerCase();
      return lang.startsWith('zh') ? 'zh' : 'en';
    }

    return {
      inject: ['connection', 'slots'],
      apply(ctx) {
        const disposers = [];
        const keep = (dispose) => { disposers.push(dispose); return dispose; };

        // ---- locale: prefer the Client locale service; fall back to <html lang> ----
        let lang = detectLang();
        let translate = null;
        try {
          const locale = ctx.get('locale');
          if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
            locale.register('dsh-tools', 'zh', DICTS.zh);
            locale.register('dsh-tools', 'en', DICTS.en);
            const bound = locale.bind('dsh-tools');
            if (typeof bound === 'function') translate = bound;
          }
        } catch { /* fall back to <html lang> */ }
        const t = (key) => {
          if (translate !== null) {
            try {
              const value = translate(key);
              if (typeof value === 'string' && value !== '') return value;
            } catch { /* fall through */ }
          }
          const dict = DICTS[lang] ?? DICTS.en;
          return dict[key] ?? DICTS.en[key] ?? key;
        };

        const call = (method, payload) =>
          ctx.connection.rpc.call('/api', 'dsh-tools', { method, payload });

        // TEMP diagnostic beacon: lands in the host debug log via debug.beacon.
        const beacon = (tag, extra) => {
          try {
            Promise.resolve(call('debug.beacon', { tag, ...(extra ?? {}) }))
              .catch(() => {});
          } catch { /* ignore */ }
        };
        beacon('client-apply');
        // Bind the usage RPC EARLY and never unbind: HMR swaps dispose the old
        // apply AFTER the new one registers, so a cleanup-time `usageCall = null`
        // races the new registration and leaves the store silently erroring
        // with 'rpc unavailable' (no RPC, no log entry — chip dead).
        usageCall = (method, payload) => call(method, payload);
        usageBeacon = (tag, extra) => { try { beacon(tag, extra); } catch { /* ignore */ } };

        // ---- composer assist buttons (slot conversation.input.right) ----
        // One registrar, two slot items: 生成 (intent reply from the last AI
        // reply) and 优化 (rewrite the prompt in the composer). Both lock the
        // composer while their request streams and unlock it on settle.
        const registerComposerButtons = () => {
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureGenStyles();

          // shared busy guard: only one assist flight at a time, per window
          let assistBusy = false;

          const runAssist = async (anchor, method, payload, messages) => {
            if (assistBusy) return;
            assistBusy = true;
            setComposerLock(anchor, true);
            try {
              const result = await call(method, payload);
              if (result?.ok === true && typeof result.value?.draft === 'string' && result.value.draft !== '') {
                setComposerLock(anchor, false);
                insertDraftIntoComposer(anchor, result.value.draft);
                return { ok: true };
              }
              const err = result?.error;
              return {
                ok: false,
                message: typeof err?.message === 'string' && err.message !== ''
                  ? (typeof err?.code === 'string' && err.code !== '' ? `[${err.code}] ${err.message}` : err.message)
                  : messages.failed,
              };
            } catch (error) {
              return { ok: false, message: error?.message ?? String(error) };
            } finally {
              setComposerLock(anchor, false);
              assistBusy = false;
            }
          };

          const AssistButton = ({ kind }) => {
            const [state, setState] = React.useState('idle');   // idle | busy | done | error
            const [note, setNote] = React.useState('');
            const revertTimer = React.useRef(null);
            React.useEffect(() => () => {
              if (revertTimer.current !== null) clearTimeout(revertTimer.current);
            }, []);

            const flash = (message, ms) => {
              setNote(message);
              if (revertTimer.current !== null) clearTimeout(revertTimer.current);
              revertTimer.current = setTimeout(() => { setState('idle'); setNote(''); }, ms);
            };

            const enabled = kind === 'optimize' ? featureFlags.optimize : featureFlags.generate;

            const onRun = async (event) => {
              if (state === 'busy') return;
              const anchor = event?.currentTarget ?? document.activeElement;
              let payload;
              if (kind === 'optimize') {
                const prompt = readComposerText(anchor);
                if (prompt === '') {
                  setState('error');
                  flash(t('optimizeEmpty'), 3000);
                  return;
                }
                payload = { prompt, lang: lang === 'zh' ? 'zh' : 'en' };
              } else {
                const lastReply = findLastAssistantText();
                if (lastReply === '') {
                  setState('error');
                  flash(t('generateNoReply'), 3000);
                  return;
                }
                payload = { lastReply, lang: lang === 'zh' ? 'zh' : 'en' };
              }
              setState('busy');
              setNote(kind === 'optimize' ? t('optimizing') : t('generating'));
              const result = await runAssist(anchor, kind === 'optimize' ? 'optimize' : 'suggest', payload,
                { failed: kind === 'optimize' ? t('optimizeFailed') : t('generateFailed') });
              if (result.ok) {
                setState('done');
                setNote(kind === 'optimize' ? t('optimize') : t('generate'));
                if (revertTimer.current !== null) clearTimeout(revertTimer.current);
                revertTimer.current = setTimeout(() => { setState('idle'); setNote(''); }, 2000);
              } else {
                setState('error');
                flash(result.message, 5000);
              }
            };

            const busy = state === 'busy';
            const className = `dsh-tools-gen${busy ? ' is-busy' : ''}${state === 'error' ? ' is-error' : ''}`;
            const idleLabel = kind === 'optimize' ? t('optimize') : t('generate');
            const label = busy || state === 'error' ? note : (state === 'done' ? note : idleLabel);
            return React.createElement('button', {
              type: 'button',
              className,
              title: state === 'error' ? note : (kind === 'optimize' ? t('optimizeTitle') : t('generateTitle')),
              disabled: busy,
              onClick: (event) => { void onRun(event); },
            },
            React.createElement('span', {
              className: 'dsh-tools-genIcon',
              dangerouslySetInnerHTML: { __html: kind === 'optimize' ? OPT_GLYPH : GEN_GLYPH },
            }),
            React.createElement('span', null, label));
          };

          const GenerateButton = () => (featureFlags.generate
            ? React.createElement(AssistButton, { kind: 'generate' }) : null);
          const OptimizeButton = () => (featureFlags.optimize
            ? React.createElement(AssistButton, { kind: 'optimize' }) : null);

          const effectBody = () => ctx.slots.inject('conversation.input.right', () => {
            const disposers = [];
            disposers.push(ctx.slots.register(
              { name: 'conversation.input.right', id: 'dsh-tools-generate', order: 10, label: () => t('generate') },
              () => React.createElement(GenerateButton),
            ));
            disposers.push(ctx.slots.register(
              { name: 'conversation.input.right', id: 'dsh-tools-optimize', order: 11, label: () => t('optimize') },
              () => React.createElement(OptimizeButton),
            ));
            return () => { for (const dispose of disposers) { try { dispose(); } catch { /* already gone */ } } };
          });
          // ctx.effect ties the contribution to the fiber lifetime when the
          // service exposes it; plain call otherwise.
          if (typeof ctx.effect === 'function') {
            return ctx.effect(effectBody, 'dsh-tools: composer buttons');
          }
          return effectBody();
        };

        // ---- quick phrases row (in flow inside the composer card) ----
        // Click inserts at the caret (user request 2026-11-23). Reads
        // phraseStore so the settings panel can refresh every mounted row
        // without re-registering the slot.
        // Placement (user report 2026-11-23 "感觉没变化"): the overlay anchor
        // band is shared with DSH popup shells, so floating above the card
        // kept reading as an overlap. Instead the overlay slot registers an
        // invisible bootstrap <span>; from it we climb to the composer card
        // and insert a plain-DOM row directly above the draft editor, in
        // normal flow. React leaves foreign nodes alone, and a
        // MutationObserver re-inserts the row if a re-render ever drops it.
        const registerPhrasesBar = () => {
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureGenStyles();

          let rowEl = null;
          let cardEl = null;
          let reinsertGuard = null;
          let unsubscribe = null;

          const buildPill = (text) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dsh-tools-phrase';
            btn.textContent = text;
            btn.title = `${text}\n${t('phrasesChipTitle')}`;
            btn.setAttribute('aria-label', text);
            btn.addEventListener('click', () => { insertPhraseAtCaret(btn, text); });
            return btn;
          };

          const syncPills = () => {
            if (rowEl === null) return;
            const items = phraseStore.snapshot();
            const show = featureFlags.phrases === true && items.length > 0;
            rowEl.style.display = show ? '' : 'none';
            if (!show) return;
            const pills = items.map((text) => buildPill(text));
            if (typeof rowEl.replaceChildren === 'function') {
              rowEl.replaceChildren(...pills);
            } else {
              rowEl.textContent = '';
              for (const pill of pills) rowEl.appendChild(pill);
            }
          };

          const insertRow = () => {
            if (rowEl === null || cardEl === null
              || typeof cardEl.querySelector !== 'function') return;
            if (rowEl.parentElement === cardEl) return;
            const editor = cardEl.querySelector('[contenteditable="true"]')
              ?? cardEl.querySelector('[contenteditable]');
            if (editor == null) return; // hero variant: no draft editor yet
            let host = editor;
            while (host != null && host.parentElement !== cardEl) host = host.parentElement;
            if (host != null) {
              cardEl.insertBefore(rowEl, host);
            } else {
              cardEl.appendChild(rowEl);
            }
          };

          const teardownRow = () => {
            if (reinsertGuard !== null) {
              try { reinsertGuard.disconnect(); } catch { /* already gone */ }
              reinsertGuard = null;
            }
            if (unsubscribe !== null) {
              try { unsubscribe(); } catch { /* already gone */ }
              unsubscribe = null;
            }
            if (rowEl !== null && typeof rowEl.remove === 'function') {
              try { rowEl.remove(); } catch { /* already gone */ }
            }
            rowEl = null;
            cardEl = null;
          };

          // Stable ref callback: React calls it once per mount/unmount, so
          // the injected row's lifecycle follows the bootstrap span exactly.
          // Finding the card via closest('[data-composer-card]') is robust to
          // any wrapper levels the slot renderer adds around entries (the
          // fixed "two hops up" assumption broke in v0.6.7 when the overlay
          // entry turned out not to be a direct child of the anchor).
          const attachBootstrap = (node) => {
            teardownRow();
            if (node === null) return;
            let card = null;
            if (typeof node.closest === 'function') {
              try { card = node.closest('[data-composer-card]'); } catch { card = null; }
            }
            if (card === null) {
              const anchor = node.parentElement ?? null;
              card = anchor !== null ? anchor.parentElement ?? null : null;
            }
            if (card === null || typeof card.querySelector !== 'function') return;
            rowEl = document.createElement('div');
            rowEl.className = 'dsh-tools-phraseBar';
            cardEl = card;
            insertRow();
            syncPills();
            unsubscribe = phraseStore.subscribe(syncPills);
            if (typeof MutationObserver === 'function') {
              reinsertGuard = new MutationObserver(() => { insertRow(); });
              reinsertGuard.observe(card, { childList: true });
            }
          };

          const PhrasesHost = () => {
            if (featureFlags.phrases !== true) return null;
            // Invisible mount point inside the overlay anchor. The visible
            // row lives in the card flow (see attachBootstrap); the span only
            // gives us a node to climb from and stays display:none forever.
            return React.createElement('span', {
              ref: attachBootstrap,
              className: 'dsh-tools-phraseHost',
              style: { display: 'none' },
              'aria-hidden': 'true',
            });
          };

          const effectBody = () => ctx.slots.inject('conversation.input.overlay', () => {
            const unregister = ctx.slots.register(
              { name: 'conversation.input.overlay', id: 'dsh-tools-phrases', order: 10 },
              () => React.createElement(PhrasesHost),
            );
            return () => {
              try { unregister(); } catch { /* already gone */ }
              teardownRow();
            };
          });
          if (typeof ctx.effect === 'function') {
            return ctx.effect(effectBody, 'dsh-tools: phrase bar');
          }
          return effectBody();
        };

        // ---- settings panel (slot settings.section) ----
        const registerSettingsPanel = () => {
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureGenStyles();

          const TOGGLES = [
            ['moreMenu', 'fMoreMenu'],
            ['generate', 'fGenerate'],
            ['optimize', 'fOptimize'],
            ['history', 'fHistory'],
            ['sc', 'fSc'],
            ['usage', 'fUsage'],
            ['openSidebar', 'fOpenSidebar'],
            ['phrases', 'fPhrases'],
          ];

          // Native directory picker (Client uiWorkspace service), when present.
          // ctx.get on an undeclared service may throw (Cordis inject rules),
          // so fall back to a runtime child fiber capture.
          let pickDirectory = null;
          try { pickDirectory = ctx.get('uiWorkspace')?.pickDirectory ?? null; } catch { pickDirectory = null; }
          if (typeof pickDirectory !== 'function') {
            try {
              const pickerFiber = ctx.inject(['uiWorkspace'], (scope) => {
                pickDirectory = typeof scope?.uiWorkspace?.pickDirectory === 'function' ? scope.uiWorkspace.pickDirectory : null;
              });
              if (pickerFiber && typeof pickerFiber.dispose === 'function') {
                keep(() => { try { pickerFiber.dispose(); } catch { /* already disposed */ } });
              }
            } catch { /* client runtime without callback inject — picker stays unavailable */ }
          }

          const ToolsPanel = () => {
            const [flags, setFlags] = React.useState({ ...featureFlags });
            const [custom, setCustom] = React.useState(modelOverride.provider !== '' && modelOverride.model !== '');
            const [provider, setProvider] = React.useState(modelOverride.provider);
            const [model, setModel] = React.useState(modelOverride.model);
            const [providers, setProviders] = React.useState(null);   // null = loading
            const [modelsError, setModelsError] = React.useState('');
            const [saveState, setSaveState] = React.useState('idle'); // idle | busy | saved | error
            const [saveNote, setSaveNote] = React.useState('');
            const [roots, setRoots] = React.useState(null);           // null = loading
            const [rootError, setRootError] = React.useState('');
            const [phrasesDraft, setPhrasesDraft] = React.useState(null); // null = loading

            React.useEffect(() => {
              let alive = true;
              (async () => {
                try {
                  const result = await call('models.list', {});
                  if (!alive) return;
                  if (result?.ok === true && Array.isArray(result.value?.providers)) {
                    setProviders(result.value.providers);
                  } else {
                    setModelsError(result?.error?.message ?? t('modelsFailed'));
                  }
                } catch (error) {
                  if (alive) setModelsError(error?.message ?? String(error));
                }
              })();
              (async () => {
                try {
                  const result = await call('settings.get', {});
                  if (!alive) return;
                  if (result?.ok === true && Array.isArray(result.value?.settings?.sc?.roots)) {
                    setRoots(result.value.settings.sc.roots.slice());
                  } else {
                    setRoots([]);
                  }
                  if (result?.ok === true && Array.isArray(result.value?.settings?.phrases)) {
                    setPhrasesDraft(result.value.settings.phrases.slice(0, 5));
                  } else {
                    setPhrasesDraft([]);
                  }
                } catch (error) {
                  if (alive) { setRoots([]); setPhrasesDraft([]); setRootError(error?.message ?? String(error)); }
                }
              })();
              return () => { alive = false; };
            }, []);

            const providerModels = React.useMemo(() => {
              if (providers === null) return [];
              const group = providers.find((p) => p.provider === provider);
              return Array.isArray(group?.models) ? group.models : [];
            }, [providers, provider]);

            const addRoot = async () => {
              setRootError('');
              try {
                if (typeof pickDirectory !== 'function') {
                  setRootError(t('scAddRoot') + ': pickDirectory unavailable');
                  return;
                }
                const picked = await pickDirectory();
                if (typeof picked === 'string' && picked !== '') {
                  setRoots((current) => {
                    const list = current ?? [];
                    const lower = new Set(list.map((r) => r.toLowerCase()));
                    return lower.has(picked.toLowerCase()) ? list : [...list, picked];
                  });
                }
              } catch (error) {
                setRootError(error?.message ?? String(error));
              }
            };

            const removeRoot = (path) => {
              setRoots((current) => (current ?? []).filter((r) => r !== path));
            };

            const addPhrase = () => {
              setPhrasesDraft((current) => {
                const list = current ?? [];
                if (list.length >= 5) return list;
                return [...list, ''];
              });
            };
            const editPhrase = (index, value) => {
              setPhrasesDraft((current) => (current ?? []).map((p, i) => (i === index ? value.slice(0, 200) : p)));
            };
            const removePhrase = (index) => {
              setPhrasesDraft((current) => (current ?? []).filter((_, i) => i !== index));
            };

            const onSave = async () => {
              setSaveState('busy');
              setSaveNote(t('saving'));
              const payload = {
                features: Object.fromEntries(TOGGLES.map(([key]) => [key, flags[key] === true])),
                model: custom && provider !== '' && model !== '' ? { provider, model } : { provider: '', model: '' },
                sc: { roots: roots ?? [] },
                phrases: phrasesDraft ?? [],
              };
              try {
                const result = await call('settings.set', payload);
                if (result?.ok === true && result.value?.settings) {
                  const settings = result.value.settings;
                  Object.assign(featureFlags, settings.features);
                  Object.assign(modelOverride, settings.model);
                  setFlags({ ...featureFlags });
                  if (Array.isArray(settings.phrases)) phraseStore.set(settings.phrases);
                  runtime.applyFlags?.();
                  setSaveState('saved');
                  setSaveNote(t('saved'));
                } else {
                  setSaveState('error');
                  setSaveNote(result?.error?.message ?? t('saveFailed'));
                }
              } catch (error) {
                setSaveState('error');
                setSaveNote(error?.message ?? String(error));
              }
            };

            const toggleRow = (key, dictKey) => React.createElement('label', { className: 'dsh-tools-toggle', key: key },
              React.createElement('input', {
                type: 'checkbox',
                checked: flags[key] === true,
                onChange: (event) => setFlags({ ...flags, [key]: event.target.checked }),
              }),
              React.createElement('span', null, t(dictKey)));

            const radio = (value, dictKey) => React.createElement('label', { className: 'dsh-tools-radio', key: value },
              React.createElement('input', {
                type: 'radio',
                name: 'dsh-tools-model-mode',
                checked: custom === value,
                onChange: () => {
                  setCustom(value);
                  if (!value) { setProvider(''); setModel(''); }
                },
              }),
              React.createElement('span', null, t(dictKey)));

            return React.createElement('div', { className: 'dsh-tools-panel' },
              React.createElement('section', null,
                React.createElement('h4', null, t('settingsTitle')),
                React.createElement('p', null, t('settingsIntro')),
                ...TOGGLES.map(([key, dictKey]) => toggleRow(key, dictKey))),
              React.createElement('section', null,
                React.createElement('h4', null, t('modelTitle')),
                radio(false, 'modelFollow'),
                radio(true, 'modelCustom'),
                custom ? React.createElement('div', { className: 'dsh-tools-selects' },
                  React.createElement('select', {
                    className: 'dsh-tools-select',
                    value: provider,
                    onChange: (event) => { setProvider(event.target.value); setModel(''); },
                  },
                  React.createElement('option', { value: '' }, `— ${t('modelProvider')} —`),
                  ...(providers ?? []).map((p) => React.createElement('option', { key: p.provider, value: p.provider }, p.label ?? p.provider))),
                  React.createElement('select', {
                    className: 'dsh-tools-select',
                    value: model,
                    disabled: provider === '',
                    onChange: (event) => setModel(event.target.value),
                  },
                  React.createElement('option', { value: '' }, `— ${t('modelModel')} —`),
                  providerModels.map((m) => React.createElement('option', { key: m.id, value: m.id }, m.label ?? m.id))),
                ) : null,
                providers === null ? React.createElement('p', null, modelsError !== '' ? modelsError : t('modelsLoading'))
                  : (modelsError !== '' ? React.createElement('p', { className: 'dsh-tools-note is-error' }, modelsError)
                    : (providers.every((p) => !p.models?.length) ? React.createElement('p', null, t('modelsEmpty')) : null))),
              React.createElement('section', null,
                React.createElement('h4', null, t('scRootsTitle')),
                React.createElement('p', null, t('scRootsIntro')),
                ...(roots ?? []).map((root) => React.createElement('div', { className: 'dsh-tools-scRootRow', key: root },
                  React.createElement('span', { className: 'dsh-tools-scRootPath', title: root }, root),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scRootRemove',
                    onClick: () => removeRoot(root),
                  }, t('scRemoveRoot')))),
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh-tools-scBtn',
                  onClick: () => { void addRoot(); },
                },
                React.createElement('span', { dangerouslySetInnerHTML: { __html: SC_PLUS_GLYPH } }),
                React.createElement('span', null, t('scAddRoot'))),
                rootError !== '' ? React.createElement('p', { className: 'dsh-tools-note is-error' }, rootError) : null),
              React.createElement('section', null,
                React.createElement('h4', null, t('phrasesTitle')),
                React.createElement('p', null, t('phrasesIntro')),
                ...(phrasesDraft ?? []).map((phrase, index) => React.createElement('div', { className: 'dsh-tools-phraseRow', key: `phrase-${index}` },
                  React.createElement('input', {
                    className: 'dsh-tools-phraseInput',
                    type: 'text',
                    value: phrase,
                    placeholder: t('phrasesPlaceholder'),
                    onChange: (event) => editPhrase(index, event.target.value),
                  }),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scRootRemove',
                    onClick: () => removePhrase(index),
                  }, t('scRemoveRoot')))),
                (phrasesDraft ?? []).length < 5 ? React.createElement('button', {
                  type: 'button',
                  className: 'dsh-tools-scBtn',
                  onClick: addPhrase,
                },
                React.createElement('span', { dangerouslySetInnerHTML: { __html: SC_PLUS_GLYPH } }),
                React.createElement('span', null, t('phrasesAdd')))
                  : React.createElement('p', { className: 'dsh-tools-note' }, t('phrasesFull'))),
              React.createElement('div', { className: 'dsh-tools-panelFooter' },
                React.createElement('button', {
                  type: 'button',
                  className: 'dsh-tools-primary',
                  disabled: saveState === 'busy' || (custom && (provider === '' || model === '')),
                  onClick: (event) => { void onSave(event); },
                }, t('save')),
                saveNote !== '' ? React.createElement('span', {
                  className: `dsh-tools-note${saveState === 'error' ? ' is-error' : ''}`,
                }, saveNote) : null));
          };

          const effectBody = () => ctx.slots.inject('settings.section', () => {
            const unregister = ctx.slots.register(
              { name: 'settings.section', id: 'dsh-tools', order: 23, label: () => t('settingsTitle') },
              () => React.createElement(ToolsPanel),
            );
            return () => { try { unregister(); } catch { /* already gone */ } };
          });
          if (typeof ctx.effect === 'function') {
            return ctx.effect(effectBody, 'dsh-tools: settings panel');
          }
          return effectBody();
        };

        // ---- source control (right sidebar: Start-guide entry + tab) ----
        // The guide card and the tab chrome come from the app itself: we
        // register a tab type with a guide entry on the sidebarRightTabs
        // registry — the same mechanism 工作区文件/新建终端/浏览网页 use — and
        // provide the pane body via the keyed sidebar.right.pane.tab slot.
        const SC_TAB_TYPE_ID = 'dsh-tools-sc';

        const registerScUi = () => {
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureScStyles();

          // Live workspace root from the sessions store (the same source the
          // workspace UI uses): ONLY the main-view session's cwd — the
          // workspace the user is actually looking at. v0.6.5: hinting other
          // retained sessions' directories too made the panel list sibling
          // projects from unrelated workspaces (m03593: the reader workspace
          // showed the parent's other git projects).
          let sessionsService = null;
          try {
            const sessionsFiber = ctx.inject(['sessions'], (scope) => {
              sessionsService = scope?.sessions ?? null;
            });
            if (sessionsFiber && typeof sessionsFiber.dispose === 'function') {
              keep(() => { try { sessionsFiber.dispose(); } catch { /* already disposed */ } });
            }
          } catch { /* sessions unavailable → hints stay empty */ }
          const scClientRoots = () => {
            try {
              const rows = Object.values(
                sessionsService?.list?.getSnapshot?.()?.byId ?? {},
              );
              const mainView = rows.find((row) => (row?.retainedBy?.mainView ?? 0) > 0
                && typeof row?.cwd === 'string' && row.cwd.trim() !== '');
              return mainView ? [mainView.cwd.trim()] : [];
            } catch { return []; }
          };
          // The sessions capture fiber can land slightly after a hot reload;
          // wait briefly so the first sc.repos call still carries the
          // main-view root instead of scanning nothing (observed as
          // "roots=0" right after an in-place plugin swap).
          const waitForSessions = async (timeoutMs = 2000) => {
            const deadline = Date.now() + timeoutMs;
            while (sessionsService === null && Date.now() < deadline) {
              await new Promise((resolve) => { setTimeout(resolve, 50); });
            }
          };
          const subscribeSessions = (onChange) => {
            try {
              const list = sessionsService?.list;
              if (list && typeof list.subscribe === 'function') {
                const unsubscribe = list.subscribe(onChange);
                return typeof unsubscribe === 'function' ? unsubscribe : () => {};
              }
            } catch { /* fall through */ }
            return () => {};
          };
          const sessionsSnapshot = () => {
            try { return sessionsService?.list?.getSnapshot?.() ?? null; } catch { return null; }
          };

          const fmtError = (error, fallback) => {
            if (typeof error?.message === 'string' && error.message !== '') {
              return typeof error?.code === 'string' && error.code !== '' ? `[${error.code}] ${error.message}` : error.message;
            }
            return fallback ?? '';
          };
          // v0.7.8: wrapper defaults to a centered flex box (dsh-tools-scIco)
          // — raw inline <svg> rides the text baseline (descender space below
          // it), which made glyphs float high and misalign with labels.
          const icon = (glyph, className) => React.createElement('span', {
            className: className ?? 'dsh-tools-scIco',
            dangerouslySetInnerHTML: { __html: glyph },
          });
          const STATUS_DICT = { A: 'stA', M: 'stM', D: 'stD', R: 'stR' };

          // Guide card icon; the standard EntryBox calls it as a component
          // with {size, className} (size 22 without descriptions, else 26).
          const ScGuideArt = ({ size = 26, className }) => React.createElement('svg', {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            className,
            'aria-hidden': 'true',
          },
          React.createElement('line', { x1: 6, y1: 3, x2: 6, y2: 15 }),
          React.createElement('circle', { cx: 18, cy: 6, r: 3 }),
          React.createElement('circle', { cx: 6, cy: 18, r: 3 }),
          React.createElement('path', { d: 'M18 9a9 9 0 0 1-9 9' }));

          // v0.7.9: diff layout toggle (用户需求：改动详情页切换 横向/纵向 比对).
          // Preference persists via localStorage when available (guarded —
          // the render-test sandbox has no DOM storage).
          const DIFF_STYLE_KEY = 'dsh-tools.scDiffStyle';
          const readDiffStyle = () => {
            try {
              return globalThis.localStorage?.getItem(DIFF_STYLE_KEY) === 'split' ? 'split' : 'unified';
            } catch {
              return 'unified';
            }
          };
          const writeDiffStyle = (style) => {
            try {
              globalThis.localStorage?.setItem(DIFF_STYLE_KEY, style);
            } catch {
              /* persistence unavailable — keep session-only */
            }
          };

          // git diff preamble (diff --git / index / --- / +++ …) only ever
          // appears before the first @@ hunk header; skip it in both layouts
          // — the panel already names the file, and VSCode-style diff views
          // never render this metadata as content.
          const isDiffPreamble = (line) => /^(diff --git |new file mode |deleted file mode |old mode |new mode |index |similarity index |dissimilarity index |rename from |rename to |Binary file|--- |\+\+\+ )/.test(line);

          // Parse a unified diff into side-by-side rows: pair consecutive
          // -/+ runs index-by-index and pad the shorter side; context lines
          // pair with themselves and advance both counters. Hunk headers
          // carry their own start numbers; '\\ No newline' markers are
          // cosmetic and dropped. A body with no @@ at all (defensive — the
          // synthetic untracked diff gained one in v0.7.10) numbers from 1.
          const parseSplitRows = (text) => {
            const rows = [];
            let oldNo = 0;
            let newNo = 0;
            let inHunk = false;
            let numbered = false;
            let dels = [];
            let adds = [];
            const flush = () => {
              const pairs = Math.max(dels.length, adds.length);
              for (let i = 0; i < pairs; i += 1) {
                const del = dels[i];
                const add = adds[i];
                rows.push({
                  oldNo: del === undefined ? '' : del.no,
                  oldText: del === undefined ? '' : del.text,
                  oldCls: del === undefined ? '' : ' is-del',
                  newNo: add === undefined ? '' : add.no,
                  newText: add === undefined ? '' : add.text,
                  newCls: add === undefined ? '' : ' is-add',
                });
              }
              dels = [];
              adds = [];
            };
            String(text ?? '').split('\n').forEach((line) => {
              if (line === '') return;
              if (inHunk !== true && isDiffPreamble(line)) return;
              const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
              if (hunk !== null) {
                flush();
                oldNo = Number(hunk[1]);
                newNo = Number(hunk[2]);
                inHunk = true;
                rows.push({ hunk: line });
                return;
              }
              if (numbered !== true) {
                oldNo = 1;
                newNo = 1;
                numbered = true;
              }
              if (line.startsWith('-')) {
                dels.push({ no: String(oldNo), text: line.slice(1) });
                oldNo += 1;
                return;
              }
              if (line.startsWith('+')) {
                adds.push({ no: String(newNo), text: line.slice(1) });
                newNo += 1;
                return;
              }
              if (line.startsWith('\\')) return;
              flush();
              rows.push({
                oldNo: String(oldNo),
                oldText: line.slice(1),
                oldCls: '',
                newNo: String(newNo),
                newText: line.slice(1),
                newCls: '',
              });
              oldNo += 1;
              newNo += 1;
            });
            flush();
            return rows;
          };

          const DiffView = ({ text, split }) => {
            if (split !== true) {
              const kept = [];
              let inHunk = false;
              String(text ?? '').split('\n').forEach((line) => {
                if (inHunk !== true && isDiffPreamble(line)) return;
                if (line.startsWith('@@')) inHunk = true;
                kept.push(line);
              });
              return React.createElement('pre', { className: 'dsh-tools-scDiff' },
                kept.map((line, index) => {
                  let cls = 'dsh-tools-dl';
                  if (line.startsWith('+')) cls += ' is-add';
                  else if (line.startsWith('-')) cls += ' is-del';
                  else if (line.startsWith('@@')) cls += ' is-hunk';
                  return React.createElement('span', { className: cls, key: index }, line);
                }));
            }
            const cells = [];
            parseSplitRows(text).forEach((row, index) => {
              if (row.hunk !== undefined) {
                cells.push(React.createElement('div', { className: 'dsh-tools-dh', key: `h${index}` }, row.hunk));
                return;
              }
              cells.push(React.createElement('span', { className: 'dsh-tools-dno', key: `a${index}` }, row.oldNo));
              cells.push(React.createElement('span', { className: `dsh-tools-dc${row.oldCls}`, key: `b${index}` }, row.oldText));
              cells.push(React.createElement('span', { className: 'dsh-tools-dno is-new', key: `c${index}` }, row.newNo));
              cells.push(React.createElement('span', { className: `dsh-tools-dc${row.newCls}`, key: `d${index}` }, row.newText));
            });
            return React.createElement('div', { className: 'dsh-tools-scDiffSplit' }, cells);
          };

          const ScPanel = () => {
            const [repos, setRepos] = React.useState(null);      // null = loading
            const [reposError, setReposError] = React.useState('');
            const [rootsHint, setRootsHint] = React.useState([]); // roots actually scanned
            const [statusMap, setStatusMap] = React.useState({}); // repo.id -> {branch,files,truncated,error}
            const [expanded, setExpanded] = React.useState({});     // repo.id -> true (default all collapsed)
            const [selected, setSelected] = React.useState({});   // repo.id -> Set<path>
            const [diffKey, setDiffKey] = React.useState(null);   // `${id}\u0001${path}`
            const [diffState, setDiffState] = React.useState({});
            const [msgMap, setMsgMap] = React.useState({});
            const [busy, setBusy] = React.useState({});           // repo.id -> {op,error,note}
            const [diffStyle, setDiffStyle] = React.useState(readDiffStyle); // 'unified' | 'split' (v0.7.9)

            const loadAll = React.useCallback(async () => {
              setRepos(null);
              setReposError('');
              setBatchNote('');
              // Let the sessions capture settle (hot-reload race) so the scan
              // targets the workspace the user is in, not nothing. Skipped
              // entirely (zero extra microtask) once the service is captured.
              if (sessionsService === null) await waitForSessions();
              let result;
              try {
                result = await call('sc.repos', { roots: scClientRoots() });
              } catch (error) {
                setRepos([]);
                setReposError(error?.message ?? String(error));
                return;
              }
              if (result?.ok !== true) {
                setRepos([]);
                setReposError(fmtError(result?.error, t('scFailed')));
                return;
              }
              const list = Array.isArray(result.value?.repos) ? result.value.repos : [];
              setRootsHint(Array.isArray(result.value?.roots) ? result.value.roots : []);
              setRepos(list);
              const next = {};
              await Promise.all(list.map(async (repo) => {
                next[repo.id] = { branch: '', files: [], truncated: false, loading: true };
                try {
                  const r = await call('sc.status', { repo: repo.path });
                  next[repo.id] = r?.ok === true
                    ? {
                      branch: typeof r.value?.branch === 'string' ? r.value.branch : '',
                      files: Array.isArray(r.value?.files) ? r.value.files : [],
                      truncated: r.value?.truncated === true,
                    }
                    : { branch: '', files: [], truncated: false, error: fmtError(r?.error, t('scFailed')) };
                } catch (error) {
                  next[repo.id] = { branch: '', files: [], truncated: false, error: error?.message ?? String(error) };
                }
              }));
              setStatusMap(next);
            }, []);

            // The pane only mounts this body while our tab is active, so
            // mounting is exactly "the panel opened" — load immediately. It
            // also re-loads when the main-view session's cwd changes (the
            // user switched workspace/session in this window), via the same
            // sessions store the workspace UI reads.
            const sessionsStore = typeof React.useSyncExternalStore === 'function'
              ? React.useSyncExternalStore(subscribeSessions, sessionsSnapshot, sessionsSnapshot)
              : null;
            const mainViewCwd = React.useMemo(() => scClientRoots()[0] ?? '', [sessionsStore]);
            React.useEffect(() => { void loadAll(); }, [loadAll, mainViewCwd]);

            const refreshRepo = async (repo) => {
              try {
                const r = await call('sc.status', { repo: repo.path });
                setStatusMap((current) => ({
                  ...current,
                  [repo.id]: r?.ok === true
                    ? {
                      branch: typeof r.value?.branch === 'string' ? r.value.branch : '',
                      files: Array.isArray(r.value?.files) ? r.value.files : [],
                      truncated: r.value?.truncated === true,
                    }
                    : { branch: '', files: [], truncated: false, error: fmtError(r?.error, t('scFailed')) },
                }));
              } catch (error) {
                setStatusMap((current) => ({
                  ...current,
                  [repo.id]: { branch: '', files: [], truncated: false, error: error?.message ?? String(error) },
                }));
              }
            };

            const selectedSet = (id) => selected[id] ?? new Set();
            const toggleFile = (id, path) => setSelected((current) => {
              const set = new Set(current[id] ?? []);
              if (set.has(path)) set.delete(path); else set.add(path);
              return { ...current, [id]: set };
            });
            const selectAll = (id, files) => setSelected((current) => ({
              ...current, [id]: new Set(files.map((file) => file.path)),
            }));
            const clearSelection = (id) => setSelected((current) => ({ ...current, [id]: new Set() }));

            const setBusyState = (id, patch) => setBusy((current) => ({
              ...current, [id]: { op: null, error: '', note: '', ...(current[id] ?? {}), ...patch },
            }));

            const toggleDiff = async (repo, file) => {
              const key = `${repo.id}\u0001${file.path}`;
              if (diffKey === key) { setDiffKey(null); return; }
              setDiffKey(key);
              if (diffState[key] === undefined) {
                setDiffState((current) => ({ ...current, [key]: { loading: true } }));
                try {
                  const r = await call('sc.diff', {
                    repo: repo.path,
                    file: file.path,
                    untracked: file.status === 'A' && file.staged !== true,
                  });
                  setDiffState((current) => ({
                    ...current,
                    [key]: r?.ok === true ? { text: typeof r.value?.diff === 'string' ? r.value.diff : '' }
                      : { error: fmtError(r?.error, t('scDiffFailed')) },
                  }));
                } catch (error) {
                  setDiffState((current) => ({ ...current, [key]: { error: error?.message ?? String(error) } }));
                }
              }
            };

            const genMessage = async (repo) => {
              if (busy[repo.id]?.op) return;
              const files = [...selectedSet(repo.id)];
              if (files.length === 0) { setBusyState(repo.id, { error: t('scNoFiles') }); return; }
              setBusyState(repo.id, { op: 'msg', error: '', note: t('scGenMsging') });
              try {
                const r = await call('sc.commitMessage', { repo: repo.path, files, lang: lang === 'zh' ? 'zh' : 'en' });
                if (r?.ok === true && typeof r.value?.draft === 'string' && r.value.draft !== '') {
                  setMsgMap((current) => ({ ...current, [repo.id]: r.value.draft }));
                  setBusyState(repo.id, { op: null, note: '' });
                } else {
                  setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                }
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
              }
            };

            const doCommit = async (repo) => {
              if (busy[repo.id]?.op) return;
              const files = [...selectedSet(repo.id)];
              const message = (msgMap[repo.id] ?? '').trim();
              if (files.length === 0) { setBusyState(repo.id, { error: t('scNoFiles') }); return; }
              if (message === '') { setBusyState(repo.id, { error: t('scNoMsg') }); return; }
              setBusyState(repo.id, { op: 'commit', error: '', note: t('scCommitting') });
              try {
                const r = await call('sc.commit', { repo: repo.path, files, message });
                if (r?.ok === true) {
                  const hash = typeof r.value?.commit === 'string' ? r.value.commit : '';
                  setBusyState(repo.id, { op: null, note: `${t('scCommitted')} ${hash}`.trim() });
                  clearSelection(repo.id);
                  setDiffKey(null);
                  void refreshRepo(repo);
                } else {
                  setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                }
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
              }
            };

            // v0.8 撤销改动 — single file (row icon) or the current selection
            // (danger button in the commit bar). Both routes go through a
            // confirm dialog first: restoring is safe, but deleting a new
            // file cannot be undone, so the dialog spells out exactly which
            // files get which fate before anything runs.
            const [revertAsk, setRevertAsk] = React.useState(null); // {repo, files:[{path,status}]}
            React.useEffect(() => {
              if (revertAsk === null) return undefined;
              const onKey = (event) => { if (event.key === 'Escape') setRevertAsk(null); };
              window.addEventListener('keydown', onKey);
              return () => window.removeEventListener('keydown', onKey);
            }, [revertAsk]);
            const askRevert = (repo, files) => {
              if (busy[repo.id]?.op) return;
              setRevertAsk({ repo, files: files.map((f) => ({ path: f.path, status: f.status })) });
            };
            const doRevert = async (repo, paths) => {
              if (busy[repo.id]?.op) return;
              setRevertAsk(null);
              setBusyState(repo.id, { op: 'revert', error: '', note: t('scReverting') });
              try {
                const r = await call('sc.revert', { repo: repo.path, files: paths });
                if (r?.ok === true) {
                  const restored = Number(r.value?.restored ?? 0);
                  const deleted = Number(r.value?.deleted ?? 0);
                  const failed = Number(r.value?.failed ?? 0);
                  const parts = [t('scReverted')];
                  if (restored > 0) parts.push(`${t('scRevertRestored')} ${restored}`);
                  if (deleted > 0) parts.push(`${t('scRevertDeleted')} ${deleted}`);
                  const firstError = Array.isArray(r.value?.results)
                    ? r.value.results.find((row) => row?.ok !== true)
                    : null;
                  setBusyState(repo.id, failed > 0
                    ? { op: null, note: parts.join(' · '), error: `${t('scRevertFailed')} × ${failed}${firstError?.error ? `: ${firstError.error}` : ''}` }
                    : { op: null, note: parts.join(' · ') });
                  clearSelection(repo.id);
                  setDiffKey(null);
                  setDiffState((current) => {
                    const next = { ...current };
                    for (const p of paths) delete next[`${repo.id}\u0001${p}`];
                    return next;
                  });
                  void refreshRepo(repo);
                } else {
                  setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                }
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
              }
            };

            const doPush = async (repo) => {
              if (busy[repo.id]?.op) return;
              setBusyState(repo.id, { op: 'push', error: '', note: t('scPushing') });
              try {
                const r = await call('sc.push', { repo: repo.path });
                if (r?.ok === true) {
                  setBusyState(repo.id, { op: null, note: t('scPushed') });
                  void refreshRepo(repo);
                } else {
                  setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                }
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
              }
            };

            // v0.7.5 更新代码 / 更新数据库 — per-repo and (via runBatch) sweep-
            // all variants. Outcomes resolve to {ok} / {skipped} so the batch
            // loop can count them; notes/errors land in the group's busy row.
            const doPull = async (repo) => {
              if (busy[repo.id]?.op) return { ok: false };
              setBusyState(repo.id, { op: 'pull', error: '', note: t('scPulling') });
              try {
                const r = await call('sc.pull', { repo: repo.path });
                if (r?.ok === true) {
                  setBusyState(repo.id, { op: null, note: t('scPulled') });
                  void refreshRepo(repo);
                  return { ok: true };
                }
                setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                return { ok: false };
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
                return { ok: false };
              }
            };

            const doPrisma = async (repo) => {
              if (busy[repo.id]?.op) return { ok: false };
              setBusyState(repo.id, { op: 'prisma', error: '', note: t('scDbRunning') });
              try {
                const r = await call('sc.prisma', { repo: repo.path });
                if (r?.ok === true) {
                  setBusyState(repo.id, { op: null, note: t('scDbDone') });
                  void refreshRepo(repo);
                  return { ok: true };
                }
                if (r?.error?.code === 'no-prisma-scripts') {
                  setBusyState(repo.id, { op: null, note: t('scNoPrisma') });
                  return { ok: false, skipped: true };
                }
                setBusyState(repo.id, { op: null, error: fmtError(r?.error, t('scFailed')) });
                return { ok: false };
              } catch (error) {
                setBusyState(repo.id, { op: null, error: error?.message ?? String(error) });
                return { ok: false };
              }
            };

            // Top-bar 更新代码/更新数据库 buttons sweep EVERY listed repo
            // sequentially (parallel git/pnpm across repos would race shared
            // remotes and stores); progress + the final ok/skipped/failed
            // summary show in the bar, per-repo outcomes in each group.
            const [batch, setBatch] = React.useState(null);   // {op,done,total}
            const [batchNote, setBatchNote] = React.useState('');
            const runBatch = async (op) => {
              if (batch !== null) return;
              const list = Array.isArray(repos) ? repos : [];
              if (list.length === 0) return;
              setBatch({ op, done: 0, total: list.length });
              let okCount = 0;
              let skipCount = 0;
              let failCount = 0;
              for (let index = 0; index < list.length; index += 1) {
                setBatch({ op, done: index + 1, total: list.length });
                setBatchNote(`${t(op === 'pull' ? 'scUpdateCode' : 'scUpdateDb')} ${index + 1}/${list.length}…`);
                const outcome = op === 'pull' ? await doPull(list[index]) : await doPrisma(list[index]);
                if (outcome.skipped === true) skipCount += 1;
                else if (outcome.ok === true) okCount += 1;
                else failCount += 1;
              }
              setBatchNote(`${t(op === 'pull' ? 'scPulled' : 'scDbDone')} ${okCount}`
                + (skipCount > 0 ? ` · ${t('scBatchSkipped')} ${skipCount}` : '')
                + (failCount > 0 ? ` · ${t('scBatchFailed')} ${failCount}` : ''));
              setBatch(null);
            };

            if (!featureFlags.sc) return null;

            const repoGroups = (repos ?? []).map((repo) => {
              const st = statusMap[repo.id] ?? { branch: '', files: [], truncated: false, loading: true };
              // Default collapsed: only repos the user explicitly expanded are
              // open (user request 2026-11-23: "默认所有栏目关闭状态").
              const isOpen = expanded[repo.id] === true;
              const sel = selectedSet(repo.id);
              const busyState = busy[repo.id] ?? { op: null, error: '', note: '' };
              const anyBusy = Boolean(busyState.op);
              return React.createElement('div', { className: 'dsh-tools-scGroup', key: repo.id },
                React.createElement('div', { className: 'dsh-tools-scGroupHead' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scGroupHeadMain',
                    'aria-expanded': isOpen,
                    onClick: () => setExpanded((current) => ({ ...current, [repo.id]: !isOpen })),
                  },
                  icon(SC_CHEVRON_GLYPH, `dsh-tools-scChev${isOpen ? ' is-open' : ''}`),
                  React.createElement('span', { className: 'dsh-tools-scRepoName', title: repo.path }, repo.name),
                  st.branch !== '' ? React.createElement('span', { className: 'dsh-tools-scBranch' }, st.branch) : null,
                  React.createElement('span', { className: 'dsh-tools-scCount' }, String(st.files.length))),
                  st.files.length > 0 ? React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scMini',
                    onClick: () => selectAll(repo.id, st.files),
                  }, t('scSelectAll')) : null,
                  sel.size > 0 ? React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scMini',
                    onClick: () => clearSelection(repo.id),
                  }, t('scClear')) : null,
                  // v0.7.7 divider between the text controls and the icon
                  // cluster; only present when there is something to divide.
                  st.files.length > 0 || sel.size > 0
                    ? React.createElement('div', { className: 'dsh-tools-scVDiv', 'aria-hidden': 'true' }) : null,
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scIconBtn',
                    title: t('scUpdateCodeTitle'),
                    'aria-label': t('scUpdateCodeTitle'),
                    disabled: anyBusy || batch !== null,
                    onClick: () => { void doPull(repo); },
                  }, icon(SC_PULL_GLYPH)),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scIconBtn',
                    title: t('scUpdateDbTitle'),
                    'aria-label': t('scUpdateDbTitle'),
                    disabled: anyBusy || batch !== null,
                    onClick: () => { void doPrisma(repo); },
                  }, icon(SC_DB_GLYPH)),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scIconBtn',
                    title: t('scPush'),
                    'aria-label': t('scPush'),
                    disabled: anyBusy || batch !== null,
                    onClick: () => { void doPush(repo); },
                  }, icon(SC_PUSH_GLYPH))),
                isOpen ? React.createElement('div', { className: 'dsh-tools-scFiles' },
                  st.error !== undefined ? React.createElement('div', { className: 'dsh-tools-scNote is-error', style: { padding: '6px 12px' } }, st.error) : null,
                  st.error === undefined && st.loading ? React.createElement('div', { className: 'dsh-tools-scNote', style: { padding: '6px 12px' } }, '…') : null,
                  st.error === undefined && !st.loading && st.files.length === 0
                    ? React.createElement('div', { className: 'dsh-tools-scNote', style: { padding: '6px 12px' } }, t('scClean')) : null,
                  st.error === undefined && !st.loading ? st.files.map((file) => {
                    const key = `${repo.id}\u0001${file.path}`;
                    const isSel = sel.has(file.path);
                    const slash = file.path.lastIndexOf('/');
                    const dir = slash >= 0 ? file.path.slice(0, slash + 1) : '';
                    const name = slash >= 0 ? file.path.slice(slash + 1) : file.path;
                    const diffOpen = diffKey === key;
                    const ds = diffState[key];
                    return React.createElement(React.Fragment, { key: key },
                      React.createElement('div', { className: `dsh-tools-scFile${isSel ? ' is-selected' : ''}` },
                        React.createElement('input', {
                          type: 'checkbox',
                          checked: isSel,
                          title: t('scSelectHint'),
                          'aria-label': file.path,
                          onChange: () => toggleFile(repo.id, file.path),
                        }),
                        React.createElement('button', {
                          type: 'button',
                          className: 'dsh-tools-scFileMain',
                          title: file.path,
                          onClick: () => { void toggleDiff(repo, file); },
                        },
                        React.createElement('span', { className: 'dsh-tools-scFileName' }, name),
                        dir !== '' ? React.createElement('span', { className: 'dsh-tools-scFileDir' }, dir) : null),
                        React.createElement('span', {
                          className: `dsh-tools-scBadge is-${file.status}`,
                          title: t(STATUS_DICT[file.status] ?? 'stM'),
                        }, file.status),
                        React.createElement('button', {
                          type: 'button',
                          className: 'dsh-tools-scFileRevert',
                          title: t('scRevertHint'),
                          'aria-label': `${t('scRevert')}: ${file.path}`,
                          onClick: () => askRevert(repo, [file]),
                        }, icon(SC_REVERT_GLYPH))),
                      diffOpen ? React.createElement('div', null,
                        ds === undefined || ds.loading ? React.createElement('div', { className: 'dsh-tools-scNote', style: { padding: '6px 12px' } }, '…')
                          : (ds.error !== undefined ? React.createElement('div', { className: 'dsh-tools-scNote is-error', style: { padding: '6px 12px' } }, ds.error)
                            : React.createElement(React.Fragment, null,
                              React.createElement('div', { className: 'dsh-tools-scDiffBar' },
                                React.createElement('button', {
                                  type: 'button',
                                  className: 'dsh-tools-scMini',
                                  title: t('scDiffStyleTitle'),
                                  'aria-pressed': diffStyle === 'split' ? 'true' : 'false',
                                  onClick: () => {
                                    const next = diffStyle === 'split' ? 'unified' : 'split';
                                    setDiffStyle(next);
                                    writeDiffStyle(next);
                                  },
                                }, icon(diffStyle === 'split' ? SC_COLS_GLYPH : SC_ROWS_GLYPH),
                                React.createElement('span', null, diffStyle === 'split' ? t('scDiffSplit') : t('scDiffUnified')))),
                              React.createElement(DiffView, { text: ds.text, split: diffStyle === 'split' })))) : null);
                  }) : null,
                  st.truncated ? React.createElement('div', { className: 'dsh-tools-scNote', style: { padding: '4px 12px' } }, t('scTruncated')) : null,
                  (busyState.error !== '' && busyState.error !== undefined) || (busyState.note !== '' && busyState.note !== undefined)
                    ? React.createElement('div', {
                      className: `dsh-tools-scNote${busyState.error ? ' is-error' : ' is-ok'}`,
                      style: { padding: '4px 12px' },
                    }, busyState.error || busyState.note) : null,
                  sel.size > 0 ? React.createElement('div', { className: 'dsh-tools-scCommitBar' },
                    React.createElement('div', { className: 'dsh-tools-scMsgRow' },
                      React.createElement('textarea', {
                        className: 'dsh-tools-scMsg',
                        rows: 2,
                        value: msgMap[repo.id] ?? '',
                        placeholder: t('scMessagePlaceholder'),
                        onChange: (event) => setMsgMap((current) => ({ ...current, [repo.id]: event.target.value })),
                      })),
                    React.createElement('div', { className: 'dsh-tools-scActions' },
                      // v0.8 撤销改动 — reverts every selected file in one
                      // shot (M/D restored, A deleted) after a confirm dialog.
                      React.createElement('button', {
                        type: 'button',
                        className: 'dsh-tools-scBtn is-danger',
                        disabled: anyBusy,
                        title: t('scRevertHint'),
                        onClick: () => { askRevert(repo, st.files.filter((f) => sel.has(f.path))); },
                      }, icon(SC_REVERT_SM_GLYPH), React.createElement('span', null, t('scRevert'))),
                      React.createElement('button', {
                        type: 'button',
                        className: 'dsh-tools-scBtn',
                        disabled: anyBusy,
                        onClick: () => { void genMessage(repo); },
                      }, icon(SC_SPARK_GLYPH), React.createElement('span', null, t('scGenMsg'))),
                      React.createElement('button', {
                        type: 'button',
                        className: 'dsh-tools-scBtn is-primary',
                        disabled: anyBusy,
                        onClick: () => { void doCommit(repo); },
                      }, t('scCommit')))) : null) : null);
            });

            return React.createElement('div', {
              className: 'dsh-tools-scTab',
              role: 'complementary',
              'aria-label': t('sc'),
              'aria-busy': repos === null,
            },
            React.createElement('div', { className: 'dsh-tools-scHeader' },
              React.createElement('div', { className: 'dsh-tools-scHeaderTitle' },
                icon(SC_GLYPH),
                React.createElement('span', null, t('sc'))),
              // v0.7.6 the two batch buttons live in the header row, beside
              // the refresh button; they sweep EVERY repository listed below
              // (the per-group twins act on that repo alone).
              React.createElement('button', {
                type: 'button',
                className: 'dsh-tools-scMini',
                title: t('scUpdateCodeAllTitle'),
                disabled: batch !== null || !Array.isArray(repos) || repos.length === 0,
                onClick: () => { void runBatch('pull'); },
              }, icon(SC_PULL_GLYPH), React.createElement('span', null, t('scUpdateCode'))),
              React.createElement('button', {
                type: 'button',
                className: 'dsh-tools-scMini',
                title: t('scUpdateDbAllTitle'),
                disabled: batch !== null || !Array.isArray(repos) || repos.length === 0,
                onClick: () => { void runBatch('prisma'); },
              }, icon(SC_DB_GLYPH), React.createElement('span', null, t('scUpdateDb'))),
              // v0.7.7 thin divider groups the update pair apart from the
              // refresh control (visual grouping, review 2026-11-24).
              React.createElement('div', { className: 'dsh-tools-scVDiv', 'aria-hidden': 'true' }),
              React.createElement('button', {
                type: 'button',
                className: 'dsh-tools-scIconBtn',
                title: t('scRefresh'),
                'aria-label': t('scRefresh'),
                disabled: repos === null,
                onClick: () => { void loadAll(); },
              }, icon(SC_REFRESH_GLYPH))),
            // Batch progress / summary — a slim conditional row under the
            // header; hidden entirely while idle. role=status so assistive
            // tech announces progress and the final summary.
            batchNote !== '' ? React.createElement('div', { className: 'dsh-tools-scNoteRow', role: 'status' },
              React.createElement('span', {
                className: 'dsh-tools-scBatchNote',
                title: batchNote,
              }, batchNote)) : null,
            React.createElement('div', { className: 'dsh-tools-scBody' },
              repos === null ? React.createElement('div', { className: 'dsh-tools-scState' }, t('scLoading')) : null,
              repos !== null && reposError !== '' ? React.createElement('div', { className: 'dsh-tools-scState' },
                React.createElement('span', { className: 'dsh-tools-scNote is-error' }, reposError),
                React.createElement('div', null,
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scBtn',
                    onClick: () => { void loadAll(); },
                  }, t('scRefresh')))) : null,
              repos !== null && reposError === '' && repos.length === 0 ? React.createElement('div', { className: 'dsh-tools-scState' },
                React.createElement('span', { className: 'dsh-tools-scNote' }, t('scEmpty')),
                React.createElement('span', { className: 'dsh-tools-scNote' }, t('scEmptyHint')),
                rootsHint.length > 0 ? React.createElement('span', { className: 'dsh-tools-scNote is-dim' }, rootsHint.join(' · ')) : null) : null,
              repos !== null && reposError === '' ? repoGroups : null),
            // v0.8 撤销确认弹层 — the sc pane lives inside the sidebar, so a
            // fixed-position overlay is the only way to shade the whole app
            // like a system dialog. Two lists spell out the two fates
            // (restore vs delete-new) before anything runs.
            revertAsk !== null ? (() => {
              const restores = revertAsk.files.filter((f) => f.status !== 'A');
              const deletes = revertAsk.files.filter((f) => f.status === 'A');
              const renderAskList = (entries, danger) => {
                if (entries.length === 0) return null;
                const shown = entries.slice(0, 12);
                return React.createElement('div', null,
                  React.createElement('div', { className: `dsh-tools-scModalHead${danger ? ' is-del' : ''}` },
                    danger ? t('scRevertConfirmDelete') : t('scRevertConfirmRestore')),
                  React.createElement('div', { className: 'dsh-tools-scModalList' },
                    shown.map((entry) => React.createElement('span', {
                      key: entry.path,
                      className: danger ? 'is-del' : '',
                      title: entry.path,
                    }, entry.path)),
                    entries.length > shown.length
                      ? React.createElement('span', { className: 'is-dim' }, `… +${entries.length - shown.length}`)
                      : null));
              };
              return React.createElement('div', {
                className: 'dsh-tools-scModalWrap',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': t('scRevertConfirmTitle'),
                onClick: () => setRevertAsk(null),
              },
              React.createElement('div', {
                className: 'dsh-tools-scModal',
                onClick: (event) => event.stopPropagation(),
              },
                React.createElement('div', { className: 'dsh-tools-scModalTitle' }, t('scRevertConfirmTitle')),
                renderAskList(restores, false),
                renderAskList(deletes, true),
                React.createElement('div', { className: 'dsh-tools-scModalActions' },
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scBtn',
                    onClick: () => setRevertAsk(null),
                  }, t('scRevertConfirmCancel')),
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scBtn is-danger',
                    autoFocus: true,
                    onClick: () => { void doRevert(revertAsk.repo, revertAsk.files.map((f) => f.path)); },
                  }, t('scRevertConfirmOk')))));
            })() : null);
          };

          // Register/unregister the tab type against the current flag. The
          // registry lives on the app's rightbar package; register() returns
          // its own disposer, so the guide entry vanishes when we unload or
          // the feature is toggled off in Tools settings.
          let tabsService = null;
          let typeDispose = null;
          const syncType = () => {
            const want = featureFlags.sc === true && tabsService !== null
              && typeof tabsService.register === 'function';
            if (want && typeDispose === null) {
              typeDispose = tabsService.register({
                id: SC_TAB_TYPE_ID,
                kind: SC_TAB_TYPE_ID,
                title: () => t('sc'),
                guide: [{
                  id: 'sc',
                  order: 5, // above 工作区文件(10)/新建终端(20)/浏览网页 — the requested spot
                  title: () => t('sc'),
                  description: () => t('scGuideDesc'),
                  icon: ScGuideArt,
                }],
              });
            } else if (!want && typeDispose !== null) {
              try { typeDispose(); } catch { /* registry already refreshed */ }
              typeDispose = null;
            }
          };
          scFlagsHook = syncType;

          const disposers = [];
          // Pane body for our tab type. The dock dispatches the keyed
          // sidebar.right.pane.tab slot with the ACTIVE type's id, so keying
          // on the type id is all that is needed to own the body.
          disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
            { name: 'sidebar.right.pane.tab', key: SC_TAB_TYPE_ID },
            ScPanel,
          )));
          // Runtime capture of the tabs registry (child fiber: when the
          // service is absent the fiber stays pending and the guide entry
          // simply never appears — nothing else breaks).
          try {
            const tabsFiber = ctx.inject(['sidebarRightTabs'], (scope) => {
              tabsService = scope?.sidebarRightTabs ?? null;
              syncType();
            });
            if (tabsFiber && typeof tabsFiber.dispose === 'function') {
              disposers.push(() => { try { tabsFiber.dispose(); } catch { /* already disposed */ } });
            }
          } catch { /* client runtime without callback inject */ }
          syncType();

          return () => {
            scFlagsHook = null;
            if (typeDispose !== null) { try { typeDispose(); } catch { /* already gone */ } typeDispose = null; }
            for (const dispose of disposers.splice(0)) { try { dispose(); } catch { /* already gone */ } }
          };
        };

        // ---- right sidebar: expanded by default on a new Session ----
        //
        // The app keeps the right sidebar per Session and every new Session
        // starts with the column collapsed (the Session restored at boot
        // gets its own persisted layout back). DSH has no setting for this,
        // so we watch the sidebar controller's `mounted` snapshot — the
        // Session on screen — and expand the column once for a Session the
        // user has just created:
        //   • "new" = blank (no prompt sent yet; New Session may reuse a
        //     blank of the same workspace), or absent from the session list
        //     when it first became ready and still younger than
        //     FRESH_WINDOW_MS;
        //   • the Session on screen when the controller arrives is left
        //     alone while it stays there, so its persisted state wins — and
        //     so is the Session DSH selects while starting up, as long as it
        //     has a prompt in it (the first `mounted` value after "nothing
        //     on screen" is that boot selection; a blank one is a new
        //     Session and opens);
        //   • each Session is handled once per run: collapsing it afterwards
        //     sticks, however often the user comes back to it.
        // `mounted` moves before React renders the selection and the
        // Session's sidebar store is only adopted in that render — the
        // controller throws "no session surface is mounted" until then, so
        // the expand retries briefly. The toggle also moves DOM focus into
        // the sidebar pane (app behaviour for the header button); a fresh
        // Session is there to be typed in, so focus goes back.
        const registerSidebarAutoOpen = () => {
          if (typeof ctx?.inject !== 'function') return () => {};

          const FRESH_WINDOW_MS = 10 * 60_000;
          const RETRY_DELAY_MS = 40;
          const RETRY_LIMIT = 25;
          const BOOT_BASELINE_FALLBACK_MS = 3000;
          const SIDEBAR_REGION = '[data-sidebar-right-session]';

          let sidebar = null;        // ctx.sidebarRight
          let sessions = null;       // ctx.sessions
          let disposed = false;
          let lastMounted;           // last value seen on sidebar.mounted
          let bootExempt = null;     // Session on screen when the controller arrived
          let bootPending = false;   // nothing on screen yet → the next one is DSH's boot selection
          let bootCaptured = false;
          let bootTimer = null;
          let attempt = null;        // in-flight expand: { id, timer, tries }
          const bootIds = new Set(); // listed when the session list first became ready
          const handled = new Set(); // Sessions already expanded (or given up on)
          const unwire = [];
          const disposers = [];

          const listSnapshot = () => {
            try { return sessions?.list?.getSnapshot?.() ?? null; } catch { return null; }
          };

          const captureBootIds = () => {
            const list = listSnapshot();
            if (list === null) return;
            const ids = Array.isArray(list.ids) ? list.ids : Object.keys(list.byId ?? {});
            for (const id of ids) bootIds.add(id);
            bootCaptured = true;
          };

          const rowOf = (id) => {
            const row = listSnapshot()?.byId?.[id];
            return row !== null && row !== undefined && typeof row === 'object' ? row : null;
          };

          const isNewSession = (id) => {
            if (id === bootExempt) return false;
            const row = rowOf(id);
            if (row === null) return false;
            // Subagent children are spawned, not created by the user.
            if (row.origin === 'subagent' || row.parentId !== undefined) return false;
            if (row.blank === true) return true;
            if (bootIds.has(id)) return false;
            const updatedAt = Number(row.updatedAt);
            return Number.isFinite(updatedAt) && Date.now() - updatedAt < FRESH_WINDOW_MS;
          };

          const insideSidebar = (node) => {
            try { return node?.closest?.(SIDEBAR_REGION) != null; } catch { return false; }
          };

          // Where focus goes back to: the element that had it (when still in
          // the document), else the main composer.
          const focusTarget = (previous) => {
            if (previous !== null && previous !== undefined
              && previous !== document.body && previous !== document.documentElement
              && previous.isConnected === true) {
              return previous;
            }
            try { return document.querySelector('[data-composer-card] [contenteditable="true"]') ?? null; } catch { return null; }
          };

          // Only acts while focus sits in the sidebar (or nowhere): when the
          // app moved it somewhere useful on its own, that stands.
          const restoreFocus = (target) => {
            if (target === null) return;
            const apply = () => {
              if (disposed || target.isConnected !== true) return;
              const active = document.activeElement;
              if (!insideSidebar(active) && active !== document.body) return;
              try { target.focus({ preventScroll: true }); } catch { /* not focusable */ }
            };
            apply();
            // A page that focuses itself after mount gets the same answer.
            setTimeout(apply, 0);
          };

          const cancelAttempt = () => {
            if (attempt !== null && attempt.timer !== 0) { try { clearTimeout(attempt.timer); } catch { /* gone */ } }
            attempt = null;
          };

          const expandSidebar = (id) => {
            if (attempt !== null && attempt.id === id) return;
            cancelAttempt();
            const token = { id, timer: 0, tries: 0 };
            attempt = token;
            const finish = (remember) => {
              if (remember) handled.add(id);
              if (attempt === token) attempt = null;
            };
            const schedule = (delay) => {
              token.timer = setTimeout(step, delay);
            };
            const step = () => {
              if (disposed || attempt !== token) return;
              // The user moved on before the sidebar could open: leave the
              // Session unhandled so coming back to it still opens it.
              let onScreen;
              try { onScreen = sidebar?.mounted?.getSnapshot?.(); } catch { onScreen = undefined; }
              if (onScreen !== id) { finish(false); return; }
              if (featureFlags.openSidebar !== true) { finish(false); return; }
              let expanded = false;
              try { expanded = sidebar.isExpanded() === true; } catch { expanded = false; }
              if (expanded) { finish(true); return; }
              const target = focusTarget(document.activeElement);
              try {
                sidebar.toggleExpanded();
                finish(true);
                restoreFocus(target);
                return;
              } catch (error) {
                if (!/no session surface is mounted/.test(String(error?.message ?? error))) {
                  finish(true); // not the adoption race: do not loop on it
                  return;
                }
              }
              token.tries += 1;
              if (token.tries >= RETRY_LIMIT) { finish(true); return; }
              schedule(RETRY_DELAY_MS);
            };
            // Always from a task of our own: the selection re-render that
            // adopts the store has committed by then, and the controller's
            // flushSync never runs inside the app's own store listeners.
            schedule(0);
          };

          const maybeOpen = () => {
            if (disposed || featureFlags.openSidebar !== true) return;
            if (typeof sidebar?.mounted?.getSnapshot !== 'function'
              || typeof sidebar.toggleExpanded !== 'function') return;
            const id = sidebar.mounted.getSnapshot();
            if (id === null || id === undefined || handled.has(id)) return;
            if (!isNewSession(id)) return;
            expandSidebar(id);
          };

          const onList = () => {
            if (disposed) return;
            // 'ready' = the first successful pull; before that the list may
            // still be filling up and must not become the baseline.
            if (!bootCaptured && listSnapshot()?.phase === 'ready') captureBootIds();
            // A Session listed after it came on screen (list and selection
            // race each other) is only classifiable now.
            maybeOpen();
          };

          const onMounted = (id) => {
            if (disposed || id === lastMounted) return;
            lastMounted = id;
            // DSH selecting its boot Session: the saved layout is the user's
            // own last state — unless it is a New Session nobody typed in.
            if (bootPending && id !== undefined) {
              bootPending = false;
              if (rowOf(id)?.blank !== true) { bootExempt = id; return; }
            }
            if (bootExempt !== null && bootExempt !== id) bootExempt = null;
            maybeOpen();
          };

          let fiber = null;
          try {
            fiber = ctx.inject(['sidebarRight', 'sessions'], (scope) => {
              if (disposed) return;
              sidebar = scope?.sidebarRight ?? null;
              sessions = scope?.sessions ?? null;
              if (typeof sidebar?.mounted?.getSnapshot === 'function') {
                lastMounted = sidebar.mounted.getSnapshot();
                bootPending = lastMounted === undefined;
                bootExempt = lastMounted ?? null;
                try {
                  if (typeof sidebar.mounted.subscribe === 'function') {
                    const off = sidebar.mounted.subscribe(onMounted);
                    unwire.push(typeof off === 'function' ? off : () => {});
                  }
                } catch { /* no subscription → only the list path fires */ }
              }
              try {
                if (typeof sessions?.list?.subscribe === 'function') {
                  const off = sessions.list.subscribe(onList);
                  unwire.push(typeof off === 'function' ? off : () => {});
                }
              } catch { /* no list → mounted-only detection */ }
              onList();
            });
          } catch { /* client runtime without callback inject */ }
          if (fiber !== null && typeof fiber.dispose === 'function') {
            disposers.push(() => { try { fiber.dispose(); } catch { /* already disposed */ } });
          }
          // Builds that never report 'ready': whatever is listed by now
          // predates anything the user does next.
          bootTimer = setTimeout(() => {
            bootTimer = null;
            if (!disposed && !bootCaptured) captureBootIds();
          }, BOOT_BASELINE_FALLBACK_MS);

          return () => {
            disposed = true;
            cancelAttempt();
            if (bootTimer !== null && bootTimer !== 0) { try { clearTimeout(bootTimer); } catch { /* gone */ } }
            bootTimer = null;
            for (const off of unwire.splice(0)) { try { off(); } catch { /* already gone */ } }
            for (const dispose of disposers.splice(0)) { try { dispose(); } catch { /* already gone */ } }
          };
        };

        // ---- today's usage chip (slot sidebar.footer.action) ----
        //
        // The sidebar footer renders list occupants side-by-side above the
        // settings/avatar row — exactly the empty bottom-left area. Expanded
        // sidebar shows icon+label+compact value; the 56px rail shows an
        // icon-only square. Click opens the detail popover.
        const registerUsageWidget = () => {
          beacon('usage-reg-entry', { hasReact: React !== null, canRegister: typeof ctx?.slots?.register === 'function', canInject: typeof ctx?.slots?.inject === 'function' });
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureUsageStyles();
          usageCall = (method, payload) => call(method, payload);

          const UsageRow = (props) => {
            const wide = props?.wide !== false;
            const subscribe = (listener) => usageStore.subscribe(listener);
            const snap = typeof React.useSyncExternalStore === 'function'
              ? React.useSyncExternalStore(subscribe, usageStore.snapshot, usageStore.snapshot)
              : null;
            const [, forceState] = React.useState(0);
            React.useEffect(() => {
              if (snap !== null) return undefined;
              const rerender = () => forceState((value) => value + 1);
              const unsubscribe = usageStore.subscribe(rerender);
              return unsubscribe;
            }, [snap !== null]);
            const state = snap ?? usageStore.state;
            const rootRef = React.useRef(null);
            const [expanded, setExpanded] = React.useState(false);

            // SWR: load on mount, refresh when the tab becomes visible, poll
            // every 5 minutes while the chip lives.
            React.useEffect(() => {
              beacon('usage-mount', { wide });
              usageStore.ensure();
              const onVisible = () => { if (document.visibilityState === 'visible') usageStore.ensure(); };
              document.addEventListener('visibilitychange', onVisible);
              const timer = typeof window.setInterval === 'function'
                ? window.setInterval(() => { if (document.visibilityState === 'visible') usageStore.ensure(); }, 300_000)
                : 0;
              return () => {
                document.removeEventListener('visibilitychange', onVisible);
                if (timer !== 0 && typeof window.clearInterval === 'function') window.clearInterval(timer);
              };
            }, []);
            React.useEffect(() => () => { if (expanded) usagePopover.close(); }, [expanded]);

            if (featureFlags.usage !== true) return null;

            const today = state.data?.today;
            const valueClass = state.status === 'error' && state.data === null
              ? 'dsh-tools-usageChipValue is-error'
              : today !== undefined && (today.total ?? 0) === 0 && (today.requests ?? 0) === 0
                ? 'dsh-tools-usageChipValue is-empty'
                : 'dsh-tools-usageChipValue';
            const valueText = state.status === 'error' && state.data === null
              ? '—'
              : formatTokens(today?.total ?? 0);
            const iconClass = state.status === 'error' && state.data === null
              ? 'dsh-tools-usageChipIcon is-error'
              : 'dsh-tools-usageChipIcon';
            const titleText = state.status === 'error' && state.data === null
              ? t('usageError')
              : `${t('usageTitle')} · ${t('usageRequests')} ${today?.requests ?? 0}`;

            const toggle = (event) => {
              event.stopPropagation();
              const node = rootRef.current;
              if (node === null || node.isConnected !== true) return;
              if (expanded) {
                usagePopover.close();
                setExpanded(false);
              } else {
                usagePopover.open(node, { t, onClose: () => setExpanded(false) });
                usageStore.refresh(true);
                setExpanded(true);
              }
            };
            const onKeyDown = (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle(event);
              }
            };

            const className = wide
              ? 'dsh-tools-usageChip'
              : 'dsh-tools-usageChip is-rail';
            return React.createElement(
              'button',
              {
                type: 'button',
                ref: rootRef,
                className,
                title: titleText,
                'aria-label': titleText,
                'aria-haspopup': 'dialog',
                'aria-expanded': expanded ? 'true' : 'false',
                onClick: toggle,
                onKeyDown,
              },
              React.createElement('span', { className: iconClass, dangerouslySetInnerHTML: { __html: USAGE_GLYPH } }),
              wide ? React.createElement('span', { className: 'dsh-tools-usageChipLabel' }, t('usageTodayLabel')) : null,
              wide ? React.createElement('span', { className: valueClass }, valueText) : null,
            );
          };

          // COLD-BOOT FIX (2026-11-23 "重启后不展示了"): registering directly
          // into 'sidebar.footer.action' throws on a fresh boot because the
          // sidebar shell (which declares the slot) has not loaded yet:
          //   slot "sidebar.footer.action" is not declared
          // ctx.slots.inject() waits for the declaration and re-runs the setup
          // when the slot (re)appears — the same pattern as the phrase bar,
          // composer buttons and settings panel, which all survive reboots.
          const effectBody = () => ctx.slots.inject('sidebar.footer.action', () => {
            const unregister = ctx.slots.register(
              { name: 'sidebar.footer.action', id: 'dsh-tools-usage', order: 5, label: () => t('usageTitle') },
              (props) => { beacon('usage-shell-render'); return React.createElement(UsageRow, props); },
            );
            beacon('usage-reg-ok');
            return () => {
              try { unregister(); } catch { /* already gone */ }
              usagePopover.close();
              // NOTE: deliberately NOT nulling `usageCall` here — see the binding
              // note at apply() entry (HMR dispose order races the new register).
            };
          });
          if (typeof ctx.effect === 'function') {
            return ctx.effect(effectBody, 'dsh-tools: usage widget');
          }
          return effectBody();
        };

        // ---- state ----
        let menuHost = null;        // the [data-windows-menu] element we mounted into
        let styleEl = null;
        let moreButton = null;
        let menuEl = null;          // open dropdown element, inside the shadow
        let phase = 'idle';         // idle | busy | done | error
        let errorMessage = '';
        let menuMode = 'restart';   // which action busy/done/error reflect

        const closeMenu = () => {
          if (menuEl !== null) {
            menuEl.remove();
            menuEl = null;
          }
          phase = 'idle';
          errorMessage = '';
          if (moreButton !== null) moreButton.setAttribute('aria-expanded', 'false');
        };

        const clearMenu = () => { if (menuEl !== null) menuEl.textContent = ''; };

        const el = (tag, className, text) => {
          const node = document.createElement(tag);
          if (className) node.className = className;
          if (text !== undefined) node.textContent = text;
          return node;
        };

        const doRestart = async () => {
          menuMode = 'restart';
          phase = 'busy';
          renderMenu();
          try {
            const result = await call('restart', {});
            if (result?.ok === true) phase = 'done';
            else {
              phase = 'error';
              const err = result?.error;
              errorMessage = typeof err?.message === 'string' && err.message !== ''
                ? (typeof err?.code === 'string' && err.code !== '' ? `[${err.code}] ${err.message}` : err.message)
                : t('errorGeneric');
            }
          } catch (error) {
            phase = 'error';
            errorMessage = error?.message ?? String(error);
          }
          renderMenu();
        };

        // Hot-reload installed plugin code via the Host's hmr service; the
        // outcome is confirmed by watching dev.ping's module version change.
        const doReload = async () => {
          menuMode = 'reload';
          phase = 'busy';
          renderMenu();
          try {
            let versionBefore = '';
            try {
              const ping = await call('dev.ping', {});
              if (ping?.ok === true) versionBefore = String(ping?.value?.version ?? '');
            } catch { /* keep "" — best effort */ }
            const result = await call('dev.reconcile', {});
            if (result?.ok !== true) {
              const err = result?.error;
              throw new Error(typeof err?.message === 'string' && err.message !== ''
                ? (typeof err?.code === 'string' && err.code !== '' ? `[${err.code}] ${err.message}` : err.message)
                : t('errorGeneric'));
            }
            let confirmed = false;
            for (let i = 0; i < 14; i += 1) {
              await new Promise((resolve) => { setTimeout(resolve, 700); });
              try {
                const ping = await call('dev.ping', {});
                const version = ping?.ok === true ? String(ping?.value?.version ?? '') : '';
                if (version !== '' && version !== versionBefore) { confirmed = true; break; }
              } catch { /* routes re-register while fibers restart; keep polling */ }
            }
            if (confirmed) phase = 'done';
            else { phase = 'error'; errorMessage = t('reloadUnknown'); }
          } catch (error) {
            phase = 'error';
            errorMessage = error?.message ?? String(error);
          }
          renderMenu();
        };

        const renderMenu = () => {
          if (menuEl === null) return;
          clearMenu();
          if (phase === 'idle') {
            // One-click restart: the ⚠ warning in the hint replaces the old
            // confirmation dialog (user request 2026-11-19).
            const item = el('button', 'dsh-tools-item');
            item.type = 'button';
            item.setAttribute('role', 'menuitem');
            item.addEventListener('click', () => { void doReload(); });
            const glyph = el('span', 'dsh-tools-itemGlyph');
            glyph.innerHTML = SC_REFRESH_GLYPH;
            const main = el('span', 'dsh-tools-itemMain');
            main.append(el('span', 'dsh-tools-itemTitle', t('reload')));
            main.append(el('span', 'dsh-tools-itemHint dsh-tools-hintInfo', t('reloadHint')));
            item.append(glyph, main);
            menuEl.append(item);
            menuEl.append(el('div', 'dsh-tools-sep'));
            // One-click restart: the ⚠ warning in the hint replaces the old
            // confirmation dialog (user request 2026-11-19).
            const restartItem = el('button', 'dsh-tools-item');
            restartItem.type = 'button';
            restartItem.setAttribute('role', 'menuitem');
            restartItem.addEventListener('click', () => { void doRestart(); });
            const restartGlyph = el('span', 'dsh-tools-itemGlyph');
            restartGlyph.innerHTML = RESTART_GLYPH;
            const restartMain = el('span', 'dsh-tools-itemMain');
            restartMain.append(el('span', 'dsh-tools-itemTitle', t('restart')));
            restartMain.append(el('span', 'dsh-tools-itemHint', t('restartHint')));
            restartItem.append(restartGlyph, restartMain);
            menuEl.append(restartItem);
          } else if (phase === 'busy' || phase === 'done') {
            const reloadFlow = menuMode === 'reload';
            const status = el('div', 'dsh-tools-status');
            const title = el('div', 'dsh-tools-statusTitle');
            const glyph = el('span', 'dsh-tools-itemGlyph dsh-tools-spin');
            glyph.innerHTML = reloadFlow ? SC_REFRESH_GLYPH : RESTART_GLYPH;
            const busyText = reloadFlow ? t('reloadBusy') : t('scheduling');
            const doneText = reloadFlow ? t('reloadDone') : t('restarting');
            glyph.classList.toggle('dsh-tools-spin', !(reloadFlow && phase === 'done'));
            title.append(glyph, el('span', null, phase === 'busy' ? busyText : doneText));
            status.append(title);
            if (reloadFlow && phase === 'done') {
              status.append(el('div', 'dsh-tools-itemHint dsh-tools-hintInfo', t('reloadDoneHint')));
            }
            menuEl.append(status);
          } else if (phase === 'error') {
            const status = el('div', 'dsh-tools-status');
            status.append(el('div', 'dsh-tools-strong', menuMode === 'reload' ? t('actionFailed') : t('errorTitle')));
            status.append(el('div', 'dsh-tools-errorText', errorMessage || t('errorGeneric')));
            const actions = el('div', 'dsh-tools-actions');
            const close = el('button', 'dsh-tools-btn', t('close'));
            close.type = 'button';
            close.addEventListener('click', closeMenu);
            actions.append(close);
            status.append(actions);
            menuEl.append(status);
          }
        };

        const openMenu = () => {
          if (moreButton === null || menuHost === null) return;
          if (menuEl !== null) { closeMenu(); return; }
          const shadow = menuHost.shadowRoot;
          if (shadow === null) return;
          menuEl = el('div', 'dsh-tools-menu');
          menuEl.setAttribute('role', 'menu');
          const hostRect = menuHost.getBoundingClientRect();
          const buttonRect = moreButton.getBoundingClientRect();
          menuEl.style.left = `${Math.max(0, buttonRect.left - hostRect.left)}px`;
          shadow.append(menuEl);
          phase = 'idle';
          errorMessage = '';
          renderMenu();
          moreButton.setAttribute('aria-expanded', 'true');
        };

        // ---- outside/Escape close (capture-phase, on the window) ----
        const onPointerDown = (event) => {
          if (menuEl === null) return;
          const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
          if (path.includes(menuEl) || (moreButton !== null && path.includes(moreButton))) return;
          closeMenu();
        };
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && menuEl !== null) closeMenu();
        };
        const onBlur = () => { if (menuEl !== null) closeMenu(); };
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('blur', onBlur);
        keep(() => {
          window.removeEventListener('pointerdown', onPointerDown, true);
          window.removeEventListener('keydown', onKeyDown, true);
          window.removeEventListener('blur', onBlur);
        });

        // ---- language follows <html lang> (same source as the caption labels) ----
        const updateButtonLabel = () => {
          if (moreButton !== null) moreButton.textContent = t('more');
          if (menuEl !== null) renderMenu();
        };
        const langObserver = new MutationObserver(() => {
          const next = detectLang();
          if (next !== lang) {
            lang = next;
            updateButtonLabel();
          }
        });
        langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
        keep(() => langObserver.disconnect());

        // ---- mount into the caption menubar whenever it (re)appears ----
        const unmountButton = () => {
          closeMenu();
          if (styleEl !== null) { styleEl.remove(); styleEl = null; }
          if (moreButton !== null) { moreButton.remove(); moreButton = null; }
          menuHost = null;
        };

        const mountInto = (host) => {
          const shadow = host.shadowRoot;
          if (shadow === null) return;
          const bar = shadow.querySelector('[role="menubar"]');
          if (bar === null || bar.querySelector('[data-dsh-tools-more]') !== null) return;
          styleEl = document.createElement('style');
          styleEl.dataset.dshTools = '';
          styleEl.textContent = MENU_CSS;
          shadow.append(styleEl);

          moreButton = document.createElement('button');
          moreButton.type = 'button';
          moreButton.dataset.dshToolsMore = '';
          moreButton.setAttribute('role', 'menuitem');
          moreButton.setAttribute('aria-haspopup', 'menu');
          moreButton.setAttribute('aria-expanded', 'false');
          moreButton.tabIndex = -1;
          moreButton.addEventListener('pointerdown', (event) => event.preventDefault());
          moreButton.addEventListener('mousedown', (event) => event.preventDefault());
          moreButton.addEventListener('click', openMenu);
          moreButton.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openMenu();
            }
          });
          updateButtonLabel();
          bar.append(moreButton);
          menuHost = host;
        };

        const ensureMounted = () => {
          if (!featureFlags.moreMenu) { unmountButton(); return; }
          const host = document.querySelector('[data-windows-menu]');
          if (host === menuHost) return;
          unmountButton();
          if (host !== null) mountInto(host);
        };

        // Flag changes coming back from the settings panel re-evaluate what
        // renders. Slot items and the history handler read featureFlags live;
        // the caption menu owns real DOM that must be (un)mounted here, and
        // the SC tab type is (un)registered on the sidebarRightTabs registry.
        runtime.applyFlags = () => {
          ensureMounted();
          if (scFlagsHook !== null) { try { scFlagsHook(); } catch { /* registry gone */ } }
        };

        if (document.body !== null) {
          const bodyObserver = new MutationObserver(ensureMounted);
          bodyObserver.observe(document.body, { childList: true, subtree: true });
          keep(() => bodyObserver.disconnect());
        }
        ensureMounted();

        // Feature flags + model override from the Host settings; the defaults
        // above render until this resolves, then adjust quietly.
        (async () => {
          try {
            const result = await call('settings.get', {});
            if (result?.ok === true && result.value?.settings) {
              const settings = result.value.settings;
              if (settings.features) Object.assign(featureFlags, settings.features);
              if (settings.model) Object.assign(modelOverride, settings.model);
              if (Array.isArray(settings.phrases)) phraseStore.set(settings.phrases);
              runtime.applyFlags?.();
              beacon('client-flags', { usage: featureFlags.usage === true });
            }
          } catch { /* defaults stay in effect */ }
        })();

        // Composer assist buttons (degrade silently without React/slots).
        try {
          keep(registerComposerButtons());
        } catch (error) {
          console.warn('[dsh-tools] composer buttons unavailable:', error);
        }

        // Quick phrases floating above the composer.
        try {
          keep(registerPhrasesBar());
        } catch (error) {
          console.warn('[dsh-tools] phrases bar unavailable:', error);
        }

        // Settings section in the app settings page.
        try {
          keep(registerSettingsPanel());
        } catch (error) {
          console.warn('[dsh-tools] settings panel unavailable:', error);
        }

        // Source control: Start-guide entry + right-sidebar tab.
        try {
          keep(registerScUi());
        } catch (error) {
          console.warn('[dsh-tools] source control unavailable:', error);
        }

        // Right sidebar expanded by default on a new Session.
        try {
          keep(registerSidebarAutoOpen());
        } catch (error) {
          console.warn('[dsh-tools] sidebar auto-open unavailable:', error);
        }

        // Today's token usage chip in the sidebar footer.
        try {
          keep(registerUsageWidget());
        } catch (error) {
          beacon('usage-reg-throw', { message: String(error?.message ?? error) });
          console.warn('[dsh-tools] usage widget unavailable:', error);
        }

        // Terminal-style ↑/↓ input history (plain DOM, always on).
        try {
          keep(registerHistoryNavigation());
        } catch (error) {
          console.warn('[dsh-tools] input history unavailable:', error);
        }

        return () => {
          runtime.applyFlags = null;
          unmountButton();
          for (const dispose of disposers.splice(0)) {
            try { dispose(); } catch { /* already gone */ }
          }
        };
      },
    };
  },
});
