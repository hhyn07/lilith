# Feature 08: account registration (register button beside sign in)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$open = (Get-DevConfig).allowEmailRegister -eq $true
$page = (Invoke-Http '/').Body
Write-Host ("registration is currently " + $(if ($open) { 'OPEN' } else { 'CLOSED' }))

Test-Check 'REG-1' 'register buttons follow the allowEmailRegister setting' {
  $n = [regex]::Matches($page, 'class="btn [^"]*ui-register"').Count
  if ($open -and $n -eq 2) { $true } elseif (-not $open -and $n -eq 0) { $true } else { "open=$open but $n register button(s) rendered" }
}

Test-Check 'REG-2' 'register buttons link to the /register page (the old modal is gone)' {
  $links = [regex]::Matches($page, 'class="btn [^"]*ui-register" href="http://localhost:3000/register"').Count
  $modal = $page.Contains('register-modal')
  if ($modal) { 'old register modal still rendered' }
  elseif ($open -and $links -ne 2) { "open=$open but $links button(s) link to /register" }
  else { $true }
}

Test-Check 'REG-3' 'sign-in modal no longer contains a register button' {
  if ($page -notmatch 'formaction="[^"]*/register"') { $true } else { 'register button found inside the sign-in modal' }
}

Test-Check 'REG-4' 'register form asks to confirm the password' {
  $t = Read-Utf8 'public\views\register.ejs'
  if ($t.Contains('name="password_confirm"') -and $t.Contains('action="<%- serverURL %>/register"')) { $true } else { 'confirm field or form action missing' }
}

Test-Check 'REG-5' 'server side matches the setting (POST /register with an invalid address)' {
  $r = Invoke-Http '/register' 'POST' 'email=not-an-email&password=x'
  # open: back to the form with a message; closed: no such route
  if ($open -and $r.Code -eq 302 -and $r.Location -eq 'http://localhost:3000/register') { $true } elseif (-not $open -and $r.Code -eq 404) { $true } else { "open=$open HTTP $($r.Code)" }
}

Test-Check 'REG-6' 'registration state matches the decision in _lib/policy.json' {
  $wantOpen = [bool](Get-Policy).registrationOpen
  if ($open -eq $wantOpen) { $true } else { "allowEmailRegister=$open but policy registrationOpen=$wantOpen" }
}

Complete-Checks '08-register'
