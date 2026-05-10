import Task from '../models/Task.js';
import TaskUpdate from '../models/TaskUpdate.js';
import Project from '../models/Project.js';
import Notification from '../models/Notification.js';
import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
const allowedStatuses = new Set(['todo', 'in-progress', 'review', 'done', 'rejected']);
const allowedReviewStatuses = new Set(['approved', 'rejected', 'changes-requested']);
const getParamId = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
const getQueryValue = (param) => {
    if (Array.isArray(param))
        return param[0];
    return param;
};
const canViewTask = async (taskId, userId, role) => {
    const task = await Task.findById(taskId);
    if (!task)
        return false;
    if (role === 'admin')
        return true;
    if (task.assignedTo.toString() === userId)
        return true;
    const project = await Project.findById(task.projectId).select('createdBy');
    return project?.createdBy.toString() === userId;
};
const canSubmitUpdate = async (taskId, userId, role) => {
    const task = await Task.findById(taskId).select('assignedTo');
    if (!task)
        return false;
    if (role === 'admin')
        return true;
    return task.assignedTo.toString() === userId;
};
const buildAttachments = (files) => files.map((file) => ({
    url: `/uploads/task-updates/${file.filename}`,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
}));
const notifyAdmins = async (payload) => {
    const admins = await User.find({ role: 'admin' }).select('_id');
    if (admins.length === 0)
        return;
    const notifications = admins.map((admin) => ({
        user: admin._id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        taskId: payload.taskId,
        updateId: payload.updateId,
    }));
    await Notification.insertMany(notifications);
};
const createActivity = async (data) => {
    await ActivityLog.create({
        taskId: data.taskId,
        updateId: data.updateId,
        actor: data.actor,
        type: data.type,
        message: data.message,
    });
};
const recalculateTaskProgress = async (taskId) => {
    const latestUpdate = await TaskUpdate.findOne({ taskId }).sort({ createdAt: -1 });
    const task = await Task.findById(taskId);
    if (!task)
        return;
    if (!latestUpdate) {
        task.progressPercent = 0;
        task.status = 'todo';
        task.lastUpdateAt = undefined;
        task.lastUpdatedBy = undefined;
        await task.save();
        return;
    }
    task.progressPercent = latestUpdate.progressPercent;
    task.status = latestUpdate.status;
    task.lastUpdateAt = latestUpdate.createdAt;
    task.lastUpdatedBy = latestUpdate.submittedBy;
    await task.save();
};
export const createTaskUpdate = async (req, res) => {
    try {
        const taskId = getParamId(req.params.id);
        if (!taskId) {
            res.status(400).json({ success: false, message: 'Task id is required' });
            return;
        }
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }
        const canSubmit = await canSubmitUpdate(taskId, userId, req.user?.role);
        if (!canSubmit) {
            res.status(403).json({ success: false, message: 'Not authorized to update this task' });
            return;
        }
        const progressPercent = Number(req.body.progressPercent);
        const status = String(req.body.status || '').toLowerCase();
        const note = String(req.body.note || '').trim();
        const blockers = req.body.blockers ? String(req.body.blockers).trim() : undefined;
        if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
            res.status(400).json({ success: false, message: 'Progress percent must be between 0 and 100' });
            return;
        }
        if (!allowedStatuses.has(status)) {
            res.status(400).json({ success: false, message: 'Invalid status' });
            return;
        }
        const normalizedStatus = status;
        if (!note) {
            res.status(400).json({ success: false, message: 'Update note is required' });
            return;
        }
        const files = req.files || [];
        const attachments = buildAttachments(files);
        const update = await TaskUpdate.create({
            taskId,
            submittedBy: req.user?._id,
            progressPercent,
            status: normalizedStatus,
            note,
            blockers,
            attachments,
            review: { status: 'pending' },
        });
        const taskStatus = req.user?.role === 'admin' ? normalizedStatus : 'review';
        await Task.findByIdAndUpdate(taskId, {
            progressPercent,
            status: taskStatus,
            lastUpdateAt: new Date(),
            lastUpdatedBy: req.user?._id,
        });
        await createActivity({
            taskId,
            updateId: update._id.toString(),
            actor: userId,
            type: 'update_submitted',
            message: 'Submitted a progress update',
        });
        await notifyAdmins({
            title: 'New task update submitted',
            message: `${req.user?.name} submitted a task update for review.`,
            type: 'update_submitted',
            taskId,
            updateId: update._id.toString(),
        });
        const populatedUpdate = await TaskUpdate.findById(update._id)
            .populate('submittedBy', 'name email')
            .populate('comments.user', 'name email')
            .populate('review.reviewedBy', 'name email');
        res.status(201).json({ success: true, update: populatedUpdate });
    }
    catch (error) {
        console.error('Create task update error:', error);
        res.status(500).json({ success: false, message: 'Server error creating task update' });
    }
};
export const getTaskUpdatesByTask = async (req, res) => {
    try {
        const taskId = getParamId(req.params.id);
        if (!taskId) {
            res.status(400).json({ success: false, message: 'Task id is required' });
            return;
        }
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }
        const canAccess = await canViewTask(taskId, userId, req.user?.role);
        if (!canAccess) {
            res.status(403).json({ success: false, message: 'Not authorized to view updates for this task' });
            return;
        }
        const updates = await TaskUpdate.find({ taskId })
            .populate('submittedBy', 'name email')
            .populate('comments.user', 'name email')
            .populate('review.reviewedBy', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, updates });
    }
    catch (error) {
        console.error('Get task updates error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching task updates' });
    }
};
export const getTaskUpdatesByEmployee = async (req, res) => {
    try {
        const employeeId = getQueryValue(req.query.employeeId);
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        if (employeeId && req.user?.role !== 'admin' && employeeId !== userId) {
            res.status(403).json({ success: false, message: 'Not authorized to view these updates' });
            return;
        }
        const queryUserId = employeeId || userId;
        const updates = await TaskUpdate.find({ submittedBy: queryUserId })
            .populate('taskId', 'title')
            .populate('submittedBy', 'name email')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, updates });
    }
    catch (error) {
        console.error('Get employee updates error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching employee updates' });
    }
};
export const reviewTaskUpdate = async (req, res) => {
    try {
        const updateId = getParamId(req.params.id);
        if (!updateId) {
            res.status(400).json({ success: false, message: 'Update id is required' });
            return;
        }
        const { status, comment } = req.body;
        const reviewStatus = String(status || '').toLowerCase();
        if (!allowedReviewStatuses.has(reviewStatus)) {
            res.status(400).json({ success: false, message: 'Invalid review status' });
            return;
        }
        const update = await TaskUpdate.findById(updateId);
        if (!update) {
            res.status(404).json({ success: false, message: 'Update not found' });
            return;
        }
        update.review = {
            status: reviewStatus,
            comment: comment?.trim(),
            reviewedBy: req.user?._id,
            reviewedAt: new Date(),
        };
        await update.save();
        const task = await Task.findById(update.taskId);
        if (task) {
            if (reviewStatus === 'approved') {
                task.status = update.status;
                task.progressPercent = update.progressPercent;
            }
            if (reviewStatus === 'rejected') {
                task.status = 'rejected';
            }
            if (reviewStatus === 'changes-requested') {
                task.status = 'in-progress';
            }
            if (comment) {
                task.lastFeedback = comment.trim();
                task.lastFeedbackAt = new Date();
                task.lastFeedbackBy = req.user?._id;
            }
            await task.save();
        }
        await createActivity({
            taskId: update.taskId.toString(),
            updateId: update._id.toString(),
            actor: req.user?._id?.toString() || '',
            type: 'update_reviewed',
            message: `Review marked as ${reviewStatus}`,
        });
        await Notification.create({
            user: update.submittedBy,
            title: `Update ${reviewStatus.replace('-', ' ')}`,
            message: comment?.trim()
                ? comment.trim()
                : `Your update was ${reviewStatus.replace('-', ' ')}`,
            type: reviewStatus === 'approved'
                ? 'update_approved'
                : reviewStatus === 'rejected'
                    ? 'update_rejected'
                    : 'changes_requested',
            taskId: update.taskId,
            updateId: update._id,
        });
        const populated = await TaskUpdate.findById(update._id)
            .populate('submittedBy', 'name email')
            .populate('comments.user', 'name email')
            .populate('review.reviewedBy', 'name email');
        res.status(200).json({ success: true, update: populated });
    }
    catch (error) {
        console.error('Review task update error:', error);
        res.status(500).json({ success: false, message: 'Server error reviewing update' });
    }
};
export const addTaskUpdateComment = async (req, res) => {
    try {
        const updateId = getParamId(req.params.id);
        if (!updateId) {
            res.status(400).json({ success: false, message: 'Update id is required' });
            return;
        }
        const text = String(req.body.text || '').trim();
        if (!text) {
            res.status(400).json({ success: false, message: 'Comment text is required' });
            return;
        }
        const update = await TaskUpdate.findById(updateId);
        if (!update) {
            res.status(404).json({ success: false, message: 'Update not found' });
            return;
        }
        const taskId = update.taskId.toString();
        const taskExists = await Task.exists({ _id: taskId });
        if (!taskExists) {
            res.status(404).json({ success: false, message: 'Task not found' });
            return;
        }
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        const canAccess = await canViewTask(taskId, userId, req.user?.role);
        if (!canAccess) {
            res.status(403).json({ success: false, message: 'Not authorized to comment on this update' });
            return;
        }
        update.comments.push({
            user: req.user._id,
            text,
            createdAt: new Date(),
        });
        await update.save();
        await createActivity({
            taskId,
            updateId: update._id.toString(),
            actor: userId,
            type: 'comment_added',
            message: 'Added a comment',
        });
        if (req.user?.role === 'admin') {
            await Notification.create({
                user: update.submittedBy,
                title: 'Feedback received',
                message: text,
                type: 'feedback',
                taskId: update.taskId,
                updateId: update._id,
            });
        }
        else {
            await notifyAdmins({
                title: 'New feedback comment',
                message: `${req.user?.name} added a comment on a task update.`,
                type: 'feedback',
                taskId,
                updateId: update._id.toString(),
            });
        }
        const populated = await TaskUpdate.findById(update._id)
            .populate('submittedBy', 'name email')
            .populate('comments.user', 'name email')
            .populate('review.reviewedBy', 'name email');
        res.status(200).json({ success: true, update: populated });
    }
    catch (error) {
        console.error('Add update comment error:', error);
        res.status(500).json({ success: false, message: 'Server error adding comment' });
    }
};
export const editTaskUpdate = async (req, res) => {
    try {
        const updateId = getParamId(req.params.id);
        if (!updateId) {
            res.status(400).json({ success: false, message: 'Update id is required' });
            return;
        }
        const update = await TaskUpdate.findById(updateId);
        if (!update) {
            res.status(404).json({ success: false, message: 'Update not found' });
            return;
        }
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        const isOwner = update.submittedBy.toString() === userId;
        const isAdmin = req.user?.role === 'admin';
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, message: 'Not authorized to edit this update' });
            return;
        }
        const currentReviewStatus = update.review?.status || 'pending';
        if (currentReviewStatus === 'approved' && !isAdmin) {
            res.status(400).json({ success: false, message: 'Approved updates cannot be edited' });
            return;
        }
        const progressPercent = req.body.progressPercent !== undefined ? Number(req.body.progressPercent) : undefined;
        const status = req.body.status ? String(req.body.status).toLowerCase() : undefined;
        const note = req.body.note ? String(req.body.note).trim() : undefined;
        const blockers = req.body.blockers !== undefined ? String(req.body.blockers).trim() : undefined;
        if (progressPercent !== undefined) {
            if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
                res.status(400).json({ success: false, message: 'Progress percent must be between 0 and 100' });
                return;
            }
            update.progressPercent = progressPercent;
        }
        if (status !== undefined) {
            if (!allowedStatuses.has(status)) {
                res.status(400).json({ success: false, message: 'Invalid status' });
                return;
            }
            update.status = status;
        }
        if (note !== undefined)
            update.note = note;
        if (blockers !== undefined)
            update.blockers = blockers;
        const files = req.files || [];
        if (files.length > 0) {
            update.attachments = [...update.attachments, ...buildAttachments(files)];
        }
        update.review = { status: 'pending' };
        await update.save();
        const taskStatus = req.user?.role === 'admin' ? update.status : 'review';
        await Task.findByIdAndUpdate(update.taskId, {
            progressPercent: update.progressPercent,
            status: taskStatus,
            lastUpdateAt: new Date(),
            lastUpdatedBy: req.user?._id,
        });
        await createActivity({
            taskId: update.taskId.toString(),
            updateId: update._id.toString(),
            actor: userId,
            type: 'update_edited',
            message: 'Edited a task update',
        });
        const populated = await TaskUpdate.findById(update._id)
            .populate('submittedBy', 'name email')
            .populate('comments.user', 'name email')
            .populate('review.reviewedBy', 'name email');
        res.status(200).json({ success: true, update: populated });
    }
    catch (error) {
        console.error('Edit task update error:', error);
        res.status(500).json({ success: false, message: 'Server error editing update' });
    }
};
export const deleteTaskUpdate = async (req, res) => {
    try {
        const updateId = getParamId(req.params.id);
        if (!updateId) {
            res.status(400).json({ success: false, message: 'Update id is required' });
            return;
        }
        const update = await TaskUpdate.findById(updateId);
        if (!update) {
            res.status(404).json({ success: false, message: 'Update not found' });
            return;
        }
        const userId = req.user?._id?.toString();
        if (!userId) {
            res.status(401).json({ success: false, message: 'Not authorized' });
            return;
        }
        const isOwner = update.submittedBy.toString() === userId;
        const isAdmin = req.user?.role === 'admin';
        if (!isOwner && !isAdmin) {
            res.status(403).json({ success: false, message: 'Not authorized to delete this update' });
            return;
        }
        const currentReviewStatus = update.review?.status || 'pending';
        if (currentReviewStatus === 'approved' && !isAdmin) {
            res.status(400).json({ success: false, message: 'Approved updates cannot be deleted' });
            return;
        }
        await update.deleteOne();
        await recalculateTaskProgress(update.taskId.toString());
        await createActivity({
            taskId: update.taskId.toString(),
            updateId: updateId,
            actor: userId,
            type: 'update_deleted',
            message: 'Deleted a task update',
        });
        res.status(200).json({ success: true, message: 'Update deleted' });
    }
    catch (error) {
        console.error('Delete task update error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting update' });
    }
};
