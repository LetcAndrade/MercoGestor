import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Produto, Movimento } from '../../core/api.service';

type LotStatus = 'ok' | 'nearExpiry' | 'expired' | 'empty';

interface LotView {
  id: string;
  productId: string | number;
  produto: Produto;
  dataEntradaISO: string;
  validadeISO?: string;
  precoUnitario?: number;
  quantidadeInicial: number;
  saldo: number;
  diasParaVencer?: number;
  status: LotStatus;
}

@Component({
  selector: 'app-lots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lots.component.html',
  styleUrls: ['./lots.component.scss']
})
export class LotsComponent {
  private api = inject(ApiService);

  private _produtos = signal<Produto[]>([]);
  private _movimentos = signal<Movimento[]>([]);

  // filtros
  produtoId = signal<string>('');   // produto específico
  diasNear  = signal<number>(30);   // quantos dias considerar "perto de vencer"

  // mensagens / loading
  loading = signal<boolean>(false);
  erro    = signal<string>('');

  ngOnInit() {
    this.carregar();
  }

  private carregar() {
    this.loading.set(true);
    this.erro.set('');

    this.api.listProducts().subscribe({
      next: prods => {
        this._produtos.set(prods);
        this.api.listMovements().subscribe({
          next: movs => {
            this._movimentos.set(movs);
            this.loading.set(false);
          },
          error: err => {
            console.error(err);
            this.erro.set('Falha ao carregar movimentações.');
            this.loading.set(false);
          }
        });
      },
      error: err => {
        console.error(err);
        this.erro.set('Falha ao carregar produtos.');
        this.loading.set(false);
      }
    });
  }

  // produtos para o filtro (ordenados)
  prods = computed<Produto[]>(() =>
    this._produtos().slice().sort((a, b) => a.nome.localeCompare(b.nome))
  );

  // ======= Cálculo de lotes =======

  lots = computed<LotView[]>(() => {
    const produtos = this._produtos();
    const movimentos = this._movimentos();
    const filtroPid = this.produtoId();
    const diasNear = this.diasNear();

    const lotes: LotView[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const p of produtos) {
      const pidKey = String(p.id ?? '');
      if (!pidKey) continue;
      if (filtroPid && filtroPid !== pidKey) continue;

      const movs = movimentos.filter(m => String(m.productId) === pidKey);
      if (!movs.length) continue;

      const entradas = movs
        .filter(m => m.tipo === 'in')
        .slice()
        .sort((a, b) => {
          const da = this.dataValidadeOuEntrada(a);
          const db = this.dataValidadeOuEntrada(b);
          return da.getTime() - db.getTime();
        });

      const saidas = movs
        .filter(m => m.tipo === 'out')
        .slice()
        .sort((a, b) => {
          const da = this.dataMov(a);
          const db = this.dataMov(b);
          return da.getTime() - db.getTime();
        });

      if (!entradas.length) continue;

      // cria estado de lote para cada entrada
      const estados = entradas.map<LotView>(m => {
        const dataEnt = this.dataMov(m);
        const validadeISO = (m as any).validadeLote as string | undefined;
        const precoUnit = (m as any).precoUnitario as number | undefined;
        const qtd = Number(m.quantidade) || 0;

        const lot: LotView = {
          id: String(m.id ?? `${pidKey}-${dataEnt.toISOString()}`),
          productId: p.id!,
          produto: p,
          dataEntradaISO: dataEnt.toISOString(),
          validadeISO,
          precoUnitario: precoUnit,
          quantidadeInicial: qtd,
          saldo: qtd,
          diasParaVencer: undefined,
          status: 'ok'
        };

        this.atualizarStatusLote(lot, now, diasNear);
        return lot;
      });

      // aloca saídas (FEFO/FIFO: consome sempre do lote mais antigo com saldo)
      for (const s of saidas) {
        let qty = Number(s.quantidade) || 0;
        while (qty > 0) {
          const alvo = estados.find(l => l.saldo > 0);
          if (!alvo) break;
          const take = Math.min(alvo.saldo, qty);
          alvo.saldo -= take;
          qty -= take;
        }
      }

      // reavalia status com saldo final
      for (const l of estados) {
        this.atualizarStatusLote(l, now, diasNear);
        // se não quiser mostrar lotes zerados, comente esse if e continue
        lotes.push(l);
      }
    }

    // ordena: produto, validade, data de entrada
    return lotes.sort((a, b) => {
      const np = a.produto.nome.localeCompare(b.produto.nome);
      if (np !== 0) return np;
      const va = a.validadeISO ? new Date(a.validadeISO).getTime() : 0;
      const vb = b.validadeISO ? new Date(b.validadeISO).getTime() : 0;
      if (va !== vb) return va - vb;
      return new Date(a.dataEntradaISO).getTime() - new Date(b.dataEntradaISO).getTime();
    });
  });

