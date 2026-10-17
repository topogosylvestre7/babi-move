import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../../core/services/auth';
import { ContributionService } from '../../../core/services/contribution';
import { HistoryService } from '../../../core/services/history';
import { TransportModeId, User } from '../../../core/models/models';

interface ProfileStat {
  value: string | number;
  label: string;
}

@Component({
  selector: 'ui-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly contributionService = inject(ContributionService);
  private readonly historyService = inject(HistoryService);

  readonly currentUser = this.auth.currentUser;

  // --- Tabs ---
  readonly activeTab = signal<'overview' | 'settings' | 'security' | 'notifications'>('overview');

  readonly tabs = [
    { id: 'overview', label: "Vue d'ensemble", icon: 'bi-person' },
    { id: 'settings', label: 'Paramètres', icon: 'bi-gear' },
    { id: 'security', label: 'Sécurité', icon: 'bi-shield-lock' },
    { id: 'notifications', label: 'Notifications', icon: 'bi-bell' },
  ] as const;

  // --- Édition ---
  readonly editMode = signal(false);
  editedUser = {
    firstName: '',
    lastName: '',
    email: '',
    maxBudgetFcfa: 0,
    preferredMode: 'gbaka' as TransportModeId,
  };

  // --- Notifications locales ---
  notifications = {
    email: true,
    push: true,
    sms: false,
    newsletter: false,
  };

  // --- Statistiques dynamiques ---
  readonly userStats = computed<ProfileStat[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    const contribs = this.contributionService.getUserContributions(user.id).length;

    // ✅ Correction ici : on utilise le computed `entries` du service qui filtre déjà par user
    const history = this.historyService.entries().length;

    const favorites = Object.keys(localStorage).filter((k) =>
      k.startsWith('babi-move.favorite.'),
    ).length;

    return [
      { value: history, label: 'Trajets' },
      { value: contribs, label: 'Signalements' },
      { value: favorites, label: 'Favoris' },
    ];
  });

  readonly initials = computed(() => {
    const u = this.currentUser();
    return u ? `${u.firstName[0]}${u.lastName[0]}`.toUpperCase() : '';
  });

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.editedUser = {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        maxBudgetFcfa: user.preferences.maxBudgetFcfa ?? 3000,
        preferredMode: user.preferences.preferredMode ?? 'gbaka',
      };

      this.notifications.email = user.preferences.notifications.email;
      this.notifications.push = user.preferences.notifications.push;
      this.notifications.sms = user.preferences.notifications.trafficAlerts;
    }
  }

  setTab(tabId: 'overview' | 'settings' | 'security' | 'notifications'): void {
    this.activeTab.set(tabId);
  }

  toggleEditMode(): void {
    this.editMode.update((v) => !v);
  }

  saveProfile(): void {
    const user = this.currentUser();
    if (!user) return;

    const res = this.auth.updateProfile({
      firstName: this.editedUser.firstName.trim(),
      lastName: this.editedUser.lastName.trim(),
      email: this.editedUser.email.trim().toLowerCase(),
      preferences: {
        ...user.preferences,
        maxBudgetFcfa: this.editedUser.maxBudgetFcfa,
        preferredMode: this.editedUser.preferredMode,
      },
    });

    if (res.ok) {
      this.editMode.set(false);
    } else {
      alert(res.error);
    }
  }

  saveNotifications(): void {
    const user = this.currentUser();
    if (!user) return;

    this.auth.updateProfile({
      preferences: {
        ...user.preferences,
        notifications: {
          email: this.notifications.email,
          push: this.notifications.push,
          trafficAlerts: this.notifications.sms,
        },
      },
    });
    alert('Préférences de notification mises à jour.');
  }

  changePassword(): void {
    alert('Un lien de réinitialisation a été simulé vers votre adresse e-mail.');
  }

  enable2FA(): void {
    alert('La double authentification sera bientôt disponible sur Babi Move.');
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  modeLabel(mode: string | undefined): string {
    switch (mode) {
      case 'gbaka':
        return 'Gbaka';
      case 'woro-woro':
        return 'Woro-woro';
      case 'sotra':
        return 'Bus SOTRA';
      case 'bateau-bus':
        return 'Bateau-bus';
      case 'vtc':
        return 'VTC';
      case 'marche':
        return 'Marche';
      default:
        return 'Non défini';
    }
  }
}
