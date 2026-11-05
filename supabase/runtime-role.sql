-- Execute once as the migration owner. Then set a password securely and enable LOGIN.
-- No password belongs in this file or Git history.
CREATE ROLE multtek_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA multtek TO multtek_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA multtek TO multtek_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA multtek TO multtek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA multtek GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO multtek_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA multtek GRANT USAGE, SELECT ON SEQUENCES TO multtek_app;

-- Only the trusted server role can use these policies. App authorization remains in the API.
CREATE POLICY multtek_backend ON multtek.users FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.settings FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.attempts FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.clients FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.stages FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.origins FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.sessions FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.tasks FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.history FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.notifications FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.attachments FOR ALL TO multtek_app USING (true) WITH CHECK (true);
CREATE POLICY multtek_backend ON multtek.subscriptions FOR ALL TO multtek_app USING (true) WITH CHECK (true);
