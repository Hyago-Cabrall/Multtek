ALTER TABLE `clients` ADD `cnpj` text;--> statement-breakpoint
CREATE UNIQUE INDEX `clients_cnpj_unique` ON `clients` (`cnpj`);