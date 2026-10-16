# Feature 12: HackMD-style note link suggestions ("[text](")
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

$js = Read-Utf8 'public\js\lib\editor\note-links.js'
$router = Read-Utf8 'lib\web\noteLinkRouter.js'

Test-Check 'LINK-1' 'trigger pattern unit test (links yes, images / plain text no)' {
  $r = Invoke-Native 'node' @((Join-Path $PSScriptRoot 'test-link-match.js'), $script:Hd)
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'LINK-2' 'API refuses anonymous requests (GET and POST answer 401)' {
  $g = Invoke-Http '/api/lilith/notes'
  $p = Invoke-Http '/api/lilith/notes' 'POST' 'title=x'
  if ($g.Code -eq 401 -and $p.Code -eq 401) { $true } else { "GET $($g.Code), POST $($p.Code)" }
}

Test-Check 'LINK-3' 'router is mounted before the note router' {
  $app = Read-Utf8 'app.js'
  $a = $app.IndexOf("require('./lib/web/noteLinkRouter')")
  $b = $app.IndexOf("require('./lib/web/note/router')")
  if ($a -ge 0 -and $a -lt $b) { $true } else { 'noteLinkRouter missing or after the note router' }
}

Test-Check 'LINK-4' 'POST only accepts JSON and is rate limited' {
  if ($router.Contains("req.is('application/json')") -and $router.Contains('rateLimit.newNotes')) { $true } else { 'JSON check or rate limit missing' }
}

Test-Check 'LINK-5' 'list entries are HTML-escaped and replacements escape $' {
  if ($js.Contains('escapeHtml(item.title)') -and $js.Contains('escapeHtml(item.id)') -and $js.Contains('function escapeReplacement')) { $true } else { 'escaping missing' }
}

Test-Check 'LINK-6' 'eslint passes on the router and the editor module' {
  $r = Invoke-Native 'node_modules\.bin\eslint.cmd' @('--max-warnings', '0', 'lib\web\noteLinkRouter.js', 'public\js\lib\editor\note-links.js')
  if ($r.Code -eq 0) { $true } else { $r.Out }
}

Test-Check 'LINK-7' 'built bundle contains the feature and is newer than note-links.js' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  $text = [IO.File]::ReadAllText($b.FullName, [Text.Encoding]::UTF8)
  $src = Get-Item (Join-Path $script:Hd 'public\js\lib\editor\note-links.js')
  if (-not $text.Contains('/api/lilith/notes')) { return 'bundle has no note links: rebuild the frontend' }
  if ($b.LastWriteTime -lt $src.LastWriteTime) { return 'note-links.js changed after the last build: rebuild the frontend' }
  $true
}

Complete-Checks '12-note-links'
