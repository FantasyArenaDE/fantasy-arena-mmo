param(
    [Parameter(Mandatory)][string]$ApplicationDirectory,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$BuilderCli,
    [string]$ElectronDist,
    [ValidateSet('icon.ico','icon.png')][string]$IconFile = 'icon.ico'
)

$ErrorActionPreference = 'Stop'
if ($env:CSC_LINK -or $env:WIN_CSC_LINK) {
    throw 'Remove explicit local signing credentials from the unsigned build environment.'
}
$app = (Resolve-Path -LiteralPath $ApplicationDirectory).Path
$package = Get-Content -LiteralPath (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
if ($package.name -cne 'fantasy-arena-mmo' -or $package.productName -cne 'Fantasy Arena MMO' -or
    $package.version -notmatch '^(0|[1-9][0-9]{0,5})(\.(0|[1-9][0-9]{0,5})){2}$') {
    throw 'Unexpected Windows package identity.'
}
foreach ($file in 'electron/main.cjs','electron/beta_update_policy.cjs','electron/vendor/electron_updater.cjs',
                  'dist/index.html','dist/LICENSE','dist/CREDITS.md',"build/$IconFile",'host-diag/HostDiag.ps1') {
    if (!(Test-Path -LiteralPath (Join-Path $app $file) -PathType Leaf)) {
        throw "Build input is missing $file"
    }
}
if (Test-Path -LiteralPath $OutputDirectory) { throw 'Choose a fresh Windows build output directory.' }
$output = (New-Item -ItemType Directory -Path $OutputDirectory).FullName
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$config = [ordered]@{
    appId = 'de.fantasy-arena.mmo'
    productName = 'Fantasy Arena MMO'
    electronVersion = '43.8.1'
    artifactName = 'fantasy-arena-mmo-${version}-win-x64.${ext}'
    forceCodeSigning = $false
    npmRebuild = $false
    compression = 'store'
    detectUpdateChannel = $false
    directories = @{ app=$app; buildResources=(Join-Path $app 'build'); output=$output }
    files = @('dist/**','electron/**','build/icon.png','package.json')
    extraResources = @(@{ from=(Join-Path $app 'host-diag/HostDiag.ps1'); to='host-diag/HostDiag.ps1' })
    publish = @{ provider='generic'; channel='beta'; useMultipleRangeRequest=$false
                 url='https://mmo.fantasy-arena.de/downloads/updates/beta/windows/' }
    electronFuses = @{
        runAsNode=$false; enableCookieEncryption=$true; enableNodeOptionsEnvironmentVariable=$false
        enableNodeCliInspectArguments=$false; grantFileProtocolExtraPrivileges=$false
        onlyLoadAppFromAsar=$true; enableEmbeddedAsarIntegrityValidation=$true
    }
    win = @{ target=@(@{target='nsis';arch=@('x64')}); icon=(Join-Path $app "build/$IconFile") }
    nsis = @{ oneClick=$true; perMachine=$false }
}
if ($ElectronDist) { $config.electronDist = (Resolve-Path -LiteralPath $ElectronDist).Path }
if ($package.wocDesktop.startupPatcher) {
    $publisher = $package.wocDesktop.updatePublisherName
    if (!$package.wocDesktop.autoUpdates -or $package.wocDesktop.updateTrack -ne 'beta' -or
        $package.wocDesktop.updatePublisherThumbprint -notmatch '^[A-Fa-f0-9]{40}$' -or
        [string]::IsNullOrWhiteSpace($publisher)) { throw 'The production updater stamp is incomplete.' }
    $config.win.signtoolOptions = @{ publisherName=@($publisher) }
}
$configPath = Join-Path $output 'builder.json'
$config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding utf8NoBOM
$arguments = @('--win','nsis','--x64','--projectDir',$app,'--config',$configPath,'--publish','never')
if ($BuilderCli) {
    & node (Resolve-Path -LiteralPath $BuilderCli).Path @arguments
} else {
    & pnpm exec electron-builder @arguments
}
if ($LASTEXITCODE -ne 0) { throw "electron-builder exited with $LASTEXITCODE" }

$updaterConfig = Get-Content -LiteralPath (Join-Path $output 'win-unpacked/resources/app-update.yml') -Raw
if ($updaterConfig -notmatch '(?m)^updaterCacheDirName: \S' -or
    $updaterConfig -notmatch '(?m)^channel: beta\s*$' -or
    $updaterConfig -notmatch 'https://mmo\.fantasy-arena\.de/downloads/updates/beta/windows/') {
    throw 'The packed updater config does not match the production channel.'
}
$installer = Get-Item -LiteralPath (Join-Path $output "fantasy-arena-mmo-$($package.version)-win-x64.exe")
if ((Get-AuthenticodeSignature -LiteralPath $installer.FullName).Status -ne 'NotSigned') {
    throw 'Expected an unsigned artifact awaiting the designated SignPath step.'
}
[ordered]@{
    version=$package.version; installer=$installer.Name; size=$installer.Length
    sha512=(Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA512).Hash.ToLowerInvariant()
    signPathSubmission=$false; startupPatcher=$package.wocDesktop.startupPatcher
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'unsigned-build-proof.json') -Encoding utf8NoBOM
