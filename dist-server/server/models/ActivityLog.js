import mongoose, { Schema } from 'mongoose';
const ActivityLogSchema = new Schema({
    taskId: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
        required: [true, 'Task is required'],
    },
    updateId: {
        type: Schema.Types.ObjectId,
        ref: 'TaskUpdate',
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Actor is required'],
    },
    type: {
        type: String,
        enum: ['update_submitted', 'update_reviewed', 'comment_added', 'update_edited', 'update_deleted'],
        required: [true, 'Activity type is required'],
    },
    message: {
        type: String,
        trim: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters'],
        required: [true, 'Activity message is required'],
    },
}, {
    timestamps: true,
});
export default mongoose.model('ActivityLog', ActivityLogSchema);
