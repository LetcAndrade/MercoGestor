import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';            // ⬅️ aqui
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './core/auth.service';
import { BackupService } from './core/backup.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive], // ⬅️ adicionado
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  public auth = inject(AuthService);
  private backup = inject(BackupService);
  ngOnInit(){ this.backup.checkDailyBackup(); }
}
