# Feature 27: a team's public page like HackMD's -- profile, members, contributors,
# pinned notes, follow, likes
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'TP-1' 'tables and columns exist; no rows of deleted users, teams or notes' {
  $t = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('LilithFollows','LilithLikes')") | ConvertFrom-Json))
  if ($t.Count -ne 2) { return 'LilithFollows / LilithLikes missing' }
  $c = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT count(*) AS n FROM pragma_table_info('LilithTeams') WHERE name IN ('bio','email','links','photo','pinned')") | ConvertFrom-Json)[0]
  if ($c.n -ne 5) { return "LilithTeams has $($c.n) of the 5 profile columns" }
  $sql = "SELECT (SELECT count(*) FROM LilithFollows f WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = f.userId) OR NOT EXISTS (SELECT 1 FROM LilithTeams t WHERE t.id = f.teamId)) AS f, (SELECT count(*) FROM LilithLikes l WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = l.userId) OR NOT EXISTS (SELECT 1 FROM Notes n WHERE n.id = l.noteId)) AS l"
  $o = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json)[0]
  if ($o.f -gt 0 -or $o.l -gt 0) { return "orphan rows: follows $($o.f), likes $($o.l)" }
  $true
}

Test-Check 'TP-2' 'guests: unknown team page 404, writes 401' {
  if ((Invoke-Http '/t/00000000-0000-4000-8000-000000000000').Code -ne 404) { return 'unknown team page is not 404' }
  if ((Invoke-Http '/t/not-a-uuid').Code -ne 404) { return 'bad team id is not 404' }
  if ((Invoke-Http '/api/lilith/notes/no-such-note-zz9/like').Code -ne 404) { return 'like count of an unknown note is not 404' }
  $true
}

Test-Check 'TP-3' 'write routes are guarded; only public notes, http(s) links, managers' {
  $s = Read-Utf8 'lib\web\teamPageRouter.js'
  $writes = [regex]::Matches($s, "teamPageRouter\.post\('[^']+', (\w+)")
  # profile, pins, follow, like (27); handle, privacy (28)
  if ($writes.Count -ne 6) { return "expected 6 write routes, found $($writes.Count)" }
  if (@($writes | Where-Object { $_.Groups[1].Value -ne 'write' }).Count) { return 'a write route without the guard' }
  if (-not $s.Contains("permission: { [Op.in]: GUEST_READABLE }")) { return 'page lists more than public notes' }
  if (-not $s.Contains("protocols: ['http', 'https']")) { return 'links / picture not limited to http(s)' }
  if ([regex]::Matches($s, 'teams\.isManager\(role\)').Count -lt 2) { return 'profile / pins not limited to managers' }
  if (-not $s.Contains('noteUtil.checkViewPermission(req, note)')) { return 'likes not limited to readable notes' }
  $true
}

Test-Check 'TP-4' 'followers are told about changes; deleted things take their rows' {
  if (-not (Read-Utf8 'lib\notify.js').Contains('models.LilithFollow.findAll({ where: { teamId }')) { return 'followers not notified' }
  if (-not (Read-Utf8 'lib\teams.js').Contains('models.LilithFollow.destroy({ where: { teamId } })')) { return 'deleting a team keeps its follows' }
  $l = Read-Utf8 'lib\models\lilithLike.js'
  if (-not ($l.Contains("addHook('afterBulkDestroy'") -and $l.Contains("models.User.addHook('afterDestroy'"))) { return 'likes not removed with notes / accounts' }
  $true
}

Test-Check 'TP-5' 'page, settings and published page have their parts' {
  $p = Read-Utf8 'public\views\team-page.ejs'
  foreach ($c in 'ctp-tp-follow', 'ctp-tp-like', 'ctp-tp-pick', 'ctp-tp-search', 'ctp-tp-order', 'id="ctp-team-page"') { if (-not $p.Contains($c)) { return "team page lacks $c" } }
  $t = Read-Utf8 'public\views\team.ejs'
  if (-not ($t.Contains('ctp-team-general') -and $t.Contains('ctp-team-social'))) { return 'settings lack the profile forms (general / social, feature 28)' }
  if (-not (Read-Utf8 'public\views\pretty.ejs').Contains('ctp-pretty-like')) { return 'published page lacks the heart' }
  $j = Read-Utf8 'public\js\catppuccin.js'
  if (-not ($j.Contains('function teamPage (data)') -and $j.Contains('function noteLike (button)'))) { return 'page scripts missing' }
  $true
}

Test-Check 'TP-6' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\teamPageRouter.js', 'lib\models\lilithTeam.js', 'lib\models\lilithFollow.js', 'lib\models\lilithLike.js', 'lib\migrations\20261016180000-lilith-team-page.js', 'lib\notify.js', 'lib\teams.js', 'lib\web\teamRouter.js', 'public\js\catppuccin.js', 'public\js\lib\noteList.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '27-team-page'
