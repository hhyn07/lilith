# Run every feature check and print a summary.
# Usage: powershell -ExecutionPolicy Bypass -File run-all-checks.ps1
$root = $PSScriptRoot
$summary = @()
Get-ChildItem $root -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'check.ps1') } | Sort-Object Name | ForEach-Object {
  Write-Host ''
  Write-Host ('### ' + $_.Name) -ForegroundColor Cyan
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $_.FullName 'check.ps1')
  $summary += [pscustomobject]@{ Feature = $_.Name; Failed = $LASTEXITCODE }
}
Write-Host ''
Write-Host '### Summary' -ForegroundColor Cyan
$summary | Format-Table -AutoSize | Out-String | Write-Host
$total = ($summary | Measure-Object -Property Failed -Sum).Sum
exit $total
