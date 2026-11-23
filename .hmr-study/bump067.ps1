$pkg = 'D:\Workspace\personal\dsh-tools\package.json'
$t = [System.IO.File]::ReadAllText($pkg)
$t2 = $t -replace '"version":\s*"0\.6\.6"', '"version": "0.6.7"'
[System.IO.File]::WriteAllText($pkg, $t2, (New-Object System.Text.UTF8Encoding($false)))
"pkg set: $($t2 -match '"version": "0\.6\.7"')"

$idx = 'D:\Workspace\personal\dsh-tools\index.js'
$i = [System.IO.File]::ReadAllText($idx)
$i2 = $i.Replace("const MODULE_VERSION = 'v0.6.6';", "const MODULE_VERSION = 'v0.6.7';")
[System.IO.File]::WriteAllText($idx, $i2, (New-Object System.Text.UTF8Encoding($false)))
"module version set: $($i2.Contains(""const MODULE_VERSION = 'v0.6.7';""))"
$bytes = [System.IO.File]::ReadAllBytes($pkg)
"pkg first byte: 0x$('{0:X}' -f $bytes[0])"
