ALTER TABLE `monitoring_runs` ADD `custom_name` text;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `frequency` text DEFAULT 'once' NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `weekday` integer;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `time_of_day` text DEFAULT '06:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `last_run_at` text;--> statement-breakpoint
ALTER TABLE `scheduled_runs` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
INSERT INTO `scheduled_runs` (
  `execute_at`, `frequency`, `weekday`, `time_of_day`, `status`,
  `active`, `requested_by`
)
SELECT
  strftime(
    '%Y-%m-%dT%H:%M:%SZ',
    datetime(
      date(datetime('now', '+9 hours')),
      printf(
        '+%d days',
        CASE
          WHEN CAST(strftime('%w', datetime('now', '+9 hours')) AS integer) = 1
            AND time(datetime('now', '+9 hours')) < '06:00:00'
          THEN 0
          WHEN ((8 - CAST(strftime('%w', datetime('now', '+9 hours')) AS integer)) % 7) = 0
          THEN 7
          ELSE ((8 - CAST(strftime('%w', datetime('now', '+9 hours')) AS integer)) % 7)
        END
      ),
      '06:00',
      '-9 hours'
    )
  ),
  'weekly', 1, '06:00', 'pending', 1, 'site-scheduler@vigilance-weekly'
WHERE NOT EXISTS (
  SELECT 1 FROM `scheduled_runs`
  WHERE `frequency` = 'weekly' AND `weekday` = 1 AND `time_of_day` = '06:00'
);
