import { Response } from 'express';
import CalendarEvent from '../models/CalendarEvent.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import TaskUpdate from '../models/TaskUpdate.js';
import Team from '../models/Team.js';
import { AuthRequest } from '../middleware/auth.js';

const allowedEventTypes = new Set(['meeting', 'follow_up', 'milestone', 'custom']);
const allowedRecurrence = new Set(['daily', 'weekly', 'monthly']);

const parseDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseBoolean = (value?: string | string[]): boolean | undefined => {
  if (Array.isArray(value)) return parseBoolean(value[0]);
  if (value === undefined) return undefined;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return undefined;
};

const getTeamIdsForUser = async (userId?: string) => {
  if (!userId) return [] as string[];
  const teams = await Team.find({
    $or: [{ leadUserId: userId }, { memberUserIds: userId }],
  }).select('_id');
  return teams.map((team) => team._id.toString());
};

const expandRecurringEvent = (event: any, start: Date, end: Date) => {
  if (!event.recurrence?.frequency || !event.startAt) return [event];

  const occurrences: any[] = [];
  const frequency = event.recurrence.frequency as 'daily' | 'weekly' | 'monthly';
  const interval = Math.max(Number(event.recurrence.interval) || 1, 1);
  const byWeekday = Array.isArray(event.recurrence.byWeekday)
    ? event.recurrence.byWeekday
    : [];
  const until = event.recurrence.until ? new Date(event.recurrence.until) : undefined;
  const maxCount = Number(event.recurrence.count) || undefined;

  let cursor = new Date(event.startAt);
  let count = 0;

  while (cursor <= end) {
    if (until && cursor > until) break;
    if (maxCount && count >= maxCount) break;

    const isInRange = cursor >= start && cursor <= end;
    let include = false;

    if (frequency === 'weekly' && byWeekday.length > 0) {
      include = byWeekday.includes(cursor.getDay());
    } else {
      include = true;
    }

    if (isInRange && include) {
      const durationMs = event.endAt
        ? new Date(event.endAt).getTime() - new Date(event.startAt).getTime()
        : 0;
      const endAt = durationMs > 0
        ? new Date(cursor.getTime() + durationMs)
        : new Date(cursor.getTime());
      occurrences.push({
        ...event,
        startAt: new Date(cursor),
        endAt,
        recurrenceId: event._id,
      });
      count += 1;
    }

    if (frequency === 'daily') {
      cursor.setDate(cursor.getDate() + interval);
    } else if (frequency === 'weekly') {
      cursor.setDate(cursor.getDate() + 1);
      if (byWeekday.length === 0) {
        cursor.setDate(cursor.getDate() + (7 * interval - 1));
      }
    } else if (frequency === 'monthly') {
      cursor.setMonth(cursor.getMonth() + interval);
    }
  }

  return occurrences.length ? occurrences : [event];
};

const toCalendarEvent = (payload: any) => ({
  _id: payload._id?.toString() || payload.id,
  title: payload.title,
  description: payload.description,
  type: payload.type,
  source: payload.source,
  startAt: payload.startAt,
  endAt: payload.endAt,
  allDay: payload.allDay,
  timezone: payload.timezone,
  status: payload.status,
  priority: payload.priority,
  progressPercent: payload.progressPercent,
  project: payload.project,
  task: payload.task,
  team: payload.team,
  assignee: payload.assignee,
  assignedTeam: payload.assignedTeam,
  reviewStatus: payload.reviewStatus,
  isOverdue: payload.isOverdue,
  teamAssignment: payload.teamAssignment,
  recurrence: payload.recurrence,
  createdBy: payload.createdBy,
  recurrenceId: payload.recurrenceId,
});

