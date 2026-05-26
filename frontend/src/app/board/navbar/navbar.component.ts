import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/task.model';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  showUserMenu = false;

  constructor(public authService: AuthService) {}

  get user(): User | null {
    return this.authService.currentUser;
  }

  get userInitials(): string {
    if (!this.user?.name) return '?';
    return this.user.name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  logout(): void {
    this.authService.logout();
  }

  toggleMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }
}
