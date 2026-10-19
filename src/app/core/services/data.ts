import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  Commune,
  Place,
  RouteAxis,
  RoutesDataset,
  TrafficAlert,
  TrafficAlertSeed,
  TransportMode,
  TrafficPeriod,
} from '../models/models';

interface DataState {
  communes: Commune[];
  places: Place[];
  alerts: TrafficAlert[];
  modes: TransportMode[];
  routes: RoutesDataset | null;
  loaded: boolean;
  error: string | null;
}

const EMPTY: DataState = {
  communes: [],
  places: [],
  alerts: [],
  modes: [],
  routes: null,
  loaded: false,
  error: null,
};

/**
 * Charge une seule fois les 5 JSON du dossier public/data/,
 * met en cache en mémoire, et expose des signals prêts à l'emploi.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<DataState>(EMPTY);
  private loadPromise: Promise<void> | null = null;

  // Signaux exposés
  readonly communes = computed(() => this.state().communes);
  readonly places = computed(() => this.state().places);
  readonly alerts = computed(() => this.state().alerts);
  readonly modes = computed(() => this.state().modes);
  readonly routes = computed(() => this.state().routes);
  readonly loaded = computed(() => this.state().loaded);
  readonly error = computed(() => this.state().error);

  /** Communes populaires, pour les raccourcis de l'accueil. */
  readonly popularCommunes = computed(() => this.communes().filter((c) => c.popular));

  /** Mode de transport par id, pratique dans les templates. */
  readonly modesById = computed<Record<string, TransportMode>>(() => {
    const map: Record<string, TransportMode> = {};
    for (const m of this.modes()) map[m.id] = m;
    return map;
  });

  /** Déclenche le chargement (idempotent). */
  load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.fetchAll()
      .then((data) => {
        this.state.set({ ...data, loaded: true, error: null });
      })
      .catch((err: unknown) => {
        this.state.update((s) => ({
          ...s,
          loaded: true,
          error: err instanceof Error ? err.message : 'Erreur de chargement des données.',
        }));
        this.loadPromise = null; // Autorise un nouvel essai.
      });

    return this.loadPromise;
  }

  private async fetchAll(): Promise<Omit<DataState, 'loaded' | 'error'>> {
    const [communes, places, alertsSeed, modes, routes] = await Promise.all([
      firstValueFrom(this.http.get<Commune[]>('/data/communes.json')),
      firstValueFrom(this.http.get<Place[]>('/data/places.json')),
      firstValueFrom(this.http.get<TrafficAlertSeed[]>('/data/alerts.json')),
      firstValueFrom(this.http.get<TransportMode[]>('/data/transport-modes.json')),
      firstValueFrom(this.http.get<RoutesDataset>('/data/routes.json')),
    ]);

    return {
      communes,
      places,
      alerts: alertsSeed.map((seed) => this.seedToAlert(seed)),
      modes,
      routes,
    };
  }

  /** Transforme le seed (updatedMinutesAgo) en TrafficAlert (updatedAt ISO). */
  private seedToAlert(seed: TrafficAlertSeed): TrafficAlert {
    const { updatedMinutesAgo, ...rest } = seed;
    return {
      ...rest,
      updatedAt: new Date(Date.now() - updatedMinutesAgo * 60_000).toISOString(),
    };
  }

  // Accès pratiques pour les autres services ---

  getCommuneById(id: string): Commune | undefined {
    return this.communes().find((c) => c.id === id);
  }

  getPlaceById(id: string): Place | undefined {
    return this.places().find((p) => p.id === id);
  }

  getModeById(id: string): TransportMode | undefined {
    return this.modesById()[id];
  }

  /** Trouve l'axe qui relie deux communes (dans un sens ou dans l'autre). */
  findAxis(from: string, to: string): RouteAxis | undefined {
    const routes = this.routes();
    if (!routes) return undefined;

    return routes.axes.find(
      (a) =>
        (a.from === from && a.to === to) || (a.bidirectional && a.from === to && a.to === from),
    );
  }

  /** Période de trafic en cours (selon l'heure locale). */
  currentTrafficPeriod(at: Date = new Date()): TrafficPeriod | null {
    const routes = this.routes();
    if (!routes) return null;

    const minutes = at.getHours() * 60 + at.getMinutes();
    for (const period of routes.trafficPeriods) {
      const [fh, fm] = period.from.split(':').map(Number);
      const [th, tm] = period.to.split(':').map(Number);
      const start = fh * 60 + fm;
      const end = th * 60 + tm;

      if (start <= end) {
        if (minutes >= start && minutes < end) return period;
      } else {
        // Période qui passe minuit (ex. 22:00 → 05:30)
        if (minutes >= start || minutes < end) return period;
      }
    }
    return null;
  }

  /** Facteur week-end (samedi/dimanche). */
  weekendFactor(at: Date = new Date()): number {
    const routes = this.routes();
    if (!routes) return 1;
    const day = at.getDay(); // 0 = dimanche, 6 = samedi
    return day === 0 || day === 6 ? routes.weekendFactor : 1;
  }
}
