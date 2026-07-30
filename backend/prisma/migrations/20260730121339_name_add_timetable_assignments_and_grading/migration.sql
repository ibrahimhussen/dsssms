/*
  Warnings:

  - You are about to drop the `grades` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `grades` DROP FOREIGN KEY `grades_studentId_fkey`;

-- DropForeignKey
ALTER TABLE `grades` DROP FOREIGN KEY `grades_subjectId_fkey`;

-- DropForeignKey
ALTER TABLE `grades` DROP FOREIGN KEY `grades_teacherId_fkey`;

-- DropTable
DROP TABLE `grades`;

-- CreateTable
CREATE TABLE `grade_components` (
    `gradeComponentId` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherSubjectId` INTEGER NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `category` ENUM('QUIZ', 'ASSIGNMENT', 'TEST', 'MID_EXAM', 'FINAL_EXAM', 'OTHER') NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `maxMarks` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `grade_components_teacherSubjectId_semester_academicYear_idx`(`teacherSubjectId`, `semester`, `academicYear`),
    UNIQUE INDEX `grade_components_teacherSubjectId_semester_academicYear_name_key`(`teacherSubjectId`, `semester`, `academicYear`, `name`),
    PRIMARY KEY (`gradeComponentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_entries` (
    `gradeEntryId` INTEGER NOT NULL AUTO_INCREMENT,
    `gradeComponentId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `grade_entries_studentId_idx`(`studentId`),
    UNIQUE INDEX `grade_entries_gradeComponentId_studentId_key`(`gradeComponentId`, `studentId`),
    PRIMARY KEY (`gradeEntryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `grade_components` ADD CONSTRAINT `grade_components_teacherSubjectId_fkey` FOREIGN KEY (`teacherSubjectId`) REFERENCES `teacher_subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_entries` ADD CONSTRAINT `grade_entries_gradeComponentId_fkey` FOREIGN KEY (`gradeComponentId`) REFERENCES `grade_components`(`gradeComponentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_entries` ADD CONSTRAINT `grade_entries_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;
