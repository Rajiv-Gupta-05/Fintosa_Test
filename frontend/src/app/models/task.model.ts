export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'member' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  _id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: User | null;
  createdBy: User;
  dueDate?: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskPayload extends Partial<CreateTaskPayload> {
  order?: number;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface ApiError {
  message: string;
}
