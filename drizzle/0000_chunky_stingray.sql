CREATE TABLE IF NOT EXISTS `records` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`score` integer NOT NULL,
	`minutes` integer NOT NULL,
	`status` text NOT NULL,
	`notes` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`note` text NOT NULL,
	`file` text NOT NULL,
	`page` integer NOT NULL
);
