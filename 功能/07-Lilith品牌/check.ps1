# Feature 07: Lilith branding (site name, page titles, navbar wordmark)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

function Get-Title([string]$html) { [regex]::Match($html, '<title>([^<]*)</title>').Groups[1].Value }

Test-Check 'BRAND-1' 'home page title is Lilith' {
  $t = Get-Title (Invoke-Http '/').Body
  if ($t -eq 'Lilith') { $true } else { "title = '$t'" }
}

Test-Check 'BRAND-2' 'home page site name is Lilith' {
  # since 18-Logo the name is preceded by the logo image
  if ((Invoke-Http '/').Body -match '<h3 class="masthead-brand"><a [^>]*>(<img class="ctp-brand-logo"[^>]*>)?Lilith</a></h3>') { $true } else { 'masthead-brand is not Lilith' }
}

Test-Check 'BRAND-2b' 'intro uses the Lilith logo and the quote heading (no HedgeDoc banner)' {
  # since feature 17 E5 the name appears only in the top bar; the heading is the tagline
  $b = (Invoke-Http '/').Body
  if ($b.Contains('<span class="ctp-home-avatar" aria-hidden="true"><img src="http://localhost:3000/icons/lilith-logo.png"') -and $b -match '<h1 class="cover-heading[ "]' -and -not $b.Contains('banner_vertical_color')) { $true } else { 'intro mark / heading missing or HedgeDoc banner present' }
}

Test-Check 'BRAND-3' 'note pages end their title with " - Lilith"' {
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT id, shortid FROM Notes WHERE deletedAt IS NULL AND permission != 'private' LIMIT 1")
  $note = ($rows | ConvertFrom-Json)
  if (-not $note) { return 'WARN: no note to test with' }
  # Editor URL = base64url of the UUID bytes
  $hex = $note[0].id -replace '-', ''
  $bytes = for ($i = 0; $i -lt 32; $i += 2) { [Convert]::ToByte($hex.Substring($i, 2), 16) }
  $encoded = [Convert]::ToBase64String([byte[]]$bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  $bad = @()
  foreach ($p in "/$encoded", "/s/$($note[0].shortid)") {
    $t = Get-Title (Invoke-Http $p).Body
    if (-not $t.EndsWith(' - Lilith') -and $t -ne 'Lilith') { $bad += "$p -> '$t'" }
  }
  if ($bad.Count -eq 0) { $true } else { $bad -join '; ' }
}

Test-Check 'BRAND-4' 'title code paths no longer append HedgeDoc' {
  $bad = @()
  if ((Read-Utf8 'lib\models\note.js') -match "' - HedgeDoc'") { $bad += 'lib/models/note.js' }
  if ((Read-Utf8 'public\js\extra.js') -match "' - HedgeDoc'") { $bad += 'public/js/extra.js' }
  if ($bad.Count -eq 0) { $true } else { 'still in ' + ($bad -join ', ') }
}

Test-Check 'BRAND-5' 'built bundle contains the new client title' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $text = [IO.File]::ReadAllText($b.FullName)
  if ($text.Contains(' - Lilith') -and -not $text.Contains(' - HedgeDoc')) { $true } else { 'rebuild the frontend (extra.js changed)' }
}

Test-Check 'BRAND-6' 'editor navbar shows the Lilith wordmark instead of the HedgeDoc banner' {
  $h = Read-Utf8 'public\views\hedgedoc\header.ejs'
  if ($h.Contains('<span class="ctp-brand">Lilith</span>') -and -not $h.Contains('banner_h_')) { $true } else { 'header.ejs still uses the banner images' }
}

Test-Check 'BRAND-7' 'app name meta tags are Lilith' {
  $f = Read-Utf8 'public\views\includes\favicon.ejs'
  if ($f.Contains('apple-mobile-web-app-title" content="Lilith"') -and $f.Contains('application-name" content="Lilith"')) { $true } else { 'favicon.ejs app names not updated' }
}

Complete-Checks '07-branding'
