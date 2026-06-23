$ErrorActionPreference = "Continue"

$ProjectRoot = "D:\stellar\battery_passport"
$ContractWorkspace = Join-Path $ProjectRoot "contract_workspace"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$WasmPath = Join-Path $ContractWorkspace "target\wasm32v1-none\release\battery_passport.wasm"
$ContractInfoPath = Join-Path $ProjectRoot "CONTRACT_ID.txt"
$EnvLocalPath = Join-Path $FrontendDir ".env.local"
$ContractConfigPath = Join-Path $FrontendDir "src\contractConfig.ts"
$DeployLogPath = Join-Path $ProjectRoot "deploy-output.txt"

function Stop-If-Failed {
  param (
    [string]$StepName
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$StepName failed. Please check the error above."
  }
}

function Run-Deploy {
  param (
    [string]$SourceFlag
  )

  Write-Host ""
  Write-Host "Deploy command using $SourceFlag alice..." -ForegroundColor Gray

  $output = & stellar contract deploy `
    --wasm $WasmPath `
    $SourceFlag alice `
    --network testnet 2>&1

  $exitCode = $LASTEXITCODE
  $text = ($output | ForEach-Object { $_.ToString() }) -join "`n"

  Write-Host $text

  return @{
    ExitCode = $exitCode
    Text = $text
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Battery Passport Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (!(Test-Path $ContractWorkspace)) {
  throw "Contract workspace not found: $ContractWorkspace"
}

if (!(Test-Path $FrontendDir)) {
  throw "Frontend folder not found: $FrontendDir"
}

Set-Location $ContractWorkspace

Write-Host "Step 1/4: Running contract tests..." -ForegroundColor Yellow
cargo test
Stop-If-Failed "cargo test"

Write-Host ""
Write-Host "Step 2/4: Building contract wasm..." -ForegroundColor Yellow
stellar contract build
Stop-If-Failed "stellar contract build"

if (!(Test-Path $WasmPath)) {
  throw "WASM file not found: $WasmPath"
}

Write-Host ""
Write-Host "Step 3/4: Deploying contract to Stellar Testnet..." -ForegroundColor Yellow
Write-Host "Using wasm: $WasmPath" -ForegroundColor Gray

$deployResult = Run-Deploy "--source-account"

if ($deployResult.ExitCode -ne 0) {
  Write-Host ""
  Write-Host "Deploy with --source-account failed. Trying --source..." -ForegroundColor Yellow
  $deployResult = Run-Deploy "--source"
}

if ($deployResult.ExitCode -ne 0) {
  Set-Content -Path $DeployLogPath -Value $deployResult.Text -Encoding UTF8
  Write-Host ""
  Write-Host "Deploy failed. Full log saved to:" -ForegroundColor Red
  Write-Host $DeployLogPath -ForegroundColor Red
  throw "Contract deploy failed."
}

Set-Content -Path $DeployLogPath -Value $deployResult.Text -Encoding UTF8

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
Write-Host "Step 4/4: Saving Contract ID..." -ForegroundColor Yellow

Set-Content -Path $ContractInfoPath -Value $contractId -Encoding UTF8
Set-Content -Path $EnvLocalPath -Value "VITE_CONTRACT_ID=$contractId" -Encoding UTF8

$contractConfigContent = @"
export const CONTRACT_ID =
  "$contractId";
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
Write-Host "Saved to:" -ForegroundColor Cyan
Write-Host $ContractInfoPath
Write-Host $EnvLocalPath
Write-Host $ContractConfigPath
Write-Host $DeployLogPath
Write-Host ""
Write-Host "Next step:" -ForegroundColor Cyan
Write-Host "cd D:\stellar\battery_passport\frontend"
Write-Host "npm run dev"
Write-Host ""
Write-Host "IMPORTANT: If frontend is already running, stop it with Ctrl+C and run npm run dev again." -ForegroundColor Yellow
Write-Host ""