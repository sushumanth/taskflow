import mongoose, { Schema } from 'mongoose';
const ProjectUpdateSchema = new Schema({
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Project is required'],
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
        enum: ['on-track', 'at-risk', 'delayed'],
        default: 'on-track',
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
export default mongoose.model('ProjectUpdate', ProjectUpdateSchema);
