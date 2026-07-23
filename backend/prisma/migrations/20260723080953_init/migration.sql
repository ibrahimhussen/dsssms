-- CreateTable
CREATE TABLE `users` (
    `userId` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NULL,
    `password` VARCHAR(255) NOT NULL,
    `roleId` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
    `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_roleId_idx`(`roleId`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `roleId` INTEGER NOT NULL AUTO_INCREMENT,
    `roleName` ENUM('ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER', 'STUDENT', 'PARENT') NOT NULL,

    UNIQUE INDEX `roles_roleName_key`(`roleName`),
    PRIMARY KEY (`roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `replacedBy` VARCHAR(191) NULL,

    INDEX `refresh_tokens_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(100) NULL,
    `entityId` VARCHAR(64) NULL,
    `ipAddress` VARCHAR(64) NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `administrators` (
    `adminId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `administrators_userId_key`(`userId`),
    PRIMARY KEY (`adminId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `directors` (
    `directorId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `directors_userId_key`(`userId`),
    PRIMARY KEY (`directorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vice_directors` (
    `viceDirectorId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `vice_directors_userId_key`(`userId`),
    PRIMARY KEY (`viceDirectorId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachers` (
    `teacherId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `qualification` VARCHAR(255) NULL,
    `specialization` VARCHAR(255) NULL,
    `phoneNumber` VARCHAR(20) NULL,

    UNIQUE INDEX `teachers_userId_key`(`userId`),
    PRIMARY KEY (`teacherId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classrooms` (
    `classroomId` INTEGER NOT NULL AUTO_INCREMENT,
    `className` VARCHAR(50) NOT NULL,
    `section` VARCHAR(10) NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `homeroomTeacherId` INTEGER NULL,

    UNIQUE INDEX `classrooms_className_section_academicYear_key`(`className`, `section`, `academicYear`),
    PRIMARY KEY (`classroomId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `subjectId` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectCode` VARCHAR(20) NOT NULL,
    `subjectName` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `subjects_subjectCode_key`(`subjectCode`),
    PRIMARY KEY (`subjectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teacher_subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `teacherId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `classroomId` INTEGER NOT NULL,

    UNIQUE INDEX `teacher_subjects_teacherId_subjectId_classroomId_key`(`teacherId`, `subjectId`, `classroomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `studentId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `classroomId` INTEGER NOT NULL,
    `admissionNumber` VARCHAR(50) NOT NULL,
    `firstName` VARCHAR(100) NOT NULL,
    `lastName` VARCHAR(100) NOT NULL,
    `gender` ENUM('M', 'F') NOT NULL,
    `dateOfBirth` DATE NOT NULL,
    `address` VARCHAR(255) NULL,
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `students_userId_key`(`userId`),
    UNIQUE INDEX `students_admissionNumber_key`(`admissionNumber`),
    INDEX `students_classroomId_idx`(`classroomId`),
    PRIMARY KEY (`studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `parents` (
    `parentId` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `fullName` VARCHAR(255) NOT NULL,
    `phoneNumber` VARCHAR(20) NULL,

    UNIQUE INDEX `parents_userId_key`(`userId`),
    PRIMARY KEY (`parentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_parent_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `parentId` INTEGER NOT NULL,
    `relationship` ENUM('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER') NOT NULL,

    UNIQUE INDEX `student_parent_links_studentId_parentId_key`(`studentId`, `parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `attendanceId` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `classroomId` INTEGER NOT NULL,
    `attendanceDate` DATE NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') NOT NULL,
    `remarks` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_classroomId_attendanceDate_idx`(`classroomId`, `attendanceDate`),
    UNIQUE INDEX `attendance_studentId_attendanceDate_key`(`studentId`, `attendanceDate`),
    PRIMARY KEY (`attendanceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grades` (
    `gradeId` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `subjectId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `score` DECIMAL(5, 2) NOT NULL,
    `letterGrade` VARCHAR(2) NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `grades_studentId_idx`(`studentId`),
    UNIQUE INDEX `grades_studentId_subjectId_semester_academicYear_key`(`studentId`, `subjectId`, `semester`, `academicYear`),
    PRIMARY KEY (`gradeId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_reports` (
    `reportId` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `semester` ENUM('SEMESTER_1', 'SEMESTER_2') NOT NULL,
    `academicYear` VARCHAR(10) NOT NULL,
    `averageMark` DECIMAL(5, 2) NOT NULL,
    `rank` INTEGER NULL,
    `generatedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `academic_reports_studentId_semester_academicYear_key`(`studentId`, `semester`, `academicYear`),
    PRIMARY KEY (`reportId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `notificationId` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NULL,
    `recipientUserId` INTEGER NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` TEXT NOT NULL,
    `sentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('READ', 'UNREAD') NOT NULL DEFAULT 'UNREAD',

    INDEX `notifications_studentId_idx`(`studentId`),
    INDEX `notifications_recipientUserId_idx`(`recipientUserId`),
    PRIMARY KEY (`notificationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`roleId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `administrators` ADD CONSTRAINT `administrators_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `directors` ADD CONSTRAINT `directors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vice_directors` ADD CONSTRAINT `vice_directors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teachers` ADD CONSTRAINT `teachers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classrooms` ADD CONSTRAINT `classrooms_homeroomTeacherId_fkey` FOREIGN KEY (`homeroomTeacherId`) REFERENCES `teachers`(`teacherId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`teacherId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`subjectId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teacher_subjects` ADD CONSTRAINT `teacher_subjects_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`classroomId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`classroomId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `parents` ADD CONSTRAINT `parents_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_parent_links` ADD CONSTRAINT `student_parent_links_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `student_parent_links` ADD CONSTRAINT `student_parent_links_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `parents`(`parentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`teacherId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `classrooms`(`classroomId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`subjectId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grades` ADD CONSTRAINT `grades_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `teachers`(`teacherId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_reports` ADD CONSTRAINT `academic_reports_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`studentId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;
