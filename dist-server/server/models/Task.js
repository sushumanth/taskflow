import mongoose, { Schema } from 'mongoose';
const TaskSchema = new Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Project is required'],
    },
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    assignedTeamId: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
    },
    teamAssignment: {
        dueDate: {
            type: Date,
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
        },
        workload: {
            type: Number,
            min: 0,
        },
        status: {
            type: String,
            enum: ['planned', 'in-progress', 'blocked', 'review', 'done'],
        },
    },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'review', 'done', 'rejected'],
        default: 'todo',
    },
    progressPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
    },
    lastUpdateAt: {
        type: Date,
    },
    lastUpdatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    lastFeedback: {
        type: String,
        trim: true,
        maxlength: [1000, 'Feedback cannot exceed 1000 characters'],
    },
    lastFeedbackAt: {
        type: Date,
    },
    lastFeedbackBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required'],
    },
}, {
    timestamps: true,
});
export default mongoose.model('Task', TaskSchema);
