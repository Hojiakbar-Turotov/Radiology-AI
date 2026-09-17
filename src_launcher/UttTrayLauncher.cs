using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

[assembly: AssemblyTitle("UTT Navbat va Boshqaruv Serveri")]
[assembly: AssemblyDescription("Respublika Onkologiya Markazi UTT / MSKT / MRT Navbat Tizimi")]
[assembly: AssemblyConfiguration("")]
[assembly: AssemblyCompany("Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Markazi")]
[assembly: AssemblyProduct("UTT Radiology AI Server")]
[assembly: AssemblyCopyright("Copyright (c) 2026")]
[assembly: AssemblyTrademark("")]
[assembly: AssemblyCulture("")]
[assembly: AssemblyVersion("11.6.0.0")]
[assembly: AssemblyFileVersion("11.6.0.0")]

namespace UttServerLauncher
{
    static class Program
    {
        private const string MutexGuid = "Local\\UTT_NAVBAR_SYSTEM_TRAY_MUTEX_V11_6";

        [STAThread]
        static void Main()
        {
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                bool createdNew = true;
                Mutex mutex = null;
                try
                {
                    mutex = new Mutex(true, MutexGuid, out createdNew);
                }
                catch
                {
                    createdNew = true;
                }

                if (!createdNew)
                {
                    MessageBox.Show(
                        "UTT Server allaqachon orqa fonda ishlamoqda!\n\n" +
                        "Pastdagi (soat yonidagi bildirishnomalar panelida) UTT ikonkasi mavjud.\n" +
                        "Barcha serverlar va TV ekranlar faol holatda.",
                        "UTT Server Faol",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information
                    );
                    return;
                }

                Application.Run(new TrayApplicationContext());
            }
            catch (Exception ex)
            {
                try
                {
                    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launcher_crash.txt"), ex.ToString());
                }
                catch { }
            }
        }
    }

    public class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private Process nodeProcess;
        private Process cloudProcess;
        private string baseDir;
        private string nodePath;
        private string scriptPath;
        private string localIp;
        private StreamWriter logWriter;
        private object logLock = new object();

        public TrayApplicationContext()
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            if (!File.Exists(Path.Combine(baseDir, "logger_server.js")))
            {
                string candidate = @"c:\Users\Rentgen xona\Desktop\UTT";
                if (File.Exists(Path.Combine(candidate, "logger_server.js")))
                {
                    baseDir = candidate;
                }
            }

            localIp = GetLocalIPAddress();
            InitLogging();
            ResolveNodePath();

            InitializeTray();

            StartServers();

            AppDomain.CurrentDomain.ProcessExit += (s, e) => StopServers();
            Application.ApplicationExit += (s, e) => StopServers();
        }

        private void InitLogging()
        {
            try
            {
                string logsDir = Path.Combine(baseDir, "logs");
                if (!Directory.Exists(logsDir))
                {
                    Directory.CreateDirectory(logsDir);
                }
                string logFile = Path.Combine(logsDir, "launcher_" + DateTime.Now.ToString("yyyy-MM-dd") + ".log");
                FileStream fs = new FileStream(logFile, FileMode.Append, FileAccess.Write, FileShare.ReadWrite);
                logWriter = new StreamWriter(fs, Encoding.UTF8) { AutoFlush = true };
                WriteLog("=== UTT TRAY LAUNCHER ISHGA TUSHDI ===");
                WriteLog("Ishchi katalog: " + baseDir);
                WriteLog("Lokal IP: " + localIp);
            }
            catch { }
        }

        private void WriteLog(string msg)
        {
            try
            {
                lock (logLock)
                {
                    if (logWriter != null)
                    {
                        logWriter.WriteLine(string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}", DateTime.Now, msg));
                    }
                }
            }
            catch { }
        }

        private void ResolveNodePath()
        {
            // 1. runtime\node.exe
            string p1 = Path.Combine(baseDir, "runtime", "node.exe");
            if (File.Exists(p1))
            {
                nodePath = p1;
                WriteLog("Node.js topildi (runtime): " + nodePath);
                return;
            }

            // 2. ./node.exe
            string p2 = Path.Combine(baseDir, "node.exe");
            if (File.Exists(p2))
            {
                nodePath = p2;
                WriteLog("Node.js topildi (mahalliy): " + nodePath);
                return;
            }

            // 3. Standart Node.js o'rnatilgan yo'li
            string p3 = @"C:\Program Files\nodejs\node.exe";
            if (File.Exists(p3))
            {
                nodePath = p3;
                WriteLog("Node.js topildi (Program Files): " + nodePath);
                return;
            }

            // 4. Tizim PATH orqali
            nodePath = "node";
            WriteLog("Node.js tizim PATH bo'yicha chaqiriladi: node");
        }

        private void InitializeTray()
        {
            contextMenu = new ContextMenuStrip();
            contextMenu.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            // Sarlavha
            ToolStripMenuItem titleItem = new ToolStripMenuItem("🏥 RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA MARKAZI");
            titleItem.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            titleItem.Enabled = false;
            contextMenu.Items.Add(titleItem);

            ToolStripMenuItem subTitleItem = new ToolStripMenuItem("    UTT Navbat & Boshqaruv Serveri (v11.6.0)");
            subTitleItem.Font = new Font("Segoe UI", 8.5f, FontStyle.Italic);
            subTitleItem.Enabled = false;
            contextMenu.Items.Add(subTitleItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            // Holat va IP
            ToolStripMenuItem statusItem = new ToolStripMenuItem("🟢 Server holati: Fonda faol ishlamoqda");
            statusItem.ForeColor = Color.DarkGreen;
            statusItem.Font = new Font("Segoe UI", 9.0f, FontStyle.Bold);
            statusItem.Enabled = false;
            contextMenu.Items.Add(statusItem);

            ToolStripMenuItem ipItem = new ToolStripMenuItem("🌐 Tarmoq IP: http://" + localIp + ":9877 (TV uchun)");
            ipItem.Font = new Font("Segoe UI", 9.0f, FontStyle.Regular);
            ipItem.Click += (s, e) => {
                try {
                    Clipboard.SetText("http://" + localIp + ":9877");
                    notifyIcon.ShowBalloonTip(2000, "Nusxalandi", "TV IP manzili xotiraga olindi: http://" + localIp + ":9877", ToolTipIcon.Info);
                } catch { }
            };
            ipItem.ToolTipText = "Bosish orqali TV havolasini nusxalash";
            contextMenu.Items.Add(ipItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            // Veb Havolalar
            contextMenu.Items.Add(CreateLinkItem("🖥️  Registrator Posti (9876)", "http://localhost:9876"));
            contextMenu.Items.Add(CreateLinkItem("📺  TV Jonli Monitor Ekrani (9877)", "http://localhost:9877"));
            contextMenu.Items.Add(CreateLinkItem("👨‍⚕️  Vrach Qabulxona Profili (9878)", "http://localhost:9878"));
            contextMenu.Items.Add(CreateLinkItem("📱  Bemor Portali (9879)", "http://localhost:9879"));
            contextMenu.Items.Add(CreateLinkItem("🛡️  Admin Boshqaruv Dashborti (9880)", "http://localhost:9880"));

            contextMenu.Items.Add(new ToolStripSeparator());

            // Papkani ochish
            ToolStripMenuItem openFolderItem = new ToolStripMenuItem("📁 Dastur papkasini ochish");
            openFolderItem.Click += (s, e) => {
                try { Process.Start("explorer.exe", baseDir); } catch { }
            };
            contextMenu.Items.Add(openFolderItem);

            // Qayta ishga tushirish
            ToolStripMenuItem restartItem = new ToolStripMenuItem("🔄 Serverni qayta yuklash (Restart)");
            restartItem.Click += (s, e) => {
                WriteLog("Foydalanuvchi serverni qayta yuklashni buyurdi...");
                StopServers();
                Thread.Sleep(1000);
                StartServers();
                notifyIcon.ShowBalloonTip(2500, "UTT Server", "Server muvaffaqiyatli qayta ishga tushirildi!", ToolTipIcon.Info);
            };
            contextMenu.Items.Add(restartItem);

            contextMenu.Items.Add(new ToolStripSeparator());

            // Chiqish (Exit)
            ToolStripMenuItem exitItem = new ToolStripMenuItem("🛑 Serverni to'xtatish va Chiqish (Exit)");
            exitItem.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            exitItem.ForeColor = Color.DarkRed;
            exitItem.Click += (s, e) => {
                DialogResult dr = MessageBox.Show(
                    "Haqiqatan ham UTT Serverini to'xtatib, dasturdan chiqmoqchimisiz?\n\n" +
                    "Diqqat: Server to'xtatilsa, TV ekranlar va bemor portallari faoliyati to'xtaydi.",
                    "UTT Serverni To'xtatish",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2
                );
                if (dr == DialogResult.Yes)
                {
                    WriteLog("Foydalanuvchi chiqishni tasdiqladi.");
                    ExitApplication();
                }
            };
            contextMenu.Items.Add(exitItem);

            // Ikonkani aniqlash
            Icon appIcon = null;
            string iconFile = Path.Combine(baseDir, "build-installer", "app.ico");
            if (!File.Exists(iconFile))
            {
                iconFile = Path.Combine(baseDir, "app.ico");
            }

            if (File.Exists(iconFile))
            {
                try { appIcon = new Icon(iconFile); } catch { }
            }

            if (appIcon == null)
            {
                try { appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
            }

            if (appIcon == null)
            {
                appIcon = SystemIcons.Application;
            }

            notifyIcon = new NotifyIcon();
            notifyIcon.Icon = appIcon;
            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Text = "UTT Server (Portlar: 9876-9883) — Faol";
            notifyIcon.Visible = true;

            notifyIcon.DoubleClick += (s, e) => {
                try { Process.Start("http://localhost:9877"); } catch { }
            };

            notifyIcon.BalloonTipTitle = "UTT Server Ishga Tushdi (v11.6.0)";
            notifyIcon.BalloonTipText = "Server orqa fonda faol ishlamoqda.\nTV manzili: http://" + localIp + ":9877";
            notifyIcon.BalloonTipIcon = ToolTipIcon.Info;
            notifyIcon.ShowBalloonTip(3000);
        }

        private ToolStripMenuItem CreateLinkItem(string text, string url)
        {
            ToolStripMenuItem item = new ToolStripMenuItem(text);
            item.Click += (s, e) => {
                try { Process.Start(url); } catch { }
            };
            return item;
        }

        private void StartServers()
        {
            scriptPath = Path.Combine(baseDir, "logger_server.js");
            if (!File.Exists(scriptPath))
            {
                MessageBox.Show(
                    "logger_server.js fayli topilmadi!\nYo'l: " + scriptPath,
                    "Kritik Xatolik",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
                return;
            }

            try
            {
                WriteLog("Server ishga tushirilmoqda: " + nodePath + " " + scriptPath);
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = nodePath;
                psi.Arguments = "\"" + scriptPath + "\"";
                psi.WorkingDirectory = baseDir;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                psi.WindowStyle = ProcessWindowStyle.Hidden;
                psi.RedirectStandardOutput = true;
                psi.RedirectStandardError = true;
                psi.StandardOutputEncoding = Encoding.UTF8;
                psi.StandardErrorEncoding = Encoding.UTF8;

                nodeProcess = new Process();
                nodeProcess.StartInfo = psi;
                nodeProcess.EnableRaisingEvents = true;

                nodeProcess.OutputDataReceived += (s, e) => {
                    if (!string.IsNullOrEmpty(e.Data)) WriteLog("[NODE] " + e.Data);
                };
                nodeProcess.ErrorDataReceived += (s, e) => {
                    if (!string.IsNullOrEmpty(e.Data)) WriteLog("[NODE_ERR] " + e.Data);
                };

                nodeProcess.Start();
                nodeProcess.BeginOutputReadLine();
                nodeProcess.BeginErrorReadLine();

                WriteLog("Node.js jarayoni boshlandi. PID: " + nodeProcess.Id);
            }
            catch (Exception ex)
            {
                WriteLog("Node.js ishga tushirishda xato: " + ex.Message);
                MessageBox.Show(
                    "Node.js serverini ishga tushirishda xatolik yuz berdi:\n" + ex.Message,
                    "Server Xatosi",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }

            // Cloudflare tunnel mavjud bo'lsa fonda ishga tushirish
            string cloudflareExe = Path.Combine(baseDir, "cloudflared.exe");
            if (File.Exists(cloudflareExe))
            {
                try
                {
                    Process[] running = Process.GetProcessesByName("cloudflared");
                    if (running.Length == 0)
                    {
                        ProcessStartInfo cpsi = new ProcessStartInfo();
                        cpsi.FileName = cloudflareExe;
                        cpsi.Arguments = "tunnel --url http://localhost:9880";
                        cpsi.WorkingDirectory = baseDir;
                        cpsi.UseShellExecute = false;
                        cpsi.CreateNoWindow = true;
                        cpsi.WindowStyle = ProcessWindowStyle.Hidden;

                        cloudProcess = new Process();
                        cloudProcess.StartInfo = cpsi;
                        cloudProcess.Start();
                        WriteLog("Cloudflared tunnel jarayoni boshlandi. PID: " + cloudProcess.Id);
                    }
                }
                catch (Exception cex)
                {
                    WriteLog("Cloudflared ishga tushirishda xato: " + cex.Message);
                }
            }
        }

        private void StopServers()
        {
            WriteLog("Serverlarni to'xtatish boshlandi...");
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                    nodeProcess.WaitForExit(3000);
                    WriteLog("Node.js jarayoni to'xtatildi.");
                }
            }
            catch (Exception ex)
            {
                WriteLog("Node to'xtatishda xato: " + ex.Message);
            }
            finally
            {
                nodeProcess = null;
            }

            try
            {
                if (cloudProcess != null && !cloudProcess.HasExited)
                {
                    cloudProcess.Kill();
                    cloudProcess.WaitForExit(2000);
                    WriteLog("Cloudflared jarayoni to'xtatildi.");
                }
            }
            catch { }
            finally
            {
                cloudProcess = null;
            }
        }

        private void ExitApplication()
        {
            StopServers();

            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
                notifyIcon = null;
            }

            if (logWriter != null)
            {
                try
                {
                    WriteLog("=== UTT TRAY LAUNCHER TO'XTATILDI ===");
                    logWriter.Flush();
                    logWriter.Close();
                }
                catch { }
            }

            Application.Exit();
        }

        private static string GetLocalIPAddress()
        {
            try
            {
                IPAddress[] addresses = Dns.GetHostAddresses(Environment.MachineName);
                foreach (IPAddress addr in addresses)
                {
                    if (addr.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(addr))
                    {
                        string s = addr.ToString();
                        if (!s.StartsWith("169.254.")) return s;
                    }
                }
            }
            catch { }

            return "127.0.0.1";
        }
    }
}
