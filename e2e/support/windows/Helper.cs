using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;

// Helper de teste do Windows: roda num PowerShell persistente (Add-Type), le um comando JSON por linha
// da entrada padrao e responde uma linha JSON (ASCII) na saida padrao. Compativel com C# 5 (csc do .NET Framework).

[StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
[StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Sequential)] public struct HARDWAREINPUT { public uint uMsg; public ushort wParamL; public ushort wParamH; }
[StructLayout(LayoutKind.Explicit)] public struct InputUnion {
  [FieldOffset(0)] public MOUSEINPUT mi;
  [FieldOffset(0)] public KEYBDINPUT ki;
  [FieldOffset(0)] public HARDWAREINPUT hi;
}
[StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public InputUnion u; }

public static class Nativo {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code, uint type);
  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder sb, int max);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint mensagem, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr dialogo, int id);
  [DllImport("user32.dll")] public static extern IntPtr GetOpenClipboardWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageTimeoutW")] public static extern IntPtr SendMessageTimeoutTexto(IntPtr h, uint msg, IntPtr w, string l, uint flags, uint tempo, out IntPtr resultado);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr pai, EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint msg, IntPtr w, StringBuilder l, uint flags, uint tempo, out IntPtr resultado);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern uint GetLongPathName(string curto, StringBuilder longo, uint tamanho);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  [DllImport("user32.dll", SetLastError = true)] public static extern bool OpenClipboard(IntPtr dono);
  [DllImport("user32.dll", SetLastError = true)] public static extern bool CloseClipboard();
  [DllImport("user32.dll", SetLastError = true)] public static extern bool EmptyClipboard();
  [DllImport("user32.dll")] public static extern uint EnumClipboardFormats(uint formato);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClipboardFormatName(uint formato, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern uint RegisterClipboardFormat(string nome);
  [DllImport("user32.dll")] public static extern IntPtr GetClipboardData(uint formato);
  [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetClipboardData(uint formato, IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalAlloc(uint flags, UIntPtr bytes);
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalFree(IntPtr h);
  [DllImport("kernel32.dll")] public static extern IntPtr GlobalLock(IntPtr h);
  [DllImport("kernel32.dll")] public static extern bool GlobalUnlock(IntPtr h);
  [DllImport("kernel32.dll")] public static extern UIntPtr GlobalSize(IntPtr h);

  public static string Texto(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, sb.Capacity); return sb.ToString(); }
  public static string Classe(IntPtr h) { var sb = new StringBuilder(256); GetClassName(h, sb, sb.Capacity); return sb.ToString(); }
  public static uint Pid(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p; }
}

public static class Arg {
  public static string S(Dictionary<string, object> a, string k, string padrao) {
    object v; return (a != null && a.TryGetValue(k, out v) && v != null) ? Convert.ToString(v) : padrao;
  }
  public static int I(Dictionary<string, object> a, string k, int padrao) {
    object v; return (a != null && a.TryGetValue(k, out v) && v != null) ? Convert.ToInt32(v) : padrao;
  }
  public static bool B(Dictionary<string, object> a, string k, bool padrao) {
    object v; return (a != null && a.TryGetValue(k, out v) && v != null) ? Convert.ToBoolean(v) : padrao;
  }
  public static Dictionary<string, object> D(Dictionary<string, object> a, string k) {
    object v; return (a != null && a.TryGetValue(k, out v)) ? v as Dictionary<string, object> : null;
  }
  public static object[] L(Dictionary<string, object> a, string k) {
    object v; return (a != null && a.TryGetValue(k, out v)) ? v as object[] : null;
  }
  public static Dictionary<string, object> Rect(RECT r) {
    var d = new Dictionary<string, object>();
    d["x"] = r.Left; d["y"] = r.Top; d["largura"] = r.Right - r.Left; d["altura"] = r.Bottom - r.Top;
    return d;
  }
}

// ---------------------------------------------------------------- entrada real (SendInput)
public static class Entrada {
  const uint KEYEVENTF_EXTENDEDKEY = 0x1, KEYEVENTF_KEYUP = 0x2, KEYEVENTF_UNICODE = 0x4;
  const uint MOUSEEVENTF_MOVE = 0x1, MOUSEEVENTF_LEFTDOWN = 0x2, MOUSEEVENTF_LEFTUP = 0x4, MOUSEEVENTF_RIGHTDOWN = 0x8,
    MOUSEEVENTF_RIGHTUP = 0x10, MOUSEEVENTF_WHEEL = 0x800, MOUSEEVENTF_VIRTUALDESK = 0x4000, MOUSEEVENTF_ABSOLUTE = 0x8000;
  static readonly int[] MODIFICADORES = new int[] { 0x10, 0x11, 0x12, 0x5B, 0x5C, 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5 };

  static void Enviar(INPUT[] entradas) {
    uint n = Nativo.SendInput((uint)entradas.Length, entradas, Marshal.SizeOf(typeof(INPUT)));
    if (n != entradas.Length) throw new Exception("SendInput enviou " + n + " de " + entradas.Length + " eventos (erro " + Marshal.GetLastWin32Error() + ").");
  }

  static INPUT Teclado(ushort vk, ushort scan, uint flags) {
    var i = new INPUT(); i.type = 1; i.u.ki.wVk = vk; i.u.ki.wScan = scan; i.u.ki.dwFlags = flags; return i;
  }

  static bool Estendida(ushort vk) {
    return (vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E || vk == 0x5B || vk == 0x5C;
  }

  static void Tecla(ushort vk, bool baixo) {
    uint flags = baixo ? 0u : KEYEVENTF_KEYUP;
    if (Estendida(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
    ushort scan = (ushort)Nativo.MapVirtualKey(vk, 0);
    Enviar(new INPUT[] { Teclado(vk, scan, flags) });
  }

  static ushort Modificador(string nome) {
    switch (nome.ToLowerInvariant()) {
      case "ctrl": case "control": return 0x11;
      case "alt": return 0x12;
      case "shift": return 0x10;
      case "win": case "meta": return 0x5B;
    }
    throw new Exception("Modificador desconhecido: " + nome);
  }

  static ushort VkDe(string nome) {
    string n = nome.ToLowerInvariant();
    switch (n) {
      case "enter": case "return": return 0x0D;
      case "esc": case "escape": return 0x1B;
      case "tab": return 0x09;
      case "space": case "espaco": return 0x20;
      case "backspace": return 0x08;
      case "delete": case "del": return 0x2E;
      case "insert": return 0x2D;
      case "home": return 0x24;
      case "end": return 0x23;
      case "pageup": return 0x21;
      case "pagedown": return 0x22;
      case "left": return 0x25;
      case "up": return 0x26;
      case "right": return 0x27;
      case "down": return 0x28;
    }
    int fn;
    if (n.Length >= 2 && n[0] == 'f' && int.TryParse(n.Substring(1), out fn) && fn >= 1 && fn <= 24) return (ushort)(0x6F + fn);
    if (nome.Length == 1) {
      char c = char.ToUpperInvariant(nome[0]);
      if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) return (ushort)c;
      short r = Nativo.VkKeyScan(nome[0]);
      if (r != -1) return (ushort)(r & 0xFF);
    }
    throw new Exception("Tecla desconhecida: " + nome);
  }

  /// <summary>Combinacao como "Alt+Q", "Ctrl+V", "Esc": modificadores abaixo, tecla, tudo solto em ordem inversa.</summary>
  public static void Combinacao(string combo) {
    string[] partes = combo.Split('+');
    var mods = new List<ushort>();
    ushort tecla = 0;
    for (int i = 0; i < partes.Length; i++) {
      string nome = partes[i].Trim();
      if (i < partes.Length - 1) mods.Add(Modificador(nome)); else tecla = VkDe(nome);
    }
    var abaixo = new List<ushort>();
    try {
      foreach (ushort m in mods) { Tecla(m, true); abaixo.Add(m); Thread.Sleep(20); }
      Tecla(tecla, true); Thread.Sleep(20); Tecla(tecla, false); Thread.Sleep(20);
    } finally {
      for (int i = abaixo.Count - 1; i >= 0; i--) { Tecla(abaixo[i], false); Thread.Sleep(10); }
    }
  }

  /// <summary>Texto Unicode caractere a caractere (KEYEVENTF_UNICODE); a quebra de linha vira Enter.</summary>
  public static void Digitar(string texto, int atrasoMs) {
    foreach (char c in texto) {
      if (c == '\r') continue;
      if (c == '\n') { Combinacao("Enter"); }
      else {
        Enviar(new INPUT[] { Teclado(0, c, KEYEVENTF_UNICODE), Teclado(0, c, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP) });
      }
      if (atrasoMs > 0) Thread.Sleep(atrasoMs);
    }
  }

  public static bool EsperarModificadoresSoltos(int limiteMs) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(limiteMs);
    while (true) {
      bool algum = false;
      foreach (int vk in MODIFICADORES) if ((Nativo.GetAsyncKeyState(vk) & 0x8000) != 0) algum = true;
      if (!algum) return true;
      if (DateTime.UtcNow > fim) return false;
      Thread.Sleep(20);
    }
  }

  /// <summary>Solta qualquer modificador que tenha ficado preso por uma falha no meio de uma combinacao.</summary>
  public static void SoltarModificadores() {
    foreach (int vk in new int[] { 0x10, 0x11, 0x12, 0x5B }) {
      if ((Nativo.GetAsyncKeyState(vk) & 0x8000) != 0) Tecla((ushort)vk, false);
    }
  }

  static INPUT Mouse(uint flags, int dx, int dy, uint dados) {
    var i = new INPUT(); i.type = 0; i.u.mi.dx = dx; i.u.mi.dy = dy; i.u.mi.mouseData = dados; i.u.mi.dwFlags = flags; return i;
  }

  public static Dictionary<string, object> Posicao() {
    POINT p; Nativo.GetCursorPos(out p);
    var d = new Dictionary<string, object>(); d["x"] = p.X; d["y"] = p.Y; return d;
  }

  /// <summary>Move o cursor por um evento absoluto (gera WM_MOUSEMOVE de verdade), em pixels fisicos da area virtual.</summary>
  public static void Mover(int x, int y) {
    int vx = Nativo.GetSystemMetrics(76), vy = Nativo.GetSystemMetrics(77), vw = Nativo.GetSystemMetrics(78), vh = Nativo.GetSystemMetrics(79);
    int dx = (int)Math.Round((x - vx) * 65535.0 / (vw - 1));
    int dy = (int)Math.Round((y - vy) * 65535.0 / (vh - 1));
    Enviar(new INPUT[] { Mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, dx, dy, 0) });
    Thread.Sleep(30);
    POINT p; Nativo.GetCursorPos(out p);
    if (Math.Abs(p.X - x) > 2 || Math.Abs(p.Y - y) > 2) { Nativo.SetCursorPos(x, y); Thread.Sleep(30); }
  }

  static void Botao(bool direito, bool baixo) {
    uint f = direito ? (baixo ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP) : (baixo ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP);
    Enviar(new INPUT[] { Mouse(f, 0, 0, 0) });
  }

  public static void Clicar(int x, int y, bool direito, int vezes) {
    Mover(x, y);
    for (int i = 0; i < vezes; i++) {
      Botao(direito, true); Thread.Sleep(40); Botao(direito, false); Thread.Sleep(60);
    }
  }

  /// <summary>Arrasta com o botao esquerdo, em passos, para o alvo do arrasto receber os movimentos intermediarios.</summary>
  public static void Arrastar(int x1, int y1, int x2, int y2, int passos) {
    Mover(x1, y1); Thread.Sleep(80);
    Botao(false, true); Thread.Sleep(120);
    try {
      for (int i = 1; i <= passos; i++) { Mover(x1 + (x2 - x1) * i / passos, y1 + (y2 - y1) * i / passos); Thread.Sleep(30); }
      Thread.Sleep(150);
    } finally { Botao(false, false); }
    Thread.Sleep(100);
  }

  public static void Rolar(int delta) { Enviar(new INPUT[] { Mouse(MOUSEEVENTF_WHEEL, 0, 0, unchecked((uint)delta)) }); }

  public static void ToqueNeutro() {
    // F24 (VK 0x87): conta como entrada do usuario para liberar o SetForegroundWindow, sem efeito nos programas.
    Tecla(0x87, true); Tecla(0x87, false);
  }
}

// ---------------------------------------------------------------- janelas
public static class Janelas {
  public static List<object> Listar(uint pidFiltro, bool soVisiveis) {
    var lista = new List<object>();
    IntPtr primeiro = Nativo.GetForegroundWindow();
    Nativo.EnumWindows(delegate(IntPtr h, IntPtr l) {
      uint pid = Nativo.Pid(h);
      bool visivel = Nativo.IsWindowVisible(h);
      if ((pidFiltro != 0 && pid != pidFiltro) || (soVisiveis && !visivel)) return true;
      lista.Add(Descrever(h, primeiro));
      return true;
    }, IntPtr.Zero);
    return lista;
  }

  public static Dictionary<string, object> Descrever(IntPtr h, IntPtr primeiro) {
    RECT r; Nativo.GetWindowRect(h, out r);
    var d = new Dictionary<string, object>();
    d["hwnd"] = h.ToInt64(); d["pid"] = (int)Nativo.Pid(h); d["titulo"] = Nativo.Texto(h); d["classe"] = Nativo.Classe(h);
    d["visivel"] = Nativo.IsWindowVisible(h); d["minimizada"] = Nativo.IsIconic(h); d["primeiroPlano"] = (h == primeiro);
    d["retangulo"] = Arg.Rect(r);
    return d;
  }


  /// <summary>Traz qualquer janela ao primeiro plano (AttachThreadInput, depois um toque neutro) e confirma.</summary>
  public static bool Focar(IntPtr hwnd) {
    for (int tentativa = 0; tentativa < 6; tentativa++) {
      if (Nativo.GetForegroundWindow() == hwnd) break;
      if (Nativo.IsIconic(hwnd)) Nativo.ShowWindow(hwnd, 9);
      IntPtr atual = Nativo.GetForegroundWindow();
      uint fioAtual = 0; uint ignorado;
      if (atual != IntPtr.Zero) fioAtual = Nativo.GetWindowThreadProcessId(atual, out ignorado);
      uint meu = Nativo.GetCurrentThreadId();
      bool ligado = fioAtual != 0 && fioAtual != meu && Nativo.AttachThreadInput(meu, fioAtual, true);
      try { Nativo.BringWindowToTop(hwnd); Nativo.SetForegroundWindow(hwnd); }
      finally { if (ligado) Nativo.AttachThreadInput(meu, fioAtual, false); }
      Thread.Sleep(120);
      if (Nativo.GetForegroundWindow() == hwnd) break;
      if (tentativa >= 1) { Entrada.ToqueNeutro(); Nativo.SetForegroundWindow(hwnd); Thread.Sleep(150); }
    }
    return Nativo.GetForegroundWindow() == hwnd;
  }

  public static Dictionary<string, object> PrimeiroPlano() {
    IntPtr h = Nativo.GetForegroundWindow();
    return h == IntPtr.Zero ? null : Descrever(h, h);
  }
}

// ---------------------------------------------------------------- janela alvo (WinForms numa thread STA propria)
public static class Alvo {
  static Form form; static TextBox caixa; static Thread fio; static IntPtr hwnd = IntPtr.Zero;

  static T Na<T>(Func<T> f) {
    if (form == null) throw new Exception("A janela alvo nao esta aberta.");
    return (T)form.Invoke(f);
  }

  public static Dictionary<string, object> Abrir(int x, int y, int largura, int altura, string titulo) {
    if (form != null) Fechar();
    var pronto = new ManualResetEvent(false);
    Exception falha = null;
    fio = new Thread(delegate() {
      try {
        Application.EnableVisualStyles();
        var f = new Form();
        f.Text = titulo; f.StartPosition = FormStartPosition.Manual; f.Bounds = new Rectangle(x, y, largura, altura);
        var c = new TextBox();
        c.Multiline = true; c.AcceptsReturn = true; c.AcceptsTab = true; c.WordWrap = true; c.ScrollBars = ScrollBars.Vertical;
        c.Dock = DockStyle.Fill; c.Font = new Font("Consolas", 12f);
        f.Controls.Add(c); f.ActiveControl = c;
        f.Shown += delegate { hwnd = f.Handle; pronto.Set(); };
        form = f; caixa = c;
        Application.Run(f);
      } catch (Exception e) { falha = e; pronto.Set(); }
    });
    fio.SetApartmentState(ApartmentState.STA); fio.IsBackground = true; fio.Start();
    if (!pronto.WaitOne(15000) || falha != null) throw new Exception("Nao foi possivel abrir a janela alvo: " + (falha != null ? falha.Message : "tempo esgotado"));
    return Posicao();
  }

  public static Dictionary<string, object> Posicao() {
    return Na<Dictionary<string, object>>(delegate() {
      RECT r; Nativo.GetWindowRect(hwnd, out r);
      Point origem = caixa.PointToScreen(Point.Empty);
      var d = new Dictionary<string, object>();
      d["hwnd"] = hwnd.ToInt64(); d["pid"] = (int)Nativo.Pid(hwnd); d["titulo"] = form.Text;
      d["retangulo"] = Arg.Rect(r);
      var cl = new Dictionary<string, object>();
      cl["x"] = origem.X; cl["y"] = origem.Y; cl["largura"] = caixa.Width; cl["altura"] = caixa.Height;
      d["caixa"] = cl;
      d["emPrimeiroPlano"] = Nativo.GetForegroundWindow() == hwnd;
      return d;
    });
  }

  /// <summary>Traz a janela alvo ao primeiro plano e foca a caixa de texto.</summary>
  public static bool Focar() {
    if (form == null) throw new Exception("A janela alvo nao esta aberta.");
    bool ok = Janelas.Focar(hwnd);
    if (ok) Na<bool>(delegate() { form.Activate(); caixa.Focus(); return true; });
    return ok;
  }

  public static void Limpar() { Na<bool>(delegate() { caixa.Clear(); return true; }); }
  public static string Ler() { return Na<string>(delegate() { return caixa.Text; }); }
  public static void Escrever(string texto) { Na<bool>(delegate() { caixa.Text = texto; return true; }); }

  public static void Fechar() {
    if (form == null) return;
    try { form.Invoke((Action)delegate() { form.Close(); }); } catch (Exception) { }
    if (fio != null) fio.Join(5000);
    form = null; caixa = null; fio = null; hwnd = IntPtr.Zero;
  }
}

// ---------------------------------------------------------------- clipboard (API nativa, formato por formato)
public static class Clip {
  const uint CF_TEXT = 1, CF_BITMAP = 2, CF_METAFILEPICT = 3, CF_PALETTE = 9, CF_DIB = 8, CF_UNICODETEXT = 13, CF_ENHMETAFILE = 14, CF_DIBV5 = 17;
  static NativeWindow dono;
  public static readonly uint HTML = Nativo.RegisterClipboardFormat("HTML Format");
  public static readonly uint RTF = Nativo.RegisterClipboardFormat("Rich Text Format");
  public static readonly uint PNG = Nativo.RegisterClipboardFormat("PNG");
  public static readonly uint SENSIVEL = Nativo.RegisterClipboardFormat("ExcludeClipboardContentFromMonitorProcessing");

  // OpenClipboard(NULL) deixaria o dono nulo e SetClipboardData falharia: usa uma janela oculta como dono.
  static IntPtr Dono() {
    if (dono == null) { var n = new NativeWindow(); n.CreateHandle(new CreateParams()); dono = n; }
    return dono.Handle;
  }

  sealed class Sessao : IDisposable {
    public Sessao() {
      IntPtr d = Dono();
      // Outro programa (monitor de clipboard, o proprio CSTM ao copiar) pode segurar o clipboard por instantes: tenta por ~5 s.
      for (int i = 0; i < 100; i++) { if (Nativo.OpenClipboard(d)) return; Thread.Sleep(50); }
      throw new Exception("Nao foi possivel abrir o clipboard em 5 s: outro programa o esta usando (" + QuemUsa() + ").");
    }
    public void Dispose() { Nativo.CloseClipboard(); }
  }

  /// <summary>Quem esta com o clipboard aberto agora (processo, classe e titulo da janela), para o relatorio do erro.</summary>
  static string QuemUsa() {
    try {
      IntPtr w = Nativo.GetOpenClipboardWindow();
      if (w == IntPtr.Zero) return "sem dono de janela identificavel";
      uint pid = Nativo.Pid(w); string nome = "?";
      try { nome = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
      return nome + ", pid " + pid + ", classe " + Nativo.Classe(w) + ", titulo \"" + Nativo.Texto(w) + "\"";
    } catch (Exception) { return "desconhecido"; }
  }

  static bool FormatoDeAlca(uint f) {
    // Formatos cujo dado nao e um bloco de memoria global (objetos GDI, metafile, exibicao do dono) ficam de fora.
    if (f == CF_BITMAP || f == CF_METAFILEPICT || f == CF_PALETTE || f == CF_ENHMETAFILE) return false;
    if (f >= 0x80 && f <= 0x8E) return false;
    if (f >= 0x200 && f <= 0x3FF) return false;
    return true;
  }

  static List<uint> Formatos() {
    var l = new List<uint>(); uint f = 0;
    while ((f = Nativo.EnumClipboardFormats(f)) != 0) l.Add(f);
    return l;
  }

  static string Nome(uint f) {
    switch (f) {
      case 1: return "CF_TEXT"; case 2: return "CF_BITMAP"; case 7: return "CF_OEMTEXT"; case 8: return "CF_DIB"; case 13: return "CF_UNICODETEXT";
      case 15: return "CF_HDROP"; case 16: return "CF_LOCALE"; case 17: return "CF_DIBV5";
    }
    var sb = new StringBuilder(256);
    return Nativo.GetClipboardFormatName(f, sb, sb.Capacity) > 0 ? sb.ToString() : ("CF_" + f);
  }

  static byte[] Bytes(uint f) {
    IntPtr h = Nativo.GetClipboardData(f);
    if (h == IntPtr.Zero) return null;
    UIntPtr tam = Nativo.GlobalSize(h);
    if (tam == UIntPtr.Zero) return null;
    IntPtr p = Nativo.GlobalLock(h);
    if (p == IntPtr.Zero) return null;
    try { var b = new byte[(int)tam]; Marshal.Copy(p, b, 0, b.Length); return b; }
    finally { Nativo.GlobalUnlock(h); }
  }

  static void Definir(uint f, byte[] dados) {
    IntPtr h = Nativo.GlobalAlloc(0x42, new UIntPtr((uint)dados.Length));
    if (h == IntPtr.Zero) throw new Exception("GlobalAlloc falhou.");
    IntPtr p = Nativo.GlobalLock(h);
    Marshal.Copy(dados, 0, p, dados.Length);
    Nativo.GlobalUnlock(h);
    if (Nativo.SetClipboardData(f, h) == IntPtr.Zero) { Nativo.GlobalFree(h); throw new Exception("SetClipboardData falhou para " + Nome(f) + "."); }
  }

  static byte[] ComTerminador(byte[] b, int nulos) { var r = new byte[b.Length + nulos]; Array.Copy(b, r, b.Length); return r; }

  static string AteNulo(string s) { int i = s.IndexOf('\0'); return i >= 0 ? s.Substring(0, i) : s; }

  static string Hex(byte[] b) {
    using (var sha = SHA1.Create()) { return BitConverter.ToString(sha.ComputeHash(b)).Replace("-", "").ToLowerInvariant(); }
  }

  public static uint Sequencia() { return Nativo.GetClipboardSequenceNumber(); }

  /// <summary>Resumo sem conteudo: formatos, tamanhos, dimensoes da imagem e o hash de cada formato (para comparar antes e depois).</summary>
  public static Dictionary<string, object> Resumo() {
    var r = new Dictionary<string, object>();
    using (new Sessao()) {
      r["sequencia"] = (long)Nativo.GetClipboardSequenceNumber();
      var formatos = Formatos();
      var nomes = new List<object>(); var hashes = new Dictionary<string, object>();
      foreach (uint f in formatos) {
        string nome = Nome(f); nomes.Add(nome);
        if (FormatoDeAlca(f)) { byte[] b = Bytes(f); if (b != null) hashes[nome] = Hex(b); }
      }
      r["formatos"] = nomes; r["hashes"] = hashes;
      if (formatos.Contains(CF_UNICODETEXT)) {
        byte[] b = Bytes(CF_UNICODETEXT);
        var t = new Dictionary<string, object>(); t["caracteres"] = b == null ? 0 : AteNulo(Encoding.Unicode.GetString(b)).Length; r["texto"] = t;
      } else r["texto"] = null;
      r["html"] = formatos.Contains(HTML); r["rtf"] = formatos.Contains(RTF); r["sensivel"] = formatos.Contains(SENSIVEL);
      r["imagem"] = InfoImagem(formatos);
    }
    return r;
  }

  static Dictionary<string, object> InfoImagem(List<uint> formatos) {
    int w = 0, h = 0; string formato = null;
    if (formatos.Contains(PNG)) {
      byte[] b = Bytes(PNG);
      if (b != null && b.Length > 24) { formato = "png"; w = (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]; h = (b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]; }
    }
    if (formato == null) {
      uint f = formatos.Contains(CF_DIBV5) ? CF_DIBV5 : CF_DIB;
      if (formatos.Contains(f)) {
        byte[] b = Bytes(f);
        if (b != null && b.Length > 12) { formato = "dib"; w = BitConverter.ToInt32(b, 4); h = Math.Abs(BitConverter.ToInt32(b, 8)); }
      }
    }
    if (formato == null) return null;
    var d = new Dictionary<string, object>(); d["formato"] = formato; d["largura"] = w; d["altura"] = h; return d;
  }

  public static string LerTexto() {
    using (new Sessao()) {
      if (!Formatos().Contains(CF_UNICODETEXT)) return null;
      byte[] b = Bytes(CF_UNICODETEXT);
      return b == null ? null : AteNulo(Encoding.Unicode.GetString(b));
    }
  }

  public static string LerHtml() {
    using (new Sessao()) {
      if (!Formatos().Contains(HTML)) return null;
      byte[] b = Bytes(HTML);
      return b == null ? null : AteNulo(Encoding.UTF8.GetString(b));
    }
  }

  public static string LerRtf() {
    using (new Sessao()) {
      if (!Formatos().Contains(RTF)) return null;
      byte[] b = Bytes(RTF);
      return b == null ? null : AteNulo(Encoding.GetEncoding(28591).GetString(b));
    }
  }

  public static void Esvaziar() {
    using (new Sessao()) { if (!Nativo.EmptyClipboard()) throw new Exception("EmptyClipboard falhou."); }
  }

  /// <summary>Envolve o fragmento no cabecalho "HTML Format" (CF_HTML 0.9) com os deslocamentos em bytes UTF-8.</summary>
  static string MontarHtml(string fragmento) {
    string antes = "<html><body>\r\n<!--StartFragment-->", depois = "<!--EndFragment-->\r\n</body></html>";
    string modelo = "Version:0.9\r\nStartHTML:{0:D10}\r\nEndHTML:{1:D10}\r\nStartFragment:{2:D10}\r\nEndFragment:{3:D10}\r\n";
    int cab = Encoding.UTF8.GetByteCount(string.Format(modelo, 0, 0, 0, 0));
    int tAntes = Encoding.UTF8.GetByteCount(antes), tFrag = Encoding.UTF8.GetByteCount(fragmento), tDepois = Encoding.UTF8.GetByteCount(depois);
    return string.Format(modelo, cab, cab + tAntes + tFrag + tDepois, cab + tAntes, cab + tAntes + tFrag) + antes + fragmento + depois;
  }

  static Bitmap MontarImagem(Dictionary<string, object> a) {
    string b64 = Arg.S(a, "pngBase64", null);
    if (b64 != null) { using (var ms = new MemoryStream(Convert.FromBase64String(b64))) { return new Bitmap(ms); } }
    int w = Arg.I(a, "largura", 64), h = Arg.I(a, "altura", 48);
    string cor = Arg.S(a, "cor", "#2D7DD2");
    var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) {
      g.Clear(ColorTranslator.FromHtml(cor));
      using (var caneta = new Pen(Color.Black, 2)) { g.DrawRectangle(caneta, 1, 1, w - 3, h - 3); g.DrawLine(caneta, 0, 0, w - 1, h - 1); }
    }
    return bmp;
  }

  static byte[] ParaDib(Bitmap bmp) {
    int w = bmp.Width, h = bmp.Height;
    var dados = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      int linha = w * 4;
      var dib = new byte[40 + linha * h];
      Array.Copy(BitConverter.GetBytes(40), 0, dib, 0, 4);
      Array.Copy(BitConverter.GetBytes(w), 0, dib, 4, 4);
      Array.Copy(BitConverter.GetBytes(h), 0, dib, 8, 4);
      dib[12] = 1; dib[14] = 32;
      Array.Copy(BitConverter.GetBytes(linha * h), 0, dib, 20, 4);
      var linhaTmp = new byte[linha];
      for (int y = 0; y < h; y++) {
        Marshal.Copy(new IntPtr(dados.Scan0.ToInt64() + (long)y * dados.Stride), linhaTmp, 0, linha);
        Array.Copy(linhaTmp, 0, dib, 40 + (h - 1 - y) * linha, linha);
      }
      return dib;
    } finally { bmp.UnlockBits(dados); }
  }

  /// <summary>Escreve texto, HTML (fragmento ou CF_HTML bruto), RTF, imagem (DIB e/ou PNG) e, se pedido, o formato sensivel.</summary>
  public static Dictionary<string, object> Escrever(Dictionary<string, object> a) {
    string texto = Arg.S(a, "texto", null), html = Arg.S(a, "html", null), htmlBruto = Arg.S(a, "htmlBruto", null), rtf = Arg.S(a, "rtf", null);
    Dictionary<string, object> img = Arg.D(a, "imagem");
    byte[] dib = null, png = null;
    if (img != null) {
      object[] fmts = Arg.L(img, "formatos");
      bool querDib = true, querPng = true;
      if (fmts != null) { querDib = Array.IndexOf(fmts, "dib") >= 0; querPng = Array.IndexOf(fmts, "png") >= 0; }
      using (Bitmap bmp = MontarImagem(img)) {
        if (querDib) dib = ParaDib(bmp);
        if (querPng) using (var ms = new MemoryStream()) { bmp.Save(ms, ImageFormat.Png); png = ms.ToArray(); }
      }
    }
    using (new Sessao()) {
      if (!Nativo.EmptyClipboard()) throw new Exception("EmptyClipboard falhou.");
      if (texto != null) Definir(CF_UNICODETEXT, ComTerminador(Encoding.Unicode.GetBytes(texto), 2));
      if (htmlBruto != null) Definir(HTML, ComTerminador(Encoding.UTF8.GetBytes(htmlBruto), 1));
      else if (html != null) Definir(HTML, ComTerminador(Encoding.UTF8.GetBytes(MontarHtml(html)), 1));
      if (rtf != null) Definir(RTF, ComTerminador(Encoding.GetEncoding(28591).GetBytes(rtf), 1));
      if (dib != null) Definir(CF_DIB, dib);
      if (png != null) Definir(PNG, png);
      if (Arg.B(a, "sensivel", false)) Definir(SENSIVEL, new byte[4]);
    }
    var r = new Dictionary<string, object>(); r["sequencia"] = (long)Nativo.GetClipboardSequenceNumber(); return r;
  }

  /// <summary>Copia bruta de todos os formatos de memoria global (texto, HTML, RTF, imagem, arquivos...), em base64.</summary>
  public static List<object> Salvar() {
    var lista = new List<object>();
    using (new Sessao()) {
      foreach (uint f in Formatos()) {
        if (!FormatoDeAlca(f)) continue;
        byte[] b = null;
        try { b = Bytes(f); } catch (Exception) { }
        if (b == null) continue;
        var d = new Dictionary<string, object>(); d["id"] = (long)f; d["nome"] = Nome(f); d["dados"] = Convert.ToBase64String(b);
        lista.Add(d);
      }
    }
    return lista;
  }

  public static Dictionary<string, object> Restaurar(object[] formatos) {
    int ok = 0, falhas = 0;
    using (new Sessao()) {
      if (!Nativo.EmptyClipboard()) throw new Exception("EmptyClipboard falhou.");
      if (formatos != null) {
        foreach (object o in formatos) {
          var d = (Dictionary<string, object>)o;
          try { Definir((uint)Convert.ToInt64(d["id"]), Convert.FromBase64String(Convert.ToString(d["dados"]))); ok++; } catch (Exception) { falhas++; }
        }
      }
    }
    var r = new Dictionary<string, object>(); r["restaurados"] = ok; r["falhas"] = falhas; return r;
  }
}

