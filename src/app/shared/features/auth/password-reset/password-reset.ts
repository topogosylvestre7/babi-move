import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth';

type Step = 'email' | 'sent';

@Component({
  selector: 'ui-password-reset',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.scss',
})
export class PasswordReset {
  private readonly auth = inject(AuthService);

  email = '';

  readonly step = signal<Step>('email');
  readonly sentEmail = signal('');
  readonly token = signal<string | null>(null);
  readonly error = signal('');
  readonly isLoading = signal(false);

  async sendLink(): Promise<void> {
    this.error.set('');

    if (!this.email.trim()) {
      this.error.set('Renseigne ton adresse email.');
      return;
    }

    this.isLoading.set(true);
    // Latence simulée pour laisser voir l'état de chargement.
    await new Promise((resolve) => setTimeout(resolve, 400));

    // AuthService répond toujours ok (pour ne pas révéler si un e-mail existe).
    const result = this.auth.requestPasswordReset(this.email);
    this.isLoading.set(false);

    if (!result.ok) {
      this.error.set(result.error);
      return;
    }

    this.sentEmail.set(this.email.trim());
    this.token.set(result.value.token ?? null);
    this.step.set('sent');
  }

  backToEmail(): void {
    this.step.set('email');
    this.token.set(null);
  }
}
