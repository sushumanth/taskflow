import { Response } from 'express';
import TeamUpdate from '../models/TeamUpdate.js';
import Team from '../models/Team.js';
import TeamActivityLog from '../models/TeamActivityLog.js';
import { AuthRequest } from '../middleware/auth.js';

const canAccessTeam = async (teamId: string, userId: string, role?: string) => {
  if (role === 'admin') return true;
  return Team.exists({ _id: teamId, $or: [{ leadUserId: userId }, { memberUserIds: userId }] });
};

const getParamId = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const createTeamActivity = async (teamId: string, actor: string, message: string) => {
  await TeamActivityLog.create({
    teamId,
    actor,
    type: 'team_update_submitted',
    message,
  });
};

export const createTeamUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const canAccess = await canAccessTeam(teamId, userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to update this team' });
      return;
    }

    const { progressPercent, status, note, blockers } = req.body as {
      progressPercent?: number;
      status?: string;
      note?: string;
      blockers?: string;
    };
    const normalizedStatusRaw = (status || 'on-track').toLowerCase();
    if (!['on-track', 'at-risk', 'delayed'].includes(normalizedStatusRaw)) {
      res.status(400).json({ success: false, message: 'Invalid team status' });
      return;
    }
    const normalizedStatus = normalizedStatusRaw as 'on-track' | 'at-risk' | 'delayed';

    const progressValue = Number(progressPercent);
    if (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100) {
      res.status(400).json({ success: false, message: 'Progress percent must be between 0 and 100' });
      return;
    }

    if (!note || !String(note).trim()) {
      res.status(400).json({ success: false, message: 'Update note is required' });
      return;
    }

    const update = await TeamUpdate.create({
      teamId,
      submittedBy: req.user?._id,
      progressPercent: progressValue,
      status: normalizedStatus,
      note: String(note).trim(),
      blockers: blockers ? String(blockers).trim() : undefined,
    });

    team.progressPercent = progressValue;
    await team.save();

    await createTeamActivity(teamId, userId, 'Submitted a team update');

    const populatedUpdate = await TeamUpdate.findById(update._id)
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email');

    res.status(201).json({ success: true, update: populatedUpdate });
  } catch (error) {
    console.error('Create team update error:', error);
    res.status(500).json({ success: false, message: 'Server error creating team update' });
  }
};

export const getTeamUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const canAccess = await canAccessTeam(teamId, userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to view team updates' });
      return;
    }

    const updates = await TeamUpdate.find({ teamId })
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, updates });
  } catch (error) {
    console.error('Get team updates error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching team updates' });
  }
};

export const addTeamUpdateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updateId = getParamId(req.params.updateId);
    if (!updateId) {
      res.status(400).json({ success: false, message: 'Update id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const text = String(req.body.text || '').trim();
    if (!text) {
      res.status(400).json({ success: false, message: 'Comment text is required' });
      return;
    }

    const update = await TeamUpdate.findById(updateId);
    if (!update) {
      res.status(404).json({ success: false, message: 'Update not found' });
      return;
    }

    const canAccess = await canAccessTeam(update.teamId.toString(), userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to comment on this update' });
      return;
    }

    update.comments.push({ user: req.user?._id as any, text, createdAt: new Date() });
    await update.save();

    const populatedUpdate = await TeamUpdate.findById(update._id)
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email');

    res.status(200).json({ success: true, update: populatedUpdate });
  } catch (error) {
    console.error('Add team update comment error:', error);
    res.status(500).json({ success: false, message: 'Server error adding team update comment' });
  }
};
