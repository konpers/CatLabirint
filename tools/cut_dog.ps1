. (Join-Path $PSScriptRoot "slicerlib.ps1")

$src = Join-Path $PSScriptRoot "..\images\Dog.png"
$dst = Join-Path $PSScriptRoot "..\assets\sprites"
[Slicer]::Load($src)
[Slicer]::FloodBackground()

# Цикл бега — 6 кадров верхнего ряда, слева направо (собака смотрит вправо).
$cuts = @(
  @{n="dog_run_0"; r=@(94,115,364,302)}
  @{n="dog_run_1"; r=@(541,115,373,291)}
  @{n="dog_run_2"; r=@(988,118,380,293)}
  @{n="dog_run_3"; r=@(1453,111,372,319)}
  @{n="dog_run_4"; r=@(1917,110,356,318)}
  @{n="dog_run_5"; r=@(2352,119,366,312)}
  # Сидит — показываем, когда котик спрятался и собака его потеряла
  @{n="dog_sit";   r=@(534,1096,291,355)}
)

foreach ($c in $cuts) {
  $r = $c.r
  $p = Join-Path $dst ($c.n + ".png")
  [Slicer]::Save($p, $r[0], $r[1], $r[0]+$r[2]-1, $r[1]+$r[3]-1, 96, 4, $false)
  "{0,-12} {1,6:N1} KB" -f $c.n, ((Get-Item $p).Length/1KB)
}

Add-Type -AssemblyName System.Drawing
$cell = 96
$sheet = New-Object System.Drawing.Bitmap(($cuts.Count*$cell), $cell)
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(255, 120, 140, 120))
for ($i=0; $i -lt $cuts.Count; $i++) {
  $im = [System.Drawing.Image]::FromFile((Join-Path $dst ($cuts[$i].n + ".png")))
  $g.DrawImage($im, $i*$cell, 0, $cell, $cell); $im.Dispose()
}
$g.Dispose()
$out = Join-Path $PSScriptRoot "_preview_dog.png"
$sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
"контактный лист: $out"
