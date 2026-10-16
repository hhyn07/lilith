# Feature 17: home page (Blowfish-style hero, feature cards, Stack-style note cards)
# and the history page (Stack-style sidebar + cards)
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$page = (Invoke-Http '/').Body

Test-Check 'HOME-1' 'home has the hero, the features section and the notes section' {
  # ASCII only (PowerShell 5.1): sections are found by class / link instead of their Chinese titles
  $need = 'class="ctp-hero ctp-home-profile"', 'class="ctp-home-avatar"', 'class="ctp-home-features"', 'href="http://localhost:3000/features">'
  $sections = [regex]::Matches($page, 'class="ctp-home-section"').Count
  if ($sections -ne 2) { return "expected 2 sections, found $sections" }
  if (-not ($page.Contains('class="ctp-home-notes ctp-cards"') -or $page.Contains('class="ctp-home-empty"'))) { return 'notes list / empty message missing' }
  $miss = @($need | Where-Object { -not $page.Contains($_) })
  if ($miss.Count -eq 0) { $true } else { 'missing: ' + ($miss -join ', ') }
}

Test-Check 'HOME-2' 'old upstream cover parts are gone (screenshot, "or", icon row)' {
  $old = @('screenshot.png', 'class="ui-or"', 'class="lead row"') | Where-Object { $page.Contains($_) }
  if ($old.Count -eq 0) { $true } else { 'still present: ' + ($old -join ', ') }
}

Test-Check 'HOME-3' 'listed notes = guest-readable, owned, non-blank notes (newest 6), read-only DB query' {
  $sql = "SELECT shortid FROM Notes WHERE deletedAt IS NULL AND permission IN ('freely','editable','locked') AND ownerId IS NOT NULL AND TRIM(COALESCE(content,'')) <> '' ORDER BY COALESCE(lastchangeAt, updatedAt) DESC LIMIT 6"
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql)
  $expected = @(($rows | ConvertFrom-Json) | ForEach-Object { $_.shortid })
  $shown = @([regex]::Matches($page, 'class="ctp-home-notes ctp-cards"[\s\S]*?</ul>') | ForEach-Object { [regex]::Matches($_.Value, '/[sb]/([A-Za-z0-9_-]+)"') } | ForEach-Object { $_.Groups[1].Value })
  if ($expected.Count -eq 0) {
    if ($page.Contains('class="ctp-home-empty"')) { $true } else { 'no public notes, but the empty message is missing' }
  } elseif (($expected -join ',') -eq ($shown -join ',')) { $true }
  else { "expected [$($expected -join ',')] shown [$($shown -join ',')]" }
}

Test-Check 'HOME-4' 'private / protected / limited notes and ownerless docs never appear' {
  $sql = "SELECT shortid FROM Notes WHERE permission NOT IN ('freely','editable','locked') OR ownerId IS NULL"
  $hidden = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json) | ForEach-Object { $_.shortid })
  $leak = @($hidden | Where-Object { $_ -and ($page.Contains("/s/$_`"") -or $page.Contains("/b/$_`"")) })
  if ($leak.Count -eq 0) { $true } else { 'leaked: ' + ($leak -join ', ') }
}

Test-Check 'HOME-5' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\publicNotes.js', 'lib\response.js', 'public\js\catppuccin.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'HOME-6' 'cards have meta; history page has the sidebar layout' {
  $cards = [regex]::Matches($page, '<li class="ctp-card">').Count
  if ($cards -gt 0 -and -not $page.Contains('class="ctp-card-meta"')) { return 'card meta missing' }
  if (-not ($page.Contains('class="ctp-history-layout"') -and $page.Contains('<aside class="ctp-side">'))) { return 'history sidebar missing' }
  $true
}

Test-Check 'HOME-7' 'all cards share one "starry purple" look (no per-tag colours left)' {
  # hhyn 2026-10-16: unify the card colours (feature 17 E11)
  $css = Read-Utf8 'public\css\catppuccin.css'
  $js = Read-Utf8 'public\js\catppuccin.js'
  $lib = Read-Utf8 'lib\publicNotes.js'
  if (-not ($css.Contains('--starry:') -and $css.Contains('background: var(--starry);'))) { return 'starry card background missing' }
  if ($css.Contains('[data-tone=') -or $js.Contains('data-tone') -or $lib.Contains('toneOf') -or $page.Contains('data-tone=')) { return 'per-tag colour code is still present' }
  $true
}

Test-Check 'HOME-8' 'heading is one of the quotes in lib/quotes.js, with its source, ready to be typed' {
  # a script file (not node -e: PowerShell 5.1 mangles quotes in arguments) that prints ASCII-only JSON
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'list-quotes.js'), $script:Hd)
  $quotes = @(($r.Out | ConvertFrom-Json) | ForEach-Object { $_ })
  if ($quotes.Count -lt 2) { return "only $($quotes.Count) quote(s)" }
  if (@($quotes | Where-Object { -not $_.text -or -not $_.source }).Count -gt 0) { return 'a quote is missing its text or source' }
  $m = [regex]::Match($page, '<h1 class="cover-heading ctp-quote" data-typewriter data-quotes="([^"]*)"(?: lang="([a-z-]+)")?>([^<]*)</h1>\s*<p class="ctp-quote-source">')
  if (-not $m.Success) { return 'quote heading / source not found' }
  # the page rotates through every quote (2026-10-16): all of them must be in data-quotes
  $rot = @(([System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) | ConvertFrom-Json) | ForEach-Object { $_ })
  if ($rot.Count -ne $quotes.Count) { return "data-quotes has $($rot.Count) quotes, lib/quotes.js has $($quotes.Count)" }
  $shown = [System.Net.WebUtility]::HtmlDecode($m.Groups[3].Value)
  $q = @($quotes | Where-Object { $_.text -eq $shown })
  if ($q.Count -ne 1) { return "heading is not in the list: $shown" }
  # a quote with lang must carry it on the heading (Japanese font)
  if ([string]$q[0].lang -ne $m.Groups[2].Value) { return "lang on the heading is '$($m.Groups[2].Value)', list says '$($q[0].lang)'" }
  $true
}

Test-Check 'HOME-9' 'Mincho subset font is present, served and newer than lib/quotes.js' {
  $font = Join-Path $script:Hd 'public\fonts\lilith\noto-serif-jp-quotes.woff2'
  if (-not (Test-Path $font)) { return 'font missing: run make-quote-font.js' }
  $magic = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($font)[0..3])
  if ($magic -ne 'wOF2') { return "not a woff2 file ($magic)" }
  if ((Invoke-Http '/fonts/lilith/noto-serif-jp-quotes.woff2').Code -ne 200) { return 'font not served' }
  if (-not (Read-Utf8 'public\css\catppuccin.css').Contains('"Lilith Quote JP"')) { return '@font-face missing' }
  # a quote edited after the subset was made may use characters the font lacks
  $quotes = Join-Path $script:Hd 'lib\quotes.js'
  if ((Get-Item $quotes).LastWriteTime -gt (Get-Item $font).LastWriteTime) { return 'WARN: lib/quotes.js changed after the font subset; run make-quote-font.js again' }
  $true
}

Complete-Checks '17-home-page'
