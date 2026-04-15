#define AppName "Fatboy POS Backend"
#define AppVersion "1.0.0"
#define AppPublisher "Fatboy POS"
#define ServiceName "FatboyPOSBackend"

[Setup]
AppId={{B0F17A9A-6717-4F2B-9F47-5F5B98E0F7B4}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\FatboyPOSBackend
DefaultGroupName=Fatboy POS
OutputDir=..\installer-out
OutputBaseFilename=FatboyPOSBackendSetup
Compression=lzma2/fast
SolidCompression=no
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UninstallDisplayName={#AppName}
DisableProgramGroupPage=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\installer-staging\backend-service\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{app}\backend\service-runtime"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\bootstrap\install-fatboy-backend.ps1"" -AppRoot ""{app}"""; WorkingDir: "{app}"; StatusMsg: "Instalando y validando Fatboy POS Backend..."; Flags: waituntilterminated

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\bootstrap\uninstall-fatboy-backend.ps1"" -AppRoot ""{app}"""; WorkingDir: "{app}"; Flags: waituntilterminated; RunOnceId: "RemoveFatboyPOSBackendService"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;

  if not IsAdminInstallMode then
  begin
    MsgBox('Fatboy POS Backend requiere permisos de Administrador para instalar servicios de Windows.', mbError, MB_OK);
    Result := False;
    Exit;
  end;

  if not IsWin64 then
  begin
    MsgBox('Fatboy POS Backend requiere Windows x64.', mbError, MB_OK);
    Result := False;
    Exit;
  end;
end;
