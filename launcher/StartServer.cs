using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace MRTServerLauncher
{
    class Program
    {
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

        static void Main(string[] args)
        {
            Console.Title = "MRT & UTT Multi-Server Klasteri - Ishga Tushiruvchi";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================");
            Console.WriteLine("  🏥 TOMOGRAFIYA (MRT & MSKT) MULTI-SERVER KLASTERI");
            Console.WriteLine("  High-Availability P2P Mesh | Maks: 5 ta Server | Auto-Failover");
            Console.WriteLine("================================================================");
            Console.ResetColor();

            string currentDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(currentDir, "server.js");

            if (!File.Exists(serverScript))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[XATO] server.js fayli topilmadi!");
                Console.WriteLine("Iltimos, ushbu dasturni loyihaning asosiy papkasida saqlang.");
                Console.ResetColor();
                Console.WriteLine("\nChiqish uchun istalgan tugmani bosing...");
                Console.ReadKey();
                return;
            }

            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[1/3] Eskirgan jarayonlar tekshirilmoqda...");
            Console.ResetColor();

            // Eski node jarayonini to'xtatish
            try
            {
                Process killProc = new Process();
                killProc.StartInfo.FileName = "taskkill";
                killProc.StartInfo.Arguments = "/F /IM node.exe";
                killProc.StartInfo.CreateNoWindow = true;
                killProc.StartInfo.UseShellExecute = false;
                killProc.Start();
                killProc.WaitForExit(1500);
            }
            catch { }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("[2/3] Server ishga tushirilmoqda (Port: 3000)...");
            Console.ResetColor();

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = "node.exe";
            startInfo.Arguments = "\"" + serverScript + "\"";
            startInfo.WorkingDirectory = currentDir;
            startInfo.UseShellExecute = false;
            startInfo.RedirectStandardOutput = false;
            startInfo.RedirectStandardError = false;

            Process serverProcess = null;
            try
            {
                serverProcess = Process.Start(startInfo);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\n[XATO] Node.js ni ishga tushirishda xatolik: " + ex.Message);
                Console.WriteLine("Kompyuterda Node.js o'rnatilganligini tekshiring.");
                Console.ResetColor();
                Console.ReadKey();
                return;
            }

            Thread.Sleep(1200);

            string karmedUrl = "http://192.168.150.111:2025/Radiology/Rbys.aspx";
            string localPortalUrl = "http://localhost:3000/navbat-yozish/";
            string extensionPath = Path.Combine(currentDir, "extension-kardelen");

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("[3/3] Google Chrome va Karmed Radiologiya oynasi ochilmoqda...");
            Console.WriteLine("      • Karmed manzili: " + karmedUrl);
            Console.WriteLine("      • Kengaytma:      " + extensionPath);
            Console.ResetColor();

            try
            {
                string chromeExe = FindChromePath();
                ProcessStartInfo chromeInfo = new ProcessStartInfo();
                chromeInfo.FileName = chromeExe;

                // Kengaytmani yuklash va kerakli oynalarni ochish
                if (Directory.Exists(extensionPath))
                {
                    chromeInfo.Arguments = string.Format("--load-extension=\"{0}\" \"{1}\" \"{2}\"", extensionPath, karmedUrl, localPortalUrl);
                }
                else
                {
                    chromeInfo.Arguments = string.Format("\"{0}\" \"{1}\"", karmedUrl, localPortalUrl);
                }

                chromeInfo.UseShellExecute = false;
                Process.Start(chromeInfo);
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine("[Ogohlantirish] Chrome ochilishida: " + ex.Message);
                Console.ResetColor();
                try
                {
                    Process.Start(new ProcessStartInfo(karmedUrl) { UseShellExecute = true });
                    Process.Start(new ProcessStartInfo(localPortalUrl) { UseShellExecute = true });
                }
                catch { }
            }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n================================================================");
            Console.WriteLine("  ✓ SERVER MUVAFFAQIYATLI ISHLAMOQDA (KLASTER FAOL)!");
            Console.WriteLine("================================================================");
            Console.ResetColor();
            Console.WriteLine("  • Klaster Rejimi:   High-Availability P2P Mesh (Maks: 5 ta Server)");
            Console.WriteLine("  • Karmed URL:       " + karmedUrl);
            Console.WriteLine("  • Navbatga Yozish:  http://localhost:3000/navbat-yozish/");
            Console.WriteLine("  • Server Dashboard: http://localhost:3000/server-dashboard/");
            Console.WriteLine("  • MRT TV Tablo:     http://localhost:3000/mrt-tv/");
            Console.WriteLine("  • Laborant Portali: http://localhost:3000/laborant/");
            Console.WriteLine("  • Tizimga Kirish:   http://localhost:3000/login.html");
            Console.WriteLine("----------------------------------------------------------------");
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("DIQQAT: Server ishlashi uchun ushbu darchani yopmang (kichraytirib qo'ying).");
            Console.ResetColor();

            if (serverProcess != null)
            {
                serverProcess.WaitForExit();
            }
        }
    }
}
