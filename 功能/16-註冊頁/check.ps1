# Feature 16: stand-alone sign-up page (/register), modelled on HackMD
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$open = (Get-DevConfig).allowEmailRegister -eq $true

Test-Check 'SIGNUP-1' 'offline test: name / password rules and the register.ejs template' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-register.js'), $script:Hd)
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'SIGNUP-2' 'GET /register follows the allowEmailRegister setting' {
  $r = Invoke-Http '/register'
  if ($open -and $r.Code -eq 200 -and $r.Body.Contains('<h1 class="login-title">')) { $true }
  elseif (-not $open -and $r.Code -eq 302 -and $r.Location -eq 'http://localhost:3000/login') { $true }
  else { "open=$open HTTP $($r.Code) -> $($r.Location)" }
}

Test-Check 'SIGNUP-3' 'register handler checks name, password rule and confirmation, then signs in' {
  $e = Read-Utf8 'lib\web\auth\email\index.js'
  $need = 'checkUsername(username)', 'checkPassword(password)', "body.password_confirm !== password", 'req.login(user', "'/register')"
  $miss = @($need | Where-Object { -not $e.Contains($_) })
  if ($miss.Count -eq 0) { $true } else { 'missing: ' + ($miss -join ', ') }
}

Test-Check 'SIGNUP-4' 'profile password change uses the same rule' {
  $p = Read-Utf8 'lib\web\profileRouter.js'
  if ($p.Contains('checkPassword(body.newPassword)') -and -not $p.Contains('MIN_PASSWORD_LENGTH')) { $true } else { 'profileRouter still has its own rule' }
}

Test-Check 'SIGNUP-5' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\accountRules.js', 'lib\web\loginRouter.js', 'lib\web\auth\email\index.js', 'lib\web\profileRouter.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '16-register-page'
