$ErrorActionPreference = 'Stop'
$reps = @(
  # H1: bump 2xl → 3xl for consistency with Aurora mockup
  @('text-2xl font-semibold tracking-tight text-aurora-ink','text-3xl font-semibold tracking-tight text-aurora-ink'),
  # Common cards / pills polish (mockup signatures)
  @('rounded-lg border border-aurora-line bg-white','rounded-2xl border border-aurora-line bg-white'),
  # Subtle tag pill
  @('px-2 py-1 rounded-full bg-aurora-surface text-aurora-ink-3 text-xs','px-2 py-0.5 rounded-full bg-aurora-surface text-aurora-ink-3 text-xs font-medium')
)
$files = Get-ChildItem -Path "frontend/src/pages","frontend/src/components/shared" -Recurse -Include *.tsx,*.ts
$count = 0
foreach ($f in $files) {
  $c = Get-Content $f.FullName -Raw
  $o = $c
  foreach ($p in $reps) { $c = $c.Replace($p[0], $p[1]) }
  if ($c -ne $o) {
    Set-Content -Path $f.FullName -Value $c -NoNewline -Encoding UTF8
    $count++
  }
}
Write-Host "Modified: $count"
