import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { DataService } from '../../../core/services/data';
import { AlertService } from '../../../core/services/alert';
import { AuthService } from '../../../core/services/auth';
import { StorageService } from '../../../core/services/storage';
import { AlertCategory, AlertPriority, CommuneId, TrafficAlert } from '../../../core/models/models';

interface AlertCounters {
  total: number;
  critical: number;
  high: number;
  medium: number;
  info: number;
}

interface FavoriteRef {
  label: string;
  addedAt: number;
}

@Component({
  selector: 'ui-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alerts.html',
  styleUrl: './alerts.scss',
})
export class Alerts implements OnInit {
  private readonly data = inject(DataService);
  private readonly alerts = inject(AlertService);
  readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);

  // Exposition ---
  readonly loaded = this.data.loaded;
  readonly loadError = this.data.error;
  readonly popularCommunes = this.data.popularCommunes;
  readonly allCommunes = this.data.communes;
  readonly filtered = this.alerts.filtered;
  readonly filter = this.alerts.filter;
  readonly allSorted = this.alerts.allSorted;

  // Compteurs ---
  readonly counters = computed<AlertCounters>(() => {
    const list = this.allSorted();
    return {
      total: list.length,
      critical: list.filter((a) => a.priority === 'critical').length,
      high: list.filter((a) => a.priority === 'high').length,
      medium: list.filter((a) => a.priority === 'medium').length,
      info: list.filter((a) => a.priority === 'info').length,
    };
  });

  // Alertes Favoris ---
  readonly favoriteAlerts = computed<TrafficAlert[]>(() => {
    if (!this.auth.isLoggedIn()) return [];
    const favoriteLabels = this.favoriteLabels();
    if (favoriteLabels.length === 0) return [];

    const lower = favoriteLabels.map((l) => l.toLowerCase()).filter(Boolean);
    return this.allSorted().filter((a) => {
      const communeNames = a.communes
        .map((id) => this.data.getCommuneById(id)?.name ?? '')
        .join(' ')
        .toLowerCase();
      const text = `${a.title} ${a.description} ${communeNames}`.toLowerCase();
      return lower.some((l) => text.includes(l));
    });
  });

  private readonly favoriteLabels = computed<string[]>(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('babi-move.favorite.'));
    return keys
      .map((k) => this.storage.read<FavoriteRef>(k.replace('babi-move.', '')))
      .filter((v): v is FavoriteRef => !!v && typeof v.label === 'string')
      .map((v) => v.label);
  });

  readonly hasFavorites = computed(() => this.favoriteAlerts().length > 0);

  readonly showAllCommunes = signal(false);
  readonly selectedAlert = signal<TrafficAlert | null>(null);

  readonly categories: AlertCategory[] = [
    'embouteillage',
    'accident',
    'travaux',
    'meteo',
    'transport-commun',
    'evenement',
  ];

  readonly priorities: AlertPriority[] = ['critical', 'high', 'medium', 'info'];

  readonly activeCategories = computed(() => this.filter().categories);
  readonly activeCommunes = computed(() => this.filter().communes);
  readonly activePriorities = signal<AlertPriority[]>([]);

  // Liste finale ---
  readonly visibleAlerts = computed<TrafficAlert[]>(() => {
    let source = this.filtered();
    const priorities = this.activePriorities();
    if (priorities.length > 0) {
      source = source.filter((a) => priorities.includes(a.priority));
    }
    return source;
  });

  readonly hasActiveFilter = computed(
    () =>
      this.activeCommunes().length > 0 ||
      this.activeCategories().length > 0 ||
      this.activePriorities().length > 0,
  );

  async ngOnInit(): Promise<void> {
    await this.data.load();
    queueMicrotask(() => {
      const first = this.visibleAlerts()[0];
      if (first && window.innerWidth >= 1024) {
        this.selectedAlert.set(first);
      }
    });
  }

  // ============================================================
  // Filtres
  // ============================================================

  toggleCommune(id: CommuneId): void {
    this.alerts.toggleCommune(id);
  }

  isCommuneActive(id: CommuneId): boolean {
    return this.activeCommunes().includes(id);
  }

  toggleCategory(cat: AlertCategory): void {
    this.alerts.toggleCategory(cat);
  }

  isCategoryActive(cat: AlertCategory): boolean {
    return this.activeCategories().includes(cat);
  }

  togglePriority(p: AlertPriority): void {
    this.activePriorities.update((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
    );
  }

  isPriorityActive(p: AlertPriority): boolean {
    return this.activePriorities().includes(p);
  }

  resetFilters(): void {
    this.alerts.resetFilter();
    this.activePriorities.set([]);
  }

  toggleAllCommunes(): void {
    this.showAllCommunes.update((v) => !v);
  }

  // ============================================================
  // Détail
  // ============================================================

  selectAlert(a: TrafficAlert): void {
    this.selectedAlert.set(a);
  }

  closeDetail(): void {
    this.selectedAlert.set(null);
  }

  goToItinerary(alert: TrafficAlert): void {
    const commune = this.data.getCommuneById(alert.communes[0]);
    if (!commune) {
      this.router.navigate(['/resultats']);
      return;
    }

    const target = alert.communes[1] ? this.data.getCommuneById(alert.communes[1]) : undefined;

    const queryParams: Record<string, string | number> = {
      fromLabel: commune.name,
      fromLat: commune.center.lat,
      fromLng: commune.center.lng,
    };

    if (target) {
      queryParams['toLabel'] = target.name;
      queryParams['toLat'] = target.center.lat;
      queryParams['toLng'] = target.center.lng;
    }

    void this.router.navigate(['/resultats'], { queryParams });
  }

  // ============================================================
  // Helpers
  // ============================================================

  priorityLabel(p: AlertPriority): string {
    return this.alerts.priorityLabel(p);
  }

  categoryLabel(c: AlertCategory): string {
    return this.alerts.categoryLabel(c);
  }

  relativeUpdated(a: TrafficAlert): string {
    return this.alerts.relativeUpdated(a);
  }

  communeNamesOf(alert: TrafficAlert): string[] {
    return alert.communes
      .map((id) => this.data.getCommuneById(id)?.name ?? id)
      .filter((x): x is string => !!x);
  }

  communeName(id: CommuneId): string {
    return this.data.getCommuneById(id)?.name ?? id;
  }

  categoryIcon(c: AlertCategory): string {
    switch (c) {
      case 'embouteillage':
        return 'bi-cone-striped';
      case 'accident':
        return 'bi-exclamation-octagon-fill';
      case 'travaux':
        return 'bi-hammer';
      case 'meteo':
        return 'bi-cloud-rain-fill';
      case 'transport-commun':
        return 'bi-bus-front-fill';
      case 'evenement':
        return 'bi-calendar-event-fill';
    }
  }

  priorityIcon(p: AlertPriority): string {
    switch (p) {
      case 'critical':
        return 'bi-exclamation-triangle-fill';
      case 'high':
        return 'bi-exclamation-circle-fill';
      case 'medium':
        return 'bi-info-circle-fill';
      default:
        return 'bi-info-circle';
    }
  }

  alertTone(p: AlertPriority): string {
    return p;
  }

  durationLabel(a: TrafficAlert): string | null {
    if (!a.estimatedDurationMin) return null;
    const min = a.estimatedDurationMin;
    if (min < 60) return `~${min} min`;
    const h = Math.round((min / 60) * 10) / 10;
    return `~${h} h`;
  }
}
