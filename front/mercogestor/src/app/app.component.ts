import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from './core/auth.service';
import { BackupService } from './core/backup.service';
import { ToastsComponent } from './toast/toast.component';
import { ConfirmComponent } from './confirm/confirm.component';
import { AlertBadgeComponent } from './shared/alert-badge/alert-badge.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ToastsComponent,
    ConfirmComponent,
    AlertBadgeComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  public auth = inject(AuthService);
  private backup = inject(BackupService);

  ngOnInit() {
    this.backup.checkDailyBackup();
  }
}
