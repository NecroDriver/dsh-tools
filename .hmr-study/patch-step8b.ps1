$path = 'D:\Workspace\personal\dsh-tools\scripts\test-client-render.cjs'
$text = [System.IO.File]::ReadAllText($path)
$anchor = "  // 9) dispose unregisters the type"
if (-not $text.Contains($anchor)) { Write-Output 'ANCHOR NOT FOUND'; exit 1 }
$insert = @'
  // 8b) phrase editor round-trip drives the live row (store sync)
  const removeBtns = findAll(panelTree, byClass('dsh-tools-scRootRemove'));
  check('phrase remove buttons present', removeBtns.length === 2);
  removeBtns.forEach((b) => b.props.onClick());
  panelTree = materialize(react, react.createElement(settingsReg.render, {}), 'sp', []);
  findAll(panelTree, byClass('dsh-tools-primary'))[0].props.onClick();
  await settle(); await settle();
  const setCalls = calls.filter((c) => c.method === 'settings.set');
  const lastSet = setCalls[setCalls.length - 1];
  check('saving empty phrases round-trips',
    Array.isArray(lastSet?.payload?.phrases) && lastSet.payload.phrases.length === 0);
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

  // 8c) unmount removes the row and stops the guard
  hostSpan.props.ref(null);
  check('unmount removes the row and stops the guard',
    fakeCardEl.children.indexOf(phraseRow) === -1 && guardObserver.live === false);

'@
$text = $text.Replace($anchor, $insert + $anchor)
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'INSERTED OK'
