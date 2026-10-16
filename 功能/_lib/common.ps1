# Shared helpers for the per-feature check.ps1 scripts.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less files as ANSI.

$ErrorActionPreference = 'Stop'

$script:ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:Hd = Join-Path $script:ProjectRoot 'hedgedoc-1x'
$script:BaseUrl = 'http://127.0.0.1:3000'
$script:Results = New-Object System.Collections.ArrayList

# Run one check. The body returns:
#   $true            -> PASS
#   'WARN: message'  -> WARN (does not fail the run)
#   anything else    -> FAIL (the value is shown as the reason)
function Test-Check {
  param([string]$Id, [string]$Name, [scriptblock]$Body)
  $status = 'FAIL'
  $detail = ''
  try {
    $r = & $Body
    if ($r -is [array]) { $r = $r[-1] }
    if ($r -eq $true) { $status = 'PASS' }
    elseif ($r -is [string] -and $r.StartsWith('WARN:')) { $status = 'WARN'; $detail = $r.Substring(5).Trim() }
    else { $detail = [string]$r }
  } catch {
    $detail = $_.Exception.Message
  }
  $color = @{ PASS = 'Green'; WARN = 'Yellow'; FAIL = 'Red' }[$status]
  $line = "[$status] $Id $Name"
  if ($detail) { $line += "  -- $detail" }
  Write-Host $line -ForegroundColor $color
  [void]$script:Results.Add([pscustomobject]@{ Id = $Id; Name = $Name; Status = $status; Detail = $detail })
}

function Complete-Checks {
  param([string]$Feature)
  $fail = @($script:Results | Where-Object Status -eq 'FAIL').Count
  $warn = @($script:Results | Where-Object Status -eq 'WARN').Count
  $pass = @($script:Results | Where-Object Status -eq 'PASS').Count
  Write-Host ("== {0}: {1} pass, {2} warn, {3} fail" -f $Feature, $pass, $warn, $fail)
  exit $fail
}

# HTTP helper using curl.exe (no redirects followed). Returns code, location, body.
function Invoke-Http {
  param([string]$Path, [string]$Method = 'GET', [string]$Data = $null)
  $tmp = [IO.Path]::GetTempFileName()
  try {
    $curlArgs = @('-s', '-o', $tmp, '-w', '%{http_code} %{redirect_url}', '-X', $Method, "$script:BaseUrl$Path")
    if ($Data) { $curlArgs += @('-d', $Data) }
    $out = & curl.exe @curlArgs
    $parts = "$out".Split(' ', 2)
    $body = [IO.File]::ReadAllText($tmp, [Text.Encoding]::UTF8)
    return [pscustomobject]@{ Code = [int]$parts[0]; Location = $(if ($parts.Count -gt 1) { $parts[1] } else { '' }); Body = $body }
  } finally {
    Remove-Item $tmp -ErrorAction SilentlyContinue
  }
}

function Test-ServerUp {
  try { return (Invoke-Http '/status').Code -eq 200 } catch { return $false }
}

function Read-Utf8 {
  param([string]$RelPath)
  return [IO.File]::ReadAllText((Join-Path $script:Hd $RelPath), [Text.Encoding]::UTF8)
}

# Decisions hhyn made that the checks should follow (e.g. registration open or closed).
function Get-Policy {
  return [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'policy.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
}

function Get-DevConfig {
  $json = Read-Utf8 'config.json' | ConvertFrom-Json
  return $json.development
}

# Run a native command inside hedgedoc-1x. Returns exit code and combined output.
# Windows PowerShell 5.1 turns native stderr lines into ErrorRecords; with
# ErrorActionPreference=Stop a harmless warning on stderr would throw, so the
# preference is relaxed to Continue for the duration of the call.
function Invoke-Native {
  param([string]$Exe, [string[]]$Arguments = @())
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  Push-Location $script:Hd
  try {
    $out = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Out = (($out -join "`n").Trim()) }
  } finally {
    Pop-Location
    $ErrorActionPreference = $prev
  }
}

# Run a node script file inside hedgedoc-1x and return its output (trimmed).
function Invoke-NodeScript {
  param([string]$ScriptPath, [string[]]$Arguments = @())
  return (Invoke-Native 'node' (@($ScriptPath) + $Arguments)).Out
}

function Invoke-Git {
  param([string[]]$Arguments)
  return Invoke-Native 'git' (@('-C', $script:Hd) + $Arguments)
}
