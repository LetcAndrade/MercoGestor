import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

const API = 'http://localhost:3000/api'; // ou '/api' se usar proxy

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
  dataISO?: string;
  data?: string;
  date?: string;
  precoUnitario?: number;
  validadeLote?: string;
  motivo?: string;
}

export interface MovimentoCreate {
  productId: string | number;
  tipo: MovimentoTipo;   // 'in' | 'out'
  quantidade: number;    // > 0; direção é pelo tipo
  data: string;          // ISO (sempre enviamos)
  precoUnitario?: number;
  validadeLote?: string; // 'YYYY-MM-DD' ou ISO
  motivo?: string;
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
      ? this.http.put<any>(`${API}/products/${p.id}`, p)
          .pipe(map(r => (r?.product ?? r)))
      : this.http.post<any>(`${API}/products/`, p)
          .pipe(map(r => (r?.product ?? r)));
  }

  deleteProduct(id: string | number): Observable<void> {
    return this.http.delete<void>(`${API}/products/${id}`);
  }

  // ========== MOVEMENTS ==========

  /** Lista movimentos com filtros opcionais de tipo / período */
  listMovements(opts?: { tipo?: 'all'|'in'|'out'; inicio?: string; fim?: string }): Observable<Movimento[]> {
    let params = new HttpParams();
    if (opts?.tipo && opts.tipo !== 'all') params = params.set('tipo', opts.tipo);
    if (opts?.inicio) params = params.set('inicio', opts.inicio);
    if (opts?.fim)    params = params.set('fim', opts.fim);

    return this.http.get<any>(`${API}/movements/`, { params }).pipe(
      map(r => {
        const arr = Array.isArray(r) ? r : (r?.movements ?? r?.movs ?? []);
        return arr.map((m: any) => ({
          ...m,
          dataISO: m.dataISO ?? m.data ?? m.date ?? null,
        }) as Movimento);
      })
    );
  }

  /** Cria um movimento (entrada/saída) para um produto */
  addMovement(m: MovimentoCreate): Observable<any> {
    const payload: any = {
      productId: m.productId,
      tipo: m.tipo,
      quantidade: m.quantidade,
      dataISO: m.data, // backend espera dataISO
    };

    if (m.precoUnitario != null) payload.precoUnitario = m.precoUnitario;
    if (m.validadeLote)         payload.validadeLote  = m.validadeLote;
    if (m.motivo)               payload.motivo        = m.motivo;

    return this.http.post<any>(`${API}/movements/`, payload);
  }

  deleteMovement(id: string | number): Observable<void> {
    return this.http.delete<void>(`${API}/movements/${id}`);
  }
}
