import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  effect,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { DataService } from '../../../core/services/data';
import { ItineraryService } from '../../../core/services/itinerary';
import { ItineraryStoreService } from '../../../core/services/itinerary-store';
import { MapService } from '../../../core/services/map';
import { RoutingService } from '../../../core/services/routing';
import { StorageService } from '../../../core/services/storage';
import { Itinerary, ItineraryStep, Waypoint } from '../../../core/models/models';
import { FavoriteService } from '../../../core/services/favorite';

type StepStatus = 'done' | 'current' | 'todo';
type ModeId = Itinerary['steps'][number]['mode'];

interface DisplayStep extends ItineraryStep {
  index: number;
  status: StepStatus;
  icon: string;
  color: string;
  modeLabel: string;
  startTime: string;
  endTime: string;
}

interface SavedGuidance {
  started: boolean;
  finished: boolean;
  step: number;
  startedAt: number | null;
}

interface QueryTrip {
  origin: Waypoint;
  destination: Waypoint;
  mode: string;
  durationMin: number;
  costMin: number;
  costMax: number;
}

const BOAT_MODE = 'bateau-bus';

@Component({
  selector: 'ui-itinerary-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './itinerary-detail.html',
  styleUrl: './itinerary-detail.scss',
})
export class ItineraryDetail implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly data = inject(DataService);
  private readonly itineraryService = inject(ItineraryService);
  private readonly store = inject(ItineraryStoreService);
  private readonly mapService = inject(MapService);
  private readonly routing = inject(RoutingService);
  private readonly storage = inject(StorageService);
  private readonly favoriteService = inject(FavoriteService);

  readonly canShare = signal(typeof navigator !== 'undefined' && 'share' in navigator);

  @ViewChild('mapHost', { static: false })
  mapHost?: ElementRef<HTMLDivElement>;

  private mapInitialized = false;
  private mapToken = 0;
  private timer: number | null = null;

  // État ---
  readonly itinerary = signal<Itinerary | null>(null);
  readonly notFound = signal(false);
  readonly currentStepIndex = signal(0);
  readonly started = signal(false);
  readonly finished = signal(false);
  readonly startedAt = signal<number | null>(null);
  readonly shareMenuOpen = signal(false);
  readonly copied = signal(false);
  readonly isFavorite = computed(() => {
    const it = this.itinerary();
    if (!it) return false;
    return this.favoriteService.isFavorite(it.origin, it.destination);
  });
  readonly distanceKm = signal<number | null>(null);

  private readonly now = signal(Date.now());
  private readonly cheaperAlt = signal<{ mode: string; cost: number } | null>(null);

  readonly loaded = this.data.loaded;

  // Heures ---
  private readonly baseTime = computed(() => {
    const it = this.itinerary();
    if (!it) return this.now();
    const startedAt = this.startedAt();
    if (this.started() && startedAt) return startedAt;
    const planned = new Date(it.departureAt).getTime();
    return Number.isFinite(planned) ? Math.max(planned, this.now()) : this.now();
  });

  readonly arrivalTime = computed(() => {
    const it = this.itinerary();
    return it ? this.clock(this.baseTime() + it.durationMin * 60_000) : '';
  });

  readonly departureTime = computed(() => this.clock(this.baseTime()));

  readonly remainingMin = computed<number | null>(() => {
    const it = this.itinerary();
    const startedAt = this.startedAt();
    if (!it || !startedAt || !this.started() || this.finished()) return null;
    const eta = startedAt + it.durationMin * 60_000;
    return Math.max(0, Math.ceil((eta - this.now()) / 60_000));
  });

  // Titre dynamique ---
  readonly title = computed(() => {
    const it = this.itinerary();
    if (!it) return '';
    const modes = it.steps.map((s) => s.mode);
    const hasBoat = modes.includes('bateau-bus');
    const hasWoro = modes.includes('woro-woro');
    const hasSotra = modes.includes('sotra');
    const hasGbaka = modes.includes('gbaka');
    const hasVtc = modes.includes('vtc');
    const hasMarche = modes.includes('marche');

    if (hasBoat && hasWoro) return 'Express Multimodal Lagune & Woro-woro';
    if (hasBoat && hasSotra) return 'Express Lagune & Bus SOTRA';
    if (hasBoat) return 'Trajet express par la lagune';
    if (hasVtc) return 'Trajet confort en VTC';
    if (hasSotra && hasGbaka) return 'Combiné Bus SOTRA & Gbaka';
    if (hasSotra) return 'Trajet en bus SOTRA';
    if (hasGbaka && hasWoro) return 'Combiné Gbaka & Woro-woro';
    if (hasWoro) return 'Trajet en Woro-woro';
    if (hasGbaka) return 'Trajet en Gbaka';
    if (hasMarche && it.steps.length === 1) return 'Trajet à pied';
    return 'Itinéraire multimodal';
  });

  readonly segments = computed(() => this.steps().length);
  readonly transferMin = computed(() => Math.max(0, (this.steps().length - 1) * 2));
  readonly isDirect = computed(() => this.steps().length <= 1);

  readonly co2Saving = computed(() => {
    const modes = this.itinerary()?.steps.map((s) => s.mode) ?? [];
    if (modes.includes('bateau-bus') || modes.includes('marche')) return 45;
    if (modes.includes('sotra')) return 30;
    return 15;
  });

  readonly comfortLabel = computed(() => {
    const c = this.itinerary()?.comfort ?? 3;
    if (c >= 5) return 'Excellent';
    if (c >= 4) return 'Élevé';
    if (c >= 3) return 'Correct';
    return 'Basique';
  });

  readonly reliability = computed(() => {
    const criticals = this.tripAlerts().filter((a) => a.priority === 'critical').length;
    const highs = this.tripAlerts().filter((a) => a.priority === 'high').length;
    return Math.max(60, 98 - criticals * 15 - highs * 8);
  });

  // Étapes ---
  readonly steps = computed<DisplayStep[]>(() => {
    const it = this.itinerary();
    if (!it) return [];

    const current = this.currentStepIndex();
    let cursor = this.baseTime();

    return it.steps.map((step, index) => {
      const mode = this.data.getModeById(step.mode);

      let status: StepStatus = 'todo';
      if (this.finished() || index < current) status = 'done';
      else if (index === current && this.started()) status = 'current';

      const start = cursor;
      const end = start + step.durationMin * 60_000;
      cursor = end;

      return {
        ...step,
        index,
        status,
        icon: mode?.icon ?? 'bi-question',
        color: mode?.color ?? 'var(--em-muted)',
        modeLabel: mode?.label ?? step.mode,
        startTime: this.clock(start),
        endTime: this.clock(end),
      };
    });
  });

  readonly progress = computed(() => {
    const total = this.steps().length;
    if (total === 0) return 0;
    if (this.finished()) return 100;
    return Math.round(((this.currentStepIndex() + 0.5) / total) * 100);
  });

  readonly currentStep = computed<DisplayStep | null>(() => {
    const list = this.steps();
    if (list.length === 0) return null;
    if (!this.started()) return list[0];
    return list[this.currentStepIndex()] ?? null;
  });

  // Alertes ---
  readonly tripAlerts = computed(() => {
    const it = this.itinerary();
    if (!it) return [];
    const all = this.data.alerts();
    return it.alertIds
      .map((id) => all.find((a) => a.id === id))
      .filter((a): a is NonNullable<typeof a> => !!a);
  });

  readonly alertDelay = computed(() =>
    Math.max(0, ...this.tripAlerts().map((a) => a.estimatedDurationMin ?? 0)),
  );

  // Budget ---
  readonly monthlyBudget = computed(() => {
    const it = this.itinerary();
    if (!it) return null;

    const mid = Math.round((it.costMinFcfa + it.costMaxFcfa) / 2);
    const daily = mid * 2;
    const monthly = daily * 22;

    const alt = this.cheaperAlt();
    const altMonthly = alt ? alt.cost * 2 * 22 : null;

    return {
      daily,
      monthly,
      alternative: alt
        ? {
            label: this.data.getModeById(alt.mode)?.label ?? alt.mode,
            perTrip: alt.cost,
            saving: monthly - (altMonthly ?? monthly),
          }
        : null,
    };
  });

  constructor() {
    // Redessine la carte dès que l'itinéraire ou l'étape change.
    // Corrige le bug où drawRoute était appelé avant le chargement des données.
    effect(() => {
      this.itinerary();
      this.currentStepIndex();
      this.started();
      this.finished();
      untracked(() => {
        if (this.mapInitialized) void this.drawRoute();
      });
    });
  }

  async ngOnInit(): Promise<void> {
    this.timer = window.setInterval(() => this.now.set(Date.now()), 30_000);

    await this.data.load();

    const id = this.route.snapshot.paramMap.get('id') ?? '';

    let it = this.store.get(id);
    if (!it) {
      it = this.rebuildFromQueryParams(id);
      if (it) this.store.save(it);
    }

    if (!it) {
      this.notFound.set(true);
      return;
    }

    this.itinerary.set(it);
    this.afterLoad(it);

    setTimeout(() => this.tryInitMap(), 0);
  }

  ngAfterViewInit(): void {
    this.tryInitMap();
  }

  ngOnDestroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.mapToken++;
    this.mapService.destroy();
    this.mapInitialized = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.shareMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.shareMenuOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.share-wrap')) this.shareMenuOpen.set(false);
  }

  // ============================================================
  // Init carte
  // ============================================================

  private tryInitMap(): void {
    const el = this.mapHost?.nativeElement;
    if (!el || this.mapInitialized) return;
    if (el.offsetHeight === 0) {
      setTimeout(() => this.tryInitMap(), 100);
      return;
    }

    this.mapInitialized = true;
    this.mapService.init(el);
    this.mapService.invalidate();
    void this.drawRoute();
  }

  // ============================================================
  // Chargement
  // ============================================================

  private afterLoad(it: Itinerary): void {
    const wantsStart = this.route.snapshot.queryParamMap.get('start') === '1';

    if (wantsStart) {
      this.startGuidance();
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { start: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } else {
      this.restoreGuidance(it);
    }

    this.findCheaperAlternative(it);
  }

  private restoreGuidance(it: Itinerary): void {
    const saved = this.storage.read<SavedGuidance>(this.guidanceKey(it.id));
    if (!saved?.started) return;

    const last = Math.max(0, it.steps.length - 1);
    this.started.set(true);
    this.finished.set(!!saved.finished);
    this.currentStepIndex.set(Math.min(Math.max(0, saved.step), last));
    this.startedAt.set(saved.startedAt);
  }

  private findCheaperAlternative(it: Itinerary): void {
    const results = this.itineraryService.search({
      origin: it.origin,
      destination: it.destination,
      departureAt: 'now',
      excludedModes: [],
      sortBy: 'cost',
    });
    const mid = (x: Itinerary) => Math.round((x.costMinFcfa + x.costMaxFcfa) / 2);
    const cheapest = [...results].sort((a, b) => mid(a) - mid(b))[0];

    this.cheaperAlt.set(
      cheapest && mid(cheapest) < mid(it)
        ? { mode: cheapest.steps[0]?.mode ?? '', cost: mid(cheapest) }
        : null,
    );
  }

  // ============================================================
  // Reconstruction depuis l'URL
  // ============================================================

  private parseQuery(): QueryTrip | null {
    const params = this.route.snapshot.queryParamMap;
    const num = (k: string): number => {
      const v = params.get(k);
      return v === null || v === '' ? NaN : Number(v);
    };

    const fromLat = num('fromLat');
    const fromLng = num('fromLng');
    const toLat = num('toLat');
    const toLng = num('toLng');
    const fromLabel = params.get('fromLabel');
    const toLabel = params.get('toLabel');

    if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite) || !fromLabel || !toLabel) {
      return null;
    }

    return {
      origin: { label: fromLabel, position: { lat: fromLat, lng: fromLng }, source: 'place' },
      destination: { label: toLabel, position: { lat: toLat, lng: toLng }, source: 'place' },
      mode: params.get('mode') || '',
      durationMin: num('duration') || 30,
      costMin: num('costMin') || 0,
      costMax: num('costMax') || 0,
    };
  }

  private rebuildFromQueryParams(id: string): Itinerary | null {
    const trip = this.parseQuery();
    if (!trip) return null;

    const results = this.itineraryService.search({
      origin: trip.origin,
      destination: trip.destination,
      departureAt: 'now',
      excludedModes: [],
      sortBy: 'duration',
    });

    if (results.length > 0) {
      const sorted = this.itineraryService.sort(results, 'duration');
      const match = sorted.find((r) => r.steps[0]?.mode === trip.mode) ?? sorted[0];
      return { ...match, id: id || match.id };
    }

    return {
      id: id || 'it-fallback',
      origin: trip.origin,
      destination: trip.destination,
      departureAt: new Date().toISOString(),
      steps: [
        {
          mode: (trip.mode || 'gbaka') as ModeId,
          from: trip.origin,
          to: trip.destination,
          costFcfa: Math.round((trip.costMin + trip.costMax) / 2),
          durationMin: trip.durationMin,
          instruction: `Rejoins ${trip.destination.label}`,
        },
      ],
      costMinFcfa: trip.costMin,
      costMaxFcfa: trip.costMax,
      durationMin: trip.durationMin,
      transfers: 0,
      comfort: 3,
      tags: [],
      alertIds: [],
      isEstimate: true,
    };
  }

  // ============================================================
  // Guidage
  // ============================================================

  private guidanceKey(id: string): string {
    return `guidance.${id}`;
  }

  private persist(): void {
    const it = this.itinerary();
    if (!it) return;
    const state: SavedGuidance = {
      started: this.started(),
      finished: this.finished(),
      step: this.currentStepIndex(),
      startedAt: this.startedAt(),
    };
    this.storage.write(this.guidanceKey(it.id), state);
  }

  startGuidance(): void {
    this.started.set(true);
    this.finished.set(false);
    this.currentStepIndex.set(0);
    this.startedAt.set(Date.now());
    this.persist();
  }

  nextStep(): void {
    const total = this.steps().length;
    const current = this.currentStepIndex();

    if (current < total - 1) this.currentStepIndex.set(current + 1);
    else this.finished.set(true);

    this.persist();
  }

  previousStep(): void {
    if (this.finished()) {
      this.finished.set(false);
    } else if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
    this.persist();
  }

  restart(): void {
    this.started.set(false);
    this.finished.set(false);
    this.currentStepIndex.set(0);
    this.startedAt.set(null);
    const it = this.itinerary();
    if (it) this.storage.remove(this.guidanceKey(it.id));
  }

  goBack(): void {
    const it = this.itinerary();
    this.router.navigate(['/resultats'], {
      queryParams: it
        ? {
            fromLat: it.origin.position.lat,
            fromLng: it.origin.position.lng,
            fromLabel: it.origin.label,
            toLat: it.destination.position.lat,
            toLng: it.destination.position.lng,
            toLabel: it.destination.label,
          }
        : {},
    });
  }

  toggleFavorite(): void {
    const it = this.itinerary();
    if (!it) return;

    this.favoriteService.toggle(
      it.origin,
      it.destination,
      it.steps[0]?.mode ?? 'gbaka',
      it.costMinFcfa,
      it.durationMin,
    );
  }

  // ============================================================
  // Partage
  // ============================================================

  toggleShare(): void {
    this.shareMenuOpen.update((v) => !v);
  }

  shareUrl(): string {
    return window.location.href;
  }

  private shareText(): string {
    const it = this.itinerary();
    if (!it) return '';
    return `Mon trajet Babi Move : ${it.origin.label} → ${it.destination.label}\n${it.durationMin} min • ${it.costMinFcfa}–${it.costMaxFcfa} FCFA`;
  }

  shareWhatsApp(): void {
    if (!this.itinerary()) return;
    const text = `${this.shareText()}\n${this.shareUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    this.shareMenuOpen.set(false);
  }

  shareNative(): void {
    if (!this.itinerary() || !navigator.share) return;
    void navigator
      .share({ title: 'Mon trajet Babi Move', text: this.shareText(), url: this.shareUrl() })
      .catch(() => undefined);
    this.shareMenuOpen.set(false);
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.copied.set(true);
      this.shareMenuOpen.set(false);
      setTimeout(() => this.copied.set(false), 2500);
    } catch {
      // silencieux
    }
  }

  mapsUrl(): string {
    const it = this.itinerary();
    if (!it) return '';
    const o = it.origin.position;
    const d = it.destination.position;
    return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}&travelmode=driving`;
  }

  // ============================================================
  // Carte
  // ============================================================

  private currentLeg(it: Itinerary): { from: Waypoint; to: Waypoint; mode: string | undefined } {
    if (this.started() && !this.finished()) {
      const step = it.steps[this.currentStepIndex()];
      if (step) return { from: step.from, to: step.to, mode: step.mode };
    }
    return { from: it.origin, to: it.destination, mode: it.steps[0]?.mode };
  }

  private async drawRoute(): Promise<void> {
    const it = this.itinerary();
    if (!it || !this.mapInitialized) return;

    const token = ++this.mapToken;
    const leg = this.currentLeg(it);
    const o = leg.from.position;
    const d = leg.to.position;
    const start = { lat: o.lat, lng: o.lng, label: leg.from.label };
    const end = { lat: d.lat, lng: d.lng, label: leg.to.label };

    this.mapService.setPoints(start, end);
    this.mapService.setAlertCircles(this.alertZones());

    // Distance haversine immédiate (fallback si OSRM échoue)
    const airKm = this.haversineKm(o, d);
    if (this.distanceKm() === null) {
      this.distanceKm.set(Math.round(airKm * 1.35 * 10) / 10);
    }

    // Traversée lagune : ligne droite, pas de tracé routier
    if (leg.mode === BOAT_MODE) {
      this.distanceKm.set(Math.round(airKm * 1.15 * 10) / 10);
      return;
    }

    const profile = leg.mode === 'marche' ? 'foot' : 'driving';
    const geometry = await this.routing.getRoute(o, d, profile);
    if (geometry && token === this.mapToken) {
      this.mapService.setPoints(start, end, geometry.points);
      this.distanceKm.set(Math.round((geometry.distanceMeters / 1000) * 10) / 10);
    }
  }

  private alertZones() {
    return this.tripAlerts()
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
  }

  // ============================================================
  // Helpers de présentation
  // ============================================================

  private clock(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  stepStatusIcon(status: StepStatus): string {
    switch (status) {
      case 'done':
        return 'bi-check-lg';
      case 'current':
        return 'bi-record-circle';
      default:
        return 'bi-circle';
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

  formatDuration(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m === 0 ? `${h} h` : `${h} h ${m}`;
  }

  /** utilisé dans le badge "Confort" */
  modeLabelShort(mode: string | undefined): string {
    if (!mode) return '';
    return this.data.getModeById(mode)?.label ?? mode;
  }

  /** description longue d'un mode, utilisée dans la feuille de route et la carte */
  modeLongLabel(mode: string): string {
    switch (mode) {
      case 'gbaka':
        return 'Gbaka — minibus local, arrêts fréquents';
      case 'woro-woro':
        return 'Woro-woro — taxi collectif, plus rapide';
      case 'sotra':
        return 'Bus SOTRA — lignes formelles, tarif fixe';
      case 'bateau-bus':
        return 'Bateau-bus STL — navette lagunaire climatisée';
      case 'vtc':
        return 'VTC (Yango, Heetch…) — porte-à-porte';
      case 'marche':
        return 'Marche à pied — trajet court';
      default:
        return this.data.getModeById(mode)?.label ?? mode;
    }
  }
}
