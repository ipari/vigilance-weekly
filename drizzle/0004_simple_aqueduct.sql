CREATE TABLE `scheduled_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`execute_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`run_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`canceled_at` text,
	`error_message` text
);
