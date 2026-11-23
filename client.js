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
        scEmptyHint: '自动扫描工作区目录；也可在工具设置里添加其他根目录。',
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
        scNoMsg: '先填写或生成提交信息',
        scNoFiles: '勾选要提交的文件',
        scDiffFailed: 'diff 加载失败',
        scSelectHint: '勾选文件后可单笔提交',
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
        scEmptyHint: 'Workspace directories are scanned automatically; add more roots in Tools settings.',
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
        scNoMsg: 'Write or generate a commit message first',
        scNoFiles: 'Select files to commit',
        scDiffFailed: 'Failed to load diff',
        scSelectHint: 'Select files to commit them alone',
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
      // ---- quick phrases bar (conversation.input.overlay slot) ----
      // The overlay anchor is a zero-height absolute strip pinned to the top of
      // the composer card; translateY(-100%) floats the pill row just above
      // the input box (user request 2026-11-23).
      '.dsh-tools-phraseBar{position:absolute;left:0;right:0;top:0;transform:translateY(-100%);display:flex;gap:6px;padding:0 2px 7px;overflow-x:auto;scrollbar-width:none;z-index:6;}',
      '.dsh-tools-phraseBar::-webkit-scrollbar{display:none;}',
      '.dsh-tools-phrase{flex:none;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;height:24px;padding:0 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsh-specific-input-major,var(--dsw-alias-bg-layer-1,#fff));box-shadow:var(--dsw-elevation-soft,none);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:22px;cursor:default;}',
      '.dsh-tools-phrase:hover,.dsh-tools-phrase:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-brand-primary,#3b82f6);outline:none;}',
      // ---- quick phrases editor (settings panel section) ----
      '.dsh-tools-phraseRow{display:flex;align-items:center;gap:8px;}',
      '.dsh-tools-phraseInput{flex:1;min-width:0;padding:6px 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:13px;}',
    ].join('\n');

    const GEN_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';

    const OPT_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2L11 5"/></svg>';

    const SC_GLYPH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>';
    const SC_PUSH_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
    const SC_REFRESH_GLYPH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
    const SC_CLOSE_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    const SC_CHEVRON_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
    const SC_PLUS_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const SC_SPARK_GLYPH = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';

    const SC_CSS = [
      // tab body inside the right-sidebar pane (sidebar.right.pane.tab slot);
      // the pane provides the box, this fills it edge to edge.
      '.dsh-tools-scTab{display:flex;flex-direction:column;height:100%;min-height:0;font-size:13.5px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-scHeader{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:none;}',
      '.dsh-tools-scHeaderTitle{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;flex:1;min-width:0;}',
      '.dsh-tools-scIconBtn{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:default;flex:none;}',
      '.dsh-tools-scIconBtn:hover:not(:disabled),.dsh-tools-scIconBtn:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary);outline:none;}',
      '.dsh-tools-scIconBtn:disabled{opacity:.55;}',
      '.dsh-tools-scBody{flex:1;overflow-y:auto;padding:8px 8px 16px;}',
      '.dsh-tools-scState{display:flex;flex-direction:column;gap:8px;padding:18px 10px;color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-scGroup{margin:4px 0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-2,transparent);}',
      '.dsh-tools-scGroupHead{display:flex;align-items:center;gap:7px;padding:7px 10px;background:transparent;}',
      '.dsh-tools-scGroupHeadMain{flex:1;min-width:0;display:flex;align-items:center;gap:7px;background:transparent;border:0;padding:2px 4px;border-radius:5px;color:inherit;font:inherit;text-align:left;cursor:default;}',
      '.dsh-tools-scGroupHeadMain:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));}',
      '.dsh-tools-scRepoName{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dsh-tools-scBranch{font-size:11.5px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));border-radius:5px;padding:1px 6px;white-space:nowrap;max-width:110px;overflow:hidden;text-overflow:ellipsis;flex:none;}',
      '.dsh-tools-scCount{font-size:11.5px;color:var(--dsw-alias-label-secondary);flex:none;}',
      '.dsh-tools-scChev{display:inline-flex;flex:none;color:var(--dsw-alias-label-secondary);transition:transform 150ms ease;}',
      '.dsh-tools-scChev.is-open{transform:rotate(180deg);}',
      '.dsh-tools-scMini{display:inline-flex;align-items:center;height:22px;padding:0 7px;border:1px solid var(--dsw-alias-border-l2);border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11.5px;cursor:default;flex:none;white-space:nowrap;}',
      '.dsh-tools-scMini:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-secondary);}',
      '.dsh-tools-scMini:disabled{opacity:.55;}',
      '.dsh-tools-scFiles{display:flex;flex-direction:column;}',
      '.dsh-tools-scFile{display:flex;align-items:center;gap:7px;padding:3px 10px 3px 12px;cursor:default;}',
      '.dsh-tools-scFile:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));}',
      '.dsh-tools-scFile input[type=checkbox]{accent-color:var(--dsw-alias-brand-primary,#3b82f6);width:14px;height:14px;flex:none;margin:0;}',
      '.dsh-tools-scFileMain{flex:1;min-width:0;background:transparent;border:0;padding:2px 3px;border-radius:4px;color:inherit;font:inherit;text-align:left;cursor:default;overflow:hidden;}',
      '.dsh-tools-scFileMain:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));}',
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
      '.dsh-tools-scDiff .dsh-tools-dl.is-hunk{color:var(--dsw-alias-label-secondary);}',
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
      '.dsh-tools-scNote{font-size:11.5px;color:var(--dsw-alias-label-secondary);min-width:0;word-break:break-word;}',
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

      // User rows render the message text more than once (a visible copy plus
      // a hidden preview/edit copy) and inline timestamps. Strip stamps, then
      // collapse the "TEXT stamp TEXT" duplication so only the plain text the
      // user actually typed remains.
      const cleanHistoryText = (raw) => {
        let text = String(raw ?? '').replace(/\u00a0/g, ' ');
        // Inline stamps → newline separators (zh dates, times, en dates, ISO).
        text = text
          .replace(/\d{1,2}月\s*\d{1,2}日(\s*\d{1,2}:\d{2}(?::\d{2})?)?/g, '\n')
          .replace(/\d{4}-\d{1,2}-\d{1,2}([T ]\d{1,2}:\d{2}(?::\d{2})?)?/g, '\n')
          .replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(,?\s*\d{4})?\b/gi, '\n');
        // Standalone time lines are dropped below; inline times inside a
        // sentence ("会议改到 14:30") must survive.
        const lines = text.split('\n').map((line) => line.trim())
          .filter((line) => line !== ''
            && !/^\d{1,2}:\d{2}(\s*[APap][Mm])?$/.test(line));
        text = lines.join('\n').trim();
        // Collapse exact duplicated halves ("TEXT\nTEXT" or "TEXTTEXT").
        for (let round = 0; round < 2; round += 1) {
          if (text.length < 8) break;
          const mid = Math.floor(text.length / 2);
          for (let cut = mid; cut >= mid - 400 && cut >= 4; cut -= 1) {
            const head = text.slice(0, cut).trim();
            const tail = text.slice(cut).trim();
            if (head !== '' && head === tail) { text = head; cut = -1; round = 2; break; }
          }
          if (text.length < 8) break;
        }
        return text;
      };

      const readHistory = () => {
        const rows = document.querySelectorAll('[data-chat-flow-kind="user"]');
        const items = [];
        for (const row of rows) {
          const text = cleanHistoryText(row.innerText);
          if (text !== '') items.push(text);
        }
        return items;
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

      let pointer = null;   // null = at the live draft; otherwise index into history
      let draft = '';
      const loadInto = (editor, text) => {
        editor.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, text);
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      };

      const onKeyDown = (event) => {
        if (!featureFlags.history) return;
        const editor = editorFor(event.target);
        if (editor === null) return;
        if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
          pointer = null;
          return;
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          const history = readHistory();
          if (event.key === 'ArrowUp') {
            if (pointer === null) {
              if (history.length === 0) return;
              // Only enter history mode from an empty box or the very start of
              // the text — otherwise ArrowUp must keep moving the caret.
              if (!isCaretAtVeryStart(editor)) return;
              draft = editor.innerText ?? '';
              pointer = history.length - 1;
            } else {
              pointer = Math.max(0, pointer - 1);
            }
            event.preventDefault();
            event.stopPropagation();
            loadInto(editor, history[pointer]);
            return;
          }
          if (pointer === null) return; // ArrowDown at the draft: caret moves normally
          event.preventDefault();
          event.stopPropagation();
          const next = pointer + 1;
          if (next >= history.length) {
            pointer = null;
            loadInto(editor, draft);
          } else {
            pointer = next;
            loadInto(editor, history[next]);
          }
          return;
        }
        if (pointer !== null) pointer = null; // any other key: back to normal editing
      };

      document.addEventListener('keydown', onKeyDown, true);
      return () => {
        document.removeEventListener('keydown', onKeyDown, true);
        pointer = null;
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

        // ---- quick phrases bar (slot conversation.input.overlay) ----
        // Floating pill row above the composer; click inserts at the caret
        // (user request 2026-11-23). Reads phraseStore so the settings panel
        // can refresh every mounted bar without re-registering the slot.
        const registerPhrasesBar = () => {
          if (React === null || typeof ctx?.slots?.register !== 'function'
            || typeof ctx.slots.inject !== 'function') {
            return () => {};
          }
          ensureGenStyles();

          const PhrasesBar = () => {
            const items = typeof React.useSyncExternalStore === 'function'
              ? React.useSyncExternalStore(phraseStore.subscribe, phraseStore.snapshot, phraseStore.snapshot)
              : phraseStore.snapshot();
            if (featureFlags.phrases !== true || items.length === 0) return null;
            return React.createElement('div', { className: 'dsh-tools-phraseBar' },
              items.map((text, index) => React.createElement('button', {
                key: `${index}-${text}`,
                type: 'button',
                className: 'dsh-tools-phrase',
                title: `${text}\n${t('phrasesChipTitle')}`,
                onClick: (event) => { insertPhraseAtCaret(event.currentTarget, text); },
              }, text)));
          };

          const effectBody = () => ctx.slots.inject('conversation.input.overlay', () => {
            const unregister = ctx.slots.register(
              { name: 'conversation.input.overlay', id: 'dsh-tools-phrases', order: 10 },
              () => React.createElement(PhrasesBar),
            );
            return () => { try { unregister(); } catch { /* already gone */ } };
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

          // Live workspace roots from the sessions store (the same source the
          // workspace UI uses): the main-view session's cwd first, then any
          // other retained sessions'. Passed to sc.repos as hints so the panel
          // always scans the workspace the user is actually in, even when the
          // host-side workspace registry is empty or not started.
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
              const ordered = [
                ...rows.filter((row) => (row?.retainedBy?.mainView ?? 0) > 0),
                ...rows.filter((row) => (row?.retainedBy?.mainView ?? 0) <= 0),
              ];
              const seen = new Set();
              const roots = [];
              for (const row of ordered) {
                const cwd = typeof row?.cwd === 'string' ? row.cwd.trim() : '';
                if (cwd === '') continue;
                const key = cwd.toLowerCase();
                if (seen.has(key)) continue;
                seen.add(key);
                roots.push(cwd);
                if (roots.length >= 4) break;
              }
              return roots;
            } catch { return []; }
          };

          const fmtError = (error, fallback) => {
            if (typeof error?.message === 'string' && error.message !== '') {
              return typeof error?.code === 'string' && error.code !== '' ? `[${error.code}] ${error.message}` : error.message;
            }
            return fallback ?? '';
          };
          const icon = (glyph, className) => React.createElement('span', {
            className,
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

          const DiffView = ({ text }) => React.createElement('pre', { className: 'dsh-tools-scDiff' },
            String(text ?? '').split('\n').map((line, index) => {
              let cls = 'dsh-tools-dl';
              if (line.startsWith('+')) cls += ' is-add';
              else if (line.startsWith('-')) cls += ' is-del';
              else if (line.startsWith('@@')) cls += ' is-hunk';
              return React.createElement('span', { className: cls, key: index }, line);
            }));

          const ScPanel = () => {
            const [repos, setRepos] = React.useState(null);      // null = loading
            const [reposError, setReposError] = React.useState('');
            const [statusMap, setStatusMap] = React.useState({}); // repo.id -> {branch,files,truncated,error}
            const [expanded, setExpanded] = React.useState({});     // repo.id -> true (default all collapsed)
            const [selected, setSelected] = React.useState({});   // repo.id -> Set<path>
            const [diffKey, setDiffKey] = React.useState(null);   // `${id}\u0001${path}`
            const [diffState, setDiffState] = React.useState({});
            const [msgMap, setMsgMap] = React.useState({});
            const [busy, setBusy] = React.useState({});           // repo.id -> {op,error,note}

            const loadAll = React.useCallback(async () => {
              setRepos(null);
              setReposError('');
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
            // mounting is exactly "the panel opened" — load immediately.
            React.useEffect(() => { void loadAll(); }, [loadAll]);

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
                  React.createElement('button', {
                    type: 'button',
                    className: 'dsh-tools-scIconBtn',
                    title: t('scPush'),
                    disabled: anyBusy,
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
                        }, file.status)),
                      diffOpen ? React.createElement('div', null,
                        ds === undefined || ds.loading ? React.createElement('div', { className: 'dsh-tools-scNote', style: { padding: '6px 12px' } }, '…')
                          : (ds.error !== undefined ? React.createElement('div', { className: 'dsh-tools-scNote is-error', style: { padding: '6px 12px' } }, ds.error)
                            : React.createElement(DiffView, { text: ds.text }))) : null);
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
            },
            React.createElement('div', { className: 'dsh-tools-scHeader' },
              React.createElement('div', { className: 'dsh-tools-scHeaderTitle' },
                icon(SC_GLYPH),
                React.createElement('span', null, t('sc'))),
              React.createElement('button', {
                type: 'button',
                className: 'dsh-tools-scIconBtn',
                title: t('scRefresh'),
                onClick: () => { void loadAll(); },
              }, icon(SC_REFRESH_GLYPH))),
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
                React.createElement('span', { className: 'dsh-tools-scNote' }, t('scEmptyHint'))) : null,
              repos !== null && reposError === '' ? repoGroups : null));
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
