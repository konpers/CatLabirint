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

  static bool IsChecker(int i) {
    int b = Px[i], g = Px[i+1], r = Px[i+2];
    // Шашечка строго нейтральная (R=G=B). Даже чёрный котик имеет синеватый
    // отлив, поэтому нейтральность — надёжный признак фона.
    if (Math.Abs(r-g) > 8 || Math.Abs(g-b) > 8 || Math.Abs(r-b) > 8) return false;
    int v = r;
    // Диапазон покрывает обе клетки (~60 и ~104) И плавные переходы между ними,
    // иначе на границах клеток остаются серые квадратики.
    return v >= 40 && v <= 128;
  }

  public static void FloodBackground() {
    Bg = new bool[W*H];
    var st = new Stack<int>();
    for (int x = 0; x < W; x++) { st.Push(x); st.Push((H-1)*W + x); }
    for (int y = 0; y < H; y++) { st.Push(y*W); st.Push(y*W + W-1); }
    while (st.Count > 0) {
      int p = st.Pop();
      if (p < 0 || p >= W*H || Bg[p]) continue;
      if (!IsChecker(p*4)) continue;
      Bg[p] = true;
      int x = p % W, y = p / W;
      if (x > 0) st.Push(p-1);
      if (x < W-1) st.Push(p+1);
      if (y > 0) st.Push(p-W);
      if (y < H-1) st.Push(p+W);
    }
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

  // Вырезает область, убирает фон в прозрачность, вписывает в квадрат size x size.
  // flipX=true отражает по горизонтали (в игре персонаж смотрит вправо).
  public static void Save(string path, int x0, int y0, int x1, int y1, int size, int pad, bool flipX) {
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
      float sc = Math.Min((float)box/w, (float)box/h);
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
