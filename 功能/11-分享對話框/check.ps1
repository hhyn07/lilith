# Feature 11: HackMD-style share dialog
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$js = Read-Utf8 'public\js\lib\editor\share.js'
$modal = Read-Utf8 'public\views\shared\share-modal.ejs'

Test-Check 'SHARE-1' 'editor page includes the share modal' {
  if ((Read-Utf8 'public\views\hedgedoc\body.ejs').Contains("include('../shared/share-modal')")) { $true } else { 'share-modal not included in hedgedoc/body.ejs' }
}

Test-Check 'SHARE-2' 'navbar share entries open the modal (desktop and mobile)' {
  $n = [regex]::Matches((Read-Utf8 'public\views\hedgedoc\header.ejs'), 'class="ui-share"[^>]*data-target="\.share-modal"').Count
  if ($n -eq 2) { $true } else { "found $n share entries, expected 2" }
}

Test-Check 'SHARE-3' 'permission table covers every HedgeDoc permission' {
  $types = [regex]::Match((Read-Utf8 'lib\models\note.js'), "permissionTypes = \[([^\]]+)\]").Groups[1].Value -replace "[' ]", '' -split ','
  $missing = @($types | Where-Object { $js -notmatch "\b${_}: \['(owner|signed|everyone)', '(owner|signed|everyone)'\]" })
  if ($types.Count -eq 6 -and $missing.Count -eq 0) { $true } else { 'not mapped: ' + ($missing -join ', ') }
}

Test-Check 'SHARE-4' 'eslint passes on share.js and index.js' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'public\js\lib\editor\share.js', 'public\js\index.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'SHARE-5' 'built bundle contains the share dialog and is newer than share.js' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $text = [IO.File]::ReadAllText($b.FullName, [Text.Encoding]::UTF8)
  $src = Get-Item (Join-Path $script:Hd 'public\js\lib\editor\share.js')
  if (-not $text.Contains('share-modal')) { return 'bundle has no share dialog: rebuild the frontend' }
  if ($b.LastWriteTime -lt $src.LastWriteTime) { return 'share.js changed after the last build: rebuild the frontend' }
  $true
}

Test-Check 'SHARE-6' 'tabs are buttons, not #hash links (HedgeDoc rewrites the URL hash)' {
  if ($modal -match 'data-share-tab' -and $modal -notmatch '<a [^>]*data-share-tab') { $true } else { 'tabs are anchors again' }
}

Test-Check 'SHARE-7' 'copy falls back to text selection when the Clipboard API refuses' {
  if ($js.Contains('.catch(() => copyBySelection(text))')) { $true } else { 'clipboard fallback missing' }
}

Test-Check 'SHARE-9' 'open modes match HackMD (edit / view / book / slide)' {
  $menu = [regex]::Matches($modal, 'role="option" data-mode="(\w+)"') | ForEach-Object { $_.Groups[1].Value }
  $ok = ($menu -join ',') -eq 'edit,view,book,slide' -and $js.Contains("edit: '?both'") -and $js.Contains("view: '?view'") -and $js.Contains("book: '/book'") -and $js.Contains("return noteurl + '/publish'") -and $js.Contains("slide: '/slide'")
  if ($ok) { $true } else { 'menu: ' + ($menu -join ',') }
}

Test-Check 'SHARE-10' 'copy buttons copy the full URL, not the shortened text in the box' {
  if ($modal -match 'data-copy="share"' -and $modal -match 'data-copy="publish"' -and $js.Contains('copy($(this).data(''copy'') === ''publish'' ? publishUrl() : shareUrl()')) { $true } else { 'copy buttons do not use the full URL' }
}

Test-Check 'SHARE-8' 'everyone-can-edit is offered only when anonymous editing is allowed' {
  if ($modal.Contains('data-allow-freely="<%= (allowAnonymous || allowAnonymousEdits)') -and $js.Contains("this.value === 'everyone' && !allowFreely")) { $true } else { 'freely guard missing' }
}

Complete-Checks '11-share'
