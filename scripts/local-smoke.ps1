#Requires -Version 5.1
<#
.SYNOPSIS
    Run local smoke tests against the Docker Compose stack built from source.

.DESCRIPTION
    Starts the full stack (app, backend, mcp, worker, beat, postgres, redis) using
    local source builds, then verifies health endpoints, migrations, and encryption.

    Prerequisites:
    - Docker Desktop running
    - deploy/compose/.env (copy from .env.example and set required vars)

.EXAMPLE
    .\scripts\local-smoke.ps1
#>

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $RootDir "deploy/compose/.env"

if (-not (Test-Path $EnvFile -PathType Leaf)) {
    Write-Host "Missing $EnvFile." -ForegroundColor Red
    Write-Host "Copy deploy/compose/.env.example to deploy/compose/.env and set required secrets first."
    exit 1
}

# Parse .env for POSTGRES_USER, POSTGRES_DB (with defaults)
$PostgresUser = "financeuser"
$PostgresDb = "finance_db"
foreach ($line in Get-Content $EnvFile -ErrorAction SilentlyContinue) {
    if ($line -match '^\s*POSTGRES_USER=(.+)$') { $PostgresUser = $Matches[1].Trim().Trim('"') }
    if ($line -match '^\s*POSTGRES_DB=(.+)$') { $PostgresDb = $Matches[1].Trim().Trim('"') }
}

function Invoke-Compose {
    docker compose `
        --env-file $EnvFile `
        -f (Join-Path $RootDir "deploy/compose/docker-compose.yml") `
        -f (Join-Path $RootDir "deploy/compose/docker-compose.local.yml") `
        @args
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Wait-ForUrl {
    param([string]$Url, [int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            return
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    Write-Host "[smoke] Timeout waiting for $Url" -ForegroundColor Red
    exit 1
}

Write-Host "[smoke] Starting local stack from source..." -ForegroundColor Cyan
Invoke-Compose up -d --build

Write-Host "[smoke] Waiting for app/backend/mcp health..." -ForegroundColor Cyan
Wait-ForUrl -Url "http://localhost:8080/"
Wait-ForUrl -Url "http://localhost:8080/api/health"
Wait-ForUrl -Url "http://localhost:8001/health"

Write-Host "[smoke] Verifying Drizzle migration table exists..." -ForegroundColor Cyan
$migrationCmd = "psql -U `"$PostgresUser`" -d `"$PostgresDb`" -c `"select count(*) as migration_rows from drizzle.__drizzle_migrations;`""
Invoke-Compose exec -T postgres sh -lc $migrationCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[smoke] Verifying encryption helper roundtrip..." -ForegroundColor Cyan
Invoke-Compose exec -T backend python tests/test_data_encryption.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[smoke] All checks passed." -ForegroundColor Green
