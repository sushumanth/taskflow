import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();
router.use(authMiddleware);
router.get('/stats', getDashboardStats);
export default router;
