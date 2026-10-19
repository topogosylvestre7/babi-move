import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Commune, GeoPoint, Place, Waypoint } from '../models/models';
import { DataService } from './data';

/** Résultat d'autocomplétion, prêt à être affiché dans une liste. */
export interface Suggestion {
  id: string;
  label: string;
  detail: string;
  position: GeoPoint;
  source: 'place' | 'commune' | 'nominatim';
  placeId?: string;
  communeId?: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Autocomplétion et reverse geocoding.
 * - Priorité aux lieux locaux (rapides, sans réseau).
 * - Fallback sur Nominatim (OpenStreetMap) si aucun résultat local.
 * - Nominatim est limité à ~1 req/s : on ne l'appelle qu'à la demande.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly data = inject(DataService);

  private readonly _suggestions = signal<Suggestion[]>([]);
  private readonly _loading = signal(false);

  readonly suggestions = this._suggestions.asReadonly();
  readonly loading = this._loading.asReadonly();

  /**
   * Recherche des suggestions pour la saisie utilisateur.
   * Ne fait rien si la requête est trop courte (< 2 caractères).
   */
  async search(query: string, limit = 6): Promise<Suggestion[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      this._suggestions.set([]);
      return [];
    }

    // 1) Lieux locaux
    const local = this.searchLocal(q, limit);

    // 2) Si pas assez de résultats, complète avec Nominatim
    if (local.length < limit) {
      this._loading.set(true);
      try {
        const remote = await this.searchNominatim(q, limit - local.length);
        const merged = this.dedupe([...local, ...remote]).slice(0, limit);
        this._suggestions.set(merged);
        return merged;
      } catch {
        // En cas d'échec réseau, on garde au moins le local.
        this._suggestions.set(local);
        return local;
      } finally {
        this._loading.set(false);
      }
    }

    this._suggestions.set(local);
    return local;
  }

  clear(): void {
    this._suggestions.set([]);
  }

  /**
   * Transforme un point en libellé lisible.
   * Essaie d'abord de matcher un lieu connu ; sinon Nominatim ; sinon coordonnées.
   */
  async reverse(point: GeoPoint): Promise<string> {
    // 1) Lieu connu proche (< 200 m)
    const near = this.findPlaceNear(point, 200);
    if (near) return `${near.name} (${this.communeName(near.commune)})`;

    // 2) Nominatim
    try {
      const params = new HttpParams()
        .set('lat', String(point.lat))
        .set('lon', String(point.lng))
        .set('format', 'jsonv2')
        .set('zoom', '16')
        .set('addressdetails', '1');

      const res = await firstValueFrom(
        this.http.get<NominatimReverse[]>(`${NOMINATIM_URL}/reverse`, { params }),
      );
      const first = res[0];
      if (first?.display_name) return first.display_name;
    } catch {
      // Ignore : on retombe sur les coordonnées.
    }

    return `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
  }

  /** Construit un Waypoint à partir d'un lieu local. */
  waypointFromPlace(place: Place): Waypoint {
    return {
      label: `${place.name} (${this.communeName(place.commune)})`,
      position: place.position,
      placeId: place.id,
      source: 'place',
    };
  }

  /** Construit un Waypoint à partir d'une suggestion. */
  waypointFromSuggestion(s: Suggestion): Waypoint {
    return {
      label: s.label,
      position: s.position,
      placeId: s.placeId,
      source: s.source === 'nominatim' ? 'map' : 'place',
    };
  }

  /**
   * Résout un texte libre en Waypoint, du plus fiable au moins précis :
   * commune exacte → lieu connu → Nominatim → commune citée dans le texte.
   */
  async resolve(text: string): Promise<Waypoint | null> {
    const norm = this.normalize(text);
    if (!norm) return null;

    const communes = this.data.communes();
    const places = this.data.places();

    const communeExact = communes.find((c) => this.normalize(c.name) === norm);
    if (communeExact) {
      return { label: communeExact.name, position: communeExact.center, source: 'place' };
    }

    const placeExact = places.find((p) => this.normalize(p.name) === norm);
    if (placeExact) return this.waypointFromPlace(placeExact);

    const placeIn = places.find((p) => this.containsPhrase(norm, this.normalize(p.name)));
    if (placeIn) return this.waypointFromPlace(placeIn);

    const results = await this.search(text);
    if (results.length > 0) return this.waypointFromSuggestion(results[0]);

    const communeIn = communes.find((c) => this.containsPhrase(norm, this.normalize(c.name)));
    return communeIn
      ? { label: communeIn.name, position: communeIn.center, source: 'place' }
      : null;
  }

  /** Minuscules, sans accents ni ponctuation : « Angré 8ème » → « angre 8eme ». */
  private normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** `needle` apparaît-il comme mot(s) entier(s) dans `haystack` ? */
  private containsPhrase(haystack: string, needle: string): boolean {
    return !!needle && ` ${haystack} `.includes(` ${needle} `);
  }

  // Interne 

  private searchLocal(q: string, limit: number): Suggestion[] {
    const places = this.data.places();
    const communes = this.data.communes();

    const placeMatches: Suggestion[] = places
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, limit)
      .map((p) => ({
        id: `place:${p.id}`,
        label: p.name,
        detail: this.communeName(p.commune),
        position: p.position,
        source: 'place',
        placeId: p.id,
        communeId: p.commune,
      }));

    // Complète avec les communes si on n'a pas atteint la limite.
    if (placeMatches.length >= limit) return placeMatches;

    const communeMatches: Suggestion[] = communes
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, limit - placeMatches.length)
      .map((c) => ({
        id: `commune:${c.id}`,
        label: c.name,
        detail: 'Commune',
        position: c.center,
        source: 'commune',
        communeId: c.id,
      }));

    return [...placeMatches, ...communeMatches];
  }

  private async searchNominatim(q: string, limit: number): Promise<Suggestion[]> {
    const params = new HttpParams()
      .set('q', `${q}, Abidjan, Côte d'Ivoire`)
      .set('format', 'jsonv2')
      .set('limit', String(limit))
      .set('addressdetails', '1');

    const res = await firstValueFrom(
      this.http.get<NominatimSearch[]>(`${NOMINATIM_URL}/search`, { params }),
    );

    return res.map((r) => ({
      id: `nominatim:${r.place_id}`,
      label: r.name || r.display_name.split(',')[0],
      detail: r.display_name,
      position: { lat: Number(r.lat), lng: Number(r.lon) },
      source: 'nominatim' as const,
    }));
  }

  private findPlaceNear(point: GeoPoint, maxMeters: number): Place | undefined {
    let best: Place | undefined;
    let bestDist = Infinity;

    for (const p of this.data.places()) {
      const d = this.haversineMeters(point, p.position);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    return bestDist <= maxMeters ? best : undefined;
  }

  private communeName(id: string): string {
    return this.data.getCommuneById(id)?.name ?? id;
  }

  /** Distance approximative en mètres entre deux points. */
  private haversineMeters(a: GeoPoint, b: GeoPoint): number {
    const R = 6_371_000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  private dedupe(list: Suggestion[]): Suggestion[] {
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of list) {
      const key = s.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }
}

// Types Nominatim (partiels, on ne garde que ce qu'on utilise)
interface NominatimSearch {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
}

interface NominatimReverse {
  display_name: string;
}
