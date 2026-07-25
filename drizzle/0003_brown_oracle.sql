ALTER TABLE `monitoring_runs` ADD `stage` text DEFAULT '실행 대기' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `progress` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `completed_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `total_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `literature_results` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `monitoring_runs` ADD `regulatory_results` text DEFAULT '[]' NOT NULL;