import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Task,
  TasksResponse,
  CreateTaskPayload,
  UpdateTaskPayload,
  TaskStatus,
} from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private apiUrl = `${environment.apiUrl}/tasks`;
  private tasksSubject = new BehaviorSubject<Task[]>([]);
  public tasks$ = this.tasksSubject.asObservable();

  constructor(private http: HttpClient) {}

  get tasks(): Task[] {
    return this.tasksSubject.value;
  }

  /** Remove a task from local state immediately (called on 404 responses). */
  removeFromState(id: string): void {
    this.tasksSubject.next(this.tasksSubject.value.filter((t) => t._id !== id));
  }

  loadTasks(filters?: { status?: string; priority?: string; search?: string }): Observable<TasksResponse> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.priority) params = params.set('priority', filters.priority);
    if (filters?.search) params = params.set('search', filters.search);

    return this.http
      .get<TasksResponse>(this.apiUrl, { params })
      .pipe(tap((res) => this.tasksSubject.next(res.tasks)));
  }

  createTask(payload: CreateTaskPayload): Observable<{ task: Task }> {
    return this.http.post<{ task: Task }>(this.apiUrl, payload).pipe(
      tap((res) => {
        const current = this.tasksSubject.value;
        this.tasksSubject.next([...current, res.task]);
      })
    );
  }

  updateTask(id: string, payload: UpdateTaskPayload): Observable<{ task: Task }> {
    return this.http.put<{ task: Task }>(`${this.apiUrl}/${id}`, payload).pipe(
      tap((res) => {
        const updated = this.tasksSubject.value.map((t) =>
          t._id === res.task._id ? res.task : t
        );
        this.tasksSubject.next(updated);
      }),
      catchError((err) => {
        // Task was deleted externally — evict from local state
        if (err?.status === 404) this.removeFromState(id);
        return throwError(() => err);
      })
    );
  }

  updateStatus(id: string, status: TaskStatus): Observable<{ task: Task }> {
    return this.http.patch<{ task: Task }>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      tap((res) => {
        const updated = this.tasksSubject.value.map((t) =>
          t._id === res.task._id ? res.task : t
        );
        this.tasksSubject.next(updated);
      }),
      catchError((err) => {
        // Task no longer exists in DB — remove the ghost from local state
        if (err?.status === 404) this.removeFromState(id);
        return throwError(() => err);
      })
    );
  }

  deleteTask(id: string): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const filtered = this.tasksSubject.value.filter((t) => t._id !== id);
        this.tasksSubject.next(filtered);
      })
    );
  }

  // Called by socket events to update local state without HTTP calls
  handleSocketCreate(task: Task): void {
    const exists = this.tasksSubject.value.find((t) => t._id === task._id);
    if (!exists) {
      this.tasksSubject.next([...this.tasksSubject.value, task]);
    }
  }

  handleSocketUpdate(task: Task): void {
    const tasks = this.tasksSubject.value;
    const index = tasks.findIndex((t) => t._id === task._id);
    if (index !== -1) {
      const updated = [...tasks];
      updated[index] = task;
      this.tasksSubject.next(updated);
    } else {
      this.tasksSubject.next([...tasks, task]);
    }
  }

  handleSocketDelete(id: string): void {
    this.tasksSubject.next(this.tasksSubject.value.filter((t) => t._id !== id));
  }
}
