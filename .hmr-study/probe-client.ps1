$f = 'D:\Workspace\personal\dsh-tools\client.js'
$t = [System.IO.File]::ReadAllText($f)

$a1 = "      set(items) {"
$b1 = "      set(items) {`n        console.log('DBG set', JSON.stringify(items));"
if (-not $t.Contains($a1)) { Write-Output 'A1 NOT FOUND'; exit 1 }
$t = $t.Replace($a1, $b1)

$a2 = "          const syncPills = () => {"
$b2 = "          const syncPills = () => {`n            console.log('DBG sync', phraseStore.items.length, rowEl === null ? 'no-row' : rowEl.style.display, featureFlags.phrases === true);"
if (-not $t.Contains($a2)) { Write-Output 'A2 NOT FOUND'; exit 1 }
$t = $t.Replace($a2, $b2)

[System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))
Write-Output 'CLIENT PROBED'
