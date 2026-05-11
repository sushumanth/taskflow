import mongoose, { Schema } from 'mongoose';
const TeamSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Team name is required'],
        trim: true,
        maxlength: [120, 'Team name cannot exceed 120 characters'],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    type: {
        type: String,
        trim: true,
        maxlength: [100, 'Team type cannot exceed 100 characters'],
    },
    leadUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Team lead is required'],
    },
    memberUserIds: [
        {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Creator is required'],
    },
    assignedProjects: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Project',
        },
    ],
    assignedTasks: [
        {
            type: Schema.Types.ObjectId,
            ref: 'Task',
        },
    ],
    progressPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
    },
}, {
    timestamps: true,
});
export default mongoose.model('Team', TeamSchema);
