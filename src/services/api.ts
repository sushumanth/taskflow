import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  ApiResponse,
  User,
  Project,
  Task,
  DashboardStats,
  TaskUpdate,
  ReviewStatus,
  Notification,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const API_BASE_URL = API_URL.replace(/\/?api\/?$/, '');

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = async (name: string, email: string, password: string, role?: string): Promise<ApiResponse<{ token: string; user: User }>> => {
  const response = await api.post('/auth/register', { name, email, password, role });
  return response.data;
};

export const login = async (email: string, password: string): Promise<ApiResponse<{ token: string; user: User }>> => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const getMe = async (): Promise<ApiResponse<{ user: User }>> => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const getAllUsers = async (): Promise<ApiResponse<{ users: User[] }>> => {
  const response = await api.get('/auth/users');
  return response.data;
};

// Projects
export const createProject = async (data: { name: string; description: string; members?: string[] }): Promise<ApiResponse<{ project: Project }>> => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const getProjects = async (): Promise<ApiResponse<{ projects: Project[] }>> => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProjectById = async (id: string): Promise<ApiResponse<{ project: Project }>> => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const updateProject = async (id: string, data: { name?: string; description?: string }): Promise<ApiResponse<{ project: Project }>> => {
  const response = await api.put(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

export const addMember = async (projectId: string, userId: string): Promise<ApiResponse<{ project: Project }>> => {
  const response = await api.put(`/projects/${projectId}/members`, { userId });
  return response.data;
};

export const removeMember = async (projectId: string, userId: string): Promise<ApiResponse<{ project: Project }>> => {
  const response = await api.delete(`/projects/${projectId}/members`, { data: { userId } });
  return response.data;
};

// Tasks
export const createTask = async (data: { title: string; description: string; projectId: string; assignedTo: string; dueDate: string }): Promise<ApiResponse<{ task: Task }>> => {
  const response = await api.post('/tasks', data);
  return response.data;
};

export const getTasks = async (params?: { projectId?: string; status?: string }): Promise<ApiResponse<{ tasks: Task[] }>> => {
  const response = await api.get('/tasks', { params });
  return response.data;
};

export const getTaskById = async (id: string): Promise<ApiResponse<{ task: Task }>> => {
  const response = await api.get(`/tasks/${id}`);
  return response.data;
};

export const updateTask = async (id: string, data: { title?: string; description?: string; assignedTo?: string; status?: string; dueDate?: string }): Promise<ApiResponse<{ task: Task }>> => {
  const response = await api.put(`/tasks/${id}`, data);
  return response.data;
};

export const deleteTask = async (id: string): Promise<ApiResponse<void>> => {
  const response = await api.delete(`/tasks/${id}`);
  return response.data;
};

// Task Updates
export const createTaskUpdate = async (taskId: string, data: FormData): Promise<ApiResponse<{ update: TaskUpdate }>> => {
  const response = await api.post(`/tasks/${taskId}/updates`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const getTaskUpdates = async (taskId: string): Promise<ApiResponse<{ updates: TaskUpdate[] }>> => {
  const response = await api.get(`/tasks/${taskId}/updates`);
  return response.data;
};

export const getMyTaskUpdates = async (employeeId?: string): Promise<ApiResponse<{ updates: TaskUpdate[] }>> => {
  const response = await api.get('/task-updates/my', { params: employeeId ? { employeeId } : undefined });
  return response.data;
};

export const reviewTaskUpdate = async (
  updateId: string,
  data: { status: ReviewStatus; comment?: string }
): Promise<ApiResponse<{ update: TaskUpdate }>> => {
  const response = await api.post(`/task-updates/${updateId}/review`, data);
  return response.data;
};

export const addTaskUpdateComment = async (
  updateId: string,
  text: string
): Promise<ApiResponse<{ update: TaskUpdate }>> => {
  const response = await api.post(`/task-updates/${updateId}/comments`, { text });
  return response.data;
};

export const updateTaskUpdate = async (
  updateId: string,
  data: FormData
): Promise<ApiResponse<{ update: TaskUpdate }>> => {
  const response = await api.put(`/task-updates/${updateId}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const deleteTaskUpdate = async (updateId: string): Promise<ApiResponse<void>> => {
  const response = await api.delete(`/task-updates/${updateId}`);
  return response.data;
};

// Notifications
export const getNotifications = async (limit = 20): Promise<ApiResponse<{ notifications: Notification[] }>> => {
  const response = await api.get('/notifications', { params: { limit } });
  return response.data;
};

export const markNotificationRead = async (id: string): Promise<ApiResponse<{ notification: Notification }>> => {
  const response = await api.put(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async (): Promise<ApiResponse<void>> => {
  const response = await api.put('/notifications/read-all');
  return response.data;
};

// Dashboard
export const getDashboardStats = async (): Promise<ApiResponse<{ stats: DashboardStats; recentTasks: Task[]; upcomingTasks: Task[] }>> => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export default api;
