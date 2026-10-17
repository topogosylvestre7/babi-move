import { Injectable, inject } from '@angular/core';

import {
  Commune,
  CommuneId,
  GeoPoint,
  Itinerary,
  ItineraryStep,
  ItineraryTag,
  RouteAxis,
  SearchQuery,
  TransportMode,
  TransportModeId,
  Waypoint,
} from '../models/models';
import { DataService } from './data';
import { AlertService } from './alert';

/**
 * Moteur de calcul d'itinéraires multimodaux.
 * - Cherche d'abord un axe défini dans routes.json.
 * - Sinon, génère des itinéraires de secours à partir des modes fallbackEligible.
 * - Applique le facteur de période (pointe matin/soir…) + le facteur week-end.
 * - Attache les alertes qui touchent les communes traversées.
 */
@Injectable({ providedIn: 'root' })
export class ItineraryService {
  private readonly data = inject(DataService);
  private readonly alerts = inject(AlertService);

  /**
   * Point d'entrée : renvoie 3 à 5 itinéraires classés, avec étiquettes et alertes.
   * Le tri final (par durée ou coût) est appliqué par le composant selon le critère choisi.
   */
  search(query: SearchQuery): Itinerary[] {
    const { origin, destination } = query;
    if (!origin || !destination) return [];

    const departureDate = this.resolveDepartureDate(query.departureAt);
    const period = this.data.currentTrafficPeriod(departureDate);
    const weekendFactor = this.data.weekendFactor(departureDate);

    // 1) Axe défini ?
    const fromCommune = this.matchCommune(origin);
    const toCommune = this.matchCommune(destination);
    const axis =
      fromCommune && toCommune ? this.data.findAxis(fromCommune.id, toCommune.id) : undefined;

    let itineraries: Itinerary[];

    if (axis) {
      itineraries = this.fromAxis(
        axis,
        origin,
        destination,
        departureDate,
        period?.factor ?? 1,
        weekendFactor,
      );
    } else {
      itineraries = this.fromFallback(
        origin,
        destination,
        departureDate,
        period?.factor ?? 1,
        weekendFactor,
      );
    }

    // 2) Retire les modes exclus
    const excluded = query.excludedModes ?? [];
    itineraries = itineraries.filter((it) => !it.steps.some((s) => excluded.includes(s.mode)));

    // 3) Tags + alertes
    this.assignTags(itineraries);

    return itineraries;
  }

  // ============================================================
  // Construction depuis un axe défini
  // ============================================================

  private fromAxis(
    axis: RouteAxis,
    origin: Waypoint,
    destination: Waypoint,
    departureDate: Date,
    periodFactor: number,
    weekendFactor: number,
  ): Itinerary[] {
    const communes: CommuneId[] = [axis.from, axis.to, ...axis.via];

    return axis.modes.map((offer) => {
      const mode = this.data.getModeById(offer.mode);
      const durationMin = this.adjustDuration(offer.durationMin, mode, periodFactor, weekendFactor);

      const step: ItineraryStep = {
        mode: offer.mode,
        from: origin,
        to: destination,
        costFcfa: Math.round((offer.costMinFcfa + offer.costMaxFcfa) / 2),
        durationMin,
        instruction: this.instructionFor(offer.mode, origin.label, destination.label),
      };

      return this.buildItinerary(
        [step],
        origin,
        destination,
        departureDate,
        offer.costMinFcfa,
        offer.costMaxFcfa,
        durationMin,
        offer.transfers,
        mode?.comfort ?? 3,
        communes,
      );
    });
  }

  // ============================================================
  // Itinéraires de secours (pas d'axe défini)
  // ============================================================

  private fromFallback(
    origin: Waypoint,
    destination: Waypoint,
    departureDate: Date,
    periodFactor: number,
    weekendFactor: number,
  ): Itinerary[] {
    const km = this.haversineKm(origin.position, destination.position);
    const routes = this.data.routes();
    const fallback = routes?.fallback ?? {
      roadFactor: 1.35,
      fareSpread: { min: 0.9, max: 1.2 },
    };

    const distanceOnRoad = km * fallback.roadFactor;
    const itineraries: Itinerary[] = [];

    // Propose chaque mode fallbackEligible compatible avec la distance.
    for (const mode of this.data.modes()) {
      if (!mode.fallbackEligible) continue;
      if (mode.maxDistanceKm && distanceOnRoad > mode.maxDistanceKm) continue;

      const baseDuration = (distanceOnRoad / mode.avgSpeedKmh) * 60 + mode.waitMin;
      const durationMin = this.adjustDuration(
        Math.round(baseDuration),
        mode,
        periodFactor,
        weekendFactor,
      );

      const baseCost = mode.baseFareFcfa + mode.farePerKmFcfa * distanceOnRoad;
      const costMin = Math.round(baseCost * fallback.fareSpread.min);
      const costMax = Math.round(baseCost * fallback.fareSpread.max);

      const step: ItineraryStep = {
        mode: mode.id,
        from: origin,
        to: destination,
        costFcfa: Math.round((costMin + costMax) / 2),
        durationMin,
        instruction: this.instructionFor(mode.id, origin.label, destination.label),
      };

      itineraries.push(
        this.buildItinerary(
          [step],
          origin,
          destination,
          departureDate,
          costMin,
          costMax,
          durationMin,
          0,
          mode.comfort,
          [], // communes inconnues
        ),
      );
    }

    // Toujours proposer la marche si < 3 km à vol d'oiseau.
    if (km < 3 && !itineraries.some((i) => i.steps[0].mode === 'marche')) {
      const marcheMode = this.data.getModeById('marche');
      const durationMin = Math.round((km / 5) * 60);
      const step: ItineraryStep = {
        mode: 'marche',
        from: origin,
        to: destination,
        costFcfa: 0,
        durationMin,
        instruction: `Marche jusqu'à ${destination.label}`,
      };
      itineraries.push(
        this.buildItinerary(
          [step],
          origin,
          destination,
          departureDate,
          0,
          0,
          durationMin,
          0,
          2,
          [],
        ),
      );
    }

    return itineraries.slice(0, 5);
  }

