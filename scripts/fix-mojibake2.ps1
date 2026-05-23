# Repair mojibake by substituting known double-encoded sequences with the
# correct character. All special characters in this script are referenced by
# Unicode codepoint so the script source itself stays pure ASCII.

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\frontend\src")).Path

# Build mapping: mojibake string -> correct character (longest first matters!)
$map = @(
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x2122); to = [char]0x2019 }   # ’
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x0153); to = [char]0x201C }   # “
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x009D); to = [char]0x201D }   # ”
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x009C); to = [char]0x201C }   # “
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x00A6); to = [char]0x2026 }   # …
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x201C); to = [char]0x2014 }   # —
    @{ from = ([char]0x00E2 + [char]0x20AC + [char]0x201D); to = [char]0x2013 }   # –
    @{ from = ([char]0x00E2 + [char]0x201A + [char]0x00AC); to = [char]0x20AC }   # €
    @{ from = ([char]0x00C3 + [char]0x00A9); to = [char]0x00E9 }                  # é
    @{ from = ([char]0x00C3 + [char]0x00A8); to = [char]0x00E8 }                  # è
    @{ from = ([char]0x00C3 + [char]0x00AA); to = [char]0x00EA }                  # ê
    @{ from = ([char]0x00C3 + [char]0x00AB); to = [char]0x00EB }                  # ë
    @{ from = ([char]0x00C3 + [char]0x00A0); to = [char]0x00E0 }                  # à
    @{ from = ([char]0x00C3 + [char]0x00A2); to = [char]0x00E2 }                  # â
    @{ from = ([char]0x00C3 + [char]0x00A4); to = [char]0x00E4 }                  # ä
    @{ from = ([char]0x00C3 + [char]0x00A7); to = [char]0x00E7 }                  # ç
    @{ from = ([char]0x00C3 + [char]0x00AE); to = [char]0x00EE }                  # î
    @{ from = ([char]0x00C3 + [char]0x00AF); to = [char]0x00EF }                  # ï
    @{ from = ([char]0x00C3 + [char]0x00B4); to = [char]0x00F4 }                  # ô
    @{ from = ([char]0x00C3 + [char]0x00B6); to = [char]0x00F6 }                  # ö
    @{ from = ([char]0x00C3 + [char]0x00B9); to = [char]0x00F9 }                  # ù
    @{ from = ([char]0x00C3 + [char]0x00BB); to = [char]0x00FB }                  # û
    @{ from = ([char]0x00C3 + [char]0x00BC); to = [char]0x00FC }                  # ü
    @{ from = ([char]0x00C3 + [char]0x00B1); to = [char]0x00F1 }                  # ñ
    @{ from = ([char]0x00C3 + [char]0x2030); to = [char]0x00C9 }                  # É
    @{ from = ([char]0x00C3 + [char]0x02C6); to = [char]0x00C8 }                  # È
    @{ from = ([char]0x00C3 + [char]0x20AC); to = [char]0x00C0 }                  # À
    @{ from = ([char]0x00C3 + [char]0x2021); to = [char]0x00C7 }                  # Ç
)

$encUtf8 = New-Object System.Text.UTF8Encoding($false)
$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.css,*.html,*.json,*.md
$fixed = 0

foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, $encUtf8)
    $orig = $text
    foreach ($entry in $map) {
        if ($text.Contains($entry.from)) {
            $text = $text.Replace($entry.from, [string]$entry.to)
        }
    }
    if ($text -ne $orig) {
        [System.IO.File]::WriteAllText($f.FullName, $text, $encUtf8)
        $fixed++
        Write-Host "fixed: $($f.FullName.Substring($root.Length+1))"
    }
}
Write-Host ""
Write-Host "Total files repaired: $fixed"
