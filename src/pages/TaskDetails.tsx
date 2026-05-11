import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  getTaskById,
  getTaskUpdates,
  createTaskUpdate,
  reviewTaskUpdate,
  addTaskUpdateComment,
  updateTaskUpdate,
  deleteTaskUpdate,
  API_BASE_URL,
} from '../services/api';
import type { Task, TaskStatus, TaskUpdate, ReviewStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const statusOptions: { label: string; value: TaskStatus }[] = [
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Completed', value: 'done' },
  { label: 'Rejected', value: 'rejected' },
];

const reviewActionLabels: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approve',
  rejected: 'Reject',
  'changes-requested': 'Request Changes',
};

export default function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<TaskUpdate | null>(null);

  const [updateForm, setUpdateForm] = useState({
    progressPercent: 0,
    status: 'in-progress' as TaskStatus,
    note: '',
    blockers: '',
  });
  const [updateFiles, setUpdateFiles] = useState<File[]>([]);

  const [reviewDialog, setReviewDialog] = useState<{
    open: boolean;
    update?: TaskUpdate;
    action?: ReviewStatus;
  }>({ open: false });
  const [reviewComment, setReviewComment] = useState('');

  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const isTeamMember = useMemo(() => {
    if (!task?.assignedTeamId || !user) return false;
    const leadId = task.assignedTeamId.leadUserId?._id || task.assignedTeamId.leadUserId?.id;
    if (leadId && leadId === user._id) return true;
    return (
      task.assignedTeamId.memberUserIds?.some(
        (member) => member._id === user._id || member.id === user._id
      ) || false
    );
  }, [task, user]);

  const canSubmitUpdate = useMemo(() => {
    if (!task || !user) return false;
    const isAssignee = task.assignedTo?._id === user._id || task.assignedTo?.id === user._id;
    return isAdmin || isAssignee || isTeamMember;
  }, [task, user, isAdmin, isTeamMember]);

  useEffect(() => {
    if (!id) return;
    void fetchTaskDetails();
  }, [id]);

  useEffect(() => {
    if (!task || !canSubmitUpdate) return;
    if (searchParams.get('update') !== '1') return;

    openNewUpdate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('update');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, task, canSubmitUpdate, setSearchParams]);

  const fetchTaskDetails = async () => {
    setIsLoading(true);
    try {
      const taskResponse = await getTaskById(id!);
      if (taskResponse.success) {
        setTask(taskResponse.task || null);
      } else {
        setTask(null);
      }
    } catch (error) {
      setTask(null);
      toast.error('Failed to load task details');
    }

    try {
      const updatesResponse = await getTaskUpdates(id!);
      if (updatesResponse.success) {
        setUpdates(updatesResponse.updates || []);
      }
    } catch (error) {
      toast.error('Failed to load task updates');
    } finally {
      setIsLoading(false);
    }
  };

  const openNewUpdate = () => {
    setEditingUpdate(null);
    const defaultStatus = task?.status === 'rejected' ? 'in-progress' : (task?.status ?? 'in-progress');
    setUpdateForm({
      progressPercent: task?.progressPercent ?? 0,
      status: defaultStatus as TaskStatus,
      note: '',
      blockers: '',
    });
    setUpdateFiles([]);
    setIsUpdateOpen(true);
  };

  const openEditUpdate = (update: TaskUpdate) => {
    setEditingUpdate(update);
    setUpdateForm({
      progressPercent: update.progressPercent,
      status: update.status,
      note: update.note,
      blockers: update.blockers || '',
    });
    setUpdateFiles([]);
    setIsUpdateOpen(true);
  };

  const handleSubmitUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('progressPercent', String(updateForm.progressPercent));
      formData.append('status', updateForm.status);
      formData.append('note', updateForm.note);
      if (updateForm.blockers) {
        formData.append('blockers', updateForm.blockers);
      }
      updateFiles.forEach((file) => formData.append('attachments', file));

      if (editingUpdate) {
        const response = await updateTaskUpdate(editingUpdate._id, formData);
        if (response.success) {
          toast.success('Update edited successfully');
        }
      } else {
        const response = await createTaskUpdate(id, formData);
        if (response.success) {
          toast.success('Update submitted for review');
        }
      }

      setIsUpdateOpen(false);
      setEditingUpdate(null);
      await fetchTaskDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewDialog.update || !reviewDialog.action) return;
    try {
      const response = await reviewTaskUpdate(reviewDialog.update._id, {
        status: reviewDialog.action,
        comment: reviewComment.trim() || undefined,
      });
      if (response.success) {
        toast.success('Review submitted');
        setReviewDialog({ open: false });
        setReviewComment('');
        await fetchTaskDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to review update');
    }
  };

  const handleAddComment = async (updateId: string) => {
    const text = commentInputs[updateId]?.trim();
    if (!text) return;

    try {
      const response = await addTaskUpdateComment(updateId, text);
      if (response.success) {
        setCommentInputs((prev) => ({ ...prev, [updateId]: '' }));
        await fetchTaskDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add comment');
    }
  };

  const handleDeleteUpdate = async (updateId: string) => {
    try {
      const response = await deleteTaskUpdate(updateId);
      if (response.success) {
        toast.success('Update deleted');
        await fetchTaskDetails();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete update');
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return <Badge className="bg-green-100 text-green-700">Done</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>;
      case 'review':
        return <Badge className="bg-amber-100 text-amber-700">In Review</Badge>;
      case 'rejected':
        return <Badge className="bg-rose-100 text-rose-700">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700">To Do</Badge>;
    }
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

  if (!task) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/tasks')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Tasks
        </Button>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-500">Task not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/tasks')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{task.title}</h1>
            <p className="text-sm text-gray-500">
              Project: {task.projectId?.name || 'No project'} · Assigned to {task.assignedTo?.name || 'Unassigned'}
              {task.assignedTeamId?.name ? ` · Team: ${task.assignedTeamId.name}` : ''}
            </p>
          </div>
        </div>
        {canSubmitUpdate && (
          <Button onClick={openNewUpdate} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Add Update
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {getStatusBadge(task.status)}
            <span className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              Due {format(new Date(task.dueDate), 'MMM dd, yyyy')}
            </span>
            {task.lastUpdateAt && (
              <span className="text-sm text-gray-500">
                Updated {formatDistanceToNow(new Date(task.lastUpdateAt), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Progress</span>
              <span>{task.progressPercent ?? 0}%</span>
            </div>
            <Progress value={task.progressPercent ?? 0} />
          </div>
          {task.lastFeedback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <strong className="mr-1">Latest feedback:</strong>
              {task.lastFeedback}
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {task.description || 'No description provided.'}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="updates" className="w-full">
        <TabsList>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="updates" className="space-y-4">
          {updates.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500">
                No updates yet. Encourage the assignee to submit progress.
              </CardContent>
            </Card>
          ) : (
            updates.map((update) => {
              const isOwner = update.submittedBy?._id === user?._id || update.submittedBy?.id === user?._id;
              const canEdit = isOwner && update.review.status !== 'approved';

              return (
                <Card key={update._id}>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(update.status)}
                        <span className="text-sm text-gray-500">
                          {update.progressPercent}% complete
                        </span>
                        <span className="text-sm text-gray-400">
                          {format(new Date(update.createdAt), 'MMM dd, yyyy · HH:mm')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && update.review.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() =>
                                setReviewDialog({ open: true, update, action: 'approved' })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() =>
                                setReviewDialog({ open: true, update, action: 'changes-requested' })
                              }
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Request Changes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-rose-600 border-rose-200"
                              onClick={() =>
                                setReviewDialog({ open: true, update, action: 'rejected' })
                              }
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                        {canEdit && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => openEditUpdate(update)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600"
                              onClick={() => handleDeleteUpdate(update._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Updated by <span className="font-medium text-gray-700">{update.submittedBy?.name}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700 dark:text-gray-300">{update.note}</p>
                    {update.blockers && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        <strong className="mr-1">Blockers:</strong>
                        {update.blockers}
                      </div>
                    )}

                    {update.attachments.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-gray-700">Attachments</div>
                        <div className="flex flex-wrap gap-2">
                          {update.attachments.map((file) => (
                            <a
                              key={file.filename}
                              href={`${API_BASE_URL}${file.url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-600 hover:border-blue-300 hover:text-blue-600"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              {file.originalName}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {update.review.status !== 'pending' && (
                      <div className="rounded-lg border bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gray-200 text-gray-700">
                            {update.review.status.replace('-', ' ')}
                          </Badge>
                          {update.review.reviewedBy && (
                            <span>by {update.review.reviewedBy.name}</span>
                          )}
                        </div>
                        {update.review.comment && (
                          <p className="mt-2 text-gray-600">{update.review.comment}</p>
                        )}
                      </div>
                    )}

                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <MessageSquare className="h-4 w-4" />
                        Feedback & Comments
                      </div>
                      {update.comments.length === 0 ? (
                        <p className="text-xs text-gray-500">No comments yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {update.comments.map((comment, index) => (
                            <div key={index} className="rounded-md border p-2 text-xs text-gray-600">
                              <span className="font-medium text-gray-700">{comment.user?.name}</span>{' '}
                              · {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                              <p className="mt-1 text-sm text-gray-700">{comment.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={commentInputs[update._id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({ ...prev, [update._id]: e.target.value }))
                          }
                          placeholder="Write a comment..."
                        />
                        <Button onClick={() => handleAddComment(update._id)}>
                          Send
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-6">
              <ScrollArea className="h-[360px] pr-4">
                <div className="space-y-4">
                  {updates.length === 0 ? (
                    <p className="text-sm text-gray-500">No timeline yet.</p>
                  ) : (
                    updates.map((update) => (
                      <div key={update._id} className="relative pl-6">
                        <div className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{update.submittedBy?.name}</span>
                            <span>{format(new Date(update.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {getStatusBadge(update.status)}
                            <span className="text-sm text-gray-600">{update.progressPercent}%</span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">{update.note}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUpdate ? 'Edit Update' : 'Submit Update'}</DialogTitle>
            <DialogDescription>
              Share progress, blockers, and files for admin review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={updateForm.progressPercent}
                onChange={(e) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    progressPercent: Number(e.target.value),
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={updateForm.status}
                onValueChange={(value) =>
                  setUpdateForm((prev) => ({ ...prev, status: value as TaskStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Update Note</Label>
              <Textarea
                id="note"
                value={updateForm.note}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Summarize what changed, what is complete, and what needs attention."
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockers">Blockers / Issues</Label>
              <Textarea
                id="blockers"
                value={updateForm.blockers}
                onChange={(e) => setUpdateForm((prev) => ({ ...prev, blockers: e.target.value }))}
                placeholder="Describe blockers if any"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="attachments">Attachments</Label>
              <Input
                id="attachments"
                type="file"
                multiple
                onChange={(e) =>
                  setUpdateFiles(e.target.files ? Array.from(e.target.files) : [])
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : editingUpdate ? 'Save Changes' : 'Submit Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reviewDialog.open}
        onOpenChange={(open) => setReviewDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Update</DialogTitle>
            <DialogDescription>
              {reviewDialog.action
                ? `You are about to ${reviewActionLabels[reviewDialog.action].toLowerCase()} this update.`
                : 'Provide feedback for this update.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="review-comment">Feedback (optional)</Label>
            <Textarea
              id="review-comment"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleReview}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
