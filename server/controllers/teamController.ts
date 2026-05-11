import { Response } from 'express';
import Team from '../models/Team.js';
import TeamActivityLog from '../models/TeamActivityLog.js';
import TeamUpdate from '../models/TeamUpdate.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import TaskUpdate from '../models/TaskUpdate.js';
import { AuthRequest } from '../middleware/auth.js';

const isTeamMemberOrLead = async (teamId: string, userId: string) => {
  return Team.exists({
    _id: teamId,
    $or: [{ leadUserId: userId }, { memberUserIds: userId }],
  });
};

const getParamId = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const createTeamActivity = async (data: {
  teamId: string;
  actor: string;
  type:
    | 'team_created'
    | 'team_updated'
    | 'member_added'
    | 'member_removed'
    | 'lead_changed'
    | 'assignment_added'
    | 'assignment_removed'
    | 'team_update_submitted';
  message: string;
}) => {
  await TeamActivityLog.create({
    teamId: data.teamId,
    actor: data.actor,
    type: data.type,
    message: data.message,
  });
};

export const createTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, type, leadUserId, memberUserIds = [], status } = req.body;

    if (!leadUserId) {
      res.status(400).json({ success: false, message: 'Team lead is required' });
      return;
    }

    const normalizedMembers = (memberUserIds || []).filter(
      (id: string) => id && id !== leadUserId
    );

    const team = await Team.create({
      name,
      description,
      type,
      leadUserId,
      memberUserIds: normalizedMembers,
      status: status || 'active',
      createdBy: req.user?._id,
      assignedProjects: [],
      assignedTasks: [],
      progressPercent: 0,
    });

    await createTeamActivity({
      teamId: team._id.toString(),
      actor: req.user?._id.toString() || '',
      type: 'team_created',
      message: 'Team created',
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    res.status(201).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, message: 'Server error creating team' });
  }
};

export const getTeams = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();
    const { status, leadUserId } = req.query as { status?: string; leadUserId?: string };

    const query: any = {};
    if (status) query.status = status;
    if (leadUserId) query.leadUserId = leadUserId;

    if (req.user?.role !== 'admin') {
      query.$or = [{ leadUserId: userId }, { memberUserIds: userId }];
    }

    const teams = await Team.find(query)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email')
      .sort({ createdAt: -1 });

    const teamIds = teams.map((team) => team._id);

    const [taskAgg, projectAgg] = await Promise.all([
      Task.aggregate([
        { $match: { assignedTeamId: { $in: teamIds } } },
        {
          $group: {
            _id: '$assignedTeamId',
            avgProgress: { $avg: '$progressPercent' },
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'done'] }, 1, 0],
              },
            },
          },
        },
      ]),
      Project.aggregate([
        { $match: { assignedTeamId: { $in: teamIds } } },
        { $group: { _id: '$assignedTeamId', totalProjects: { $sum: 1 } } },
      ]),
    ]);

    const taskMap = new Map(taskAgg.map((entry) => [entry._id.toString(), entry]));
    const projectMap = new Map(projectAgg.map((entry) => [entry._id.toString(), entry]));

    const teamsWithStats = teams.map((team) => {
      const taskStats = taskMap.get(team._id.toString());
      const projectStats = projectMap.get(team._id.toString());
      const totalTasks = taskStats?.totalTasks || 0;
      const progressPercent = totalTasks > 0
        ? Math.round(taskStats?.avgProgress || 0)
        : (team.progressPercent || 0);
      return {
        ...team.toObject(),
        progressPercent,
        taskCount: totalTasks,
        completedTasks: taskStats?.completedTasks || 0,
        projectCount: projectStats?.totalProjects || 0,
      };
    });

    res.status(200).json({ success: true, teams: teamsWithStats });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching teams' });
  }
};

export const getTeamById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const userId = req.user?._id?.toString();
    if (req.user?.role !== 'admin' && userId) {
      const canAccess = await isTeamMemberOrLead(teamId, userId);
      if (!canAccess) {
        res.status(403).json({ success: false, message: 'Not authorized to view this team' });
        return;
      }
    }

    const [tasks, projects, latestUpdate] = await Promise.all([
      Task.find({ assignedTeamId: teamId })
        .populate('projectId', 'name')
        .sort({ createdAt: -1 }),
      Project.find({ assignedTeamId: teamId }).sort({ createdAt: -1 }),
      TeamUpdate.findOne({ teamId }).sort({ createdAt: -1 }),
    ]);

    res.status(200).json({ success: true, team, tasks, projects, latestUpdate });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching team' });
  }
};

