import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

const API = 'http://localhost:3000/api';

export type MovimentoTipo = 'in' | 'out';

export interface Produto {
  id?: string | number;
  nome: string;
  categoria?: string;
  unidade: string;
  minimo: number;
  preco?: number;
}

export interface Movimento {
  id?: string | number;
  productId: string | number;
  tipo: MovimentoTipo;
  quantidade: number;
  data?: string;  // algumas APIs usam 'data'
  date?: string;  // outras usam 'date'
}

export interface MovimentoCreate {
  productId: string | number;
  tipo: MovimentoTipo;   // 'in' | 'out'
  quantidade: number;    // >0; direção é pelo tipo
  data: string;          // ISO (sempre enviamos)
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ========== PRODUCTS ==========
  listProducts(): Observable<Produto[]> {
    return this.http.get<any>(`${API}/products/`).pipe(
      map(r => Array.isArray(r) ? r : (r?.products ?? []))
    );
  }

  saveProduct(p: Produto | any): Observable<Produto> {
  return p.id
    ? this.http.put<any>(`${API}/products/${p.id}`, p).pipe(map(r => (r?.product ?? r)))
    : this.http.post<any>(`${API}/products/`, p).pipe(map(r => (r?.product ?? r)));
}


  deleteProduct(id: string | number): Observable<void> {
    return this.http.delete<void>(`${API}/products/${id}`);
  }

  // ========== MOVEMENTS ==========
  listMovements(): Observable<Movimento[]> {
    return this.http.get<any>(`${API}/movements/`).pipe(
      map(r => Array.isArray(r) ? r : (r?.movements ?? r?.movs ?? []))
    );
  }

  /** Cria um movimento (entrada/saída) para um produto */
  addMovement(m: MovimentoCreate): Observable<Movimento> {
    // Envia 'data' e 'date' (mesmo valor) para compatibilidade
    const payload = {
      productId: m.productId,
      tipo: m.tipo,
      quantidade: m.quantidade,
      data: m.data,   // 🇧🇷
      date: m.data    // 🇺🇸
    };
    return this.http.post<any>(`${API}/movements/`, payload).pipe(
      map(r => (r?.movement ?? r)) // aceita { movement: {...} } ou o objeto direto
    );
    // OBS: se o seu backend espera SEM a barra final, mude para `${API}/movements`
  }
}