export const getCalendarEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const start = parseDate(req.query.start as string) || new Date();
    const end = parseDate(req.query.end as string) || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const userId = req.user?._id?.toString();
    const role = req.user?.role;

    const projectId = req.query.projectId as string | undefined;
    const teamId = req.query.teamId as string | undefined;
    const assigneeId = req.query.assigneeId as string | undefined;
    const priority = req.query.priority as string | undefined;
    const status = req.query.status as string | undefined;
    const typeFilter = req.query.type as string | undefined;
    const sourceFilter = req.query.source as string | undefined;
    const overdueOnly = parseBoolean(req.query.overdue);
    const reviewStatus = req.query.reviewStatus as string | undefined;

    const teamIds = role === 'admin' ? [] : await getTeamIdsForUser(userId);

    const taskQuery: any = {
      dueDate: { $gte: start, $lte: end },
    };

    if (status) taskQuery.status = status;
    if (projectId) taskQuery.projectId = projectId;
    if (assigneeId) taskQuery.assignedTo = assigneeId;
    if (teamId) taskQuery.assignedTeamId = teamId;

    if (role !== 'admin') {
      taskQuery.$or = [{ assignedTo: userId }, { assignedTeamId: { $in: teamIds } }];
    }

    const projectQuery: any = {
      'teamAssignment.dueDate': { $gte: start, $lte: end },
    };
    if (projectId) projectQuery._id = projectId;
    if (teamId) projectQuery.assignedTeamId = teamId;

    if (role !== 'admin') {
      projectQuery.$or = [
        { members: { $in: [userId] } },
        { createdBy: userId },
        { assignedTeamId: { $in: teamIds } },
      ];
    }

    const reviewQuery: any = {
      'review.status': reviewStatus || 'pending',
      createdAt: { $gte: start, $lte: end },
    };

    if (role !== 'admin') {
      reviewQuery.submittedBy = userId;
    }

    const customQuery: any = {
      startAt: { $lte: end },
      $and: [
        { $or: [{ endAt: { $gte: start } }, { endAt: { $exists: false } }, { endAt: null }] },
      ],
    };

    if (role !== 'admin') {
      customQuery.$and.push({
        $or: [
          { createdBy: userId },
          { participants: userId },
          { teamId: { $in: teamIds } },
        ],
      });
    }

    if (projectId) customQuery.projectId = projectId;
    if (teamId) customQuery.teamId = teamId;

    const [tasks, projects, pendingReviews, customEvents] = await Promise.all([
      Task.find(taskQuery)
        .populate('projectId', 'name')
        .populate('assignedTo', 'name email')
        .populate('assignedTeamId', 'name'),
      Project.find(projectQuery)
        .populate('assignedTeamId', 'name')
        .populate('createdBy', 'name email'),
      TaskUpdate.find(reviewQuery)
        .populate({
          path: 'taskId',
          select: 'title dueDate status assignedTo assignedTeamId projectId progressPercent teamAssignment',
          populate: { path: 'projectId', select: 'name' },
        })
        .populate('submittedBy', 'name email'),
      CalendarEvent.find(customQuery)
        .populate('createdBy', 'name email')
        .populate('participants', 'name email')
        .populate('teamId', 'name')
        .populate('projectId', 'name')
        .populate('taskId', 'title status'),
    ]);

    const now = new Date();

    const taskEvents = tasks.map((task) => {
      const isOverdue = task.status !== 'done' && task.dueDate < now;
      return toCalendarEvent({
        _id: task._id,
        title: task.title,
        description: task.description,
        type: isOverdue ? 'overdue_task' : 'task_deadline',
        source: 'system',
        startAt: task.dueDate,
        endAt: task.dueDate,
        allDay: true,
        status: task.status,
        priority: task.teamAssignment?.priority,
        progressPercent: task.progressPercent,
        project: task.projectId
          ? { _id: task.projectId._id?.toString(), name: task.projectId.name }
          : undefined,
        task: { _id: task._id.toString(), title: task.title, status: task.status },
        assignee: task.assignedTo,
        assignedTeam: task.assignedTeamId,
        isOverdue,
        teamAssignment: task.teamAssignment,
      });
    });

    const projectEvents = projects
      .filter((project) => project.teamAssignment?.dueDate)
      .map((project) =>
        toCalendarEvent({
          _id: project._id,
          title: project.name,
          description: project.description,
          type: 'project_deadline',
          source: 'system',
          startAt: project.teamAssignment?.dueDate,
          endAt: project.teamAssignment?.dueDate,
          allDay: true,
          status: project.lastUpdateStatus,
          priority: project.teamAssignment?.priority,
          progressPercent: project.progressPercent,
          project: { _id: project._id.toString(), name: project.name },
          team: project.assignedTeamId
            ? { _id: project.assignedTeamId._id?.toString(), name: project.assignedTeamId.name }
            : undefined,
          teamAssignment: project.teamAssignment,
        })
      );

    const reviewEvents = pendingReviews
      .filter((update) => update.taskId)
      .map((update: any) => {
        const task = update.taskId as any;
        return toCalendarEvent({
          _id: update._id,
          title: `Review: ${task?.title || 'Task update'}`,
          description: update.note,
          type: 'review_pending',
          source: 'system',
          startAt: update.createdAt,
          endAt: update.createdAt,
          allDay: false,
          status: task?.status,
          progressPercent: update.progressPercent,
          project: task?.projectId
            ? { _id: task.projectId._id?.toString(), name: task.projectId.name }
            : undefined,
          task: task
            ? { _id: task._id?.toString(), title: task.title, status: task.status }
            : undefined,
          assignee: task?.assignedTo,
          assignedTeam: task?.assignedTeamId,
          reviewStatus: update.review?.status,
        });
      });

    const customExpanded = customEvents.flatMap((event) =>
      expandRecurringEvent(event.toObject(), start, end).map((entry) =>
        toCalendarEvent({
          ...entry,
          source: 'custom',
          type: entry.type || 'custom',
          allDay: entry.allDay ?? false,
          project: entry.projectId
            ? { _id: entry.projectId._id?.toString(), name: entry.projectId.name }
            : undefined,
          task: entry.taskId
            ? { _id: entry.taskId._id?.toString(), title: entry.taskId.title, status: entry.taskId.status }
            : undefined,
          team: entry.teamId
            ? { _id: entry.teamId._id?.toString(), name: entry.teamId.name }
            : undefined,
          createdBy: entry.createdBy,
        })
      )
    );

    let events = [...taskEvents, ...projectEvents, ...reviewEvents, ...customExpanded];

    if (typeFilter) {
      events = events.filter((event) => event.type === typeFilter);
    }

    if (sourceFilter) {
      events = events.filter((event) => event.source === sourceFilter);
    }

    if (priority) {
      events = events.filter((event) => event.priority === priority);
    }

    if (overdueOnly) {
      events = events.filter((event) => event.isOverdue);
    }

    if (assigneeId) {
      events = events.filter((event) => event.assignee?._id?.toString() === assigneeId);
    }

    res.status(200).json({
      success: true,
      events,
      range: { start, end },
    });
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching calendar events' });
  }
};

