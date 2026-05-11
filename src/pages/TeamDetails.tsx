import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  getTeamById,
  getTeamActivity,
  getTeamPerformance,
  createTeamUpdate,
  addTeamUpdateComment,
} from '../services/api';
import type { Team, Task, Project, TeamActivity, TeamUpdate, TeamPerformanceSummary } from '../types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';
import {
  ArrowLeft,
  Users,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export default function TeamDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [updates, setUpdates] = useState<TeamUpdate[]>([]);
  const [performance, setPerformance] = useState<TeamPerformanceSummary | null>(null);
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

  const isLead = useMemo(() => {
    if (!team || !user) return false;
    return team.leadUserId?._id === user._id || team.leadUserId?.id === user.id;
  }, [team, user]);

  const isMember = useMemo(() => {
    if (!team || !user) return false;
    return team.memberUserIds?.some(
      (member) => member._id === user._id || member.id === user.id
    );
  }, [team, user]);

  useEffect(() => {
    if (!id) return;
    void fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      const response = await getTeamById(id!);
      if (response.success) {
        setTeam(response.team || null);
        setTasks(response.tasks || []);
        setProjects(response.projects || []);
      }
    } catch (error) {
      toast.error('Failed to load team details');
    }

    try {
      const [activityResponse, performanceResponse] = await Promise.all([
        getTeamActivity(id!),
        getTeamPerformance(id!),
      ]);
      if (activityResponse.success) {
        setActivities(activityResponse.activities || []);
        setUpdates(activityResponse.updates || []);
      }
      if (performanceResponse.success) {
        setPerformance(performanceResponse.performance || null);
      }
    } catch (error) {
      toast.error('Failed to load team insights');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewUpdate = () => {
    setUpdateForm({
      progressPercent: team?.progressPercent ?? 0,
      status: 'on-track',
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
      const response = await createTeamUpdate(id, {
        progressPercent: updateForm.progressPercent,
        status: updateForm.status,
        note: updateForm.note,
        blockers: updateForm.blockers || undefined,
      });
      if (response.success) {
        toast.success('Team update submitted');
        setIsUpdateOpen(false);
        await fetchDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async (updateId: string) => {
    const text = commentInputs[updateId]?.trim();
    if (!text || !id) return;

    try {
      const response = await addTeamUpdateComment(id, updateId, text);
      if (response.success) {
        setCommentInputs((prev) => ({ ...prev, [updateId]: '' }));
        await fetchDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'on-track') {
      return <Badge className="bg-green-100 text-green-700">On Track</Badge>;
    }
    if (status === 'at-risk') {
      return <Badge className="bg-amber-100 text-amber-700">At Risk</Badge>;
    }
    return <Badge className="bg-rose-100 text-rose-700">Delayed</Badge>;
  };

  const teamStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-700">Active</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-700">Inactive</Badge>;
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

  if (!team) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/teams')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Teams
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Team not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTasks = performance?.totalTasks ?? tasks.length;
  const completedTasks = performance?.completedTasks ?? tasks.filter((task) => task.status === 'done').length;
  const activeTasks = Math.max(totalTasks - completedTasks, 0);
  const completionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : Math.round(team.progressPercent ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/teams')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{team.name}</h1>
            <p className="text-sm text-gray-500">
              Lead: {team.leadUserId?.name || 'Unassigned'} · {team.type || 'General'}
            </p>
          </div>
        </div>
        {(isAdmin || isLead || isMember) && (
          <Button onClick={openNewUpdate} className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Add Team Update
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              {teamStatusBadge(team.status)}
              <Badge className="bg-blue-50 text-blue-700">
                {(team.memberUserIds?.length || 0) + 1} members
              </Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {team.description || 'No description provided.'}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Overall Progress</span>
                <span>{team.progressPercent ?? 0}%</span>
              </div>
              <Progress value={team.progressPercent ?? 0} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {team.memberUserIds.length + 1} members
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {team.taskCount ?? tasks.length} tasks
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {performance?.reviewTasks || 0} reviews
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Completion Rate</span>
              <span className="font-medium text-gray-900">
                {`${completionRate}%`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Completed Tasks</span>
              <span className="font-medium text-gray-900">
                {completedTasks}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Active Tasks</span>
              <span className="font-medium text-gray-900">
                {activeTasks}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium text-gray-900">{team.leadUserId?.name}</p>
              <p className="text-xs text-gray-500">Team Lead</p>
            </div>
            {team.memberUserIds.length === 0 ? (
              <p className="text-sm text-gray-500">No members added yet.</p>
            ) : (
              team.memberUserIds.map((member) => (
                <div key={member._id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Contributions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {performance?.memberContributions?.length ? (
              performance.memberContributions.map((entry) => {
                const contributor =
                  team.memberUserIds.find((m) => m._id === entry._id) ||
                  (team.leadUserId?._id === entry._id ? team.leadUserId : undefined);
                return (
                  <div key={entry._id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {contributor?.name || 'Team member'}
                      </p>
                      <p className="text-xs text-gray-500">Updates submitted</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{entry.updates}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500">No contribution data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="m-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-500">No tasks assigned to this team.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        Project: {task.projectId?.name || 'No project'} · Due{' '}
                        {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : 'N/A'}
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

        <TabsContent value="projects" className="m-0">
          <Card>
            <CardContent className="p-4 space-y-3">
              {projects.length === 0 ? (
                <p className="text-sm text-gray-500">No projects assigned to this team.</p>
              ) : (
                projects.map((project) => (
                  <div
                    key={project._id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-500">
                        Members: {project.members?.length || 0}
                      </p>
                    </div>
                    <Link
                      to={`/projects`}
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
                <p className="text-sm text-gray-500">No team updates yet.</p>
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
                        {statusBadge(update.status)}
                      </div>
                      <p className="text-sm text-gray-600">{update.note}</p>
                      {update.blockers && (
                        <p className="text-xs text-rose-600">Blockers: {update.blockers}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <ClipboardCheck className="h-3.5 w-3.5" />
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
            <DialogTitle>Team Update</DialogTitle>
            <DialogDescription>Share the latest team progress</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-progress">Progress (%)</Label>
              <Input
                id="team-progress"
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
              <Label htmlFor="team-status">Status</Label>
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
              <Label htmlFor="team-note">Update Note</Label>
              <Textarea
                id="team-note"
                value={updateForm.note}
                onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })}
                placeholder="Share key progress and highlights"
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-blockers">Blockers</Label>
              <Textarea
                id="team-blockers"
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
