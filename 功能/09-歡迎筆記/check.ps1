# Feature 09: welcome note for every user
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$query = Join-Path $PSScriptRoot '..\_lib\db-query.js'

Test-Check 'WEL-1' 'integration test against an in-memory database' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-welcome.js'), $script:Hd)
  $line = ($r.Out -split "`n" | Where-Object { $_.StartsWith('{') } | Select-Object -Last 1)
  if (-not $line) { return "no result: $($r.Out)" }
  $res = $line | ConvertFrom-Json
  $failed = @('created_after_register', 'private', 'has_marker', 'in_history', 'pinned', 'idempotent', 'repairs_history', 'created_without_transaction' | Where-Object { $res.$_ -ne $true })
  if ($failed.Count -eq 0) { $true } else { 'failed: ' + ($failed -join ', ') + " $line" }
}

Test-Check 'WEL-2' 'every existing user owns a welcome note' {
  $rows = Invoke-NodeScript $query @("SELECT u.email FROM Users u WHERE NOT EXISTS (SELECT 1 FROM Notes n WHERE n.ownerId = u.id AND n.content LIKE '<!-- lilith:welcome -->%')")
  # PowerShell 5.1 emits a JSON array as one object; enumerate it before counting.
  $missing = @(($rows | ConvertFrom-Json) | ForEach-Object { $_ })
  if ($missing.Count -eq 0) { $true } else { 'missing for: ' + (($missing | ForEach-Object { $_.email }) -join ', ') + ' (run node bin/welcome_notes)' }
}

Test-Check 'WEL-3' 'welcome notes are private' {
  $rows = Invoke-NodeScript $query @("SELECT count(*) AS n FROM Notes WHERE content LIKE '<!-- lilith:welcome -->%' AND permission != 'private'")
  $n = ($rows | ConvertFrom-Json)[0].n
  if ($n -eq 0) { $true } else { "WARN: $n welcome note(s) are no longer private (the owner may have changed it)" }
}

Test-Check 'WEL-4' 'template starts with the marker' {
  $t = Read-Utf8 'lib\welcome.md'
  if ($t.StartsWith('<!-- lilith:welcome -->')) { $true } else { 'lib/welcome.md must start with <!-- lilith:welcome -->' }
}

Test-Check 'WEL-5' 'eslint passes on lib/welcome.js and lib/models/user.js' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\welcome.js', 'lib\models\user.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '09-welcome'
