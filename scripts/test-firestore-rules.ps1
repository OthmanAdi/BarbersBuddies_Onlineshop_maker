[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$firebaseCommand = Join-Path $repoRoot 'node_modules\.bin\firebase.cmd'
$firestoreDebugLog = Join-Path $repoRoot 'firestore-debug.log'
$hadFirestoreDebugLog = Test-Path -LiteralPath $firestoreDebugLog
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
        --only firestore `
        'node --test test/firestore-rules.test.js'

    $firebaseExitCode = $LASTEXITCODE
}
finally {
    if ($locationPushed) {
        Pop-Location
    }

    $env:TEMP = $previousTemp
    $env:TMP = $previousTmp

    if ((-not $hadFirestoreDebugLog) -and (Test-Path -LiteralPath $firestoreDebugLog)) {
        Remove-Item -LiteralPath $firestoreDebugLog -Force
    }
}

exit $firebaseExitCode
