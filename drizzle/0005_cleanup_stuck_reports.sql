DELETE FROM `monitoring_runs`
WHERE (`id` = 10 AND `week_key` = '2026-W30' AND `report_sequence` = 2)
   OR (`id` = 9 AND `week_key` = '2026-W30' AND `report_sequence` = 5);
