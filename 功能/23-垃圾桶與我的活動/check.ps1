# Feature 23: trash (deleted notes can be restored for 30 days) and "my activity"
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'TRASH-1' 'notes are soft-deleted (paranoid model on the existing deletedAt column)' {
  $m = Read-Utf8 'lib\models\note.js'
  if (-not $m.Contains('paranoid: true,')) { return 'Note model is not paranoid' }
  $cols = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT sql FROM sqlite_master WHERE name = 'Notes'") | ConvertFrom-Json)[0].sql
  if ($cols -notmatch 'deletedAt') { return 'Notes has no deletedAt column' }
  $true
}

Test-Check 'TRASH-2' 'guests: trash API 401, /trash and /activity send them to sign in' {
  if ((Invoke-Http '/api/lilith/trash').Code -ne 401) { return 'trash API is not 401 for guests' }
  foreach ($p in '/trash', '/activity') {
    $r = Invoke-Http $p
    if ($r.Code -ne 302 -or $r.Location -notlike '*/login') { return "$p -> $($r.Code) $($r.Location)" }
  }
  $true
}

Test-Check 'TRASH-3' 'moving to the trash keeps folder / bookmark; deleting for good cleans everything' {
  $f = Read-Utf8 'lib\models\lilithFolder.js'
  if (-not $f.Contains('options.force && options.where && options.where.id')) { return 'folder / bookmark rows would be lost when a note is trashed' }
  $r = Read-Utf8 'lib\web\noteListRouter.js'
  if (-not ($r.Contains("models.Note.destroy({ where: { id: note.id }, force: true })") -and $r.Contains('models.Revision.destroy({ where: { noteId: note.id } })'))) { return 'permanent delete does not clean revisions' }
  # write routes use the guard
  foreach ($route in "noteListRouter.post('/api/lilith/trash/:id/restore', write", "noteListRouter.delete('/api/lilith/trash/:id', write", "noteListRouter.delete('/api/lilith/trash', write") {
    if (-not $r.Contains($route)) { return "unguarded or missing: $route" }
  }
  $true
}

Test-Check 'TRASH-4' 'nothing stays in the trash much longer than 30 days' {
  $sql = "SELECT count(*) AS n FROM Notes WHERE deletedAt IS NOT NULL AND deletedAt < datetime('now', '-37 days')"
  $n = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json)[0].n
  # old notes are deleted when their owner opens the trash; a week of grace for owners who do not
  if ($n -gt 0) { return "WARN: $n note(s) trashed over 37 days ago (deleted next time the owner opens the trash)" }
  $true
}

Test-Check 'TRASH-5' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\noteListRouter.js', 'lib\web\myPagesRouter.js', 'lib\models\note.js', 'lib\models\lilithFolder.js', 'lib\web\userRouter.js', 'public\js\catppuccin.js', 'public\js\lib\noteList.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '23-trash-activity'
