import { Injectable, inject } from '@angular/core';
import { StoreService, Snapshot } from './store.service';

@Injectable({ providedIn: 'root' })
export class BackupService {
  private store = inject(StoreService);

  private AUTO_KEY = 'mrz:autoBackup';      // '1' | '0'
  private LAST_KEY = 'mrz:lastBackupDate';  // 'YYYY-MM-DD'

  isAutoEnabled(): boolean {
    return localStorage.getItem(this.AUTO_KEY) === '1';
  }
  setAutoEnabled(v: boolean) {
    localStorage.setItem(this.AUTO_KEY, v ? '1' : '0');
  }
  getLastBackupDate(): string | null {
    return localStorage.getItem(this.LAST_KEY);
  }

  // Chame no boot do app (ex.: AppComponent ngOnInit)
  checkDailyBackup(): void {
    if (!this.isAutoEnabled()) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const ymd = today.toISOString().slice(0,10);
    const last = this.getLastBackupDate();
    if (last === ymd) return;

    // gera e baixa
    const filename = this.filenameFor(ymd);
    this.downloadJson(this.store.getSnapshot(), filename);
    localStorage.setItem(this.LAST_KEY, ymd);
  }

  filenameFor(ymd?: string) {
    const d = ymd || new Date().toISOString().slice(0,10);
    return `mercadinho-backup-${d}.json`;
  }

  downloadJson(snap: Snapshot, filename = this.filenameFor()) {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  exportCsvProdutos() {
    const rows: string[][] = [
      ['ID','Nome','Categoria','Unidade','Mínimo','Preço']
    ];
    for (const p of this.store.products()) {
      rows.push([p.id, p.nome, p.categoria || '', p.unidade, String(p.minimo), p.preco != null ? String(p.preco) : '']);
    }
    this.csvDownload(rows, 'produtos.csv');
  }

  exportCsvMovimentos() {
    const rows: string[][] = [
      ['ID','Data','ProdutoID','Tipo','Quantidade','PreçoUnit','Validade','Motivo']
    ];
    for (const m of this.store.movements()) {
      rows.push([
        m.id,
        new Date(m.dataISO).toISOString(),
        m.productId,
        m.tipo,
        String(m.quantidade),
        m.precoUnitario != null ? String(m.precoUnitario) : '',
        m.validadeLote || '',
        m.motivo || ''
      ]);
    }
    this.csvDownload(rows, 'movimentacoes.csv');
  }

  importFromFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        try {
          const snap = JSON.parse(String(reader.result)) as Snapshot;
          if (!snap || !Array.isArray(snap.products) || !Array.isArray(snap.movements)) throw new Error('Arquivo inválido');
          this.store.replaceAll(snap);
          resolve();
        } catch (e) { reject(e); }
      };
      reader.readAsText(file);
    });
  }

  private csvDownload(rows: string[][], filename: string) {
    const csv = rows.map(r => r.map(v => `"${(v ?? '').replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
