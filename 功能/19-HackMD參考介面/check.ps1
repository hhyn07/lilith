# Feature 19: HackMD-style pieces: avatar menu + grouped "..." menu, version history
# dialog, foldable table-of-contents panel, public profile page /u/<id>
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'HMD-1' 'editor navbar: avatar menu and the grouped "..." menu keep every action class' {
  $hdr = Read-Utf8 'public\views\hedgedoc\header.ejs'
  if (-not ($hdr.Contains('class="dropdown ctp-user"') -and $hdr.Contains('class="ctp-user-public"') -and $hdr.Contains('/#edit-profile') -and $hdr.Contains('/logout'))) { return 'avatar menu missing' }
  if ([regex]::Matches($hdr, 'class="ctp-submenu"').Count -lt 2) { return 'import / download submenus missing' }
  # index.js blocks every a[href="#"] at load, so a placeholder href makes the link dead (E7)
  if (-not $hdr.Contains('<a class="ctp-user-public">')) { return 'public page link must not start with a placeholder href' }
  # index.js binds the menu actions by these classes (lib/editor/ui-elements.js)
  $need = 'ui-extra-revision', 'ui-extra-slide', 'ui-publish', 'ui-import-dropbox', 'ui-import-gist', 'ui-import-clipboard', 'ui-save-dropbox', 'ui-download-markdown', 'ui-download-html', 'ui-download-raw-html'
  $miss = @($need | Where-Object { -not $hdr.Contains("class=""$_""") })
  if ($miss.Count -eq 0) { $true } else { 'missing: ' + ($miss -join ', ') }
}

Test-Check 'HMD-2' 'version history: list with authors, diff switch, revert / download buttons' {
  $tpl = Read-Utf8 'public\views\shared\revision-modal.ejs'
  $idx = Read-Utf8 'public\js\index.js'
  if (-not ($tpl.Contains('id="revisionModalDiff"') -and $tpl.Contains('id="revisionModalRevert"') -and $tpl.Contains('id="revisionModalDownload"') -and $tpl.Contains('ui-revision-list'))) { return 'dialog parts missing' }
  if (-not ($idx.Contains('function renderRevision') -and $idx.Contains("className: 'ctp-rev-ins'"))) { return 'index.js diff rendering not updated' }
  # the revision list API carries an author (or null) for every revision
  $r = Invoke-Http '/features/revision'
  if ($r.Code -ne 200) { return "revision list: HTTP $($r.Code)" }
  $list = @(($r.Body | ConvertFrom-Json).revision)
  $bad = @($list | Where-Object { -not ($_.PSObject.Properties.Name -contains 'author') })
  if ($bad.Count -gt 0) { return "$($bad.Count) revision(s) without the author field" }
  $true
}

Test-Check 'HMD-3' 'table of contents panel can be folded (remembered per browser)' {
  $js = Read-Utf8 'public\js\catppuccin.js'
  $css = Read-Utf8 'public\css\catppuccin.css'
  if (-not ($js.Contains('function tocPanel') -and $js.Contains("'lilith-toc-folded'"))) { return 'fold button code missing' }
  if (-not ($css.Contains('.ctp-toc-folded .ui-affix-toc { display: none !important; }') -and $css.Contains('.ctp-toc-toggle.ctp-toc-tab'))) { return 'fold CSS missing' }
  $true
}

Test-Check 'HMD-4' 'public profile: unknown or malformed ids are 404, pages are noindex' {
  foreach ($id in @('00000000-0000-4000-8000-000000000000', 'not-a-uuid')) {
    $r = Invoke-Http "/u/$id"
    if ($r.Code -ne 404) { return "/u/$id gave HTTP $($r.Code)" }
  }
  if (-not (Read-Utf8 'public\views\user.ejs').Contains('<meta name="robots" content="noindex">')) { return 'noindex meta missing' }
  $true
}

Test-Check 'HMD-5' 'public profile lists exactly the owner''s guest-readable, non-blank notes' {
  $owners = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT DISTINCT ownerId FROM Notes WHERE deletedAt IS NULL AND ownerId IS NOT NULL") | ConvertFrom-Json) | ForEach-Object { $_.ownerId })
  if ($owners.Count -eq 0) { return 'WARN: no note owners to test with' }
  foreach ($o in $owners) {
    $sql = "SELECT shortid FROM Notes WHERE deletedAt IS NULL AND ownerId = '$o' AND permission IN ('freely','editable','locked') AND TRIM(COALESCE(content,'')) <> '' ORDER BY COALESCE(lastchangeAt, updatedAt) DESC LIMIT 60"
    $expected = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json) | ForEach-Object { $_.shortid })
    $r = Invoke-Http "/u/$o"
    if ($r.Code -ne 200) { return "/u/$o gave HTTP $($r.Code)" }
    $shown = @([regex]::Matches($r.Body, '/[sb]/([A-Za-z0-9_-]+)"') | ForEach-Object { $_.Groups[1].Value })
    if (($expected -join ',') -ne ($shown -join ',')) { return "owner $o expected [$($expected -join ',')] shown [$($shown -join ',')]" }
    # nothing private / protected / limited of this owner may appear
    $hidden = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT shortid FROM Notes WHERE ownerId = '$o' AND permission NOT IN ('freely','editable','locked')") | ConvertFrom-Json) | ForEach-Object { $_.shortid })
    $leak = @($hidden | Where-Object { $_ -and ($r.Body.Contains("/s/$_`"") -or $r.Body.Contains("/b/$_`"")) })
    if ($leak.Count -gt 0) { return 'leaked: ' + ($leak -join ', ') }
    if ($r.Body -match '@[A-Za-z0-9.-]+\.[a-z]{2,}') { return "an e-mail address appears on /u/$o" }
  }
  $true
}

Test-Check 'HMD-6' 'eslint passes on the changed scripts' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\models\revision.js', 'lib\web\profileRouter.js', 'lib\publicNotes.js', 'public\js\catppuccin.js', 'public\js\index.js', 'public\js\pretty.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'HMD-7' 'editor info bar is one row like HackMD (owner + changed ... ago left, permission + bookmark right)' {
  $b = Read-Utf8 'public\views\hedgedoc\body.ejs'
  $bar = [regex]::Match($b, 'class="ui-infobar[\s\S]*?</small>').Value
  if (-not $bar) { return 'info bar not found' }
  if (-not ($bar.Contains('class="ctp-infobar-row"') -and $bar.Contains('class="ctp-infobar-actions"') -and $bar.Contains('ctp-note-star'))) { return 'one-row layout parts missing' }
  if ($bar.Contains('<br>') -or $bar.Contains('owned this note') -or $bar.Contains('Delete this note')) { return 'old two-row / English parts still there' }
  # extra.js finds these by class
  foreach ($c in 'ui-owner', 'ui-lastchangeuser', 'ui-no-lastchangeuser', 'ui-status-lastchange changed', 'ui-status-lastchange created', 'ui-lastchange', 'ui-permission-label') {
    if (-not $bar.Contains('class="' + $c)) { return "class $c missing" }
  }
  $true
}

Complete-Checks '19-hackmd-style'
