#!/usr/bin/env sh
# Creates a timestamped database backup from the Docker setup.
# Usage: sh scripts/backup.sh   ->  backups/hr-YYYYMMDD-HHMMSS.sql
set -e
mkdir -p backups
FILE="hr-$(date +%Y%m%d-%H%M%S).sql"
docker compose exec -T db pg_dump -U hr -f "/tmp/$FILE" hr_management
docker compose cp "db:/tmp/$FILE" "backups/$FILE"
docker compose exec -T db rm "/tmp/$FILE"
echo "Backup saved: backups/$FILE"
