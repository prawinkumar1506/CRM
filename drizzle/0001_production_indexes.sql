CREATE INDEX IF NOT EXISTS customers_assigned_idx ON customers(assigned);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_customer_created_idx ON events(customer_id,created);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS files_customer_idx ON files(customer_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS outbox_state_created_idx ON outbox(state,created);
--> statement-breakpoint
CREATE TABLE webhook_inbox(id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL);
