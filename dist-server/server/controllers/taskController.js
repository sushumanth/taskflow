import Task from '../models/Task.js';
import Project from '../models/Project.js';
export const createTask = async (req, res) => {
    try {
        const { title, description, projectId, assignedTo, dueDate } = req.body;
        const project = await Project.findById(projectId);
        if (!project) {
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }
        if (project.createdBy.toString() !== req.user?._id.toString() && req.user?.role !== 'admin') {
            res.status(403).json({ success: false, message: 'Not authorized to create tasks in this project' });
            return;
        }
        if (assignedTo && !project.members.some((member) => member.toString() === assignedTo)) {
            project.members.push(assignedTo);
            await project.save();
        }
        const task = await Task.create({
            title,
            description,
            projectId,
            assignedTo,
            status: 'todo',
            progressPercent: 0,
            dueDate: new Date(dueDate),
        });
        const populatedTask = await Task.findById(task._id)
            .populate('projectId', 'name')
            .populate('assignedTo', 'name email');
        res.status(201).json({ success: true, task: populatedTask });
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ success: false, message: 'Server error creating task' });
    }
};
export const getTasks = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        const { projectId, status } = req.query;
        let query = {};
        if (projectId) {
            query.projectId = projectId;
        }
        if (status) {
            query.status = status;
        }
        if (userRole !== 'admin') {
            query.assignedTo = userId;
        }
        const tasks = await Task.find(query)
            .populate('projectId', 'name')
            .populate('assignedTo', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, tasks });
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching tasks' });
    }
};
export const getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('projectId', 'name')
            .populate('assignedTo', 'name email');
        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }
        const canAccess = task.assignedTo._id.toString() === req.user?._id.toString() ||
            req.user?.role === 'admin';
        if (!canAccess) {
            const project = await Project.findById(task.projectId);
            if (project?.createdBy.toString() !== req.user?._id.toString()) {
                res.status(403).json({ success: false, message: 'Not authorized to view this task' });
                return;
            }
        }
        res.status(200).json({ success: true, task });
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching task' });
    }
};
export const updateTask = async (req, res) => {
    try {
        const { title, description, assignedTo, status, dueDate } = req.body;
        const task = await Task.findById(req.params.id);
        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }
        const isAdmin = req.user?.role === 'admin';
        const isAssignee = task.assignedTo.toString() === req.user?._id.toString();
        if (!isAdmin && !isAssignee) {
            res.status(403).json({ success: false, message: 'Not authorized to update this task' });
            return;
        }
        // Members can only update status, admins can update everything
        if (!isAdmin && isAssignee) {
            if (status && ['todo', 'in-progress', 'review', 'done', 'rejected'].includes(status)) {
                task.status = status;
            }
            else {
                res.status(403).json({ success: false, message: 'Members can only update task status' });
                return;
            }
        }
        else {
            if (title)
                task.title = title;
            if (description !== undefined)
                task.description = description;
            if (assignedTo)
                task.assignedTo = assignedTo;
            if (status && ['todo', 'in-progress', 'review', 'done', 'rejected'].includes(status)) {
                task.status = status;
            }
            if (dueDate)
                task.dueDate = new Date(dueDate);
        }
        await task.save();
        const updatedTask = await Task.findById(task._id)
            .populate('projectId', 'name')
            .populate('assignedTo', 'name email');
        res.status(200).json({ success: true, task: updatedTask });
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, message: 'Server error updating task' });
    }
};
export const deleteTask = async (req, res) => {
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
        await task.deleteOne();
        res.status(200).json({ success: true, message: 'Task deleted' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting task' });
    }
};
