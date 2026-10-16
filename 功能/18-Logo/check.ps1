# Feature 18: Lilith logo (magical-girl silhouette, Gemini-generated)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$icons = Join-Path $script:Hd 'public\icons'

Test-Check 'LOGO-1' 'logo and all icon sizes exist as PNG with the expected size' {
  $want = @{
    'lilith-logo.png' = 512; 'favicon-16x16.png' = 16; 'favicon-32x32.png' = 32; 'apple-touch-icon.png' = 180
    'android-chrome-192x192.png' = 192; 'android-chrome-512x512.png' = 512; 'mstile-70x70.png' = 70
    'mstile-144x144.png' = 144; 'mstile-150x150.png' = 150; 'mstile-310x310.png' = 310
  }
  Add-Type -AssemblyName System.Drawing
  $bad = @()
  foreach ($name in $want.Keys) {
    $p = Join-Path $icons $name
    if (-not (Test-Path $p)) { $bad += "$name missing"; continue }
    $img = [System.Drawing.Image]::FromFile($p)
    try { if ($img.Width -ne $want[$name] -or $img.Height -ne $want[$name]) { $bad += "$name is $($img.Width)x$($img.Height)" } } finally { $img.Dispose() }
  }
  if ($bad.Count -eq 0) { $true } else { $bad -join '; ' }
}

Test-Check 'LOGO-2' 'logo has a transparent background (corner pixel alpha is 0)' {
  Add-Type -AssemblyName System.Drawing
  $img = New-Object System.Drawing.Bitmap (Join-Path $icons 'lilith-logo.png')
  try { $a = $img.GetPixel(0, 0).A } finally { $img.Dispose() }
  if ($a -eq 0) { $true } else { "corner alpha is $a" }
}

Test-Check 'LOGO-3' 'favicon.ico holds 16, 32 and 48 px images' {
  $b = [IO.File]::ReadAllBytes((Join-Path $icons 'favicon.ico'))
  $count = [BitConverter]::ToUInt16($b, 4)
  $sizes = @(0..($count - 1) | ForEach-Object { $w = $b[6 + 16 * $_]; if ($w -eq 0) { 256 } else { $w } }) | Sort-Object
  if (($sizes -join ',') -eq '16,32,48') { $true } else { "sizes: $($sizes -join ',')" }
}

Test-Check 'LOGO-4' 'pages use the logo; old SVG favicon is gone from the icon list' {
  $page = (Invoke-Http '/').Body
  $fav = Read-Utf8 'public\views\includes\favicon.ejs'
  $login = (Invoke-Http '/login').Body
  if (-not $page.Contains('/icons/lilith-logo.png')) { return 'home hero has no logo' }
  if (-not $page.Contains('class="ctp-brand-logo"')) { return 'top bar has no logo' }
  if (-not $login.Contains('class="ctp-brand-logo"')) { return 'sign-in page top bar has no logo' }
  if ($fav.Contains('lilith.svg') -or $fav.Contains('safari-pinned-tab.svg')) { return 'favicon.ejs still lists an SVG icon' }
  if ((Invoke-Http '/icons/favicon.ico').Code -ne 200) { return 'favicon.ico not served' }
  $true
}

Test-Check 'LOGO-5' 'site name uses the Marcellus wordmark font (file present, served, applied)' {
  $font = Join-Path $script:Hd 'public\fonts\lilith\wordmark.woff2'
  if (-not (Test-Path $font)) { return 'font missing: run make-wordmark-font.js' }
  if ([Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($font)[0..3]) -ne 'wOF2') { return 'not a woff2 file' }
  if ((Invoke-Http '/fonts/lilith/wordmark.woff2').Code -ne 200) { return 'font not served' }
  $css = Read-Utf8 'public\css\catppuccin.css'
  if (-not ($css.Contains('font-family: "Lilith Wordmark"') -and $css.Contains('.navbar-brand.header-brand .ctp-brand'))) { return '@font-face or brand rule missing' }
  $true
}

Test-Check 'LOGO-6' 'brand asset copies in the project folder match the files the site uses' {
  # hhyn 2026-10-16: record everything about the site in the project folder, incl. the logo
  $pairs = @(
    @('logo\lilith-logo.png', 'public\icons\lilith-logo.png'),
    @('fonts\wordmark.woff2', 'public\fonts\lilith\wordmark.woff2'),
    @('fonts\noto-serif-jp-quotes.woff2', 'public\fonts\lilith\noto-serif-jp-quotes.woff2'),
    @('fonts\LICENSES.md', 'public\fonts\lilith\LICENSES.md')
  )
  foreach ($n in 'favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'site.webmanifest') {
    $pairs += , @("icons\$n", "public\icons\$n")
  }
  $brand = Join-Path $script:ProjectRoot ([string][char]0x54C1 + [char]0x724C + [char]0x8CC7 + [char]0x7522)
  $diff = @()
  foreach ($p in $pairs) {
    $a = Join-Path $brand $p[0]; $b = Join-Path $script:Hd $p[1]
    if (-not (Test-Path $a)) { $diff += "$($p[0]) missing"; continue }
    if ((Get-FileHash $a).Hash -ne (Get-FileHash $b).Hash) { $diff += "$($p[0]) differs" }
  }
  if ($diff.Count -eq 0) { $true } else { 'out of date (copy from hedgedoc-1x): ' + ($diff -join ', ') }
}

Complete-Checks '18-logo'
