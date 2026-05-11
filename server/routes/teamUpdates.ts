import express from 'express';
import {
  createTeamUpdate,
  getTeamUpdates,
  addTeamUpdateComment,
} from '../controllers/teamUpdateController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/:id', getTeamUpdates);
router.post('/:id', createTeamUpdate);
router.post('/:id/comments/:updateId', addTeamUpdateComment);

export default router;
