using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace MRTServerLauncher
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "MRT & UTT Lokal Serveri - Ishga Tushiruvchi";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================");
            Console.WriteLine("  🏥 TOMOGRAFIYA (MRT & MSKT) ELEKTRON NAVBAT TIZIMI");
            Console.WriteLine("  100% Lokal Server | Offline Muhit | Avtomat Taqsimlash");
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

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("[3/3] Brauzerda Navbatga Yozish Portali ochilmoqda...");
            Console.ResetColor();

            try
            {
                Process.Start(new ProcessStartInfo("http://localhost:3000/navbat-yozish/") { UseShellExecute = true });
            }
            catch { }

            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("\n================================================================");
            Console.WriteLine("  ✓ SERVER MUVAFFAQIYATLI ISHLAMOQDA!");
            Console.WriteLine("================================================================");
            Console.ResetColor();
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
