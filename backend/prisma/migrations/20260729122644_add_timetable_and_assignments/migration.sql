-- CreateTable
CREATE TABLE `timetable_entries` (
    `timetableEntryId` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherSubjectId` INTEGER NOT NULL,
    `dayOfWeek` ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY') NOT NULL,
    `startTime` VARCHAR(5) NOT NULL,
    `endTime` VARCHAR(5) NOT NULL,
    `roomNumber` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `timetable_entries_teacherSubjectId_idx`(`teacherSubjectId`),
    UNIQUE INDEX `timetable_entries_teacherSubjectId_dayOfWeek_startTime_key`(`teacherSubjectId`, `dayOfWeek`, `startTime`),
    PRIMARY KEY (`timetableEntryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignments` (
    `assignmentId` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherSubjectId` INTEGER NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `dueDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assignments_teacherSubjectId_idx`(`teacherSubjectId`),
    PRIMARY KEY (`assignmentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assignment_submissions` (
    `submissionId` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `status` ENUM('NOT_SUBMITTED', 'SUBMITTED', 'LATE') NOT NULL DEFAULT 'NOT_SUBMITTED',
    `submittedAt` DATETIME(3) NULL,
    `notes` VARCHAR(500) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `assignment_submissions_studentId_idx`(`studentId`),
    UNIQUE INDEX `assignment_submissions_assignmentId_studentId_key`(`assignmentId`, `studentId`),
    PRIMARY KEY (`submissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timetable_entries` ADD CONSTRAINT `timetable_entries_teacherSubjectId_fkey` FOREIGN KEY (`teacherSubjectId`) REFERENCES `teacher_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignments` ADD CONSTRAINT `assignments_teacherSubjectId_fkey` FOREIGN KEY (`teacherSubjectId`) REFERENCES `teacher_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `assignments`(`assignmentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assignment_submissions` ADD CONSTRAINT `assignment_submissions_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;
