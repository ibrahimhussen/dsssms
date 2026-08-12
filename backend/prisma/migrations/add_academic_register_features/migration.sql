-- Add minimumSubjectPassMark to system_settings
ALTER TABLE `system_settings` ADD COLUMN `minimumSubjectPassMark` DECIMAL(5, 2) DEFAULT 40.00;

-- Create student_conduct table
CREATE TABLE `student_conduct` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `studentId` INT NOT NULL,
    `classroomId` INT NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `rating` ENUM('EXCELLENT', 'VERY_GOOD', 'GOOD', 'SATISFACTORY', 'NEEDS_IMPROVEMENT') NOT NULL,
    `assignedBy` INT NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(500),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `student_conduct_studentId_classroomId_academicYear_semester_key`(`studentId`, `classroomId`, `academicYear`, `semester`),
    INDEX `student_conduct_classroomId_academicYear_semester_idx`(`classroomId`, `academicYear`, `semester`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key for student_conduct
ALTER TABLE `student_conduct` ADD CONSTRAINT `student_conduct_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_conduct` ADD CONSTRAINT `student_conduct_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`classroomId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `student_conduct` ADD CONSTRAINT `student_conduct_assignedBy_fkey` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Create finalization_status enum values will be handled as VARCHAR
-- Create subject_finalizations table
CREATE TABLE `subject_finalizations` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `teacherSubjectId` INT NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `reviewedBy` INT,
    `reviewedAt` DATETIME(3),
    `finalizedBy` INT,
    `finalizedAt` DATETIME(3),
    `correctionReason` VARCHAR(500),
    `lastCorrectionAt` DATETIME(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `subject_finalizations_teacherSubjectId_semester_academicYear_key`(`teacherSubjectId`, `semester`, `academicYear`),
    INDEX `subject_finalizations_teacherSubjectId_status_idx`(`teacherSubjectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys for subject_finalizations
ALTER TABLE `subject_finalizations` ADD CONSTRAINT `subject_finalizations_teacherSubjectId_fkey` FOREIGN KEY (`teacherSubjectId`) REFERENCES `teacher_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subject_finalizations` ADD CONSTRAINT `subject_finalizations_reviewedBy_fkey` FOREIGN KEY (`reviewedBy`) REFERENCES `users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `subject_finalizations` ADD CONSTRAINT `subject_finalizations_finalizedBy_fkey` FOREIGN KEY (`finalizedBy`) REFERENCES `users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Create classroom_finalizations table
CREATE TABLE `classroom_finalizations` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `classroomId` INT NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED') NOT NULL DEFAULT 'DRAFT',
    `finalizedBy` INT,
    `finalizedAt` DATETIME(3),
    `correctionReason` VARCHAR(500),
    `lastCorrectionAt` DATETIME(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `classroom_finalizations_classroomId_semester_academicYear_key`(`classroomId`, `semester`, `academicYear`),
    INDEX `classroom_finalizations_classroomId_status_idx`(`classroomId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys for classroom_finalizations
ALTER TABLE `classroom_finalizations` ADD CONSTRAINT `classroom_finalizations_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`classroomId`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `classroom_finalizations` ADD CONSTRAINT `classroom_finalizations_finalizedBy_fkey` FOREIGN KEY (`finalizedBy`) REFERENCES `users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;