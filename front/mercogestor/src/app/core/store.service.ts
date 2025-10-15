import { Injectable, effect, signal } from '@angular/core';

export type MovimentoTipo = 'in' | 'out';

export interface Produto {
  id: string;
  nome: string;
  unidade: string;      // 'kg', 'un', 'l', etc.
  minimo: number;
  preco?: number;
  categoria?: string;
}

export interface Movimento {
  id: string;
  productId: string;
  tipo: MovimentoTipo;  // 'in' | 'out'
  quantidade: number;
  dataISO: string;
  precoUnitario?: number;
  validadeLote?: string;
  motivo?: 'sale' | 'waste' | 'adjust' | string;
}

export interface Snapshot {
  version: 1;
  savedAtISO: string;
  products: Produto[];
  movements: Movimento[];
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  private _products = signal<Produto[]>([]);
  private _movements = signal<Movimento[]>([]);

  private LS_KEY = 'mrz:snapshot:v1';

  constructor() {
    // carrega do localStorage (se houver)
    const raw = localStorage.getItem(this.LS_KEY);
    if (raw) {
      try {
        const snap = JSON.parse(raw) as Snapshot;
        if (snap && Array.isArray(snap.products) && Array.isArray(snap.movements)) {
          this._products.set(snap.products);
          this._movements.set(snap.movements);
        }
      } catch {}
    }

    // salva continuamente (debounce simples por microtask)
    effect(() => {
      // ler sinais para rastrear
      const p = this._products();
      const m = this._movements();
      const snap: Snapshot = {
        version: 1,
        savedAtISO: new Date().toISOString(),
        products: p,
        movements: m
      };
      localStorage.setItem(this.LS_KEY, JSON.stringify(snap));
    });
  }

  // ===== Getters =====
  products(): Produto[] { return this._products(); }
  movements(): Movimento[] { return this._movements(); }

  // ===== Helpers =====
  private uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  stockOf(productId: string): number {
    let s = 0;
    for (const m of this._movements()) {
      if (m.productId !== productId) continue;
      s += (m.tipo === 'in' ? m.quantidade : -m.quantidade);
    }
    return s;
  }

  lowStock(): Produto[] { return this._products().filter(p => this.stockOf(p.id) <= p.minimo); }

  nearExpiration(days: number): Produto[] {
    const now = new Date();
    const limit = new Date(now); limit.setDate(limit.getDate() + days);
    const ids = new Set<string>();
    for (const m of this._movements()) {
      if (m.tipo !== 'in' || !m.validadeLote) continue;
      const d = new Date(m.validadeLote);
      if (d >= now && d <= limit) ids.add(m.productId);
    }
    return this._products().filter(p => ids.has(p.id));
  }

  // ===== Mutations =====
  addProduct(p: Omit<Produto, 'id'>): Produto {
    const novo: Produto = { id: this.uid(), ...p };
    this._products.set([...this._products(), novo]);
    return novo;
  }
  updateProduct(id: string, patch: Partial<Produto>): Produto | undefined {
    const list = this._products();
    const ix = list.findIndex(p => p.id === id);
    if (ix === -1) return undefined;
    const updated = { ...list[ix], ...patch };
    const next = list.slice(); next[ix] = updated;
    this._products.set(next);
    return updated;
  }
  removeProduct(id: string) {
    this._products.set(this._products().filter(p => p.id !== id));
    this._movements.set(this._movements().filter(m => m.productId !== id));
  }

  addMovement(m: Omit<Movimento, 'id'>): Movimento {
    const novo: Movimento = { id: this.uid(), ...m };
    this._movements.set([novo, ...this._movements()]);
    return novo;
  }
  updateMovement(id: string, patch: Partial<Movimento>): Movimento | undefined {
    const list = this._movements();
    const ix = list.findIndex(m => m.id === id);
    if (ix === -1) return undefined;
    const updated = { ...list[ix], ...patch };
    const next = list.slice(); next[ix] = updated;
    this._movements.set(next);
    return updated;
  }
  removeMovement(id: string) {
    this._movements.set(this._movements().filter(m => m.id !== id));
  }

  // ===== Backup API =====
  getSnapshot(): Snapshot {
    return {
      version: 1,
      savedAtISO: new Date().toISOString(),
      products: this._products(),
      movements: this._movements()
    };
  }

  replaceAll(snap: Snapshot) {
    if (!snap || !Array.isArray(snap.products) || !Array.isArray(snap.movements)) return;
    this._products.set(snap.products);
    this._movements.set(snap.movements);
  }

  clearAll() {
    this._products.set([]);
    this._movements.set([]);
  }
}
