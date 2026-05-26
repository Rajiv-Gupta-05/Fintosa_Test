import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { BoardRoutingModule } from './board-routing.module';
import { BoardComponent } from './board/board.component';
import { KanbanColumnComponent } from './kanban-column/kanban-column.component';
import { TaskCardComponent } from './task-card/task-card.component';
import { TaskModalComponent } from './task-modal/task-modal.component';
import { NavbarComponent } from './navbar/navbar.component';

@NgModule({
  declarations: [
    BoardComponent,
    KanbanColumnComponent,
    TaskCardComponent,
    TaskModalComponent,
    NavbarComponent,
  ],
  imports: [CommonModule, ReactiveFormsModule, FormsModule, BoardRoutingModule],
})
export class BoardModule {}