export const createCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title,
      description,
      type,
      startAt,
      endAt,
      allDay,
      timezone,
      location,
      status,
      priority,
      participants,
      projectId,
      taskId,
      teamId,
      reminderMinutes,
      recurrence,
    } = req.body;

    const normalizedType = String(type || 'custom');
    if (!allowedEventTypes.has(normalizedType)) {
      res.status(400).json({ success: false, message: 'Invalid event type' });
      return;
    }

    const startDate = parseDate(startAt);
    if (!startDate) {
      res.status(400).json({ success: false, message: 'Start date is required' });
      return;
    }
    const endDate = parseDate(endAt) || startDate;

    if (recurrence?.frequency && !allowedRecurrence.has(recurrence.frequency)) {
      res.status(400).json({ success: false, message: 'Invalid recurrence frequency' });
      return;
    }

    const event = await CalendarEvent.create({
      title,
      description,
      type: normalizedType,
      startAt: startDate,
      endAt: endDate,
      allDay: Boolean(allDay),
      timezone,
      location,
      status,
      priority,
      createdBy: req.user?._id,
      participants: Array.isArray(participants)
        ? participants
        : participants
        ? [participants]
        : [],
      projectId,
      taskId,
      teamId,
      reminderMinutes: Array.isArray(reminderMinutes) ? reminderMinutes : [],
      recurrence: recurrence || undefined,
    });

    const populated = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name email')
      .populate('participants', 'name email')
      .populate('teamId', 'name')
      .populate('projectId', 'name')
      .populate('taskId', 'title status');

    res.status(201).json({ success: true, event: populated });
  } catch (error) {
    console.error('Create calendar event error:', error);
    res.status(500).json({ success: false, message: 'Server error creating calendar event' });
  }
};

