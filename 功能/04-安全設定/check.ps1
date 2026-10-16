# Feature 04: security settings (local-only, no anonymous access, freely fix)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$cfg = Get-DevConfig

Test-Check 'SEC-1' 'config: host is 127.0.0.1' {
  if ($cfg.host -eq '127.0.0.1') { $true } else { "host = '$($cfg.host)'" }
}

Test-Check 'SEC-2' 'config: anonymous create/edit disabled' {
  if ($cfg.allowAnonymous -eq $false -and $cfg.allowAnonymousEdits -eq $false) { $true } else { "allowAnonymous=$($cfg.allowAnonymous) allowAnonymousEdits=$($cfg.allowAnonymousEdits)" }
}

$wantOpen = [bool](Get-Policy).registrationOpen

Test-Check 'SEC-3' 'config: web registration matches the decision in _lib/policy.json' {
  if ([bool]$cfg.allowEmailRegister -eq $wantOpen) { $true } else { "allowEmailRegister=$($cfg.allowEmailRegister) but policy registrationOpen=$wantOpen" }
}

Test-Check 'SEC-4' 'config: fixed, long session secret' {
  $s = [string]$cfg.sessionSecret
  if ($s -and $s -ne 'secret' -and $s.Length -ge 64) { $true } else { 'sessionSecret missing, default or shorter than 64 chars' }
}

Test-Check 'SEC-5' 'server listens on loopback only' {
  $c = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
  if ($c.Count -eq 0) { return 'nothing listens on port 3000' }
  $bad = @($c | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') })
  if ($bad.Count -eq 0) { $true } else { 'listening on ' + (($bad.LocalAddress | Sort-Object -Unique) -join ', ') }
}

Test-Check 'SEC-6' 'server is not reachable from a non-loopback address' {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
  if (-not $ip) { return 'WARN: no non-loopback IPv4 address to test from' }
  $code = & curl.exe -s -o NUL -m 3 -w '%{http_code}' "http://${ip}:3000/status"
  if ("$code" -eq '000') { $true } else { "reachable via $ip (HTTP $code)" }
}

Test-Check 'SEC-7' 'anonymous GET /new is redirected away' {
  $r = Invoke-Http '/new'
  if ($r.Code -eq 302 -and $r.Location -notmatch '/[A-Za-z0-9_-]{20,}$') { $true } else { "HTTP $($r.Code) -> $($r.Location)" }
}

Test-Check 'SEC-8' 'POST /register: 404 when closed, validated when open (per policy)' {
  # An invalid address so nothing can be created even if registration is open.
  $r = Invoke-Http '/register' 'POST' 'email=not-an-email&password=x'
  if (-not $wantOpen -and $r.Code -eq 404) { $true }
  elseif ($wantOpen -and $r.Code -eq 302 -and $r.Location -eq 'http://localhost:3000/register') { $true }
  elseif ($r.Code -eq 429) { 'WARN: rate limited; run again later' }
  else { "policy open=$wantOpen but HTTP $($r.Code) -> $($r.Location)" }
}

Test-Check 'SEC-9' 'freely fix is present in lib/realtime.js' {
  $c = Read-Utf8 'lib\realtime.js'
  if ($c -match "case 'freely':\s*//[^\n]*\n\s*if \(!config\.allowAnonymous && !config\.allowAnonymousEdits &&") { $true } else { 'ifMayEdit() freely branch does not check the config' }
}

Test-Check 'SEC-10' 'no notes left with the freely permission' {
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT count(*) AS n FROM Notes WHERE permission = 'freely'")
  $n = ($rows | ConvertFrom-Json)[0].n
  if ($n -eq 0) { $true } else { "WARN: $n freely note(s); protected by SEC-9 but consider setting them to editable" }
}

Test-Check 'SEC-11' 'eslint passes on lib/realtime.js' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\realtime.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'SEC-12' 'mocha test suite passes' {
  $env:NODE_ENV = 'test'; $env:CMD_DB_URL = 'sqlite::memory:'
  try { $r = Invoke-Native 'node_modules\.bin\mocha.cmd' @('--exit') } finally {
    Remove-Item Env:NODE_ENV, Env:CMD_DB_URL -ErrorAction SilentlyContinue
  }
  $passing = [regex]::Match($r.Out, '(\d+) passing').Groups[1].Value
  $failing = [regex]::Match($r.Out, '(\d+) failing').Groups[1].Value
  if ($r.Code -eq 0 -and $passing) { $true } else { "mocha exit $($r.Code), passing=$passing failing=$failing" }
}

Test-Check 'SEC-13' 'config: new notes default to private' {
  if ($cfg.defaultPermission -eq 'private') { $true } elseif ($cfg.defaultPermission -eq 'locked') { 'WARN: defaultPermission is locked (anyone signed in can read)' } else { "defaultPermission = '$($cfg.defaultPermission)'" }
}

Complete-Checks '04-security'
