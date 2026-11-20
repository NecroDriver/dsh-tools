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
      },
      en: {
        more: 'More',
        restart: 'Restart DSH',
        restartHint: '⚠ Restarts immediately; running tasks will be interrupted',
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
    };
    const modelOverride = { provider: '', model: '' };
    // apply() installs a hook so flag changes can (un)mount the caption menu.
    const runtime = { applyFlags: null };

    const MENU_CSS = [
      '.dsh-tools-menu{position:absolute;top:calc(var(--dsh-windows-titlebar-height,40px) - 4px);z-index:1200;min-width:250px;padding:6px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);box-shadow:0 10px 30px rgba(0,0,0,.20);font:inherit;font-size:14px;color:var(--dsw-alias-label-primary);}',
      '.dsh-tools-menu *{box-sizing:border-box;font:inherit;}',
      '.dsh-tools-sep{height:1px;margin:6px 8px;background:var(--dsw-alias-border-l1);}',
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
    ].join('\n');

    const GEN_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/></svg>';

    const OPT_GLYPH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2L11 5"/></svg>';

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
          ];

          const ToolsPanel = () => {
            const [flags, setFlags] = React.useState({ ...featureFlags });
            const [custom, setCustom] = React.useState(modelOverride.provider !== '' && modelOverride.model !== '');
            const [provider, setProvider] = React.useState(modelOverride.provider);
            const [model, setModel] = React.useState(modelOverride.model);
            const [providers, setProviders] = React.useState(null);   // null = loading
            const [modelsError, setModelsError] = React.useState('');
            const [saveState, setSaveState] = React.useState('idle'); // idle | busy | saved | error
            const [saveNote, setSaveNote] = React.useState('');

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
              return () => { alive = false; };
            }, []);

            const providerModels = React.useMemo(() => {
              if (providers === null) return [];
              const group = providers.find((p) => p.provider === provider);
              return Array.isArray(group?.models) ? group.models : [];
            }, [providers, provider]);

            const onSave = async () => {
              setSaveState('busy');
              setSaveNote(t('saving'));
              const payload = {
                features: Object.fromEntries(TOGGLES.map(([key]) => [key, flags[key] === true])),
                model: custom && provider !== '' && model !== '' ? { provider, model } : { provider: '', model: '' },
              };
              try {
                const result = await call('settings.set', payload);
                if (result?.ok === true && result.value?.settings) {
                  const settings = result.value.settings;
                  Object.assign(featureFlags, settings.features);
                  Object.assign(modelOverride, settings.model);
                  setFlags({ ...featureFlags });
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

        // ---- state ----
        let menuHost = null;        // the [data-windows-menu] element we mounted into
        let styleEl = null;
        let moreButton = null;
        let menuEl = null;          // open dropdown element, inside the shadow
        let phase = 'idle';         // idle | busy | done | error
        let errorMessage = '';

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

        const renderMenu = () => {
          if (menuEl === null) return;
          clearMenu();
          if (phase === 'idle') {
            // One-click restart: the ⚠ warning in the hint replaces the old
            // confirmation dialog (user request 2026-11-19).
            const item = el('button', 'dsh-tools-item');
            item.type = 'button';
            item.setAttribute('role', 'menuitem');
            item.addEventListener('click', () => { void doRestart(); });
            const glyph = el('span', 'dsh-tools-itemGlyph');
            glyph.innerHTML = RESTART_GLYPH;
            const main = el('span', 'dsh-tools-itemMain');
            main.append(el('span', 'dsh-tools-itemTitle', t('restart')));
            main.append(el('span', 'dsh-tools-itemHint', t('restartHint')));
            item.append(glyph, main);
            menuEl.append(item);
          } else if (phase === 'busy' || phase === 'done') {
            const status = el('div', 'dsh-tools-status');
            const title = el('div', 'dsh-tools-statusTitle');
            const glyph = el('span', 'dsh-tools-itemGlyph dsh-tools-spin');
            glyph.innerHTML = RESTART_GLYPH;
            title.append(glyph, el('span', null, phase === 'busy' ? t('scheduling') : t('restarting')));
            status.append(title);
            menuEl.append(status);
          } else if (phase === 'error') {
            const status = el('div', 'dsh-tools-status');
            status.append(el('div', 'dsh-tools-strong', t('errorTitle')));
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
        // only the caption menu owns real DOM that must be (un)mounted here.
        runtime.applyFlags = () => { ensureMounted(); };

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

        // Settings section in the app settings page.
        try {
          keep(registerSettingsPanel());
        } catch (error) {
          console.warn('[dsh-tools] settings panel unavailable:', error);
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
