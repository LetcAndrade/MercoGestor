import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupService } from '../../core/backup.service';
import { StoreService } from '../../core/store.service';

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './backup.component.html',
  styleUrls: ['./backup.component.scss']
})
export class BackupComponent {
  backup = inject(BackupService);
  store = inject(StoreService);

  msg = signal<string>('');

  // binds para o toggle (usa [ngModel] + (ngModelChange) por ser signal no service)
  auto = this.backup.isAutoEnabled();
  setAuto(v: any){ this.backup.setAutoEnabled(!!v); this.auto = this.backup.isAutoEnabled(); }

  last(): string { return this.backup.getLastBackupDate() || '—'; }

  baixarAgora() {
    this.backup.downloadJson(this.store.getSnapshot());
    const today = new Date().toISOString().slice(0,10);
    localStorage.setItem('mrz:lastBackupDate', today);
    this.msg.set('Backup baixado com sucesso.');
    setTimeout(()=>this.msg.set(''), 2500);
  }

  exportCsvProdutos(){ this.backup.exportCsvProdutos(); }
  exportCsvMovs(){ this.backup.exportCsvMovimentos(); }

  async importar(ev: Event){
    const input = ev.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    try {
      await this.backup.importFromFile(file);
      this.msg.set('Backup importado com sucesso.');
    } catch (e) {
      this.msg.set('Falha ao importar: ' + (e instanceof Error ? e.message : 'erro desconhecido'));
    } finally {
      setTimeout(()=>this.msg.set(''), 3000);
      input.value = '';
    }
  }

  limparTudo() {
    if (confirm('Isso vai remover TODOS os dados locais. Tem certeza?')) {
      this.store.clearAll();
      this.msg.set('Dados limpos. (Se precisar, importe um backup JSON.)');
      setTimeout(()=>this.msg.set(''), 3000);
    }
  }
}
