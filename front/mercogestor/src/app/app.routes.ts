import { Routes } from "@angular/router";
import { AlertsComponent } from "./pages/alerts/alerts.component";
import { LoginComponent } from "./pages/auth/login.component";
import { BackupComponent } from "./pages/backup/backup.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { MovementsComponent } from "./pages/movements/movements.component";
import { ProductsComponent } from "./pages/products/products.component";
import { ReportsComponent } from "./pages/reports/reports.component";
import { UsersComponent } from "./pages/users/users.component";

// src/app/app.routes.ts
export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Entrar — Mercadinho Raiz' },

  { path: '', component: DashboardComponent, title: 'Início' },
  { path: 'produtos', component: ProductsComponent, title: 'Produtos' },
  { path: 'movimentacoes', component: MovementsComponent, title: 'Entradas & Saídas' },
  { path: 'alertas', component: AlertsComponent, title: 'Alertas' },
  { path: 'relatorios', component: ReportsComponent, title: 'Relatórios' },
  { path: 'usuarios', component: UsersComponent, title: 'Usuários' },
  { path: 'backup', component: BackupComponent, title: 'Backup' },

  { path: '**', redirectTo: '' },
];
