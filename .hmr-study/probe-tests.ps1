$f = 'D:\Workspace\personal\dsh-tools\scripts\test-client-render.cjs'
$t = [System.IO.File]::ReadAllText($f)
$anchor = "  check('row shrinks to one pill'"
if (-not $t.Contains($anchor)) { Write-Output 'ANCHOR NOT FOUND'; exit 1 }
$probe = "  console.log('DBG row', phraseRow.children.length, JSON.stringify(phraseRow.style.display), setCalls.map((c) => JSON.stringify(c.payload?.phrases)), setCalls.length);`n"
$t = $t.Replace($anchor, $probe + $anchor)
[System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'PROBE IN'
