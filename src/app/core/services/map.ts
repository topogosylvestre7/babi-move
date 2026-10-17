import { Injectable } from '@angular/core';
import * as L from 'leaflet';

export interface MapPoint {
  lat: number;
  lng: number;
  label: string;
  kind?: 'origin' | 'destination' | 'place';
}

export interface MapAlert {
  lat: number;
  lng: number;
  radiusMeters: number;
  color: string;
  label: string;
}

/**
 * Wrapper Leaflet.
 * - Init/destroy proprement (Angular lifecycle).
 * - Marqueurs custom via divIcon pour cohérence visuelle Babi Move.
 * - Cercle d'alerte optionnel.
 * - Overlays TomTom (trafic + incidents) optionnels.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private map: L.Map | null = null;
  private layerGroup: L.LayerGroup | null = null;
  private routeLine: L.Polyline | null = null;
  private circles: L.Circle[] = [];
  private tomtomOverlays: L.TileLayer[] = [];

  init(element: HTMLElement, center: [number, number] = [5.36, -4.01], zoom = 12): void {
    this.destroy();
    this.map = L.map(element, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  setPoints(origin: MapPoint, destination: MapPoint, routePoints?: [number, number][]): void {
    if (!this.map || !this.layerGroup) return;
    this.layerGroup.clearLayers();

    const startIcon = L.divIcon({
      className: '',
      html: '<div class="bm-pin bm-pin--start"><i class="bi bi-geo-alt-fill"></i></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
    const endIcon = L.divIcon({
      className: '',
      html: '<div class="bm-pin bm-pin--end"><i class="bi bi-geo-alt-fill"></i></div>',
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    L.marker([origin.lat, origin.lng], { icon: startIcon })
      .bindPopup(`<strong>Départ</strong><br>${origin.label}`)
      .addTo(this.layerGroup);
    L.marker([destination.lat, destination.lng], { icon: endIcon })
      .bindPopup(`<strong>Destination</strong><br>${destination.label}`)
      .addTo(this.layerGroup);

    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }

    const lineCoords: [number, number][] =
      routePoints && routePoints.length > 1
        ? routePoints
        : [
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          ];

    const isRealRoute = routePoints && routePoints.length > 1;

    this.routeLine = L.polyline(lineCoords, {
      color: '#006c47',
      weight: isRealRoute ? 5 : 4,
      opacity: isRealRoute ? 0.9 : 0.6,
      dashArray: isRealRoute ? undefined : '8 8',
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(this.map);

    const bounds = L.latLngBounds(lineCoords);
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }

  clearRoute(): void {
    if (this.map && this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  setAlertCircles(alerts: MapAlert[]): void {
    if (!this.map) return;

    this.circles.forEach((c) => this.map!.removeLayer(c));
    this.circles = [];

    for (const a of alerts) {
      const circle = L.circle([a.lat, a.lng], {
        radius: a.radiusMeters,
        color: a.color,
        fillColor: a.color,
        fillOpacity: 0.15,
        weight: 2,
      })
        .bindPopup(a.label)
        .addTo(this.map);
      this.circles.push(circle);
    }
  }

  setUserMarker(point: MapPoint): void {
    if (!this.map || !this.layerGroup) return;

    const icon = L.divIcon({
      className: '',
      html: '<div class="bm-pin bm-pin--user"><i class="bi bi-crosshair"></i></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    L.marker([point.lat, point.lng], { icon }).bindPopup('Ta position').addTo(this.layerGroup);

    this.map.setView([point.lat, point.lng], 14);
  }

  invalidate(): void {
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  destroy(): void {
    if (this.map) {
      this.tomtomOverlays.forEach((l) => this.map!.removeLayer(l));
      this.tomtomOverlays = [];
      this.circles = [];
      this.routeLine = null;
      this.layerGroup = null;
      this.map.remove();
      this.map = null;
    }
  }
}
