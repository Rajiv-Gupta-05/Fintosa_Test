import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  HostListener,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Task, TaskStatus, TaskPriority, User, CreateTaskPayload, UpdateTaskPayload } from '../../models/task.model';

@Component({
  selector: 'app-task-modal',
  templateUrl: './task-modal.component.html',
  styleUrls: ['./task-modal.component.scss'],
})
export class TaskModalComponent implements OnInit {
  @Input() task: Task | null = null;
  @Input() users: User[] = [];
  @Output() save = new EventEmitter<{ data: CreateTaskPayload | UpdateTaskPayload; isEdit: boolean; id?: string }>();
  @Output() close = new EventEmitter<void>();

  form!: FormGroup;
  isSubmitting = false;

  readonly priorities: { value: TaskPriority; label: string; color: string }[] = [
    { value: 'LOW', label: '🟢 Low', color: '#10b981' },
    { value: 'MEDIUM', label: '🟡 Medium', color: '#f59e0b' },
    { value: 'HIGH', label: '🔴 High', color: '#ef4444' },
  ];

  readonly statuses: { value: TaskStatus; label: string }[] = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
  ];

  get isEdit(): boolean {
    return !!this.task;
  }

  get todayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    const t = this.task;
    const dueDateStr = t?.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : '';
    const assignedId = t?.assignedTo ? (t.assignedTo as User)._id : '';

    this.form = this.fb.group({
      title: [t?.title || '', [Validators.required, Validators.minLength(1)]],
      description: [t?.description || ''],
      priority: [t?.priority || 'MEDIUM', Validators.required],
      status: [t?.status || 'TODO', Validators.required],
      assignedTo: [assignedId],
      dueDate: [dueDateStr],
    });
  }

  get titleCtrl() { return this.form.get('title'); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;

    const raw = this.form.value;
    const payload = {
      title: raw.title.trim(),
      description: raw.description?.trim() || '',
      priority: raw.priority as TaskPriority,
      status: raw.status as TaskStatus,
      assignedTo: raw.assignedTo || null,
      dueDate: raw.dueDate || null,
    };

    this.save.emit({
      data: payload,
      isEdit: this.isEdit,
      id: this.task?._id,
    });

    // Let parent control closing so it can handle errors
    setTimeout(() => (this.isSubmitting = false), 2000);
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    this.close.emit();
  }
}
