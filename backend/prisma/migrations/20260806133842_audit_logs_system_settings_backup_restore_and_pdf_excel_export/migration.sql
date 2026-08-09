-- CreateTable
CREATE TABLE `system_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `schoolName` VARCHAR(150) NOT NULL,
    `schoolAddress` VARCHAR(255) NULL,
    `contactEmail` VARCHAR(150) NULL,
    `contactPhone` VARCHAR(30) NULL,
    `currentAcademicYear` VARCHAR(10) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedByUserId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;
