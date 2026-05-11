import { useEffect, useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { toast } from 'sonner';
import {
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  rescheduleCalendarEvent,
  updateCalendarEvent,
  getProjects,
  getTeams,
  getAllUsers,
  updateTask,
  updateProject,
} from '../services/api';
import type { CalendarEvent, Project, Team, User } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import AnimatedProgress from '@/components/AnimatedProgress';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  AlertTriangle,
  ClipboardCheck,
  Users,
  ListTodo,
  Bell,
  Sparkles,
  CircleDot,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';

const viewOptions = ['month', 'week', 'day', 'agenda', 'timeline'] as const;

type CalendarView = (typeof viewOptions)[number];

type CalendarFilters = {
  projectId: string;
  teamId: string;
  assigneeId: string;
  priority: string;
  status: string;
  type: string;
  overdue: boolean;
};

const eventStyles: Record<string, { label: string; icon: any; tone: string; ring: string }> = {
  task_deadline: {
    label: 'Task Deadline',
    icon: ListTodo,
    tone: 'bg-emerald-50 text-emerald-700',
    ring: 'ring-emerald-200',
  },
  overdue_task: {
    label: 'Overdue',
    icon: AlertTriangle,
    tone: 'bg-rose-50 text-rose-700',
    ring: 'ring-rose-200',
  },
  review_pending: {
    label: 'Review Pending',
    icon: ClipboardCheck,
    tone: 'bg-amber-50 text-amber-700',
    ring: 'ring-amber-200',
  },
  project_deadline: {
    label: 'Project Milestone',
    icon: Flag,
    tone: 'bg-sky-50 text-sky-700',
    ring: 'ring-sky-200',
  },
  meeting: {
    label: 'Meeting',
    icon: Users,
    tone: 'bg-indigo-50 text-indigo-700',
    ring: 'ring-indigo-200',
  },
  follow_up: {
    label: 'Follow-up',
    icon: Bell,
    tone: 'bg-orange-50 text-orange-700',
    ring: 'ring-orange-200',
  },
  milestone: {
    label: 'Milestone',
    icon: Flag,
    tone: 'bg-teal-50 text-teal-700',
    ring: 'ring-teal-200',
  },
  custom: {
    label: 'Custom',
    icon: Sparkles,
    tone: 'bg-slate-100 text-slate-700',
    ring: 'ring-slate-200',
  },
};

const buildEventTone = (event: CalendarEvent) => eventStyles[event.type] || eventStyles.custom;

const priorityDot = (priority?: string) => {
  if (priority === 'critical') return 'bg-rose-500';
  if (priority === 'high') return 'bg-amber-500';
  if (priority === 'medium') return 'bg-sky-500';
  if (priority === 'low') return 'bg-emerald-500';
  return 'bg-slate-300';
};

const formatTime = (date?: string) => (date ? format(new Date(date), 'p') : '');

const formatDate = (date?: string) => (date ? format(new Date(date), 'MMM dd, yyyy') : '');

const toLocalInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const getRangeLabel = (view: CalendarView, date: Date) => {
  if (view === 'month') return format(date, 'MMMM yyyy');
  if (view === 'day') return format(date, 'MMMM dd, yyyy');
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  return `${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`;
};

const shiftDateKeepingTime = (original: string, target: Date, allDay?: boolean) => {
  const originalDate = new Date(original);
  const next = new Date(target);
  if (allDay) {
    next.setHours(0, 0, 0, 0);
  } else {
    next.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
  }
  return next.toISOString();
};

export default function Calendar() {
  const { isAdmin } = useAuth();
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<CalendarFilters>({
    projectId: 'all',
    teamId: 'all',
    assigneeId: 'all',
    priority: 'all',
    status: 'all',
    type: 'all',
    overdue: false,
  });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    type: 'meeting',
    startAt: '',
    endAt: '',
    allDay: false,
    projectId: 'none',
    teamId: 'none',
    assigneeId: 'none',
    priority: 'medium',
  });

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    allDay: false,
  });

  const buildQueryParams = () => {
    const params: any = {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
    };
    if (filters.projectId !== 'all') params.projectId = filters.projectId;
    if (filters.teamId !== 'all') params.teamId = filters.teamId;
    if (filters.assigneeId !== 'all') params.assigneeId = filters.assigneeId;
    if (filters.priority !== 'all') params.priority = filters.priority;
    if (filters.status !== 'all') params.status = filters.status;
    if (filters.type !== 'all') params.type = filters.type;
    if (filters.overdue) params.overdue = true;
    return params;
  };

  const range = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return { start, end };
    }
    if (view === 'day') {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return { start, end };
  }, [currentDate, view]);

  const days = useMemo(() => {
    const start = range.start;
    const end = range.end;
    const list = [] as Date[];
    let cursor = new Date(start);
    while (cursor <= end) {
      list.push(new Date(cursor));
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [range]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [projectResponse, teamResponse] = await Promise.all([
          getProjects(),
          getTeams(),
        ]);
        if (projectResponse.success) setProjects(projectResponse.projects || []);
        if (teamResponse.success) setTeams(teamResponse.teams || []);
      } catch (error) {
        console.error('Failed to load filter options');
      }

      if (isAdmin) {
        try {
          const userResponse = await getAllUsers();
          if (userResponse.success) setUsers(userResponse.users || []);
        } catch (error) {
          console.error('Failed to load users');
        }
      }
    };

    fetchFilters();
  }, [isAdmin]);

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      try {
        const response = await getCalendarEvents(buildQueryParams());
        if (response.success) {
          setEvents(response.events || []);
        }
      } catch (error) {
        toast.error('Failed to load calendar events');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [range, filters]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = format(new Date(event.startAt), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(event);
    });
    return map;
  }, [events]);

  const insights = useMemo(() => {
    const overdue = events.filter((event) => event.isOverdue).length;
    const reviews = events.filter((event) => event.type === 'review_pending').length;
    const todayCount = events.filter((event) => isToday(new Date(event.startAt))).length;
    const milestoneCount = events.filter((event) => event.type === 'project_deadline').length;
    return { overdue, reviews, todayCount, milestoneCount };
  }, [events]);

  const teamLoad = useMemo(() => {
    const loadMap = new Map<string, { name: string; count: number }>();
    events
      .filter((event) => event.assignedTeam)
      .forEach((event) => {
        const team = event.assignedTeam;
        if (!team) return;
        const id = team._id;
        const entry = loadMap.get(id) || { name: team.name, count: 0 };
        entry.count += 1;
        loadMap.set(id, entry);
      });

    return Array.from(loadMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [events]);

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }
    if (view === 'month') {
      setCurrentDate((prev) => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
      return;
    }
    const step = view === 'day' ? 1 : 7;
    setCurrentDate((prev) => addDays(prev, direction === 'prev' ? -step : step));
  };

  const handleCreateEvent = async () => {
    if (!createForm.title.trim() || !createForm.startAt) {
      toast.error('Title and start time are required');
      return;
    }

    try {
      const response = await createCalendarEvent({
        title: createForm.title,
        type: createForm.type,
        startAt: createForm.startAt,
        endAt: createForm.endAt || undefined,
        allDay: createForm.allDay,
        projectId: createForm.projectId !== 'none' ? createForm.projectId : undefined,
        teamId: createForm.teamId !== 'none' ? createForm.teamId : undefined,
        participants: createForm.assigneeId !== 'none' ? [createForm.assigneeId] : undefined,
        priority: createForm.priority,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (response.success) {
        toast.success('Event created');
        setCreateOpen(false);
        setCreateForm({
          title: '',
          type: 'meeting',
          startAt: '',
          endAt: '',
          allDay: false,
          projectId: 'none',
          teamId: 'none',
          assigneeId: 'none',
          priority: 'medium',
        });
        const refreshed = await getCalendarEvents(buildQueryParams());
        if (refreshed.success) setEvents(refreshed.events || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteCalendarEvent(eventId);
      toast.success('Event deleted');
      setSelectedEvent(null);
      setEvents((prev) => prev.filter((event) => event._id !== eventId));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete event');
    }
  };

  const handleReschedule = async (event: CalendarEvent, targetDate: Date) => {
    const durationMs = event.endAt
      ? new Date(event.endAt).getTime() - new Date(event.startAt).getTime()
      : 0;
    const startAt = shiftDateKeepingTime(event.startAt, targetDate, event.allDay);
    const endAt = durationMs > 0
      ? new Date(new Date(startAt).getTime() + durationMs).toISOString()
      : undefined;

    try {
      if (event.source === 'custom') {
        await rescheduleCalendarEvent(event._id, { startAt, endAt });
      } else if (event.task) {
        await updateTask(event.task._id, { dueDate: startAt });
      } else if (event.project) {
        const teamAssignment = event.teamAssignment || {};
        await updateProject(event.project._id, {
          teamAssignment: {
            ...teamAssignment,
            dueDate: startAt,
          },
        });
      }

      toast.success('Event rescheduled');
      setSelectedEvent(null);
      setDraggedEvent(null);
      const response = await getCalendarEvents(buildQueryParams());
      if (response.success) setEvents(response.events || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reschedule event');
    }
  };

  const handleEditEvent = async () => {
    if (!selectedEvent) return;
    try {
      const response = await updateCalendarEvent(selectedEvent._id, {
        title: editForm.title,
        description: editForm.description,
        startAt: editForm.startAt,
        endAt: editForm.endAt || undefined,
        allDay: editForm.allDay,
      });
      if (response.success) {
        toast.success('Event updated');
        setEditMode(false);
        setSelectedEvent(response.event || null);
        const refreshed = await getCalendarEvents(buildQueryParams());
        if (refreshed.success) setEvents(refreshed.events || []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update event');
    }
  };

  const handleStartEdit = () => {
    if (!selectedEvent) return;
    setEditMode(true);
    setEditForm({
      title: selectedEvent.title,
      description: selectedEvent.description || '',
      startAt: toLocalInputValue(selectedEvent.startAt),
      endAt: toLocalInputValue(selectedEvent.endAt),
      allDay: selectedEvent.allDay || false,
    });
  };

  const renderMonthView = () => (
    <div className="grid grid-cols-7 gap-px rounded-xl border bg-white/80 p-2 shadow-sm">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
        <div key={day} className="px-2 py-2 text-xs font-semibold text-slate-500">
          {day}
        </div>
      ))}
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(key) || [];
        const isCurrentMonth = isSameMonth(day, currentDate);
        return (
          <div
            key={key}
            className={`group min-h-[140px] space-y-2 rounded-lg border bg-white/70 p-2 transition hover:shadow-md ${
              isCurrentMonth ? '' : 'bg-slate-50 text-slate-400'
            } ${isToday(day) ? 'ring-1 ring-emerald-200' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedEvent) {
                handleReschedule(draggedEvent, day);
              }
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                {format(day, 'd')}
              </span>
              {dayEvents.length > 3 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                  +{dayEvents.length - 3}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => {
                const style = buildEventTone(event);
                const Icon = style.icon;
                return (
                  <button
                    key={event._id}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] font-medium shadow-sm ring-1 ${style.tone} ${style.ring}`}
                    onClick={() => setSelectedEvent(event)}
                    draggable
                    onDragStart={() => setDraggedEvent(event)}
                  >
                    <Icon className="h-3 w-3" />
                    <span className={`h-2 w-2 rounded-full ${priorityDot(event.priority)}`} />
                    <span className="truncate">{event.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="grid gap-4 md:grid-cols-7">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(key) || [];
        return (
          <Card key={key} className="border-slate-200/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">
                {format(day, 'EEE')}<span className="ml-2 text-slate-400">{format(day, 'dd')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayEvents.length === 0 ? (
                <p className="text-xs text-slate-400">No events</p>
              ) : (
                dayEvents.map((event) => {
                  const style = buildEventTone(event);
                  const Icon = style.icon;
                  return (
                    <button
                      key={event._id}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium ring-1 ${style.tone} ${style.ring}`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <div className="min-w-0">
                        <p className="truncate">{event.title}</p>
                        <p className="text-[11px] text-slate-500">{formatTime(event.startAt)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderAgendaView = () => (
    <div className="space-y-3">
      {events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">No events in range.</CardContent>
        </Card>
      ) : (
        events
          .slice()
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .map((event) => {
            const style = buildEventTone(event);
            const Icon = style.icon;
            return (
              <Card key={event._id} className="border-slate-200/80">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                      <p className="text-xs text-slate-500">{formatDate(event.startAt)} · {formatTime(event.startAt)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedEvent(event)}>
                    View
                  </Button>
                </CardContent>
              </Card>
            );
          })
      )}
    </div>
  );

  const renderTimelineView = () => (
    <div className="space-y-4">
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd');
        const dayEvents = eventsByDay.get(key) || [];
        return (
          <Card key={key} className="border-slate-200/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">{format(day, 'EEEE, MMM dd')}</CardTitle>
            </CardHeader>
            <CardContent>
              {dayEvents.length === 0 ? (
                <p className="text-xs text-slate-400">No scheduled activity</p>
              ) : (
                <div className="space-y-2">
                  {dayEvents.map((event) => {
                    const style = buildEventTone(event);
                    const Icon = style.icon;
                    return (
                      <button
                        key={event._id}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium ring-1 ${style.tone} ${style.ring}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1 truncate">{event.title}</span>
                        <span className="text-[11px] text-slate-500">{formatTime(event.startAt)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderDayView = () => (
    <div className="space-y-3">
      {(eventsByDay.get(format(currentDate, 'yyyy-MM-dd')) || []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-slate-500">No events scheduled.</CardContent>
        </Card>
      ) : (
        (eventsByDay.get(format(currentDate, 'yyyy-MM-dd')) || []).map((event) => {
          const style = buildEventTone(event);
          const Icon = style.icon;
          return (
            <Card key={event._id} className="border-slate-200/80">
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${style.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                    <p className="text-xs text-slate-500">{formatTime(event.startAt)}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedEvent(event)}>
                  View
                </Button>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );

  const viewContent = () => {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-500">Loading schedule...</CardContent>
        </Card>
      );
    }

    switch (view) {
      case 'month':
        return renderMonthView();
      case 'week':
        return renderWeekView();
      case 'day':
        return renderDayView();
      case 'agenda':
        return renderAgendaView();
      case 'timeline':
        return renderTimelineView();
      default:
        return renderMonthView();
    }
  };

  return (
    <div className="font-calendar space-y-6">
      <div className="calendar-glow rounded-3xl border bg-white/70 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Time Intelligence Center</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Calendar Command</h1>
            <p className="text-sm text-slate-500">Track deadlines, reviews, and team momentum in one view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => handleNavigate('today')} className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              Today
            </Button>
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Sparkles className="h-4 w-4" />
                New Event
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px,1fr]">
        <div className="space-y-4">
          <Card className="border-slate-200/80">
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Today at a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Overdue</span>
                <span className="font-semibold text-rose-600">{insights.overdue}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Pending reviews</span>
                <span className="font-semibold text-amber-600">{insights.reviews}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Events today</span>
                <span className="font-semibold text-emerald-600">{insights.todayCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Milestones</span>
                <span className="font-semibold text-sky-600">{insights.milestoneCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-slate-500">Workload pulse</CardTitle>
              <CircleDot className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              {teamLoad.length === 0 ? (
                <p className="text-xs text-slate-400">No team load data yet.</p>
              ) : (
                teamLoad.map((entry) => (
                  <div key={entry.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{entry.name}</span>
                      <span>{entry.count} items</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-emerald-400"
                        style={{ width: `${Math.min(entry.count * 15, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm text-slate-500">Filters</CardTitle>
              <Filter className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={filters.projectId} onValueChange={(value) => setFilters((prev) => ({ ...prev, projectId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project._id} value={project._id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.teamId} onValueChange={(value) => setFilters((prev) => ({ ...prev, teamId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && (
                <Select value={filters.assigneeId} onValueChange={(value) => setFilters((prev) => ({ ...prev, assigneeId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All people</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id || user._id} value={user.id || user._id || ''}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filters.type} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="task_deadline">Task deadlines</SelectItem>
                  <SelectItem value="project_deadline">Project milestones</SelectItem>
                  <SelectItem value="review_pending">Reviews</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="follow_up">Follow-ups</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.priority} onValueChange={(value) => setFilters((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="todo">To do</SelectItem>
                  <SelectItem value="in-progress">In progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
                <span>Show overdue only</span>
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(event) => setFilters((prev) => ({ ...prev, overdue: event.target.checked }))}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200/80">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => handleNavigate('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-sm text-slate-500">{getRangeLabel(view, currentDate)}</p>
                  <p className="text-xs text-slate-400">Plan, review, deliver</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => handleNavigate('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)}>
                <TabsList>
                  {viewOptions.map((option) => (
                    <TabsTrigger key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>

          <div className="animate-in fade-in-0 duration-300">{viewContent()}</div>
        </div>
      </div>

      <Sheet
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null);
            setEditMode(false);
          }
        }}
      >
        <SheetContent className="sm:max-w-md">
          {selectedEvent && (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <SheetTitle>{selectedEvent.title}</SheetTitle>
                <SheetDescription>{buildEventTone(selectedEvent).label}</SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 px-4">
                <div className="space-y-4 pb-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={buildEventTone(selectedEvent).tone}>{buildEventTone(selectedEvent).label}</Badge>
                    {selectedEvent.priority && (
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {selectedEvent.priority} priority
                      </Badge>
                    )}
                    {selectedEvent.status && (
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {selectedEvent.status}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-slate-600">
                    <p>{formatDate(selectedEvent.startAt)} · {formatTime(selectedEvent.startAt)}</p>
                    {selectedEvent.endAt && <p>Ends {formatDate(selectedEvent.endAt)} · {formatTime(selectedEvent.endAt)}</p>}
                  </div>

                  {selectedEvent.project && (
                    <div>
                      <p className="text-xs text-slate-400">Project</p>
                      <Link to={`/projects/${selectedEvent.project._id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {selectedEvent.project.name}
                      </Link>
                    </div>
                  )}

                  {selectedEvent.task && (
                    <div>
                      <p className="text-xs text-slate-400">Task</p>
                      <Link to={`/tasks/${selectedEvent.task._id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {selectedEvent.task.title}
                      </Link>
                    </div>
                  )}

                  {selectedEvent.assignee && (
                    <div>
                      <p className="text-xs text-slate-400">Assignee</p>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedEvent.assignee.name}
                      </p>
                    </div>
                  )}

                  {selectedEvent.assignedTeam && (
                    <div>
                      <p className="text-xs text-slate-400">Team</p>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedEvent.assignedTeam.name}
                      </p>
                    </div>
                  )}

                  {selectedEvent.reviewStatus && (
                    <div>
                      <p className="text-xs text-slate-400">Review status</p>
                      <Badge variant="outline" className="text-xs text-slate-500">
                        {selectedEvent.reviewStatus}
                      </Badge>
                    </div>
                  )}

                  {selectedEvent.progressPercent !== undefined && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Progress</span>
                        <span>{selectedEvent.progressPercent}%</span>
                      </div>
                      <AnimatedProgress value={selectedEvent.progressPercent} showMeta={false} size="sm" />
                    </div>
                  )}

                  {selectedEvent.description && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      {selectedEvent.description}
                    </p>
                  )}

                  {selectedEvent.source === 'custom' && editMode && (
                    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <Input
                        value={editForm.title}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Title"
                      />
                      <Input
                        value={editForm.startAt}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, startAt: event.target.value }))}
                        type="datetime-local"
                      />
                      <Input
                        value={editForm.endAt}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, endAt: event.target.value }))}
                        type="datetime-local"
                      />
                      <Input
                        value={editForm.description}
                        onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Description"
                      />
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>All day</span>
                        <input
                          type="checkbox"
                          checked={editForm.allDay}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, allDay: event.target.checked }))}
                        />
                      </div>
                      <Button size="sm" onClick={handleEditEvent}>Save changes</Button>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-4">
                <div className="flex flex-wrap gap-2">
                  {selectedEvent.task && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateTask(selectedEvent.task!._id, { status: 'done' })
                        .then(async () => {
                          toast.success('Task marked done');
                          const response = await getCalendarEvents(buildQueryParams());
                          if (response.success) setEvents(response.events || []);
                        })
                        .catch(() => toast.error('Unable to update task'))}
                    >
                      Mark complete
                    </Button>
                  )}
                  {selectedEvent.source === 'custom' && isAdmin && (
                    <Button size="sm" variant="outline" onClick={handleStartEdit} className="gap-1">
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                  {selectedEvent.source === 'custom' && isAdmin && (
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteEvent(selectedEvent._id)} className="gap-1">
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReschedule(selectedEvent, new Date())}
                    >
                      Move to today
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create calendar event</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Event title"
              value={createForm.title}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Select value={createForm.type} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="datetime-local"
                value={createForm.startAt}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, startAt: event.target.value }))}
              />
              <Input
                type="datetime-local"
                value={createForm.endAt}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, endAt: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500">
              <span>All day</span>
              <input
                type="checkbox"
                checked={createForm.allDay}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, allDay: event.target.checked }))}
              />
            </div>
            <Select value={createForm.projectId} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, projectId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project._id} value={project._id}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={createForm.teamId} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, teamId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team._id} value={team._id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Select value={createForm.assigneeId} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, assigneeId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Participant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No participant</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id || user._id} value={user.id || user._id || ''}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={createForm.priority} onValueChange={(value) => setCreateForm((prev) => ({ ...prev, priority: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleCreateEvent}>Create event</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
