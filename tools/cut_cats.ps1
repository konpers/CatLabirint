. (Join-Path $PSScriptRoot "slicerlib.ps1")

$src = Join-Path $PSScriptRoot "..\images\Cat.png"
$dst = Join-Path $PSScriptRoot "..\assets\sprites"
[Slicer]::Load($src)
[Slicer]::FloodBackground()

# x0,y0,w,h взяты из автодетекта рамок; для Зефира — вручную (его позы слиплись).
# Все котики на листе смотрят ВПРАВО — как и ждёт игра.
$cuts = @(
  @{n="cat_ugolek_walk";  r=@(431,1198,264,268)}
  @{n="cat_ugolek_sit";   r=@(87,572,163,220)}
  @{n="cat_ugolek_sleep"; r=@(294,645,180,177)}

  @{n="cat_zefir_walk";   r=@(781,211,205,282)}
  @{n="cat_zefir_sit";    r=@(774,560,205,250)}
  @{n="cat_zefir_sleep";  r=@(985,650,190,150)}

  @{n="cat_persik_walk";  r=@(1455,1209,245,269)}
  @{n="cat_persik_sit";   r=@(1455,571,245,250)}
  @{n="cat_persik_sleep"; r=@(1670,632,186,166)}

  # НЕ берём Дымка из нижнего ряда: там поверх котика впечатан
  # полупрозрачный "блик"-водяной знак, отделить его от шерсти невозможно.
  @{n="cat_dymok_walk";   r=@(2551,824,265,253)}
  @{n="cat_dymok_sit";    r=@(2153,563,165,231)}
  @{n="cat_dymok_sleep";  r=@(2347,645,201,224)}
)

foreach ($c in $cuts) {
  $r = $c.r
  $p = Join-Path $dst ($c.n + ".png")
  [Slicer]::Save($p, $r[0], $r[1], $r[0]+$r[2]-1, $r[1]+$r[3]-1, 96, 4, $false)
  "{0,-22} {1,7:N1} KB" -f $c.n, ((Get-Item $p).Length/1KB)
}

# Контактный лист результатов — чтобы проверить глазами одним взглядом
Add-Type -AssemblyName System.Drawing
$cols = 3; $rows = 4; $cell = 96
$sheet = New-Object System.Drawing.Bitmap(($cols*$cell), ($rows*$cell))
$g = [System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.Color]::FromArgb(255, 120, 140, 120))
$i = 0
foreach ($c in $cuts) {
  $im = [System.Drawing.Image]::FromFile((Join-Path $dst ($c.n + ".png")))
  $g.DrawImage($im, ($i % $cols)*$cell, [int][Math]::Floor($i/$cols)*$cell, $cell, $cell)
  $im.Dispose(); $i++
}
$g.Dispose()
$out = Join-Path $PSScriptRoot "_preview_cats.png"
$sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
"контактный лист: $out"
