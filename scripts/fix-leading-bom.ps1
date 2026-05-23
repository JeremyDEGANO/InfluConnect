# Remove leading '?' or other corrupt characters from TypeScript/JavaScript files

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\frontend\src")).Path
$encUtf8 = New-Object System.Text.UTF8Encoding($false)

$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx
$fixed = 0

foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, $encUtf8)
    
    # Remove leading '?' or other BOM-like characters
    if ($text.StartsWith("?")) {
        $text = $text.Substring(1)
        [System.IO.File]::WriteAllText($f.FullName, $text, $encUtf8)
        $fixed++
        Write-Host "fixed: $($f.FullName.Substring($root.Length+1))"
    }
}

Write-Host ""
Write-Host "Total files repaired: $fixed"
