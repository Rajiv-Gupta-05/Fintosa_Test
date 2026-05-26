import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TaskService } from '../../services/task.service';
import { SocketService } from '../../services/socket.service';
import { AuthService } from '../../services/auth.service';
import { Task, TaskStatus, User, CreateTaskPayload, UpdateTaskPayload } from '../../models/task.model';

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.scss'],
})
export class BoardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  columns: { status: TaskStatus; label: string; color: string; icon: string }[] = [
    { status: 'TODO', label: 'To Do', color: '#6b7280', icon: '📋' },
    { status: 'IN_PROGRESS', label: 'In Progress', color: '#f59e0b', icon: '⚡' },
    { status: 'DONE', label: 'Done', color: '#10b981', icon: '✅' },
  ];

  allTasks: Task[] = [];
  users: User[] = [];

  // Filters
  searchQuery = '';
  filterPriority = '';
  filterAssignee = '';

  // Modal
  showModal = false;
  editingTask: Task | null = null;

  // Notifications toast
  toastMessage = '';
  toastType: 'success' | 'info' | 'error' = 'info';
  toastTimeout: any;

  // Drag state
  draggedTask: Task | null = null;
  dragOverColumn: TaskStatus | null = null;

  isLoading = true;

  constructor(
    public taskService: TaskService,
    private socketService: SocketService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadBoard();
    this.setupSocketListeners();
    this.socketService.connect();
    this.authService.getUsers().subscribe({
      next: (res) => (this.users = res.users),
    });
  }

  private loadBoard(): void {
    this.isLoading = true;
    // Always fetch fresh from server — clears any stale in-memory ghost tasks
    this.taskService.loadTasks().subscribe({
      next: (res) => {
        this.allTasks = res.tasks;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Failed to load tasks', 'error');
      },
    });

    this.taskService.tasks$.pipe(takeUntil(this.destroy$)).subscribe((tasks) => {
      this.allTasks = tasks;
    });
  }

  private setupSocketListeners(): void {
    this.socketService.taskCreated$.pipe(takeUntil(this.destroy$)).subscribe((task) => {
      if (task.createdBy?._id !== this.authService.currentUser?._id) {
        this.taskService.handleSocketCreate(task);
        this.showToast(`New task "${task.title}" was added`, 'info');
      }
    });

    this.socketService.taskUpdated$.pipe(takeUntil(this.destroy$)).subscribe((task) => {
      if (task.createdBy?._id !== this.authService.currentUser?._id) {
        this.taskService.handleSocketUpdate(task);
        this.showToast(`Task "${task.title}" was updated`, 'info');
      }
    });

    this.socketService.taskDeleted$.pipe(takeUntil(this.destroy$)).subscribe(({ id }) => {
      this.taskService.handleSocketDelete(id);
      this.showToast('A task was removed', 'info');
    });

    this.socketService.taskStatusChanged$.pipe(takeUntil(this.destroy$)).subscribe((task) => {
      if (task.createdBy?._id !== this.authService.currentUser?._id) {
        this.taskService.handleSocketUpdate(task);
        this.showToast(`Task "${task.title}" moved to ${task.status.replace('_', ' ')}`, 'info');
      }
    });
  }

  getColumnTasks(status: TaskStatus): Task[] {
    return this.allTasks.filter((t) => {
      if (t.status !== status) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (this.filterPriority && t.priority !== this.filterPriority) return false;
      if (this.filterAssignee) {
        if (!t.assignedTo || (t.assignedTo as User)._id !== this.filterAssignee) return false;
      }
      return true;
    });
  }

  getColumnCount(status: TaskStatus): number {
    return this.allTasks.filter((t) => t.status === status).length;
  }

  openCreateModal(): void {
    this.editingTask = null;
    this.showModal = true;
  }

  openEditModal(task: Task): void {
    this.editingTask = task;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingTask = null;
  }

  onTaskSaved(payload: { data: CreateTaskPayload | UpdateTaskPayload; isEdit: boolean; id?: string }): void {
    if (payload.isEdit && payload.id) {
      this.taskService.updateTask(payload.id, payload.data as UpdateTaskPayload).subscribe({
        next: () => {
          this.closeModal();
          this.showToast('Task updated successfully', 'success');
        },
        error: (err) => {
          if (err?.status === 404) {
            this.closeModal();
            this.showToast('This task no longer exists — it may have been deleted by another user', 'error');
          } else {
            this.showToast(err?.error?.message || 'Failed to update task', 'error');
          }
        },
      });
    } else {
      this.taskService.createTask(payload.data as CreateTaskPayload).subscribe({
        next: () => {
          this.closeModal();
          this.showToast('Task created successfully', 'success');
        },
        error: (err) => this.showToast(err?.error?.message || 'Failed to create task', 'error'),
      });
    }
  }

  onStatusChange(event: { task: Task; status: TaskStatus }): void {
    if (event.task.status === 'DONE' && event.status === 'TODO') {
      this.showToast('Completed tasks cannot be moved back to TODO', 'error');
      return;
    }
    this.taskService.updateStatus(event.task._id, event.status).subscribe({
      next: () => this.showToast('Status updated', 'success'),
      error: (err) => {
        if (err?.status === 404) {
          this.showToast(`"${event.task.title}" no longer exists — removed from board`, 'error');
        } else {
          this.showToast(err?.error?.message || 'Failed to update status', 'error');
        }
      },
    });
  }

  onDeleteTask(task: Task): void {
    if (!confirm(`Delete task "${task.title}"?`)) return;
    this.taskService.deleteTask(task._id).subscribe({
      next: () => this.showToast('Task deleted', 'success'),
      error: () => this.showToast('Failed to delete task', 'error'),
    });
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────
  onDragStart(task: Task): void {
    this.draggedTask = task;
  }

  onDragEnd(): void {
    this.draggedTask = null;
    this.dragOverColumn = null;
  }

  onDragOver(event: DragEvent, status: TaskStatus): void {
    event.preventDefault();
    this.dragOverColumn = status;
  }

  onDragLeave(): void {
    this.dragOverColumn = null;
  }

  onDrop(event: DragEvent, targetStatus: TaskStatus): void {
    event.preventDefault();
    this.dragOverColumn = null;

    if (!this.draggedTask || this.draggedTask.status === targetStatus) {
      this.draggedTask = null;
      return;
    }

    // Business rule: completed → TODO blocked
    if (this.draggedTask.status === 'DONE' && targetStatus === 'TODO') {
      this.showToast('Completed tasks cannot be moved back to TODO', 'error');
      this.draggedTask = null;
      return;
    }

    const task = this.draggedTask;
    this.draggedTask = null;
    this.taskService.updateStatus(task._id, targetStatus).subscribe({
      next: () => this.showToast(`Moved to ${targetStatus.replace('_', ' ')}`, 'success'),
      error: (err) => {
        if (err?.status === 404) {
          this.showToast(`"${task.title}" no longer exists — removed from board`, 'error');
        } else {
          this.showToast(err?.error?.message || 'Failed to move task', 'error');
        }
      },
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.filterPriority = '';
    this.filterAssignee = '';
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.filterPriority || this.filterAssignee);
  }

  showToast(message: string, type: 'success' | 'info' | 'error'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => (this.toastMessage = ''), 3500);
  }

  trackByTaskId(_: number, task: Task): string {
    return task._id;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.disconnect();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }
}
