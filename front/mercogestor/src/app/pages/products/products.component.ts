import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Produto, Movimento } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { ConfirmService } from '../../core/confirm.service';

type StatusFiltro = 'all' | 'ok' | 'low' | 'empty';

type FormModel = {
  nome: string;
  categoria: string;
  unidade: string;
  minimo: number;
  preco?: number;
  estoqueInicial?: number;  // novo no cadastro
  ajusteEstoque?: number;   // ajuste na edição (pode ser negativo)
};

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  // dados principais
  produtos = signal<Produto[]>([]);
  movimentos = signal<Movimento[]>([]);

  // filtros
  busca = signal('');
  cat = signal<string>('');           // categoria
  status = signal<StatusFiltro>('all');

  // modal form
  showForm = signal(false);
  editing = signal<Produto | null>(null);

  // model do formulário
  form = signal<FormModel>({
    nome: '',
    categoria: '',
    unidade: 'un',
    minimo: 0,
    preco: undefined,
    estoqueInicial: 0,
    ajusteEstoque: 0
  });

  ngOnInit() {
    this.carregar();
    this.carregarMovimentos();
  }

  // ===== carregamento =====
  carregar() {
    this.api.listProducts().subscribe({
      next: xs => this.produtos.set(xs),
      error: () => this.toast.error('Falha ao carregar produtos.')
    });
  }
  carregarMovimentos() {
    this.api.listMovements().subscribe({
      next: ms => this.movimentos.set(ms),
      error: () => this.toast.error('Falha ao carregar movimentos.')
    });
  }

  // categorias dinâmicas
  categorias = computed(() => {
    const set = new Set(this.produtos().map(p => p.categoria || '').filter(Boolean));
    return Array.from(set).sort();
  });

  // estoque por produto
  private estoqueMap = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.movimentos()) {
      const key = String(m.productId);
      const prev = map.get(key) ?? 0;
      const delta = m.tipo === 'in' ? m.quantidade : -m.quantidade;
      map.set(key, prev + (Number(delta) || 0));
    }
    return map;
  });

  // lista filtrada
  list = computed(() => {
    const q = this.busca().toLowerCase().trim();
    const c = this.cat();
    const st = this.status();
    return this.produtos().filter(p => {
      const estoque = this.estoqueDe(p);
      const okName = !q || p.nome.toLowerCase().includes(q);
      const okCat  = !c || (p.categoria || '') === c;

      let okStatus = true;
      if (st === 'ok')    okStatus = estoque > p.minimo;
      if (st === 'low')   okStatus = estoque > 0 && estoque <= p.minimo;
      if (st === 'empty') okStatus = estoque <= 0;

      return okName && okCat && okStatus;
    });
  });

  // ===== ações =====
  novo() {
    this.editing.set(null);
    this.form.set({
      nome: '',
      categoria: '',
      unidade: 'un',
      minimo: 0,
      preco: undefined,
      estoqueInicial: 0,   // visível no cadastro
      ajusteEstoque: 0     // não usado no cadastro
    });
    this.showForm.set(true);
  }

  editar(p: Produto) {
    this.editing.set(p);
    this.form.set({
      nome: p.nome,
      categoria: p.categoria || '',
      unidade: p.unidade,
      minimo: p.minimo,
      preco: p.preco,
      estoqueInicial: 0, // não usado em edição
      ajusteEstoque: 0   // usuário informa +/- na edição
    });
    this.showForm.set(true);
  }

  excluir(p: Produto) {
    this.confirm.ask(`Remover "${p.nome}"?`, {
      confirmText: 'Remover',
      variant: 'danger'
    }).then(ok => {
      if (!ok) return;
      this.api.deleteProduct(String(p.id)).subscribe({
        next: () => { this.toast.success('Produto removido!'); this.carregar(); this.carregarMovimentos(); },
        error: err => this.toast.error(err?.error?.error || 'Erro ao remover produto.')
      });
    });
  }

  salvar() {
    const f = this.form();
    if (!f.nome.trim()) { this.toast.error('Informe o nome do produto.'); return; }

    const isEdit = !!this.editing();
    const base: Produto = {
      id: this.editing()?.id,
      nome: f.nome.trim(),
      categoria: f.categoria.trim(),
      unidade: f.unidade,
      minimo: Number(f.minimo) || 0,
      preco: f.preco !== undefined ? Number(f.preco) : undefined
    };

    // Envia junto: estoqueInicial (no create). Em edição, ajuste é movimento separado.
    const payload: any = isEdit
      ? { ...base }
      : { ...base, estoqueInicial: Math.max(0, Number(f.estoqueInicial || 0)) };

    this.api.saveProduct(payload).subscribe({
      next: (res: any) => {
        // id do produto (cobre diferentes formatos de resposta)
        const productId =
          this.editing()?.id ??
          res?.id ??
          res?.productId ??
          res?.product?.id ??
          payload?.id;

        const after = () => {
          this.toast.success(isEdit ? 'Produto atualizado!' : 'Produto adicionado!');
          this.cancelar();
          this.carregar();
          this.carregarMovimentos();
        };

        // Em edição: se ajusteEstoque ≠ 0, cria movimento
        if (isEdit) {
          const ajuste = Number(f.ajusteEstoque || 0);
          if (productId && ajuste !== 0) {
            const iso = new Date().toISOString();
            this.api.addMovement({
              productId: String(productId),
              tipo: ajuste > 0 ? 'in' : 'out',
              quantidade: Math.abs(ajuste),
              data: iso
            }).subscribe({
              next: () => after(),
              error: () => after()
            });
            return;
          }
        }
        after();
      },
      error: err => this.toast.error(err?.error?.error || 'Erro ao salvar produto.')
    });
  }

  cancelar() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  setStatus(val: string) {
    this.status.set(val as StatusFiltro);
  }

  // helpers
  patchForm<K extends keyof FormModel>(key: K, val: FormModel[K]) {
    this.form.update(f => ({ ...f, [key]: val }));
  }
  estoqueDe(p: Produto) { return this.estoqueMap().get(String(p.id)) ?? 0; }

  estoqueAtual() {
    const p = this.editing();
    return p ? this.estoqueDe(p) : 0;
  }
  estoquePrevisto() {
    const atual = this.estoqueAtual();
    const delta = Number(this.form().ajusteEstoque || 0);
    return atual + delta;
  }

  statusDe(p: Produto): StatusFiltro {
    const s = this.estoqueDe(p);
    if (s <= 0) return 'empty';
    if (s <= p.minimo) return 'low';
    return 'ok';
  }
}
