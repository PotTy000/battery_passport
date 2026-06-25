$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ContractWorkspace = Join-Path $ProjectRoot "contract_workspace"
$FrontendDir = Join-Path $ProjectRoot "frontend"

$ContractName = "battery_passport"
$IdentityName = "alice"
$Network = "testnet"

$WasmPath = Join-Path $ContractWorkspace "target\wasm32v1-none\release\$ContractName.wasm"
$ContractInfoPath = Join-Path $ProjectRoot "CONTRACT_ID.txt"
$EnvLocalPath = Join-Path $FrontendDir ".env.local"
$ContractConfigPath = Join-Path $FrontendDir "src\contractConfig.ts"
$DeployLogPath = Join-Path $ProjectRoot "deploy-output.txt"

function Write-Section {
    param([string]$Message)

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (!(Test-Path $Path)) {
        throw "$Label not found: $Path"
    }
}

function Invoke-CheckedCommand {
    param(
        [string]$StepName,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host $StepName -ForegroundColor Yellow

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$StepName failed. Please check the error above."
    }
}

function Ensure-TestnetIdentity {
    Write-Host ""
    Write-Host "Checking Stellar identity: $IdentityName" -ForegroundColor Yellow

    $addressOutput = & stellar keys address $IdentityName 2>&1
    $addressExitCode = $LASTEXITCODE

    if ($addressExitCode -eq 0) {
        $address = ($addressOutput | ForEach-Object { $_.ToString() }) -join "`n"
        Write-Host "Identity found:" -ForegroundColor Green
        Write-Host $address
        return
    }

    Write-Host "Identity not found. Creating and funding testnet identity..." -ForegroundColor Yellow

    & stellar keys generate --fund $IdentityName --network $Network

    if ($LASTEXITCODE -ne 0) {
        throw "Could not create/fund Stellar identity: $IdentityName"
    }

    $newAddress = & stellar keys address $IdentityName
    Write-Host "Identity created:" -ForegroundColor Green
    Write-Host $newAddress
}

function Invoke-Deploy {
    param([string]$SourceFlag)

    Write-Host ""
    Write-Host "Deploy command using $SourceFlag $IdentityName..." -ForegroundColor Gray

    $output = & stellar contract deploy `
        --wasm $WasmPath `
        $SourceFlag $IdentityName `
        --network $Network 2>&1

    $exitCode = $LASTEXITCODE
    $text = ($output | ForEach-Object { $_.ToString() }) -join "`n"

    Write-Host $text

    return @{
        ExitCode = $exitCode
        Text = $text
    }
}

Write-Section "Battery Passport Deploy Script"

Write-Host "Project root:" -ForegroundColor Cyan
Write-Host $ProjectRoot

Assert-PathExists $ContractWorkspace "Contract workspace"
Assert-PathExists $FrontendDir "Frontend folder"
Assert-PathExists $ContractConfigPath "Frontend contract config file"

Push-Location $ContractWorkspace

try {
    Invoke-CheckedCommand "Step 1/5: Formatting Rust contract..." {
        cargo fmt
    }

    Invoke-CheckedCommand "Step 2/5: Running contract tests..." {
        cargo test
    }

    Invoke-CheckedCommand "Step 3/5: Building contract WASM..." {
        stellar contract build
    }
}
finally {
    Pop-Location
}

Assert-PathExists $WasmPath "Built WASM file"

Ensure-TestnetIdentity

Write-Host ""
Write-Host "Step 4/5: Deploying contract to Stellar Testnet..." -ForegroundColor Yellow
Write-Host "Using WASM:" -ForegroundColor Gray
Write-Host $WasmPath

$deployResult = Invoke-Deploy "--source-account"

if ($deployResult.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Deploy with --source-account failed. Trying --source..." -ForegroundColor Yellow
    $deployResult = Invoke-Deploy "--source"
}

Set-Content -Path $DeployLogPath -Value $deployResult.Text -Encoding UTF8

if ($deployResult.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "Deploy failed. Full log saved to:" -ForegroundColor Red
    Write-Host $DeployLogPath -ForegroundColor Red
    throw "Contract deploy failed."
}

$contractMatches = [regex]::Matches($deployResult.Text, "C[A-Z0-9]{55}")

if ($contractMatches.Count -eq 0) {
    Write-Host ""
    Write-Host "Could not automatically find Contract ID." -ForegroundColor Red
    Write-Host "Full deploy output saved to:" -ForegroundColor Yellow
    Write-Host $DeployLogPath -ForegroundColor Yellow
    throw "Please copy Contract ID manually from the terminal output."
}

$contractId = $contractMatches[$contractMatches.Count - 1].Value

Write-Host ""
Write-Host "Step 5/5: Saving Contract ID..." -ForegroundColor Yellow

Set-Content -Path $ContractInfoPath -Value $contractId -Encoding UTF8
Set-Content -Path $EnvLocalPath -Value "VITE_CONTRACT_ID=$contractId" -Encoding UTF8

$contractConfigContent = @"
export const CONTRACT_ID = "$contractId";

export const NETWORK = "testnet";

export const STELLAR_EXPERT_CONTRACT_URL =
  "https://stellar.expert/explorer/testnet/contract/$contractId";
"@

Set-Content -Path $ContractConfigPath -Value $contractConfigContent -Encoding UTF8

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Deploy completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host ""
Write-Host "Contract ID:" -ForegroundColor Cyan
Write-Host $contractId -ForegroundColor White

Write-Host ""
Write-Host "Stellar Expert contract link:" -ForegroundColor Cyan
Write-Host "https://stellar.expert/explorer/testnet/contract/$contractId"

Write-Host ""
Write-Host "Saved to:" -ForegroundColor Cyan
Write-Host $ContractInfoPath
Write-Host $EnvLocalPath
Write-Host $ContractConfigPath
Write-Host $DeployLogPath

Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "cd $FrontendDir"
Write-Host "npm run dev"

Write-Host ""
Write-Host "IMPORTANT: If frontend is already running, stop it with Ctrl+C and run npm run dev again." -ForegroundColor Yellow