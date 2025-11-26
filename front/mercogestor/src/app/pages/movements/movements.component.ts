import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Movimento, MovimentoTipo, Produto, MovimentoCreate } from '../../core/api.service';
import { AlertService } from '../../core/alert.service';

type TipoFiltro = 'all' | 'in' | 'out';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.scss']
})
export class MovementsComponent {
  private api = inject(ApiService);
  private alerts = inject(AlertService);

  // dados do backend
  private _produtos = signal<Produto[]>([]);
  private _movimentos = signal<Movimento[]>([]);

  // filtros (signals)
  busca = signal('');
  tipo  = signal<TipoFiltro>('all');
  de    = signal<string>(''); // YYYY-MM-DD
  ate   = signal<string>('');

  prods = computed<Produto[]>(() => this._produtos());

  ngOnInit() {
    this.loadProducts();
    this.loadMovements();
  }

  private loadProducts() {
    this.api.listProducts().subscribe({
      next: xs => this._produtos.set(xs),
      error: err => console.error('Erro ao carregar produtos', err)
    });
  }

  private loadMovements() {
    this.api.listMovements().subscribe({
      next: ms => {
        this._movimentos.set(ms);
        // atualiza alertas sempre que recarregar movimentações
        this.alerts.refresh();
      },
      error: err => console.error('Erro ao carregar movimentos', err)
    });
  }

  // lista filtrada
  list = computed<Movimento[]>(() => {
    const q   = this.busca().toLowerCase().trim();
    const t   = this.tipo();
    const dDe = this.de();
    const dAte= this.ate();

    const inRange = (iso?: string | null) => {
      const ymd = (iso ?? '').slice(0,10);
      if (!ymd) return false;
      if (dDe && ymd < dDe) return false;
      if (dAte && ymd > dAte) return false;
      return true;
    };

    return this._movimentos()
      .filter(m => {
        if (t !== 'all' && m.tipo !== t) return false;
        if (!inRange(m.dataISO)) return false;
        if (q) {
          const nome = this.nomeDe(m.productId).toLowerCase();
          if (!nome.includes(q)) return false;
        }
        return true;
      });
  });

  // ===== modal / formulário =====
  showForm = signal(false);
  formTipo = signal<MovimentoTipo>('in');
  form = signal<{
    productId: string;
    quantidade: number | null;
    data: string;             // YYYY-MM-DD
    precoUnitario?: number | null;
    validadeLote?: string;    // YYYY-MM-DD
    motivo?: 'sale'|'waste'|'adjust'|'';
  }>({
    productId: '',
    quantidade: null,
    data: hojeYMD(),
    precoUnitario: null,
    validadeLote: '',
    motivo: 'sale'
  });

  erro = signal<string>('');

  abrir(tipo: MovimentoTipo) {
    this.formTipo.set(tipo);
    this.form.set({
      productId: '',
      quantidade: null,
      data: hojeYMD(),
      precoUnitario: null,
      validadeLote: '',
      motivo: 'sale'
    });
    this.erro.set('');
    this.showForm.set(true);
  }

  fechar() {
    this.showForm.set(false);
  }

  salvar() {
    const t = this.formTipo();
    const f = this.form();

    if (!f.productId) return this.erro.set('Selecione um produto.');
    const qtd = Number(f.quantidade || 0);
    if (qtd <= 0) return this.erro.set('Informe uma quantidade válida.');

    // valida saída com estoque
    if (t === 'out') {
      const stock = this.estoqueDe(f.productId);
      if (qtd > stock) return this.erro.set(`Estoque insuficiente (em estoque: ${stock}).`);
    }

    const iso = new Date(f.data + 'T00:00:00').toISOString();

    const payload: MovimentoCreate = {
      productId: f.productId,
      tipo: t,
      quantidade: qtd,
      data: iso,
    };

    if (t === 'in') {
      if (f.precoUnitario != null && f.precoUnitario !== undefined) {
        payload.precoUnitario = Number(f.precoUnitario);
      }
      if (f.validadeLote) {
        payload.validadeLote = f.validadeLote;
      }
    } else {
      payload.motivo = f.motivo || 'sale';
    }

    this.api.addMovement(payload).subscribe({
      next: () => {
        this.fechar();
        this.loadMovements();    // já chama alerts.refresh() internamente
      },
      error: err => {
        console.error(err);
        this.erro.set('Erro ao salvar movimentação.');
      }
    });
  }

  remover(m: Movimento) {
    if (!m.id) return;
    if (!confirm('Remover movimentação?')) return;

    this.api.deleteMovement(String(m.id)).subscribe({
      next: () => this.loadMovements(), // atualiza lista + alertas
      error: err => {
        console.error(err);
        alert('Erro ao remover movimentação.');
      }
    });
  }

  // ===== helpers =====

  nomeDe(id: string | number | undefined): string {
    const key = String(id ?? '');
    if (!key) return '—';
    return this._produtos().find(p => String(p.id) === key)?.nome ?? '—';
  }

  estoqueDe(id: string | number | undefined): number {
    const key = String(id ?? '');
    if (!key) return 0;
    return this._movimentos()
      .filter(m => String(m.productId) === key)
      .reduce(
        (s, m) => s + (m.tipo === 'in' ? m.quantidade : -m.quantidade),
        0
      );
  }
}

// helper fora da classe, reaproveitado
function hojeYMD() {
  const d = new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
