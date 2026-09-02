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
            string serverScript = Path.Combine(currentDir, "server.js");

            if (!File.Exists(serverScript))
            {
                MessageBox.Show("server.js fayli topilmadi!\nIltimos, ushbu dasturni loyiha papkasida ishga tushiring.", 
                                "MRT Server Xatosi", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            // 1. Eskirgan jarayonlarni yopish (Fonda, darchasiz)
            KillOldProcesses();

            // 2. Node.js serverini fonda (mutlaqo darchasiz) ishga tushirish
            try
            {
                ProcessStartInfo startInfo = new ProcessStartInfo();
                startInfo.FileName = "node.exe";
                startInfo.Arguments = "\"" + serverScript + "\"";
                startInfo.WorkingDirectory = currentDir;
                startInfo.CreateNoWindow = true; // TERMINAL OCHILMASIN!
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
            Thread.Sleep(1200);

            // 3. Google Chrome ni Karmed sahifasi va kengaytmasi bilan bevosita ochish (to'siqlarsiz)
            OpenKarmedApp();

            // 4. Windows Tray (Soat yonidagi panel) menyusini yaratish
            SetupTrayIcon();

            // Dasturni fonda ushlab turish
            Application.Run();
        }

        static void OpenKarmedApp()
        {
            string activeUrl = GetActiveKarmedUrl();
            string chromeExe = FindChromePath();
            try
            {
                ProcessStartInfo chromeInfo = new ProcessStartInfo();
                chromeInfo.FileName = chromeExe;

                if (Directory.Exists(extensionPath))
                {
                    chromeInfo.Arguments = string.Format("--load-extension=\"{0}\" \"{1}\"", extensionPath, activeUrl);
                }
                else
                {
                    chromeInfo.Arguments = string.Format("\"{0}\"", activeUrl);
                }

                chromeInfo.UseShellExecute = false;
                Process.Start(chromeInfo);
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

        static string FindChromePath()
        {
            string[] candidates = new string[]
            {
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe")
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
                killProc.WaitForExit(1500);
            }
            catch { }
        }

        static void SetupTrayIcon()
        {
            ContextMenu contextMenu = new ContextMenu();

            MenuItem itemOpen = new MenuItem("🏥 Karmed Dasturini Ochish", (s, e) => OpenKarmedApp());
            itemOpen.DefaultItem = true;
            contextMenu.MenuItems.Add(itemOpen);

            contextMenu.MenuItems.Add(new MenuItem("🌐 Karmed Ish Maydoni (Yagona Oyna)", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/karmed-workspace/index.html") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📝 Navbatga Yozish Portali", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/navbat-yozish/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📺 MRT TV Tablo (Kutish Zali)", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/mrt-tv/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add(new MenuItem("📊 Server Dashboard & Klaster", (s, e) => {
                Process.Start(new ProcessStartInfo("http://localhost:3000/server-dashboard/") { UseShellExecute = true });
            }));

            contextMenu.MenuItems.Add("-");

            contextMenu.MenuItems.Add(new MenuItem("❌ Serverni To'xtatish va Chiqish", (s, e) => {
                ExitApplication();
            }));

            trayIcon = new NotifyIcon();
            trayIcon.Text = "Karmed & MRT Lokal Serveri (Faol)";
            trayIcon.Icon = SystemIcons.Application;
            trayIcon.ContextMenu = contextMenu;
            trayIcon.Visible = true;

            trayIcon.DoubleClick += (s, e) => OpenKarmedApp();

            trayIcon.ShowBalloonTip(3000, "Karmed & MRT Serveri", "Lokal server va klaster muvaffaqiyatli ishga tushirildi.", ToolTipIcon.Info);
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
