// src/app/core/auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';

export type Role = 'admin' | 'operador';
export interface User { id: string; email: string; role: Role; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly LS_KEY = 'mrz:auth:v1';
  private readonly LOGIN_ROUTE = '/login';            // <-- ajuste se necessário
  private router = inject(Router);

  private _user = signal<User | null>(null);

  constructor(){
    const raw = localStorage.getItem(this.LS_KEY);
    if (raw) try { this._user.set(JSON.parse(raw)); } catch {}
  }

  /** ---- Leitura ---- */
  user(){ return this._user(); }
  isAuthed(){ return !!this._user(); }
  currentUserId(){ return this._user()?.id ?? ''; }
  role(): Role | null { return this._user()?.role ?? null; }

  /** ---- Ações ---- */
  login(email: string, password: string){
    if (!email || (password ?? '').length < 3) throw new Error('Credenciais inválidas');
    const role: Role = email.toLowerCase().includes('admin') ? 'admin' : 'operador';
    const u: User = { id: email.toLowerCase(), email, role };
    this._user.set(u);
    localStorage.setItem(this.LS_KEY, JSON.stringify(u));
    // navegação é feita no LoginComponent após sucesso (navigateByUrl('/'))
  }

  /** Atalho para trocar papel/usuário rápido (tela Usuários) */
  loginAs(roleOrId: string){
    const v = roleOrId.toLowerCase();
    const role: Role = (v === 'admin') ? 'admin' : 'operador';
    const email = role === 'admin' ? 'admin@mercado.com' : 'operador@mercado.com';
    const u: User = { id: email, email, role };
    this._user.set(u);
    localStorage.setItem(this.LS_KEY, JSON.stringify(u));
  }

  guest(){
    const u: User = { id: 'guest@mercado.com', email: 'guest@mercado.com', role: 'operador' };
    this._user.set(u);
    localStorage.setItem(this.LS_KEY, JSON.stringify(u));
    // navegação é feita no LoginComponent (navigateByUrl('/'))
  }

  logout(redirectTo: string = this.LOGIN_ROUTE){
    this._user.set(null);
    localStorage.removeItem(this.LS_KEY);
    // redireciona para a tela de login
    this.router.navigateByUrl(redirectTo);
  }

  /** Opcional: chame antes de entrar em páginas protegidas */
  ensureAuth(redirectIfNot = this.LOGIN_ROUTE){
    if (!this.isAuthed()) this.router.navigateByUrl(redirectIfNot);
  }
}
