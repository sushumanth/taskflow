import mongoose, { Schema, Document } from 'mongoose';

export type ActivityType =
  | 'update_submitted'
  | 'update_reviewed'
  | 'comment_added'
  | 'update_edited'
  | 'update_deleted';

export interface IActivityLog extends Document {
  taskId: mongoose.Types.ObjectId;
  updateId?: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: ActivityType;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivityLogSchema: Schema = new Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);
