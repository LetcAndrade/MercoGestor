import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { MovementsComponent } from './pages/movements/movements.component';
import { AlertsComponent } from './pages/alerts/alerts.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { UsersComponent } from './pages/users/users.component';
import { BackupComponent } from './pages/backup/backup.component';
import { LoginComponent } from './pages/auth/login.component';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Entrar — Mercadinho Raiz' },

  { path: '', component: DashboardComponent, canActivate:[authGuard], title: 'Início' },
  { path: 'produtos', component: ProductsComponent, title: 'Produtos' },
  { path: 'movimentacoes', component: MovementsComponent, canActivate:[authGuard], title: 'Entradas & Saídas' },
  { path: 'alertas', component: AlertsComponent, canActivate:[authGuard], title: 'Alertas' },
  { path: 'relatorios', component: ReportsComponent, canActivate:[authGuard], title: 'Relatórios' },
  { path: 'usuarios', component: UsersComponent, canActivate:[authGuard], title: 'Usuários' },
  { path: 'backup', component: BackupComponent, canActivate:[authGuard], title: 'Backup' },

  { path: '**', redirectTo: '' },
];
