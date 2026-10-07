Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodeExe = scriptDir & "\node.exe"
runnerJs = scriptDir & "\service_runner_24_7.js"

If Not fso.FileExists(nodeExe) Then
    nodeExe = "node"
End If

WshShell.CurrentDirectory = scriptDir
' 0 = Yashirin oyna (Hidden), False = Fon rejimida davom etish
WshShell.Run Chr(34) & nodeExe & Chr(34) & " " & Chr(34) & runnerJs & Chr(34), 0, False
