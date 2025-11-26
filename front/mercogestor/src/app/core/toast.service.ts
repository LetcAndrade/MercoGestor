import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';
export type ToastVariant = 'toast' | 'modal';

export interface Toast {
  id: number;
  type: ToastType;
  text: string;
  ms?: number;             // duração (apenas para variant 'toast')
  variant?: ToastVariant;  // 'toast' (default) | 'modal'
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private seq = 0;

  /** Toast flutuante (canto) */
  show(text: string, type: ToastType = 'info', ms = 3500) {
    const id = ++this.seq;
    const toast: Toast = { id, type, text, ms, variant: 'toast' };
    this.toasts.update(xs => [...xs, toast]);
    if (ms && ms > 0) setTimeout(() => this.dismiss(id), ms);
    return id;
  }

  /** Modal central (fica até fechar) */
  showModal(text: string, type: ToastType = 'info') {
    const id = ++this.seq;
    const toast: Toast = { id, type, text, variant: 'modal' };
    this.toasts.update(xs => [...xs, toast]);
    return id;
  }

  dismiss(id: number) {
    this.toasts.update(xs => xs.filter(t => t.id !== id));
  }
  clear() { this.toasts.set([]); }

  // helpers
  success(text: string, ms = 3000) { return this.show(text, 'success', ms); }
  error(text: string, ms = 4000)   { return this.show(text, 'error', ms); }
  info(text: string, ms = 3500)    { return this.show(text, 'info', ms); }
  successModal(text: string)       { return this.showModal(text, 'success'); }
  errorModal(text: string)         { return this.showModal(text, 'error'); }
  infoModal(text: string)          { return this.showModal(text, 'info'); }
}
