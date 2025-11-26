import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule, DatePipe, NgIf, NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';
import Chart from 'chart.js/auto';
import { ApiService, Produto, Movimento } from '../../core/api.service';

type DashMov = Movimento & {
  dataISO: string;            // sempre normalizado para ISO
  precoUnitario?: number;
  validadeLote?: string;
  motivo?: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, NgIf, NgFor],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);

  // dados da API
  private _produtos = signal<Produto[]>([]);
  private _movimentos = signal<DashMov[]>([]);

  // métricas usadas no template
  totalProdutos   = signal(0);
  totalEstoque    = signal(0);
  baixoEstoque    = signal(0);
  pertoVencimento = signal(0);

  // exposto ao template (movimentações recentes)
  get movs(): DashMov[] { return this._movimentos(); }

  // charts
  @ViewChild('lineCanvas') lineCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas')  barCanvas?: ElementRef<HTMLCanvasElement>;
  private lineChart?: Chart;
  private barChart?: Chart;

  // ===== ciclo de vida =====
  ngOnInit() {
    this.loadProducts();
    this.loadMovements();
  }

  ngAfterViewInit() {
    this.createCharts();
    // recalc quando os gráficos já existem
    this.recomputeAll();
  }

  ngOnDestroy() {
    this.lineChart?.destroy();
    this.barChart?.destroy();
  }

  // ===== carregamento API =====
  private loadProducts() {
    this.api.listProducts().subscribe({
      next: xs => {
        this._produtos.set(xs || []);
        console.log('[Dashboard] produtos carregados:', xs);
        this.recomputeAll();
      },
      error: err => console.error('Erro ao carregar produtos no dashboard', err)
    });
  }

  private loadMovements() {
    this.api.listMovements().subscribe({
      next: ms => {
        console.log('[Dashboard] movimentos brutos:', ms);

        const mapped: DashMov[] = (ms || []).map((m: any) => {
          const raw =
            m.dataISO ??
            m.data ??
            m.date ??
            m.createdAt ??
            m.created_at ??
            null;

          let iso: string;

          if (typeof raw === 'string') {
            iso = raw;
          } else if (raw && typeof raw === 'object') {
            // Firestore Timestamp { _seconds, _nanoseconds }
            if ('_seconds' in raw && typeof raw._seconds === 'number') {
              iso = new Date(raw._seconds * 1000).toISOString();
            } else if (typeof (raw as any).toDate === 'function') {
              iso = (raw as any).toDate().toISOString();
            } else {
              iso = new Date().toISOString();
            }
          } else {
            iso = new Date().toISOString();
          }

          return {
            ...m,
            dataISO: iso
          } as DashMov;
        });

        console.log('[Dashboard] movimentos normalizados:', mapped);
        this._movimentos.set(mapped);
        this.recomputeAll();
      },
      error: err => console.error('Erro ao carregar movimentações no dashboard', err)
    });
  }

  // ===== recomputar KPIs + gráficos =====
  private recomputeAll() {
    const prods = this._produtos();
    const movs  = this._movimentos();

    // total de produtos
    this.totalProdutos.set(prods.length);

    // estoque total + quantidade de produtos com estoque baixo/esgotado
    let totalEst = 0;
    let lowCount = 0;
    for (const p of prods) {
      const est = this.stockOf(p.id);
      totalEst += est;
      if (est <= 0 || est <= p.minimo) lowCount++;
    }
    this.totalEstoque.set(totalEst);
    this.baixoEstoque.set(lowCount);

    // produtos com validade próxima (10 dias)
    this.pertoVencimento.set(this.nearExpirationCount(10));

    // gráficos (só atualiza se já foram criados)
    this.updateCharts();
  }

  // ===== helpers de dados =====
  /** estoque atual de um produto a partir da lista de movimentos */
  private stockOf(id: string | number | undefined): number {
    const key = String(id ?? '');
    if (!key) return 0;
    return this._movimentos().reduce((s, m) => {
      if (String(m.productId) !== key) return s;
      return s + (m.tipo === 'in' ? m.quantidade : -m.quantidade);
    }, 0);
  }

  /** conta quantos produtos têm lote vencendo em até N dias */
  private nearExpirationCount(days: number): number {
    const now = new Date(); now.setHours(0,0,0,0);
    const limit = new Date(now); limit.setDate(limit.getDate() + days);

    const ids = new Set<string>();
    for (const m of this._movimentos()) {
      const raw = (m as any).validadeLote;
      if (!raw || m.tipo !== 'in') continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      if (d >= now && d <= limit) ids.add(String(m.productId));
    }
    return this._produtos().filter(p => ids.has(String(p.id))).length;
  }

  // nome do produto por id (tabela de recentes)
  nomeDe(id: string | number | undefined): string {
    const key = String(id ?? '');
    if (!key) return '—';
    return this._produtos().find(p => String(p.id) === key)?.nome ?? '—';
  }

  // ===== charts =====
  private getCssVar(v: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  private createCharts() {
    if (!this.lineCanvas || !this.barCanvas) return;

    const accent   = this.getCssVar('--accent')   || '#F1A340';
    const accent2  = this.getCssVar('--accent-2') || '#78B68D';
    const ink      = this.getCssVar('--ink')      || '#2B2018';

    // Linha: entradas x saídas
    const lctx = this.lineCanvas.nativeElement.getContext('2d')!;
    const lgrad = lctx.createLinearGradient(0, 0, 0, 260);
    lgrad.addColorStop(0, accent + '55');
    lgrad.addColorStop(1, '#ffffff00');

    const sgrad = lctx.createLinearGradient(0, 0, 0, 260);
    sgrad.addColorStop(0, accent2 + '55');
    sgrad.addColorStop(1, '#ffffff00');

    this.lineChart = new Chart(lctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Entradas', data: [], fill: true, backgroundColor: lgrad, borderColor: accent,  tension: .35 },
          { label: 'Saídas',   data: [], fill: true, backgroundColor: sgrad, borderColor: accent2, tension: .35 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: ink + 'cc' }, grid: { display: false } },
          y: { ticks: { color: ink + '99' }, grid: { color: '#f0e4d4' } }
        },
        plugins: {
          legend:  { labels: { color: ink } },
          tooltip: { backgroundColor: '#2b2018', titleColor: '#fff', bodyColor: '#fff' }
        }
      }
    });

    // Barra: top saídas
    const bctx = this.barCanvas.nativeElement.getContext('2d')!;
    this.barChart = new Chart(bctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          { label: 'Mais vendidos/consumo', data: [], backgroundColor: [accent, accent, accent, accent2, accent2] }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: ink + 'cc' }, grid: { display: false } },
          y: { ticks: { color: ink + '99' }, grid: { color: '#f0e4d4' } }
        },
        plugins: {
          legend:  { display: false },
          tooltip: { backgroundColor: '#2b2018', titleColor: '#fff', bodyColor: '#fff' }
        }
      }
    });
  }

  private updateCharts() {
    if (!this.lineChart || !this.barChart) return;

    const movs  = this._movimentos();
    const prods = this._produtos();

    const today = new Date(); today.setHours(0,0,0,0);
    const labels: string[] = [];
    const entradas: number[] = [];
    const saidas: number[] = [];

    // últimos 30 dias
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }));

      const ins  = movs
        .filter(m => m.dataISO.slice(0,10) === key && m.tipo === 'in')
        .reduce((s, m) => s + m.quantidade, 0);

      const outs = movs
        .filter(m => m.dataISO.slice(0,10) === key && m.tipo === 'out')
        .reduce((s, m) => s + m.quantidade, 0);

      entradas.push(ins);
      saidas.push(outs);
    }

    this.lineChart.data.labels = labels;
    this.lineChart.data.datasets[0].data = entradas;
    this.lineChart.data.datasets[1].data = saidas;
    this.lineChart.update();

    // top 5 saídas por produto
    const outByProd = new Map<string, number>();
    for (const m of movs) {
      if (m.tipo !== 'out') continue;
      const key = String(m.productId);
      outByProd.set(key, (outByProd.get(key) ?? 0) + m.quantidade);
    }

    const pairs = [...outByProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labelsBar = pairs.map(([pid]) =>
      prods.find(p => String(p.id) === pid)?.nome ?? '—'
    );
    const dataBar   = pairs.map(([, q]) => q);

    this.barChart.data.labels = labelsBar;
    this.barChart.data.datasets[0].data = dataBar;
    this.barChart.update();
  }

  // ===== seed (agora só um aviso) =====
  seed() {
    alert('Com o banco integrado, cadastre os produtos e movimentações nas telas próprias 😄');
  }
}
