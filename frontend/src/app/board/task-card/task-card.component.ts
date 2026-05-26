import {
  Component,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Task, TaskStatus, User } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss'],
})
export class TaskCardComponent {
  @Input() task!: Task;
  @Input() columnStatus!: TaskStatus;

  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<{ task: Task; status: TaskStatus }>();
  @Output() dragStarted = new EventEmitter<void>();
  @Output() dragEnded = new EventEmitter<void>();

  isDragging = false;
  showMenu = false;

  get priorityClass(): string {
    return {
      HIGH: 'priority-high',
      MEDIUM: 'priority-medium',
      LOW: 'priority-low',
    }[this.task.priority] || '';
  }

  get priorityLabel(): string {
    return {
      HIGH: '🔴 High',
      MEDIUM: '🟡 Medium',
      LOW: '🟢 Low',
    }[this.task.priority] || '';
  }

  get isOverdue(): boolean {
    if (!this.task.dueDate) return false;
    return new Date(this.task.dueDate) < new Date() && this.task.status !== 'DONE';
  }

  get isDueSoon(): boolean {
    if (!this.task.dueDate || this.isOverdue || this.task.status === 'DONE') return false;
    const diff = new Date(this.task.dueDate).getTime() - new Date().getTime();
    return diff <= 86400000 * 2; // within 2 days
  }

  get formattedDueDate(): string {
    if (!this.task.dueDate) return '';
    return new Date(this.task.dueDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  }

  get assigneeInitials(): string {
    const user = this.task.assignedTo as User;
    if (!user?.name) return '?';
    return user.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  get assigneeColor(): string {
    const user = this.task.assignedTo as User;
    if (!user?.name) return '#6b7280';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
    const idx = user.name.charCodeAt(0) % colors.length;
    return colors[idx];
  }

  availableStatuses(): TaskStatus[] {
    const all: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];
    return all.filter((s) => s !== this.task.status);
  }

  onDragStart(event: DragEvent): void {
    this.isDragging = true;
    event.dataTransfer?.setData('text/plain', this.task._id);
    this.dragStarted.emit();
  }

  onDragEnd(): void {
    this.isDragging = false;
    this.dragEnded.emit();
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  closeMenu(): void {
    this.showMenu = false;
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.showMenu = false;
    this.edit.emit();
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.showMenu = false;
    this.delete.emit();
  }

  onStatusMove(status: TaskStatus, event: MouseEvent): void {
    event.stopPropagation();
    this.showMenu = false;
    this.statusChange.emit({ task: this.task, status });
  }

  statusLabel(status: TaskStatus): string {
    return { TODO: 'To Do', IN_PROGRESS: 'In Progress', DONE: 'Done' }[status];
  }
}
