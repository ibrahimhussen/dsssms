import { Router } from 'express';
import multer from 'multer';
import { RoleName } from '@prisma/client';
import { backupController } from './backup.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { restoreBackupSchema } from './validation/backup.validation';

const router = Router();

// Backup files can be large; keep them in memory only briefly before
// writing to disk ourselves. 50MB comfortably covers a school-scale DB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate, authorize(RoleName.ADMIN));

router.get('/', backupController.list);
router.post('/', backupController.create);
router.post('/upload', upload.single('file'), backupController.upload);
router.get('/:fileName/download', backupController.download);
router.post('/:fileName/restore', validate(restoreBackupSchema), backupController.restore);
router.delete('/:fileName', backupController.delete);

export const backupRoutes = router;
