# Fix double-encoded UTF-8
$root = Join-Path $PSScriptRoot ".." "frontend\src"
$root = (Resolve-Path $root).Path
$files = Get-ChildItem -Path $root -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.css,*.html,*.json,*.md
$fixedFiles = @()
$utf8 = New-Object System.Text.UTF8Encoding($false)
$latin1 = [System.Text.Encoding]::GetEncoding("iso-8859-1")

foreach ($f in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    $text = $utf8.GetString($bytes)
    
    # Check for signatures of double encoding
    if ($text -match "[Ã][\u0080-\u00BF]" -or $text -match "[â][\u0080-\u00BF][\u0080-\u00BF]") {
        $recoveredBytes = $latin1.GetBytes($text)
        [System.IO.File]::WriteAllBytes($f.FullName, $recoveredBytes)
        $fixedFiles += $f.FullName
        Write-Host "Fixed: $($f.FullName)"
    }
}
Write-Host "Total fixed: $($fixedFiles.Count)"
