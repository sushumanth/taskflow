import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  getProjectById,
  getProjectUpdates,
  createProjectUpdate,
  addProjectUpdateComment,
  getProjectActivity,
  getTasks,
} from '../services/api';
import type { Project, ProjectUpdate, ProjectActivity, Task } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ClipboardCheck,
  Users,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [updateForm, setUpdateForm] = useState({
    progressPercent: 0,
    status: 'on-track',
    note: '',
    blockers: '',
  });

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    void fetchDetails();
  }, [id]);

  const canUpdateProject = useMemo(() => {
    if (!project || !user) return false;
    if (isAdmin) return true;
    if (project.createdBy?._id === user._id || project.createdBy?.id === user._id) return true;

    if (project.members?.some((member) => member._id === user._id || member.id === user._id)) {
      return true;
    }

    const team = project.assignedTeamId;
    if (!team) return false;
    const isLead = team.leadUserId?._id === user._id || team.leadUserId?.id === user._id;
    const isMember = team.memberUserIds?.some(
      (member) => member._id === user._id || member.id === user._id
    );
    return isLead || isMember;
  }, [project, user, isAdmin]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const projectResponse = await getProjectById(id!);
      if (projectResponse.success) {
        setProject(projectResponse.project || null);
      }
    } catch (error) {
      toast.error('Failed to load project details');
    }

    try {
      const [updatesResponse, activityResponse, taskResponse] = await Promise.all([
        getProjectUpdates(id!),
        getProjectActivity(id!),
        getTasks({ projectId: id! }),
      ]);
      if (updatesResponse.success) {
        setUpdates(updatesResponse.projectUpdates || updatesResponse.data?.updates || []);
      }
      if (activityResponse.success) {
        setActivities(activityResponse.projectActivities || activityResponse.data?.activities || []);
      }
      if (taskResponse.success) {
        setTasks(taskResponse.tasks || []);
      }
    } catch (error) {
      toast.error('Failed to load project data');
    } finally {
      setIsLoading(false);
    }
  };

  const openUpdateDialog = () => {
    setUpdateForm({
      progressPercent: project?.progressPercent ?? 0,
      status: project?.lastUpdateStatus || 'on-track',
      note: '',
      blockers: '',
    });
    setIsUpdateOpen(true);
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSubmitting(true);
    try {
      const response = await createProjectUpdate(id, {
        progressPercent: updateForm.progressPercent,
        status: updateForm.status,
        note: updateForm.note,
        blockers: updateForm.blockers || undefined,
      });
      if (response.success) {
        toast.success('Project update submitted');
        setIsUpdateOpen(false);
        await fetchDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit project update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (updateId: string) => {
    const text = commentInputs[updateId]?.trim();
    if (!text || !id) return;

    try {
      const response = await addProjectUpdateComment(id, updateId, text);
      if (response.success) {
        setCommentInputs((prev) => ({ ...prev, [updateId]: '' }));
        await fetchDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  const updateStatusBadge = (status: string) => {
    if (status === 'on-track') {
      return <Badge className="bg-green-100 text-green-700">On Track</Badge>;
    }
    if (status === 'at-risk') {
      return <Badge className="bg-amber-100 text-amber-700">At Risk</Badge>;
    }
    return <Badge className="bg-rose-100 text-rose-700">Delayed</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/projects')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Project not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/projects')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{project.name}</h1>
            <p className="text-sm text-gray-500">
              Created by {project.createdBy?.name || 'Unknown'}
            </p>
          </div>
        </div>
        {canUpdateProject && (
          <Button onClick={openUpdateDialog} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Add Project Update
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {project.lastUpdateStatus ? updateStatusBadge(project.lastUpdateStatus) : null}
              {project.assignedTeamId && (
                <Badge className="bg-blue-50 text-blue-700">Team: {project.assignedTeamId.name}</Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {project.description || 'No description provided.'}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Overall Progress</span>
                <span>{project.progressPercent ?? 0}%</span>
              </div>
              <Progress value={project.progressPercent ?? 0} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {project.members?.length || 0} members
              </span>
              <span className="flex items-center gap-1">
                <ClipboardCheck className="h-4 w-4" />
                {tasks.length} tasks
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Latest Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {updates[0] ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-gray-900">{updates[0].progressPercent}%</span>
                </div>
                <p className="text-sm text-gray-600">{updates[0].note}</p>
                <p className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(updates[0].createdAt), { addSuffix: true })}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No updates yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="m-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-500">No tasks assigned to this project.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        Due {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                    <Link
                      to={`/tasks/${task._id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="m-0">
          <Card>
            <CardContent className="p-4">
              {updates.length === 0 ? (
                <p className="text-sm text-gray-500">No project updates yet.</p>
              ) : (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update._id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {update.submittedBy?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(update.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {updateStatusBadge(update.status)}
                      </div>
                      <p className="text-sm text-gray-600">{update.note}</p>
                      {update.blockers && (
                        <p className="text-xs text-rose-600">Blockers: {update.blockers}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Calendar className="h-3.5 w-3.5" />
                        {update.progressPercent}% complete
                      </div>
                      <div className="space-y-2">
                        {update.comments.map((comment, index) => (
                          <div key={index} className="flex items-start gap-2 text-xs text-gray-600">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>
                              <span className="font-medium">{comment.user?.name || 'User'}:</span>{' '}
                              {comment.text}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={commentInputs[update._id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [update._id]: e.target.value }))
                          }
                          placeholder="Add a comment"
                        />
                        <Button size="sm" onClick={() => handleAddComment(update._id)}>
                          Comment
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="m-0">
          <Card>
            <CardContent className="p-4">
              {activities.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activity.</p>
              ) : (
                <ScrollArea className="h-[360px] pr-2">
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity._id} className="rounded-lg border p-3">
                        <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                        <p className="text-xs text-gray-500">
                          {activity.actor?.name || 'System'} ·{' '}
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Project Update</DialogTitle>
            <DialogDescription>{project.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-progress">Progress (%)</Label>
              <Input
                id="project-progress"
                type="number"
                min={0}
                max={100}
                value={updateForm.progressPercent}
                onChange={(e) =>
                  setUpdateForm({ ...updateForm, progressPercent: Number(e.target.value) })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-status">Status</Label>
              <Select
                value={updateForm.status}
                onValueChange={(value) => setUpdateForm({ ...updateForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-note">Update Note</Label>
              <Textarea
                id="project-note"
                value={updateForm.note}
                onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })}
                placeholder="Share key progress and highlights"
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-blockers">Blockers</Label>
              <Textarea
                id="project-blockers"
                value={updateForm.blockers}
                onChange={(e) => setUpdateForm({ ...updateForm, blockers: e.target.value })}
                placeholder="Anything blocking progress?"
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
