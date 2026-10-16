# Feature 13: edit user profile (display name, e-mail, password) + logout
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$router = Read-Utf8 'lib\web\profileRouter.js'
$indexBody = Read-Utf8 'public\views\index\body.ejs'

Test-Check 'PROF-1' 'user menu has "edit profile" and still has logout' {
  $edit = $indexBody.Contains('class="ui-edit-profile" data-toggle="modal" data-target=".profile-modal"')
  $logout = $indexBody.Contains('/logout"><i class="fa fa-sign-out fa-fw"></i>')
  if ($edit -and $logout -and $indexBody.Contains("include('../shared/profile-modal')")) { $true } else { "edit=$edit logout=$logout" }
}

Test-Check 'PROF-2' 'profile dialog has a logout button' {
  if ((Read-Utf8 'public\views\shared\profile-modal.ejs').Contains('class="btn btn-default profile-logout" href="<%- serverURL %>/logout"')) { $true } else { 'logout button missing' }
}

Test-Check 'PROF-3' 'API refuses anonymous requests (GET and POST answer 401)' {
  $g = Invoke-Http '/api/lilith/me'
  $p = Invoke-Http '/api/lilith/me' 'POST' 'displayName=x'
  if ($g.Code -eq 401 -and $p.Code -eq 401) { $true } else { "GET $($g.Code), POST $($p.Code)" }
}

Test-Check 'PROF-4' 'e-mail and password changes require the current password' {
  if ($router.Contains('if (wantsEmail || wantsPassword)') -and $router.Contains('await user.verifyPassword(body.currentPassword)')) { $true } else { 'current password check missing' }
}

Test-Check 'PROF-5' 'POST is JSON only and rate limited like the login endpoints' {
  if ($router.Contains("req.is('application/json')") -and $router.Contains('rateLimit.userEndpoints')) { $true } else { 'JSON check or rate limit missing' }
}

Test-Check 'PROF-6' 'responses never include the password' {
  $describe = [regex]::Match($router, 'function describe \(user\) \{[\s\S]*?\n\}').Value
  if ($describe -and $describe -cnotmatch '\bpassword:' -and $describe -match 'hasPassword: !!user\.password') { $true } else { 'describe() may expose the password' }
}

Test-Check 'PROF-7' 'eslint passes on the router and the client module' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\profileRouter.js', 'public\js\lib\profile.js', 'public\js\cover.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'PROF-8' 'built home bundle contains the feature and is newer than profile.js' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'cover-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $text = [IO.File]::ReadAllText($b.FullName, [Text.Encoding]::UTF8)
  $src = Get-Item (Join-Path $script:Hd 'public\js\lib\profile.js')
  if (-not $text.Contains('/api/lilith/me')) { return 'bundle has no profile dialog: rebuild the frontend' }
  if ($b.LastWriteTime -lt $src.LastWriteTime) { return 'profile.js changed after the last build: rebuild the frontend' }
  $true
}

Test-Check 'PROF-9' '[hidden] wins over Bootstrap display rules in the dialog (E1)' {
  if ((Read-Utf8 'public\css\catppuccin.css') -match '\.profile-modal \[hidden\],\s*\.share-modal \[hidden\] \{ display: none !important; \}') { $true } else { 'hidden override missing' }
}

Complete-Checks '13-profile'
