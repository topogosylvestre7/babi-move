// service d'authentification simulée
// Les comptes viennent du fichier `register` (core/data/register.ts).

import { Injectable, computed, signal } from '@angular/core';
import {
  REGISTER_SEED,
  REGISTER_STORAGE_KEY,
  RESET_DURATION_MS,
  SESSION_DURATION_MS,
  SESSION_STORAGE_KEY,
} from '../data/register';
import { AuthSession, PasswordResetRequest, RegisteredAccount, User } from '../models/models';

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; error: string };

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accounts = signal<RegisteredAccount[]>(this.loadAccounts());
  private readonly session = signal<AuthSession | null>(this.loadSession());
  private resetRequests: PasswordResetRequest[] = [];

  readonly currentUser = computed<User | null>(() => {
    const session = this.session();
    if (!session) return null;
    const account = this.accounts().find((a) => a.id === session.userId);
    return account ? this.toUser(account) : null;
  });

  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  // Inscription : ajoute le compte au register puis ouvre une session.
  register(input: RegisterInput): AuthResult<User> {
    const email = this.normalizeEmail(input.email);
    if (this.accounts().some((a) => a.email === email)) {
      return { ok: false, error: 'Un compte existe déjà avec cet e-mail.' };
    }

    const account: RegisteredAccount = {
      id: crypto.randomUUID(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      password: input.password,
      createdAt: new Date().toISOString(),
      preferences: {
        avoidedModes: [],
        notifications: { email: true, push: false, trafficAlerts: true },
      },
    };

    this.accounts.update((list) => [...list, account]);
    this.saveAccounts();
    this.openSession(account.id);
    return { ok: true, value: this.toUser(account) };
  }

  // Connexion : vérifie l'e-mail et le mot de passe dans le register.
  login(emailInput: string, password: string): AuthResult<User> {
    const email = this.normalizeEmail(emailInput);
    const account = this.accounts().find((a) => a.email === email);

    // Même message dans les deux cas pour ne pas révéler les e-mails connus.
    if (!account || account.password !== password) {
      return { ok: false, error: 'E-mail ou mot de passe incorrect.' };
    }

    this.openSession(account.id);
    return { ok: true, value: this.toUser(account) };
  }

  logout(): void {
    this.session.set(null);
    this.safeRemove(SESSION_STORAGE_KEY);
  }

  updateProfile(data: Partial<User>): AuthResult<User> {
    const current = this.currentUser();
    if (!current) return { ok: false, error: 'Non connecté.' };

    let updatedUser: User | null = null;

    this.accounts.update((list) =>
      list.map((acc) => {
        if (acc.id === current.id) {
          const updated = { ...acc, ...data };
          updatedUser = this.toUser(updated); // on retire le mdp
          return updated;
        }
        return acc;
      }),
    );

    this.saveAccounts();

    if (updatedUser) {
      return { ok: true, value: updatedUser };
    }
    return { ok: false, error: 'Erreur de mise à jour.' };
  }

  /**
   * Mot de passe oublié : simule l'envoi d'un lien.
   * Répond toujours « ok » ; le jeton n'est renvoyé que si le compte existe,
   * pour que la démo puisse l'afficher dans une notification.
   */
  requestPasswordReset(emailInput: string): AuthResult<{ token?: string }> {
    const email = this.normalizeEmail(emailInput);
    const exists = this.accounts().some((a) => a.email === email);
    if (!exists) return { ok: true, value: {} };

    const request: PasswordResetRequest = {
      email,
      token: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + RESET_DURATION_MS).toISOString(),
    };
    this.resetRequests = [...this.resetRequests.filter((r) => r.email !== email), request];
    return { ok: true, value: { token: request.token } };
  }

  // Applique un nouveau mot de passe à partir d'un lien simulé.
  resetPassword(token: string, newPassword: string): AuthResult {
    const request = this.resetRequests.find((r) => r.token === token);
    if (!request || new Date(request.expiresAt).getTime() < Date.now()) {
      return { ok: false, error: "Ce lien a expiré ou n'est pas valide." };
    }

    this.accounts.update((list) =>
      list.map((a) => (a.email === request.email ? { ...a, password: newPassword } : a)),
    );
    this.saveAccounts();
    this.resetRequests = this.resetRequests.filter((r) => r.token !== token);
    return { ok: true, value: undefined };
  }

  // Session

  private openSession(userId: string): void {
    const session: AuthSession = {
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    };
    this.session.set(session);
    this.safeWrite(SESSION_STORAGE_KEY, session);
  }

  private loadSession(): AuthSession | null {
    const session = this.safeRead<AuthSession>(SESSION_STORAGE_KEY);
    if (!session) return null;
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  }

  // Register

  private loadAccounts(): RegisteredAccount[] {
    return this.safeRead<RegisteredAccount[]>(REGISTER_STORAGE_KEY) ?? [...REGISTER_SEED];
  }

  private saveAccounts(): void {
    this.safeWrite(REGISTER_STORAGE_KEY, this.accounts());
  }

  // Utilitaires

  // Retire le mot de passe avant d'exposer le compte à l'interface.
  private toUser(account: RegisteredAccount): User {
    const { password: _password, ...user } = account;
    return user;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  // Le stockage local peut être indisponible (navigation privée, etc.).
  private safeRead<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private safeWrite(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Sans stockage, l'état reste en mémoire pour la session en cours.
    }
  }

  private safeRemove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Rien à faire.
    }
  }
}
