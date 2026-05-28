# Drop UI reference PNGs into dev/screenshots/ui — this script copies them into game-captures with dates.
$devUi = Join-Path $PSScriptRoot "..\..\dev\screenshots\ui"
$devCap = Join-Path $PSScriptRoot "..\..\dev\screenshots\game-captures"
$stamp = Get-Date -Format "yyyy-MM-dd"

foreach ($dir in @($devUi, $devCap)) {
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
}

Get-ChildItem $devUi -Filter "*.png" -ErrorAction SilentlyContinue | ForEach-Object {
  $dest = Join-Path $devCap "$stamp-$($_.Name)"
  Copy-Item $_.FullName $dest -Force
  Write-Host "Archived $($_.Name) -> $dest"
}

Write-Host "Done. UI refs stay in: $devUi"
