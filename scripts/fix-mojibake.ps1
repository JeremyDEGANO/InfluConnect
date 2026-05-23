# Fix double-encoded UTF-8 (mojibake) in frontend source files.
# Reads as UTF-8, re-encodes as Windows-1252 bytes, then re-decodes as UTF-8.
# Detection is done at the BYTE level to avoid encoding issues in the script
# itself: a file is mojibake if its bytes contain the sequence 0xC3 0x83
# (which is the UTF-8 encoding of U+00C3 "Ã", the typical marker of a
# double-encoded UTF-8 stream).

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\frontend\src")
$root = $root.Path

$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.css,*.html,*.json,*.md
$enc1252 = [System.Text.Encoding]::GetEncoding(1252)
$encUtf8 = New-Object System.Text.UTF8Encoding($false)
$fixed = 0

foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
  if ($bytes.Length -lt 2) { continue }

  # Look for 0xC3 followed by 0x83 (the UTF-8 sequence for U+00C3).
  $hasMarker = $false
  for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
    if ($bytes[$i] -eq 0xC3 -and $bytes[$i+1] -eq 0x83) { $hasMarker = $true; break }
  }
  # Also check for 0xC3 followed by 0xA2 (a-circumflex) which is the lead
  # for sequences like "euro sign" mojibake.
  if (-not $hasMarker) {
    for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
      if ($bytes[$i] -eq 0xC3 -and $bytes[$i+1] -eq 0xA2) { $hasMarker = $true; break }
    }
  }
  if (-not $hasMarker) { continue }

  try {
    $text     = $encUtf8.GetString($bytes)
    $reBytes  = $enc1252.GetBytes($text)
    $repaired = $encUtf8.GetString($reBytes)
  } catch {
    Write-Warning "Skip (decode error): $($f.FullName)"
    continue
  }

  # Sanity: the repaired text must not contain U+FFFD replacement chars
  if ($repaired.Contains([char]0xFFFD)) {
    Write-Warning "Skip (replacement chars after repair): $($f.FullName)"
    continue
  }

  if ($repaired -ne $text) {
    [System.IO.File]::WriteAllText($f.FullName, $repaired, $encUtf8)
    $fixed++
    $rel = $f.FullName.Substring($root.Length + 1)
    Write-Host "fixed: $rel"
  }
}
Write-Host ""
Write-Host "Total files repaired: $fixed"
