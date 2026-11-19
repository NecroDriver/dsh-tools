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
  factory() {
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
      },
    };

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

    function detectLang() {
      const lang = String(document.documentElement.lang ?? '').toLowerCase();
      return lang.startsWith('zh') ? 'zh' : 'en';
    }

    return {
      inject: ['connection'],
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
          const host = document.querySelector('[data-windows-menu]');
          if (host === menuHost) return;
          unmountButton();
          if (host !== null) mountInto(host);
        };

        if (document.body !== null) {
          const bodyObserver = new MutationObserver(ensureMounted);
          bodyObserver.observe(document.body, { childList: true, subtree: true });
          keep(() => bodyObserver.disconnect());
        }
        ensureMounted();

        return () => {
          unmountButton();
          for (const dispose of disposers.splice(0)) {
            try { dispose(); } catch { /* already gone */ }
          }
        };
      },
    };
  },
});
