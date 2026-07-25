CREATE TABLE `monitoring_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`week_key` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`monitor_count` integer NOT NULL,
	`monitor_snapshot` text NOT NULL,
	`trigger_type` text DEFAULT 'manual' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`completed_at` text,
	`error_message` text
);
