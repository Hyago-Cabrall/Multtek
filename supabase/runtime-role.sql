-- Execute once as the migration owner. Then set a password securely and enable LOGIN.
-- No password belongs in this file or Git history.
CREATE ROLE multtek_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA multtek TO multtek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA multtek TO multtek_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA multtek TO multtek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA multtek GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO multtek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA multtek GRANT USAGE, SELECT ON SEQUENCES TO multtek_app;
