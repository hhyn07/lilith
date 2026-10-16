# Feature 28: team settings like HackMD's -- general (picture, name, description, card
# preview), team address, privacy, team notes, social; workspace menu. Also the fixes
# from the 2026-10-16 code review that belong to teams and the note list.
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'SET-1' 'team address and privacy columns; the address is unique' {
  $c = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT count(*) AS n FROM pragma_table_info('LilithTeams') WHERE name IN ('handle','privacy')") | ConvertFrom-Json)[0]
  if ($c.n -ne 2) { return "LilithTeams has $($c.n) of 2 columns" }
  $i = @((Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT name FROM sqlite_master WHERE type='index' AND name='lilith_teams_handle' AND sql LIKE '%UNIQUE%'") | ConvertFrom-Json))
  if ($i.Count -ne 1) { return 'no unique index on the team address' }
  $d = (Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @("SELECT count(*) AS n FROM LilithTeams WHERE privacy NOT IN ('open','closed') OR (handle IS NOT NULL AND handle NOT GLOB '[a-z0-9]*')") | ConvertFrom-Json)[0]
  if ($d.n -gt 0) { return "$($d.n) team(s) with a bad address or privacy" }
  $true
}

Test-Check 'SET-2' 'public page by address; bad or unknown addresses 404; closed teams for members only' {
  if ((Invoke-Http '/t/-bad-address').Code -ne 404) { return 'a bad address is not 404' }
  if ((Invoke-Http '/t/no-such-team-zz9').Code -ne 404) { return 'an unknown address is not 404' }
  $s = Read-Utf8 'lib\web\teamPageRouter.js'
  if (-not $s.Contains('const HANDLE = /^[a-z0-9][a-z0-9-]{1,38}$/')) { return 'address rule changed' }
  if (-not $s.Contains("if (team.privacy === 'closed' && !role) return errors.errorNotFound(res)")) { return 'closed teams are not hidden' }
  if (-not $s.Contains("SequelizeUniqueConstraintError")) { return 'a taken address is not handled' }
  $true
}

Test-Check 'SET-3' 'settings page and workspace menu have their parts' {
  $t = Read-Utf8 'public\views\team.ejs'
  foreach ($c in 'data-section="general"', 'data-section="notes"', 'data-section="members"', 'data-section="social"', 'ctp-team-preview', 'ctpTeamHandle', 'ctp-team-privacy') { if (-not $t.Contains($c)) { return "settings lack $c" } }
  $n = Read-Utf8 'public\js\lib\noteList.js'
  if (-not ($n.Contains("ctp-ws-head") -and $n.Contains("ctp-ws-gear"))) { return 'workspace menu lacks its header' }
  $true
}

Test-Check 'SET-4' 'review fixes: team list escaped, no member e-mails, access re-checked, names escaped' {
  $n = Read-Utf8 'public\js\lib\noteList.js'
  if (-not ($n.Contains("text: escapeText(n.text || '')") -and $n.Contains('(n.tags || []).map(escapeText)'))) { return 'team notes go into the list unescaped (XSS)' }
  if (-not $n.Contains('if (currentTeam !== t.id) return done && done()')) { return 'a late team answer can replace another workspace' }
  if ((Read-Utf8 'lib\web\teamRouter.js').Contains('{ email: u.email')) { return 'team data shows member e-mail addresses' }
  if (-not (Read-Utf8 'lib\realtime.js').Contains('realtime.recheckAccess = function')) { return 'open editors keep access after leaving a team' }
  if ((Read-Utf8 'public\views\slide.ejs') -match '<%-\s*(lastchangeuserprofile|ownerprofile)\.name') { return 'slide.ejs puts names out unescaped' }
  $true
}

Test-Check 'SET-5' 'eslint passes' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\teamPageRouter.js', 'lib\web\teamRouter.js', 'lib\web\noteListRouter.js', 'lib\realtime.js', 'lib\notify.js', 'lib\models\lilithTeam.js', 'lib\migrations\20261016190000-lilith-team-settings.js', 'public\js\catppuccin.js', 'public\js\lib\noteList.js', 'public\js\cover.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Complete-Checks '28-team-settings'
