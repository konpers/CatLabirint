Add-Type -AssemblyName System.Drawing
if (-not ("Slicer" -as [type])) {
$code = @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class Slicer {
  public static byte[] Px; public static int W, H; public static bool[] Bg;

  // Тона шашечного фона КАЛИБРУЮТСЯ по краям листа (там гарантированно фон).
  // Фиксированный диапазон не годится: у Cat.png тёмная клетка ~60, у новых
  // листов ~6, а часть тёмной шерсти персонажей нейтральна и совпадает по
  // яркости с одной из клеток. Адаптивные тоны + узкие полосы разделяют их.
  public static double DarkTone, LightTone, Band;
  public static int NeutralTol = 14;

  static bool IsNeutral(int r, int g, int b) {
    return Math.Abs(r-g) <= NeutralTol && Math.Abs(g-b) <= NeutralTol && Math.Abs(r-b) <= NeutralTol;
  }

  public static int Cell = 22; // размер клетки шашечки в пикселях (калибруется)

  // Есть ли в направлении (dx,dy) на расстоянии ~клетки пиксель тона tone.
  // Сканируем ДИАПАЗОН вокруг клетки, а не одну точку: период и фаза узора
  // слегка плавают, и жёсткая привязка пропускала фон в узких зазорах между
  // плотно бегущими фигурами. За краем листа — считаем фоном (рамка = фон).
  static bool NearToneDir(int x, int y, int dx, int dy, double tone) {
    for (int d = Cell - 4; d <= Cell + 4; d++) {
      int nx = x + dx * d, ny = y + dy * d;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return true;
      int i = (ny * W + nx) * 4;
      int b = Px[i], g = Px[i+1], r = Px[i+2];
      if (IsNeutral(r, g, b) && Math.Abs((r + g + b) / 3.0 - tone) <= Band) return true;
    }
    return false;
  }

  // Настоящая клетка фона окружена клетками ДРУГОГО тона: по горизонтали и
  // вертикали на расстоянии клетки сосед — противоположный тон. Внутри сплошной
  // шерсти этого нет, а граница чёрный/белый мех даёт «другой тон» лишь с ОДНОЙ
  // стороны — так внутренние края персонажа не выедаются, а фон распознаётся.
  static bool IsBackgroundAt(int x, int y) {
    int i = (y * W + x) * 4;
    int b = Px[i], g = Px[i+1], r = Px[i+2];
    if (!IsNeutral(r, g, b)) return false;
    double v = (r + g + b) / 3.0;
    bool dark = Math.Abs(v - DarkTone) <= Band;
    bool light = Math.Abs(v - LightTone) <= Band;
    if (!dark && !light) return false;
    double other = dark ? LightTone : DarkTone;

    int c = 0;
    if (NearToneDir(x, y, -1, 0, other)) c++;
    if (NearToneDir(x, y, 1, 0, other)) c++;
    if (NearToneDir(x, y, 0, -1, other)) c++;
    if (NearToneDir(x, y, 0, 1, other)) c++;
    // ≥2 стороны с противоположным тоном = регулярный узор (фон).
    // Кайма фона у контура (≥2 открытых стороны) съедается; внутренняя
    // граница меха (≤1 сторона) — нет.
    return c >= 2;
  }

  // Определяет тёмный и светлый тон фона по рамке шириной margin вдоль краёв.
  static void CalibrateBackground() {
    int margin = 6;
    var vs = new List<double>();
    for (int y = 0; y < H; y++) {
      for (int x = 0; x < W; x++) {
        if (x >= margin && x < W - margin && y >= margin && y < H - margin) continue;
        int i = (y * W + x) * 4;
        int b = Px[i], g = Px[i+1], r = Px[i+2];
        if (IsNeutral(r, g, b)) vs.Add((r + g + b) / 3.0);
      }
    }
    vs.Sort();
    if (vs.Count == 0) { DarkTone = 6; LightTone = 90; Band = 30; Cell = 22; return; }
    // Перцентили устойчивее среднего: 15-й = тёмная клетка, 85-й = светлая.
    DarkTone = vs[(int)(vs.Count * 0.15)];
    LightTone = vs[(int)(vs.Count * 0.85)];
    // Полоса — 42% промежутка между тонами (клетки не пересекаются),
    // но не уже 16 (плавные переходы на границах клеток тоже надо ловить).
    Band = Math.Max(16.0, (LightTone - DarkTone) * 0.42);
    Cell = MeasureCell();
  }

  // Размер клетки шашечки = период чередования тёмный/светлый по краевым строкам.
  // Калибруется, чтобы фильтр работал на любом листе (у Cat.png клетка иного
  // размера, чем у новых). Fallback 22.
  static int MeasureCell() {
    double thr = (DarkTone + LightTone) / 2.0;
    var periods = new List<int>();
    int[] rows = { 3, H / 2, H - 4 };
    foreach (int y in rows) {
      if (y < 0 || y >= H) continue;
      int last = -1, prevTone = -1;
      for (int x = 0; x < W; x++) {
        int i = (y * W + x) * 4;
        if (!IsNeutral(Px[i+2], Px[i+1], Px[i])) { prevTone = -1; continue; }
        double v = (Px[i+2] + Px[i+1] + Px[i]) / 3.0;
        int tone = v < thr ? 0 : 1;
        if (prevTone != -1 && tone != prevTone) {
          if (last != -1) { int d = x - last; if (d >= 8 && d <= 60) periods.Add(d); }
          last = x;
        }
        prevTone = tone;
      }
    }
    if (periods.Count < 4) return 22;
    periods.Sort();
    return periods[periods.Count / 2]; // медиана
  }

  // Базовый цвет клетки (без проверки узора) — для дочистки остаточных линий.
  static bool BaseChecker(int x, int y) {
    int i = (y * W + x) * 4;
    int b = Px[i], g = Px[i+1], r = Px[i+2];
    if (!IsNeutral(r, g, b)) return false;
    double v = (r + g + b) / 3.0;
    return Math.Abs(v - DarkTone) <= Band || Math.Abs(v - LightTone) <= Band;
  }

  // Дочистка: тонкие остаточные линии фона (цвет клетки, но узор не распознался
  // из-за фазы) окружены фоном. Красим их в фон, если ≥5 из 8 соседей — фон.
  // Мех цел: средне-серый мех не проходит BaseChecker, тёмный/светлый мех у
  // контура окружён мехом (мало Bg-соседей).
  static void CleanupBackground() {
    for (int iter = 0; iter < 6; iter++) {
      var add = new List<int>();
      for (int y = 0; y < H; y++) {
        for (int x = 0; x < W; x++) {
          int p = y * W + x;
          if (Bg[p]) continue;
          int i = p * 4;
          // Нейтральный пиксель, окружённый фоном, — это остаток фона или
          // антиалиас на границе клеток (яркость в «мёртвой зоне» между тонами).
          // Цветной мех не нейтрален и уцелеет; тёмный/светлый мех у контура
          // окружён мехом, а не фоном.
          if (!IsNeutral(Px[i+2], Px[i+1], Px[i])) continue;
          int c = 0;
          for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) continue;
            int nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H || Bg[ny * W + nx]) c++;
          }
          if (c >= 6) add.Add(p);
        }
      }
      if (add.Count == 0) break;
      foreach (int p in add) Bg[p] = true;
    }
  }

  public static void FloodBackground() {
    CalibrateBackground();
    Bg = new bool[W*H];
    var st = new Stack<int>();
    for (int x = 0; x < W; x++) { st.Push(x); st.Push((H-1)*W + x); }
    for (int y = 0; y < H; y++) { st.Push(y*W); st.Push(y*W + W-1); }
    while (st.Count > 0) {
      int p = st.Pop();
      if (p < 0 || p >= W*H || Bg[p]) continue;
      int x = p % W, y = p / W;
      if (!IsBackgroundAt(x, y)) continue;
      Bg[p] = true;
      if (x > 0) st.Push(p-1);
      if (x < W-1) st.Push(p+1);
      if (y > 0) st.Push(p-W);
      if (y < H-1) st.Push(p+W);
    }
    CleanupBackground();
  }

  public static List<int[]> Components(int minArea) {
    var seen = new bool[W*H];
    var outp = new List<int[]>();
    var st = new Stack<int>();
    for (int p0 = 0; p0 < W*H; p0++) {
      if (seen[p0] || Bg[p0]) continue;
      int minx=W, miny=H, maxx=0, maxy=0, area=0;
      st.Push(p0); seen[p0] = true;
      while (st.Count > 0) {
        int p = st.Pop();
        int x = p % W, y = p / W;
        area++;
        if (x<minx) minx=x; if (x>maxx) maxx=x;
        if (y<miny) miny=y; if (y>maxy) maxy=y;
        for (int dy=-1; dy<=1; dy++) for (int dx=-1; dx<=1; dx++) {
          int nx=x+dx, ny=y+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) continue;
          int np=ny*W+nx;
          if (seen[np]||Bg[np]) continue;
          seen[np]=true; st.Push(np);
        }
      }
      if (area >= minArea) outp.Add(new int[]{minx, miny, maxx, maxy, area});
    }
    return outp;
  }

  public static void Load(string path) {
    using (var bmp = new Bitmap(path)) {
      W = bmp.Width; H = bmp.Height;
      var data = bmp.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      Px = new byte[W*H*4];
      Marshal.Copy(data.Scan0, Px, 0, Px.Length);
      bmp.UnlockBits(data);
    }
  }

  // Внутри рамки оставляет только САМЫЙ КРУПНЫЙ связный объект.
  // Иначе в кадр попадает хвост соседнего котика с контактного листа.
  static bool[] LargestOnly(int x0, int y0, int w, int h) {
    var lab = new int[w*h];
    int best = 0, bestArea = 0, cur = 0;
    var st = new Stack<int>();
    for (int p0 = 0; p0 < w*h; p0++) {
      int sx0 = x0 + p0%w, sy0 = y0 + p0/w;
      if (lab[p0] != 0 || Bg[sy0*W+sx0]) continue;
      cur++; int area = 0;
      st.Push(p0); lab[p0] = cur;
      while (st.Count > 0) {
        int p = st.Pop(); area++;
        int x = p%w, y = p/w;
        for (int dy=-1; dy<=1; dy++) for (int dx=-1; dx<=1; dx++) {
          int nx=x+dx, ny=y+dy;
          if (nx<0||ny<0||nx>=w||ny>=h) continue;
          int np=ny*w+nx;
          if (lab[np]!=0 || Bg[(y0+ny)*W + (x0+nx)]) continue;
          lab[np]=cur; st.Push(np);
        }
      }
      if (area > bestArea) { bestArea = area; best = cur; }
    }
    var keep = new bool[w*h];
    for (int i = 0; i < w*h; i++) keep[i] = (lab[i] == best);
    return keep;
  }

  // Тесная рамка САМОГО персонажа внутри области (после отсева соседей).
  // Нужна потому, что рамка вырезки почти всегда с запасом: если масштабировать
  // по ней, котик с пустыми полями окажется мельче остальных (так и вышло с
  // Зефиром и Дымком).
  // @returns int[]{x0, y0, x1, y1} в координатах ИСХОДНОЙ картинки
  public static int[] ContentBox(int x0, int y0, int x1, int y1) {
    int w = x1-x0+1, h = y1-y0+1;
    var keep = LargestOnly(x0, y0, w, h);
    int minx=w, miny=h, maxx=-1, maxy=-1;
    for (int y=0; y<h; y++) for (int x=0; x<w; x++) {
      if (!keep[y*w+x]) continue;
      if (x<minx) minx=x; if (x>maxx) maxx=x;
      if (y<miny) miny=y; if (y>maxy) maxy=y;
    }
    if (maxx < 0) return new int[]{x0, y0, x1, y1}; // пусто — отдаём как есть
    return new int[]{ x0+minx, y0+miny, x0+maxx, y0+maxy };
  }

  // Вырезает область, убирает фон в прозрачность, вписывает в квадрат size x size.
  // flipX=true отражает по горизонтали (в игре персонаж смотрит вправо).
  //
  // scale > 0 — рисовать ИМЕННО в этом масштабе (общий для всех спрайтов набора,
  // чтобы сохранить пропорции исходника). scale <= 0 — вписать по рамке.
  public static void Save(string path, int x0, int y0, int x1, int y1, int size, int pad, bool flipX, float scale) {
    int w = x1-x0+1, h = y1-y0+1;
    var keep = LargestOnly(x0, y0, w, h);
    using (var crop = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
      var d = crop.LockBits(new Rectangle(0,0,w,h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      var buf = new byte[w*h*4];
      for (int y=0; y<h; y++) for (int x=0; x<w; x++) {
        int sx = x0+x, sy = y0+y;
        int di = (y*w+x)*4;
        if (sx<0||sy<0||sx>=W||sy>=H) { buf[di+3]=0; continue; }
        int src = sy*W + sx;
        if (Bg[src] || !keep[y*w+x]) { buf[di]=0; buf[di+1]=0; buf[di+2]=0; buf[di+3]=0; }
        else { buf[di]=Px[src*4]; buf[di+1]=Px[src*4+1]; buf[di+2]=Px[src*4+2]; buf[di+3]=255; }
      }
      Marshal.Copy(buf, 0, d.Scan0, buf.Length);
      crop.UnlockBits(d);
      if (flipX) crop.RotateFlip(RotateFlipType.RotateNoneFlipX);

      int box = size - pad*2;
      float sc = scale > 0 ? scale : Math.Min((float)box/w, (float)box/h);
      int nw = Math.Max(1,(int)(w*sc)), nh = Math.Max(1,(int)(h*sc));
      using (var outb = new Bitmap(size, size, PixelFormat.Format32bppArgb))
      using (var g = Graphics.FromImage(outb)) {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighQuality;
        g.DrawImage(crop, (size-nw)/2, size-pad-nh, nw, nh);
        outb.Save(path, ImageFormat.Png);
      }
    }
  }
}
"@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
}
