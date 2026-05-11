export interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  createdBy: User;
  members: User[];
  assignedTeamId?: Team;
  teamAssignment?: TeamAssignment;
  progressPercent?: number;
  lastUpdateAt?: string;
  lastUpdatedBy?: User;
  lastUpdateStatus?: 'on-track' | 'at-risk' | 'delayed';
  taskCount?: number;
  completedTasks?: number;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'rejected';
export type UpdateStatus = TaskStatus;
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'changes-requested';

export interface Task {
  _id: string;
  title: string;
  description: string;
  projectId: {
    _id: string;
    name: string;
  };
  assignedTo?: User;
  assignedTeamId?: Team;
  teamAssignment?: TeamAssignment;
  status: TaskStatus;
  progressPercent?: number;
  lastUpdateAt?: string;
  lastUpdatedBy?: User;
  lastFeedback?: string;
  lastFeedbackAt?: string;
  lastFeedbackBy?: User;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskUpdateAttachment {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface TaskUpdateComment {
  user: User;
  text: string;
  createdAt: string;
}

export interface TaskUpdate {
  _id: string;
  taskId: string | Task;
  submittedBy: User;
  progressPercent: number;
  status: UpdateStatus;
  note: string;
  blockers?: string;
  attachments: TaskUpdateAttachment[];
  review: {
    status: ReviewStatus;
    comment?: string;
    reviewedBy?: User;
    reviewedAt?: string;
  };
  comments: TaskUpdateComment[];
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'update_submitted' | 'update_approved' | 'update_rejected' | 'feedback' | 'changes_requested';
  taskId?: string;
  updateId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamAssignment {
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  workload?: number;
  status?: 'planned' | 'in-progress' | 'blocked' | 'review' | 'done';
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  type?: string;
  leadUserId: User;
  memberUserIds: User[];
  status: 'active' | 'inactive';
  createdBy: User;
  assignedProjects?: string[];
  assignedTasks?: string[];
  progressPercent?: number;
  taskCount?: number;
  completedTasks?: number;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamUpdateComment {
  user: User;
  text: string;
  createdAt: string;
}

export interface TeamUpdate {
  _id: string;
  teamId: string | Team;
  submittedBy: User;
  progressPercent: number;
  status: 'on-track' | 'at-risk' | 'delayed';
  note: string;
  blockers?: string;
  comments: TeamUpdateComment[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamActivity {
  _id: string;
  teamId: string | Team;
  actor: User;
  type:
    | 'team_created'
    | 'team_updated'
    | 'member_added'
    | 'member_removed'
    | 'lead_changed'
    | 'assignment_added'
    | 'assignment_removed'
    | 'team_update_submitted';
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamPerformanceSummary {
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  reviewTasks: number;
  memberContributions: { _id: string; updates: number }[];
}

export interface ProjectUpdateComment {
  user: User;
  text: string;
  createdAt: string;
}

export interface ProjectUpdate {
  _id: string;
  projectId: string | Project;
  submittedBy: User;
  progressPercent: number;
  status: 'on-track' | 'at-risk' | 'delayed';
  note: string;
  blockers?: string;
  comments: ProjectUpdateComment[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectActivity {
  _id: string;
  projectId: string | Project;
  actor: User;
  type: 'project_update_submitted' | 'comment_added';
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalProjects: number;
  inProgressTasks: number;
  todoTasks: number;
  pendingReviews: number;
  tasksNeedingAttention: number;
  overallProgress: number;
  totalTeams?: number;
  activeTeams?: number;
  teamAssignedTasks?: number;
  teamCompletionRate?: number;
  teamsNeedingAttention?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  user?: User;
  users?: User[];
  project?: Project;
  projects?: Project[];
  task?: Task;
  tasks?: Task[];
  team?: Team;
  teams?: Team[];
  projectUpdate?: ProjectUpdate;
  projectUpdates?: ProjectUpdate[];
  projectActivities?: ProjectActivity[];
  teamUpdate?: TeamUpdate;
  teamUpdates?: TeamUpdate[];
  activities?: TeamActivity[];
  update?: TaskUpdate;
  updates?: TaskUpdate[];
  notification?: Notification;
  notifications?: Notification[];
  stats?: DashboardStats;
  recentTasks?: Task[];
  upcomingTasks?: Task[];
  token?: string;
}
