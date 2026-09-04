Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = strPath

If fso.FileExists(strPath & "\runtime\node.exe") Then
    WshShell.Run Chr(34) & strPath & "\runtime\node.exe" & Chr(34) & " server.js", 0, False
Else
    WshShell.Run "node server.js", 0, False
End If

WScript.Sleep 1800
WshShell.Run "http://localhost:3000"
