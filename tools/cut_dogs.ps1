. (Join-Path $PSScriptRoot "slicerlib.ps1")
Add-Type -AssemblyName System.Drawing

$dst = Join-Path $PSScriptRoot "..\assets\sprites"
$size = 96
$pad  = 4

# Породы собак. Рамки — с запасом, точные границы посчитает ContentBox.
# Все собаки на листах смотрят ВПРАВО — как и ждёт игра.
#
# wait — поза «потеряла котика, ждёт у коробки». У бигля это «сидит»,
# у бультерьера позы сидя нет, берём стойку — смысл тот же.
$breeds = @(
  @{
    id  = "beagle"
    src = "..\images\Dog.png"
    cuts = @(
      @{n="run_0"; r=@(94,115,364,302)}
      @{n="run_1"; r=@(541,115,373,291)}
      @{n="run_2"; r=@(988,118,380,293)}
      @{n="run_3"; r=@(1453,111,372,319)}
      @{n="run_4"; r=@(1917,110,356,318)}
      @{n="run_5"; r=@(2352,119,366,312)}
      @{n="wait";  r=@(534,1096,291,355)}
    )
  }
  @{
    id  = "bull"
    src = "..\images\dog_2.png"
    cuts = @(
      @{n="run_0"; r=@(71,94,422,352)}
      @{n="run_1"; r=@(517,86,425,360)}
      @{n="run_2"; r=@(963,84,444,350)}
      @{n="run_3"; r=@(1432,93,421,376)}
      @{n="run_4"; r=@(1901,82,399,367)}
      @{n="run_5"; r=@(2324,90,403,379)}
      @{n="wait";  r=@(94,564,422,421)}
    )
  }
)

foreach ($b in $breeds) {
  [Slicer]::Load((Join-Path $PSScriptRoot $b.src))
  [Slicer]::FloodBackground()

  # Проход 1: меряем саму собаку в каждом кадре
  foreach ($c in $b.cuts) {
    $r = $c.r
    $box = [Slicer]::ContentBox($r[0], $r[1], $r[0]+$r[2]-1, $r[1]+$r[3]-1)
    $c.box = $box
    $c.w = $box[2]-$box[0]+1
    $c.h = $box[3]-$box[1]+1
  }

  # Общий масштаб на всю породу: иначе каждый кадр вписывается в свой квадрат
  # по-своему, и собака ПУЛЬСИРУЕТ в размере прямо на бегу.
  $maxW = ($b.cuts | ForEach-Object { $_.w } | Measure-Object -Maximum).Maximum
  $maxH = ($b.cuts | ForEach-Object { $_.h } | Measure-Object -Maximum).Maximum
  $inner = $size - $pad*2
  $scale = [Math]::Min($inner / $maxW, $inner / $maxH)
  ""
  "=== {0}: масштаб {1:N4} (самый крупный кадр {2}x{3}) ===" -f $b.id, $scale, $maxW, $maxH

  foreach ($c in $b.cuts) {
    $box = $c.box
    $name = "dog_" + $b.id + "_" + $c.n
    $p = Join-Path $dst ($name + ".png")
    [Slicer]::Save($p, $box[0], $box[1], $box[2], $box[3], $size, $pad, $false, [float]$scale)
    "{0,-18} собака {1,3}x{2,-3} -> {3,3}x{4,-3}  {5,5:N1} КБ" -f `
      $name, $c.w, $c.h, [int]($c.w*$scale), [int]($c.h*$scale), ((Get-Item $p).Length/1KB)
  }

  # Контактный лист породы
  $cell = 96
  $sheet = New-Object System.Drawing.Bitmap(($b.cuts.Count*$cell), $cell)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 120, 140, 120))
  for ($i=0; $i -lt $b.cuts.Count; $i++) {
    $im = [System.Drawing.Image]::FromFile((Join-Path $dst ("dog_" + $b.id + "_" + $b.cuts[$i].n + ".png")))
    $g.DrawImage($im, $i*$cell, 0, $cell, $cell); $im.Dispose()
  }
  $g.Dispose()
  $out = Join-Path $PSScriptRoot ("_preview_dog_" + $b.id + ".png")
  $sheet.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
  "контактный лист: $out"
}
