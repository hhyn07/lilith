# Feature 01: environment setup and startup
. (Join-Path $PSScriptRoot '..\_lib\common.ps1')

Test-Check 'ENV-1' 'Node.js >= 18 is installed' {
  $v = (& node -v).Trim()
  if ([int]($v.TrimStart('v').Split('.')[0]) -ge 18) { $true } else { "found $v" }
}

Test-Check 'ENV-2' 'bundled yarn 4.13.0 exists' {
  Test-Path (Join-Path $script:Hd '.yarn\releases\yarn-4.13.0.cjs')
}

Test-Check 'ENV-3' 'dependencies installed and sqlite3 native module loads' {
  if (-not (Test-Path (Join-Path $script:Hd 'node_modules'))) { return 'node_modules missing: run yarn install' }
  $r = Invoke-Native 'node' @('-e', 'require(''sqlite3''); console.log(''ok'')')
  if ($r.Out -eq 'ok') { $true } else { "sqlite3 failed: $($r.Out)" }
}

Test-Check 'ENV-4' 'config.json exists' {
  Test-Path (Join-Path $script:Hd 'config.json')
}

Test-Check 'ENV-5' 'frontend is built (public/build/index-pack*.js)' {
  $b = Get-ChildItem (Join-Path $script:Hd 'public\build') -Filter 'index-pack.*.js' -ErrorAction SilentlyContinue
  if ($b) { $true } else { 'no bundle: run webpack --config webpack.prod.js' }
}

Test-Check 'ENV-6' 'SQLite database file exists' {
  Test-Path (Join-Path $script:Hd 'db.hedgedoc.sqlite')
}

Test-Check 'ENV-7' 'server answers GET /status with 200' {
  if (Test-ServerUp) { $true } else { 'server not reachable on 127.0.0.1:3000: start it with node app.js' }
}

Test-Check 'ENV-8' 'all database migrations are applied' {
  $files = @(Get-ChildItem (Join-Path $script:Hd 'lib\migrations') -Filter '*.js').Count
  $rows = Invoke-NodeScript (Join-Path $PSScriptRoot '..\_lib\db-query.js') @('SELECT count(*) AS n FROM SequelizeMeta')
  $n = ($rows | ConvertFrom-Json)[0].n
  if ($n -eq $files) { $true } else { "SequelizeMeta has $n rows, lib/migrations has $files files" }
}

Complete-Checks '01-env'
