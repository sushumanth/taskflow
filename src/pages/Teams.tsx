import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import {
  getTeams,
  createTeam,
  deleteTeam,
  getAllUsers,
  addTeamMember,
  removeTeamMember,
  changeTeamLead,
  createTeamUpdate,
} from '../services/api';
import type { Team, User } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AnimatedProgress from '@/components/AnimatedProgress';
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
import { Users, Plus, Trash2, ArrowRight, UserPlus, Search, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function Teams() {
  const { isAdmin, user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [updateTeamTarget, setUpdateTeamTarget] = useState<Team | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    leadUserId: '',
    memberUserIds: [] as string[],
    status: 'active',
  });

  const [updateForm, setUpdateForm] = useState({
    progressPercent: 0,
    status: 'on-track',
    note: '',
    blockers: '',
  });

  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);
  const [memberSelectId, setMemberSelectId] = useState('');

  useEffect(() => {
    fetchTeams();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, statusFilter]);

  const fetchTeams = async () => {
    try {
      const response = await getTeams(statusFilter === 'all' ? undefined : { status: statusFilter });
      if (response.success) {
        setTeams(response.teams || []);
      }
    } catch (error) {
      toast.error('Failed to load teams');
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await createTeam({
        ...formData,
        memberUserIds: formData.memberUserIds.filter((id) => id !== formData.leadUserId),
      });
      if (response.success) {
        toast.success('Team created successfully');
        setIsCreateOpen(false);
        setFormData({
          name: '',
          description: '',
          type: '',
          leadUserId: '',
          memberUserIds: [],
          status: 'active',
        });
        setMemberSelectId('');
        fetchTeams();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create team');
    }
  };

  const canUpdateTeam = (team: Team) => {
    if (isAdmin) return true;
    if (!user) return false;
    const isLead = team.leadUserId?._id === user._id || team.leadUserId?.id === user._id;
    const isMember = team.memberUserIds?.some(
      (member) => member._id === user._id || member.id === user._id
    );
    return isLead || isMember;
  };

  const openTeamUpdate = (team: Team) => {
    setUpdateTeamTarget(team);
    setUpdateForm({
      progressPercent: team.progressPercent ?? 0,
      status: 'on-track',
      note: '',
      blockers: '',
    });
    setIsUpdateOpen(true);
  };

  const handleSubmitTeamUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTeamTarget) return;
    setIsSubmittingUpdate(true);
    try {
      const response = await createTeamUpdate(updateTeamTarget._id, {
        progressPercent: updateForm.progressPercent,
        status: updateForm.status,
        note: updateForm.note,
        blockers: updateForm.blockers || undefined,
      });
      if (response.success) {
        toast.success('Team update submitted');
        setIsUpdateOpen(false);
        setUpdateTeamTarget(null);
        setUpdateForm({ progressPercent: 0, status: 'on-track', note: '', blockers: '' });
        fetchTeams();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit team update');
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const availableMembersForCreate = users.filter(
    (user) =>
      user.id !== formData.leadUserId &&
      user._id !== formData.leadUserId &&
      !formData.memberUserIds.includes(user.id || user._id || '')
  );

  const handleAddMemberToCreate = () => {
    if (!memberSelectId) return;
    if (memberSelectId === formData.leadUserId) return;
    if (formData.memberUserIds.includes(memberSelectId)) return;
    setFormData((prev) => ({
      ...prev,
      memberUserIds: [...prev.memberUserIds, memberSelectId],
    }));
    setMemberSelectId('');
  };

  const handleRemoveMemberFromCreate = (userId: string) => {
    setFormData((prev) => ({
      ...prev,
      memberUserIds: prev.memberUserIds.filter((id) => id !== userId),
    }));
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTeam(deleteId);
      toast.success('Team deleted');
      setDeleteId(null);
      fetchTeams();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete team');
    }
  };

  const handleAddMember = async (teamId: string, userId: string) => {
    try {
      const response = await addTeamMember(teamId, userId);
      if (response.success) {
        toast.success('Member added');
        setSelectedTeam(response.team || null);
        fetchTeams();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    try {
      const response = await removeTeamMember(teamId, userId);
      if (response.success) {
        toast.success('Member removed');
        setSelectedTeam(response.team || null);
        fetchTeams();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleChangeLead = async (teamId: string, leadUserId: string) => {
    try {
      const response = await changeTeamLead(teamId, leadUserId);
      if (response.success) {
        toast.success('Team lead updated');
        setSelectedTeam(response.team || null);
        fetchTeams();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change team lead');
    }
  };

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesQuery =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || team.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [teams, searchQuery, statusFilter]);

  const availableUsers = users.filter((u) => {
    const isMember = selectedTeam?.memberUserIds.some((m) => m.id === u.id || m._id === u.id);
    const isLead = selectedTeam?.leadUserId?.id === u.id || selectedTeam?.leadUserId?._id === u.id;
    return !isMember && !isLead;
  });

  const renderStatusBadge = (status: string) => {
    if (status === 'active') {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Inactive</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage your teams</p>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Teams</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your team structure</p>
        </div>
        {isAdmin && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Team</DialogTitle>
                <DialogDescription>Create a new team and assign a lead</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter team name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter team description"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Department</Label>
                  <Input
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    placeholder="Design, Engineering, Marketing..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead">Team Lead</Label>
                  <Select
                    value={formData.leadUserId}
                    onValueChange={(value) => setFormData({ ...formData, leadUserId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team lead" />
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
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="members">Team Members</Label>
                  <div className="flex gap-2">
                    <Select value={memberSelectId} onValueChange={setMemberSelectId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableMembersForCreate.map((user) => (
                          <SelectItem key={user.id || user._id} value={user.id || user._id || ''}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={handleAddMemberToCreate}>
                      Add
                    </Button>
                  </div>
                  {formData.memberUserIds.length === 0 ? (
                    <p className="text-xs text-gray-500">No members selected yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.memberUserIds.map((memberId) => {
                        const member = users.find(
                          (user) => user.id === memberId || user._id === memberId
                        );
                        return (
                          <div
                            key={memberId}
                            className="flex items-center justify-between rounded-lg border p-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{member?.name || 'Member'}</p>
                              <p className="text-xs text-gray-500">{member?.email}</p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleRemoveMemberFromCreate(memberId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!formData.leadUserId}>
                    Create Team
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Users className="h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No teams found
          </p>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Create your first team to get started' : 'You are not assigned to any teams yet'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card key={team._id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-lg">{team.name}</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Lead: {team.leadUserId?.name || 'Unassigned'}
                    </p>
                    <div className="mt-2">{renderStatusBadge(team.status)}</div>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    {canUpdateTeam(team) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-emerald-600"
                        onClick={() => openTeamUpdate(team)}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-blue-600"
                          onClick={() => {
                            setSelectedTeam(team);
                            setIsMembersOpen(true);
                          }}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteId(team._id)}
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
                  {team.description || 'No description'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Progress</span>
                    <span>{team.progressPercent ?? 0}%</span>
                  </div>
                  <AnimatedProgress value={team.progressPercent ?? 0} showMeta={false} size="sm" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{team.completedTasks ?? 0} completed</span>
                    <span>{team.taskCount ?? 0} total</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {(team.memberUserIds?.length || 0) + 1} members
                    </span>
                  </div>
                  <Link
                    to={`/teams/${team._id}`}
                    className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Team</DialogTitle>
            <DialogDescription>{selectedTeam?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="mb-2 text-sm font-medium">Team Lead</h4>
              <Select
                value={selectedTeam?.leadUserId?._id || ''}
                onValueChange={(value) => selectedTeam && handleChangeLead(selectedTeam._id, value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select lead" />
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
            <div>
              <h4 className="mb-2 text-sm font-medium">Members</h4>
              <div className="space-y-2">
                {selectedTeam?.memberUserIds.map((member) => (
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
                          selectedTeam._id,
                          member.id || (member as any)._id
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

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
                          handleAddMember(selectedTeam!._id, user.id || user._id || '')
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

      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Team Update</DialogTitle>
            <DialogDescription>{updateTeamTarget?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTeamUpdate} className="space-y-4">
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
              <Button type="submit" disabled={isSubmittingUpdate}>
                {isSubmittingUpdate ? 'Submitting...' : 'Submit Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The team will be permanently removed.
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
