import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, Produto, Movimento } from './api.service';

export type StockStatus = 'ok' | 'low' | 'empty';

export interface LowAlert {
  produto: Produto;
  estoque: number;
  minimo: number;
  falta: number;
  status: StockStatus;
}

export interface ExpiryAlert {
  produto: Produto;
  dataISO: string;   // validade mais próxima
  dias: number;      // dias até vencer
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private api = inject(ApiService);

  private _low = signal<LowAlert[]>([]);
  private _expiries = signal<ExpiryAlert[]>([]);
  private _loading = signal(false);

  /** Lista de estoque baixo/esgotado */
  low = computed(() => this._low());

  /** Todas as validades futuras por produto */
  expiries = computed(() => this._expiries());

  loading = computed(() => this._loading());

  /** Total de alertas (estoque + validade próxima) */
  total = computed(() => this._low().length + this._expiriesSoon(10).length);

  /** Só estoque baixo/esgotado */
  totalLow = computed(() => this._low().length);

  /** Validades nos próximos 10 dias (para badge global) */
  totalExpirySoon = computed(() => this._expiriesSoon(10).length);

  constructor() {
    this.refresh();
  }

  /** Atualiza alertas a partir do backend */
  refresh(): void {
    this._loading.set(true);

    this.api.listProducts().subscribe({
      next: produtos => {
        this.api.listMovements().subscribe({
          next: movimentos => {
            this.recalculate(produtos, movimentos);
            this._loading.set(false);
          },
          error: err => {
            console.error('Erro ao carregar movimentos para alerts', err);
            this._loading.set(false);
          }
        });
      },
      error: err => {
        console.error('Erro ao carregar produtos para alerts', err);
        this._loading.set(false);
      }
    });
  }

  // ========= INTERNOS =========

  private recalculate(produtos: Produto[], movimentos: Movimento[]) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const low: LowAlert[] = [];
    const exp: ExpiryAlert[] = [];

    // indexa movimentos por produto
    const movByProd = new Map<string, Movimento[]>();
    for (const m of movimentos) {
      const key = String(m.productId);
      const list = movByProd.get(key) ?? [];
      list.push(m);
      movByProd.set(key, list);
    }

    for (const p of produtos) {
      const pid = String(p.id ?? '');
      if (!pid) continue;

      const movs = movByProd.get(pid) ?? [];

      // ===== ESTOQUE =====
      const estoque = movs.reduce((s, m) => {
        const q = Number(m.quantidade) || 0;
        return s + (m.tipo === 'in' ? q : -q);
      }, 0);

      const minimo = Number(p.minimo) || 0;
      const status: StockStatus =
        estoque <= 0 ? 'empty'
        : estoque <= minimo ? 'low'
        : 'ok';

      if (status !== 'ok') {
        low.push({
          produto: p,
          estoque,
          minimo,
          falta: Math.max(0, minimo - estoque),
          status
        });
      }

      // ===== VALIDADE =====
      let nearest: Date | null = null;
      for (const m of movs) {
        if (m.tipo !== 'in' || !m.validadeLote) continue;
        const d = new Date(m.validadeLote);
        if (d < now) continue; // já vencido não entra
        if (!nearest || d < nearest) nearest = d;
      }

      if (nearest) {
        const diff = Math.ceil((nearest.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        if (diff >= 0) {
          exp.push({
            produto: p,
            dataISO: nearest.toISOString(),
            dias: diff
          });
        }
      }
    }

    // ordena: esgotado primeiro, depois menor estoque
    low.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'empty' ? -1 : 1;
      }
      return a.estoque - b.estoque;
    });

    // validade: mais próxima primeiro
    exp.sort((a, b) => a.dias - b.dias);

    this._low.set(low);
    this._expiries.set(exp);
  }

  private _expiriesSoon(limitDays: number): ExpiryAlert[] {
    return this._expiries().filter(e => e.dias <= limitDays);
  }
}