  // ============================================================
  // Construction d'un Itinerary complet
  // ============================================================

  private buildItinerary(
    steps: ItineraryStep[],
    origin: Waypoint,
    destination: Waypoint,
    departureDate: Date,
    costMin: number,
    costMax: number,
    durationMin: number,
    transfers: number,
    comfort: number,
    communes: CommuneId[],
  ): Itinerary {
    const impactful = this.alerts.impactfulForCommunes(communes);
    const alertsForItinerary = impactful.map((a) => a.id);

    return {
      id: `it-${Math.random().toString(36).slice(2, 9)}`,
      origin,
      destination,
      departureAt: departureDate.toISOString(),
      steps,
      costMinFcfa: costMin,
      costMaxFcfa: costMax,
      durationMin,
      transfers,
      comfort: comfort as 1 | 2 | 3 | 4 | 5,
      tags: [],
      alertIds: alertsForItinerary,
      isEstimate: true,
    };
  }

  // ============================================================
  // Étiquettes automatiques
  // ============================================================

  private assignTags(itineraries: Itinerary[]): void {
    if (itineraries.length === 0) return;

    const cheapest = [...itineraries].sort((a, b) => a.costMinFcfa - b.costMinFcfa)[0];
    const fastest = [...itineraries].sort((a, b) => a.durationMin - b.durationMin)[0];
    const comfiest = [...itineraries].sort((a, b) => b.comfort - a.comfort)[0];

    cheapest.tags = [...cheapest.tags, 'cheapest'];
    fastest.tags = [...fastest.tags, 'fastest'];
    comfiest.tags = [...comfiest.tags, 'most-comfortable'];
  }

  // ============================================================
  // Facteur de trafic
  // ============================================================

  private adjustDuration(
    baseMin: number,
    mode: TransportMode | undefined,
    periodFactor: number,
    weekendFactor: number,
  ): number {
    if (!mode) return Math.round(baseMin);
    const sensitivity = mode.trafficSensitivity;
    const periodEffect = 1 + (periodFactor - 1) * sensitivity;
    return Math.max(1, Math.round(baseMin * periodEffect * weekendFactor));
  }

  // ============================================================
  // Helpers
  // ============================================================

  private matchCommune(wp: Waypoint): Commune | undefined {
    const lower = wp.label.toLowerCase();
    return this.data.communes().find((c) => lower.includes(c.name.toLowerCase()));
  }

  private instructionFor(mode: TransportModeId, fromLabel: string, toLabel: string): string {
    const modeLabel = this.data.getModeById(mode)?.label ?? mode;
    switch (mode) {
      case 'marche':
        return `Marche jusqu'à ${toLabel}`;
      case 'bateau-bus':
        return `Prends le bateau-bus jusqu'à ${toLabel}`;
      default:
        return `Prends le ${modeLabel} jusqu'à ${toLabel}`;
    }
  }

  private resolveDepartureDate(at: SearchQuery['departureAt']): Date {
    if (at === 'now') return new Date();
    const d = new Date(at);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  private haversineKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ============================================================
  // Utilitaires publics pour l'UI
  // ============================================================

  /** Applique un tri selon le critère demandé. */
  sort(itineraries: Itinerary[], by: 'duration' | 'cost'): Itinerary[] {
    const copy = [...itineraries];
    if (by === 'cost') return copy.sort((a, b) => a.costMinFcfa - b.costMinFcfa);
    return copy.sort((a, b) => a.durationMin - b.durationMin);
  }

  /** Heure d'arrivée estimée au format HH:MM. */
  arrivalTime(itinerary: Itinerary): string {
    const d = new Date(itinerary.departureAt);
    d.setMinutes(d.getMinutes() + itinerary.durationMin);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * Retire les modes exclus et recalcule les étiquettes (plus rapide / moins cher / confort)
   * sur les trajets restants. Ne modifie pas la liste d'origine : les ids restent stables,
   * ce qui permet de basculer « Lagune incluse » instantanément, sans recalcul.
   */
  filterAndTag(itineraries: Itinerary[], excludedModes: readonly string[]): Itinerary[] {
    const kept = itineraries
      .filter((it) => !it.steps.some((s) => excludedModes.includes(s.mode)))
      .map((it) => ({ ...it, tags: [] as ItineraryTag[] }));
    this.assignTags(kept);
    return kept;
  }
}
