# Локальный сервер для разработки: на этой машине нет ни Node, ни Python,
# а открыть игру по file:// нельзя (браузер запретит модули и Service Worker).
#
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1
# Затем открой http://localhost:8080/?nosw
#
# Ещё умеет принимать POST /upload?name=x.png — этим игра шлёт сюда свои кадры
# (см. CLAUDE.md, раздел про снятие скриншотов).
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$shots = Join-Path $PSScriptRoot "_shots"
New-Item -ItemType Directory -Force -Path $shots | Out-Null
$prefix = "http://localhost:8080/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"; ".png" = "image/png"; ".mp3" = "audio/mpeg"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")

    if ($req.HttpMethod -eq "POST" -and $req.Url.AbsolutePath -eq "/upload") {
      $name = $req.QueryString["name"]
      if (-not $name) { $name = "shot.png" }
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      [System.IO.File]::WriteAllBytes((Join-Path $shots $name), $ms.ToArray())
      $b = [System.Text.Encoding]::UTF8.GetBytes("saved $name")
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
      $ctx.Response.Close()
      continue
    }

    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root ($path.TrimStart("/") -replace "/", "\")
    if (Test-Path $file -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentType = $ct
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes("404")
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
    $ctx.Response.Close()
  } catch { }
}
