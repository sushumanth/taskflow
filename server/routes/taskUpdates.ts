import express from 'express';
import {
  getTaskUpdatesByEmployee,
  reviewTaskUpdate,
  addTaskUpdateComment,
  editTaskUpdate,
  deleteTaskUpdate,
} from '../controllers/taskUpdateController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { taskUpdateUpload } from '../config/upload.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/my', getTaskUpdatesByEmployee);
router.post('/:id/review', adminMiddleware, reviewTaskUpdate);
router.post('/:id/comments', addTaskUpdateComment);
router.put('/:id', taskUpdateUpload.array('attachments', 5), editTaskUpdate);
router.delete('/:id', deleteTaskUpdate);

export default router;
