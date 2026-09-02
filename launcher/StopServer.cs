using System;
using System.Diagnostics;

namespace MRTServerStopper
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.Title = "MRT & UTT Serverini To'xtatish";
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("Server jarayoni to'xtatilmoqda...");
            try
            {
                Process killProc = new Process();
                killProc.StartInfo.FileName = "taskkill";
                killProc.StartInfo.Arguments = "/F /IM node.exe";
                killProc.StartInfo.CreateNoWindow = true;
                killProc.StartInfo.UseShellExecute = false;
                killProc.Start();
                killProc.WaitForExit(2000);

                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("\n[✓] MRT & UTT Lokal Serveri muvaffaqiyatli to'xtatildi.");
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("\nXatolik: " + ex.Message);
            }

            Console.ResetColor();
            System.Threading.Thread.Sleep(1500);
        }
    }
}
