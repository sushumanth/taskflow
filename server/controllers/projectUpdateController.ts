import { Response } from 'express';
import Project from '../models/Project.js';
import ProjectUpdate from '../models/ProjectUpdate.js';
import ProjectActivityLog from '../models/ProjectActivityLog.js';
import Team from '../models/Team.js';
import { AuthRequest } from '../middleware/auth.js';

const canAccessProject = async (projectId: string, userId: string, role?: string) => {
  if (role === 'admin') return true;

  const project = await Project.findById(projectId).select('createdBy assignedTeamId members');
  if (!project) return false;

  if (project.createdBy.toString() === userId) return true;

  if (project.members?.some((memberId) => memberId.toString() === userId)) return true;

  if (project.assignedTeamId) {
    const isTeamMember = await Team.exists({
      _id: project.assignedTeamId,
      $or: [{ leadUserId: userId }, { memberUserIds: userId }],
    });
    return Boolean(isTeamMember);
  }

  return false;
};

const getParamId = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const createProjectActivity = async (data: {
  projectId: string;
  actor: string;
  type: 'project_update_submitted' | 'comment_added';
  message: string;
}) => {
  await ProjectActivityLog.create({
    projectId: data.projectId,
    actor: data.actor,
    type: data.type,
    message: data.message,
  });
};

export const createProjectUpdate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = getParamId(req.params.id);
    if (!projectId) {
      res.status(400).json({ success: false, message: 'Project id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const canAccess = await canAccessProject(projectId, userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to update this project' });
      return;
    }

    const { progressPercent, status, note, blockers } = req.body as {
      progressPercent?: number;
      status?: string;
      note?: string;
      blockers?: string;
    };

    const progressValue = Number(progressPercent);
    if (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100) {
      res.status(400).json({ success: false, message: 'Progress percent must be between 0 and 100' });
      return;
    }

    const normalizedStatusRaw = String(status || 'on-track').toLowerCase();
    if (!['on-track', 'at-risk', 'delayed'].includes(normalizedStatusRaw)) {
      res.status(400).json({ success: false, message: 'Invalid project status' });
      return;
    }
    const normalizedStatus = normalizedStatusRaw as 'on-track' | 'at-risk' | 'delayed';

    if (!note || !String(note).trim()) {
      res.status(400).json({ success: false, message: 'Update note is required' });
      return;
    }

    const update = await ProjectUpdate.create({
      projectId,
      submittedBy: req.user?._id,
      progressPercent: progressValue,
      status: normalizedStatus,
      note: String(note).trim(),
      blockers: blockers ? String(blockers).trim() : undefined,
    });

    project.progressPercent = progressValue;
    project.lastUpdateAt = new Date();
    project.lastUpdatedBy = req.user?._id;
    project.lastUpdateStatus = normalizedStatus as 'on-track' | 'at-risk' | 'delayed';
    await project.save();

    await createProjectActivity({
      projectId,
      actor: userId,
      type: 'project_update_submitted',
      message: 'Submitted a project update',
    });

    const populatedUpdate = await ProjectUpdate.findById(update._id)
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email');

    res.status(201).json({ success: true, update: populatedUpdate });
  } catch (error) {
    console.error('Create project update error:', error);
    res.status(500).json({ success: false, message: 'Server error creating project update' });
  }
};

export const getProjectUpdates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = getParamId(req.params.id);
    if (!projectId) {
      res.status(400).json({ success: false, message: 'Project id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const canAccess = await canAccessProject(projectId, userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to view project updates' });
      return;
    }

    const updates = await ProjectUpdate.find({ projectId })
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, updates });
  } catch (error) {
    console.error('Get project updates error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching project updates' });
  }
};

export const addProjectUpdateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updateId = req.params.updateId;
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

    const update = await ProjectUpdate.findById(updateId);
    if (!update) {
      res.status(404).json({ success: false, message: 'Update not found' });
      return;
    }

    const canAccess = await canAccessProject(update.projectId.toString(), userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to comment on this update' });
      return;
    }

    update.comments.push({ user: req.user?._id as any, text, createdAt: new Date() });
    await update.save();

    await createProjectActivity({
      projectId: update.projectId.toString(),
      actor: userId,
      type: 'comment_added',
      message: 'Commented on a project update',
    });

    const populatedUpdate = await ProjectUpdate.findById(update._id)
      .populate('submittedBy', 'name email')
      .populate('comments.user', 'name email');

    res.status(200).json({ success: true, update: populatedUpdate });
  } catch (error) {
    console.error('Add project update comment error:', error);
    res.status(500).json({ success: false, message: 'Server error adding project update comment' });
  }
};

export const getProjectActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = getParamId(req.params.id);
    if (!projectId) {
      res.status(400).json({ success: false, message: 'Project id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (!userId) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }

    const canAccess = await canAccessProject(projectId, userId, req.user?.role);
    if (!canAccess) {
      res.status(403).json({ success: false, message: 'Not authorized to view project activity' });
      return;
    }

    const activities = await ProjectActivityLog.find({ projectId })
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .limit(30);

    res.status(200).json({ success: true, activities });
  } catch (error) {
    console.error('Get project activity error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching project activity' });
  }
};
