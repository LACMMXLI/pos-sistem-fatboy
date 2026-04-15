$ErrorActionPreference = 'Stop'

Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match 'node|Update|nuget|squirrel' } |
  Select-Object ProcessId, Name, CommandLine |
  Sort-Object Name, ProcessId |
  Format-Table -AutoSize
