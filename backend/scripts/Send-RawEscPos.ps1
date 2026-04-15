param(
  [Parameter(Mandatory = $true)]
  [string]$PrinterName,

  [Parameter(Mandatory = $true)]
  [string]$Base64
)

$code = @"
using System;
using System.Runtime.InteropServices;

public static class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFO di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@

Add-Type -TypeDefinition $code | Out-Null

$bytes = [Convert]::FromBase64String($Base64)
$handle = [IntPtr]::Zero
$docInfo = New-Object RawPrinterHelper+DOCINFO
$docInfo.pDocName = "Fatboy ESC/POS Ticket"
$docInfo.pDataType = "RAW"

if (-not [RawPrinterHelper]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
  throw "No se pudo abrir la impresora '$PrinterName'. Verifica que exista en Windows."
}

$buffer = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)

try {
  [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $buffer, $bytes.Length)

  if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, $docInfo)) {
    throw "No se pudo iniciar el documento RAW en la impresora '$PrinterName'."
  }

  try {
    if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
      throw "No se pudo iniciar la pagina RAW en la impresora '$PrinterName'."
    }

    try {
      $written = 0
      if (-not [RawPrinterHelper]::WritePrinter($handle, $buffer, $bytes.Length, [ref]$written)) {
        throw "No se pudieron enviar bytes RAW a la impresora '$PrinterName'."
      }

      if ($written -ne $bytes.Length) {
        throw "La impresora '$PrinterName' recibio $written de $($bytes.Length) bytes."
      }
    }
    finally {
      [RawPrinterHelper]::EndPagePrinter($handle) | Out-Null
    }
  }
  finally {
    [RawPrinterHelper]::EndDocPrinter($handle) | Out-Null
  }
}
finally {
  if ($buffer -ne [IntPtr]::Zero) {
    [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($buffer)
  }
  if ($handle -ne [IntPtr]::Zero) {
    [RawPrinterHelper]::ClosePrinter($handle) | Out-Null
  }
}
