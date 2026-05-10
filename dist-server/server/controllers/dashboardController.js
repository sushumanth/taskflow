import Task from '../models/Task.js';
import Project from '../models/Project.js';
import TaskUpdate from '../models/TaskUpdate.js';
export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        const today = new Date();
        let taskQuery = {};
        let projectQuery = {};
        if (userRole !== 'admin') {
            taskQuery = { assignedTo: userId };
            projectQuery = { members: { $in: [userId] } };
        }
        const [totalTasks, completedTasks, pendingTasks, overdueTasks, totalProjects, inProgressTasks, todoTasks, pendingReviews, tasksNeedingAttention, progressAgg,] = await Promise.all([
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
            userRole === 'admin'
                ? TaskUpdate.countDocuments({ 'review.status': 'pending' })
                : TaskUpdate.countDocuments({ submittedBy: userId, 'review.status': 'pending' }),
            Task.countDocuments({ ...taskQuery, status: { $in: ['review', 'rejected'] } }),
            Task.aggregate([
                { $match: taskQuery },
                { $group: { _id: null, avgProgress: { $avg: '$progressPercent' } } },
            ]),
        ]);
        const overallProgress = Math.round(progressAgg?.[0]?.avgProgress || 0);
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
            },
            recentTasks,
            upcomingTasks,
        });
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching dashboard stats' });
    }
};