  // KPIs rápidos
  kTotalLotes   = computed(() => this.lots().length);
  kComSaldo     = computed(() => this.lots().filter(l => l.saldo > 0).length);
  kVencidos     = computed(() => this.lots().filter(l => l.status === 'expired').length);
  kPertoVencer  = computed(() => this.lots().filter(l => l.status === 'nearExpiry').length);

  // Sugestão de reposição:
  // produto com saldo total < minimo OU lote mais próximo vencendo em <= diasNear
  sugestoes = computed(() => {
    const diasNear = this.diasNear();
    const lots = this.lots();
    const map = new Map<string, { produto: Produto; saldo: number; menorDias?: number }>();

    for (const l of lots) {
      const key = String(l.productId);
      const entry = map.get(key) ?? { produto: l.produto, saldo: 0, menorDias: undefined };
      entry.saldo += l.saldo;
      if (typeof l.diasParaVencer === 'number') {
        if (entry.menorDias == null || l.diasParaVencer < entry.menorDias) {
          entry.menorDias = l.diasParaVencer;
        }
      }
      map.set(key, entry);
    }

    const res: { produto: Produto; saldo: number; minimo: number; dias?: number }[] = [];
    for (const [, v] of map) {
      const minimo = Number(v.produto.minimo) || 0;
      const precisaPorSaldo = v.saldo < minimo;
      const precisaPorVal   = v.menorDias != null && v.menorDias <= diasNear;
      if (precisaPorSaldo || precisaPorVal) {
        res.push({ produto: v.produto, saldo: v.saldo, minimo, dias: v.menorDias });
      }
    }
    return res.sort((a, b) => a.produto.nome.localeCompare(b.produto.nome));
  });

  // ========= Helpers de data/status =========

  private dataMov(m: Movimento): Date {
    const anyM = m as any;
    const iso = anyM.dataISO || anyM.data || anyM.date;
    if (iso) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    // fallback no "agora"
    return new Date();
  }

  private dataValidadeOuEntrada(m: Movimento): Date {
    const anyM = m as any;
    if (anyM.validadeLote) {
      const d = new Date(anyM.validadeLote);
      if (!isNaN(d.getTime())) return d;
    }
    return this.dataMov(m);
  }

  private atualizarStatusLote(l: LotView, today: Date, diasNear: number) {
    if (l.saldo <= 0) {
      l.status = 'empty';
      l.diasParaVencer = undefined;
      return;
    }
    if (!l.validadeISO) {
      l.status = 'ok';
      l.diasParaVencer = undefined;
      return;
    }
    const d = new Date(l.validadeISO);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    l.diasParaVencer = diff;

    if (diff < 0) {
      l.status = 'expired';
    } else if (diff <= diasNear) {
      l.status = 'nearExpiry';
    } else {
      l.status = 'ok';
    }
  }

  // ====== bind do input de dias (template) ======
  setDias(v: any) {
    const n = Number(v);
    this.diasNear.set(!Number.isNaN(n) && n > 0 ? Math.floor(n) : 1);
  }

  // ====== exportação CSV ======
  exportCsv() {
    const rows: string[][] = [
      ['Produto','Validade','Entrada','Qtd. inicial','Saldo','Dias p/ vencer','Status','Preço unit.']
    ];

    for (const l of this.lots()) {
      rows.push([
        l.produto.nome,
        l.validadeISO ? new Date(l.validadeISO).toLocaleDateString() : '',
        new Date(l.dataEntradaISO).toLocaleDateString(),
        String(l.quantidadeInicial),
        String(l.saldo),
        l.diasParaVencer != null ? String(l.diasParaVencer) : '',
        this.statusLabel(l.status),
        l.precoUnitario != null ? String(l.precoUnitario) : ''
      ]);
    }

    const csv = rows
      .map(r => r.map(v => `"${(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lotes.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  statusLabel(s: LotStatus): string {
    if (s === 'nearExpiry') return 'Perto de vencer';
    if (s === 'expired')    return 'Vencido';
    if (s === 'empty')      return 'Zerado';
    return 'OK';
  }
}
