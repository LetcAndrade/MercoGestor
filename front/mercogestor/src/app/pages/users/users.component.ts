import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, Role } from '../../core/auth.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent {
  auth = inject(AuthService);

  roles: Role[] = ['admin', 'operador'];
  current = signal<Role>(this.auth.role() ?? 'operador');

  setRole(v: any){ this.current.set((String(v) as Role) || 'operador'); }
  login(){ this.auth.loginAs(this.current()); }
  logout(){ this.auth.logout(); }
}
