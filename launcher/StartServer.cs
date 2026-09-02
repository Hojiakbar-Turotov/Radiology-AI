using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace MRTServerLauncher
{
    static class Program
    {
        private static Process serverProcess = null;
        private static NotifyIcon trayIcon = null;
        private static string currentDir = "";
        private static string extensionPath = "";
        private static string profilePath = "";
        private static string karmedLocalUrl = "http://192.168.150.111:2025/Radiology/Rbys.aspx";
        private static string karmedRemoteUrl = "http://213.230.91.59:2025/Radiology/Rbys.aspx";

        public static string GetActiveKarmedUrl()
        {
            try
            {
                using (var client = new System.Net.Sockets.TcpClient())
                {
                    var asyncResult = client.BeginConnect("192.168.150.111", 2025, null, null);
                    bool connected = asyncResult.AsyncWaitHandle.WaitOne(1200);
                    if (connected && client.Connected)
                    {
                        return karmedLocalUrl;
                    }
                }
            }
            catch { }

            return karmedRemoteUrl;
        }

        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            currentDir = AppDomain.CurrentDomain.BaseDirectory;
            extensionPath = Path.Combine(currentDir, "extension-kardelen");
            profilePath = Path.Combine(currentDir, "data", "karmed_profile");
            string serverScript = Path.Combine(currentDir, "server.js");

            if (!Directory.Exists(profilePath))
            {
                try { Directory.CreateDirectory(profilePath); } catch { }
            }

            if (!File.Exists(serverScript))
            {
                MessageBox.Show("server.js fayli topilmadi!\nIltimos, ushbu dasturni loyiha papkasida ishga tushiring.", 
                                "MRT Server Xatosi", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // 1. Eskirgan jarayonlarni tozalash
            KillOldProcesses();

            // 2. Node.js serverini fonda (darchasiz) ishga tushirish
            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo();
                startInfo.FileName = "node.exe";
                startInfo.Arguments = "\"" + serverScript + "\"";
                startInfo.WorkingDirectory = currentDir;
                startInfo.CreateNoWindow = true;
                startInfo.WindowStyle = ProcessWindowStyle.Hidden;
                startInfo.UseShellExecute = false;

                serverProcess = Process.Start(startInfo);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Node.js serverini ishga tushirishda xatolik:\n" + ex.Message + 
                                "\n\nIltimos, kompyuterda Node.js o'rnatilganligini tekshiring.", 
                                "Server Xatosi", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // Server yuklanishi uchun ozgina kutish
            Thread.Sleep(1000);

            // 3. Windows Tray menyusini yaratish
            SetupTrayIcon();

            // 4. Karmedni ALOHIDA OYNADA (Standalone App Window) ochish
            OpenKarmedApp();

            // Dasturni fonda ushlab turish
            Application.Run();
        }

        public static void OpenKarmedApp()
        {
            string activeUrl = GetActiveKarmedUrl();
            string browserExe = FindBrowserPath();

            try
            {
                ProcessStartInfo browserInfo = new ProcessStartInfo();
                browserInfo.FileName = browserExe;

                // Windows 10 va Windows 11 da to'liq mustaqil alohida oyna:
                // --app=URL: Manzil satrisiz, tablarsiz mustaqil desktop dastur oynasi
                // --user-data-dir: Alohida profil (mavjud shaxsiy brauzer oynalari bilan aralashmaydi)
                // --load-extension: Karmed navbat kengaytmasini to'liq yuklash
                // --start-maximized: Katta oyna sifatida ochish
                string args;
                if (Directory.Exists(extensionPath))
                {
                    args = string.Format("--app=\"{0}\" --load-extension=\"{1}\" --user-data-dir=\"{2}\" --start-maximized --no-first-run --no-default-browser-check --disable-features=Translate", 
                                         activeUrl, extensionPath, profilePath);
                }
                else
                {
                    args = string.Format("--app=\"{0}\" --user-data-dir=\"{1}\" --start-maximized --no-first-run --no-default-browser-check", 
                                         activeUrl, profilePath);
                }

                browserInfo.Arguments = args;
                browserInfo.UseShellExecute = false;
                Process.Start(browserInfo);
            }
            catch
            {
                try
                {
                    Process.Start(new ProcessStartInfo(activeUrl) { UseShellExecute = true });
                }
                catch { }
            }
        }

        static string FindBrowserPath()
        {
            // Windows 10 va 11 da avval Chrome, so'ngra Edge tekshiriladi
            string[] candidates = new string[]
            {
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string path in candidates)
            {
                if (File.Exists(path)) return path;
            }

            return "chrome.exe";
        }

        static void KillOldProcesses()
        {
            try
            {
                Process killProc = new Process();
                killProc.StartInfo.FileName = "taskkill";
                killProc.StartInfo.Arguments = "/F /IM node.exe";
                killProc.StartInfo.CreateNoWindow = true;
                killProc.StartInfo.WindowStyle = ProcessWindowStyle.Hidden;
                killProc.StartInfo.UseShellExecute = false;
                killProc.Start();
                killProc.WaitForExit(1200);
            }
            catch { }
        }

        static void SetupTrayIcon()
        {
            ContextMenu contextMenu = new ContextMenu();

            MenuItem itemOpen = new MenuItem("🏥 Karmed Dasturini Ochish (Alohida Oyna)", (s, e) => OpenKarmedApp());
            itemOpen.DefaultItem = true;
            contextMenu.MenuItems.Add(itemOpen);

            contextMenu.MenuItems.Add(new MenuItem("🌐 Karmed Ish Maydoni (Workspace)", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/karmed-workspace/index.html") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📝 Navbatga Yozish Portali", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/navbat-yozish/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📺 MRT TV Tablo (Kutish Zali)", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/mrt-tv/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("👨‍⚕️ Laborant Portali", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/laborant/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📊 Server Dashboard & Klaster", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/server-dashboard/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add("-");

            contextMenu.MenuItems.Add(new MenuItem("❌ Serverni To'xtatish va Chiqish", (s, e) => {
                ExitApplication();
            }));

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Karmed & MRT Serveri (Faol)";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.ContextMenu = contextMenu;
            trayIcon.Visible = true;

            trayIcon.DoubleClick += (s, e) => OpenKarmedApp();

            string currentUrl = GetActiveKarmedUrl();
            string hostType = currentUrl.Contains("192.168.150.111") ? "Lokal (192.168.150.111)" : "Tashqi (213.230.91.59)";
            trayIcon.ShowBalloonTip(3000, "Karmed & MRT Tizimi", "Lokal server faol. Karmed alohida oynada ochilmoqda...\nServer: " + hostType, ToolTipIcon.Info);
        }

        static void ExitApplication()
        {
            if (trayIcon != null)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }

            KillOldProcesses();
            Application.Exit();
        }
    }
}
