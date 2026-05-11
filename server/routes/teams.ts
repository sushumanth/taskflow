import express from 'express';
import {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
  addMember,
  removeMember,
  changeTeamLead,
  assignTaskToTeam,
  assignProjectToTeam,
  getTeamProgress,
  getTeamActivity,
  getTeamPerformanceSummary,
} from '../controllers/teamController.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', adminMiddleware, createTeam);
router.get('/', getTeams);
router.get('/:id', getTeamById);
router.put('/:id', adminMiddleware, updateTeam);
router.delete('/:id', adminMiddleware, deleteTeam);
router.put('/:id/members', adminMiddleware, addMember);
router.delete('/:id/members', adminMiddleware, removeMember);
router.put('/:id/lead', adminMiddleware, changeTeamLead);
router.post('/:id/assign-task', adminMiddleware, assignTaskToTeam);
router.post('/:id/assign-project', adminMiddleware, assignProjectToTeam);
router.get('/:id/progress', getTeamProgress);
router.get('/:id/activity', getTeamActivity);
router.get('/:id/performance', getTeamPerformanceSummary);

export default router;
