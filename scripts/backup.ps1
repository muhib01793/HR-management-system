# Creates a timestamped database backup from the Docker setup (Windows PowerShell).
# Usage: .\scripts\backup.ps1   ->  backups\hr-YYYYMMDD-HHMMSS.sql
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path backups | Out-Null
$file = "hr-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".sql"
docker compose exec -T db pg_dump -U hr -f "/tmp/$file" hr_management
docker compose cp "db:/tmp/$file" "backups/$file"
docker compose exec -T db rm "/tmp/$file"
Write-Host "Backup saved: backups\$file"
