# Нарезка 9 новых ПЛАТНЫХ персонажей (по одному на лист, 2784x1504).
# Раскладка листа одинакова: 6 кадров бега (верх) + 2 стойки (средний ряд) +
# 2 позы (нижний ряд). Ячейки задаём общими зонами, ContentBox уточняет фигуру.
#
# Игроки  -> формат котика: cat_<id>_walk|sit|sleep (одиночные кадры, общий масштаб).
# Враги   -> формат собаки: dog_<id>_run_0..5 + dog_<id>_wait (общий масштаб).

. (Join-Path $PSScriptRoot "slicerlib.ps1")
Add-Type -AssemblyName System.Drawing

$img = Join-Path $PSScriptRoot "..\images"
$dst = Join-Path $PSScriptRoot "..\assets\sprites"
$size = 96; $pad = 4

# Зоны ячеек (x,y,w,h) — общие для всех листов, с запасом. ContentBox сузит.
$MidL = @(40,555,540,435)    # средний ряд, левая стойка
$MidR = @(610,555,640,435)   # средний ряд, правая стойка
$BotL = @(115,985,490,515)   # нижний ряд, левая поза
$BotR = @(700,985,480,515)   # нижний ряд, правая поза
$Top  = @(65,12,2660,478)    # верхний ряд бега целиком (делится на 6)

# --- Игроки: какая ячейка идёт в какую позу ---
$players = @(
  @{ id='bengal';    file='player_cat_bengal';      walk=$MidL; sit=$BotL; sleep=$BotR }
  # у корниша нижний-левый = глаза закрыты (sleep), нижний-правый = сидит (sit)
  @{ id='cornish';   file='player_cat_cornish_rex'; walk=$MidL; sit=$BotR; sleep=$BotL }
  # у мейн-куна и колли позы сидя нет — простой берём из стоек/бега
  @{ id='mainecoon'; file='player_cat_mainecoon';   walk=$MidL; sit=$MidR; sleep=$BotL }
  @{ id='kolli';     file='player_dog_borderkolli'; walk=$MidL; sit=$MidR; sleep=$BotL }
)

$enemies = @(
  @{ id='bear_black'; file='attack_bear_black'; wait=$MidR }
  @{ id='bear_brown'; file='attack_bear_brown'; wait=$MidR }
  @{ id='bear_white'; file='attack_bear_white'; wait=$MidR }
  @{ id='pitbull';    file='attack_dog_peabull'; wait=$MidR }
  @{ id='shepherd';   file='attack_dog_shepherd'; wait=$MidR }
)

function BoxOf($zone) {
  # ContentBox для зоны (x,y,w,h) -> уточнённая рамка фигуры
  return [Slicer]::ContentBox($zone[0], $zone[1], $zone[0]+$zone[2]-1, $zone[1]+$zone[3]-1)
}

function CommonScale($boxes) {
  # Один масштаб на весь набор: самый крупный кадр впритык влезает в квадрат.
  $maxW = ($boxes | ForEach-Object { $_[2]-$_[0]+1 } | Measure-Object -Maximum).Maximum
  $maxH = ($boxes | ForEach-Object { $_[3]-$_[1]+1 } | Measure-Object -Maximum).Maximum
  $inner = $size - $pad*2
  return [Math]::Min($inner / $maxW, $inner / $maxH)
}

# ---------- ИГРОКИ ----------
foreach ($p in $players) {
  [Slicer]::Load((Join-Path $img ($p.file + '.png')))
  [Slicer]::FloodBackground()
  $walk = BoxOf $p.walk; $sit = BoxOf $p.sit; $sleep = BoxOf $p.sleep
  $scale = CommonScale @($walk, $sit, $sleep)
  foreach ($pose in @(@('walk',$walk), @('sit',$sit), @('sleep',$sleep))) {
    $b = $pose[1]
    $out = Join-Path $dst ("cat_" + $p.id + "_" + $pose[0] + ".png")
    [Slicer]::Save($out, $b[0],$b[1],$b[2],$b[3], $size, $pad, $false, [float]$scale)
  }
  "игрок {0,-10}: масштаб {1:N3}" -f $p.id, $scale
}

# ---------- ВРАГИ ----------
foreach ($e in $enemies) {
  [Slicer]::Load((Join-Path $img ($e.file + '.png')))
  [Slicer]::FloodBackground()
  # 6 кадров бега из верхнего ряда: делим по X, каждый уточняем ContentBox
  $runBoxes = @()
  $wc = $Top[2] / 6.0
  for ($i=0; $i -lt 6; $i++) {
    $a = [int]($Top[0] + $i*$wc)
    $b = [int]($Top[0] + ($i+1)*$wc) - 1
    $runBoxes += ,([Slicer]::ContentBox($a, $Top[1], $b, $Top[1]+$Top[3]-1))
  }
  $wait = BoxOf $e.wait
  $scale = CommonScale ($runBoxes + ,$wait)
  for ($i=0; $i -lt 6; $i++) {
    $b = $runBoxes[$i]
    [Slicer]::Save((Join-Path $dst ("dog_" + $e.id + "_run_" + $i + ".png")), $b[0],$b[1],$b[2],$b[3], $size, $pad, $false, [float]$scale)
  }
  [Slicer]::Save((Join-Path $dst ("dog_" + $e.id + "_wait.png")), $wait[0],$wait[1],$wait[2],$wait[3], $size, $pad, $false, [float]$scale)
  "враг  {0,-10}: масштаб {1:N3}" -f $e.id, $scale
}

# --- Контактные листы для визуальной проверки ---
function Strip($names, $out) {
  $cell = 96
  $sheet = New-Object System.Drawing.Bitmap(($names.Count*$cell), $cell)
  $g = [System.Drawing.Graphics]::FromImage($sheet)
  $g.Clear([System.Drawing.Color]::FromArgb(255,120,140,120))
  for ($i=0; $i -lt $names.Count; $i++) {
    $f = Join-Path $dst ($names[$i] + '.png')
    if (Test-Path $f) { $im=[System.Drawing.Image]::FromFile($f); $g.DrawImage($im,$i*$cell,0,$cell,$cell); $im.Dispose() }
  }
  $g.Dispose(); $sheet.Save($out,[System.Drawing.Imaging.ImageFormat]::Png); $sheet.Dispose()
}
$sh = Join-Path $PSScriptRoot "_shots"
Strip @('cat_bengal_walk','cat_bengal_sit','cat_bengal_sleep','cat_cornish_walk','cat_cornish_sit','cat_cornish_sleep','cat_mainecoon_walk','cat_mainecoon_sit','cat_mainecoon_sleep','cat_kolli_walk','cat_kolli_sit','cat_kolli_sleep') "$sh\_new_players.png"
Strip @('dog_bear_black_run_0','dog_bear_brown_run_0','dog_bear_white_run_0','dog_pitbull_run_0','dog_shepherd_run_0','dog_bear_black_wait','dog_bear_brown_wait','dog_bear_white_wait','dog_pitbull_wait','dog_shepherd_wait') "$sh\_new_enemies.png"
Strip @('dog_shepherd_run_0','dog_shepherd_run_1','dog_shepherd_run_2','dog_shepherd_run_3','dog_shepherd_run_4','dog_shepherd_run_5','dog_shepherd_wait') "$sh\_shepherd_run.png"
"контактные листы готовы"
