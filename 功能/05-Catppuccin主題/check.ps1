# Feature 05: Catppuccin theme (4 flavors, switcher, editor colors)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

# Official palette (catppuccin/palette palette.json), order: latte, frappe, macchiato, mocha
$palette = @{
  rosewater = '#dc8a78', '#f2d5cf', '#f4dbd6', '#f5e0dc'; flamingo = '#dd7878', '#eebebe', '#f0c6c6', '#f2cdcd'
  pink = '#ea76cb', '#f4b8e4', '#f5bde6', '#f5c2e7'; mauve = '#8839ef', '#ca9ee6', '#c6a0f6', '#cba6f7'
  red = '#d20f39', '#e78284', '#ed8796', '#f38ba8'; maroon = '#e64553', '#ea999c', '#ee99a0', '#eba0ac'
  peach = '#fe640b', '#ef9f76', '#f5a97f', '#fab387'; yellow = '#df8e1d', '#e5c890', '#eed49f', '#f9e2af'
  green = '#40a02b', '#a6d189', '#a6da95', '#a6e3a1'; teal = '#179299', '#81c8be', '#8bd5ca', '#94e2d5'
  sky = '#04a5e5', '#99d1db', '#91d7e3', '#89dceb'; sapphire = '#209fb5', '#85c1dc', '#7dc4e4', '#74c7ec'
  blue = '#1e66f5', '#8caaee', '#8aadf4', '#89b4fa'; lavender = '#7287fd', '#babbf1', '#b7bdf8', '#b4befe'
  text = '#4c4f69', '#c6d0f5', '#cad3f5', '#cdd6f4'; subtext1 = '#5c5f77', '#b5bfe2', '#b8c0e0', '#bac2de'
  subtext0 = '#6c6f85', '#a5adce', '#a5adcb', '#a6adc8'; overlay2 = '#7c7f93', '#949cbb', '#939ab7', '#9399b2'
  overlay1 = '#8c8fa1', '#838ba7', '#8087a2', '#7f849c'; overlay0 = '#9ca0b0', '#737994', '#6e738d', '#6c7086'
  surface2 = '#acb0be', '#626880', '#5b6078', '#585b70'; surface1 = '#bcc0cc', '#51576d', '#494d64', '#45475a'
  surface0 = '#ccd0da', '#414559', '#363a4f', '#313244'; base = '#eff1f5', '#303446', '#24273a', '#1e1e2e'
  mantle = '#e6e9ef', '#292c3c', '#1e2030', '#181825'; crust = '#dce0e8', '#232634', '#181926', '#11111b'
}
$flavors = 'latte', 'frappe', 'macchiato', 'mocha'
$css = Read-Utf8 'public\css\catppuccin.css'
$js = Read-Utf8 'public\js\catppuccin.js'
$heads = 'public\views\index\head.ejs', 'public\views\hedgedoc\head.ejs', 'public\views\pretty.ejs', 'public\views\login.ejs', 'public\views\slide.ejs'

Test-Check 'CTP-1' 'all 26 x 4 palette values match the official palette' {
  $wrong = @()
  for ($i = 0; $i -lt 4; $i++) {
    $f = $flavors[$i]
    $m = [regex]::Match($css, "html\[data-ctp=""$f""\]\s*\{([^}]*)\}")
    if (-not $m.Success) { $wrong += "$f block missing"; continue }
    foreach ($name in $palette.Keys) {
      $expected = $palette[$name][$i]
      if ($m.Groups[1].Value -notmatch "--ctp-${name}:\s*$expected;") { $wrong += "$f.$name" }
    }
  }
  if ($wrong.Count -eq 0) { $true } else { 'mismatch: ' + ($wrong -join ', ') }
}

Test-Check 'CTP-2' 'theme assets are served (css, js)' {
  $bad = @()
  foreach ($p in '/css/catppuccin.css', '/js/catppuccin.js') { if ((Invoke-Http $p).Code -ne 200) { $bad += $p } }
  if ($bad.Count -eq 0) { $true } else { 'not 200: ' + ($bad -join ', ') }
}

Test-Check 'CTP-3' 'every head template loads both files with the same version' {
  $problems = @()
  $versions = @()
  foreach ($h in $heads) {
    $c = Read-Utf8 $h
    $j = [regex]::Match($c, 'js/catppuccin\.js\?v=(\d+)')
    $s = [regex]::Match($c, 'css/catppuccin\.css\?v=(\d+)')
    if (-not $j.Success -or -not $s.Success) { $problems += "$h missing include" } else { $versions += $j.Groups[1].Value, $s.Groups[1].Value }
  }
  if (@($versions | Sort-Object -Unique).Count -gt 1) { $problems += 'versions differ: ' + (($versions | Sort-Object -Unique) -join '/') }
  if ($problems.Count -eq 0) { $true } else { $problems -join '; ' }
}

Test-Check 'CTP-4' 'theme script loads before first paint (in head, not deferred)' {
  $bad = @()
  foreach ($h in $heads) { if ((Read-Utf8 $h) -match 'catppuccin\.js[^>]*\b(defer|async)\b') { $bad += $h } }
  if ($bad.Count -eq 0) { $true } else { 'deferred in ' + ($bad -join ', ') }
}

Test-Check 'CTP-5' 'switcher offers auto + 4 flavors and no emoji' {
  $ids = [regex]::Matches($js, "id: '(latte|frappe|macchiato|mocha)'").Count
  $emoji = [regex]::Matches($js, '[\uD800-\uDBFF][\uDC00-\uDFFF]').Count
  if ($ids -eq 4 -and $js.Contains("id: 'auto'") -and $emoji -eq 0) { $true } else { "flavors=$ids emoji=$emoji" }
}

Test-Check 'CTP-6' 'eslint passes on public/js/catppuccin.js' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'public\js\catppuccin.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'CTP-7' 'regression guards for earlier bugs are in place' {
  $missing = @()
  if ($js.IndexOf('const switchers = []') -gt $js.IndexOf('apply(currentChoice)')) { $missing += 'switchers declared after first apply (TDZ)' }
  if ($css -notmatch 'filter:\s*none') { $missing += 'pre filter:none (night invert)' }
  if ($css -notmatch '\.CodeMirror \.CodeMirror-scroll \{ background-color') { $missing += 'CodeMirror-scroll background (one-dark)' }
  if ($css -notmatch '\.status-bar \.status-indicators \{') { $missing += 'status-indicators background' }
  if ($css -match 'html\[data-ctp\] \.list') { $missing += 'unscoped .list rule (opens dropdowns)' }
  if ($missing.Count -eq 0) { $true } else { $missing -join '; ' }
}

Test-Check 'CTP-8' 'edited templates have no UTF-8 BOM' {
  $bom = @()
  foreach ($h in $heads + @('public\views\index\body.ejs', 'public\views\hedgedoc\header.ejs', 'public\views\includes\favicon.ejs')) {
    $b = [IO.File]::ReadAllBytes((Join-Path $script:Hd $h))
    if ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) { $bom += $h }
  }
  if ($bom.Count -eq 0) { $true } else { 'BOM in ' + ($bom -join ', ') }
}

Test-Check 'CTP-9' 'night toggle and editor theme toggle are hidden in favor of the switcher' {
  if ($css -match '\.ui-night,\s*html\[data-ctp\] \.status-bar \.status-indicators \.status-theme \{ display: none') { $true } else { 'hide rule missing' }
}

Complete-Checks '05-catppuccin'
