import { Response } from 'express';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import TaskUpdate from '../models/TaskUpdate.js';
import Team from '../models/Team.js';
import { AuthRequest } from '../middleware/auth.js';

const getTeamIdsForUser = async (userId?: string) => {
  if (!userId) return [] as string[];
  const teams = await Team.find({
    $or: [{ leadUserId: userId }, { memberUserIds: userId }],
  }).select('_id');
  return teams.map((team) => team._id.toString());
};

const ensureTeamMembersInProject = async (project: any, teamId: string) => {
  const team = await Team.findById(teamId).select('leadUserId memberUserIds');
  if (!team) return;

  const teamMembers = [team.leadUserId, ...team.memberUserIds]
    .map((id) => id.toString());

  const existing = new Set(project.members.map((member: any) => member.toString()));
  teamMembers.forEach((id) => {
    if (!existing.has(id)) {
      project.members.push(id);
    }
  });
};

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      projectId,
      assignedTo,
      assignedTeamId,
      teamAssignment,
      dueDate,
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Not authorized to create tasks in this project' });
      return;
    }

    if (!assignedTo && !assignedTeamId) {
      res.status(400).json({ success: false, message: 'Assignee or team is required' });
      return;
    }

    if (assignedTo && !project.members.some((member: any) => member.toString() === assignedTo)) {
      project.members.push(assignedTo);
    }

    if (assignedTeamId) {
      const team = await Team.findById(assignedTeamId).select('_id');
      if (!team) {
        res.status(404).json({ success: false, message: 'Team not found' });
        return;
      }
      await ensureTeamMembersInProject(project, assignedTeamId);
    }

    if (project.isModified('members')) {
      await project.save();
    }

    const task = await Task.create({
      title,
      description,
      projectId,
      assignedTo,
      assignedTeamId,
      teamAssignment,
      status: 'todo',
      progressPercent: 0,
      dueDate: new Date(dueDate),
    });

    const populatedTask = await Task.findById(task._id)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status');

    res.status(201).json({ success: true, task: populatedTask });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, message: 'Server error creating task' });
  }
};

export const getTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const { projectId, status } = req.query;

    let query: any = {};

    if (projectId) {
      query.projectId = projectId;
    }

    if (status) {
      query.status = status;
    }

    if (userRole !== 'admin') {
      const teamIds = await getTeamIdsForUser(userId?.toString());
      query.$or = [{ assignedTo: userId }, { assignedTeamId: { $in: teamIds } }];
    }

    const tasks = await Task.find(query)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching tasks' });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status');

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    let canAccess = req.user?.role === 'admin';

    if (!canAccess && task.assignedTo) {
      canAccess = task.assignedTo._id.toString() === req.user?._id.toString();
    }

    if (!canAccess && task.assignedTeamId) {
      const teamIds = await getTeamIdsForUser(req.user?._id.toString());
      canAccess = teamIds.includes(task.assignedTeamId._id.toString());
    }

    if (!canAccess) {
      const project = await Project.findById(task.projectId);
      if (project?.createdBy.toString() !== req.user?._id.toString()) {
        res.status(403).json({ success: false, message: 'Not authorized to view this task' });
        return;
      }
    }

    res.status(200).json({ success: true, task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching task' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, assignedTo, assignedTeamId, teamAssignment, status, dueDate } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const isAdmin = req.user?.role === 'admin';
    const isAssignee = task.assignedTo?.toString() === req.user?._id.toString();
    const teamIds = await getTeamIdsForUser(req.user?._id.toString());
    const isTeamMember = task.assignedTeamId
      ? teamIds.includes(task.assignedTeamId.toString())
      : false;

    if (!isAdmin && !isAssignee && !isTeamMember) {
      res.status(403).json({ success: false, message: 'Not authorized to update this task' });
      return;
    }

    // Members can only update status, admins can update everything
    if (!isAdmin && (isAssignee || isTeamMember)) {
      if (status && ['todo', 'in-progress', 'review', 'done', 'rejected'].includes(status)) {
        task.status = status;
      } else {
        res.status(403).json({ success: false, message: 'Members can only update task status' });
        return;
      }
    } else {
      if (title) task.title = title;
      if (description !== undefined) task.description = description;
      if (assignedTo !== undefined) task.assignedTo = assignedTo || undefined;
      if (assignedTeamId !== undefined) {
        if (assignedTeamId) {
          const team = await Team.findById(assignedTeamId).select('_id');
          if (!team) {
            res.status(404).json({ success: false, message: 'Team not found' });
            return;
          }
          const project = await Project.findById(task.projectId);
          if (project) {
            await ensureTeamMembersInProject(project, assignedTeamId);
            if (project.isModified('members')) {
              await project.save();
            }
          }
        }
        task.assignedTeamId = assignedTeamId || undefined;
      }
      if (teamAssignment !== undefined) task.teamAssignment = teamAssignment;
      if (status && ['todo', 'in-progress', 'review', 'done', 'rejected'].includes(status)) {
        task.status = status;
      }
      if (dueDate) task.dueDate = new Date(dueDate);
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status');

    res.status(200).json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, message: 'Server error updating task' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const project = await Project.findById(task.projectId);
    const isAdmin = req.user?.role === 'admin';
    const isProjectCreator = project?.createdBy.toString() === req.user?._id.toString();

    if (!isAdmin && !isProjectCreator) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
      return;
    }

    await TaskUpdate.deleteMany({ taskId: task._id });
    await task.deleteOne();
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting task' });
  }
};
