using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace KarmedLauncher
{
    class Program
    {
        static Process nodeProcess = null;
        static Process cloudflareProcess = null;

        static void Main(string[] args)
        {
            Console.Title = "KARMED RADIOLOGY UTT SERVER v5.0.0 (Master Direct Sync)";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.WriteLine("    RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI");
            Console.WriteLine("    KARMED RADIOLOGY UTT / MSKT / MRT SERVERI — v5.0.0 (EXE)");
            Console.WriteLine("================================================================================");
            Console.ResetColor();

            string currentDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!File.Exists(Path.Combine(currentDir, "logger_server.js")))
            {
                currentDir = @"c:\Users\Rentgen xona\Desktop\UTT";
            }

            Directory.SetCurrentDirectory(currentDir);
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine(" Ishchi katalog: " + currentDir);
            Console.ResetColor();

            // 1. Node.js mavjudligini tekshirish
            try
            {
                Process pTest = new Process();
                pTest.StartInfo.FileName = "node";
                pTest.StartInfo.Arguments = "-v";
                pTest.StartInfo.UseShellExecute = false;
                pTest.StartInfo.RedirectStandardOutput = true;
                pTest.StartInfo.CreateNoWindow = true;
                pTest.Start();
                string nodeVer = pTest.StandardOutput.ReadToEnd().Trim();
                pTest.WaitForExit();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine(" [OK] Node.js aniqlandi: " + nodeVer);
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [XATO] Node.js topilmadi! Iltimos, Node.js ni o'rnating. Xato: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine("Chiqish uchun ixtiyoriy tugmani bosing...");
                Console.ReadKey();
                return;
            }

            // 2. Cloudflare tunnel tekshirish / ishga tushirish
            string cloudflareExe = Path.Combine(currentDir, "cloudflared.exe");
            if (File.Exists(cloudflareExe))
            {
                Process[] runningTunnels = Process.GetProcessesByName("cloudflared");
                if (runningTunnels.Length == 0)
                {
                    Console.ForegroundColor = ConsoleColor.Cyan;
                    Console.WriteLine(" [TUNNEL] Cloudflare Online tunneli ishga tushirilmoqda...");
                    Console.ResetColor();
                    cloudflareProcess = new Process();
                    cloudflareProcess.StartInfo.FileName = cloudflareExe;
                    cloudflareProcess.StartInfo.Arguments = "tunnel --url http://localhost:9880";
                    cloudflareProcess.StartInfo.WorkingDirectory = currentDir;
                    cloudflareProcess.StartInfo.UseShellExecute = false;
                    cloudflareProcess.StartInfo.CreateNoWindow = true;
                    cloudflareProcess.Start();
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine(" [OK] Cloudflare tunneli faol ishlamoqda.");
                    Console.ResetColor();
                }
            }

            // 3. logger_server.js ni ishga tushirish
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(" [SERVER] logger_server.js ishga tushirilmoqda (v5.0.0 Master Direct Sync)...");
            Console.ResetColor();

            nodeProcess = new Process();
            nodeProcess.StartInfo.FileName = "node";
            nodeProcess.StartInfo.Arguments = "logger_server.js";
            nodeProcess.StartInfo.WorkingDirectory = currentDir;
            nodeProcess.StartInfo.UseShellExecute = false;
            nodeProcess.StartInfo.RedirectStandardOutput = false;
            nodeProcess.StartInfo.RedirectStandardError = false;

            AppDomain.CurrentDomain.ProcessExit += (s, e) => Shutdown();
            Console.CancelKeyPress += (s, e) => { Shutdown(); };

            try
            {
                nodeProcess.Start();
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("\n================================================================================");
                Console.WriteLine(" [MUVAFFAQINLI] SERVER ISHGA TUSHDI!");
                Console.WriteLine(" 📺 TV Jonli Ekran (Lokal):   http://localhost:9877");
                Console.WriteLine(" 📺 TV Jonli Ekran (Online):  https://battle-opening-telephony-miss.trycloudflare.com/tv");
                Console.WriteLine(" 📊 Admin Analitika (Lokal):  http://localhost:9880");
                Console.WriteLine(" 📊 Admin Analitika (Online): https://battle-opening-telephony-miss.trycloudflare.com/admin");
                Console.WriteLine(" 🖥️ Registrator Posti:       http://localhost:9876");
                Console.WriteLine(" 👨‍⚕️ Vrach Profili:           http://localhost:9878");
                Console.WriteLine(" 🎯 UTT Mobil Agenti:        http://localhost:9881");
                Console.WriteLine(" ⚡ MSKT Mobil Agenti:       http://localhost:9882");
                Console.WriteLine(" 🧲 MRT Mobil Agenti:        http://localhost:9883");
                Console.WriteLine("================================================================================\n");
                Console.ResetColor();

                nodeProcess.WaitForExit();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine(" [XATO] Server ishida xatolik: " + ex.Message);
                Console.ResetColor();
            }
            finally
            {
                Shutdown();
            }
        }

        static void Shutdown()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                }
            }
            catch {}
        }
    }
}
