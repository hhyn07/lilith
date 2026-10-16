# Feature 14: third-party login -- REMOVED on 2026-10-16 at hhyn's request.
# These checks make sure nothing of it is left active.
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$cfg = Get-DevConfig

Test-Check 'GH-1' 'no third-party login is configured in config.json' {
  $on = @('github', 'google', 'facebook', 'twitter', 'gitlab', 'dropbox', 'mattermost', 'oauth2', 'saml') | Where-Object { $cfg.$_ }
  if ($on.Count -eq 0) { $true } else { 'sections present: ' + ($on -join ', ') }
}

Test-Check 'GH-2' 'GitHub and Google routes are not mounted' {
  $bad = @('/auth/github', '/auth/github/link', '/auth/google') | Where-Object { (Invoke-Http $_).Code -ne 404 }
  if ($bad.Count -eq 0) { $true } else { 'answering: ' + ($bad -join ', ') }
}

Test-Check 'GH-3' 'linking code is gone and GitHub login is back to upstream' {
  if (Test-Path (Join-Path $script:Hd 'lib\web\auth\linking.js')) { return 'lib/web/auth/linking.js still exists' }
  if (Test-Path (Join-Path $script:Hd 'lib\models\userIdentity.js')) { return 'lib/models/userIdentity.js still exists' }
  # the same file at tag 1.10.8 (HedgeDoc's root) and now (hedgedoc-1x/ in the project repository)
  $up = (Invoke-Git @('rev-parse', '1.10.8:lib/web/auth/github/index.js')).Out
  $now = (Invoke-Git @('rev-parse', 'HEAD:hedgedoc-1x/lib/web/auth/github/index.js')).Out
  if ($up -and $up -eq $now) { $true } else { "github/index.js differs from upstream ($up / $now)" }
}

Test-Check 'GH-4' 'profile API and dialog have no linking parts' {
  $p = Read-Utf8 'lib\web\profileRouter.js'
  $m = Read-Utf8 'public\views\shared\profile-modal.ejs'
  $j = Read-Utf8 'public\js\lib\profile.js'
  $left = @()
  if ($p -match 'identit|linking') { $left += 'profileRouter.js' }
  if ($m -match 'identit') { $left += 'profile-modal.ejs' }
  if ($j -match 'identit|unlink') { $left += 'profile.js' }
  if ($left.Count -eq 0) { $true } else { 'leftovers in: ' + ($left -join ', ') }
}

Test-Check 'GH-5' 'old UserIdentities table is empty (kept because its migration already ran)' {
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @('SELECT COUNT(*) AS n FROM UserIdentities')
  $n = @(($rows | ConvertFrom-Json) | ForEach-Object { $_ })[0].n
  if ($n -eq 0) { $true } else { "WARN: table has $n row(s)" }
}

Complete-Checks '14-third-party-login-removed'
