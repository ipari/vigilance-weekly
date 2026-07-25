CREATE TABLE `monitors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`ingredient` text NOT NULL,
	`product_name` text DEFAULT '' NOT NULL,
	`aliases` text DEFAULT '' NOT NULL,
	`regions` text DEFAULT 'KR,US,EU' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
