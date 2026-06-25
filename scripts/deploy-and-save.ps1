$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendDir = Join-Path $ProjectRoot "frontend"
$WasmPath = Join-Path $ProjectRoot "target\wasm32v1-none\release\battery_passport.wasm"
$ContractInfoPath = Join-Path $ProjectRoot "CONTRACT_ID.txt"
$ContractConfigPath = Join-Path $FrontendDir "src\contractConfig.ts"
$DeployLogPath = Join-Path $ProjectRoot "deploy-output.txt"
$IdentityName = "battery_passport_admin"

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )

  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
}

function Stop-If-Failed {
  param([string]$StepName)

  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed. Please check the terminal output above."
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Battery Passport Level 4 Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot

Write-Host "Step 1/6: Formatting contract..." -ForegroundColor Yellow
cargo fmt
Stop-If-Failed "cargo fmt"

Write-Host ""
Write-Host "Step 2/6: Running contract tests..." -ForegroundColor Yellow
cargo test --workspace
Stop-If-Failed "cargo test"

Write-Host ""
Write-Host "Step 3/6: Building contract wasm..." -ForegroundColor Yellow
stellar contract build
Stop-If-Failed "stellar contract build"

if (!(Test-Path $WasmPath)) {
  throw "WASM file not found: $WasmPath"
}

Write-Host ""
Write-Host "Step 4/6: Checking Stellar Testnet identity..." -ForegroundColor Yellow
$AddressOutput = & stellar keys address $IdentityName 2>$null

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($AddressOutput)) {
  Write-Host "Identity not found. Creating and funding Testnet identity: $IdentityName" -ForegroundColor Yellow
  stellar keys generate --fund $IdentityName --network testnet
  Stop-If-Failed "stellar keys generate"
} else {
  Write-Host "Using identity: $IdentityName" -ForegroundColor Green
  Write-Host $AddressOutput
}

Write-Host ""
Write-Host "Step 5/6: Deploying contract to Stellar Testnet..." -ForegroundColor Yellow
Write-Host "Using wasm: $WasmPath" -ForegroundColor Gray

$StdOutPath = Join-Path $ProjectRoot "deploy-stdout.tmp"
$StdErrPath = Join-Path $ProjectRoot "deploy-stderr.tmp"

$Arguments = @(
  "contract",
  "deploy",
  "--wasm",
  $WasmPath,
  "--source-account",
  $IdentityName,
  "--network",
  "testnet"
)

$Process = Start-Process `
  -FilePath "stellar" `
  -ArgumentList $Arguments `
  -NoNewWindow `
  -Wait `
  -PassThru `
  -RedirectStandardOutput $StdOutPath `
  -RedirectStandardError $StdErrPath

$StdOut = if (Test-Path $StdOutPath) { Get-Content $StdOutPath -Raw } else { "" }
$StdErr = if (Test-Path $StdErrPath) { Get-Content $StdErrPath -Raw } else { "" }
$DeployText = "$StdOut`n$StdErr"

Write-Utf8NoBom $DeployLogPath $DeployText
Write-Host $DeployText

if ($Process.ExitCode -ne 0) {
  throw "Contract deploy failed. Full log saved to $DeployLogPath"
}

$ContractMatches = [regex]::Matches($DeployText, "C[A-Z0-9]{55}")

if ($ContractMatches.Count -eq 0) {
  throw "Could not automatically find Contract ID. Check deploy-output.txt."
}

$ContractId = $ContractMatches[$ContractMatches.Count - 1].Value

Write-Host ""
Write-Host "Step 6/6: Saving Contract ID..." -ForegroundColor Yellow

Write-Utf8NoBom $ContractInfoPath $ContractId

$ContractConfigContent = @"
import { Networks } from "@stellar/stellar-sdk";

export const CONTRACT_ID = "$ContractId";
export const RPC_URL = "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = Networks.TESTNET;

export const STELLAR_EXPERT_CONTRACT_URL = `https://stellar.expert/explorer/testnet/contract/` + CONTRACT_ID;
export const STELLAR_EXPERT_TX_URL = "https://stellar.expert/explorer/testnet/tx";
"@

Write-Utf8NoBom $ContractConfigPath $ContractConfigContent

Remove-Item $StdOutPath -Force -ErrorAction SilentlyContinue
Remove-Item $StdErrPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Deploy completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Contract ID:" -ForegroundColor Cyan
Write-Host $ContractId -ForegroundColor White
Write-Host ""
Write-Host "Contract Explorer:" -ForegroundColor Cyan
Write-Host "https://stellar.expert/explorer/testnet/contract/$ContractId"
Write-Host ""
Write-Host "Saved to:" -ForegroundColor Cyan
Write-Host $ContractInfoPath
Write-Host $ContractConfigPath
Write-Host $DeployLogPath