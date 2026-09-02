using System;
using System.Diagnostics;
using System.Windows.Forms;

namespace MRTServerStopper
{
    static class Program
    {
        [STAThread]
        static void Main()
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
                killProc.WaitForExit(2000);

                MessageBox.Show("MRT & Karmed lokal serveri muvaffaqiyatli to'xtatildi.", 
                                "MRT Server", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Xatolik: " + ex.Message, "MRT Server", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
