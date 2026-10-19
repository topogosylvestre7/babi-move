import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { GeoPoint } from '../models/models';

export interface RouteGeometry {
  /** Points [lat, lng] prêts pour Leaflet. */
  points: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Routing réel via OSRM public.
 * Doc : https://project-osrm.org/docs/v5.24.0/api/
 */
@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly http = inject(HttpClient);
  private readonly base = 'https://router.project-osrm.org/route/v1';
  private cache = new Map<string, RouteGeometry>();

  /**
   * Récupère la géométrie d'un trajet.
   * @param profile 'driving' (défaut) ou 'foot' pour la marche
   */
  async getRoute(
    from: GeoPoint,
    to: GeoPoint,
    profile: 'driving' | 'foot' = 'driving',
  ): Promise<RouteGeometry | null> {
    const key = `${profile}:${from.lat},${from.lng}:${to.lat},${to.lng}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    // OSRM attend : lon,lat;lon,lat
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;

    try {
      const params = new HttpParams()
        .set('overview', 'full')
        .set('geometries', 'geojson')
        .set('alternatives', 'false');

      const url = `${this.base}/${profile}/${coords}`;
      const res = await firstValueFrom(this.http.get<OsrmResponse>(url, { params }));

      if (!res.routes || res.routes.length === 0) return null;

      const route = res.routes[0];
      // GeoJSON = [lng, lat] → Leaflet = [lat, lng]
      const points: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );

      const geometry: RouteGeometry = {
        points,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
      };

      this.cache.set(key, geometry);
      return geometry;
    } catch {
      return null;
    }
  }
}

interface OsrmResponse {
  code: string;
  routes: Array<{
    geometry: {
      coordinates: [number, number][]; // [lng, lat]
      type: 'LineString';
    };
    distance: number;
    duration: number;
  }>;
}
