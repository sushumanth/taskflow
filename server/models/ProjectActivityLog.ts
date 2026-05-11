import mongoose, { Schema, Document } from 'mongoose';

export type ProjectActivityType = 'project_update_submitted' | 'comment_added';

export interface IProjectActivityLog extends Document {
  projectId: mongoose.Types.ObjectId;
  actor: mongoose.Types.ObjectId;
  type: ProjectActivityType;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectActivityLogSchema: Schema = new Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProjectActivityLog>('ProjectActivityLog', ProjectActivityLogSchema);
