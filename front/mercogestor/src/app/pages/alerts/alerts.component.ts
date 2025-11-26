import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AlertService } from '../../core/alert.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss']
})
export class AlertsComponent {
  alerts = inject(AlertService);

  // filtro de validade (dias) só para visão desta tela
  dias = signal(10);

  // Estoque baixo/esgotado vem direto do service
  low = computed(() => this.alerts.low());

  // Validade filtrada pelo número de dias escolhido na tela
  expiries = computed(() => {
    const maxDays = this.dias();
    return this.alerts.expiries().filter(e => e.dias <= maxDays);
  });

  setDias(val: any) {
    const n = Number(val);
    this.dias.set(!Number.isNaN(n) && n > 0 ? Math.floor(n) : 1);
  }

  // ===== Exportação CSV (mesma lógica que você já tinha) =====
  exportCsv(section: 'stock' | 'expiry') {
    let rows: string[][] = [];
    if (section === 'stock') {
      rows = [
        ['Produto','Categoria','Em estoque','Mínimo','Falta','Status'],
        ...this.low().map(i => [
          i.produto.nome,
          i.produto.categoria || '',
          String(i.estoque),
          String(i.minimo),
          String(i.falta),
          i.status === 'empty' ? 'Esgotado' : 'Baixo'
        ])
      ];
    } else {
      rows = [
        ['Produto','Categoria','Validade','Em (dias)'],
        ...this.expiries().map(e => [
          e.produto.nome,
          e.produto.categoria || '',
          new Date(e.dataISO).toLocaleDateString(),
          String(e.dias)
        ])
      ];
    }
    const csv = rows.map(r => r.map(v => `"${(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = section === 'stock' ? 'alertas-estoque.csv' : 'alertas-validade.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
