import Project from '../models/Project.js';
import Task from '../models/Task.js';
const attachProjectProgress = async (projects) => {
    if (projects.length === 0)
        return projects;
    const projectIds = projects.map((project) => project._id);
    const progressAgg = await Task.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        {
            $group: {
                _id: '$projectId',
                avgProgress: { $avg: '$progressPercent' },
                totalTasks: { $sum: 1 },
                completedTasks: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'done'] }, 1, 0],
                    },
                },
            },
        },
    ]);
    const progressMap = new Map(progressAgg.map((entry) => [entry._id.toString(), entry]));
    return projects.map((project) => {
        const stats = progressMap.get(project._id.toString());
        return {
            ...project.toObject(),
            progressPercent: Math.round(stats?.avgProgress || 0),
            taskCount: stats?.totalTasks || 0,
            completedTasks: stats?.completedTasks || 0,
        };
    });
};
export const createProject = async (req, res) => {
    try {
        const { name, description, members = [] } = req.body;
        const project = await Project.create({
            name,
            description,
            createdBy: req.user?._id,
            members: [...members, req.user?._id],
        });
        const populatedProject = await Project.findById(project._id)
            .populate('createdBy', 'name email')
            .populate('members', 'name email');
        res.status(201).json({ success: true, project: populatedProject });
    }
    catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ success: false, message: 'Server error creating project' });
    }
};
export const getProjects = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        let query = {};
        if (userRole !== 'admin') {
            const assignedProjectIds = await Task.distinct('projectId', { assignedTo: userId });
            query = {
                $or: [
                    { members: { $in: [userId] } },
                    { createdBy: userId },
                    { _id: { $in: assignedProjectIds } },
                ],
            };
        }
        const projects = await Project.find(query)
            .populate('createdBy', 'name email')
            .populate('members', 'name email')
            .sort({ createdAt: -1 });
        const projectsWithProgress = await attachProjectProgress(projects);
        res.status(200).json({ success: true, projects: projectsWithProgress });
    }
    catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching projects' });
    }
};
export const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('members', 'name email');
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        const isMember = project.members.some((m) => m._id.toString() === req.user?._id.toString());
        const isCreator = project.createdBy._id.toString() === req.user?._id.toString();
        const hasAssignedTask = await Task.exists({ projectId: project._id, assignedTo: req.user?._id });
        if (!isMember && !isCreator && !hasAssignedTask && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to view this project' });
            return;
        }
        const [projectWithProgress] = await attachProjectProgress([project]);
        res.status(200).json({ success: true, project: projectWithProgress });
    }
    catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching project' });
    }
};
export const updateProject = async (req, res) => {
    try {
        const { name, description } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to update this project' });
            return;
        }
        project.name = name || project.name;
        project.description = description !== undefined ? description : project.description;
        await project.save();
        const updatedProject = await Project.findById(project._id)
            .populate('createdBy', 'name email')
            .populate('members', 'name email');
        res.status(200).json({ success: true, project: updatedProject });
    }
    catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ success: false, message: 'Server error updating project' });
    }
};
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to delete this project' });
            return;
        }
        await project.deleteOne();
        res.status(200).json({ success: true, message: 'Project deleted' });
    }
    catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting project' });
    }
};
export const addMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to add members' });
            return;
        }
        if (project.members.includes(userId)) {
            res.status(400).json({ success: false, message: 'User is already a member' });
            return;
        }
        project.members.push(userId);
        await project.save();
        const updatedProject = await Project.findById(project._id)
            .populate('createdBy', 'name email')
            .populate('members', 'name email');
        res.status(200).json({ success: true, project: updatedProject });
    }
    catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ success: false, message: 'Server error adding member' });
    }
};
export const removeMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const project = await Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to remove members' });
            return;
        }
        project.members = project.members.filter((m) => m.toString() !== userId);
        await project.save();
        const updatedProject = await Project.findById(project._id)
            .populate('createdBy', 'name email')
            .populate('members', 'name email');
        res.status(200).json({ success: true, project: updatedProject });
    }
    catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ success: false, message: 'Server error removing member' });
    }
};
