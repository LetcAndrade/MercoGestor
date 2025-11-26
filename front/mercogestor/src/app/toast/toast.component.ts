import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../core/toast.service';
import type { Toast } from '../core/toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss']
})
export class ToastsComponent {
  private svc = inject(ToastService);
  toasts = this.svc.toasts;

  trackById = (_: number, t: Toast) => t.id;

  dismiss(id: number) { this.svc.dismiss(id); }
}
