import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { DataService } from '../../../core/services/data';
import { AlertService } from '../../../core/services/alert';
import { GeocodingService, Suggestion } from '../../../core/services/geocoding';
import { GeolocationService } from '../../../core/services/geolocation';
import { Commune, RouteAxis, TransportMode, Waypoint } from '../../../core/models/models';

interface Pillar {
  tag: string;
  title: string;
  description: string;
  footer: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'tertiary';
}

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface ComparisonRow {
  label: string;
  detail: string;
}

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
  tone: 'primary' | 'secondary' | 'tertiary';
}

interface TrustNumber {
  value: string;
  label: string;
  detail: string;
}

interface SimulatorEstimate {
  recommended: {
    mode: string;
    costMinFcfa: number;
    costMaxFcfa: number;
    durationMin: number;
    transfers: number;
  } | null;
  cheapest: {
    mode: string;
    costMinFcfa: number;
    costMaxFcfa: number;
    durationMin: number;
  } | null;
  distanceKm: number;
  fastestDuration: number;
  cheapestCost: number;
}

@Component({
  selector: 'ui-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly data = inject(DataService);
  private readonly alerts = inject(AlertService);
  private readonly geocoding = inject(GeocodingService);
  private readonly geolocation = inject(GeolocationService);
  private readonly router = inject(Router);

  // --- État de chargement ---
  readonly loaded = this.data.loaded;
  readonly loadError = this.data.error;
  readonly popularCommunes = this.data.popularCommunes;
  readonly modesById = this.data.modesById;
  readonly topAlerts = computed(() => this.alerts.topN(3));

  // ============================================================
  // Formulaire du simulateur (signals)
  // ============================================================
  readonly departureText = signal('');
  readonly destinationText = signal('');
  readonly departure = signal<Waypoint | null>(null);
  readonly destination = signal<Waypoint | null>(null);

  readonly suggestions = this.geocoding.suggestions;
  readonly activeField = signal<'departure' | 'destination' | null>(null);
  readonly searchingLocation = signal(false);
  readonly locationError = signal('');
  readonly estimateError = signal('');

  // ============================================================
  // Formulaire rapide (section finale) : "Départ → Destination"
  // ============================================================
  readonly quickRoute = signal('');
  readonly quickRouteError = signal('');
  readonly quickRouteLoading = signal(false);
  readonly quickExamples = ['Yopougon → Plateau', 'Cocody → Marcory', 'Abobo → Treichville'];

  // --- Onglet actif dans "L'arsenal complet" ---
  readonly activeFeatureIndex = signal(0);

  // --- Aperçu itinéraire Yopougon → Plateau ---
  readonly previewAxis = computed(() => {
    const axis = this.data.findAxis('yopougon', 'plateau');
    if (!axis) return null;

    return {
      from: this.data.getCommuneById(axis.from)?.name ?? axis.from,
      to: this.data.getCommuneById(axis.to)?.name ?? axis.to,
      distanceKm: axis.distanceKm,
      modes: axis.modes,
      fastestDuration: Math.min(...axis.modes.map((m) => m.durationMin)),
      cheapestCost: Math.min(...axis.modes.map((m) => m.costMinFcfa)),
      maxCost: Math.max(...axis.modes.map((m) => m.costMaxFcfa)),
    };
  });

  // --- Estimation du simulateur ---
  readonly simulatorEstimate = computed<SimulatorEstimate | null>(() => {
    const from = this.departure();
    const to = this.destination();
    if (!from || !to) return null;

    const fromCommune = this.matchCommune(from.label);
    const toCommune = this.matchCommune(to.label);

    if (!fromCommune || !toCommune) return this.fallbackEstimate(from, to);

    const axis = this.data.findAxis(fromCommune.id, toCommune.id);
    if (!axis) return this.fallbackEstimate(from, to);

    return this.estimateFromAxis(axis);
  });

  // --- Chiffres clés dynamiques ---
  readonly trustNumbers = computed<TrustNumber[]>(() => {
    const modeCount = this.data.modes().length;
    const alertCount = this.data.alerts().length;
    const criticalCount = this.data.alerts().filter((a) => a.priority === 'critical').length;

    return [
      {
        value: '−35 min',
        label: 'Temps moyen gagné',
        detail: 'Par trajet aux heures de pointe matinales et vespérales.',
      },
      {
        value: `${modeCount} Modes`,
        label: 'Écosystème unifié',
        detail: 'SOTRA, STL Bateau-bus, Gbakas & Woro-woros.',
      },
      {
        value: '18 500 FCFA',
        label: 'Économie mensuelle',
        detail: "Moyenne constatée en évitant les surcoûts d'urgence.",
      },
      {
        value: `${alertCount} alertes`,
        label: 'Flux en direct',
        detail: `Dont ${criticalCount} critiques en cours.`,
      },
    ];
  });

  // --- Données éditoriales ---
  readonly pillars: Pillar[] = [
    {
      tag: 'Pilier lagunaire',
      title: 'La lagune Ébrié comme autoroute fluide',
      description:
        "Pourquoi s'entasser pendant 1h45 sur les ponts De Gaulle ou HKB quand la navette fluviale STL vous transporte de Treichville ou Abobo-Doumé au Plateau en 14 minutes chrono ?",
      footer: 'Départs toutes les 10 minutes',
      icon: 'bi-water',
      tone: 'tertiary',
    },
    {
      tag: 'Économie réelle',
      title: 'Transparence totale des tarifs en Francs CFA',
      description:
        "Fini les augmentations arbitraires imposées par les apprentis de gbaka dès qu'un nuage de pluie apparaît. Consultez des grilles officielles réalistes et anticipez votre monnaie exacte.",
      footer: 'Fin des surenchères imprévues',
      icon: 'bi-cash-coin',
      tone: 'secondary',
    },
    {
      tag: 'Force communautaire',
      title: 'Régulation citoyenne & alertes vérifiées',
      description:
        "Une communauté active de dizaines de milliers d'Abidjanais qui remontent accidents, contrôles, feux en panne au Carrefour Duncan ou déviations spontanées avec confirmation immédiate.",
      footer: 'Validation algorithmique en temps réel',
      icon: 'bi-people-fill',
      tone: 'primary',
    },
  ];

  readonly features: Feature[] = [
    {
      title: 'Calculateur Multimodal',
      description:
        'Combinez Bateau-bus, Gbaka, SOTRA et marche piétonne sur un seul itinéraire optimisé.',
      icon: 'bi-signpost-split',
    },
    {
      title: 'Observatoire Trafic Direct',
      description:
        "Visualisez les goulots d'étranglement : Pont HKB, Voie Express Yopougon, Boulevard VGE.",
      icon: 'bi-broadcast',
    },
    {
      title: 'Mon Espace & Budget FCFA',
      description:
        'Calculez précisément vos frais de transport hebdomadaires et mensuels par ligne.',
      icon: 'bi-wallet2',
    },
    {
      title: 'Signalement Citoyen',
      description:
        'Partagez les incidents de voie publique en un clic pour avertir vos concitoyens.',
      icon: 'bi-megaphone',
    },
  ];

  readonly comparisonRows: {
    without: ComparisonRow[];
    with: ComparisonRow[];
  } = {
    without: [
      {
        label: 'Bouchons immobiles',
        detail: 'dès le Carrefour Nouveau Goudron et sur le Pont De Gaulle.',
      },
      {
        label: 'Tarifs volatils en Gbaka',
        detail: '400 FCFA au départ qui grimpent à 800 FCFA dès les premières gouttes de pluie.',
      },
      {
        label: 'Stress permanent des retards',
        detail: 'Réunions manquées, fatigue mentale avant même de commencer sa journée.',
      },
      {
        label: 'Aucune alternative connue',
        detail: "en temps réel lors d'un accident ou véhicule en panne sur la chaussée.",
      },
    ],
    with: [
      {
        label: 'Contournement fluide par Bateau-bus STL',
        detail: '14 min de traversée calme sur la lagune avec siège assis et Wi-Fi.',
      },
      {
        label: 'Budget fixe en Francs CFA',
        detail: 'Connaissance exacte du prix (750 FCFA) avec monnaie d’appoint prête.',
      },
      {
        label: 'Alertes de déviation anticipées',
        detail: 'Signalement immédiat si un incident survient au Carrefour Duncan ou Riviera 2.',
      },
      {
        label: 'Productivité et sérénité',
        detail: "Arrivée à l'heure avec le temps de savourer son café avant de travailler.",
      },
    ],
  };

  readonly testimonials: Testimonial[] = [
    {
      quote:
        "J'habite à la Riviera Palmeraie et je travaille dans une tour au Plateau. Avant, je passais 2h le matin dans ma voiture. Aujourd'hui, je laisse la voiture, je prends un Woro-woro jusqu'à la gare lagunaire et le bateau STL. Je gagne 50 minutes par jour et je les savoure au calme sur la lagune.",
      name: 'Kouassi Armand',
      role: 'Analyste Financier, Le Plateau',
      initials: 'KA',
      tone: 'primary',
    },
    {
      quote:
        "En tant qu'étudiante, chaque 100 FCFA compte. L'application m'indique exactement les lignes SOTRA en service et m'évite de me faire surtaxer par les apprentis gbaka à Adjamé Liberté quand il pleut. C'est devenu mon réflexe matinal incontournable !",
      name: 'Awa Touré',
      role: 'Étudiante en Droit, Université FHB',
      initials: 'AT',
      tone: 'secondary',
    },
    {
      quote:
        "Je transporte des marchandises entre le port de pêche de Treichville et le grand marché de Marcory. Les alertes en direct sur les pannes me permettent de changer d'itinéraire avant de me retrouver piégé. Une fiabilité incroyable pour nous les commerçants.",
      name: 'Mamadou Diabaté',
      role: 'Opérateur Logistique, Treichville',
      initials: 'MD',
      tone: 'tertiary',
    },
  ];

  readonly partners: { name: string; icon: string }[] = [
    { name: 'Ministère des Transports', icon: 'bi-bank' },
    { name: 'SOTRA', icon: 'bi-bus-front' },
    { name: 'STL Bateau-Bus', icon: 'bi-water' },
    { name: "District Autonome d'Abidjan", icon: 'bi-buildings' },
    { name: 'CGECI', icon: 'bi-briefcase' },
  ];

  async ngOnInit(): Promise<void> {
    await this.data.load();
  }

  // ============================================================
  // Recherche / autocomplétion
  // ============================================================

  onDepartureInput(value: string): void {
    this.departureText.set(value);
    this.departure.set(null);
    this.activeField.set('departure');
    void this.geocoding.search(value);
  }

  onDestinationInput(value: string): void {
    this.destinationText.set(value);
    this.destination.set(null);
    this.activeField.set('destination');
    void this.geocoding.search(value);
  }

  selectSuggestion(s: Suggestion): void {
    const wp = this.geocoding.waypointFromSuggestion(s);
    const field = this.activeField();

    if (field === 'departure') {
      this.departure.set(wp);
      this.departureText.set(wp.label);
    } else if (field === 'destination') {
      this.destination.set(wp);
      this.destinationText.set(wp.label);
    }

    this.geocoding.clear();
    this.activeField.set(null);
  }

  onBlur(): void {
    setTimeout(() => {
      void this.autoResolve();
    }, 180);
  }

  private async autoResolve(): Promise<void> {
    if (!this.departure() && this.departureText().trim().length >= 2) {
      const wp = await this.geocoding.resolve(this.departureText());
      if (wp) {
        this.departure.set(wp);
        this.departureText.set(wp.label);
      }
    }

    if (!this.destination() && this.destinationText().trim().length >= 2) {
      const wp = await this.geocoding.resolve(this.destinationText());
      if (wp) {
        this.destination.set(wp);
        this.destinationText.set(wp.label);
      }
    }

    this.activeField.set(null);
    this.geocoding.clear();
  }

  /** Minuscules, sans accents ni ponctuation : "Angré 8ème" → "angre 8eme". */
  private normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** `needle` apparaît-il comme mot(s) entier(s) dans `haystack` ? (valeurs déjà normalisées) */
  private containsPhrase(haystack: string, needle: string): boolean {
    if (!needle) return false;
    return ` ${haystack} `.includes(` ${needle} `);
  }

  usePopularCommune(c: Commune): void {
    const wp: Waypoint = { label: c.name, position: c.center, source: 'place' };
    if (!this.departure()) {
      this.departure.set(wp);
      this.departureText.set(c.name);
    } else {
      this.destination.set(wp);
      this.destinationText.set(c.name);
    }
  }

  swap(): void {
    const dep = this.departure();
    const dest = this.destination();
    const depText = this.departureText();
    const destText = this.destinationText();

    this.departure.set(dest);
    this.destination.set(dep);
    this.departureText.set(destText);
    this.destinationText.set(depText);
  }

  async useMyPosition(): Promise<void> {
    this.locationError.set('');
    this.searchingLocation.set(true);
    const result = await this.geolocation.getCurrentPosition();
    this.searchingLocation.set(false);

    if (!result.ok) {
      this.locationError.set(this.geolocation.messageFor(result.error));
      return;
    }

    const label = await this.geocoding.reverse(result.position);
    const wp: Waypoint = { label, position: result.position, source: 'geolocation' };
    this.departure.set(wp);
    this.departureText.set(label);
  }

  /** Force la résolution puis affiche l'estimation. */
  async forceEstimate(): Promise<void> {
    this.estimateError.set('');

    if (!this.departure() && this.departureText().trim()) {
      const wp = await this.geocoding.resolve(this.departureText());
      if (wp) this.departure.set(wp);
    }

    if (!this.destination() && this.destinationText().trim()) {
      const wp = await this.geocoding.resolve(this.destinationText());
      if (wp) this.destination.set(wp);
    }

    const from = this.departure();
    const to = this.destination();

    if (!from || !to) {
      this.estimateError.set(
        "Je n'ai pas reconnu un des deux lieux. Essaie une commune (Cocody, Yopougon…).",
      );
      return;
    }

    this.departureText.set(from.label);
    this.destinationText.set(to.label);
    this.geocoding.clear();
  }

  search(): void {
    const from = this.departure();
    const to = this.destination();
    if (!from || !to) return;

    this.router.navigate(['/resultats'], {
      queryParams: {
        fromLat: from.position.lat,
        fromLng: from.position.lng,
        fromLabel: from.label,
        toLat: to.position.lat,
        toLng: to.position.lng,
        toLabel: to.label,
      },
    });
  }

  // ============================================================
  // Formulaire rapide (section finale)
  // ============================================================

  async submitQuickRoute(): Promise<void> {
    this.quickRouteError.set('');
    const raw = this.quickRoute().trim();

    // Découpe "A → B", "A -> B", "A => B", "A - B", "A vers B", "A à B"
    const parts = raw
      .split(/\s*(?:→|->|=>|\s-\s|\svers\s|\sà\s)\s*/i)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length !== 2) {
      this.quickRouteError.set('Écris ton trajet sous la forme « Départ → Destination ».');
      return;
    }

    this.quickRouteLoading.set(true);

    // Séquentiel (et non Promise.all) : le service de géocodage partage un état
    // (suggestions) et pourrait annuler une requête si deux partent en parallèle.
    const from = await this.geocoding.resolve(parts[0]);
    const to = from ? await this.geocoding.resolve(parts[1]) : null;

    this.quickRouteLoading.set(false);
    this.geocoding.clear();

    if (!from || !to) {
      const unknown = !from ? parts[0] : parts[1];
      this.quickRouteError.set(
        `Je n'ai pas reconnu « ${unknown} ». Essaie une commune (Cocody, Plateau…).`,
      );
      return;
    }

    this.departure.set(from);
    this.destination.set(to);
    this.departureText.set(from.label);
    this.destinationText.set(to.label);
    this.search();
  }

  fillQuickRoute(example: string): void {
    this.quickRoute.set(example);
    void this.submitQuickRoute();
  }

  // ============================================================
  // Onglets
  // ============================================================

  setActiveFeature(index: number): void {
    this.activeFeatureIndex.set(index);
  }

  isActiveFeature(index: number): boolean {
    return this.activeFeatureIndex() === index;
  }

  // ============================================================
  // Helpers
  // ============================================================

  modeColor(mode: TransportMode): string {
    return mode.color;
  }

  modeLabel(mode: TransportMode): string {
    return mode.label;
  }

  alertTone(priority: string): 'critical' | 'high' | 'medium' | 'info' {
    return priority as 'critical' | 'high' | 'medium' | 'info';
  }

  alertTagLabel(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'Ralentissement Sévère';
      case 'high':
        return 'Ralentissement Modéré';
      case 'medium':
        return 'Trafic Perturbé';
      default:
        return 'Trafic Fluide';
    }
  }

  confirmationCount(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % 1000;
    }
    return 8 + (hash % 52);
  }

  // ============================================================
  // Interne
  // ============================================================

  private matchCommune(label: string): Commune | undefined {
    const norm = this.normalize(label);
    return this.data.communes().find((c) => this.containsPhrase(norm, this.normalize(c.name)));
  }

  private estimateFromAxis(axis: RouteAxis): SimulatorEstimate {
    const recommended = axis.modes.reduce((best, m) =>
      m.durationMin < best.durationMin ? m : best,
    );
    const cheapest = axis.modes.reduce((best, m) => (m.costMinFcfa < best.costMinFcfa ? m : best));

    return {
      recommended: {
        mode: recommended.mode,
        costMinFcfa: recommended.costMinFcfa,
        costMaxFcfa: recommended.costMaxFcfa,
        durationMin: recommended.durationMin,
        transfers: recommended.transfers,
      },
      cheapest: {
        mode: cheapest.mode,
        costMinFcfa: cheapest.costMinFcfa,
        costMaxFcfa: cheapest.costMaxFcfa,
        durationMin: cheapest.durationMin,
      },
      distanceKm: axis.distanceKm,
      fastestDuration: recommended.durationMin,
      cheapestCost: cheapest.costMinFcfa,
    };
  }

  private fallbackEstimate(a: Waypoint, b: Waypoint): SimulatorEstimate {
    const km = this.haversineKm(a.position, b.position);
    const avgSpeed = 22;
    const baseFare = 100;
    const farePerKm = 21;

    return {
      recommended: null,
      cheapest: null,
      distanceKm: Math.round(km * 10) / 10,
      fastestDuration: Math.max(5, Math.round((km / avgSpeed) * 60)),
      cheapestCost: Math.round(baseFare + farePerKm * km),
    };
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
