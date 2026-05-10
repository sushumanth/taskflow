import mongoose, { Schema } from 'mongoose';
const NotificationSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Notification user is required'],
    },
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        required: [true, 'Notification title is required'],
    },
    message: {
        type: String,
        trim: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters'],
        required: [true, 'Notification message is required'],
    },
    type: {
        type: String,
        enum: ['update_submitted', 'update_approved', 'update_rejected', 'feedback', 'changes_requested'],
        required: [true, 'Notification type is required'],
    },
    taskId: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
    },
    updateId: {
        type: Schema.Types.ObjectId,
        ref: 'TaskUpdate',
    },
    isRead: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});
export default mongoose.model('Notification', NotificationSchema);
