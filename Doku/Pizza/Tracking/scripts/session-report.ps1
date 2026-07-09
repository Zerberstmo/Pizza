<#
  session-report.ps1
  Liest das Claude-Code-Session-Log (.jsonl), berechnet Tokens, Dauer und
  geschätzte Kosten und hängt einen Eintrag an Session-Log.md an.

  Wird vom SessionEnd-Hook aufgerufen. Der Hook liefert auf stdin ein JSON mit
  { session_id, transcript_path, cwd, ... }. Fällt transcript_path weg, wird die
  zuletzt geänderte .jsonl im Projekt-Log-Ordner verwendet.

  Wiederverwendbar: Der Log-Ordner wird dynamisch aus dem Projektpfad abgeleitet.
#>

$ErrorActionPreference = 'Stop'

# --- Opus 4.8 Preise (USD pro 1 Mio. Tokens) ---
$PRICE_INPUT       = 5.00
$PRICE_OUTPUT      = 25.00
$PRICE_CACHE_WRITE = 6.25   # 5-Minuten-Cache (1.25x Input)
$PRICE_CACHE_READ  = 0.50   # 0.1x Input

# --- Speicherort dieses Scripts -> Session-Log.md liegt zwei Ebenen höher ---
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$trackingDir = Split-Path -Parent $scriptDir
$sessionLog = Join-Path $trackingDir 'Session-Log.md'

# --- Hook-Eingabe von stdin lesen (falls vorhanden) ---
$stdin = [Console]::In.ReadToEnd()
$transcript = $null
$cwd = $null
if ($stdin -and $stdin.Trim().StartsWith('{')) {
    try {
        $hook = $stdin | ConvertFrom-Json
        $transcript = $hook.transcript_path
        $cwd = $hook.cwd
    } catch { }
}

# --- Fallback: Log-Ordner aus cwd (oder aktuellem Pfad) ableiten ---
if (-not $transcript -or -not (Test-Path $transcript)) {
    if (-not $cwd) { $cwd = (Get-Location).Path }
    $slug = ($cwd -replace '[:\\/]', '-')
    $logDir = Join-Path $env:USERPROFILE ".claude\projects\$slug"
    if (Test-Path $logDir) {
        $latest = Get-ChildItem -Path $logDir -Filter '*.jsonl' -File |
                  Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) { $transcript = $latest.FullName }
    }
}

if (-not $transcript -or -not (Test-Path $transcript)) {
    Write-Error "Kein Session-Log gefunden."
    exit 0
}

# --- .jsonl zeilenweise auswerten ---
$in = 0L; $out = 0L; $cacheW = 0L; $cacheR = 0L
$firstTs = $null; $lastTs = $null
$model = $null
$sessionId = $null

foreach ($line in Get-Content -LiteralPath $transcript) {
    if (-not $line.Trim()) { continue }
    try { $o = $line | ConvertFrom-Json } catch { continue }

    if ($o.sessionId -and -not $sessionId) { $sessionId = $o.sessionId }

    if ($o.timestamp) {
        $ts = [datetimeoffset]::Parse($o.timestamp)
        if (-not $firstTs -or $ts -lt $firstTs) { $firstTs = $ts }
        if (-not $lastTs  -or $ts -gt $lastTs)  { $lastTs  = $ts }
    }

    $u = $o.message.usage
    if ($u) {
        $in     += [int64]($u.input_tokens              | ForEach-Object { $_ })
        $out    += [int64]($u.output_tokens             | ForEach-Object { $_ })
        $cacheW += [int64]($u.cache_creation_input_tokens | ForEach-Object { $_ })
        $cacheR += [int64]($u.cache_read_input_tokens     | ForEach-Object { $_ })
        if ($o.message.model) { $model = $o.message.model }
    }
}

# --- Kosten berechnen ---
$cost = ($in     / 1e6 * $PRICE_INPUT) +
        ($out    / 1e6 * $PRICE_OUTPUT) +
        ($cacheW / 1e6 * $PRICE_CACHE_WRITE) +
        ($cacheR / 1e6 * $PRICE_CACHE_READ)

$totalTokens = $in + $out + $cacheW + $cacheR

# --- Guard: leere Session (keine echte Arbeit) nicht loggen ---
if ($totalTokens -eq 0 -or $out -eq 0) {
    exit 0
}

# --- Dauer formatieren ---
$durText = 'n/a'
if ($firstTs -and $lastTs) {
    $d = $lastTs - $firstTs
    $durText = '{0:00}h {1:00}m {2:00}s' -f [int]$d.TotalHours, $d.Minutes, $d.Seconds
}

$dateText = (Get-Date).ToString('yyyy-MM-dd HH:mm')
$shortId  = if ($sessionId) { $sessionId.Substring(0, [Math]::Min(8, $sessionId.Length)) } else { 'unbekannt' }

# --- Eintrag zusammenbauen ---
$entry = @"

## $dateText — Session ``$shortId``

- **Modell:** $model
- **Dauer:** $durText
- **Tokens gesamt:** $('{0:N0}' -f $totalTokens)
  - Input: $('{0:N0}' -f $in) · Output: $('{0:N0}' -f $out)
  - Cache-Write: $('{0:N0}' -f $cacheW) · Cache-Read: $('{0:N0}' -f $cacheR)
- **Geschätzte Kosten:** `$$([string]::Format([cultureinfo]::InvariantCulture, '{0:N2}', $cost)) USD
- **Was wurde gemacht:** _(von Claude während der Session ergänzt — siehe TODO/Changelog)_

"@

# --- Session-Log.md anlegen falls nötig, dann anhängen ---
if (-not (Test-Path $sessionLog)) {
    "# Session-Log`n`nAutomatisch generierte Einträge pro Claude-Code-Session (Tokens, Dauer, Kosten).`n" |
        Out-File -FilePath $sessionLog -Encoding utf8
}
Add-Content -LiteralPath $sessionLog -Value $entry -Encoding utf8
