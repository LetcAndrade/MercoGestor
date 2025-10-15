import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = false;
  error = '';

  submit(form: NgForm) {
    if (this.loading) return;

    // validação amigável
    const emailCtrl = form.controls['email'];
    if (emailCtrl && emailCtrl.invalid) {
      this.error = 'Informe um e-mail válido.';
      return;
    }
    if (form.invalid) {
      this.error = 'Preencha os campos corretamente.';
      return;
    }

    this.error = '';
    this.loading = true;
    try {
      this.auth.login(this.email.trim(), this.password);
      this.router.navigateByUrl('/'); // dashboard
    } catch (e: any) {
      this.error = e?.message ?? 'Falha ao entrar';
      this.loading = false;
    }
  }

  guest() {
    if (this.loading) return;
    this.auth.guest();
    this.router.navigateByUrl('/'); // após convidado, vai pro dashboard
  }
}
