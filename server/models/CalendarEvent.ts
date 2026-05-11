import mongoose, { Schema, Document } from 'mongoose';

export type CalendarEventType = 'meeting' | 'follow_up' | 'milestone' | 'custom';
export type CalendarEventStatus = 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
export type CalendarEventPriority = 'low' | 'medium' | 'high' | 'critical';
export type CalendarEventRecurrence = {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval?: number;
  byWeekday?: number[];
  until?: Date;
  count?: number;
};

export interface ICalendarEvent extends Document {
  title: string;
  description?: string;
  type: CalendarEventType;
  startAt: Date;
  endAt?: Date;
  allDay: boolean;
  timezone?: string;
  location?: string;
  status?: CalendarEventStatus;
  priority?: CalendarEventPriority;
  createdBy: mongoose.Types.ObjectId;
  participants: mongoose.Types.ObjectId[];
  projectId?: mongoose.Types.ObjectId;
  taskId?: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  reminderMinutes: number[];
  recurrence?: CalendarEventRecurrence;
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEventSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      enum: ['meeting', 'follow_up', 'milestone', 'custom'],
      default: 'custom',
    },
    startAt: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endAt: {
      type: Date,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      trim: true,
      maxlength: [60, 'Timezone cannot exceed 60 characters'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters'],
    },
    status: {
      type: String,
      enum: ['planned', 'in-progress', 'blocked', 'review', 'done'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
    reminderMinutes: [
      {
        type: Number,
        min: 0,
      },
    ],
    recurrence: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
      },
      interval: {
        type: Number,
        min: 1,
        default: 1,
      },
      byWeekday: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
      until: {
        type: Date,
      },
      count: {
        type: Number,
        min: 1,
      },
    },
  },
  {
    timestamps: true,
  }
);

CalendarEventSchema.index({ startAt: 1 });
CalendarEventSchema.index({ endAt: 1 });
CalendarEventSchema.index({ type: 1 });
CalendarEventSchema.index({ teamId: 1 });

export default mongoose.model<ICalendarEvent>('CalendarEvent', CalendarEventSchema);
