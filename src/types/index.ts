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
  progressPercent?: number;
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
  assignedTo: User;
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
  update?: TaskUpdate;
  updates?: TaskUpdate[];
  notification?: Notification;
  notifications?: Notification[];
  stats?: DashboardStats;
  recentTasks?: Task[];
  upcomingTasks?: Task[];
  token?: string;
}
