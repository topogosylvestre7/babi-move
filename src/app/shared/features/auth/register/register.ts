import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth';

interface PasswordStrength {
  level: 0 | 1 | 2 | 3 | 4;
  text: string;
  /** Variable CSS du token de couleur à appliquer. */
  colorVar: string;
}

@Component({
  selector: 'ui-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  acceptTerms = false;
  showPassword = false;
  showConfirmPassword = false;

  readonly isLoading = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  /** Force du mot de passe (0 = vide, 4 = excellent). */
  get passwordStrength(): PasswordStrength {
    const value = this.password;
    if (!value) return { level: 0, text: '', colorVar: '' };

    let score = 0;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^a-zA-Z0-9]/.test(value)) score++;

    const table: PasswordStrength[] = [
      { level: 1, text: 'Faible', colorVar: 'var(--em-error)' },
      { level: 2, text: 'Moyen', colorVar: 'var(--em-secondary)' },
      { level: 3, text: 'Bon', colorVar: 'var(--em-tertiary)' },
      { level: 4, text: 'Excellent', colorVar: 'var(--em-primary)' },
    ];

    return table[score - 1] ?? { level: 0, text: '', colorVar: '' };
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async register(): Promise<void> {
    this.error.set('');
    this.success.set('');

    // Validations locales
    if (!this.firstName.trim() || !this.lastName.trim() || !this.email.trim() || !this.password) {
      this.error.set('Renseigne tous les champs obligatoires.');
      return;
    }

    if (this.password.length < 8) {
      this.error.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!this.acceptTerms) {
      this.error.set("Tu dois accepter les conditions d'utilisation.");
      return;
    }

    this.isLoading.set(true);
    // Latence simulée pour laisser voir l'état de chargement.
    await new Promise((resolve) => setTimeout(resolve, 400));

    const result = this.auth.register({
      firstName: this.firstName.trim(),
      lastName: this.lastName.trim(),
      email: this.email,
      password: this.password,
    });

    this.isLoading.set(false);

    if (!result.ok) {
      this.error.set(result.error);
      return;
    }

    this.success.set('Compte créé ! Redirection en cours…');
    // Petit délai pour laisser lire le message de succès avant de basculer.
    setTimeout(() => this.router.navigateByUrl('/mon-espace'), 600);
  }
}
