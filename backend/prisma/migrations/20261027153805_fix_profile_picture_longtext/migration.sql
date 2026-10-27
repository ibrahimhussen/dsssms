-- AlterTable
-- Change profilePicture from VARCHAR(500) to LONGTEXT so that base64-encoded
-- images (which can be hundreds of kilobytes) can be stored without truncation.
-- SystemSetting.schoolLogo already uses LONGTEXT for the same reason.
ALTER TABLE `users` MODIFY COLUMN `profilePicture` LONGTEXT NULL COMMENT 'URL or base64 data URL';
