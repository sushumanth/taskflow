import { useEffect, useState } from 'react';
import { getDashboardStats } from '../services/api';
import type { DashboardStats, Task } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  FolderKanban,
  ClipboardCheck,
  TrendingUp,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router';
import { format } from 'date-fns';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await getDashboardStats();
        if (response.success) {
          setStats(response.stats || null);
          setRecentTasks(response.recentTasks || []);
          setUpcomingTasks(response.upcomingTasks || []);
        }
      } catch (err) {
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Tasks',
      value: stats?.totalTasks || 0,
      icon: ListTodo,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Completed',
      value: stats?.completedTasks || 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Pending',
      value: stats?.pendingTasks || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    },
    {
      title: 'Overdue',
      value: stats?.overdueTasks || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      title: 'Pending Reviews',
      value: stats?.pendingReviews || 0,
      icon: ClipboardCheck,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      title: 'Needs Attention',
      value: stats?.tasksNeedingAttention || 0,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50 dark:bg-rose-900/20',
    },
    {
      title: 'In Progress',
      value: stats?.inProgressTasks || 0,
      icon: LayoutDashboard,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Projects',
      value: stats?.totalProjects || 0,
      icon: FolderKanban,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
    {
      title: 'Overall Progress',
      value: `${stats?.overallProgress || 0}%`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
  ];

  if (isAdmin) {
    statCards.push(
      {
        title: 'Total Teams',
        value: stats?.totalTeams || 0,
        icon: LayoutDashboard,
        color: 'text-sky-600',
        bg: 'bg-sky-50 dark:bg-sky-900/20',
      },
      {
        title: 'Active Teams',
        value: stats?.activeTeams || 0,
        icon: CheckCircle2,
        color: 'text-teal-600',
        bg: 'bg-teal-50 dark:bg-teal-900/20',
      },
      {
        title: 'Team Tasks',
        value: stats?.teamAssignedTasks || 0,
        icon: ListTodo,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      },
      {
        title: 'Team Completion',
        value: `${stats?.teamCompletionRate || 0}%`,
        icon: TrendingUp,
        color: 'text-lime-600',
        bg: 'bg-lime-50 dark:bg-lime-900/20',
      },
      {
        title: 'Teams Needing Attention',
        value: stats?.teamsNeedingAttention || 0,
        icon: AlertTriangle,
        color: 'text-rose-600',
        bg: 'bg-rose-50 dark:bg-rose-900/20',
      }
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Done</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
      case 'review':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">In Review</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">To Do</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Loading your overview...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Overview of your tasks and projects</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {stat.title}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tasks Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Latest created tasks</p>
            </div>
            <Link
              to="/tasks"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No tasks yet</p>
            ) : (
              <div className="space-y-3">
                {recentTasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {task.projectId?.name || 'No project'}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0">{getStatusBadge(task.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Upcoming Deadlines</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tasks due soon</p>
            </div>
            <Link
              to="/tasks"
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900 dark:text-white">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <div className="ml-4 shrink-0">{getStatusBadge(task.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
