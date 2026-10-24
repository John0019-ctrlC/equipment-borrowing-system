-- ============================================================
-- 02_orghub_migration.sql
-- Extends equipment_borrowing_system_db so the CCS OrgHub app can run on it.
-- Run ONCE, after importing 01_equipment_borrowing_system_db.sql.
-- Target: MariaDB 10.4+ / MySQL 8 (XAMPP default is fine).
-- If it fails midway: DROP DATABASE equipment_borrowing_system_db;
-- then re-import 01 and run this file again from the top.
-- ============================================================
USE `equipment_borrowing_system_db`;

-- ---------- 1. New table: orgs (must exist before users.org_id FK) ----------
CREATE TABLE `orgs` (
  `org_id`     INT(11) NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100) NOT NULL,
  `full_name`  VARCHAR(200) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`org_id`),
  UNIQUE KEY `uq_orgs_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------- 2. users: new roles + org/course/active ----------
-- 'student' becomes 'member' (same meaning in OrgHub). Done in 3 steps so no row is invalid.
ALTER TABLE `users`
  MODIFY `role` ENUM('student','admin','member','officer','adviser') NOT NULL DEFAULT 'member';
UPDATE `users` SET `role` = 'member' WHERE `role` = 'student';
ALTER TABLE `users`
  MODIFY `role` ENUM('admin','adviser','officer','member') NOT NULL DEFAULT 'member';
ALTER TABLE `users`
  ADD COLUMN `course`     VARCHAR(100) NULL AFTER `student_id`,
  ADD COLUMN `org_id`     INT(11) NULL,
  ADD COLUMN `active`     TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL,
  ADD KEY `org_id` (`org_id`),
  ADD CONSTRAINT `users_ibfk_org` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`org_id`) ON DELETE SET NULL;

-- ---------- 3. equipment: stock counts (the app tracks quantity) ----------
ALTER TABLE `equipment`
  ADD COLUMN `total`      INT(11) NOT NULL DEFAULT 1,
  ADD COLUMN `available`  INT(11) NOT NULL DEFAULT 1,
  ADD COLUMN `max_days`   INT(11) NOT NULL DEFAULT 7,
  ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL;
-- Existing rows: 1 unit if Available, 0 units if Unavailable (admin can edit later).
UPDATE `equipment` SET `total` = IF(`status` = 'Available', 1, 0), `available` = IF(`status` = 'Available', 1, 0);

-- ---------- 4. borrow_requests: fields the borrowing flow needs ----------
ALTER TABLE `borrow_requests`
  ADD COLUMN `code`                VARCHAR(20) NULL,
  ADD COLUMN `quantity`            INT(11) NOT NULL DEFAULT 1,
  ADD COLUMN `date_needed`         DATE NULL,
  ADD COLUMN `notes`               VARCHAR(255) NULL,
  ADD COLUMN `extension_requested` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `admin_comment`       VARCHAR(255) NULL,
  ADD COLUMN `decided_by`          INT(11) NULL,
  ADD COLUMN `updated_at`          TIMESTAMP NULL DEFAULT NULL,
  ADD UNIQUE KEY `uq_borrow_code` (`code`),
  ADD CONSTRAINT `borrow_requests_ibfk_3` FOREIGN KEY (`decided_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

-- ---------- 5. Org features ----------
CREATE TABLE `announcements` (
  `announcement_id` INT(11) NOT NULL AUTO_INCREMENT,
  `org_id`     INT(11) NULL,
  `title`      VARCHAR(150) NOT NULL,
  `message`    TEXT NOT NULL,
  `audience`   VARCHAR(60) NOT NULL DEFAULT 'All members',
  `author_id`  INT(11) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`announcement_id`),
  KEY `org_id` (`org_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `announcements_ibfk_1` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`org_id`) ON DELETE CASCADE,
  CONSTRAINT `announcements_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `events` (
  `event_id`          INT(11) NOT NULL AUTO_INCREMENT,
  `org_id`            INT(11) NULL,
  `title`             VARCHAR(150) NOT NULL,
  `event_date`        DATE NOT NULL,
  `event_time`        VARCHAR(5) NOT NULL,
  `venue`             VARCHAR(150) NOT NULL,
  `description`       TEXT NULL,
  `participant_limit` INT(11) NOT NULL DEFAULT 0,
  `status`            ENUM('open','completed','cancelled') NOT NULL DEFAULT 'open',
  `created_by`        INT(11) NULL,
  `created_at`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`event_id`),
  KEY `org_id` (`org_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`org_id`) ON DELETE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `registrations` (
  `registration_id` INT(11) NOT NULL AUTO_INCREMENT,
  `event_id`   INT(11) NOT NULL,
  `user_id`    INT(11) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`registration_id`),
  UNIQUE KEY `uq_registration` (`event_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `attendance` (
  `attendance_id` INT(11) NOT NULL AUTO_INCREMENT,
  `event_id`   INT(11) NOT NULL,
  `user_id`    INT(11) NOT NULL,
  `method`     ENUM('qr','manual') NOT NULL DEFAULT 'manual',
  `checked_by` INT(11) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_id`),
  UNIQUE KEY `uq_attendance` (`event_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `checked_by` (`checked_by`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_3` FOREIGN KEY (`checked_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `reports` (
  `report_id`      INT(11) NOT NULL AUTO_INCREMENT,
  `org_id`         INT(11) NULL,
  `event_id`       INT(11) NOT NULL,
  `summary`        TEXT NOT NULL,
  `outcome`        TEXT NOT NULL,
  `budget_spent`   DECIMAL(12,2) NOT NULL DEFAULT 0,
  `attendee_count` INT(11) NOT NULL DEFAULT 0,
  `author_id`      INT(11) NULL,
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`report_id`),
  UNIQUE KEY `uq_report_event` (`event_id`),
  KEY `org_id` (`org_id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`org_id`) ON DELETE CASCADE,
  CONSTRAINT `reports_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`event_id`) ON DELETE CASCADE,
  CONSTRAINT `reports_ibfk_3` FOREIGN KEY (`author_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `approvals` (
  `approval_id`  INT(11) NOT NULL AUTO_INCREMENT,
  `org_id`       INT(11) NULL,
  `type`         VARCHAR(40) NOT NULL,
  `title`        VARCHAR(150) NOT NULL,
  `details`      TEXT NOT NULL,
  `amount`       DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status`       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `submitted_by` INT(11) NULL,
  `reviewed_by`  INT(11) NULL,
  `review_note`  VARCHAR(255) NULL,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`approval_id`),
  KEY `org_id` (`org_id`),
  KEY `submitted_by` (`submitted_by`),
  KEY `reviewed_by` (`reviewed_by`),
  CONSTRAINT `approvals_ibfk_1` FOREIGN KEY (`org_id`) REFERENCES `orgs` (`org_id`) ON DELETE CASCADE,
  CONSTRAINT `approvals_ibfk_2` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `approvals_ibfk_3` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
