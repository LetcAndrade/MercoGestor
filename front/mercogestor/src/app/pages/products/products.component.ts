import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Produto } from '../../core/store.service';

type StatusFiltro = 'all' | 'ok' | 'low' | 'empty';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.scss']
})
export class ProductsComponent {
  store = inject(StoreService);

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

  // categorias dinâmicas
  categorias = computed(() => {
    const set = new Set(this.store.products().map(p => p.categoria || '').filter(Boolean));
    return Array.from(set).sort();
  });

  // lista filtrada
  list = computed(() => {
    const q = this.busca().toLowerCase().trim();
    const c = this.cat();
    const st = this.status();
    return this.store.products().filter(p => {
      const estoque = this.store.stockOf(p.id);
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
    if (confirm(`Remover "${p.nome}"?`)) this.store.removeProduct(p.id);
  }
  salvar() {
    const f = this.form();
    if (!f.nome.trim()) return;

    if (this.editing()) {
      this.store.updateProduct(this.editing()!.id, {
        nome: f.nome.trim(), categoria: f.categoria.trim(),
        unidade: f.unidade, minimo: Number(f.minimo) || 0,
        preco: f.preco ? Number(f.preco) : undefined
      });
    } else {
      this.store.addProduct({
        nome: f.nome.trim(), categoria: f.categoria.trim(),
        unidade: f.unidade, minimo: Number(f.minimo) || 0,
        preco: f.preco ? Number(f.preco) : undefined
      });
    }
    this.cancelar();
  }
  cancelar() {
    this.showForm.set(false);
    this.editing.set(null);
  }

  // helpers de view
  estoqueDe(p: Produto) { return this.store.stockOf(p.id); }
  statusDe(p: Produto): StatusFiltro {
    const s = this.estoqueDe(p);
    if (s <= 0) return 'empty';
    if (s <= p.minimo) return 'low';
    return 'ok';
  }
}
