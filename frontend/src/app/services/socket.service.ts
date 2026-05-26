import { Injectable, OnDestroy } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {
  private socket: Socket | null = null;

  public taskCreated$ = new Subject<Task>();
  public taskUpdated$ = new Subject<Task>();
  public taskDeleted$ = new Subject<{ id: string }>();
  public taskStatusChanged$ = new Subject<Task>();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('task:created', (task: Task) => {
      this.taskCreated$.next(task);
    });

    this.socket.on('task:updated', (task: Task) => {
      this.taskUpdated$.next(task);
    });

    this.socket.on('task:deleted', (data: { id: string }) => {
      this.taskDeleted$.next(data);
    });

    this.socket.on('task:statusChanged', (task: Task) => {
      this.taskStatusChanged$.next(task);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
