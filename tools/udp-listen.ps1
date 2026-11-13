# DiRT 3 - UDP telemetry listener (port 20777)
# Shows selected indices live and writes EVERY packet (all floats) to CSV,
# so the indices can be mapped later. Ctrl+C stops.
#
# Run:
#   powershell -ExecutionPolicy Bypass -File tools\udp-listen.ps1

param(
    [int]$Port = 20777,
    [string]$CsvPath = (Join-Path $PSScriptRoot ("dirt3-telemetry-{0}.csv" -f (Get-Date -Format "yyyyMMdd-HHmmss")))
)

# Index guesses (Codemasters layout, extradata=3) - TO BE VERIFIED
$guess = [ordered]@{
    'time'      = 0
    'speed'     = 7    # m/s
    'throttle'  = 29   # 0..1
    'steer'     = 30   # -1..1
    'brake'     = 31   # 0..1
    'clutch'    = 32
    'gear'      = 33
    'gLat'      = 34
    'gLon'      = 35
    'lap'       = 36
    'rpm/10?'   = 37
}

$udp = New-Object System.Net.Sockets.UdpClient($Port)
$udp.Client.ReceiveTimeout = 2000
$remote = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)
$writer = $null
$count = 0
$lastShow = [DateTime]::MinValue

Write-Host "Listening for UDP on port $Port. Start driving in the game. Ctrl+C = stop." -ForegroundColor Cyan
Write-Host "CSV: $CsvPath"

try {
    while ($true) {
        try {
            $bytes = $udp.Receive([ref]$remote)
        } catch [System.Net.Sockets.SocketException] {
            Write-Host ("[{0:HH:mm:ss}] no packets (2 s)..." -f (Get-Date)) -ForegroundColor DarkYellow
            continue
        }
        $n = [int][Math]::Floor($bytes.Length / 4)
        $f = New-Object 'single[]' $n
        for ($i = 0; $i -lt $n; $i++) { $f[$i] = [BitConverter]::ToSingle($bytes, $i * 4) }

        if ($null -eq $writer) {
            $writer = New-Object System.IO.StreamWriter($CsvPath, $false, [System.Text.Encoding]::UTF8)
            $writer.WriteLine((@('t_ms', 'bytes') + (0..($n - 1) | ForEach-Object { "f$_" })) -join ';')
            Write-Host "First packet: $($bytes.Length) B = $n floats (from $remote)" -ForegroundColor Green
        }
        $inv = [System.Globalization.CultureInfo]::InvariantCulture
        $row = @([DateTimeOffset]::Now.ToUnixTimeMilliseconds(), $bytes.Length) + ($f | ForEach-Object { $_.ToString('R', $inv) })
        $writer.WriteLine($row -join ';')
        $count++

        $now = Get-Date
        if (($now - $lastShow).TotalMilliseconds -ge 200) {
            $lastShow = $now
            $parts = foreach ($k in $guess.Keys) {
                $idx = $guess[$k]
                if ($idx -lt $n) { '{0}[{1}]={2:N2}' -f $k, $idx, $f[$idx] }
            }
            $kmh = if ($n -gt 7) { '{0,6:N1} km/h' -f ($f[7] * 3.6) } else { '' }
            Write-Host ("#{0,-6} {1} | {2}" -f $count, $kmh, ($parts -join '  '))
        }
    }
} finally {
    if ($writer) { $writer.Close() }
    $udp.Close()
    Write-Host "Saved $count packets to $CsvPath" -ForegroundColor Cyan
}