export const updateTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const { name, description, type, status } = req.body;
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    team.name = name || team.name;
    team.description = description !== undefined ? description : team.description;
    team.type = type !== undefined ? type : team.type;
    if (status) team.status = status;

    await team.save();

    await createTeamActivity({
      teamId: team._id.toString(),
      actor: req.user?._id.toString() || '',
      type: 'team_updated',
      message: 'Team details updated',
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    res.status(200).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ success: false, message: 'Server error updating team' });
  }
};

export const deleteTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    await team.deleteOne();
    res.status(200).json({ success: true, message: 'Team deleted' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting team' });
  }
};

export const addMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId?: string };
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    if (!userId) {
      res.status(400).json({ success: false, message: 'User id is required' });
      return;
    }

    if (team.leadUserId.toString() === userId || team.memberUserIds.some((id) => id.toString() === userId)) {
      res.status(400).json({ success: false, message: 'User is already in the team' });
      return;
    }

    team.memberUserIds.push(userId as any);
    await team.save();

    await createTeamActivity({
      teamId: team._id.toString(),
      actor: req.user?._id.toString() || '',
      type: 'member_added',
      message: 'Team member added',
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    res.status(200).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ success: false, message: 'Server error adding member' });
  }
};

export const removeMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId?: string };
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    if (!userId) {
      res.status(400).json({ success: false, message: 'User id is required' });
      return;
    }

    team.memberUserIds = team.memberUserIds.filter((id) => id.toString() !== userId);
    await team.save();

    await createTeamActivity({
      teamId: team._id.toString(),
      actor: req.user?._id.toString() || '',
      type: 'member_removed',
      message: 'Team member removed',
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    res.status(200).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, message: 'Server error removing member' });
  }
};

export const changeTeamLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadUserId } = req.body as { leadUserId?: string };
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);

    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    if (!leadUserId) {
      res.status(400).json({ success: false, message: 'Team lead is required' });
      return;
    }

    team.leadUserId = leadUserId as any;
    team.memberUserIds = team.memberUserIds.filter((id) => id.toString() !== leadUserId);
    await team.save();

    await createTeamActivity({
      teamId: team._id.toString(),
      actor: req.user?._id.toString() || '',
      type: 'lead_changed',
      message: 'Team lead changed',
    });

    const populatedTeam = await Team.findById(team._id)
      .populate('leadUserId', 'name email')
      .populate('memberUserIds', 'name email');

    res.status(200).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Change lead error:', error);
    res.status(500).json({ success: false, message: 'Server error changing team lead' });
  }
};

export const assignTaskToTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId, teamAssignment } = req.body as { taskId?: string; teamAssignment?: any };
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }

    if (!taskId) {
      res.status(400).json({ success: false, message: 'Task id is required' });
      return;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const task = await Task.findById(taskId);
    if (!task) {
      res.status(404).json({ success: false, message: 'Task not found' });
      return;
    }

    const project = await Project.findById(task.projectId);
    if (project) {
      const teamMembers = [team.leadUserId, ...team.memberUserIds]
        .map((id) => id.toString());
      const existing = new Set(project.members.map((member: any) => member.toString()));
      teamMembers.forEach((id) => {
        if (!existing.has(id)) {
          project.members.push(id as any);
        }
      });
      if (project.isModified('members')) {
        await project.save();
      }
    }

    task.assignedTeamId = teamId as any;
    if (teamAssignment) task.teamAssignment = teamAssignment;
    await task.save();

    if (!team.assignedTasks.some((id) => id.toString() === taskId)) {
      team.assignedTasks.push(taskId as any);
      await team.save();
    }

    await createTeamActivity({
      teamId,
      actor: req.user?._id.toString() || '',
      type: 'assignment_added',
      message: 'Task assigned to team',
    });

    const populatedTask = await Task.findById(task._id)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status');

    res.status(200).json({ success: true, task: populatedTask });
  } catch (error) {
    console.error('Assign team task error:', error);
    res.status(500).json({ success: false, message: 'Server error assigning task to team' });
  }
};

export const assignProjectToTeam = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, teamAssignment } = req.body as { projectId?: string; teamAssignment?: any };
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }

    if (!projectId) {
      res.status(400).json({ success: false, message: 'Project id is required' });
      return;
    }

    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ success: false, message: 'Project not found' });
      return;
    }

    const teamMembers = [team.leadUserId, ...team.memberUserIds]
      .map((id) => id.toString());
    const existing = new Set(project.members.map((member: any) => member.toString()));
    teamMembers.forEach((id) => {
      if (!existing.has(id)) {
        project.members.push(id as any);
      }
    });

    project.assignedTeamId = teamId as any;
    if (teamAssignment) project.teamAssignment = teamAssignment;
    await project.save();

    if (!team.assignedProjects.some((id) => id.toString() === projectId)) {
      team.assignedProjects.push(projectId as any);
      await team.save();
    }

    await createTeamActivity({
      teamId,
      actor: req.user?._id.toString() || '',
      type: 'assignment_added',
      message: 'Project assigned to team',
    });

    const populatedProject = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email')
      .populate('assignedTeamId', 'name leadUserId memberUserIds status');

    res.status(200).json({ success: true, project: populatedProject });
  } catch (error) {
    console.error('Assign team project error:', error);
    res.status(500).json({ success: false, message: 'Server error assigning project to team' });
  }
};

