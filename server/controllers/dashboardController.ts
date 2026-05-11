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

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    const today = new Date();

    let taskQuery: any = {};
    let projectQuery: any = {};

    if (userRole !== 'admin') {
      taskQuery = { assignedTo: userId };
      projectQuery = { members: { $in: [userId] } };
    }

    const teamIds = userRole === 'admin' ? [] : await getTeamIdsForUser(userId?.toString());
    const teamTaskQuery =
      userRole === 'admin'
        ? { assignedTeamId: { $ne: null } }
        : { assignedTeamId: { $in: teamIds } };

    const pendingReviewMatch =
      userRole === 'admin'
        ? { 'review.status': 'pending' }
        : { submittedBy: userId, 'review.status': 'pending' };

    const [
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      totalProjects,
      inProgressTasks,
      todoTasks,
      pendingReviewsAgg,
      tasksNeedingAttention,
      progressAgg,
      totalTeams,
      activeTeams,
      teamTaskTotals,
      teamNeedsAttentionAgg,
    ] = await Promise.all([
      Task.countDocuments(taskQuery),
      Task.countDocuments({ ...taskQuery, status: 'done' }),
      Task.countDocuments({ ...taskQuery, status: { $ne: 'done' } }),
      Task.countDocuments({
        ...taskQuery,
        status: { $ne: 'done' },
        dueDate: { $lt: today },
      }),
      Project.countDocuments(projectQuery),
      Task.countDocuments({ ...taskQuery, status: 'in-progress' }),
      Task.countDocuments({ ...taskQuery, status: 'todo' }),
      TaskUpdate.aggregate([
        { $match: pendingReviewMatch },
        {
          $lookup: {
            from: 'tasks',
            localField: 'taskId',
            foreignField: '_id',
            as: 'task',
          },
        },
        { $match: { 'task.0': { $exists: true } } },
        { $count: 'count' },
      ]),
      Task.countDocuments({ ...taskQuery, status: { $in: ['review', 'rejected'] } }),
      Task.aggregate([
        { $match: taskQuery },
        { $group: { _id: null, avgProgress: { $avg: '$progressPercent' } } },
      ]),
      Team.countDocuments(userRole === 'admin' ? {} : { _id: { $in: teamIds } }),
      Team.countDocuments(
        userRole === 'admin'
          ? { status: 'active' }
          : { _id: { $in: teamIds }, status: 'active' }
      ),
      Task.aggregate([
        { $match: teamTaskQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'done'] }, 1, 0],
              },
            },
          },
        },
      ]),
      Task.aggregate([
        {
          $match: {
            ...teamTaskQuery,
            $or: [
              { status: { $in: ['review', 'rejected'] } },
              { dueDate: { $lt: today }, status: { $ne: 'done' } },
            ],
          },
        },
        { $group: { _id: '$assignedTeamId' } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    ]);

    const overallProgress = Math.round(progressAgg?.[0]?.avgProgress || 0);
    const pendingReviews = pendingReviewsAgg?.[0]?.count || 0;
    const teamAssignedTasks = teamTaskTotals?.[0]?.total || 0;
    const teamCompletionRate = teamAssignedTasks
      ? Math.round(((teamTaskTotals?.[0]?.completed || 0) / teamAssignedTasks) * 100)
      : 0;
    const teamsNeedingAttention = teamNeedsAttentionAgg?.[0]?.count || 0;

    const recentTasks = await Task.find(taskQuery)
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const upcomingTasks = await Task.find({
      ...taskQuery,
      status: { $ne: 'done' },
      dueDate: { $gte: today },
    })
      .populate('projectId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ dueDate: 1 })
      .limit(5);

    res.status(200).json({
      success: true,
      stats: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        totalProjects,
        inProgressTasks,
        todoTasks,
        pendingReviews,
        tasksNeedingAttention,
        overallProgress,
        totalTeams,
        activeTeams,
        teamAssignedTasks,
        teamCompletionRate,
        teamsNeedingAttention,
      },
      recentTasks,
      upcomingTasks,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching dashboard stats' });
  }
};
