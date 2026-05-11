import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { getProjects, createProject, deleteProject, getAllUsers, addMember, removeMember, getTeams, updateProject, createProjectUpdate } from '../services/api';
import type { Project, User, Team, TeamAssignment } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Users,
  Trash2,
  FolderKanban,
  ArrowRight,
  X,
  UserPlus,
  Search,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Projects() {
  const { isAdmin, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [updateProjectTarget, setUpdateProjectTarget] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    members: [] as string[],
  });

  const [assignmentForm, setAssignmentForm] = useState({
    teamId: '',
    dueDate: '',
    priority: 'medium',
    workload: '',
    status: 'planned',
  });

  const [updateForm, setUpdateForm] = useState({
    progressPercent: 0,
    status: 'on-track',
    note: '',
    blockers: '',
  });

  useEffect(() => {
    fetchProjects();
    if (isAdmin) {
      fetchUsers();
      fetchTeams();
    }
  }, [isAdmin]);

  const fetchProjects = async () => {
    try {
      const response = await getProjects();
      if (response.success) {
        setProjects(response.projects || []);
      }
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await createProject(formData);
      if (response.success) {
        toast.success('Project created successfully');
        setIsCreateOpen(false);
        setFormData({ name: '', description: '', members: [] });
        fetchProjects();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create project');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteProject(deleteId);
      toast.success('Project deleted');
      setDeleteId(null);
      fetchProjects();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleAddMember = async (projectId: string, userId: string) => {
    try {
      const response = await addMember(projectId, userId);
      if (response.success) {
        toast.success('Member added');
        setSelectedProject(response.project || null);
        fetchProjects();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (projectId: string, userId: string) => {
    try {
      const response = await removeMember(projectId, userId);
      if (response.success) {
        toast.success('Member removed');
        setSelectedProject(response.project || null);
        fetchProjects();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleAssignTeam = async () => {
    if (!selectedProject || !assignmentForm.teamId) return;
    try {
      const teamAssignment: TeamAssignment = {
        dueDate: assignmentForm.dueDate || undefined,
        priority: assignmentForm.priority as TeamAssignment['priority'],
        workload: assignmentForm.workload ? Number(assignmentForm.workload) : undefined,
        status: assignmentForm.status as TeamAssignment['status'],
      };

      const response = await updateProject(selectedProject._id, {
        assignedTeamId: assignmentForm.teamId,
        teamAssignment,
      });
      if (response.success) {
        toast.success('Team assigned to project');
        setIsAssignOpen(false);
        setAssignmentForm({
          teamId: '',
          dueDate: '',
          priority: 'medium',
          workload: '',
          status: 'planned',
        });
        fetchProjects();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign team');
    }
  };

  const canUpdateProject = (project: Project) => {
    if (isAdmin) return true;
    if (!user) return false;
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
  };

  const openProjectUpdate = (project: Project) => {
    setUpdateProjectTarget(project);
    setUpdateForm({
      progressPercent: project.progressPercent ?? 0,
      status: project.lastUpdateStatus || 'on-track',
      note: '',
      blockers: '',
    });
    setIsUpdateOpen(true);
  };

  const handleSubmitProjectUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateProjectTarget) return;
    try {
      const response = await createProjectUpdate(updateProjectTarget._id, {
        progressPercent: updateForm.progressPercent,
        status: updateForm.status,
        note: updateForm.note,
        blockers: updateForm.blockers || undefined,
      });
      if (response.success) {
        toast.success('Project update submitted');
        setIsUpdateOpen(false);
        setUpdateProjectTarget(null);
        setUpdateForm({ progressPercent: 0, status: 'on-track', note: '', blockers: '' });
        fetchProjects();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit project update');
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableUsers = users.filter(
    (u) => !selectedProject?.members.some((m) => m.id === u.id || m._id === u.id)
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your projects</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your team projects</p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>Create a new project for your team</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter project description"
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit">Create Project</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FolderKanban className="h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No projects found
          </p>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Create your first project to get started' : 'You are not assigned to any projects yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project._id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-lg">{project.name}</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Created by {project.createdBy?.name || 'Unknown'}
                    </p>
                    {project.assignedTeamId && (
                      <p className="text-xs text-gray-500">
                        Team: {project.assignedTeamId.name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    {canUpdateProject(project) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-emerald-600"
                        onClick={() => openProjectUpdate(project)}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-emerald-600"
                          onClick={() => {
                            setSelectedProject(project);
                            setAssignmentForm({
                              teamId: project.assignedTeamId?._id || '',
                              dueDate: project.teamAssignment?.dueDate
                                ? new Date(project.teamAssignment.dueDate).toISOString().split('T')[0]
                                : '',
                              priority: project.teamAssignment?.priority || 'medium',
                              workload: project.teamAssignment?.workload?.toString() || '',
                              status: project.teamAssignment?.status || 'planned',
                            });
                            setIsAssignOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={() => {
                            setSelectedProject(project);
                            setIsMembersOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteId(project._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {project.description || 'No description'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{project.progressPercent ?? 0}%</span>
                  </div>
                  <Progress value={project.progressPercent ?? 0} />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{project.completedTasks ?? 0} completed</span>
                    <span>{project.taskCount ?? 0} total</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {project.members?.length || 0} members
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/projects/${project._id}`}
                      className="text-sm font-medium text-gray-700 hover:underline"
                    >
                      Details
                    </Link>
                    <Link
                      to={`/tasks?projectId=${project._id}`}
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                    >
                      View Tasks <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Members Dialog */}
      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Members</DialogTitle>
            <DialogDescription>{selectedProject?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Members */}
            <div>
              <h4 className="mb-2 text-sm font-medium">Current Members</h4>
              <div className="space-y-2">
                {selectedProject?.members.map((member) => (
                  <div
                    key={member.id || member._id}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium dark:bg-gray-700">
                        {member.name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() =>
                        handleRemoveMember(
                          selectedProject._id,
                          member.id || (member as any)._id
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add Members */}
            {isAdmin && availableUsers.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium">Add Members</h4>
                <div className="space-y-2">
                  {availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium dark:bg-gray-700">
                          {user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600"
                        onClick={() =>
                          handleAddMember(selectedProject!._id, user.id || user._id || '')
                        }
                      >
                        <UserPlus className="mr-1 h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Team Dialog */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Team</DialogTitle>
            <DialogDescription>{selectedProject?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <Select
                value={assignmentForm.teamId}
                onValueChange={(value) => setAssignmentForm({ ...assignmentForm, teamId: value })}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-due">Team Due Date</Label>
                <Input
                  id="assign-due"
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-priority">Priority</Label>
                <Select
                  value={assignmentForm.priority}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, priority: value })}
                >
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-workload">Workload (hrs)</Label>
                <Input
                  id="assign-workload"
                  type="number"
                  min={0}
                  value={assignmentForm.workload}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, workload: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-status">Status</Label>
                <Select
                  value={assignmentForm.status}
                  onValueChange={(value) => setAssignmentForm({ ...assignmentForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
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
            <DialogFooter>
              <Button onClick={handleAssignTeam} disabled={!assignmentForm.teamId}>
                Assign Team
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Update Dialog */}
      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Project Update</DialogTitle>
            <DialogDescription>{updateProjectTarget?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitProjectUpdate} className="space-y-4">
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
              <Button type="submit">Submit Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All tasks associated with this project will also be affected.
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
