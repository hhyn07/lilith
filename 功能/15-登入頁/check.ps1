# Feature 15: stand-alone sign-in page (/login), modelled on HackMD
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'LOGIN-1' 'GET /login renders the sign-in page' {
  $r = Invoke-Http '/login'
  if ($r.Code -eq 200 -and $r.Body.Contains('<h1 class="login-title">') -and $r.Body.Contains('action="http://localhost:3000/login"')) { $true } else { "HTTP $($r.Code)" }
}

Test-Check 'LOGIN-2' 'wrong credentials come back to /login' {
  # a non-existent address, so no account is touched
  $r = Invoke-Http '/login' 'POST' 'email=nobody@example.com&password=not-a-real-password'
  if ($r.Code -eq 302 -and $r.Location -eq 'http://localhost:3000/login') { $true } elseif ($r.Code -eq 429) { 'WARN: rate limited (10 tries / 5 min); run again later' } else { "HTTP $($r.Code) -> $($r.Location)" }
}

Test-Check 'LOGIN-3' 'template test: form, forgot password, divider and provider buttons, escaping' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-login-template.js'), $script:Hd)
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'LOGIN-4' 'home page sign-in buttons link to /login' {
  $n = [regex]::Matches((Invoke-Http '/').Body, 'class="btn btn-(sm|lg) btn-success ui-signin" href="http://localhost:3000/login"').Count
  if ($n -eq 2) { $true } else { "found $n" }
}

Test-Check 'LOGIN-5' 'failed e-mail login redirects to /login' {
  # GitHub was removed (feature 14); its upstream file redirects to / again
  $e = Read-Utf8 'lib\web\auth\email\index.js'
  if ($e.Contains("failureRedirect: config.serverURL + '/login'")) { $true } else { 'failureRedirect not pointing at /login' }
}

Test-Check 'LOGIN-6' 'router is mounted before the note router' {
  $app = Read-Utf8 'app.js'
  $a = $app.IndexOf("require('./lib/web/loginRouter')")
  $b = $app.IndexOf("require('./lib/web/note/router')")
  if ($a -ge 0 -and $a -lt $b) { $true } else { 'loginRouter missing or after the note router' }
}

Test-Check 'LOGIN-7' 'eslint passes on the router' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\loginRouter.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'LOGIN-8' 'show/hide password eye: added to every password field, reverts on submit' {
  $js = Read-Utf8 'public\js\catppuccin.js'
  $css = Read-Utf8 'public\css\catppuccin.css'
  $need = "querySelectorAll('input[type=""password""]').forEach(passwordToggle)", "input.form.addEventListener('submit'", "button.type = 'button'", 'aria-pressed'
  $miss = @($need | Where-Object { -not $js.Contains($_) })
  if ($miss.Count -gt 0) { return 'missing in catppuccin.js: ' + ($miss -join ' | ') }
  if (-not ($css.Contains('.ctp-pw-toggle {') -and $css.Contains('::-ms-reveal'))) { return 'eye button CSS missing' }
  $true
}

Complete-Checks '15-login-page'
