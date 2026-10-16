# Feature 02: Windows build fix (babel must not transpile public/vendor)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'WIN-1' 'babel exclude matches both path separators' {
  $c = Read-Utf8 'webpack.common.js'
  if ($c.Contains('/public[\\/]vendor/')) { $true } else { 'webpack.common.js still has the forward-slash-only rule' }
}

Test-Check 'WIN-2' 'no other forward-slash-only path regex in webpack configs' {
  $hits = Select-String -Path (Join-Path $script:Hd 'webpack*.js') -Pattern '/[A-Za-z_-]+\\/[A-Za-z_-]+/' -AllMatches
  if (-not $hits) { $true } else { ($hits | ForEach-Object { "$($_.Filename):$($_.LineNumber)" }) -join ', ' }
}

Test-Check 'WIN-3' 'built bundle does not wrap OT modules in (void 0)' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $b) { return 'no bundle found' }
  $text = [IO.File]::ReadAllText($b.FullName)
  $bad = [regex]::Matches($text, '\}\)\(void 0\),').Count
  if ($bad -eq 0) { $true } else { "$bad occurrence(s) in $($b.Name): rebuild the frontend" }
}

Test-Check 'WIN-4' 'bundle is newer than webpack.common.js' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $cfg = Get-Item (Join-Path $script:Hd 'webpack.common.js')
  if ($b.LastWriteTime -ge $cfg.LastWriteTime) { $true } else { 'WARN: config changed after the last build' }
}

Complete-Checks '02-windows-build'