export const getTeamProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const userId = req.user?._id?.toString();
    if (req.user?.role !== 'admin' && userId) {
      const canAccess = await isTeamMemberOrLead(teamId, userId);
      if (!canAccess) {
        res.status(403).json({ success: false, message: 'Not authorized to view team progress' });
        return;
      }
    }

    const today = new Date();
    const progressAgg = await Task.aggregate([
      { $match: { assignedTeamId: team._id } },
      {
        $group: {
          _id: null,
          avgProgress: { $avg: '$progressPercent' },
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [{ $eq: ['$status', 'done'] }, 1, 0],
            },
          },
          overdueTasks: {
            $sum: {
              $cond: [{ $and: [{ $lt: ['$dueDate', today] }, { $ne: ['$status', 'done'] }] }, 1, 0],
            },
          },
        },
      },
    ]);

    const stats = progressAgg?.[0] || {
      avgProgress: 0,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
    };

    res.status(200).json({
      success: true,
      progress: {
        progressPercent: Math.round(stats.avgProgress || 0),
        totalTasks: stats.totalTasks || 0,
        completedTasks: stats.completedTasks || 0,
        overdueTasks: stats.overdueTasks || 0,
      },
    });
  } catch (error) {
    console.error('Get team progress error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching team progress' });
  }
};

export const getTeamActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const userId = req.user?._id?.toString();
    if (req.user?.role !== 'admin' && userId) {
      const canAccess = await isTeamMemberOrLead(teamId, userId);
      if (!canAccess) {
        res.status(403).json({ success: false, message: 'Not authorized to view team activity' });
        return;
      }
    }
    const [activities, updates] = await Promise.all([
      TeamActivityLog.find({ teamId })
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .limit(20),
      TeamUpdate.find({ teamId })
        .populate('submittedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    res.status(200).json({ success: true, activities, updates });
  } catch (error) {
    console.error('Get team activity error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching team activity' });
  }
};

export const getTeamPerformanceSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const teamId = getParamId(req.params.id);
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team id is required' });
      return;
    }
    const team = await Team.findById(teamId);
    if (!team) {
      res.status(404).json({ success: false, message: 'Team not found' });
      return;
    }

    const userId = req.user?._id?.toString();
    if (req.user?.role !== 'admin' && userId) {
      const canAccess = await isTeamMemberOrLead(teamId, userId);
      if (!canAccess) {
        res.status(403).json({ success: false, message: 'Not authorized to view team performance' });
        return;
      }
    }

    const teamTaskIds = await Task.find({ assignedTeamId: teamId }).select('_id');
    const taskIds = teamTaskIds.map((task) => task._id);

    const [taskAgg, taskUpdateAgg, teamUpdateAgg] = await Promise.all([
      Task.aggregate([
        { $match: { assignedTeamId: team._id } },
        {
          $group: {
            _id: null,
            avgProgress: { $avg: '$progressPercent' },
            totalTasks: { $sum: 1 },
            completedTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'done'] }, 1, 0],
              },
            },
            reviewTasks: {
              $sum: {
                $cond: [{ $eq: ['$status', 'review'] }, 1, 0],
              },
            },
          },
        },
      ]),
      TaskUpdate.aggregate([
        { $match: { taskId: { $in: taskIds } } },
        { $group: { _id: '$submittedBy', updates: { $sum: 1 } } },
        { $sort: { updates: -1 } },
      ]),
      TeamUpdate.aggregate([
        { $match: { teamId: team._id } },
        { $group: { _id: '$submittedBy', updates: { $sum: 1 } } },
        { $sort: { updates: -1 } },
      ]),
    ]);

    const stats = taskAgg?.[0] || {
      avgProgress: 0,
      totalTasks: 0,
      completedTasks: 0,
      reviewTasks: 0,
    };

    res.status(200).json({
      success: true,
      performance: {
        progressPercent: Math.round(stats.avgProgress || 0),
        totalTasks: stats.totalTasks || 0,
        completedTasks: stats.completedTasks || 0,
        reviewTasks: stats.reviewTasks || 0,
        memberContributions: taskUpdateAgg.length > 0 ? taskUpdateAgg : teamUpdateAgg,
      },
    });
  } catch (error) {
    console.error('Get team performance error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching team performance' });
  }
};
