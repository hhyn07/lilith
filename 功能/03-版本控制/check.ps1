# Feature 03: version control -- one repository for the whole project (since 2026-10-16):
# docs at the top, the HedgeDoc 1.10.8 fork in hedgedoc-1x/ with its full history
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'GIT-1' 'one repository: hedgedoc-1x is part of the project repository, branch main' {
  if (Test-Path (Join-Path $script:Hd '.git')) { return 'hedgedoc-1x has its own .git again (two repositories)' }
  # (compared as a relative path: git prints the folder's CJK name in another encoding)
  $up = (Invoke-Git @('rev-parse', '--show-cdup')).Out
  if ($up -ne '../') { return "hedgedoc-1x is not directly under the repository root ($up)" }
  # new files in hedgedoc-1x must not be ignored by the project's .gitignore
  if ((Invoke-Native 'git' @('-C', $script:ProjectRoot, 'check-ignore', '-q', '--no-index', 'hedgedoc-1x/app.js')).Code -eq 0) { return 'hedgedoc-1x is ignored by .gitignore' }
  $b = (Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')).Out
  if ($b -eq 'main') { $true } else { "on '$b'" }
}

Test-Check 'GIT-2' 'HedgeDoc history is complete (not shallow) and contains tag 1.10.8' {
  if ((Invoke-Git @('rev-parse', '--is-shallow-repository')).Out -ne 'false') { return 'shallow repository (cannot be pushed to a new remote)' }
  $r = Invoke-Git @('merge-base', '--is-ancestor', '1.10.8', 'HEAD')
  if ($r.Code -eq 0) { $true } else { "1.10.8 is not an ancestor of HEAD: $($r.Out)" }
}

Test-Check 'GIT-3' 'expected feature commits are present' {
  $missing = @()
  foreach ($c in '99dc634', 'ff6b535', '365a522', '89e9958', '9e99bb4', '1a63392', '12966d4', '3f7d3e7', 'fc22143', '3ff7cbc', 'ec4c9c6', '2de695e', 'd0c211e', 'cd00514', '19034b1', '1f189df', 'af4922f', '9fb04cc', '15307b3', 'f555aba', 'de13313', 'd12c0e1', '9e9d1d1', '827c22f', 'a488c66', '99546f9', '48d9d89', 'd77309d', 'cd04201', 'a32be00', '03f4b2a', '6a5fd1a', '651c4e2', '139c774', 'cf7c729', 'aa00b22', 'b85a786', '7b525f7', '0425a6f', '5b68bc7', 'eecda2e', 'bab9c74', 'c702aed', '8b87c22', '596345c', '1e181c0', '30631a9', '9458ac5', '0b4c08f', '751d1cc', '63021b3', 'dd14cf7', 'be195b3', '32dbeca', '56cc3d2', '53c73e5', '2949217', 'cbb3368', '2de0deb', 'bcebc0f', 'c3316da', '0089cad', '3fab8bb', '8f50808', '7f7fdcb', '2e07339', 'cde5e27', '58edf31', '16e08513', 'd41965c2', '64a0a6d2', 'd774aa29', 'f08d0576', '9236bed8', 'd47f9003', 'aebb53b9', 'dd3cb8c1', 'c416a618') {
    if ((Invoke-Git @('cat-file', '-e', "$c^{commit}")).Code -ne 0) { $missing += $c }
  }
  if ($missing.Count -eq 0) { $true } else { 'missing: ' + ($missing -join ', ') }
}

Test-Check 'GIT-4' 'local-only files are ignored (config, database, build)' {
  $notIgnored = @()
  foreach ($p in 'config.json', 'db.hedgedoc.sqlite', 'public/build/') {
    if ((Invoke-Git @('check-ignore', '-q', $p)).Code -ne 0) { $notIgnored += $p }
  }
  if ($notIgnored.Count -eq 0) { $true } else { 'not ignored: ' + ($notIgnored -join ', ') }
}

Test-Check 'GIT-5' 'working tree is clean' {
  $s = (Invoke-Git @('status', '--porcelain')).Out
  if (-not $s) { $true } else { 'WARN: uncommitted changes: ' + (($s -split "`n" | ForEach-Object { $_.Trim() }) -join '; ') }
}

Test-Check 'GIT-6' 'origin is the private GitHub repository; nothing pushes to upstream HedgeDoc' {
  $remotes = @((Invoke-Git @('remote')).Out -split "`n" | Where-Object { $_ })
  foreach ($r in $remotes) {
    $push = (Invoke-Git @('remote', 'get-url', '--push', $r)).Out
    if ($push -match 'hedgedoc/hedgedoc') { return "remote $r pushes to upstream HedgeDoc" }
  }
  if (-not ($remotes -contains 'origin')) { return 'WARN: no origin remote yet' }
  $origin = (Invoke-Git @('remote', 'get-url', 'origin')).Out
  if ($origin -match 'github\.com[/:]hhyn07/lilith-notes(\.git)?$') { $true } else { "origin is $origin" }
}

Test-Check 'GIT-7' 'private files are not in the repository (config, database, backups, log)' {
  $notIgnored = @()
  foreach ($p in 'hedgedoc-1x/config.json', 'hedgedoc-1x/db.hedgedoc.sqlite', 'hedgedoc-server.log') {
    if ((Invoke-Native 'git' @('-C', $script:ProjectRoot, 'check-ignore', '-q', $p)).Code -ne 0) { $notIgnored += $p }
  }
  # backup folder name is two CJK chars; this file must stay ASCII
  $gi = [IO.File]::ReadAllText((Join-Path $script:ProjectRoot '.gitignore'), [Text.Encoding]::UTF8)
  if ($gi -notmatch "(?m)^/$([char]0x5099)$([char]0x4EFD)/") { $notIgnored += 'backup folder' }
  if ($notIgnored.Count -gt 0) { return 'not ignored: ' + ($notIgnored -join ', ') }
  $tracked = @((Invoke-Native 'git' @('-C', $script:ProjectRoot, 'ls-files')).Out -split "`n" | Where-Object { $_ -match '(^|/)config\.json$|\.sqlite$|\.pem$|(^|/)\.env$' })
  if ($tracked.Count -gt 0) { return 'tracked private files: ' + ($tracked -join ', ') }
  $true
}

Complete-Checks '03-git'
