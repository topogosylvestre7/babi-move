import { Injectable, computed, inject, signal } from '@angular/core';

import {
  AlertCategory,
  AlertFilter,
  AlertPriority,
  CommuneId,
  TrafficAlert,
} from '../models/models';
import { DataService } from './data';

/** Ordre de tri par priorité (critique d'abord). */
const PRIORITY_ORDER: Record<AlertPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly data = inject(DataService);

  private readonly _filter = signal<AlertFilter>({
    communes: [],
    categories: [],
  });

  readonly filter = this._filter.asReadonly();

  /** Toutes les alertes, triées par priorité puis par fraîcheur. */
  readonly allSorted = computed(() => this.sortByPriority(this.data.alerts()));

  /** Alertes après application des filtres courants. */
  readonly filtered = computed(() => {
    const { communes, categories } = this._filter();
    return this.allSorted().filter((a) => {
      const okCommune = communes.length === 0 || a.communes.some((c) => communes.includes(c));
      const okCategory = categories.length === 0 || categories.includes(a.category);
      return okCommune && okCategory;
    });
  });

  /** Top N, pour l'aperçu de l'accueil (ACC-06). */
  topN(n = 3): TrafficAlert[] {
    return this.allSorted().slice(0, n);
  }

  /** Alertes qui touchent une commune donnée. */
  forCommune(commune: CommuneId): TrafficAlert[] {
    return this.allSorted().filter((a) => a.communes.includes(commune));
  }

  /** Alertes qui touchent une liste de communes (ex. un axe d'itinéraire). */
  forCommunes(communes: CommuneId[]): TrafficAlert[] {
    if (communes.length === 0) return [];
    return this.allSorted().filter((a) => a.communes.some((c) => communes.includes(c)));
  }

  /**
   * Alertes liées à un itinéraire, en tenant compte de la priorité.
   * On ne remonte que les alertes « importantes » (critique, élevée, moyenne).
   */
  impactfulForCommunes(communes: CommuneId[]): TrafficAlert[] {
    return this.forCommunes(communes).filter((a) => a.priority !== 'info');
  }

  // Filtres ---

  toggleCommune(id: CommuneId): void {
    this._filter.update((f) => ({
      ...f,
      communes: f.communes.includes(id) ? f.communes.filter((c) => c !== id) : [...f.communes, id],
    }));
  }

  toggleCategory(cat: AlertCategory): void {
    this._filter.update((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }));
  }

  setCommunes(communes: CommuneId[]): void {
    this._filter.update((f) => ({ ...f, communes }));
  }

  setCategories(categories: AlertCategory[]): void {
    this._filter.update((f) => ({ ...f, categories }));
  }

  resetFilter(): void {
    this._filter.set({ communes: [], categories: [] });
  }

  // Helpers de présentation ---

  priorityLabel(p: AlertPriority): string {
    switch (p) {
      case 'critical':
        return 'Critique';
      case 'high':
        return 'Élevée';
      case 'medium':
        return 'Moyenne';
      case 'info':
        return 'Information';
    }
  }

  categoryLabel(c: AlertCategory): string {
    switch (c) {
      case 'embouteillage':
        return 'Embouteillage';
      case 'accident':
        return 'Accident';
      case 'travaux':
        return 'Travaux';
      case 'meteo':
        return 'Météo et inondation';
      case 'transport-commun':
        return 'Transport en commun';
      case 'evenement':
        return 'Événement';
    }
  }

  /** Ex. « mise à jour il y a 12 min ». */
  relativeUpdated(alert: TrafficAlert, now: Date = new Date()): string {
    const diffMs = now.getTime() - new Date(alert.updatedAt).getTime();
    const min = Math.max(0, Math.round(diffMs / 60_000));

    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;

    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;

    const d = Math.round(h / 24);
    return `il y a ${d} j`;
  }

  // Interne ---

  private sortByPriority(alerts: TrafficAlert[]): TrafficAlert[] {
    return [...alerts].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;

      // Même priorité → plus récent d'abord.
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }
}
