$reps = @(
  @('text-3xl font-bold text-gray-900','text-3xl font-semibold tracking-tight text-aurora-ink'),
  @('text-2xl font-bold text-gray-900','text-2xl font-semibold tracking-tight text-aurora-ink'),
  @('text-xl font-bold text-gray-900','text-xl font-semibold tracking-tight text-aurora-ink'),
  @('text-lg font-bold text-gray-900','text-lg font-semibold tracking-tight text-aurora-ink'),
  @('text-base font-bold text-gray-900','text-base font-semibold tracking-tight text-aurora-ink'),
  @('text-sm font-bold text-gray-900','text-sm font-semibold text-aurora-ink'),
  @('font-bold text-gray-900','font-semibold text-aurora-ink'),
  @('text-3xl font-bold','text-3xl font-semibold tracking-tight'),
  @('text-2xl font-bold','text-2xl font-semibold tracking-tight'),
  @('text-xl font-bold','text-xl font-semibold tracking-tight'),
  @('text-gray-900','text-aurora-ink'),
  @('text-gray-800','text-aurora-ink'),
  @('text-gray-700','text-aurora-ink-2'),
  @('text-gray-600','text-aurora-ink-2'),
  @('text-gray-500','text-aurora-ink-3'),
  @('text-gray-400','text-aurora-ink-3'),
  @('bg-gray-50','bg-aurora-surface'),
  @('bg-gray-100','bg-aurora-surface'),
  @('border-gray-200','border-aurora-line'),
  @('border-gray-100','border-aurora-line'),
  @('hover:bg-gray-50','hover:bg-aurora-surface'),
  @('hover:bg-gray-100','hover:bg-aurora-surface'),
  @('text-slate-900','text-aurora-ink'),
  @('text-slate-700','text-aurora-ink-2'),
  @('text-slate-600','text-aurora-ink-2'),
  @('text-slate-500','text-aurora-ink-3'),
  @('text-slate-400','text-aurora-ink-3'),
  @('border-slate-200','border-aurora-line'),
  @('border-slate-100','border-aurora-line'),
  @('bg-slate-50','bg-aurora-surface'),
  @('bg-slate-100','bg-aurora-surface'),
  @('hover:bg-slate-50','hover:bg-aurora-surface'),
  @('text-neutral-900','text-aurora-ink'),
  @('text-neutral-700','text-aurora-ink-2'),
  @('text-neutral-600','text-aurora-ink-2'),
  @('text-neutral-500','text-aurora-ink-3'),
  @('text-neutral-400','text-aurora-ink-3'),
  @('border-neutral-200','border-aurora-line'),
  @('border-neutral-100','border-aurora-line'),
  @('bg-neutral-50','bg-aurora-surface'),
  @('bg-neutral-100','bg-aurora-surface'),
  @('hover:bg-neutral-50','hover:bg-aurora-surface')
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
