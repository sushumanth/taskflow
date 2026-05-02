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
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'in-progress' | 'done';

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
  dueDate: string;
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
  stats?: DashboardStats;
  recentTasks?: Task[];
  upcomingTasks?: Task[];
  token?: string;
}
