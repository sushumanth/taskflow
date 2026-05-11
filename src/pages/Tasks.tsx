import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjects,
  getAllUsers,
  getTeams,
} from '../services/api';
import type { Task, Project, User, TaskStatus, Team, TeamAssignment } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  ListTodo,
  Calendar,
  User as UserIcon,
  Users,
  ArrowRight,
  Search,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isToday } from 'date-fns';

export default function Tasks() {
  const { isAdmin, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectFilter = searchParams.get('projectId') || '';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedTo: '',
    assignedTeamId: '',
    dueDate: '',
    teamAssignment: {
      dueDate: '',
      priority: 'medium',
      workload: '',
      status: 'planned',
    },
  });

  const [assignMode, setAssignMode] = useState<'user' | 'team'>('user');

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    if (isAdmin) {
      fetchUsers();
      fetchTeams();
    }
  }, [projectFilter, isAdmin]);

  const fetchTasks = async () => {
    try {
      const params: { projectId?: string; status?: string } = {};
      if (projectFilter) params.projectId = projectFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await getTasks(params);
      if (response.success) {
        setTasks(response.tasks || []);
      }
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      if (response.success) {
        setProjects(response.projects || []);
        if (!formData.projectId && response.projects && response.projects.length > 0) {
          setFormData((prev) => ({ ...prev, projectId: response.projects![0]._id }));
        }
      }
    } catch (error) {
      console.error('Failed to load projects');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      if (response.success) {
        setUsers(response.users || []);
      }
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await getTeams();
      if (response.success) {
        setTeams(response.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams');
    }
  };

  const buildTeamAssignment = (): TeamAssignment | undefined => {
    if (assignMode !== 'team') return undefined;

    const { teamAssignment } = formData;
    const workloadNumber = Number(teamAssignment.workload);
    return {
      dueDate: teamAssignment.dueDate || undefined,
      priority: (teamAssignment.priority as TeamAssignment['priority']) || undefined,
      workload: Number.isFinite(workloadNumber) && workloadNumber > 0 ? workloadNumber : undefined,
      status: (teamAssignment.status as TeamAssignment['status']) || undefined,
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (assignMode === 'user' && !formData.assignedTo) {
      toast.error('Please select an assignee');
      return;
    }
    if (assignMode === 'team' && !formData.assignedTeamId) {
      toast.error('Please select a team');
      return;
    }
    try {
      const response = await createTask({
        title: formData.title,
        description: formData.description,
        projectId: formData.projectId,
        assignedTo: assignMode === 'user' ? formData.assignedTo : undefined,
        assignedTeamId: assignMode === 'team' ? formData.assignedTeamId : undefined,
        dueDate: formData.dueDate,
        teamAssignment: buildTeamAssignment(),
      });
      if (response.success) {
        toast.success('Task created successfully');
        setIsCreateOpen(false);
        setFormData({
          title: '',
          description: '',
          projectId: projects[0]?._id || '',
          assignedTo: '',
          assignedTeamId: '',
          dueDate: '',
          teamAssignment: {
            dueDate: '',
            priority: 'medium',
            workload: '',
            status: 'planned',
          },
        });
        setAssignMode('user');
        fetchTasks();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create task');
    }
  };

  const handleUpdateStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const response = await updateTask(taskId, { status });
      if (response.success) {
        toast.success(`Task marked as ${status}`);
        fetchTasks();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update task');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    if (assignMode === 'user' && !formData.assignedTo) {
      toast.error('Please select an assignee');
      return;
    }
    if (assignMode === 'team' && !formData.assignedTeamId) {
      toast.error('Please select a team');
      return;
    }
    try {
      const response = await updateTask(editingTask._id, {
        title: formData.title,
        description: formData.description,
        assignedTo: assignMode === 'user' ? formData.assignedTo : undefined,
        assignedTeamId: assignMode === 'team' ? formData.assignedTeamId : undefined,
        teamAssignment: buildTeamAssignment(),
        dueDate: formData.dueDate,
      });
      if (response.success) {
        toast.success('Task updated');
        setIsEditOpen(false);
        setEditingTask(null);
        fetchTasks();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update task');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTask(deleteId);
      toast.success('Task deleted');
      setDeleteId(null);
      fetchTasks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete task');
    }
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    const isTeamAssigned = Boolean(task.assignedTeamId?._id);
    setAssignMode(isTeamAssigned ? 'team' : 'user');
    setFormData({
      title: task.title,
      description: task.description || '',
      projectId: task.projectId._id,
      assignedTo: task.assignedTo?.id || (task.assignedTo as any)?._id || '',
      assignedTeamId: task.assignedTeamId?._id || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      teamAssignment: {
        dueDate: task.teamAssignment?.dueDate
          ? new Date(task.teamAssignment.dueDate).toISOString().split('T')[0]
          : '',
        priority: task.teamAssignment?.priority || 'medium',
        workload: task.teamAssignment?.workload?.toString() || '',
        status: task.teamAssignment?.status || 'planned',
      },
    });
    setIsEditOpen(true);
  };

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: TaskStatus) => {
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

  const getDueDateColor = (dueDate: string, status: TaskStatus) => {
    if (status === 'done') return 'text-gray-500';
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return 'text-red-600 font-medium';
    if (isToday(date)) return 'text-orange-600 font-medium';
    return 'text-gray-500';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your tasks</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {projectFilter
              ? `Tasks for ${projects.find((p) => p._id === projectFilter)?.name || 'project'}`
              : 'Manage and track your tasks'}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
                <DialogDescription>Assign a new task to a team member</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter task description"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project">Project</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project._id} value={project._id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignMode">Assign To</Label>
                  <Select value={assignMode} onValueChange={(value) => setAssignMode(value as 'user' | 'team')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Individual</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {assignMode === 'user' && (
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assignee</Label>
                    <Select
                      value={formData.assignedTo}
                      onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id || user._id} value={user.id || user._id || ''}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {assignMode === 'team' && (
                  <div className="space-y-2">
                    <Label htmlFor="assignedTeam">Team</Label>
                    <Select
                      value={formData.assignedTeamId}
                      onValueChange={(value) => setFormData({ ...formData, assignedTeamId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team._id} value={team._id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {assignMode === 'team' && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="teamDueDate">Team Due Date</Label>
                      <Input
                        id="teamDueDate"
                        type="date"
                        value={formData.teamAssignment.dueDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            teamAssignment: { ...formData.teamAssignment, dueDate: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamPriority">Team Priority</Label>
                      <Select
                        value={formData.teamAssignment.priority}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            teamAssignment: { ...formData.teamAssignment, priority: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamWorkload">Workload (hrs)</Label>
                      <Input
                        id="teamWorkload"
                        type="number"
                        min={0}
                        value={formData.teamAssignment.workload}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            teamAssignment: { ...formData.teamAssignment, workload: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamStatus">Team Status</Label>
                      <Select
                        value={formData.teamAssignment.status}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            teamAssignment: { ...formData.teamAssignment, status: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Create Task</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | 'all')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={projectFilter || '__all__'}
          onValueChange={(v) => {
            if (v === '__all__') {
              setSearchParams({});
            } else {
              setSearchParams({ projectId: v });
            }
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project._id} value={project._id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="all" onClick={() => setStatusFilter('all')}>All</TabsTrigger>
          <TabsTrigger value="todo" onClick={() => setStatusFilter('todo')}>To Do</TabsTrigger>
          <TabsTrigger value="in-progress" onClick={() => setStatusFilter('in-progress')}>In Progress</TabsTrigger>
          <TabsTrigger value="review" onClick={() => setStatusFilter('review')}>Review</TabsTrigger>
          <TabsTrigger value="done" onClick={() => setStatusFilter('done')}>Done</TabsTrigger>
          <TabsTrigger value="rejected" onClick={() => setStatusFilter('rejected')}>Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="m-0">
          <TaskList
            tasks={filteredTasks}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
        <TabsContent value="todo" className="m-0">
          <TaskList
            tasks={filteredTasks.filter((t) => t.status === 'todo')}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
        <TabsContent value="in-progress" className="m-0">
          <TaskList
            tasks={filteredTasks.filter((t) => t.status === 'in-progress')}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
        <TabsContent value="done" className="m-0">
          <TaskList
            tasks={filteredTasks.filter((t) => t.status === 'done')}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
        <TabsContent value="review" className="m-0">
          <TaskList
            tasks={filteredTasks.filter((t) => t.status === 'review')}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
        <TabsContent value="rejected" className="m-0">
          <TaskList
            tasks={filteredTasks.filter((t) => t.status === 'rejected')}
            isAdmin={isAdmin}
            currentUserId={user?._id || user?.id || ''}
            getStatusBadge={getStatusBadge}
            getDueDateColor={getDueDateColor}
            onUpdateStatus={handleUpdateStatus}
            onEdit={openEdit}
            onDelete={setDeleteId}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>Update task details</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignee">Assign To</Label>
              <Select value={assignMode} onValueChange={(value) => setAssignMode(value as 'user' | 'team')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Individual</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignMode === 'user' && (
              <div className="space-y-2">
                <Label htmlFor="edit-user">Assignee</Label>
                <Select
                  value={formData.assignedTo}
                  onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id || user._id} value={user.id || user._id || ''}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {assignMode === 'team' && (
              <div className="space-y-2">
                <Label htmlFor="edit-team">Team</Label>
                <Select
                  value={formData.assignedTeamId}
                  onValueChange={(value) => setFormData({ ...formData, assignedTeamId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {assignMode === 'team' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-team-due">Team Due Date</Label>
                  <Input
                    id="edit-team-due"
                    type="date"
                    value={formData.teamAssignment.dueDate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        teamAssignment: { ...formData.teamAssignment, dueDate: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team-priority">Team Priority</Label>
                  <Select
                    value={formData.teamAssignment.priority}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        teamAssignment: { ...formData.teamAssignment, priority: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team-workload">Workload (hrs)</Label>
                  <Input
                    id="edit-team-workload"
                    type="number"
                    min={0}
                    value={formData.teamAssignment.workload}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        teamAssignment: { ...formData.teamAssignment, workload: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team-status">Team Status</Label>
                  <Select
                    value={formData.teamAssignment.status}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        teamAssignment: { ...formData.teamAssignment, status: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-due">Due Date</Label>
              <Input
                id="edit-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit">Update Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskList({
  tasks,
  isAdmin,
  currentUserId,
  getStatusBadge,
  getDueDateColor,
  onUpdateStatus,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  isAdmin: boolean;
  currentUserId: string;
  getStatusBadge: (status: TaskStatus) => React.ReactNode;
  getDueDateColor: (dueDate: string, status: TaskStatus) => string;
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
        <ListTodo className="h-12 w-12 text-gray-400" />
        <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No tasks found</p>
        <p className="text-sm text-gray-500">Tasks will appear here once created</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        (() => {
          const isAssignee =
            task.assignedTo?._id === currentUserId || task.assignedTo?.id === currentUserId;
          const isTeamMember = task.assignedTeamId
            ? task.assignedTeamId.leadUserId?._id === currentUserId ||
              task.assignedTeamId.leadUserId?.id === currentUserId ||
              task.assignedTeamId.memberUserIds?.some(
                (member) => member._id === currentUserId || member.id === currentUserId
              )
            : false;
          return (
        <Card key={task._id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {task.title}
                  </h3>
                  {getStatusBadge(task.status)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                  {task.description || 'No description'}
                </p>
                <div className="mb-2 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{task.progressPercent ?? 0}%</span>
                  </div>
                  <Progress value={task.progressPercent ?? 0} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3.5 w-3.5" />
                    {task.assignedTo?.name
                      ? task.assignedTo.name
                      : task.assignedTeamId
                      ? `Team ${task.assignedTeamId.name}`
                      : 'Unassigned'}
                  </span>
                  {task.assignedTeamId && task.assignedTo?.name && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {task.assignedTeamId.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {task.projectId?.name || 'No project'}
                  </span>
                  <span className={`flex items-center gap-1 ${getDueDateColor(task.dueDate, task.status)}`}>
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/tasks/${task._id}`}>Details</Link>
                </Button>
                {(isAssignee || isTeamMember || isAdmin) && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/tasks/${task._id}?update=1`}>Add Update</Link>
                  </Button>
                )}
                {isAdmin && task.status !== 'done' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => onUpdateStatus(task._id, 'done')}
                  >
                    Complete
                  </Button>
                )}
                {isAdmin && task.status === 'todo' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => onUpdateStatus(task._id, 'in-progress')}
                  >
                    Start
                  </Button>
                )}
                {isAdmin && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(task)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => onDelete(task._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
          );
        })()
      ))}
    </div>
  );
}
