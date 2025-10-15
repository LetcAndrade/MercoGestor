import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService, Movimento, MovimentoTipo, Produto } from '../../core/store.service';

type TipoFiltro = 'all' | 'in' | 'out';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './movements.component.html',
  styleUrls: ['./movements.component.scss']
})
export class MovementsComponent {
  store = inject(StoreService);

  // ===== filtros
  busca = signal('');
  tipo  = signal<TipoFiltro>('all');
  de    = signal<string>(''); // YYYY-MM-DD
  ate   = signal<string>('');

  prods = computed<Produto[]>(() => this.store.products());

  // lista filtrada (mais recentes primeiro)
  list = computed<Movimento[]>(() => {
    const q   = this.busca().toLowerCase().trim();
    const t   = this.tipo();
    const dDe = this.de();
    const dAte= this.ate();

    const inRange = (iso: string) => {
      const ymd = iso.slice(0,10);
      if (dDe && ymd < dDe) return false;
      if (dAte && ymd > dAte) return false;
      return true;
    };

    return this.store.movements()
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

  // ===== modal / formulário
  showForm = signal(false);
  formTipo = signal<MovimentoTipo>('in');
  form = signal<{
    productId: string;
    quantidade: number | null;
    data: string;             // YYYY-MM-DD
    precoUnitario?: number | null;
    validadeLote?: string;    // YYYY-MM-DD
    motivo?: 'sale'|'waste'|'adjust'|'';
  }>({ productId:'', quantidade:null, data: this.hojeYMD(), precoUnitario:null, validadeLote:'', motivo:'' });

  erro = signal<string>('');

  hojeYMD() {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().slice(0,10);
  }

  abrir(tipo: MovimentoTipo) {
    this.formTipo.set(tipo);
    this.form.set({ productId:'', quantidade:null, data:this.hojeYMD(), precoUnitario:null, validadeLote:'', motivo:'' });
    this.erro.set('');
    this.showForm.set(true);
  }
  fechar() { this.showForm.set(false); }

  salvar() {
    const t = this.formTipo();
    const f = this.form();

    // validações simples
    if (!f.productId) return this.erro.set('Selecione um produto.');
    const qtd = Number(f.quantidade || 0);
    if (qtd <= 0) return this.erro.set('Informe uma quantidade válida.');

    // saída: checa estoque
    if (t === 'out') {
      const stock = this.store.stockOf(f.productId);
      if (qtd > stock) return this.erro.set(`Estoque insuficiente (em estoque: ${stock}).`);
      this.store.addMovement({
        productId: f.productId,
        tipo: 'out',
        quantidade: qtd,
        dataISO: new Date(f.data + 'T00:00:00').toISOString(),
        motivo: (f.motivo || 'sale')
      });
    } else {
      this.store.addMovement({
        productId: f.productId,
        tipo: 'in',
        quantidade: qtd,
        dataISO: new Date(f.data + 'T00:00:00').toISOString(),
        precoUnitario: f.precoUnitario ? Number(f.precoUnitario) : undefined,
        validadeLote:  f.validadeLote ? new Date(f.validadeLote + 'T00:00:00').toISOString() : undefined
      });
    }
    this.fechar();
  }

  remover(m: Movimento) {
    if (confirm('Remover movimentação?')) this.store.removeMovement(m.id);
  }

  // helpers
  nomeDe(id: string) {
    return this.store.products().find((p: Produto) => p.id === id)?.nome ?? '—';
  }
  estoqueDe(id: string) { return this.store.stockOf(id); }
}
