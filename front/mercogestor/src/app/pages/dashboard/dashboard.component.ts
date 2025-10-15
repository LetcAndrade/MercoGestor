import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { StoreService, Produto, Movimento } from '../../core/store.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, NgIf, NgFor],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  // precisa ser público porque o template acessa
  store = inject(StoreService);

  // charts
  @ViewChild('lineCanvas') lineCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas')  barCanvas?: ElementRef<HTMLCanvasElement>;
  private lineChart?: Chart;
  private barChart?: Chart;

  // métricas
  totalProdutos   = signal(0);
  totalEstoque    = signal(0);
  baixoEstoque    = signal(0);
  pertoVencimento = signal(0);

  // expõe ao template (tipado, evita 'unknown')
  get movs(): Movimento[] { return this.store.movements(); }

  constructor() {
    // recalcula quando estado mudar
    effect(() => {
      const prods = this.store.products();
      const _movs = this.store.movements();

      this.totalProdutos.set(prods.length);
      let estoque = 0;
      for (const p of prods) estoque += this.store.stockOf(p.id);
      this.totalEstoque.set(estoque);
      this.baixoEstoque.set(this.store.lowStock().length);
      this.pertoVencimento.set(this.store.nearExpiration(10).length);

      this.updateCharts();
    });
  }

  ngAfterViewInit() {
    this.createCharts();
  }

  ngOnDestroy() {
    this.lineChart?.destroy();
    this.barChart?.destroy();
  }

  private getCssVar(v: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  private createCharts() {
    if (!this.lineCanvas || !this.barCanvas) return;

    const accent   = this.getCssVar('--accent')   || '#F1A340';
    const accent2  = this.getCssVar('--accent-2') || '#78B68D';
    const ink      = this.getCssVar('--ink')      || '#2B2018';

    // Entradas x Saídas (linha)
    const lctx = this.lineCanvas.nativeElement.getContext('2d')!;
    const lgrad = lctx.createLinearGradient(0, 0, 0, 260);
    lgrad.addColorStop(0, accent + '55');
    lgrad.addColorStop(1, '#ffffff00');

    const sgrad = lctx.createLinearGradient(0, 0, 0, 260);
    sgrad.addColorStop(0, accent2 + '55');
    sgrad.addColorStop(1, '#ffffff00');

    this.lineChart = new Chart(lctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label: 'Entradas', data: [], fill: true, backgroundColor: lgrad, borderColor: accent, tension: .35 },
        { label: 'Saídas',   data: [], fill: true, backgroundColor: sgrad, borderColor: accent2, tension: .35 }
      ]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: ink + 'cc' }, grid: { display: false } },
          y: { ticks: { color: ink + '99' }, grid: { color: '#f0e4d4' } }
        },
        plugins: {
          legend: { labels: { color: ink } },
          tooltip: { backgroundColor: '#2b2018', titleColor: '#fff', bodyColor: '#fff' }
        }
      }
    });

    // Top Saídas (barra)
    const bctx = this.barCanvas.nativeElement.getContext('2d')!;
    this.barChart = new Chart(bctx, {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Mais vendidos/consumo', data: [], backgroundColor: [accent, accent, accent, accent2, accent2] }
      ]},
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: ink + 'cc' }, grid: { display: false } },
          y: { ticks: { color: ink + '99' }, grid: { color: '#f0e4d4' } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#2b2018', titleColor: '#fff', bodyColor: '#fff' }
        }
      }
    });

    this.updateCharts();
  }

  private updateCharts() {
    if (!this.lineChart || !this.barChart) return;

    const today = new Date(); today.setHours(0,0,0,0);
    const labels: string[] = [];
    const entradas: number[] = [];
    const saidas: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0,10);
      labels.push(d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }));

      const ins  = this.store.movements()
        .filter((m: Movimento) => m.dataISO.slice(0,10) === key && m.tipo === 'in')
        .reduce((s: number, m: Movimento) => s + m.quantidade, 0);

      const outs = this.store.movements()
        .filter((m: Movimento) => m.dataISO.slice(0,10) === key && m.tipo === 'out')
        .reduce((s: number, m: Movimento) => s + m.quantidade, 0);

      entradas.push(ins);
      saidas.push(outs);
    }

    this.lineChart.data.labels = labels;
    this.lineChart.data.datasets[0].data = entradas;
    this.lineChart.data.datasets[1].data = saidas;
    this.lineChart.update();

    // top 5 saídas
    const outByProd = new Map<string, number>();
    for (const m of this.store.movements()) {
      if (m.tipo !== 'out') continue;
      outByProd.set(m.productId, (outByProd.get(m.productId) ?? 0) + m.quantidade);
    }

    const pairs = [...outByProd.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
    const labelsBar = pairs.map(([pid]) => this.store.products().find((p: Produto) => p.id === pid)?.nome ?? '—');
    const dataBar   = pairs.map(([,q]) => q);

    this.barChart.data.labels = labelsBar;
    this.barChart.data.datasets[0].data = dataBar;
    this.barChart.update();
  }

  // ===== Dados de exemplo (opcional) =====
  seed() {
    if (this.store.products().length) return;

    const now = new Date();
    const addDays = (n:number) => { const d = new Date(now); d.setDate(d.getDate()+n); return d.toISOString(); };

    this.store.addProduct({ nome:'Arroz 5kg',  unidade:'kg', minimo:10, preco:22.9, categoria:'Mercearia' });
    this.store.addProduct({ nome:'Feijão 1kg', unidade:'kg', minimo:12, preco:9.9,  categoria:'Mercearia' });
    this.store.addProduct({ nome:'Leite 1L',   unidade:'l',  minimo:18, preco:4.5,  categoria:'Laticínios' });
    this.store.addProduct({ nome:'Ovos 12un',  unidade:'un', minimo:8,  preco:16.0, categoria:'Frios' });
    this.store.addProduct({ nome:'Maçã kg',    unidade:'kg', minimo:6,  preco:7.9,  categoria:'Hortifruti' });

    const [arroz, feijao, leite, ovos, maca] = this.store.products();

    // entradas
    this.store.addMovement({ productId: arroz.id, tipo:'in', quantidade:40, dataISO: addDays(-25), precoUnitario:20, validadeLote: addDays(60) });
    this.store.addMovement({ productId: feijao.id,tipo:'in', quantidade:45, dataISO: addDays(-24), precoUnitario:8,  validadeLote: addDays(90) });
    this.store.addMovement({ productId: leite.id, tipo:'in', quantidade:60, dataISO: addDays(-10), precoUnitario:3.8,validadeLote: addDays(15) });
    this.store.addMovement({ productId: ovos.id,  tipo:'in', quantidade:30, dataISO: addDays(-8),  precoUnitario:14, validadeLote: addDays(12) });
    this.store.addMovement({ productId: maca.id,  tipo:'in', quantidade:25, dataISO: addDays(-5),  precoUnitario:6.5, validadeLote: addDays(7)  });

    // saídas
    this.store.addMovement({ productId: arroz.id, tipo:'out', quantidade:18, dataISO: addDays(-3),  motivo:'sale' });
    this.store.addMovement({ productId: feijao.id,tipo:'out', quantidade:15, dataISO: addDays(-2),  motivo:'sale' });
    this.store.addMovement({ productId: leite.id, tipo:'out', quantidade:28, dataISO: addDays(-1),  motivo:'sale' });
    this.store.addMovement({ productId: ovos.id,  tipo:'out', quantidade:12, dataISO: addDays(-1),  motivo:'sale' });
    this.store.addMovement({ productId: maca.id,  tipo:'out', quantidade:10, dataISO: addDays(-1),  motivo:'waste' });
  }

  // nome do produto por id
  nomeDe(id: string) {
    return this.store.products().find((p: Produto) => p.id === id)?.nome ?? '—';
  }
}
