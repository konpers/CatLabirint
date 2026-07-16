# Рисует найденные рамки с номерами поверх исходника -> одно превью для выбора.
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot "slicerlib.ps1")

$img = $args[0]
$minArea = [int]$args[1]
$outPath = $args[2]

[Slicer]::Load($img)
[Slicer]::FloodBackground()
$boxes = @([Slicer]::Components($minArea) | Sort-Object { $_[1] }, { $_[0] })

$bmp = New-Object System.Drawing.Bitmap($img)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 4)
$font = New-Object System.Drawing.Font("Arial", 34, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Yellow)
$shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)

for ($i = 0; $i -lt $boxes.Count; $i++) {
  $b = $boxes[$i]
  $g.DrawRectangle($pen, $b[0], $b[1], ($b[2]-$b[0]), ($b[3]-$b[1]))
  $g.DrawString("$i", $font, $shadow, $b[0]+4, $b[1]+2)
  $g.DrawString("$i", $font, $brush, $b[0]+1, $b[1])
}
$g.Dispose()
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
"превью: $outPath  рамок: $($boxes.Count)"
$boxes | ForEach-Object -Begin { $i = 0 } -Process {
  "{0}|{1}|{2}|{3}|{4}" -f $i, $_[0], $_[1], ($_[2]-$_[0]+1), ($_[3]-$_[1]+1)
  $i++
}
