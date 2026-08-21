import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { disciplineController } from './discipline.controller';

const router = Router();
router.use(authenticate);

// Directors, Vice Directors, and Teachers can view discipline records
const VIEW_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];

// Vice Directors and Teachers can create and update records
const MANAGE_ROLES = [RoleName.VICE_DIRECTOR, RoleName.TEACHER];

router.get('/',     authorize(...VIEW_ROLES),   disciplineController.listRecords);
router.post('/',    authorize(...MANAGE_ROLES),  disciplineController.createRecord);
router.patch('/:id',authorize(...MANAGE_ROLES),  disciplineController.updateRecord);

export const disciplineRoutes = router;
