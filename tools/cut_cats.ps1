. (Join-Path $PSScriptRoot "slicerlib.ps1")

$src = Join-Path $PSScriptRoot "..\images\Cat.png"
$dst = Join-Path $PSScriptRoot "..\assets\sprites"
[Slicer]::Load($src)
[Slicer]::FloodBackground()

# Рамки — с запасом: точные границы котика посчитает ContentBox.
# Все котики на листе смотрят ВПРАВО — как и ждёт игра.
#
# ⚠️ РЯДЫ КОНТАКТНОГО ЛИСТА НАРИСОВАНЫ В РАЗНОМ МАСШТАБЕ: нижний ряд заметно
# крупнее верхних. Поэтому ВСЕ позы ходьбы берём ИЗ ОДНОГО (нижнего) ряда —
# иначе Зефир и Дымок выходят мельче Уголька с Персиком (жалоба с теста).
#
# ⚠️ У Дымка в нижнем ряду ПРАВАЯ фигура испорчена: поверх шерсти впечатан
# полупрозрачный водяной знак-блик (~x 2480..2620). Берём ЛЕВУЮ.
$cuts = @(
  @{n="cat_ugolek_walk";  r=@(415,1160,280,376)}
  @{n="cat_ugolek_sit";   r=@(87,572,163,220)}
  @{n="cat_ugolek_sleep"; r=@(294,645,180,177)}

  @{n="cat_zefir_walk";   r=@(745,1160,300,376)}
  @{n="cat_zefir_sit";    r=@(774,560,205,250)}
  @{n="cat_zefir_sleep";  r=@(985,650,190,150)}

  @{n="cat_persik_walk";  r=@(1435,1160,300,376)}
  @{n="cat_persik_sit";   r=@(1455,571,245,250)}
  @{n="cat_persik_sleep"; r=@(1670,632,186,166)}

  @{n="cat_dymok_walk";   r=@(2085,1160,340,376)}
  @{n="cat_dymok_sit";    r=@(2153,563,165,231)}
  @{n="cat_dymok_sleep";  r=@(2347,645,201,224)}
)

$size = 96
$pad  = 4

# --- Проход 1: меряем КАЖДОГО котика (не рамку, а самого котика) ---
foreach ($c in $cuts) {
  $r = $c.r
  $b = [Slicer]::ContentBox($r[0], $r[1], $r[0]+$r[2]-1, $r[1]+$r[3]-1)
  $c.box = $b
  $c.w = $b[2]-$b[0]+1
  $c.h = $b[3]-$b[1]+1
}

# --- Общий масштаб на весь набор ---
# На контактном листе все котики нарисованы в одном масштабе. Если вписывать
# каждую позу в свой квадрат отдельно, пропорции ломаются: кот с поднятым
# хвостом становится мельче, а сидящий — крупнее идущего. Поэтому берём ОДИН
# коэффициент: по нему самый крупный котик впритык влезает в квадрат.
$maxW = ($cuts | ForEach-Object { $_.w } | Measure-Object -Maximum).Maximum
$maxH = ($cuts | ForEach-Object { $_.h } | Measure-Object -Maximum).Maximum
$box  = $size - $pad*2
$scale = [Math]::Min($box / $maxW, $box / $maxH)
"общий масштаб: {0:N4}  (самый крупный котик {1}x{2})" -f $scale, $maxW, $maxH
""

# --- Проход 2: режем всех одним масштабом ---
foreach ($c in $cuts) {
  $b = $c.box
  $p = Join-Path $dst ($c.n + ".png")
  [Slicer]::Save($p, $b[0], $b[1], $b[2], $b[3], $size, $pad, $false, [float]$scale)
  "{0,-22} котик {1,3}x{2,-3} -> на картинке {3,3}x{4,-3}  {5,6:N1} КБ" -f `
    $c.n, $c.w, $c.h, [int]($c.w*$scale), [int]($c.h*$scale), ((Get-Item $p).Length/1KB)
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
