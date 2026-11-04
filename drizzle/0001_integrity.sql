CREATE TRIGGER users_keep_last_admin BEFORE UPDATE OF active,deleted,role ON users
WHEN OLD.role='admin' AND OLD.active=1 AND OLD.deleted=0
 AND (NEW.role<>'admin' OR NEW.active=0 OR NEW.deleted=1)
 AND (SELECT COUNT(*) FROM users WHERE role='admin' AND active=1 AND deleted=0)<=1
BEGIN SELECT RAISE(ABORT,'last_admin'); END;
--> statement-breakpoint
CREATE TRIGGER users_keep_open_assignments BEFORE UPDATE OF active,deleted ON users
WHEN (NEW.active=0 OR NEW.deleted=1)
 AND EXISTS(SELECT 1 FROM tasks t JOIN stages s ON s.id=t.stage_id WHERE t.assignee_id=OLD.id AND t.deleted=0 AND s.done=0)
BEGIN SELECT RAISE(ABORT,'open_assignments'); END;
--> statement-breakpoint
CREATE TRIGGER tasks_creator_immutable BEFORE UPDATE OF creator_id ON tasks
WHEN OLD.creator_id<>NEW.creator_id
BEGIN SELECT RAISE(ABORT,'immutable_creator'); END;
--> statement-breakpoint
CREATE TRIGGER tasks_active_assignee_insert BEFORE INSERT ON tasks
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.assignee_id AND active=1 AND deleted=0)
BEGIN SELECT RAISE(ABORT,'inactive_assignee'); END;
--> statement-breakpoint
CREATE TRIGGER tasks_active_assignee_update BEFORE UPDATE OF assignee_id ON tasks
WHEN OLD.assignee_id<>NEW.assignee_id AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.assignee_id AND active=1 AND deleted=0)
BEGIN SELECT RAISE(ABORT,'inactive_assignee'); END;
--> statement-breakpoint
CREATE INDEX tasks_stage_idx ON tasks(stage_id,deleted);
--> statement-breakpoint
CREATE INDEX tasks_assignee_idx ON tasks(assignee_id,deleted);
--> statement-breakpoint
CREATE INDEX notifications_recipient_idx ON notifications(user_id,created);
--> statement-breakpoint
CREATE INDEX notifications_outbox_idx ON notifications(sent,next_attempt);
--> statement-breakpoint
CREATE INDEX sessions_user_idx ON sessions(user_id);
--> statement-breakpoint
CREATE INDEX history_task_idx ON history(task_id,created);
--> statement-breakpoint
CREATE INDEX attachments_task_idx ON attachments(task_id);