// ---------------------------------------------------------------- dialogos nativos de arquivo (UI Automation)
public static class Dialogo {
  const uint WM_CLOSE = 0x0010, BM_CLICK = 0x00F5;

  static List<IntPtr> Visiveis(uint pid) {
    var lista = new List<IntPtr>();
    Nativo.EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (Nativo.Pid(h) == pid && Nativo.IsWindowVisible(h) && Nativo.Classe(h) == "#32770") lista.Add(h);
      return true;
    }, IntPtr.Zero);
    return lista;
  }

  public static IntPtr Achar(uint pid) {
    var lista = Visiveis(pid);
    return lista.Count > 0 ? lista[0] : IntPtr.Zero;
  }

  public static IntPtr Esperar(uint pid, int limiteMs) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(limiteMs);
    while (DateTime.UtcNow < fim) {
      IntPtr h = Achar(pid);
      if (h != IntPtr.Zero) return h;
      Thread.Sleep(100);
    }
    return IntPtr.Zero;
  }

  /// <summary>Fecha todos os dialogos visiveis do processo (os de erro filhos primeiro): nunca deixar um modal aberto.</summary>
  public static int FecharTodos(uint pid) {
    int fechados = 0;
    for (int volta = 0; volta < 4; volta++) {
      var lista = Visiveis(pid);
      if (lista.Count == 0) break;
      lista.Reverse();
      foreach (IntPtr h in lista) { Nativo.PostMessage(h, WM_CLOSE, IntPtr.Zero, IntPtr.Zero); fechados++; }
      Thread.Sleep(400);
    }
    return fechados;
  }

  static AutomationElement PorId(AutomationElement raiz, string id) {
    return raiz.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.AutomationIdProperty, id));
  }

  /// <summary>Texto de um dialogo de mensagem (os elementos Text), para o relatorio do erro.</summary>
  static string TextoDe(IntPtr h) {
    var sb = new StringBuilder();
    try {
      foreach (AutomationElement e in AutomationElement.FromHandle(h).FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Text))) {
        string n = e.Current.Name;
        if (!string.IsNullOrEmpty(n)) sb.Append(n).Append(' ');
      }
    } catch (Exception) { }
    return sb.ToString().Trim();
  }

  /// <summary>Aciona o botao: Invoke; sem ele, BM_CLICK no HWND do botao (ou o item 1 do dialogo); sem HWND, Enter com o dialogo em primeiro plano.</summary>
  static void Clicar(AutomationElement botao, IntPtr dialogo) {
    object p;
    if (botao.TryGetCurrentPattern(InvokePattern.Pattern, out p)) {
      var inv = (InvokePattern)p;
      // Invoke pode bloquear enquanto um dialogo filho estiver aberto: roda numa thread e segue.
      var t = new Thread(delegate() { try { inv.Invoke(); } catch (Exception) { } });
      t.IsBackground = true; t.Start(); t.Join(1500);
      return;
    }
    IntPtr h = new IntPtr(botao.Current.NativeWindowHandle);
    if (h == IntPtr.Zero) h = Nativo.GetDlgItem(dialogo, 1);
    if (h != IntPtr.Zero) { Nativo.PostMessage(h, BM_CLICK, IntPtr.Zero, IntPtr.Zero); return; }
    Janelas.Focar(dialogo);
    Entrada.Combinacao("Enter");
  }

  /// <summary>Espera o dialogo fechar; se aparecer um dialogo de erro filho, fecha tudo e falha na hora com o texto dele.</summary>
  static void EsperarFechar(uint pid, IntPtr h, int limiteMs) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(limiteMs);
    while (DateTime.UtcNow < fim) {
      if (!Nativo.IsWindowVisible(h)) return;
      foreach (IntPtr outro in Visiveis(pid)) {
        if (outro == h) continue;
        string texto = TextoDe(outro);
        string titulo = Nativo.Texto(outro);
        FecharTodos(pid);
        throw new Exception("O Windows mostrou um dialogo de erro (\"" + titulo + "\"): " + texto);
      }
      Thread.Sleep(100);
    }
  }

  static AutomationElement[] CampoEBotao(AutomationElement raiz, int limiteMs, string titulo) {
    AutomationElement campo = null, botao = null;
    DateTime fim = DateTime.UtcNow.AddMilliseconds(Math.Min(limiteMs, 4000));
    while (DateTime.UtcNow < fim) {
      campo = PorId(raiz, "1148"); botao = PorId(raiz, "1");
      if (campo != null && botao != null) break;
      Thread.Sleep(150);
    }
    // Reserva: dialogos que nao expoem os ids classicos (1148 e 1) — primeiro campo de edicao e o botao pelo nome.
    if (campo == null) campo = raiz.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
    if (botao == null) {
      string[] nomes = new string[] { "abrir", "salvar", "selecionar pasta", "open", "save", "select folder" };
      foreach (AutomationElement b in raiz.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button))) {
        if (Array.IndexOf(nomes, (b.Current.Name ?? "").ToLowerInvariant()) >= 0) { botao = b; break; }
      }
    }
    if (campo == null || botao == null) throw new Exception("O dialogo \"" + titulo + "\" nao expos o campo de nome (1148) e o botao padrao (1).");
    return new AutomationElement[] { campo, botao };
  }

  /// <summary>COMException "operacao cancelada pelo usuario" (0x800704C7) ou elemento que sumiu: o dialogo fechou durante a chamada de UI Automation.</summary>
  static bool Cancelada(Exception e) {
    return (e is System.Runtime.InteropServices.COMException && e.HResult == unchecked((int)0x800704C7)) || e is ElementNotAvailableException;
  }

  /// <summary>Texto atual do campo (ValuePattern) ou null se nao der para ler.</summary>
  static string LerValor(AutomationElement campo) {
    object p;
    try {
      if (campo.TryGetCurrentPattern(ValuePattern.Pattern, out p)) return ((ValuePattern)p).Current.Value;
      var edit = campo.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
      if (edit != null && edit.TryGetCurrentPattern(ValuePattern.Pattern, out p)) return ((ValuePattern)p).Current.Value;
    } catch (Exception) { }
    return null;
  }

  // Limite interno de uma operacao de preenchimento: bem abaixo do tempo que o Node espera pela resposta.
  const int LIMITE_PREENCHER_MS = 10000;
  static volatile bool abortar;

  static void Checar() { if (abortar) throw new Exception("Operacao abortada por tempo."); }

  /// <summary>Se ha outro dialogo visivel alem do principal (caixa de erro, "Renomear", confirmacao): le o texto, fecha tudo e falha na hora.</summary>
  static void ErroModal(uint pid, IntPtr principal, string quando) {
    foreach (IntPtr outro in Visiveis(pid)) {
      if (outro == principal) continue;
      string texto = TextoDe(outro), titulo = Nativo.Texto(outro);
      FecharTodos(pid);
      throw new Exception("Havia uma caixa de dialogo (\"" + titulo + "\") " + quando + ": " + texto);
    }
  }

  static string Descricao(AutomationElement e) {
    try { return e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "") + " id=" + e.Current.AutomationId + " nome=\"" + e.Current.Name + "\""; }
    catch (Exception) { return "(ilegivel)"; }
  }

  static readonly char[] INVALIDOS = new char[] { '\\', '/', ':', '*', '?', '"', '<', '>', '|' };

  /// <summary>Nomes simples de arquivo: um nome, ou varios entre aspas ("a.txt" "b.txt"). Qualquer caractere de caminho invalida tudo.</summary>
  static void ValidarNomes(string entrada) {
    string resto = entrada.Trim();
    var nomes = new List<string>();
    if (resto.StartsWith("\"")) {
      var m = System.Text.RegularExpressions.Regex.Matches(resto, "\"([^\"]*)\"");
      string sobra = System.Text.RegularExpressions.Regex.Replace(resto, "\"[^\"]*\"", "").Trim();
      if (sobra.Length > 0) throw new Exception("Lista de nomes invalida: " + entrada);
      foreach (System.Text.RegularExpressions.Match x in m) nomes.Add(x.Groups[1].Value);
    } else nomes.Add(resto);
    if (nomes.Count == 0) throw new Exception("Nenhum nome de arquivo informado.");
    foreach (string n in nomes) {
      if (n.Length == 0 || n.IndexOfAny(INVALIDOS) >= 0) throw new Exception("O nome \"" + n + "\" tem caracteres de caminho: o campo Nome so recebe nomes simples (a pasta vem da barra de endereco).");
    }
  }

  /// <summary>Diagnostico (so para o erro): o que a UI Automation enxerga de "endereco" no dialogo. Nao serve para confirmar a pasta (ela nao expoe o caminho).</summary>
  static string DiagnosticoUia(IntPtr h) {
    var amostra = new StringBuilder();
    try {
      AutomationElementCollection todos = AutomationElement.FromHandle(h).FindAll(TreeScope.Descendants, Condition.TrueCondition);
      for (int i = 0; i < todos.Count && i < 4000 && amostra.Length < 600; i++) {
        AutomationElement e = todos[i];
        try {
          string n = e.Current.Name ?? "";
          if (n.IndexOf("ndere", StringComparison.OrdinalIgnoreCase) >= 0 || n.IndexOf("ddress", StringComparison.OrdinalIgnoreCase) >= 0 || n.IndexOf('\\') >= 0) amostra.Append(Descricao(e)).Append("; ");
        } catch (Exception) { }
      }
    } catch (Exception) { }
    return amostra.ToString();
  }

  /// <summary>Texto de uma janela filha (controle) de outro processo, por WM_GETTEXT com limite de tempo (GetWindowText nao le texto de controles alheios).</summary>
  static string TextoPorMensagem(IntPtr w) {
    var sb = new StringBuilder(2048);
    IntPtr r;
    Nativo.SendMessageTimeout(w, 0x000D, new IntPtr(sb.Capacity), sb, 0x0002, 500, out r);
    return sb.ToString();
  }

  /// <summary>Textos das barras de ferramentas Win32 (ToolbarWindow32) do dialogo; a do endereco comeca por "Endereco: " (pt-BR) ou "Address: ".</summary>
  static List<string> TextosDeBarras(IntPtr dialogo) {
    var lista = new List<string>();
    Nativo.EnumChildWindows(dialogo, delegate(IntPtr w, IntPtr l) {
      if (Nativo.Classe(w) == "ToolbarWindow32") {
        string t = TextoPorMensagem(w);
        if (string.IsNullOrEmpty(t)) t = Nativo.Texto(w);
        lista.Add(t ?? "");
      }
      return true;
    }, IntPtr.Zero);
    return lista;
  }

  /// <summary>Caminho atual do dialogo, lido do texto "Endereco: C:\..." da barra Win32; null se nao achou.</summary>
  static string PastaAtualDoDialogo(IntPtr dialogo, List<string> vistos) {
    foreach (string t in TextosDeBarras(dialogo)) {
      if (!vistos.Contains(t)) vistos.Add(t);
      int i = t.IndexOf(": ", StringComparison.Ordinal);
      if (i <= 0) continue;
      string rotulo = t.Substring(0, i);
      if (rotulo.StartsWith("Endere", StringComparison.OrdinalIgnoreCase) || rotulo.StartsWith("Address", StringComparison.OrdinalIgnoreCase)) return t.Substring(i + 2);
    }
    return null;
  }

  /// <summary>Sem barra final, caixa baixa e nomes curtos 8.3 resolvidos (GetLongPathName) para comparar caminhos.</summary>
  static string NormalizarCaminho(string p) {
    p = (p ?? "").Trim().TrimEnd('\\');
    var sb = new StringBuilder(1024);
    uint n = Nativo.GetLongPathName(p, sb, (uint)sb.Capacity);
    if (n > 0 && n < sb.Capacity) p = sb.ToString();
    return p.TrimEnd('\\').ToLowerInvariant();
  }

  /// <summary>
  /// Confirma que a pasta atual do dialogo e a esperada, pelo texto Win32 da barra de endereco (a UI Automation nao expoe o
  /// caminho). A navegacao e assincrona: tenta por ~3 s. Se nao confirmar, devolve false com o que foi visto (para o erro).
  /// </summary>
  static bool PastaAtualConfere(IntPtr h, string pasta, out string vistos) {
    string esperada = NormalizarCaminho(pasta);
    var textos = new List<string>();
    string atual = null;
    DateTime fim = DateTime.UtcNow.AddMilliseconds(3000);
    do {
      Checar();
      atual = PastaAtualDoDialogo(h, textos);
      if (atual != null && NormalizarCaminho(atual) == esperada) { vistos = null; return true; }
      Thread.Sleep(150);
    } while (DateTime.UtcNow < fim);
    vistos = "pasta atual lida da barra Win32: " + (atual == null ? "(nao achei a barra \"Endereco: ...\")" : "\"" + atual + "\"") + "; barras ToolbarWindow32: [" + string.Join(" | ", textos.ToArray()) + "]; UIA: " + DiagnosticoUia(h);
    return false;
  }

  static void Escrever(AutomationElement campo, string valor) {
    object p;
    if (campo.TryGetCurrentPattern(ValuePattern.Pattern, out p)) { ((ValuePattern)p).SetValue(valor); return; }
    var edit = campo.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
    if (edit == null || !edit.TryGetCurrentPattern(ValuePattern.Pattern, out p)) throw new Exception("O campo de nome nao aceita ValuePattern.");
    ((ValuePattern)p).SetValue(valor);
  }

  /// <summary>
  /// Abrir/Salvar: coloca um NOME SIMPLES (ou varios entre aspas) no campo "Nome" e aciona o botao padrao, SEM teclado: o texto vai
  /// por WM_SETTEXT no Edit do campo (conferido com WM_GETTEXT) e a confirmacao e um BM_CLICK no IDOK. Nunca recebe caminho: a pasta
  /// vem de Navegar e, quando pastaEsperada e informada, so segue depois de confirmar que o dialogo esta nela (e ela tem de ser
  /// uma pasta temporaria cstm-e2e-*); senao fecha o dialogo (cancela) e falha. Pergunta de substituir arquivo tambem cancela e falha.
  /// Tem limite interno de 10 s.
  /// </summary>
  public static Dictionary<string, object> Preencher(uint pid, string nome, int limiteMs, bool esperarFechar, string pastaEsperada) {
    Dictionary<string, object> resultado = null;
    Exception erro = null;
    abortar = false;
    var t = new Thread(delegate() {
      try { resultado = PreencherInterno(pid, nome, Math.Min(limiteMs, 4000), esperarFechar, pastaEsperada); }
      catch (Exception e) { erro = e; }
    });
    t.IsBackground = true;
    t.Start();
    if (!t.Join(LIMITE_PREENCHER_MS)) {
      abortar = true;
      FecharTodos(pid);
      throw new Exception("O preenchimento do dialogo passou de " + (LIMITE_PREENCHER_MS / 1000) + " s e foi abortado; os dialogos foram fechados.");
    }
    if (erro != null) { FecharTodos(pid); throw new Exception(erro.Message, erro); }
    return resultado;
  }

  /// <summary>Janelas filhas (qualquer nivel) do dialogo: identificador, classe e a janela pai.</summary>
  static List<IntPtr> Filhas(IntPtr dialogo) {
    var lista = new List<IntPtr>();
    Nativo.EnumChildWindows(dialogo, delegate(IntPtr w, IntPtr l) { lista.Add(w); return true; }, IntPtr.Zero);
    return lista;
  }

  /// <summary>Descendente de um controle com o id informado (o Edit de um combo 1148 e filho dele).</summary>
  static bool DentroDoControle(IntPtr w, IntPtr dialogo, int id) {
    for (IntPtr p = Nativo.GetParent(w); p != IntPtr.Zero && p != dialogo; p = Nativo.GetParent(p)) {
      if (Nativo.GetDlgCtrlID(p) == id) return true;
    }
    return false;
  }

  /// <summary>Acha o Edit do campo Nome (controle 1148 e o Edit 1001 dentro dele, ou um Edit 1001 solto) e o botao IDOK (id 1).</summary>
  static void AcharControles(IntPtr dialogo, out IntPtr edit, out IntPtr botao, out string resumo) {
    edit = IntPtr.Zero; botao = IntPtr.Zero;
    var sb = new StringBuilder();
    int n = 0;
    foreach (IntPtr w in Filhas(dialogo)) {
      string classe = Nativo.Classe(w); int id = Nativo.GetDlgCtrlID(w);
      if (n++ < 60 && (id == 1 || id == 1148 || id == 1001 || classe == "Edit" || classe == "Button")) sb.Append(classe).Append("#").Append(id).Append(" ");
      if (edit == IntPtr.Zero && classe == "Edit" && (id == 1148 || id == 1001 || DentroDoControle(w, dialogo, 1148))) edit = w;
      if (botao == IntPtr.Zero && classe == "Button" && id == 1 && Nativo.IsWindowVisible(w)) botao = w;
    }
    if (botao == IntPtr.Zero) botao = Nativo.GetDlgItem(dialogo, 1);
    resumo = sb.ToString();
  }

  /// <summary>Texto que o Windows mostra numa pergunta de substituir arquivo (o teste nunca deve sobrescrever nada).</summary>
  static bool PerguntaDeSubstituir(string titulo, string texto) {
    string s = (titulo + " " + texto).ToLowerInvariant();
    return s.Contains("substitu") || s.Contains("replace") || s.Contains("overwrite") || s.Contains("ja existe") || s.Contains("j\u00e1 existe") || s.Contains("already exists");
  }

  /// <summary>Espera o dialogo fechar; qualquer outra caixa (erro ou "deseja substituir?") fecha tudo e falha na hora, com mensagem propria.</summary>
  static void EsperarFecharOuFalhar(uint pid, IntPtr h, int limiteMs, string nome) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(limiteMs);
    while (DateTime.UtcNow < fim) {
      Checar();
      if (!Nativo.IsWindowVisible(h)) return;
      foreach (IntPtr outro in Visiveis(pid)) {
        if (outro == h) continue;
        string texto = TextoDe(outro), titulo = Nativo.Texto(outro);
        FecharTodos(pid);
        if (PerguntaDeSubstituir(titulo, texto))
          throw new Exception("O Windows perguntou se deve SUBSTITUIR um arquivo (\"" + titulo + "\": " + texto + "); cancelado sem sobrescrever nada. O teste usa pasta propria: o nome \"" + nome + "\" ja existe nela, o que e um nome repetido no teste.");
        throw new Exception("O Windows mostrou um dialogo de erro (\"" + titulo + "\"): " + texto);
      }
      Thread.Sleep(100);
    }
  }

  static Dictionary<string, object> PreencherInterno(uint pid, string nome, int limiteMs, bool esperarFechar, string pastaEsperada) {
    IntPtr h = Esperar(pid, limiteMs);
    if (h == IntPtr.Zero) throw new Exception("Nenhum dialogo de arquivo apareceu para o processo " + pid + ".");
    string titulo = Nativo.Texto(h);
    try {
      ValidarNomes(nome);
      ErroModal(pid, h, "antes de preencher");
      if (pastaEsperada != null) {
        if (pastaEsperada.IndexOf("cstm-e2e-", StringComparison.OrdinalIgnoreCase) < 0) throw new Exception("Recusado: a pasta esperada nao e uma pasta temporaria de teste (cstm-e2e-*): " + pastaEsperada);
        string vistos;
        if (!PastaAtualConfere(h, pastaEsperada, out vistos)) throw new Exception("O dialogo nao esta na pasta do teste (" + pastaEsperada + "); cancelado sem salvar nem abrir nada. " + vistos);
      }
      Checar();
      IntPtr edit, botao; string resumo;
      AcharControles(h, out edit, out botao, out resumo);
      if (edit != IntPtr.Zero && botao != IntPtr.Zero) {
        // Win32 direto no controle: sem teclado, sem foco. WM_SETTEXT no Edit e conferencia com WM_GETTEXT.
        IntPtr r;
        Nativo.SendMessageTimeoutTexto(edit, 0x000C, IntPtr.Zero, nome, 0x0002, 1000, out r);
        string lido = TextoPorMensagem(edit);
        if (!string.Equals(lido, nome, StringComparison.Ordinal)) throw new Exception("O campo Nome ficou com \"" + lido + "\" em vez de \"" + nome + "\"; nada foi confirmado.");
        Checar();
        ErroModal(pid, h, "antes de confirmar");
        Thread.Sleep(150);
        Nativo.PostMessage(botao, BM_CLICK, IntPtr.Zero, IntPtr.Zero);
      } else {
        // Reserva: UI Automation (ValuePattern + Invoke), com o texto conferido. Sem teclado: se nao ficar certo, falha.
        AutomationElement[] eb;
        try { eb = CampoEBotao(AutomationElement.FromHandle(h), limiteMs, titulo); }
        catch (Exception e) { throw new Exception("Nao achei o campo Nome por Win32 (controles: " + resumo + ") nem por UI Automation: " + e.Message); }
        Escrever(eb[0], nome);
        string lido = LerValor(eb[0]);
        if (lido != null && !string.Equals(lido.Trim(), nome.Trim(), StringComparison.Ordinal)) throw new Exception("O campo Nome ficou com \"" + lido + "\" em vez de \"" + nome + "\"; nada foi confirmado.");
        Checar();
        ErroModal(pid, h, "antes de confirmar");
        Thread.Sleep(150);
        Clicar(eb[1], h);
      }
      if (esperarFechar) EsperarFecharOuFalhar(pid, h, 5000, nome);
      else Thread.Sleep(600);
    } catch (Exception e) {
      // Se o dialogo ja fechou quando o Windows cancelou a chamada, o efeito esperado aconteceu.
      if (!(Cancelada(e) && !Nativo.IsWindowVisible(h))) { FecharTodos(pid); throw; }
    }
    var rr = new Dictionary<string, object>(); rr["titulo"] = titulo; rr["fechou"] = !Nativo.IsWindowVisible(h); return rr;
  }

  /// <summary>Navega o dialogo ate a pasta pela barra de endereco (Alt+D, caminho, Enter), sem confirmar nada.</summary>
  public static Dictionary<string, object> Navegar(uint pid, string caminho, int limiteMs) {
    IntPtr h = Esperar(pid, limiteMs);
    if (h == IntPtr.Zero) throw new Exception("Nenhum dialogo de arquivo apareceu para o processo " + pid + ".");
    try {
      if (!Janelas.Focar(h)) throw new Exception("O dialogo nao ficou em primeiro plano para navegar.");
      Entrada.EsperarModificadoresSoltos(2000);
      ErroModal(pid, h, "antes de navegar");
      Entrada.Combinacao("Alt+D");
      Thread.Sleep(350);
      // Se Alt+D nao levou o foco para a barra de endereco e ele esta na lista de arquivos, digitar o caminho ali faria busca por
      // letra e o Enter abriria ou renomearia um item: aborta sem digitar.
      AutomationElement foco = null;
      try { foco = AutomationElement.FocusedElement; } catch (Exception) { }
      if (foco != null) {
        string tf = "";
        try { tf = foco.Current.ControlType.ProgrammaticName; } catch (Exception) { }
        if (tf == "ControlType.ListItem" || tf == "ControlType.DataItem" || tf == "ControlType.List" || tf == "ControlType.DataGrid" || tf == "ControlType.Tree" || tf == "ControlType.TreeItem")
          throw new Exception("Depois de Alt+D o foco ficou na lista de arquivos (" + Descricao(foco) + "); nada foi digitado.");
      }
      Entrada.Digitar(caminho, 5);
      Thread.Sleep(200);
      Entrada.Combinacao("Enter");
      Thread.Sleep(900);
      foreach (IntPtr outro in Visiveis(pid)) {
        if (outro == h) continue;
        string texto = TextoDe(outro);
        FecharTodos(pid);
        throw new Exception("O Windows mostrou um dialogo de erro ao navegar para \"" + caminho + "\": " + texto);
      }
    } catch (Exception) { FecharTodos(pid); throw; }
    var r = new Dictionary<string, object>(); r["titulo"] = Nativo.Texto(h); return r;
  }

  /// <summary>Seletor de pasta: navega ate a pasta pela barra de endereco, limpa o campo de nome e aciona "Selecionar pasta".</summary>
  public static Dictionary<string, object> Pasta(uint pid, string caminho, int limiteMs) {
    Navegar(pid, caminho, limiteMs);
    IntPtr h = Achar(pid);
    if (h == IntPtr.Zero) throw new Exception("O seletor de pasta fechou durante a navegacao.");
    string titulo = Nativo.Texto(h);
    try {
      AutomationElement[] eb = CampoEBotao(AutomationElement.FromHandle(h), limiteMs, titulo);
      try { Escrever(eb[0], ""); } catch (Exception) { }
      Thread.Sleep(150);
      Clicar(eb[1], h);
      EsperarFechar(pid, h, 5000);
    } catch (Exception e) {
      if (!(Cancelada(e) && !Nativo.IsWindowVisible(h))) { FecharTodos(pid); throw; }
    }
    var r = new Dictionary<string, object>(); r["titulo"] = titulo; r["fechou"] = !Nativo.IsWindowVisible(h); return r;
  }

  /// <summary>Aciona um botao (por AutomationId, ex.: "6" = Sim) do dialogo aberto do processo; para a confirmacao de substituir arquivo.</summary>
  public static Dictionary<string, object> Responder(uint pid, string botaoId, int limiteMs) {
    IntPtr h = Esperar(pid, limiteMs);
    if (h == IntPtr.Zero) throw new Exception("Nenhum dialogo apareceu para o processo " + pid + ".");
    AutomationElement botao = PorId(AutomationElement.FromHandle(h), botaoId);
    if (botao == null) throw new Exception("O dialogo \"" + Nativo.Texto(h) + "\" nao tem o botao " + botaoId + ".");
    Clicar(botao, h);
    var r = new Dictionary<string, object>(); r["titulo"] = Nativo.Texto(h); return r;
  }
}

