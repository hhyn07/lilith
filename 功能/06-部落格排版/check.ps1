# Feature 06: blog layout modelled on Astro Scholar
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$css = Read-Utf8 'public\css\catppuccin.css'
$js = Read-Utf8 'public\js\catppuccin.js'

Test-Check 'BLOG-1' 'fonts are shipped and served as font/woff2' {
  $bad = @()
  foreach ($f in 'dmsans-latin.woff2', 'dmsans-latin-ext.woff2', 'lilex.woff2') {
    if (-not (Test-Path (Join-Path $script:Hd "public\fonts\lilith\$f"))) { $bad += "$f missing"; continue }
    $ct = & curl.exe -s -o NUL -w '%{http_code} %{content_type}' "$script:BaseUrl/fonts/lilith/$f"
    if ("$ct" -ne '200 font/woff2') { $bad += "$f -> $ct" }
  }
  if ($bad.Count -eq 0) { $true } else { $bad -join '; ' }
}

Test-Check 'BLOG-2' 'font-face URLs in the CSS point at the shipped files' {
  $urls = [regex]::Matches($css, 'url\("\.\./fonts/lilith/([^"]+)"\)') | ForEach-Object { $_.Groups[1].Value }
  $missing = @($urls | Where-Object { -not (Test-Path (Join-Path $script:Hd "public\fonts\lilith\$_")) })
  if ($urls.Count -ge 3 -and $missing.Count -eq 0) { $true } else { "urls=$($urls.Count) missing=$($missing -join ',')" }
}

Test-Check 'BLOG-3' 'reading layout tokens (780px measure, 20px / 1.75 body)' {
  # 2026-10-16: 44rem was only 440px (Bootstrap 3 root font size is 10px); hhyn asked for larger text
  # 2026-10-16 (prompt 110): all text about 10% larger, body 18px -> 20px
  $ok = $css.Contains('--ctp-measure: 780px') -and ($css -match '\.markdown-body \{[^}]*font-size: 20px;[^}]*line-height: 1\.75;')
  if ($ok) { $true } else { 'measure or body type changed' }
}

Test-Check 'BLOG-4' 'home page renders the post list container' {
  $r = Invoke-Http '/'
  if ($r.Code -eq 200 -and $r.Body.Contains('id="history-list"')) { $true } else { "HTTP $($r.Code), history-list present: $($r.Body.Contains('id=""history-list""'))" }
}

Test-Check 'BLOG-5' 'year grouping is wired up (MutationObserver on #history-list)' {
  if ($js.Contains('function groupByYear') -and $js.Contains("getElementById('history-list')") -and $js.Contains('new MutationObserver')) { $true } else { 'groupByYear missing' }
}

Test-Check 'BLOG-6' 'footer is constrained to the content width' {
  if ($css -match '\.mastfoot \{\s*position: static !important;\s*width: auto !important;') { $true } else { 'mastfoot width override missing (cover.css sets 1000px)' }
}

Test-Check 'BLOG-7' 'published note page renders with the reading layout classes' {
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT shortid FROM Notes WHERE deletedAt IS NULL AND permission != 'private' LIMIT 1")
  $note = ($rows | ConvertFrom-Json)
  if (-not $note) { return 'WARN: no note to test with' }
  $r = Invoke-Http "/s/$($note[0].shortid)"
  if ($r.Code -eq 200 -and $r.Body.Contains('markdown-body') -and $r.Body.Contains('catppuccin.css')) { $true } else { "HTTP $($r.Code)" }
}

Test-Check 'BLOG-8' 'table of contents is a foldable panel at the left edge; published notes have the edit / split / view bar' {
  $idx = Read-Utf8 'public\js\index.js'
  $pre = Read-Utf8 'public\js\pretty.js'
  $tpl = Read-Utf8 'public\views\pretty.ejs'
  # 2026-10-16 (feature 19): panel flush with the left edge of the reading area, like HackMD
  if (-not ($idx.Contains("ui.toc.affix.css('left', areaLeft + 'px')") -and $pre.Contains('tocAffix.css(''left'', `${areaLeft}px`)'))) { return 'TOC panel is not placed at the left edge' }
  if (-not (Read-Utf8 'public\js\catppuccin.js').Contains('function tocPanel')) { return 'TOC fold button missing' }
  if (-not ($tpl.Contains('class="ctp-pretty-bar') -and $tpl.Contains('data-mode="edit"') -and $tpl.Contains('data-mode="both"'))) { return 'published-page bar missing' }
  $r = Invoke-Http '/s/features/edit?mode=edit'
  if ($r.Location -notlike '*?edit') { return "edit mode redirect: $($r.Location)" }
  $true
}

Test-Check 'BLOG-9' 'published page top bar like HackMD (changed ... ago + author left; bookmark / theme / contents right; no separate info bar)' {
  $tpl = Read-Utf8 'public\views\pretty.ejs'
  $need = 'class="ctp-pretty-meta"', 'class="ui-lastchange"', 'class="ctp-pretty-actions"', 'ctp-pretty-star', 'class="ctp-pretty-theme"', 'ctp-pretty-toc'
  $miss = @($need | Where-Object { -not $tpl.Contains($_) })
  if ($miss.Count -gt 0) { return 'missing: ' + ($miss -join ', ') }
  if ($tpl.Contains('class="ui-infobar')) { return 'the old info bar is still on the page' }
  $page = (Invoke-Http '/s/features').Body
  if (-not $page.Contains('class="ctp-pretty-meta"')) { return 'published page does not render the new bar' }
  $true
}

Complete-Checks '06-blog-layout'
