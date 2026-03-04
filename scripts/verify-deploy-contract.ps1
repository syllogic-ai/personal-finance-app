#Requires -Version 5.1
<#
.SYNOPSIS
    Verify the deployment contract (Windows equivalent of verify-deploy-contract.sh).

.DESCRIPTION
    Checks that required deployment files exist and contain expected patterns.
    Run from the repository root.

.EXAMPLE
    .\scripts\verify-deploy-contract.ps1
#>

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot

function Require-File {
    param([string]$Path)
    if (-not (Test-Path -Path $Path -PathType Leaf)) {
        Write-Host "[contract] Missing required file: $Path" -ForegroundColor Red
        exit 1
    }
}

function Assert-Contains {
    param(
        [string]$FilePath,
        [string]$Pattern
    )
    if (-not (Test-Path -Path $FilePath -PathType Leaf)) {
        Write-Host "[contract] Missing required file: $FilePath" -ForegroundColor Red
        exit 1
    }
    $content = Get-Content -Path $FilePath -Raw -ErrorAction Stop
    if ($content -notlike "*$Pattern*") {
        Write-Host "[contract] Expected pattern not found in $FilePath : $Pattern" -ForegroundColor Red
        exit 1
    }
}

# Required files
Require-File -Path (Join-Path $RootDir "docs/deployment-matrix.md")
Require-File -Path (Join-Path $RootDir "frontend/railway.toml")
Require-File -Path (Join-Path $RootDir "backend/railway.api.toml")
Require-File -Path (Join-Path $RootDir "backend/railway.worker.toml")
Require-File -Path (Join-Path $RootDir "backend/railway.beat.toml")
Require-File -Path (Join-Path $RootDir "backend/railway.mcp.toml")
Require-File -Path (Join-Path $RootDir "scripts/local-smoke.sh")
Require-File -Path (Join-Path $RootDir "scripts/local-smoke.ps1")

# Assert patterns (literal substring match, like grep -qF)
Assert-Contains -FilePath (Join-Path $RootDir "docker-compose.yml") -Pattern "postgres:16-alpine"
Assert-Contains -FilePath (Join-Path $RootDir "deploy/compose/docker-compose.yml") -Pattern "postgres:16-alpine"
Assert-Contains -FilePath (Join-Path $RootDir "deploy/railway/docker-compose.yml") -Pattern "mcp"
Assert-Contains -FilePath (Join-Path $RootDir "deploy/railway/docker-compose.yml") -Pattern "/health"
Assert-Contains -FilePath (Join-Path $RootDir "docs/deployment-matrix.md") -Pattern "edge"
Assert-Contains -FilePath (Join-Path $RootDir "docs/deployment-matrix.md") -Pattern "vX.Y.Z"

Write-Host "[contract] Deployment contract checks passed." -ForegroundColor Green
