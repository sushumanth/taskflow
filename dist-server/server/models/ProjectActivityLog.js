import mongoose, { Schema } from 'mongoose';
const ProjectActivityLogSchema = new Schema({
    projectId: {
        type: Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Project is required'],
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Actor is required'],
    },
    type: {
        type: String,
        enum: ['project_update_submitted', 'comment_added'],
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
export default mongoose.model('ProjectActivityLog', ProjectActivityLogSchema);
