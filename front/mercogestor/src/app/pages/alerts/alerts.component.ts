import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { StoreService, Produto, Movimento } from '../../core/store.service';
import { FormsModule } from '@angular/forms';

type StockStatus = 'ok' | 'low' | 'empty';

interface LowItem {
  produto: Produto;
  estoque: number;
  minimo: number;
  falta: number;
  status: StockStatus;
}

interface ExpItem {
  produto: Produto;
  dataISO: string;   // validade mais próxima
  dias: number;      // dias até vencer
}

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule], // <— ADICIONE
  templateUrl: './alerts.component.html',
  styleUrls: ['./alerts.component.scss']
})
export class AlertsComponent {
  store = inject(StoreService);

  // Filtro de validade (dias)
  dias = signal(10);

  // ====== ESTOQUE BAIXO / ESGOTADO ======
  low = computed<LowItem[]>(() => {
    const items: LowItem[] = [];
    for (const p of this.store.products()) {
      const estoque = this.store.stockOf(p.id);
      const status: StockStatus =
        estoque <= 0 ? 'empty' :
        estoque <= p.minimo ? 'low' : 'ok';
      if (status === 'ok') continue;

      items.push({
        produto: p,
        estoque,
        minimo: p.minimo,
        falta: Math.max(0, p.minimo - estoque),
        status
      });
    }
    // esgotado primeiro
    return items.sort((a,b) => (a.status === 'empty' ? -1 : 1) || a.estoque - b.estoque);
  });

  // ====== VALIDADE PRÓXIMA ======
  // pega a menor validade futura por produto e compara com "dias"
  expiries = computed<ExpItem[]>(() => {
    const limitDays = this.dias();
    const now = new Date(); now.setHours(0,0,0,0);
    const items: ExpItem[] = [];

    for (const p of this.store.products()) {
      const nearest = this.nextExpiryOf(p.id);
      if (!nearest) continue;
      const diff = Math.ceil((nearest.getTime() - now.getTime()) / (24*60*60*1000));
      if (diff >= 0 && diff <= limitDays) {
        items.push({ produto: p, dataISO: nearest.toISOString(), dias: diff });
      }
    }
    return items.sort((a,b) => a.dias - b.dias);
  });

  private nextExpiryOf(productId: string): Date | null {
    const now = new Date();
    let min: Date | null = null;
    for (const m of this.store.movements()) {
      if (m.productId !== productId || m.tipo !== 'in' || !m.validadeLote) continue;
      const d = new Date(m.validadeLote);
      if (d >= now && (!min || d < min)) min = d;
    }
    return min;
  }

  setDias(val: any) {
    const n = Number(val);
    this.dias.set(!Number.isNaN(n) && n > 0 ? Math.floor(n) : 1);
  }

  // ====== Exportação CSV (front-only) ======
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
