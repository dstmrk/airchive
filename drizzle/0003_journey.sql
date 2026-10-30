CREATE TABLE `journey` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journey_owner_idx` ON `journey` (`owner_id`);--> statement-breakpoint
INSERT INTO `journey` (`id`, `owner_id`, `title`, `created_at`, `updated_at`) SELECT `id`, `owner_id`, NULL, `created_at`, `updated_at` FROM `flight`;--> statement-breakpoint
CREATE TABLE `__new_flight` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`journey_id` text NOT NULL,
	`airline_code` text NOT NULL,
	`flight_number` text NOT NULL,
	`airline_name` text,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`departure_date` text NOT NULL,
	`departure_time` text,
	`arrival_date` text,
	`arrival_time` text,
	`seat` text,
	`cabin_class` text,
	`passenger_name` text,
	`booking_reference` text,
	`accent_color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`journey_id`) REFERENCES `journey`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_flight` (`id`, `owner_id`, `journey_id`, `airline_code`, `flight_number`, `airline_name`, `origin`, `destination`, `departure_date`, `departure_time`, `arrival_date`, `arrival_time`, `seat`, `cabin_class`, `passenger_name`, `booking_reference`, `accent_color`, `created_at`, `updated_at`) SELECT `id`, `owner_id`, `id`, `airline_code`, `flight_number`, `airline_name`, `origin`, `destination`, `departure_date`, `departure_time`, `arrival_date`, `arrival_time`, `seat`, `cabin_class`, `passenger_name`, `booking_reference`, `accent_color`, `created_at`, `updated_at` FROM `flight`;--> statement-breakpoint
DROP TABLE `flight`;--> statement-breakpoint
ALTER TABLE `__new_flight` RENAME TO `flight`;--> statement-breakpoint
CREATE INDEX `flight_owner_date_idx` ON `flight` (`owner_id`,`departure_date`);--> statement-breakpoint
CREATE INDEX `flight_journey_idx` ON `flight` (`journey_id`);
