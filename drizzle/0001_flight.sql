CREATE TABLE `flight` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
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
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `flight_owner_date_idx` ON `flight` (`owner_id`,`departure_date`);