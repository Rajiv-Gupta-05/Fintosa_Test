import {
  Component,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Task, TaskStatus } from '../../models/task.model';

@Component({
  selector: 'app-kanban-column',
  templateUrl: './kanban-column.component.html',
  styleUrls: ['./kanban-column.component.scss'],
})
export class KanbanColumnComponent {
  @Input() status!: TaskStatus;
  @Input() label!: string;
  @Input() color!: string;
  @Input() icon!: string;
  @Input() tasks: Task[] = [];
  @Input() totalCount = 0;
  @Input() isDragOver = false;

  @Output() editTask = new EventEmitter<Task>();
  @Output() deleteTask = new EventEmitter<Task>();
  @Output() statusChange = new EventEmitter<{ task: Task; status: TaskStatus }>();
  @Output() dragStart = new EventEmitter<Task>();
  @Output() dragEnd = new EventEmitter<void>();
  @Output() dragOver = new EventEmitter<DragEvent>();
  @Output() dragLeave = new EventEmitter<void>();
  @Output() drop = new EventEmitter<DragEvent>();

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.emit(event);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.drop.emit(event);
  }

  trackByTaskId(_: number, task: Task): string {
    return task._id;
  }
}
