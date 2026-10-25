-- Adds the announcement lifecycle and management fields used by the admin UI.
-- Run this once after 02_orghub_migration.sql. Existing announcements default to live/normal/unpinned.
ALTER TABLE `announcements`
  ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'live',
  ADD COLUMN `priority` VARCHAR(20) NOT NULL DEFAULT 'normal',
  ADD COLUMN `pinned` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `publish_at` DATETIME NULL,
  ADD COLUMN `attachment_url` TEXT NULL,
  ADD COLUMN `archived_at` DATETIME NULL;
