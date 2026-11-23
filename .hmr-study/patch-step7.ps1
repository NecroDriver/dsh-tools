$path = 'D:\Workspace\personal\dsh-tools\scripts\test-client-render.cjs'
$text = [System.IO.File]::ReadAllText($path)
$pattern = "(?s)  // 7\) quick phrases:.*?check\('bar unmount disconnects the observer', barObserver\.live === false\);"
if (-not [regex]::IsMatch($text, $pattern)) { Write-Output 'PATTERN NOT FOUND'; exit 1 }
$new = @'
  // 7) quick phrases: hidden overlay host injects an in-card row above the
  //    draft editor; pills build from the store and click inserts at the caret
  const phraseReg = registrations.find((r) => r.slot === 'conversation.input.overlay' && r.id === 'dsh-tools-phrases');
  check('phrase host slot registered', phraseReg !== undefined);
  const phraseTree = materialize(react, react.createElement(phraseReg.render, {}), 'ph', []);
  const hostSpan = findAll(phraseTree, byClass('dsh-tools-phraseHost'))[0];
  check('bootstrap host renders hidden', hostSpan !== undefined
    && hostSpan.props.style?.display === 'none');
  // Simulate the real DOM chain: host span -> overlay anchor -> composer card,
  // with the draft editor nested one level inside the card.
  const fakeEd = fakeElement('div');
  const fakeEdHost = fakeElement('div'); fakeEdHost.appendChild(fakeEd);
  const fakeCardEl = fakeElement('div');
  fakeCardEl.querySelector = (sel) => (String(sel).includes('contenteditable') ? fakeEd : null);
  const fakeAnchorEl = fakeElement('div');
  const fakeSpanEl = fakeElement('span');
  fakeAnchorEl.appendChild(fakeSpanEl);
  fakeCardEl.appendChild(fakeAnchorEl);
  fakeCardEl.appendChild(fakeEdHost);
  hostSpan.props.ref(fakeSpanEl);
  const phraseRow = fakeCardEl.children.find((c) => c.className === 'dsh-tools-phraseBar');
  check('in-card phrase row inserted above the draft editor',
    phraseRow !== undefined && phraseRow.parentElement === fakeCardEl
    && fakeCardEl.children.indexOf(phraseRow) < fakeCardEl.children.indexOf(fakeEdHost));
  check('two phrase pills built', phraseRow !== undefined && phraseRow.children.length === 2
    && phraseRow.children[0].textContent === '使用 skill 优化'
    && phraseRow.style.display === '');
  execCommands.length = 0;
  const pillBtn = phraseRow.children[0];
  pillBtn.closest = (sel) => (sel === '[data-composer-card]' ? fakeCardEl : null);
  pillBtn.listeners.click[0]();
  check('pill click inserts text at caret (no selectAll)',
    execCommands.length === 1 && execCommands[0][0] === 'insertText' && execCommands[0][2] === '使用 skill 优化');

  // 7b) re-insert guard: a React re-render that drops the row puts it back
  const guardObserver = moInstances[moInstances.length - 1];
  check('row guard watches the card', guardObserver !== undefined && guardObserver.live === true);
  fakeCardEl.children.splice(fakeCardEl.children.indexOf(phraseRow), 1);
  phraseRow.parentElement = null;
  guardObserver.trigger();
  check('dropped row re-inserts above the draft editor',
    fakeCardEl.children.indexOf(phraseRow) !== -1
    && fakeCardEl.children.indexOf(phraseRow) < fakeCardEl.children.indexOf(fakeEdHost));
'@
$text = [regex]::Replace($text, $pattern, { param($m) $new })
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'REPLACED OK'
