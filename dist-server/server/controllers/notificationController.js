import Notification from '../models/Notification.js';
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?._id;
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);
        res.status(200).json({ success: true, notifications });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching notifications' });
    }
};
export const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            user: req.user?._id,
        });
        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }
        notification.isRead = true;
        await notification.save();
        res.status(200).json({ success: true, notification });
    }
    catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ success: false, message: 'Server error updating notification' });
    }
};
export const markAllNotificationsRead = async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user?._id, isRead: false }, { isRead: true });
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ success: false, message: 'Server error updating notifications' });
    }
};
