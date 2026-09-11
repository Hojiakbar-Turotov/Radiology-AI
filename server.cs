using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;

namespace KarmedServer
{
    class Program
    {
        static Process nodeProcess = null;

        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "Karmed UTT Navbat va Kunlik Logger Server (v3.0.0)";

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string scriptPath = Path.Combine(baseDir, "logger_server.js");

            if (!File.Exists(scriptPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[XATOLIK] logger_server.js fayli topilmadi: " + scriptPath);
                Console.ResetColor();
                Console.WriteLine("Dasturni yopish uchun istalgan tugmani bosing...");
                Console.ReadKey();
                return;
            }

            string nodeExe = FindNodeExe();
            if (string.IsNullOrEmpty(nodeExe))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[XATOLIK] Node.js kompyuterda topilmadi!");
                Console.WriteLine("Iltimos, Node.js ni https://nodejs.org saytidan o'rnating.");
                Console.ResetColor();
                Console.WriteLine("Dasturni yopish uchun istalgan tugmani bosing...");
                Console.ReadKey();
                return;
            }

            Console.CancelKeyPress += (sender, e) =>
            {
                StopNodeProcess();
            };

            AppDomain.CurrentDomain.ProcessExit += (sender, e) =>
            {
                StopNodeProcess();
            };

            PrintBanner(baseDir);
            StartNodeProcess(nodeExe, scriptPath, baseDir);
        }

        static void PrintBanner(string baseDir)
        {
            Console.Clear();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.ForegroundColor = ConsoleColor.White;
            Console.WriteLine("  RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI");
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("  KARMED UTT NAVBAT VA KUNLIK LOGGER SERVER (v3.0.0)");
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.ResetColor();

            DateTime now = DateTime.Now;
            string dateStr = now.ToString("dd.MM.yyyy");
            string logPath = Path.Combine(baseDir, "Log", dateStr, "logger.me");

            Console.WriteLine("  📅 Bugungi sana:      " + dateStr);
            Console.WriteLine("  📁 Kunlik log fayl:   " + logPath);
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("  🖥️ Mahalliy havola:   http://localhost:9876");

            try
            {
                string hostName = Dns.GetHostName();
                IPHostEntry host = Dns.GetHostEntry(hostName);
                foreach (IPAddress ip in host.AddressList)
                {
                    if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                    {
                        Console.WriteLine("  📶 Wi-Fi / Tarmoq:    http://" + ip.ToString() + ":9876 (TV / Post / Telefon)");
                    }
                }
            }
            catch { }

            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("================================================================================");
            Console.ForegroundColor = ConsoleColor.Gray;
            Console.WriteLine("  Server ishlamoqda. To'xtatish uchun: Ctrl + C");
            Console.WriteLine("================================================================================\n");
            Console.ResetColor();
        }

        static void StartNodeProcess(string nodeExe, string scriptPath, string baseDir)
        {
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + scriptPath + "\"",
                    WorkingDirectory = baseDir,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true,
                    StandardOutputEncoding = Encoding.UTF8,
                    StandardErrorEncoding = Encoding.UTF8
                };

                nodeProcess = new Process { StartInfo = psi };

                nodeProcess.OutputDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Console.WriteLine(e.Data);
                    }
                };

                nodeProcess.ErrorDataReceived += (sender, e) =>
                {
                    if (!string.IsNullOrEmpty(e.Data))
                    {
                        Console.ForegroundColor = ConsoleColor.Red;
                        Console.WriteLine("[XATO] " + e.Data);
                        Console.ResetColor();
                    }
                };

                nodeProcess.Start();
                nodeProcess.BeginOutputReadLine();
                nodeProcess.BeginErrorReadLine();

                nodeProcess.WaitForExit();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[Server Start Error]: " + ex.Message);
                Console.ResetColor();
            }
        }

        static void StopNodeProcess()
        {
            try
            {
                if (nodeProcess != null && !nodeProcess.HasExited)
                {
                    nodeProcess.Kill();
                    nodeProcess.Dispose();
                    nodeProcess = null;
                }
            }
            catch { }
        }

        static string FindNodeExe()
        {
            string[] possiblePaths = new string[]
            {
                "node",
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe",
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"npm\node.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\node\node.exe")
            };

            foreach (string p in possiblePaths)
            {
                try
                {
                    if (p == "node")
                    {
                        Process pTest = Process.Start(new ProcessStartInfo
                        {
                            FileName = "node",
                            Arguments = "-v",
                            UseShellExecute = false,
                            CreateNoWindow = true,
                            RedirectStandardOutput = true
                        });
                        pTest.WaitForExit(2000);
                        if (pTest.ExitCode == 0) return "node";
                    }
                    else if (File.Exists(p))
                    {
                        return p;
                    }
                }
                catch { }
            }

            return null;
        }
    }
}
