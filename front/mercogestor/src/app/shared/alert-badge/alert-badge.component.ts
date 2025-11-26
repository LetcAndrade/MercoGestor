import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlertService } from '../../core/alert.service';

@Component({
  selector: 'app-alert-badge',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './alert-badge.component.html',
  styleUrls: ['./alert-badge.component.scss']
})
export class AlertBadgeComponent {
  alerts = inject(AlertService);

  total = computed(() => this.alerts.total());
  lowCount = computed(() => this.alerts.totalLow());
  expirySoon = computed(() => this.alerts.totalExpirySoon());

  hasCritical = computed(
    () => this.alerts.low().some(a => a.status === 'empty')
  );
}
