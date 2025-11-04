import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = '/api';

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
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // PRODUCTS
  listProducts(): Observable<Produto[]> {
    return this.http.get<Produto[]>(`${API}/products`);
  }
  saveProduct(p: Produto): Observable<Produto> {
    return p.id
      ? this.http.put<Produto>(`${API}/products/${p.id}`, p)
      : this.http.post<Produto>(`${API}/products`, p);
  }
  deleteProduct(id: string | number): Observable<void> {
    return this.http.delete<void>(`${API}/products/${id}`);
  }

  // MOVEMENTS
  listMovements(): Observable<Movimento[]> {
    return this.http.get<Movimento[]>(`${API}/movements`);
  }
}
