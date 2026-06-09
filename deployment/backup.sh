#!/bin/bash
# -----------------------------------------------------------------------------
# Linux production database backup automation script
# -----------------------------------------------------------------------------
BACKUP_DIR="/var/www/mitwpu-exam/server/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Make sure directory exists
mkdir -p "$BACKUP_DIR"

# Source environment variables to get DB credentials
if [ -f "/var/www/mitwpu-exam/server/.env" ]; then
    export $(cat /var/www/mitwpu-exam/server/.env | grep -v '^#' | xargs)
fi

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-1234}"
export PGDATABASE="${PGDATABASE:-exam_management}"

# Execute PostgreSQL Dump
echo "Dumping database $PGDATABASE to $BACKUP_FILE..."
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -F c -b -v -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✓ Database backup completed successfully: $BACKUP_FILE"
    # Keep only last 30 backups
    find "$BACKUP_DIR" -name "db_backup_*.sql" -mtime +30 -delete
    echo "✓ Cleaned backups older than 30 days."
else
    echo "❌ Database backup failed!"
    exit 1
fi
