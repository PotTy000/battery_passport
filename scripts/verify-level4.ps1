$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Battery Passport Level 4 Verification" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1/6 Rust format" -ForegroundColor Yellow
cargo fmt --all -- --check

Write-Host "2/6 Contract tests" -ForegroundColor Yellow
cargo test --workspace

Write-Host "3/6 Contract build" -ForegroundColor Yellow
stellar contract build

Write-Host "4/6 Frontend build" -ForegroundColor Yellow
Push-Location frontend
npm install
npm run type-check
npm run build
npm test
Pop-Location

Write-Host "5/6 Backend build" -ForegroundColor Yellow
Push-Location server
npm install
npm run type-check
npm run build
Pop-Location

Write-Host "6/6 Deployment config check" -ForegroundColor Yellow
$RequiredFiles = @(
  ".github/workflows/ci.yml",
  "vercel.json",
  "railway.toml",
  "Procfile",
  "scripts/deploy-and-save.ps1",
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/QUALITY_AND_DEPLOYMENT.md"
)

foreach ($File in $RequiredFiles) {
  if (!(Test-Path $File)) {
    throw "Missing required file: $File"
  }

  Write-Host "Found $File" -ForegroundColor Green
}

Write-Host ""
Write-Host "Level 4 verification passed locally." -ForegroundColor Green
