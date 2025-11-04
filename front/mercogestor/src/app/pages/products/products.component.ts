import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, Produto, Movimento } from '../../core/api';

type StatusFiltro = 'all' | 'ok' | 'low' | 'empty';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent {
  private api = inject(Api);

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
  form = signal<{nome:string; categoria:string; unidade:string; minimo:number; preco?:number}>({
    nome: '', categoria: '', unidade: 'un', minimo: 0, preco: undefined
  });

  ngOnInit() {
    this.carregar();
    this.carregarMovimentos();
  }

  // ===== carregamento =====
  carregar() {
    this.api.listProducts().subscribe(xs => this.produtos.set(xs));
  }
  carregarMovimentos() {
    this.api.listMovements().subscribe(ms => this.movimentos.set(ms));
  }

  // categorias dinâmicas
  categorias = computed(() => {
    const set = new Set(this.produtos().map(p => p.categoria || '').filter(Boolean));
    return Array.from(set).sort();
  });

  // mapa de estoque por produto (soma entradas - saídas)
  private estoqueMap = computed(() => {
    const map = new Map<string | number, number>();
    for (const m of this.movimentos()) {
      const key = m.productId;
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
    this.form.set({ nome:'', categoria:'', unidade:'un', minimo:0, preco:undefined });
    this.showForm.set(true);
  }
  editar(p: Produto) {
    this.editing.set(p);
    this.form.set({ nome:p.nome, categoria:p.categoria || '', unidade:p.unidade, minimo:p.minimo, preco:p.preco });
    this.showForm.set(true);
  }
  excluir(p: Produto) {
    if (!confirm(`Remover "${p.nome}"?`)) return;
    this.api.deleteProduct(String(p.id)).subscribe(() => this.carregar());
  }
  salvar() {
    const f = this.form();
    if (!f.nome.trim()) return;

    const payload: Produto = {
      id: this.editing()?.id,
      nome: f.nome.trim(),
      categoria: f.categoria.trim(),
      unidade: f.unidade,
      minimo: Number(f.minimo) || 0,
      preco: f.preco ? Number(f.preco) : undefined
    };

    this.api.saveProduct(payload).subscribe(() => {
      this.cancelar();
      this.carregar();
    });
  }
  cancelar() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  // helpers de view (compatíveis com seu template atual)
  estoqueDe(p: Produto) { return this.estoqueMap().get(p.id!) ?? 0; }
  statusDe(p: Produto): StatusFiltro {
    const s = this.estoqueDe(p);
    if (s <= 0) return 'empty';
    if (s <= p.minimo) return 'low';
    return 'ok';
  }
}
