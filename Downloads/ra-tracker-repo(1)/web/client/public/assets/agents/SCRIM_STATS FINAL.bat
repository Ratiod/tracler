@echo off
setlocal enabledelayedexpansion
title Valorant Scrim Stats Fetcher
color 0A

echo.
echo  ============================================
echo   Valorant Scrim Stats Fetcher - Final
echo  ============================================
echo.

:: 1. LOCKFILE
set "LOCKFILE=C:\Users\tyran\AppData\Local\Riot Games\Riot Client\Config\lockfile"
if not exist "%LOCKFILE%" (
    echo [ERROR] Lockfile not found. Make sure Valorant is running!
    pause & exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$parts = (Get-Content '%LOCKFILE%') -split ':'; $parts[2]"`) do set "LF_PORT=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$parts = (Get-Content '%LOCKFILE%') -split ':'; $parts[3]"`) do set "LF_PASS=%%V"

echo [OK] Port: !LF_PORT!

:: 2. AUTH TOKENS
echo [..] Getting auth tokens...
curl -s -k -u "riot:!LF_PASS!" "https://127.0.0.1:!LF_PORT!/entitlements/v1/token" -o _auth.json 2>nul

if not exist _auth.json (
    echo [ERROR] Could not reach local Riot client API.
    pause & exit /b 1
)

findstr /i "CREDENTIALS_INVALID" _auth.json >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] Auth failed - wrong password.
    del _auth.json >nul 2>&1
    pause & exit /b 1
)

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '_auth.json' | ConvertFrom-Json).accessToken"`) do set "ACCESS_TOKEN=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '_auth.json' | ConvertFrom-Json).token"`) do set "ENTITLEMENT_TOKEN=%%V"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '_auth.json' | ConvertFrom-Json).subject"`) do set "PUUID=%%V"

if "!ACCESS_TOKEN!"=="" (
    echo [ERROR] Failed to parse access token.
    type _auth.json
    del _auth.json >nul 2>&1
    pause & exit /b 1
)
echo [OK] Auth tokens retrieved
echo [OK] PUUID: !PUUID!

:: 3. CLIENT VERSION from log
set "LOGFILE=C:\Users\tyran\AppData\Local\VALORANT\Saved\Logs\ShooterGame.log"
set "CLIENT_VERSION=release-12.06-shipping-19-4440219"

echo [..] Getting client version...
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$log = Get-Content '%LOGFILE%' -Raw; if ($log -match '(release-\d+-\d+-shipping-\d+-\d+)') { $Matches[1] } elseif ($log -match '(release-[\d.]+\-shipping-\d+-\d+)') { $Matches[1] }"`) do (
    if not "%%V"=="" set "CLIENT_VERSION=%%V"
)
echo [OK] Client version: !CLIENT_VERSION!

:: 4. SHARD
set "SHARD=ap"
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$log = Get-Content '%LOGFILE%' -Raw; if ($log -match 'pd\.([a-z]+)\.a\.pvp\.net') { $Matches[1] }"`) do (
    if not "%%V"=="" set "SHARD=%%V"
)
echo [OK] Shard: !SHARD!

:: 5. MATCH ID - search coregame URLs first (real match ID), fall back to pregame
echo [..] Reading match ID from ShooterGame.log...
set "MATCHID="

:: First try ares-coregame lines (these contain the real match ID)
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$puuid = '!PUUID!'; $log = Get-Content '%LOGFILE%'; $id = $log | Where-Object { $_ -match 'ares-coregame' } | ForEach-Object { [regex]::Matches($_, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') } | ForEach-Object { $_.Value } | Where-Object { $_ -ne $puuid } | Select-Object -Last 1; $id"`) do (
    if not "%%V"=="" set "MATCHID=%%V"
)

:: Fall back to pregame if no coregame found
if "!MATCHID!"=="" (
    for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "$puuid = '!PUUID!'; $log = Get-Content '%LOGFILE%'; $id = $log | Where-Object { $_ -match 'ares-pregame' } | ForEach-Object { [regex]::Matches($_, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') } | ForEach-Object { $_.Value } | Where-Object { $_ -ne $puuid } | Select-Object -Last 1; $id"`) do (
        if not "%%V"=="" set "MATCHID=%%V"
    )
)

    )
)

echo [OK] Match ID: !MATCHID!

:: 6. FETCH MATCH DETAILS
set "CLIENT_PLATFORM=ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9"

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd'"`) do set "TODAY=%%D"
set "OUTFILE=match-!MATCHID:~0,8!-!TODAY!.json"

echo [..] Fetching from pd.!SHARD!.a.pvp.net...
curl -s ^
    -H "Authorization: Bearer !ACCESS_TOKEN!" ^
    -H "X-Riot-Entitlements-JWT: !ENTITLEMENT_TOKEN!" ^
    -H "X-Riot-ClientPlatform: !CLIENT_PLATFORM!" ^
    -H "X-Riot-ClientVersion: !CLIENT_VERSION!" ^
    "https://pd.!SHARD!.a.pvp.net/match-details/v1/matches/!MATCHID!" ^
    -o "!OUTFILE!"

del _auth.json >nul 2>&1

if not exist "!OUTFILE!" (
    echo [ERROR] Failed to save output file.
    pause & exit /b 1
)

findstr /i "errorCode" "!OUTFILE!" >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] API returned an error:
    type "!OUTFILE!"
    del "!OUTFILE!" >nul 2>&1
    pause & exit /b 1
)

:: 7. SUMMARY
echo.
echo  ============================================
powershell -NoProfile -Command "$m = Get-Content '!OUTFILE!' | ConvertFrom-Json; $map = $m.matchInfo.mapId -replace '.*/Maps/','' -replace '/.*',''; $winner = ($m.teams | Where-Object { $_.won }).teamId; $blue = ($m.teams | Where-Object { $_.teamId -eq 'Blue' }).roundsWon; $red = ($m.teams | Where-Object { $_.teamId -eq 'Red' }).roundsWon; Write-Host '  Map    :' $map; Write-Host '  Score  : Blue' $blue '-' $red 'Red'; Write-Host '  Winner :' $winner; Write-Host '  Players:' $m.players.Count; Write-Host ''; Write-Host '  Top Players by ACS:'; $m.players | Where-Object { -not $_.isObserver } | ForEach-Object { $acs = if ($_.stats.roundsPlayed -gt 0) { [math]::Round($_.stats.score / $_.stats.roundsPlayed) } else { 0 }; [PSCustomObject]@{ Name = $_.gameName + '#' + $_.tagLine; Team = $_.teamId; ACS = $acs; K = $_.stats.kills; D = $_.stats.deaths; A = $_.stats.assists } } | Sort-Object ACS -Descending | ForEach-Object { Write-Host ('  [{0}] {1} - {2} ACS ({3}/{4}/{5})' -f $_.Team, $_.Name, $_.ACS, $_.K, $_.D, $_.A) }"
echo  ============================================
echo.
echo  Saved: !OUTFILE!
echo  Upload this file to your scrim tracker!
echo.
pause


echo.
echo  ============================================
echo   SUCCESS!
echo  ============================================
echo.
echo  Saved: !OUTFILE!
echo  Upload this file to your website tracker!
echo.
pause
