import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../core/confirm.service';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm.component.html',
  styleUrls: ['./confirm.component.scss']
})
export class ConfirmComponent {
  confirmSvc = inject(ConfirmService);
  state = this.confirmSvc.state;

  onOverlayClick() { this.confirmSvc.cancel(); }
  stop(e: Event) { e.stopPropagation(); }
}
