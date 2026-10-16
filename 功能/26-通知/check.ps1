# Feature 26: notifications like HackMD's -- bell with unread count, panel with
# note changes (general) and team events (important), only-unread, mark all read
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'NOTIFY-1' 'notification table exists and has no rows of deleted users' {
  $t = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT name FROM sqlite_master WHERE type='table' AND name = 'LilithNotifications'") | ConvertFrom-Json))
  if ($t.Count -ne 1) { return 'table LilithNotifications missing' }
  $o = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT count(*) AS n FROM LilithNotifications x WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = x.userId)") | ConvertFrom-Json)[0]
  if ($o.n -gt 0) { return "$($o.n) notification(s) of deleted users" }
  $true
}

Test-Check 'NOTIFY-2' 'guests: notification API is 401' {
  foreach ($p in '/api/lilith/notifications', '/api/lilith/notifications/count') {
    $c = (Invoke-Http $p).Code
    if ($c -ne 401) { return "$p is $c for guests" }
  }
  $true
}

Test-Check 'NOTIFY-3' 'write routes use the guard; /read comes before /:id' {
  $s = Read-Utf8 'lib\web\notificationRouter.js'
  $writes = [regex]::Matches($s, "notificationRouter\.(post|delete)\('[^']+', (\w+)")
  $bad = @($writes | Where-Object { $_.Groups[2].Value -ne 'write' } | ForEach-Object { $_.Value })
  if ($writes.Count -ne 3) { return "expected 3 write routes, found $($writes.Count)" }
  if ($bad.Count -gt 0) { return 'unguarded: ' + ($bad -join '; ') }
  if ($s.IndexOf("post('/api/lilith/notifications/read'") -gt $s.IndexOf("post('/api/lilith/notifications/:id'")) { return '/read comes after /:id' }
  if (-not $s.Contains('where: { id, userId: req.user.id }')) { return 'one notification is not looked up by its owner' }
  $true
}

Test-Check 'NOTIFY-4' 'changes: made on new revisions, actors left out, readers re-checked when listed' {
  $m = Read-Utf8 'lib\models\lilithNotification.js'
  $n = Read-Utf8 'lib\notify.js'
  if (-not $m.Contains("models.Revision.addHook('afterCreate'")) { return 'no revision hook' }
  if (-not $m.Contains("models.User.addHook('afterDestroy'")) { return 'no account deletion hook' }
  if (-not $n.Contains('actors.forEach(id => people.delete(id))')) { return 'actors are not left out' }
  if (-not $n.Contains('filter(id => canRead(note, id))')) { return 'recipients are not checked' }
  if (-not $n.Contains('const hidden = note && !canRead(note, userId)')) { return 'list does not re-check access' }
  if (-not (Read-Utf8 'lib\realtime.js').Contains('realtime.wakeRevisionSaver = function')) { return 'wakeRevisionSaver missing' }
  $true
}

Test-Check 'NOTIFY-5' 'every page header has a bell slot; panel text is set with textContent' {
  foreach ($f in 'public\views\hedgedoc\header.ejs', 'public\views\index\body.ejs', 'public\views\mypage.ejs', 'public\views\team.ejs') {
    if (-not (Read-Utf8 $f).Contains('ctp-bell-slot')) { return "no bell slot in $f" }
  }
  $j = Read-Utf8 'public\js\catppuccin.js'
  if (-not $j.Contains('function notifications (slots)')) { return 'panel code missing' }
  $body = [regex]::Match($j, 'function notifications \(slots\)[\s\S]*?\n  \}\n').Value
  # innerHTML only gets fixed icons (no string built with +)
  if ($body -match 'innerHTML = [^\n]*\+') { return 'notification data put into innerHTML' }
  $true
}

Test-Check 'NOTIFY-6' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\notify.js', 'lib\web\notificationRouter.js', 'lib\models\lilithNotification.js', 'lib\migrations\20261016170000-lilith-notifications.js', 'lib\web\teamRouter.js', 'lib\realtime.js', 'lib\web\noteListRouter.js', 'public\js\catppuccin.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '26-notifications'
