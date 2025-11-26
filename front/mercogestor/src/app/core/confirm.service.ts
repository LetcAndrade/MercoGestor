import { Injectable, signal } from '@angular/core';

export type ConfirmVariant = 'default' | 'danger';

export interface ConfirmState {
  open: boolean;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: ConfirmVariant;
  resolve?: (val: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  state = signal<ConfirmState>({
    open: false,
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'default'
  });

  ask(message: string, opts?: Partial<Omit<ConfirmState, 'open' | 'message' | 'resolve'>>) {
    return new Promise<boolean>(resolve => {
      this.state.set({
        open: true,
        message,
        confirmText: opts?.confirmText ?? 'Confirmar',
        cancelText: opts?.cancelText ?? 'Cancelar',
        variant: opts?.variant ?? 'default',
        resolve
      });
    });
  }

  confirm() { this.finish(true); }
  cancel()  { this.finish(false); }

  private finish(val: boolean) {
    const r = this.state().resolve;
    r?.(val);
    this.state.update(s => ({ ...s, open: false, resolve: undefined }));
  }
}
