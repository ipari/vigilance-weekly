ALTER TABLE `monitoring_runs` ADD `failed_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `last_activity_at` text;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `step_lock_token` text;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `step_lock_at` text;