@echo off
rem -----------------------------------------------------------------------------
rem Windows Task Scheduler database backup automation script
rem -----------------------------------------------------------------------------

set BACKUP_DIR=C:\Users\mrudu\Documents\Codes\exam\server\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

rem Format timestamp (YYYYMMDD_HHMMSS)
set CUR_DATE=%date:~10,4%%date:~4,2%%date:~7,2%
set CUR_TIME=%time:~0,2%%time:~3,2%%time:~6,2%
set CUR_TIME=%CUR_TIME: =0%
set TIMESTAMP=%CUR_DATE%_%CUR_TIME%
set BACKUP_FILE=%BACKUP_DIR%\db_backup_%TIMESTAMP%.sql

rem Database configuration
set PGHOST=localhost
set PGPORT=5432
set PGUSER=postgres
set PGPASSWORD=1234
set PGDATABASE=exam_management

echo Dumping database %PGDATABASE% to %BACKUP_FILE%...
pg_dump -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -F c -b -v -f "%BACKUP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo Backup completed successfully: %BACKUP_FILE%
) else (
    echo Database backup failed!
    exit /b 1
)
