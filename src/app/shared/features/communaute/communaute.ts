import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { DataService } from '../../../core/services/data';
import { AuthService } from '../../../core/services/auth';
import { ContributionService } from '../../../core/services/contribution';
import { ContributionType, CommuneId } from '../../../core/models/models';

interface FeedItem {
  id: string;
  userName: string;
  initials: string;
  isCurrentUser: boolean;
  type: ContributionType;
  communeName: string;
  description: string;
  createdAt: string;
  status: string;
}

interface LeaderboardUser {
  name: string;
  initials: string;
  score: number;
  badge: string;
}

@Component({
  selector: 'app-communaute',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './communaute.html',
  styleUrl: './communaute.scss',
})
export class Communaute implements OnInit {
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly contributionService = inject(ContributionService);

  // --- Données simulées pour meubler le flux ---
  private readonly MOCK_FEED: FeedItem[] = [
    {
      id: 'mock-1',
      userName: 'Awa K.',
      initials: 'AK',
      isCurrentUser: false,
      type: 'accident',
      communeName: 'Plateau',
      description: 'Accrochage au carrefour Indénié, une voie bloquée. Prudence.',
      createdAt: new Date(Date.now() - 12 * 60000).toISOString(), // 12 min
      status: 'published',
    },
    {
      id: 'mock-2',
      userName: 'Kouassi A.',
      initials: 'KA',
      isCurrentUser: false,
      type: 'embouteillage',
      communeName: 'Cocody',
      description: 'Grosse galère sur le pont HKB, sens Cocody vers Marcory.',
      createdAt: new Date(Date.now() - 45 * 60000).toISOString(), // 45 min
      status: 'published',
    },
    {
      id: 'mock-3',
      userName: 'Mamadou D.',
      initials: 'MD',
      isCurrentUser: false,
      type: 'prix-reel',
      communeName: 'Treichville',
      description: 'Gbaka Gare Nord - Treichville : 300 FCFA ce matin.',
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(), // 2h
      status: 'published',
    },
    {
      id: 'mock-4',
      userName: 'Fatou B.',
      initials: 'FB',
      isCurrentUser: false,
      type: 'autre',
      communeName: 'Yopougon',
      description: 'Travaux à Siporex, circulation alternée.',
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString(), // 4h
      status: 'published',
    },
  ];

  readonly MOCK_LEADERBOARD: LeaderboardUser[] = [
    { name: 'Awa K.', initials: 'AK', score: 142, badge: '🥇' },
    { name: 'Kouassi A.', initials: 'KA', score: 98, badge: '🥈' },
    { name: 'Mamadou D.', initials: 'MD', score: 75, badge: '🥉' },
    { name: 'Fatou B.', initials: 'FB', score: 54, badge: '⭐' },
    { name: 'Yao K.', initials: 'YK', score: 41, badge: '⭐' },
  ];

  // --- Stats globales (simulées + réelles) ---
  readonly totalContributions = computed(() => {
    const user = this.auth.currentUser();
    const myCount = user ? this.contributionService.getUserContributions(user.id).length : 0;
    return 1250 + myCount; // Base fictive + réelles
  });

  readonly activeContributors = 342; // Fictif
  readonly resolvedAlerts = 89; // Fictif

  // --- Flux fusionné ---
  readonly feed = computed<FeedItem[]>(() => {
    const user = this.auth.currentUser();
    let myContribs: FeedItem[] = [];

    if (user) {
      myContribs = this.contributionService.getUserContributions(user.id).map((c) => ({
        id: c.id,
        userName: `${user.firstName} ${user.lastName?.[0]}.`,
        initials: `${user.firstName[0]}${user.lastName?.[0] ?? ''}`.toUpperCase(),
        isCurrentUser: true,
        type: c.type,
        communeName: this.data.getCommuneById(c.commune)?.name ?? c.commune,
        description: c.description,
        createdAt: c.createdAt,
        status: c.status,
      }));
    }

    // Fusion et tri par date (du plus récent au plus ancien)
    return [...myContribs, ...this.MOCK_FEED].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.data.load();
  }

  // --- Helpers ---
  formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH} h`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  typeIcon(t: ContributionType): string {
    switch (t) {
      case 'embouteillage':
        return 'bi-cone-striped';
      case 'accident':
        return 'bi-exclamation-octagon-fill';
      case 'prix-reel':
        return 'bi-cash-coin';
      case 'arret':
        return 'bi-signpost-2-fill';
      default:
        return 'bi-three-dots';
    }
  }

  typeLabel(t: ContributionType): string {
    switch (t) {
      case 'embouteillage':
        return 'Embouteillage';
      case 'accident':
        return 'Accident';
      case 'prix-reel':
        return 'Prix réel';
      case 'arret':
        return 'Arrêt';
      default:
        return 'Autre';
    }
  }

  typeColor(t: ContributionType): string {
    switch (t) {
      case 'embouteillage':
        return 'var(--em-secondary)';
      case 'accident':
        return 'var(--em-error)';
      case 'prix-reel':
        return 'var(--em-primary)';
      case 'arret':
        return 'var(--em-tertiary)';
      default:
        return 'var(--em-muted)';
    }
  }

  statusLabel(s: string): string {
    switch (s) {
      case 'pending':
        return 'En attente';
      case 'published':
        return 'Validé';
      case 'rejected':
        return 'Rejeté';
      default:
        return s;
    }
  }
}