// ---------------------------------------------------------------- UI Automation generica (bandeja, menus nativos)
public static class Uia {
  static List<IntPtr> Janelas(string classe, uint pid) {
    var lista = new List<IntPtr>();
    Nativo.EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!Nativo.IsWindowVisible(h)) return true;
      if (classe != null && Nativo.Classe(h) != classe) return true;
      if (pid != 0 && Nativo.Pid(h) != pid) return true;
      lista.Add(h);
      return true;
    }, IntPtr.Zero);
    return lista;
  }

  static string Linha(AutomationElement e, int nivel) {
    string tipo = e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
    System.Windows.Rect r = e.Current.BoundingRectangle;
    return new string(' ', nivel * 2) + tipo + " | nome=\"" + e.Current.Name + "\" | classe=" + e.Current.ClassName + " | id=" + e.Current.AutomationId +
      " | retangulo=" + (r.IsEmpty ? "vazio" : ((int)r.X + "," + (int)r.Y + "," + (int)r.Width + "x" + (int)r.Height)) + (e.Current.IsOffscreen ? " | fora da tela" : "");
  }

  static void Percorrer(AutomationElement e, int nivel, int profundidade, List<object> saida, int maximo) {
    if (saida.Count >= maximo) return;
    saida.Add(Linha(e, nivel));
    if (nivel >= profundidade) return;
    AutomationElement filho = TreeWalker.RawViewWalker.GetFirstChild(e);
    while (filho != null && saida.Count < maximo) {
      Percorrer(filho, nivel + 1, profundidade, saida, maximo);
      filho = TreeWalker.RawViewWalker.GetNextSibling(filho);
    }
  }

  /// <summary>Arvore de UI Automation das janelas visiveis (por classe e/ou processo), para diagnostico.</summary>
  public static List<object> Dump(string classe, uint pid, int profundidade, int maximo) {
    var saida = new List<object>();
    foreach (IntPtr h in Janelas(classe, pid)) {
      saida.Add("== janela " + h.ToInt64() + " classe=" + Nativo.Classe(h) + " titulo=\"" + Nativo.Texto(h) + "\" pid=" + Nativo.Pid(h));
      try { Percorrer(AutomationElement.FromHandle(h), 0, profundidade, saida, maximo); } catch (Exception e) { saida.Add("(falhou: " + e.Message + ")"); }
      if (saida.Count >= maximo) break;
    }
    return saida;
  }

  static AutomationElement Procurar(Dictionary<string, object> a) {
    string classe = Arg.S(a, "janelaClasse", null), nome = Arg.S(a, "nome", null), tipo = Arg.S(a, "tipo", null), id = Arg.S(a, "automationId", null);
    bool exato = Arg.B(a, "exato", true);
    uint pid = (uint)Arg.I(a, "pid", 0);
    foreach (IntPtr h in Janelas(classe, pid)) {
      AutomationElement raiz;
      try { raiz = AutomationElement.FromHandle(h); } catch (Exception) { continue; }
      AutomationElementCollection todos = raiz.FindAll(TreeScope.Descendants, Condition.TrueCondition);
      for (int i = 0; i < todos.Count && i < 4000; i++) {
        AutomationElement e = todos[i];
        try {
          if (tipo != null && e.Current.ControlType.ProgrammaticName != "ControlType." + tipo) continue;
          if (id != null && e.Current.AutomationId != id) continue;
          if (nome != null) {
            string n = e.Current.Name ?? "";
            if (exato ? !string.Equals(n, nome, StringComparison.OrdinalIgnoreCase) : n.IndexOf(nome, StringComparison.OrdinalIgnoreCase) < 0) continue;
          }
          return e;
        } catch (Exception) { }
      }
    }
    return null;
  }

  static Dictionary<string, object> Descrever(AutomationElement e) {
    System.Windows.Rect r = e.Current.BoundingRectangle;
    var d = new Dictionary<string, object>();
    d["nome"] = e.Current.Name; d["classe"] = e.Current.ClassName; d["automationId"] = e.Current.AutomationId;
    d["tipo"] = e.Current.ControlType.ProgrammaticName.Replace("ControlType.", "");
    d["foraDaTela"] = e.Current.IsOffscreen;
    d["retangulo"] = r.IsEmpty ? null : (object)new Dictionary<string, object> { { "x", (int)r.X }, { "y", (int)r.Y }, { "largura", (int)r.Width }, { "altura", (int)r.Height } };
    return d;
  }

  /// <summary>Procura um elemento (nome, tipo, AutomationId) nas janelas visiveis da classe/processo; espera ate limiteMs. Devolve null se nao achou.</summary>
  public static Dictionary<string, object> Encontrar(Dictionary<string, object> a) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(Arg.I(a, "limiteMs", 3000));
    while (true) {
      AutomationElement e = Procurar(a);
      if (e != null) return Descrever(e);
      if (DateTime.UtcNow > fim) return null;
      Thread.Sleep(150);
    }
  }

  /// <summary>Todos os elementos que casam (o icone fantasma de um programa encerrado pode coexistir com o novo); espera ate achar algum.</summary>
  public static List<object> Listar(Dictionary<string, object> a) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(Arg.I(a, "limiteMs", 3000));
    while (true) {
      var lista = new List<object>();
      string classe = Arg.S(a, "janelaClasse", null), nome = Arg.S(a, "nome", null), tipo = Arg.S(a, "tipo", null), id = Arg.S(a, "automationId", null);
      bool exato = Arg.B(a, "exato", true);
      foreach (IntPtr h in Janelas(classe, (uint)Arg.I(a, "pid", 0))) {
        AutomationElement raiz;
        try { raiz = AutomationElement.FromHandle(h); } catch (Exception) { continue; }
        AutomationElementCollection todos = raiz.FindAll(TreeScope.Descendants, Condition.TrueCondition);
        for (int i = 0; i < todos.Count && i < 4000; i++) {
          AutomationElement e = todos[i];
          try {
            if (tipo != null && e.Current.ControlType.ProgrammaticName != "ControlType." + tipo) continue;
            if (id != null && e.Current.AutomationId != id) continue;
            if (nome != null) {
              string n = e.Current.Name ?? "";
              if (exato ? !string.Equals(n, nome, StringComparison.OrdinalIgnoreCase) : n.IndexOf(nome, StringComparison.OrdinalIgnoreCase) < 0) continue;
            }
            lista.Add(Descrever(e));
          } catch (Exception) { }
        }
      }
      if (lista.Count > 0 || DateTime.UtcNow > fim) return lista;
      Thread.Sleep(150);
    }
  }

  /// <summary>Como Encontrar, mas aciona o elemento (Invoke, ou Toggle/SelectionItem na falta dele), sem mouse nem teclado.</summary>
  public static Dictionary<string, object> Invocar(Dictionary<string, object> a) {
    DateTime fim = DateTime.UtcNow.AddMilliseconds(Arg.I(a, "limiteMs", 3000));
    AutomationElement e = null;
    while (e == null) {
      e = Procurar(a);
      if (e == null) { if (DateTime.UtcNow > fim) throw new Exception("Elemento nao encontrado: " + Arg.S(a, "nome", Arg.S(a, "automationId", "?"))); Thread.Sleep(150); }
    }
    var d = Descrever(e);
    object p;
    Action acao;
    if (e.TryGetCurrentPattern(InvokePattern.Pattern, out p)) { var inv = (InvokePattern)p; acao = delegate() { inv.Invoke(); }; }
    else if (e.TryGetCurrentPattern(TogglePattern.Pattern, out p)) { var tg = (TogglePattern)p; acao = delegate() { tg.Toggle(); }; }
    else if (e.TryGetCurrentPattern(SelectionItemPattern.Pattern, out p)) { var si = (SelectionItemPattern)p; acao = delegate() { si.Select(); }; }
    else throw new Exception("O elemento nao aceita Invoke, Toggle nem Select.");
    // Invoke de itens de menu pode bloquear ate o menu fechar: roda numa thread e segue.
    var t = new Thread(delegate() { try { acao(); } catch (Exception) { } });
    t.IsBackground = true; t.Start(); t.Join(1500);
    return d;
  }
}

