import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { RoleName } from '@prisma/client';
import { disciplineController } from './discipline.controller';

const router = Router();

// Director, Vice Director, Admin, and Teacher can view discipline records
const VIEW_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];
// Vice Director, Admin, and Teacher can log/update discipline records
const MANAGE_ROLES = [RoleName.VICE_DIRECTOR, RoleName.TEACHER];

router.use(authenticate);

router.get('/', authorize(...VIEW_ROLES), (req, res, next) => disciplineController.listRecords(req, res).catch(next));
router.post('/', authorize(...MANAGE_ROLES), (req, res, next) => disciplineController.createRecord(req, res).catch(next));
router.patch('/:id', authorize(...MANAGE_ROLES), (req, res, next) => disciplineController.updateRecord(req, res).catch(next));

export const disciplineRoutes = router;