export const updateCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    const {
      title,
      description,
      type,
      startAt,
      endAt,
      allDay,
      timezone,
      location,
      status,
      priority,
      participants,
      projectId,
      taskId,
      teamId,
      reminderMinutes,
      recurrence,
    } = req.body;

    if (type && !allowedEventTypes.has(type)) {
      res.status(400).json({ success: false, message: 'Invalid event type' });
      return;
    }

    if (recurrence?.frequency && !allowedRecurrence.has(recurrence.frequency)) {
      res.status(400).json({ success: false, message: 'Invalid recurrence frequency' });
      return;
    }

    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (type !== undefined) event.type = type;
    if (startAt !== undefined) {
      const startDate = parseDate(startAt);
      if (!startDate) {
        res.status(400).json({ success: false, message: 'Invalid start date' });
        return;
      }
      event.startAt = startDate;
    }
    if (endAt !== undefined) {
      const endDate = parseDate(endAt);
      if (!endDate) {
        res.status(400).json({ success: false, message: 'Invalid end date' });
        return;
      }
      event.endAt = endDate;
    }
    if (allDay !== undefined) event.allDay = Boolean(allDay);
    if (timezone !== undefined) event.timezone = timezone;
    if (location !== undefined) event.location = location;
    if (status !== undefined) event.status = status;
    if (priority !== undefined) event.priority = priority;
    if (participants !== undefined) {
      event.participants = Array.isArray(participants)
        ? participants
        : participants
        ? [participants]
        : [];
    }
    if (projectId !== undefined) event.projectId = projectId || undefined;
    if (taskId !== undefined) event.taskId = taskId || undefined;
    if (teamId !== undefined) event.teamId = teamId || undefined;
    if (reminderMinutes !== undefined) event.reminderMinutes = Array.isArray(reminderMinutes) ? reminderMinutes : [];
    if (recurrence !== undefined) event.recurrence = recurrence || undefined;

    await event.save();

    const populated = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name email')
      .populate('participants', 'name email')
      .populate('teamId', 'name')
      .populate('projectId', 'name')
      .populate('taskId', 'title status');

    res.status(200).json({ success: true, event: populated });
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ success: false, message: 'Server error updating calendar event' });
  }
};

export const rescheduleCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    const startAt = parseDate(req.body.startAt);
    const endAt = parseDate(req.body.endAt) || startAt;

    if (!startAt) {
      res.status(400).json({ success: false, message: 'Start date is required' });
      return;
    }

    event.startAt = startAt;
    event.endAt = endAt || startAt;
    await event.save();

    const populated = await CalendarEvent.findById(event._id)
      .populate('createdBy', 'name email')
      .populate('participants', 'name email')
      .populate('teamId', 'name')
      .populate('projectId', 'name')
      .populate('taskId', 'title status');

    res.status(200).json({ success: true, event: populated });
  } catch (error) {
    console.error('Reschedule calendar event error:', error);
    res.status(500).json({ success: false, message: 'Server error rescheduling event' });
  }
};

export const deleteCalendarEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const event = await CalendarEvent.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    await event.deleteOne();
    res.status(200).json({ success: true, message: 'Event deleted' });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting event' });
  }
};
