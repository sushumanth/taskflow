import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  assignedTeamId?: mongoose.Types.ObjectId;
  teamAssignment?: {
    dueDate?: Date;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    workload?: number;
    status?: 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
  };
  progressPercent?: number;
  lastUpdateAt?: Date;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  lastUpdateStatus?: 'on-track' | 'at-risk' | 'delayed';
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Project creator is required'],
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
    lastUpdateStatus: {
      type: String,
      enum: ['on-track', 'at-risk', 'delayed'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProject>('Project', ProjectSchema);
