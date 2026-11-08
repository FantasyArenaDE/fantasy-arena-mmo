param([Parameter(Mandatory)][string]$WorkDirectory)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$work = (New-Item -ItemType Directory -Path $WorkDirectory).FullName
if ($work -match '\s') { throw 'NSIS QA install path must be free of spaces.' }
$version = (Get-Content -LiteralPath "$PSScriptRoot/renderer-input.json" -Raw | ConvertFrom-Json).version
$base = Join-Path $work 'published-base.exe'
$baseUrl = 'https://mmo.fantasy-arena.de/downloads/desktop/fantasy-arena-mmo-0.45.23-win-x64.exe'
$baseSha256 = '6489cafca740678586ba39bb49d66328d8212902a75fda16db4fd89f683328a0'
curl.exe --fail --silent --show-error --proto '=https' --retry 2 --max-time 420 --output $base $baseUrl
if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath $base).Hash -ne $baseSha256) {
    throw 'The published Windows reference installer is unavailable or changed.'
}

# Extract a data input from the pinned old installer without executing it.
$sevenZip = Join-Path $env:ProgramFiles '7-Zip/7z.exe'
& $sevenZip e -bd -y "-o$work" $base '$PLUGINSDIR/app-64.7z' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not extract the pinned NSIS payload.' }
& $sevenZip e -bd -y "-o$work" "$work/app-64.7z" 'resources/app.asar' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not extract the pinned release ASAR.' }
node "$PSScriptRoot/prepare-windows-qa.mjs" "$work/app.asar" $work
if ($LASTEXITCODE -ne 0) { throw 'Could not assemble the QA application.' }

Push-Location -LiteralPath $root
try {
    & "$PSScriptRoot/Build-Windows.ps1" -ApplicationDirectory "$work/app" -OutputDirectory "$work/build" -IconFile icon.png
} finally {
    Pop-Location
}
$installer = Join-Path $work "build/fantasy-arena-mmo-$version-win-x64.exe"
$installed = Join-Path $work 'installed'
$setup = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$installed") -WindowStyle Hidden -Wait -PassThru
if ($setup.ExitCode -ne 0) { throw "NSIS installation exited with $($setup.ExitCode)." }
$builtAsar = (Get-FileHash -LiteralPath "$work/build/win-unpacked/resources/app.asar").Hash
$installedAsar = (Get-FileHash -LiteralPath "$installed/resources/app.asar").Hash
if ($installedAsar -ne $builtAsar) { throw 'Installed ASAR differs from this build.' }
$client = Join-Path $installed 'Fantasy Arena MMO.exe'
if (!(Test-Path -LiteralPath "$installed/Uninstall Fantasy Arena MMO.exe" -PathType Leaf)) {
    throw 'NSIS uninstaller is missing.'
}
node "$PSScriptRoot/smoke-windows-qa.mjs" $client "$work/profile" $version "$work/login-proof.json"
if ($LASTEXITCODE -ne 0) { throw 'The installed Windows client failed its smoke test.' }

[ordered]@{
    commit = $env:GITHUB_SHA
    installer = Get-Content -LiteralPath "$work/build/unsigned-build-proof.json" -Raw | ConvertFrom-Json
    baseInstallerSha256 = $baseSha256
    installedAsarSha256 = $installedAsar.ToLowerInvariant()
    installed = Get-Content -LiteralPath "$work/login-proof.json" -Raw | ConvertFrom-Json
    scope = 'unsigned CI test using pinned released static inputs'
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$work/installer-proof.json" -Encoding utf8NoBOM
Get-Content -LiteralPath "$work/installer-proof.json"
