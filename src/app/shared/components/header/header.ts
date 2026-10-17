import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { ContributionService } from '../../../core/services/contribution';
import { Contribution } from '../../../core/models/models';

export interface NavLink {
  label: string;
  routerLink: string;
  badge?: string;
  exact?: boolean;
}

interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

@Component({
  selector: 'ui-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  private readonly auth = inject(AuthService);
  private readonly contributionService = inject(ContributionService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly currentUser = this.auth.currentUser;

  readonly menuOpen = signal(false);
  readonly isUserMenuOpen = signal(false);
  readonly isNotifOpen = signal(false);

  // Pour simuler l'état "lu" localement (non persistant pour la démo)
  private readonly readNotifs = signal<Set<string>>(new Set());

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  });

  // Génération des notifications depuis les contributions
  readonly notifications = computed<AppNotification[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    const contribs = this.contributionService.getUserContributions(user.id);
    const readSet = this.readNotifs();

    return contribs
      .map((c) => {
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';
        let title = 'Signalement';
        let statusLabel = '';

        if (c.status === 'pending') {
          type = 'warning';
          title = 'Signalement en attente';
          statusLabel = 'en attente';
        } else if (c.status === 'published') {
          type = 'success';
          title = 'Signalement validé';
          statusLabel = 'validé';
        } else if (c.status === 'rejected') {
          type = 'error';
          title = 'Signalement rejeté';
          statusLabel = 'rejeté';
        }

        return {
          id: c.id,
          type,
          title,
          message: `Votre signalement "${c.type}" à ${c.commune} est ${statusLabel}.`,
          time: this.formatTime(c.createdAt),
          read: readSet.has(c.id),
        };
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  });

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  readonly navLinks: NavLink[] = [
    { label: 'Accueil', routerLink: '/', exact: true },
    { label: 'Alertes', routerLink: '/alertes', badge: 'Live' },
    { label: 'Communauté', routerLink: '/notre-communaute' },
  ];

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen.update((v) => !v);
    if (this.isUserMenuOpen()) this.isNotifOpen.set(false);
  }

  closeUserMenu(): void {
    this.isUserMenuOpen.set(false);
  }

  toggleNotifMenu(): void {
    this.isNotifOpen.update((v) => !v);
    if (this.isNotifOpen()) this.isUserMenuOpen.set(false);
  }

  closeNotifMenu(): void {
    this.isNotifOpen.set(false);
  }

  markAllAsRead(): void {
    const ids = this.notifications().map((n) => n.id);
    this.readNotifs.update((set) => new Set([...set, ...ids]));
  }

  logout(): void {
    this.auth.logout();
    this.closeUserMenu();
    this.closeMenu();
    this.closeNotifMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.nbar-user-wrap')) this.closeUserMenu();
    if (!target.closest('.nbar-notif-wrap')) this.closeNotifMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeUserMenu();
    this.closeNotifMenu();
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
