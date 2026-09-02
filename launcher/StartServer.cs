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
        private static string appUrl = "http://localhost:3000/karmed-workspace/";

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

            // 3. Google Chrome ni Karmed menyusi va kengaytmasi bilan App rejimida ochish
            OpenKarmedApp();

            // 4. Windows Tray (Soat yonidagi panel) menyusini yaratish
            SetupTrayIcon();

            // Dasturni fonda ushlab turish
            Application.Run();
        }

        static void OpenKarmedApp()
        {
            string chromeExe = FindChromePath();
            try
            {
                ProcessStartInfo chromeInfo = new ProcessStartInfo();
                chromeInfo.FileName = chromeExe;

                // Chrome App rejimida (manzil satrisiz, alohida dastur oynasi kabi)
                if (Directory.Exists(extensionPath))
                {
                    chromeInfo.Arguments = string.Format("--app=\"{0}\" --load-extension=\"{1}\"", appUrl, extensionPath);
                }
                else
                {
                    chromeInfo.Arguments = string.Format("--app=\"{0}\"", appUrl);
                }

                chromeInfo.UseShellExecute = false;
                Process.Start(chromeInfo);
            }
            catch
            {
                // Agar Chrome topilmasa, standart brauzerda ochish
                try
                {
                    Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
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

            MenuItem itemOpen = new MenuItem("🏥 Karmed & Navbat Oynasini Ochish", (s, e) => OpenKarmedApp());
            itemOpen.DefaultItem = true;
            contextMenu.MenuItems.Add(itemOpen);

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
