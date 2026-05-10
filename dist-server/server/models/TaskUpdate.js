import mongoose, { Schema } from 'mongoose';
const TaskUpdateSchema = new Schema({
    taskId: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
        required: [true, 'Task is required'],
    },
    submittedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Submitted by is required'],
    },
    progressPercent: {
        type: Number,
        min: 0,
        max: 100,
        required: [true, 'Progress percent is required'],
    },
    status: {
        type: String,
        enum: ['todo', 'in-progress', 'review', 'done', 'rejected'],
        default: 'in-progress',
    },
    note: {
        type: String,
        trim: true,
        maxlength: [2000, 'Note cannot exceed 2000 characters'],
        required: [true, 'Update note is required'],
    },
    blockers: {
        type: String,
        trim: true,
        maxlength: [2000, 'Blockers cannot exceed 2000 characters'],
    },
    attachments: [
        {
            url: { type: String, required: true },
            filename: { type: String, required: true },
            originalName: { type: String, required: true },
            mimeType: { type: String, required: true },
            size: { type: Number, required: true },
        },
    ],
    review: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'changes-requested'],
            default: 'pending',
        },
        comment: {
            type: String,
            trim: true,
            maxlength: [2000, 'Review comment cannot exceed 2000 characters'],
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        reviewedAt: {
            type: Date,
        },
    },
    comments: [
        {
            user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            text: {
                type: String,
                trim: true,
                maxlength: [2000, 'Comment cannot exceed 2000 characters'],
                required: true,
            },
            createdAt: { type: Date, default: Date.now },
        },
    ],
}, {
    timestamps: true,
});
export default mongoose.model('TaskUpdate', TaskUpdateSchema);
