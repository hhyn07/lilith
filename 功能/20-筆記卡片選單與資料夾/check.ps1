# Feature 20: note card "..." menu (like HackMD), delete note, rename / tags /
# duplicate, personal folders and bookmarks; accent colour pink
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'NOTE-1' 'title / tags edit helper passes its unit test (incl. HedgeDoc authorship update)' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-note-edit.js'), $script:Hd)
  if ($r.Code -eq 0 -and $r.Out -match '^ok \d+') { $true } else { $r.Out }
}

Test-Check 'NOTE-2' 'folder / bookmark tables exist (migration ran) and have no rows of deleted users' {
  $t = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('LilithFolders','LilithNoteMetas')") | ConvertFrom-Json) | ForEach-Object { $_.name })
  if ($t.Count -ne 2) { return 'tables missing: found ' + ($t -join ', ') }
  $sql = "SELECT (SELECT count(*) FROM LilithFolders f WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = f.userId)) AS f, (SELECT count(*) FROM LilithNoteMetas m WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = m.userId)) AS m, (SELECT count(*) FROM LilithNoteMetas m WHERE NOT EXISTS (SELECT 1 FROM Notes n WHERE n.id = m.noteId)) AS n"
  $o = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json)[0]
  if ($o.f -gt 0 -or $o.m -gt 0) { return "rows of deleted users: folders $($o.f), note metas $($o.m)" }
  if ($o.n -gt 0) { return "WARN: $($o.n) note meta row(s) point at deleted notes (harmless, hidden from the list)" }
  $true
}

Test-Check 'NOTE-3' 'the note list API refuses guests and non-JSON writes' {
  $cases = @(
    @('/api/lilith/notes/meta', 401),
    @('/api/lilith/folders', 401)
  )
  foreach ($c in $cases) {
    $r = Invoke-Http $c[0]
    # GET on /api/lilith/folders is not a route: 404 is fine too
    if ($r.Code -ne $c[1] -and -not ($c[0] -eq '/api/lilith/folders' -and $r.Code -eq 404)) { return "$($c[0]) gave HTTP $($r.Code)" }
  }
  $src = Read-Utf8 'lib\web\noteListRouter.js'
  if (-not ($src.Contains("const write = [requireLogin, writeLimit, requireJson, jsonParser]") -and $src.Contains("req.is('application/json')"))) { return 'write guard (login + rate limit + JSON) missing' }
  # every write route uses the guard
  $writes = [regex]::Matches($src, "noteListRouter\.(post|delete)\('[^']+', (\w+)")
  $bad = @($writes | Where-Object { $_.Groups[2].Value -ne 'write' } | ForEach-Object { $_.Value })
  if ($bad.Count -gt 0) { return 'unguarded: ' + ($bad -join '; ') }
  # rename / tags: the owner or a member of the note's team; delete: owner or team owner / admin (feature 24)
  if (-not $src.Contains('note.ownerId !== req.user.id && !teams.roleForNote(note.id, req.user.id)) return jsonError(res, 403')) { return 'rename / tags permission check missing' }
  if (-not $src.Contains('if (!teams.canManageNote(note.id, note.ownerId, req.user.id)) return jsonError(res, 403')) { return 'delete permission check missing' }
  $true
}

Test-Check 'NOTE-4' 'cards have the ... button; page has the dialog and the folders / bookmarks sidebar' {
  $cover = Read-Utf8 'public\js\cover.js'
  if (-not ($cover.Contains('class="ui-history-more"') -and $cover.Contains("import initNoteList from './lib/noteList'"))) { return 'card ... button missing' }
  if ($cover.Contains('class="ui-history-close')) { return 'old close button still on the card' }
  $page = (Invoke-Http '/').Body
  if (-not ($page.Contains('class="modal fade ctp-dialog-modal"') -and $page.Contains('class="ctp-organize"') -and $page.Contains('class="ctp-folder-add"'))) { return 'dialog / sidebar markup missing' }
  $true
}

Test-Check 'NOTE-5' 'deleting a user or a note cleans the folder / bookmark rows (hooks)' {
  $m = Read-Utf8 'lib\models\lilithFolder.js'
  if (-not ($m.Contains("models.User.addHook('afterDestroy'") -and $m.Contains("models.Note.addHook('afterBulkDestroy'"))) { return 'clean-up hooks missing' }
  $true
}

Test-Check 'NOTE-6' 'accent markers are pink (pin, check mark, online status, current page dot)' {
  $css = Read-Utf8 'public\css\catppuccin.css'
  if (-not $css.Contains('--ctp-primary: var(--ctp-pink);')) { return '--ctp-primary is not pink' }
  if (-not $css.Contains('box-shadow: 0 0 6px color-mix(in srgb, var(--ctp-primary) 70%, transparent);')) { return 'current page dot does not use the pink token' }
  $true
}

Test-Check 'NOTE-7' 'eslint passes on the feature 20 scripts' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\noteEdit.js', 'lib\web\noteListRouter.js', 'lib\models\lilithFolder.js', 'lib\models\lilithNoteMeta.js', 'lib\migrations\20261016140000-lilith-folders.js', 'lib\realtime.js', 'lib\history.js', 'public\js\cover.js', 'public\js\lib\noteList.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '20-note-card-menu'
