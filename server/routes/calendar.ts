import express from 'express';
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  rescheduleCalendarEvent,
  deleteCalendarEvent,
} from '../controllers/calendarController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/events', getCalendarEvents);
router.post('/events', adminMiddleware, createCalendarEvent);
router.put('/events/:id', adminMiddleware, updateCalendarEvent);
router.patch('/events/:id/reschedule', adminMiddleware, rescheduleCalendarEvent);
router.delete('/events/:id', adminMiddleware, deleteCalendarEvent);

export default router;
