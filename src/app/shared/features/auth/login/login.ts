import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth';

@Component({
  selector: 'ui-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  showPassword = false;

  readonly isLoading = signal(false);
  readonly error = signal('');

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  async login(): Promise<void> {
    this.error.set('');

    if (!this.email.trim() || !this.password) {
      this.error.set('Renseigne ton e-mail et ton mot de passe.');
      return;
    }

    this.isLoading.set(true);
    // Petite latence simulée pour laisser voir l'état de chargement.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const result = this.auth.login(this.email, this.password);
    this.isLoading.set(false);

    if (!result.ok) {
      this.error.set(result.error);
      return;
    }

    const redirect = this.route.snapshot.queryParamMap.get('redirect') ?? '/mon-espace';
    this.router.navigateByUrl(redirect);
  }
}
