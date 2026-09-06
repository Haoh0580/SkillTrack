CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_id` text NOT NULL,
	`language` text NOT NULL,
	`source` text NOT NULL,
	`verdict` text NOT NULL,
	`passed` integer NOT NULL,
	`total` integer NOT NULL,
	`elapsed_ms` integer,
	`stdout` text,
	`stderr` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_problem_created` ON `submissions` (`problem_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_submissions_created` ON `submissions` (`created_at`);