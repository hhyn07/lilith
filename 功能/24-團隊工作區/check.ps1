# Feature 24: team workspaces like HackMD's -- teams, members (owner / admin / member),
# invite links, team notes, team trash; members may read and edit every team note
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'TEAM-1' 'team tables exist and have no rows of deleted users or teams' {
  $t = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('LilithTeams','LilithTeamMembers','LilithTeamNotes')") | ConvertFrom-Json) | ForEach-Object { $_.name })
  if ($t.Count -ne 3) { return 'tables missing: found ' + ($t -join ', ') }
  $sql = "SELECT (SELECT count(*) FROM LilithTeamMembers m WHERE NOT EXISTS (SELECT 1 FROM Users u WHERE u.id = m.userId)) AS mu, (SELECT count(*) FROM LilithTeamMembers m WHERE NOT EXISTS (SELECT 1 FROM LilithTeams t WHERE t.id = m.teamId)) AS mt, (SELECT count(*) FROM LilithTeamNotes n WHERE NOT EXISTS (SELECT 1 FROM LilithTeams t WHERE t.id = n.teamId)) AS nt, (SELECT count(*) FROM LilithTeams t WHERE NOT EXISTS (SELECT 1 FROM LilithTeamMembers m WHERE m.teamId = t.id AND m.role = 'owner')) AS noowner"
  $o = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @($sql) | ConvertFrom-Json)[0]
  if ($o.mu -gt 0 -or $o.mt -gt 0 -or $o.nt -gt 0) { return "orphan rows: members of deleted users $($o.mu), of deleted teams $($o.mt), notes of deleted teams $($o.nt)" }
  if ($o.noowner -gt 0) { return "$($o.noowner) team(s) without an owner" }
  $true
}

Test-Check 'TEAM-2' 'permission checks know about teams (view, edit, manage) on the server and in the editor' {
  $u = Read-Utf8 'lib\web\note\util.js'
  $r = Read-Utf8 'lib\realtime.js'
  $i = Read-Utf8 'public\js\index.js'
  if (-not $u.Contains('teams.roleForNote(note.id, req.user.id)) return true')) { return 'note/util.js view check' }
  if (-not ($r.Contains('teams.roleForNote(note.id, req.user.id)) return true') -and $r.Contains('teams.roleForNote(noteId, socket.request.user.id))) { mayEdit = false }'))) { return 'realtime view / edit check' }
  if ([regex]::Matches($r, 'teams\.canManageNote\(noteId, note\.owner, socket\.request\.user\.id\)').Count -ne 2) { return 'realtime permission / delete check' }
  if (-not ($r.Contains('teamRole: socket.request.user') -and $i.Contains("bool = isNoteOwner() || !!window.lilithTeamRole") -and $i.Contains('function canManageNote'))) { return 'editor does not let team members type' }
  $true
}

Test-Check 'TEAM-3' 'guests: team API 401, settings page sends them to sign in, bad invite links are refused' {
  if ((Invoke-Http '/api/lilith/teams').Code -ne 401) { return 'team list is not 401 for guests' }
  $r = Invoke-Http '/team/00000000-0000-4000-8000-000000000000/settings'
  if ($r.Code -ne 302 -or $r.Location -notlike '*/login') { return "settings for a guest: $($r.Code) $($r.Location)" }
  $r = Invoke-Http '/team/join/AAAAAAAAAAAAAAAAAAAAAAAA'
  if ($r.Code -ne 200 -or $r.Body -notmatch 'ctp-join') { return "bad invite link: $($r.Code)" }
  $true
}

Test-Check 'TEAM-4' 'joining needs a button press (POST with JSON), not just opening the link' {
  $s = Read-Utf8 'lib\web\teamRouter.js'
  $get = [regex]::Match($s, "teamRouter\.get\('/team/join/:token'[\s\S]*?\n\}\)\)").Value
  if (-not $get) { return 'join page route missing' }
  if ($get.Contains('setMember')) { return 'opening the invite link adds the user (should only show a confirm page)' }
  if (-not $s.Contains("teamRouter.post('/api/lilith/teams/join', write")) { return 'join API missing or unguarded' }
  # join is registered before the /:id routes ("join" would be taken for a team id)
  if ($s.IndexOf("teamRouter.post('/api/lilith/teams/join'") -gt $s.IndexOf("teamRouter.get('/api/lilith/teams/:id'")) { return 'join route comes after the /:id routes' }
  $true
}

Test-Check 'TEAM-5' 'every team write route uses the guard (login, rate limit, JSON)' {
  $s = Read-Utf8 'lib\web\teamRouter.js'
  $writes = [regex]::Matches($s, "teamRouter\.(post|delete)\('[^']+', (\w+)")
  $bad = @($writes | Where-Object { $_.Groups[2].Value -ne 'write' } | ForEach-Object { $_.Value })
  if ($writes.Count -lt 10) { return "only $($writes.Count) write routes found" }
  if ($bad.Count -gt 0) { return 'unguarded: ' + ($bad -join '; ') }
  $true
}

Test-Check 'TEAM-6' 'list page has the workspace switcher and team bar' {
  $page = (Invoke-Http '/').Body
  foreach ($c in 'class="ctp-workspace"', 'class="ctp-workspace-toggle"', 'class="ctp-team-bar"', 'ctp-team-bar-new') {
    if (-not $page.Contains($c)) { return "missing $c" }
  }
  $true
}

Test-Check 'TEAM-7' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\teams.js', 'lib\web\teamRouter.js', 'lib\web\noteListRouter.js', 'lib\realtime.js', 'lib\web\note\util.js', 'lib\models\lilithTeam.js', 'lib\models\lilithTeamMember.js', 'lib\models\lilithTeamNote.js', 'lib\migrations\20261016160000-lilith-teams.js', 'public\js\index.js', 'public\js\catppuccin.js', 'public\js\lib\noteList.js', 'public\js\cover.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '24-teams'
