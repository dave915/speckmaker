CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`mockup_id` text NOT NULL,
	`revision` integer NOT NULL,
	`storage_key` text NOT NULL,
	`screens` text NOT NULL,
	`kind` text NOT NULL,
	`author` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`model` text,
	`restored_from` integer,
	`label` text,
	`version_number` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`mockup_id`) REFERENCES `mockups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revisions_mockup_revision` ON `revisions` (`mockup_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revisions_named_version` ON `revisions` (`mockup_id`,`version_number`);--> statement-breakpoint
ALTER TABLE `mockups` ADD `revision` integer DEFAULT 0 NOT NULL;