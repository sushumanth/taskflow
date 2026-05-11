import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'task_assigned'
  | 'deadline_alert'
  | 'project_update'
  | 'team_update'
  | 'review_requested'
  | 'update_submitted'
  | 'update_approved'
  | 'update_rejected'
  | 'feedback'
  | 'changes_requested';

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  taskId?: mongoose.Types.ObjectId;
  updateId?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
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
      enum: [
        'task_assigned',
        'deadline_alert',
        'project_update',
        'team_update',
        'review_requested',
        'update_submitted',
        'update_approved',
        'update_rejected',
        'feedback',
        'changes_requested',
      ],
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
