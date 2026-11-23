$f = 'D:\Workspace\personal\dsh-tools\client.js'
$t = [System.IO.File]::ReadAllText($f)
$t = $t.Replace("      set(items) {`n        console.log('DBG set', JSON.stringify(items));", "      set(items) {")
$t = $t.Replace("          const syncPills = () => {`n            console.log('DBG sync', phraseStore.items.length, rowEl === null ? 'no-row' : rowEl.style.display, featureFlags.phrases === true);", "          const syncPills = () => {")
[System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))

$g = 'D:\Workspace\personal\dsh-tools\scripts\test-client-render.cjs'
$s = [System.IO.File]::ReadAllText($g)
$s = $s.Replace("  console.log('DBG row', phraseRow.children.length, JSON.stringify(phraseRow.style.display), setCalls.map((c) => JSON.stringify(c.payload?.phrases)), setCalls.length);`n", '')
[System.IO.File]::WriteAllText($g, $s, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'PROBES REMOVED'
