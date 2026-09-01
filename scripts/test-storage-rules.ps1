[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$firebaseCommand = Join-Path $repoRoot 'node_modules\.bin\firebase.cmd'
$storageDebugLog = Join-Path $repoRoot 'storage-debug.log'
$hadStorageDebugLog = Test-Path -LiteralPath $storageDebugLog
$shortTempPath = 'C:\jtmp'

if (-not (Test-Path -LiteralPath $firebaseCommand -PathType Leaf)) {
    throw "Local Firebase CLI not found at: $firebaseCommand"
}

New-Item -ItemType Directory -Path $shortTempPath -Force | Out-Null

$previousTemp = $env:TEMP
$previousTmp = $env:TMP
$locationPushed = $false
$firebaseExitCode = 1

try {
    $env:TEMP = $shortTempPath
    $env:TMP = $shortTempPath

    Push-Location -LiteralPath $repoRoot
    $locationPushed = $true

    & $firebaseCommand `
        emulators:exec `
        --project demo-barbersbuddies `
        --only storage `
        'node --test test/storage-rules.test.js'

    $firebaseExitCode = $LASTEXITCODE
}
finally {
    if ($locationPushed) {
        Pop-Location
    }

    $env:TEMP = $previousTemp
    $env:TMP = $previousTmp

    if ((-not $hadStorageDebugLog) -and (Test-Path -LiteralPath $storageDebugLog)) {
        Remove-Item -LiteralPath $storageDebugLog -Force
    }
}

exit $firebaseExitCode
