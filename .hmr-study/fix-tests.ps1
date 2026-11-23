$f = 'D:\Workspace\personal\dsh-tools\scripts\test-client-render.cjs'
$t = [System.IO.File]::ReadAllText($f)

# --- fix 1: repair the two mangled Chinese comparison literals in step 7 ---
$t = [regex]::Replace($t, "phraseRow\.children\[0\]\.textContent === '[^']*'", "phraseRow.children[0].textContent === '使用 skill 优化'")
$t = [regex]::Replace($t, "execCommands\[0\]\[2\] === '[^']*'", "execCommands[0][2] === '使用 skill 优化'")

# --- fix 2: rewrite step 8b with correct removal/save sequencing ---
$new8b = @'
  // 8b) phrase editor round-trip drives the live row (store sync)
  const removeBtns = findAll(panelTree, byClass('dsh-tools-scRootRemove'));
  check('phrase remove buttons present', removeBtns.length === 2);
  removeBtns[0].props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  const setCalls = calls.filter((c) => c.method === 'settings.set');
  const lastSet = setCalls[setCalls.length - 1];
  check('saving one removed phrase round-trips',
    Array.isArray(lastSet?.payload?.phrases) && lastSet.payload.phrases.length === 1);
  check('row shrinks to one pill', phraseRow.children.length === 1 && phraseRow.style.display === '');
  findAll(panelTree, byClass('dsh-tools-scRootRemove'))[0].props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  const setCalls2 = calls.filter((c) => c.method === 'settings.set');
  check('saving empty phrases round-trips',
    setCalls2[setCalls2.length - 1]?.payload?.phrases?.length === 0);
  check('empty store hides the in-card row', phraseRow.style.display === 'none');
  const addBtn2 = findAll(panelTree, byClass('dsh-tools-scBtn')).find((b) => b.children.some((c) => c?.children?.[0] === '添加常用语'));
  addBtn2.props.onClick();
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-phraseInput'))[0].props.onChange({ target: { value: '再来一条' } });
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  check('re-added phrase shows in the in-card row',
    phraseRow.style.display === '' && phraseRow.children.length === 1
    && phraseRow.children[0].textContent === '再来一条');

'@
$t = [regex]::Replace($t, "(?s)  // 8b\) phrase editor round-trip.*?(?=  // 9\) dispose)", { param($m) $new8b })
[System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'FIXED OK'
