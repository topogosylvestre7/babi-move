import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DataService } from '../../../core/services/data';
import { AlertService } from '../../../core/services/alert';
import { ItineraryService } from '../../../core/services/itinerary';
import { GeolocationService } from '../../../core/services/geolocation';
import { GeocodingService, Suggestion } from '../../../core/services/geocoding';
import { MapService } from '../../../core/services/map';
import { RoutingService } from '../../../core/services/routing';
import { ItineraryStoreService } from '../../../core/services/itinerary-store';
import { StorageService } from '../../../core/services/storage';
import { HistoryService } from '../../../core/services/history';
import {
  Commune,
  Itinerary,
  ItineraryTag,
  Place,
  SortCriterion,
  Waypoint,
} from '../../../core/models/models';

interface NearbyPlace {
  place: Place;
  distanceKm: number;
  communeName: string;
}

interface RecentSearch {
  from: Waypoint;
  to: Waypoint;
}

type Field = 'origin' | 'destination';
type DepartureMode = 'now' | '30min' | '2h';

const LAGUNE_MODE = 'bateau-bus';
const RECENT_KEY = 'recent-searches';
const RECENT_MAX = 4;

@Component({
  selector: 'ui-result',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './result.html',
  styleUrl: './result.scss',
})
export class Result implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(DataService);
  private readonly alerts = inject(AlertService);
  private readonly itinerary = inject(ItineraryService);
  private readonly geocoding = inject(GeocodingService);
  private readonly geolocation = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly routing = inject(RoutingService);
  private readonly storage = inject(StorageService);
  private readonly store = inject(ItineraryStoreService);
  private readonly historyService = inject(HistoryService);

  @ViewChild('mapHost', { static: false })
  mapHost?: ElementRef<HTMLDivElement>;

  private mapInitialized = false;
  private computeToken = 0;
  private mapToken = 0;

  readonly loaded = this.data.loaded;
  readonly loadError = this.data.error;
  readonly modesById = this.data.modesById;
  readonly popularCommunes = this.data.popularCommunes;
  readonly allCommunes = this.data.communes;
  readonly alertCount = computed(() => this.data.alerts().length);
  readonly topAlerts = computed(() => this.alerts.topN(3));

  readonly origin = signal<Waypoint | null>(null);
  readonly destination = signal<Waypoint | null>(null);
  readonly originText = signal('');
  readonly destinationText = signal('');
  readonly activeField = signal<Field | null>(null);
  readonly lastField = signal<Field>('origin');
  readonly suggestions = this.geocoding.suggestions;

  readonly sortBy = signal<SortCriterion>('duration');
  readonly searching = signal(false);
  readonly locating = signal(false);
  readonly formError = signal('');
  readonly locationError = signal('');

  readonly departureMode = signal<DepartureMode>('now');
  readonly includeLagune = signal(true);
  readonly showAllCommunes = signal(false);

  readonly recents = signal<RecentSearch[]>([]);

  readonly allItineraries = signal<Itinerary[]>([]);
  readonly selectedItineraryId = signal<string | null>(null);
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());

  readonly laguneCount = computed(
    () => this.allItineraries().filter((it) => it.steps.some((s) => s.mode === LAGUNE_MODE)).length,
  );

  readonly laguneUnavailable = computed(
    () => this.allItineraries().length > 0 && this.laguneCount() === 0,
  );

  readonly visibleItineraries = computed(() =>
    this.itinerary.filterAndTag(this.allItineraries(), this.includeLagune() ? [] : [LAGUNE_MODE]),
  );

  readonly hiddenCount = computed(
    () => this.allItineraries().length - this.visibleItineraries().length,
  );

  readonly sortedItineraries = computed(() =>
    this.itinerary.sort(this.visibleItineraries(), this.sortBy()),
  );

  readonly selectedItinerary = computed<Itinerary | null>(() => {
    const list = this.sortedItineraries();
    return list.find((it) => it.id === this.selectedItineraryId()) ?? list[0] ?? null;
  });

  readonly summary = computed(() => {
    const list = this.sortedItineraries();
    if (list.length === 0) return null;
    return {
      count: list.length,
      fastest: Math.min(...list.map((i) => i.durationMin)),
      cheapest: Math.min(...list.map((i) => i.costMinFcfa)),
    };
  });

  readonly nearbyLoading = signal(false);
  readonly nearbyLoaded = signal(false);
  readonly nearbyPlaces = signal<NearbyPlace[]>([]);
  readonly userPosition = signal<{ lat: number; lng: number } | null>(null);
  readonly nearbyFilter = signal<'tous' | 'gare' | 'marche' | 'quartier'>('tous');

  readonly nearbyFiltered = computed(() => {
    const list = this.nearbyPlaces();
    const f = this.nearbyFilter();
    return f === 'tous' ? list : list.filter((n) => n.place.type === f);
  });

  constructor() {
    effect(() => {
      const o = this.origin();
      const d = this.destination();
      const it = this.selectedItinerary();
      untracked(() => void this.updateMap(o, d, it));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.data.load();
    this.recents.set(this.storage.read<RecentSearch[]>(RECENT_KEY) ?? []);

    const params = this.route.snapshot.queryParamMap;
    const num = (key: string): number => {
      const v = params.get(key);
      return v === null || v === '' ? NaN : Number(v);
    };
    const fromLabel = params.get('fromLabel') ?? '';
    const toLabel = params.get('toLabel') ?? '';
    const fromLat = num('fromLat');
    const fromLng = num('fromLng');
    const toLat = num('toLat');
    const toLng = num('toLng');

    if ([fromLat, fromLng, toLat, toLng].every(Number.isFinite) && fromLabel && toLabel) {
      this.setField('origin', {
        label: fromLabel,
        position: { lat: fromLat, lng: fromLng },
        source: 'place',
      });
      this.setField('destination', {
        label: toLabel,
        position: { lat: toLat, lng: toLng },
        source: 'place',
      });
      this.compute();
    }
  }

  ngAfterViewInit(): void {
    const el = this.mapHost?.nativeElement;
    if (!el || this.mapInitialized) return;

    setTimeout(() => {
      this.mapService.init(el);
      this.mapInitialized = true;
      this.mapService.invalidate();
      void this.updateMap(this.origin(), this.destination(), this.selectedItinerary());
    }, 60);
  }

  ngOnDestroy(): void {
    this.computeToken++;
    this.mapToken++;
    this.mapService.destroy();
    this.mapInitialized = false;
  }

  private setField(field: Field, wp: Waypoint | null, text?: string): void {
    if (field === 'origin') {
      this.origin.set(wp);
      this.originText.set(text ?? wp?.label ?? '');
    } else {
      this.destination.set(wp);
      this.destinationText.set(text ?? wp?.label ?? '');
    }
  }

  private otherField(field: Field): Field {
    return field === 'origin' ? 'destination' : 'origin';
  }

  onFocus(field: Field): void {
    this.lastField.set(field);
  }

  onOriginInput(value: string): void {
    this.setField('origin', null, value);
    this.activeField.set('origin');
    this.formError.set('');
    void this.geocoding.search(value);
  }

  onDestinationInput(value: string): void {
    this.setField('destination', null, value);
    this.activeField.set('destination');
    this.formError.set('');
    void this.geocoding.search(value);
  }

  selectSuggestion(s: Suggestion): void {
    const wp = this.geocoding.waypointFromSuggestion(s);
    const field = this.activeField();

    if (field) {
      this.setField(field, wp);
      this.lastField.set(this.otherField(field));
    }

    this.geocoding.clear();
    this.activeField.set(null);
    this.compute();
  }

  onBlur(): void {
    setTimeout(async () => {
      let changed = false;

      if (!this.origin() && this.originText().trim().length >= 2) {
        const wp = await this.geocoding.resolve(this.originText());
        if (wp) {
          this.setField('origin', wp);
          changed = true;
        }
      }
      if (!this.destination() && this.destinationText().trim().length >= 2) {
        const wp = await this.geocoding.resolve(this.destinationText());
        if (wp) {
          this.setField('destination', wp);
          changed = true;
        }
      }

      this.activeField.set(null);
      this.geocoding.clear();
      if (changed) this.compute();
    }, 180);
  }

  swap(): void {
    const o = this.origin();
    const d = this.destination();
    const ot = this.originText();
    const dt = this.destinationText();
    this.setField('origin', d, dt);
    this.setField('destination', o, ot);
    this.compute();
  }

  async useMyPosition(): Promise<void> {
    this.locationError.set('');
    this.locating.set(true);
    const result = await this.geolocation.getCurrentPosition();

    if (!result.ok) {
      this.locating.set(false);
      this.locationError.set(this.geolocation.messageFor(result.error));
      return;
    }

    const label = await this.geocoding.reverse(result.position);
    this.locating.set(false);
    this.setField('origin', { label, position: result.position, source: 'geolocation' });
    this.lastField.set('destination');
    this.compute();
  }

  usePopularCommune(c: Commune): void {
    const wp: Waypoint = { label: c.name, position: c.center, source: 'place' };
    const target: Field = this.lastField();
    this.setField(target, wp);
    this.lastField.set(this.otherField(target));
    this.compute();
  }

  useNearbyPlace(place: Place): void {
    const wp: Waypoint = {
      label: place.name,
      position: place.position,
      placeId: place.id,
      source: 'place',
    };
    const target: Field = !this.destination() ? 'destination' : 'origin';
    this.setField(target, wp);
    this.compute();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  applyRecent(r: RecentSearch): void {
    this.setField('origin', r.from);
    this.setField('destination', r.to);
    this.compute();
  }

  clearRecents(): void {
    this.recents.set([]);
    this.storage.remove(RECENT_KEY);
  }

  toggleAllCommunes(): void {
    this.showAllCommunes.update((v) => !v);
  }

  setSort(criterion: SortCriterion): void {
    this.sortBy.set(criterion);
  }

  setDepartureMode(mode: DepartureMode): void {
    if (this.departureMode() === mode) return;
    this.departureMode.set(mode);
    this.compute();
  }

  toggleLagune(): void {
    this.includeLagune.update((v) => !v);
  }

  // ✅ Correction : ajout du paramètre explicit
  compute(explicit = false): void {
    const from = this.origin();
    const to = this.destination();

    if (!from || !to) {
      this.allItineraries.set([]);
      this.searching.set(false);
      this.formError.set(explicit ? 'Choisis un départ et une destination.' : '');
      return;
    }

    this.formError.set('');
    this.searching.set(true);
    const token = ++this.computeToken;

    setTimeout(() => {
      if (token !== this.computeToken) return;

      const results = this.itinerary.search({
        origin: from,
        destination: to,
        departureAt: this.resolveDepartureAt(),
        excludedModes: [],
        sortBy: this.sortBy(),
      });

      this.allItineraries.set(results);
      this.selectedItineraryId.set(null);
      this.expandedIds.set(new Set());
      this.searching.set(false);

      if (results.length > 0) {
        const best = results[0];
        this.historyService.addSearch(
          from,
          to,
          best.steps[0]?.mode ?? 'gbaka',
          best.costMinFcfa,
          best.durationMin,
          best.id,
        );
      }
    }, 250);
  }

  selectItinerary(it: Itinerary): void {
    this.selectedItineraryId.set(it.id);
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleDetails(it: Itinerary, event: Event): void {
    event.stopPropagation();
    this.selectedItineraryId.set(it.id);
    this.expandedIds.update((set) => {
      const next = new Set(set);
      if (next.has(it.id)) next.delete(it.id);
      else next.add(it.id);
      return next;
    });
  }

  startItinerary(it: Itinerary, event: Event): void {
    event.stopPropagation();
    this.store.save(it);
    this.router.navigate(['/itineraire', it.id], {
      queryParams: {
        fromLat: it.origin.position.lat,
        fromLng: it.origin.position.lng,
        fromLabel: it.origin.label,
        toLat: it.destination.position.lat,
        toLng: it.destination.position.lng,
        toLabel: it.destination.label,
        duration: it.durationMin,
        costMin: it.costMinFcfa,
        costMax: it.costMaxFcfa,
        mode: it.steps[0]?.mode ?? '',
        start: 1,
      },
    });
  }

  mapsUrl(it: Itinerary): string {
    const o = it.origin.position;
    const d = it.destination.position;
    return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}&travelmode=driving`;
  }

  private async updateMap(
    o: Waypoint | null,
    d: Waypoint | null,
    it: Itinerary | null,
  ): Promise<void> {
    if (!o || !d || !this.mapInitialized) return;

    const token = ++this.mapToken;
    const start = { lat: o.position.lat, lng: o.position.lng, label: o.label };
    const end = { lat: d.position.lat, lng: d.position.lng, label: d.label };

    this.mapService.setPoints(start, end);

    const zones = (it?.alertIds ?? [])
      .map((id) => this.alertById(id))
      .filter((a): a is NonNullable<typeof a> => !!a)
      .filter((a) => a.priority === 'critical' || a.priority === 'high')
      .map((a) => {
        const c = this.data.getCommuneById(a.communes[0]);
        if (!c) return null;
        return {
          lat: c.center.lat,
          lng: c.center.lng,
          radiusMeters: a.priority === 'critical' ? 900 : 600,
          color: a.priority === 'critical' ? '#ba1a1a' : '#a73a00',
          label: a.title,
        };
      })
      .filter((z): z is NonNullable<typeof z> => z !== null);
    this.mapService.setAlertCircles(zones);

    if (it?.steps[0]?.mode === LAGUNE_MODE) return;

    const geometry = await this.routing.getRoute(o.position, d.position, 'driving');
    if (geometry && token === this.mapToken) {
      this.mapService.setPoints(start, end, geometry.points);
    }
  }

  async loadNearby(): Promise<void> {
    this.nearbyLoading.set(true);
    this.nearbyLoaded.set(false);

    const result = await this.geolocation.getCurrentPosition();
    if (!result.ok) {
      this.locationError.set(this.geolocation.messageFor(result.error));
      this.nearbyLoading.set(false);
      return;
    }

    this.userPosition.set(result.position);

    const withDistance: NearbyPlace[] = this.data
      .places()
      .map((p) => ({
        place: p,
        distanceKm: this.haversineKm(result.position, p.position),
        communeName: this.data.getCommuneById(p.commune)?.name ?? p.commune,
      }))
      .filter((n) => n.distanceKm <= 5)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 12);

    this.nearbyPlaces.set(withDistance);
    this.nearbyLoading.set(false);
    this.nearbyLoaded.set(true);

    if (this.mapInitialized) {
      this.mapService.setUserMarker({
        lat: result.position.lat,
        lng: result.position.lng,
        label: 'Ta position',
      });
    }
  }

  setNearbyFilter(f: 'tous' | 'gare' | 'marche' | 'quartier'): void {
    this.nearbyFilter.set(f);
  }

  nearbyPlaceIcon(type: string): string {
    switch (type) {
      case 'gare':
        return 'bi-signpost-2-fill';
      case 'marche':
        return 'bi-basket-fill';
      case 'quartier':
        return 'bi-houses-fill';
      case 'universite':
        return 'bi-mortarboard-fill';
      case 'hopital':
        return 'bi-hospital-fill';
      default:
        return 'bi-geo-alt-fill';
    }
  }

  arrivalTime(it: Itinerary): string {
    return this.itinerary.arrivalTime(it);
  }

  modeLabel(mode: string): string {
    return this.modesById()[mode]?.label ?? mode;
  }

  modeColor(mode: string): string {
    return this.modesById()[mode]?.color ?? 'var(--em-muted)';
  }

  modeIcon(mode: string): string {
    return this.modesById()[mode]?.icon ?? 'bi-question';
  }

  tagLabel(tag: ItineraryTag): string {
    switch (tag) {
      case 'cheapest':
        return 'Le moins cher';
      case 'fastest':
        return 'Le plus rapide';
      case 'most-comfortable':
        return 'Le plus confortable';
    }
  }

  tagIcon(tag: ItineraryTag): string {
    switch (tag) {
      case 'cheapest':
        return 'bi-piggy-bank';
      case 'fastest':
        return 'bi-lightning-charge-fill';
      case 'most-comfortable':
        return 'bi-star-fill';
    }
  }

  alertTone(priority: string): 'critical' | 'high' | 'medium' | 'info' {
    return priority as 'critical' | 'high' | 'medium' | 'info';
  }

  alertTagLabel(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'Critique';
      case 'high':
        return 'Élevée';
      case 'medium':
        return 'Moyenne';
      default:
        return 'Info';
    }
  }

  alertById(id: string) {
    return this.data.alerts().find((a) => a.id === id);
  }

  private resolveDepartureAt(): 'now' | string {
    const mode = this.departureMode();
    if (mode === 'now') return 'now';
    const d = new Date();
    if (mode === '30min') d.setMinutes(d.getMinutes() + 30);
    else d.setHours(d.getHours() + 2);
    return d.toISOString();
  }

  private haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
