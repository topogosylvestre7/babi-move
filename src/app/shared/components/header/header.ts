import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { ContributionService } from '../../../core/services/contribution';
import { DataService } from '../../../core/services/data'; // Pour avoir les noms des communes

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
  private readonly data = inject(DataService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly currentUser = this.auth.currentUser;

  readonly menuOpen = signal(false);
  readonly isUserMenuOpen = signal(false);
  readonly isNotifOpen = signal(false);

  private readonly readNotifs = signal<Set<string>>(new Set());

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    const first = user.firstName?.[0] ?? '';
    const last = user.lastName?.[0] ?? '';
    return (first + last).toUpperCase();
  });

  // 🔥 CORRECTION ICI : On récupère TOUTES les contributions et on simule le cycle de vie
  readonly notifications = computed<AppNotification[]>(() => {
    const user = this.currentUser();
    if (!user) return [];

    // On utilise getAllContributions() pour être sûr de ne rien rater
    // (Si la méthode n'existe pas, on utilise getUserContributions mais on vérifie)
    const allContribs = this.contributionService.getAllContributions();

    // On filtre pour ne garder que celles de l'utilisateur actuel
    const myContribs = allContribs.filter((c) => c.userId === user.id);

    const readSet = this.readNotifs();
    const notifs: AppNotification[] = [];

    myContribs.forEach((c) => {
      const communeName = this.data.getCommuneById(c.commune)?.name ?? c.commune;
      const baseId = c.id;

      // 1. Notification de création (toujours présente)
      notifs.push({
        id: `${baseId}-created`,
        type: 'info',
        title: 'Signalement envoyé',
        message: `Votre signalement "${c.type}" à ${communeName} a bien été reçu.`,
        time: this.formatTime(c.createdAt),
        read: readSet.has(`${baseId}-created`),
      });

      // 2. Notification de statut (simulée)
      // Dans une vraie app, ceci viendrait d'une API. Ici, on simule.
      if (c.status === 'pending') {
        notifs.push({
          id: `${baseId}-pending`,
          type: 'warning',
          title: 'En attente de validation',
          message: `Votre signalement à ${communeName} est en cours de vérification par la communauté.`,
          time: this.formatTime(c.createdAt), // Même date pour la démo
          read: readSet.has(`${baseId}-pending`),
        });
      } else if (c.status === 'published') {
        notifs.push({
          id: `${baseId}-published`,
          type: 'success',
          title: 'Signalement validé',
          message: `Votre signalement à ${communeName} a été confirmé et est visible par tous.`,
          time: this.formatTime(c.createdAt),
          read: readSet.has(`${baseId}-published`),
        });
      } else if (c.status === 'rejected') {
        notifs.push({
          id: `${baseId}-rejected`,
          type: 'error',
          title: 'Signalement refusé',
          message: `Votre signalement à ${communeName} n'a pas pu être validé.`,
          time: this.formatTime(c.createdAt),
          read: readSet.has(`${baseId}-rejected`),
        });
      }
    });

    // On trie par date (les plus récentes d'abord)
    return notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  });

  readonly unreadCount = computed(() => this.notifications().filter((n) => !n.read).length);

  readonly navLinks: NavLink[] = [
    { label: 'Accueil', routerLink: '/', exact: true },
    { label: 'Alertes', routerLink: '/alertes', badge: 'Live' },
    { label: 'Communauté', routerLink: '/notre-communaute' },
  ];

  // ... (le reste des méthodes toggleMenu, toggleNotifMenu, etc. reste identique)

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
