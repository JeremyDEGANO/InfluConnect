# Fix double-encoded UTF-8 (mojibake) in frontend source files.
# Detects files containing typical mojibake markers and rewrites them
# by reading as UTF-8 string, re-encoding as Latin1 bytes, then
# decoding back as UTF-8 -> restores the original characters.

$ErrorActionPreference = "Stop"
$root = Join-Path $PSScriptRoot ".." "frontend\src"
$root = (Resolve-Path $root).Path

$markers = @('Ã©','Ã¨','Ã ','Ã§','Ãª','Ã®','Ã´','Ã»','Ã¹','â‚¬','â€™','â€œ','â€','Ã‰','Ãˆ')

$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.css,*.html,*.json,*.md
$fixed = 0
$enc   = New-Object System.Text.UTF8Encoding($false) # no BOM

foreach ($f in $files) {
  $text = [System.IO.File]::ReadAllText($f.FullName, $enc)
  $hit = $false
  foreach ($m in $markers) { if ($text.Contains($m)) { $hit = $true; break } }
  if (-not $hit) { continue }

  try {
    $bytes   = [System.Text.Encoding]::GetEncoding(1252).GetBytes($text)
    $repaired = [System.Text.Encoding]::UTF8.GetString($bytes)
  } catch {
    Write-Warning "Skip (decode error): $($f.FullName)"
    continue
  }

  if ($repaired -ne $text) {
    [System.IO.File]::WriteAllText($f.FullName, $repaired, $enc)
    $fixed++
    Write-Host "fixed: $($f.FullName.Substring($root.Length+1))"
  }
}
Write-Host ""
Write-Host "Total files repaired: $fixed"