// ---------------------------------------------------------------- guardiao: se o Node morrer, restaura o clipboard e reabre o CSTM
public static class Guardiao {
  static bool armado; static object[] snapshot; static string caminho, argumentos, ignorar;

  public static void Armar(object[] snap, string exe, string args, string caminhoIgnorado) {
    snapshot = snap; caminho = exe; argumentos = args; ignorar = caminhoIgnorado; armado = true;
  }
  public static void Desarmar() { armado = false; }

  static bool CstmInstaladoRodando() {
    foreach (Process p in Process.GetProcessesByName("cstm")) {
      try {
        string c = p.MainModule.FileName;
        if (ignorar == null || !string.Equals(c, ignorar, StringComparison.OrdinalIgnoreCase)) return true;
      } catch (Exception) { }
    }
    return false;
  }

  public static void AoPerderEntrada() {
    if (!armado) return;
    try { Clip.Restaurar(snapshot); } catch (Exception) { }
    if (!string.IsNullOrEmpty(caminho) && !CstmInstaladoRodando()) {
      try {
        var psi = new ProcessStartInfo(caminho, argumentos ?? "");
        psi.UseShellExecute = true; psi.WorkingDirectory = Path.GetDirectoryName(caminho);
        Process.Start(psi);
      } catch (Exception) { }
    }
  }
}

