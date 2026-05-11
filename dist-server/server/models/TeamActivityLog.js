import mongoose, { Schema } from 'mongoose';
const TeamActivityLogSchema = new Schema({
    teamId: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, 'Team is required'],
    },
    actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Actor is required'],
    },
    type: {
        type: String,
        enum: [
            'team_created',
            'team_updated',
            'member_added',
            'member_removed',
            'lead_changed',
            'assignment_added',
            'assignment_removed',
            'team_update_submitted',
        ],
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
export default mongoose.model('TeamActivityLog', TeamActivityLogSchema);
