import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';

const router = Router();

router.use('/auth', authRoutes);

// Stage 2+ will add:
// router.use('/users', userRoutes);
// router.use('/students', studentRoutes);
// router.use('/classrooms', classroomRoutes);
// router.use('/subjects', subjectRoutes);
// router.use('/attendance', attendanceRoutes);
// router.use('/grades', gradeRoutes);
// router.use('/reports', reportRoutes);
// router.use('/notifications', notificationRoutes);

export const apiRoutes = router;