// ---------------------------------------------------------------- laco de comandos
public static class Servidor {
  static readonly JavaScriptSerializer js = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 200 };

  static string Ascii(string s) {
    var sb = new StringBuilder(s.Length + 16);
    foreach (char c in s) { if (c > 126) sb.Append("\\u").Append(((int)c).ToString("x4")); else sb.Append(c); }
    return sb.ToString();
  }

  static void Responder(string texto) { Console.Out.WriteLine(Ascii(texto)); Console.Out.Flush(); }

  public static void Executar() {
    Nativo.SetProcessDPIAware();
    // O Ctrl+C do terminal chega a todos os processos do console: o helper o ignora e so sai quando a entrada fecha.
    Console.CancelKeyPress += delegate(object s, ConsoleCancelEventArgs e) { e.Cancel = true; };
    Responder("{\"pronto\":true}");
    string linha;
    while ((linha = Console.In.ReadLine()) != null) {
      if (linha.Trim().Length == 0) continue;
      var resposta = new Dictionary<string, object>();
      bool sair = false;
      try {
        var pedido = (Dictionary<string, object>)js.DeserializeObject(linha);
        resposta["id"] = pedido["id"];
        string cmd = Convert.ToString(pedido["cmd"]);
        var args = pedido.ContainsKey("args") ? pedido["args"] as Dictionary<string, object> : null;
        if (cmd == "sair") sair = true;
        resposta["resultado"] = Despachar(cmd, args ?? new Dictionary<string, object>());
        resposta["ok"] = true;
      } catch (Exception e) {
        resposta["ok"] = false; resposta["erro"] = e.GetType().Name + ": " + e.Message;
      }
      Responder(js.Serialize(resposta));
      if (sair) break;
    }
    Guardiao.AoPerderEntrada();
    Alvo.Fechar();
  }

  static object Despachar(string cmd, Dictionary<string, object> a) {
    switch (cmd) {
      case "ping": return "pong";
      case "sair": Alvo.Fechar(); return true;

      // entrada real
      case "tecla": Entrada.Combinacao(Arg.S(a, "combo", "")); return true;
      case "digitar": Entrada.Digitar(Arg.S(a, "texto", ""), Arg.I(a, "atrasoMs", 8)); return true;
      case "esperarModificadoresSoltos": return Entrada.EsperarModificadoresSoltos(Arg.I(a, "limiteMs", 3000));
      case "soltarModificadores": Entrada.SoltarModificadores(); return true;
      case "mouseMover": Entrada.Mover(Arg.I(a, "x", 0), Arg.I(a, "y", 0)); return Entrada.Posicao();
      case "mouseClicar": Entrada.Clicar(Arg.I(a, "x", 0), Arg.I(a, "y", 0), Arg.S(a, "botao", "esquerdo") == "direito", Arg.I(a, "vezes", 1)); return true;
      case "mouseArrastar": Entrada.Arrastar(Arg.I(a, "x1", 0), Arg.I(a, "y1", 0), Arg.I(a, "x2", 0), Arg.I(a, "y2", 0), Arg.I(a, "passos", 12)); return true;
      case "mouseRolar": Entrada.Rolar(Arg.I(a, "delta", -120)); return true;
      case "mousePosicao": return Entrada.Posicao();

      // tela e janelas
      case "telaInfo": {
        var d = new Dictionary<string, object>();
        d["virtual"] = new Dictionary<string, object> { { "x", Nativo.GetSystemMetrics(76) }, { "y", Nativo.GetSystemMetrics(77) }, { "largura", Nativo.GetSystemMetrics(78) }, { "altura", Nativo.GetSystemMetrics(79) } };
        d["principal"] = new Dictionary<string, object> { { "largura", Nativo.GetSystemMetrics(0) }, { "altura", Nativo.GetSystemMetrics(1) } };
        d["monitores"] = Screen.AllScreens.Length;
        return d;
      }
      case "capturarTela": {
        Rectangle v = SystemInformation.VirtualScreen;
        using (var bmp = new Bitmap(v.Width, v.Height, PixelFormat.Format32bppArgb)) {
          using (var g = Graphics.FromImage(bmp)) g.CopyFromScreen(v.X, v.Y, 0, 0, v.Size);
          bmp.Save(Arg.S(a, "caminho", ""), ImageFormat.Png);
        }
        return true;
      }
      case "primeiroPlano": return Janelas.PrimeiroPlano();
      case "janelaFocar": return Janelas.Focar(new IntPtr(Convert.ToInt64(a["hwnd"])));
      case "janelas": return Janelas.Listar((uint)Arg.I(a, "pid", 0), Arg.B(a, "soVisiveis", false));

      // janela alvo
      case "alvoAbrir": return Alvo.Abrir(Arg.I(a, "x", 100), Arg.I(a, "y", 100), Arg.I(a, "largura", 640), Arg.I(a, "altura", 420), Arg.S(a, "titulo", "CSTM e2e \u2014 alvo"));
      case "alvoFocar": return Alvo.Focar();
      case "alvoLimpar": Alvo.Limpar(); return true;
      case "alvoLer": return Alvo.Ler();
      case "alvoEscrever": Alvo.Escrever(Arg.S(a, "texto", "")); return true;
      case "alvoPosicao": return Alvo.Posicao();
      case "alvoFechar": Alvo.Fechar(); return true;

      // clipboard
      case "clipResumo": return Clip.Resumo();
      case "clipTexto": return Clip.LerTexto();
      case "clipHtml": return Clip.LerHtml();
      case "clipRtf": return Clip.LerRtf();
      case "clipEscrever": return Clip.Escrever(a);
      case "clipEsvaziar": Clip.Esvaziar(); return true;
      case "clipSequencia": return (long)Clip.Sequencia();
      case "clipSalvar": return Clip.Salvar();
      case "clipRestaurar": return Clip.Restaurar(Arg.L(a, "formatos"));

      // dialogos de arquivo
      case "dialogoEsperar": { IntPtr h = Dialogo.Esperar((uint)Arg.I(a, "pid", 0), Arg.I(a, "limiteMs", 10000)); return h == IntPtr.Zero ? null : Janelas.Descrever(h, Nativo.GetForegroundWindow()); }
      case "dialogoPreencher": return Dialogo.Preencher((uint)Arg.I(a, "pid", 0), Arg.S(a, "caminho", ""), Arg.I(a, "limiteMs", 8000), Arg.B(a, "esperarFechar", true), Arg.S(a, "pastaEsperada", null));
      case "uiaDump": return Uia.Dump(Arg.S(a, "classe", null), (uint)Arg.I(a, "pid", 0), Arg.I(a, "profundidade", 4), Arg.I(a, "maximo", 300));
      case "uiaEncontrar": return Uia.Encontrar(a);
      case "uiaListar": return Uia.Listar(a);
      case "uiaInvocar": return Uia.Invocar(a);
      case "dialogoNavegar": return Dialogo.Navegar((uint)Arg.I(a, "pid", 0), Arg.S(a, "caminho", ""), Arg.I(a, "limiteMs", 8000));
      case "dialogoPasta": return Dialogo.Pasta((uint)Arg.I(a, "pid", 0), Arg.S(a, "caminho", ""), Arg.I(a, "limiteMs", 8000));
      case "dialogoFechar": return Dialogo.FecharTodos((uint)Arg.I(a, "pid", 0));
      case "dialogoResponder": return Dialogo.Responder((uint)Arg.I(a, "pid", 0), Arg.S(a, "botaoId", "6"), Arg.I(a, "limiteMs", 5000));

      // guardiao
      case "guardiaoArmar": Guardiao.Armar(Arg.L(a, "formatos"), Arg.S(a, "caminhoCstm", null), Arg.S(a, "argumentos", ""), Arg.S(a, "ignorar", null)); return true;
      case "guardiaoDesarmar": Guardiao.Desarmar(); return true;
    }
    throw new Exception("Comando desconhecido: " + cmd);
  }
}
