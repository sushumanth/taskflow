import mongoose, { Schema, Document } from 'mongoose';

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'rejected';

export interface ITask extends Document {
  title: string;
  description: string;
  projectId: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  assignedTeamId?: mongoose.Types.ObjectId;
  teamAssignment?: {
    dueDate?: Date;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    workload?: number;
    status?: 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
  };
  status: TaskStatus;
  progressPercent: number;
  lastUpdateAt?: Date;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  lastFeedback?: string;
  lastFeedbackAt?: Date;
  lastFeedbackBy?: mongoose.Types.ObjectId;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITask>('Task', TaskSchema);
