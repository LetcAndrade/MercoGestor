import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import { StoreService, Movimento, Produto } from '../../core/store.service';

type TipoFiltro = 'all' | 'in' | 'out';
type Agrupar = 'day' | 'month';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements AfterViewInit, OnDestroy {
  store = inject(StoreService);

  // ===== filtros
  tipo = signal<TipoFiltro>('all');
  agrupar = signal<Agrupar>('day');
  de = signal<string>(this.hojeMenos(29)); // últimos 30 dias
  ate = signal<string>(this.hoje());
  produtoId = signal<string>('');

  // setters pro template
  setTipo(v: TipoFiltro){ this.tipo.set(v); }
  setAgrupar(v: Agrupar){ this.agrupar.set(v); }
  setDe(v: any){ this.de.set(String(v)); }
  setAte(v: any){ this.ate.set(String(v)); }
  setProdutoId(v: any){ this.produtoId.set(String(v)); }

  prods = computed<Produto[]>(() => this.store.products());

  // lista filtrada (respeita tipo, período e produto)
  lista = computed<Movimento[]>(() => {
    const t = this.tipo(); const d0 = this.de(); const d1 = this.ate(); const pid = this.produtoId();
    return this.store.movements().filter(m => {
      const ymd = m.dataISO.slice(0,10);
      if (t !== 'all' && m.tipo !== t) return false;
      if (d0 && ymd < d0) return false;
      if (d1 && ymd > d1) return false;
      if (pid && m.productId !== pid) return false;
      return true;
    });
  });

  // KPIs (quantidades)
  kEntradas = computed(() => this.lista().filter(m=>m.tipo==='in').reduce((s,m)=>s+m.quantidade,0));
  kSaidas   = computed(() => this.lista().filter(m=>m.tipo==='out').reduce((s,m)=>s+m.quantidade,0));
  kSaldo    = computed(() => this.kEntradas() - this.kSaidas());
  kMovs     = computed(() => this.lista().length);

  // ===== Charts
  @ViewChild('timeCanvas') timeCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCanvas')  topCanvas?: ElementRef<HTMLCanvasElement>;
  private timeChart?: Chart;
  private topChart?: Chart;

  constructor(){
    effect(() => { // atualiza quando filtros ou dados mudam
      void this.updateCharts();
    });
  }

  ngAfterViewInit(){ this.createCharts(); }
  ngOnDestroy(){ this.timeChart?.destroy(); this.topChart?.destroy(); }

  private getCss(v: string){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  private createCharts(){
    if (!this.timeCanvas || !this.topCanvas) return;

    const accent  = this.getCss('--accent')   || '#F1A340';
    const accent2 = this.getCss('--accent-2') || '#78B68D';
    const ink     = this.getCss('--ink')      || '#2B2018';

    // Série temporal (entradas x saídas)
    const tctx = this.timeCanvas.nativeElement.getContext('2d')!;
    const gIn = tctx.createLinearGradient(0,0,0,260); gIn.addColorStop(0, accent + '55'); gIn.addColorStop(1, '#ffffff00');
    const gOut= tctx.createLinearGradient(0,0,0,260); gOut.addColorStop(0, accent2 + '55'); gOut.addColorStop(1, '#ffffff00');

    this.timeChart = new Chart(tctx, {
      type: 'line',
      data: { labels: [], datasets: [
        { label:'Entradas', data: [], fill:true, backgroundColor: gIn, borderColor: accent, tension:.35 },
        { label:'Saídas',   data: [], fill:true, backgroundColor: gOut, borderColor: accent2, tension:.35 },
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ x:{ grid:{display:false} }, y:{ grid:{ color:'#f0e4d4'} } },
        plugins:{ legend:{ labels:{ color: ink } } }
      }
    });

    // Top saídas por produto
    const bctx = this.topCanvas.nativeElement.getContext('2d')!;
    this.topChart = new Chart(bctx, {
      type: 'bar',
      data: { labels: [], datasets: [{ label:'Saídas', data: [], backgroundColor:[accent, accent, accent, accent2, accent2, accent2] }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ x:{ grid:{display:false} }, y:{ grid:{ color:'#f0e4d4'} } },
        plugins:{ legend:{ display:false } }
      }
    });

    this.updateCharts();
  }

  private updateCharts(){
    if (!this.timeChart || !this.topChart) return;

    const group = this.agrupar();
    // === Série temporal ===
    const labels: string[] = [];
    const mapIn  = new Map<string, number>();
    const mapOut = new Map<string, number>();

    // gera eixos por período selecionado (dia/mês)
    const spanKeys = this.buildSpanKeys(group, this.de(), this.ate());
    for (const k of spanKeys){ labels.push(this.prettyKey(k, group)); mapIn.set(k,0); mapOut.set(k,0); }

    for (const m of this.lista()){
      const k = this.keyOf(m.dataISO, group);
      if (m.tipo === 'in')  mapIn.set(k, (mapIn.get(k)  ?? 0) + m.quantidade);
      if (m.tipo === 'out') mapOut.set(k, (mapOut.get(k) ?? 0) + m.quantidade);
    }

    this.timeChart.data.labels = labels;
    this.timeChart.data.datasets[0].data = labels.map((_,i)=> mapIn.get(spanKeys[i])  ?? 0);
    this.timeChart.data.datasets[1].data = labels.map((_,i)=> mapOut.get(spanKeys[i]) ?? 0);
    this.timeChart.update();

    // === Top saídas por produto (até 6) ===
    const outByProd = new Map<string, number>();
    for (const m of this.lista()){
      if (m.tipo !== 'out') continue;
      outByProd.set(m.productId, (outByProd.get(m.productId) ?? 0) + m.quantidade);
    }
    const top = [...outByProd.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
    const labelsBar = top.map(([pid]) => this.store.products().find(p => p.id === pid)?.nome ?? '—');
    const dataBar   = top.map(([,q]) => q);

    this.topChart.data.labels = labelsBar;
    this.topChart.data.datasets[0].data = dataBar;
    this.topChart.update();
  }

  // ===== chaves e períodos =====
  private keyOf(iso: string, g: Agrupar){
    const y = iso.slice(0,4), m = iso.slice(5,7), d = iso.slice(8,10);
    return g === 'day' ? `${y}-${m}-${d}` : `${y}-${m}`;
  }
  private prettyKey(k: string, g: Agrupar){
    if (g === 'day'){ const [y,m,d] = k.split('-'); return `${d}/${m}`; }
    const [y,m] = k.split('-'); return `${m}/${y.slice(2)}`;
  }
  private buildSpanKeys(g: Agrupar, ymdStart: string, ymdEnd: string){
    const keys: string[] = [];
    const a = new Date(ymdStart + 'T00:00:00'); const b = new Date(ymdEnd + 'T00:00:00');
    if (g === 'day'){
      for (let d = new Date(a); d <= b; d.setDate(d.getDate()+1)) keys.push(d.toISOString().slice(0,10));
    } else {
      // mês a mês
      const cur = new Date(a.getFullYear(), a.getMonth(), 1);
      const end = new Date(b.getFullYear(), b.getMonth(), 1);
      while (cur <= end){
        const y = cur.getFullYear(), m = String(cur.getMonth()+1).padStart(2,'0');
        keys.push(`${y}-${m}`);
        cur.setMonth(cur.getMonth()+1);
      }
    }
    return keys;
  }

  // ===== util datas =====
  private hoje(){ const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
  private hojeMenos(n: number){ const d=new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }

  // ===== exportação CSV =====
  exportDetalhado(){
    const rows: string[][] = [
      ['Data','Produto','Tipo','Quantidade','Preço Unit.','Validade/Lote','Motivo']
    ];
    for (const m of this.lista()){
      const p = this.store.products().find(x=>x.id===m.productId)?.nome ?? '—';
      rows.push([
        new Date(m.dataISO).toLocaleDateString(),
        p,
        m.tipo === 'in' ? 'Entrada' : 'Saída',
        String(m.quantidade),
        m.precoUnitario != null ? String(m.precoUnitario) : '',
        m.validadeLote ? new Date(m.validadeLote).toLocaleDateString() : '',
        m.motivo ?? ''
      ]);
    }
    this.downloadCsv(rows, 'movimentacoes-filtradas.csv');
  }

  exportResumido(){
    const g = this.agrupar();
    const keys = this.buildSpanKeys(g, this.de(), this.ate());
    const mapIn = new Map<string, number>(); const mapOut = new Map<string, number>();
    for (const k of keys){ mapIn.set(k,0); mapOut.set(k,0); }
    for (const m of this.lista()){
      const k = this.keyOf(m.dataISO, g);
      if (m.tipo==='in')  mapIn.set(k,(mapIn.get(k)??0)+m.quantidade);
      if (m.tipo==='out') mapOut.set(k,(mapOut.get(k)??0)+m.quantidade);
    }
    const rows: string[][] = [['Período','Entradas','Saídas','Saldo']];
    for (const k of keys){
      const e = mapIn.get(k) ?? 0, s = mapOut.get(k) ?? 0;
      rows.push([ this.prettyKey(k, g), String(e), String(s), String(e-s) ]);
    }
    this.downloadCsv(rows, `resumo-${g}.csv`);
  }

  private downloadCsv(rows: string[][], filename: string){
    const csv = rows.map(r => r.map(v => `"${(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // nome do produto por id (evita arrow function no template)
  nomeDe(id: string) {
    return this.store.products().find(p => p.id === id)?.nome ?? '—';
  }

}
