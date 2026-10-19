/* ---------------------------------------------------------------*/
/* Géographie                                                          */
/* ---------------------------------------------------------------*/

export const COMMUNE_IDS = [
  'abobo',
  'adjame',
  'attecoube',
  'cocody',
  'koumassi',
  'marcory',
  'plateau',
  'port-bouet',
  'treichville',
  'yopougon',
  'bingerville',
  'anyama',
  'songon',
] as const;

export type CommuneId = (typeof COMMUNE_IDS)[number];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Commune {
  id: CommuneId;
  name: string;
  center: GeoPoint;
  /** Affichée dans les raccourcis de l'accueil. */
  popular: boolean;
}

export type PlaceType =
  'quartier' | 'gare' | 'marche' | 'universite' | 'hopital' | 'commerce' | 'autre';

/** Lieu connu, utilisé par l'autocomplétion. */
export interface Place {
  id: string;
  name: string;
  commune: CommuneId;
  position: GeoPoint;
  type: PlaceType;
}

/**
 * Point de départ ou d'arrivée d'une recherche : un lieu connu,
 * la position de l'utilisateur ou un point posé sur la carte.
 */
export interface Waypoint {
  label: string;
  position: GeoPoint;
  /** Renseigné quand le point correspond à un lieu connu. */
  placeId?: string;
  source: 'place' | 'geolocation' | 'map';
}

/* ---------------------------------------------------------------*/
/* Transports et itinéraires                                           */
/* ---------------------------------------------------------------*/

export type TransportModeId = 'gbaka' | 'woro-woro' | 'sotra' | 'bateau-bus' | 'vtc' | 'marche';

export interface TransportMode {
  id: TransportModeId;
  label: string;
  icon: string;
  /** Couleur du tracé sur la carte et des badges. */
  color: string;
  /** Tarif de base simulé, en FCFA. */
  baseFareFcfa: number;
  /** Supplément simulé par kilomètre, en FCFA. */
  farePerKmFcfa: number;
  /** Vitesse moyenne hors embouteillage, utilisée pour les trajets sans axe défini. */
  avgSpeedKmh: number;
  /** Temps d'attente moyen avant le départ, en minutes. */
  waitMin: number;
  /** 1 (inconfortable) à 5 (très confortable). */
  comfort: 1 | 2 | 3 | 4 | 5;
  /** 0 = insensible aux embouteillages (marche, bateau-bus), 1 = totalement exposé. */
  trafficSensitivity: number;
  /** Distance maximale conseillée pour ce mode, en km. */
  maxDistanceKm?: number;
  /** Faux si le mode n'existe que sur des axes précis (ex. bateau-bus). */
  fallbackEligible: boolean;
}

export interface ItineraryStep {
  mode: TransportModeId;
  from: Waypoint;
  to: Waypoint;
  costFcfa: number;
  durationMin: number;
  /** Ex. " Prendre le gbaka jusqu'à Adjamé". */
  instruction: string;
  /** Tracé pour la carte (liste de points). */
  path?: GeoPoint[];
}

export type ItineraryTag = 'cheapest' | 'fastest' | 'most-comfortable';

export interface Itinerary {
  id: string;
  origin: Waypoint;
  destination: Waypoint;
  /** Date et heure de départ au format ISO 8601. */
  departureAt: string;
  steps: ItineraryStep[];
  costMinFcfa: number;
  costMaxFcfa: number;
  durationMin: number;
  transfers: number;
  comfort: 1 | 2 | 3 | 4 | 5;
  tags: ItineraryTag[];
  /** Alertes qui touchent le trajet. */
  alertIds: string[];
  /** Toujours vrai dans le challenge : les valeurs sont simulées. */
  isEstimate: true;
}

export type SortCriterion = 'duration' | 'cost';

export interface SearchQuery {
  origin: Waypoint | null;
  destination: Waypoint | null;
  /** " now" ou une date ISO 8601. */
  departureAt: 'now' | string;
  excludedModes: TransportModeId[];
  sortBy: SortCriterion;
  /** Curseur budget / temps : 0 = le moins cher, 1 = le plus rapide. */
  budgetTimeBalance?: number;
}

/* ---------------------------------------------------------------*/
/* Alertes                                                             */
/* ---------------------------------------------------------------*/

export type AlertPriority = 'critical' | 'high' | 'medium' | 'info';

export type AlertCategory =
  'embouteillage' | 'accident' | 'travaux' | 'meteo' | 'transport-commun' | 'evenement';

export interface TrafficAlert {
  id: string;
  title: string;
  description: string;
  category: AlertCategory;
  priority: AlertPriority;
  communes: CommuneId[];
  /** Date et heure de dernière mise à jour, ISO 8601. */
  updatedAt: string;
  estimatedDurationMin?: number;
  /** Conseil de contournement. */
  advice?: string;
  /** Toujours vrai dans le challenge. */
  simulated: true;
}

export interface AlertFilter {
  communes: CommuneId[];
  categories: AlertCategory[];
}

/* ---------------------------------------------------------------*/
/* Comptes et espace personnel                                         */
/* ---------------------------------------------------------------*/

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  trafficAlerts: boolean;
}

export interface UserPreferences {
  preferredMode?: TransportModeId;
  maxBudgetFcfa?: number;
  avoidedModes: TransportModeId[];
  notifications: NotificationPreferences;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Date de création, ISO 8601. */
  createdAt: string;
  preferences: UserPreferences;
}

/**
 * Entrée du fichier `register` : un compte simulé.
 * Le mot de passe est stocké en clair UNIQUEMENT parce que la démo
 * n'a pas de serveur ; ne jamais saisir un vrai mot de passe.
 */
export interface RegisteredAccount extends User {
  password: string;
}

export interface AuthSession {
  userId: string;
  /** Expiration de la session, ISO 8601. */
  expiresAt: string;
}

export interface PasswordResetRequest {
  email: string;
  token: string;
  /** Expiration du lien simulé, ISO 8601. */
  expiresAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  /** Ex. " Maison", " Travail", " Fac". */
  label: string;
  icon: 'home' | 'work' | 'school' | 'star';
  place: Waypoint;
}

/** Ligne de l'historique des recherches et déplacements. */
export interface HistoryEntry {
  id: string;
  /** null pour un visiteur (3 dernières entrées sur l'appareil). */
  userId: string | null;
  origin: Waypoint;
  destination: Waypoint;
  /** Date et heure de la recherche, ISO 8601. */
  searchedAt: string;
  /** Meilleure option du moment, affichée sur la carte de trajet récent. */
  best: {
    mode: TransportModeId;
    costFcfa: number;
    durationMin: number;
  };
  /** Itinéraire effectivement choisi, si l'utilisateur en a ouvert un. */
  chosenItineraryId?: string;
}

/* ---------------------------------------------------------------*/
/* Contribution citoyenne                                              */
/* ---------------------------------------------------------------*/

export type ContributionType = 'embouteillage' | 'accident' | 'prix-reel' | 'arret' | 'autre';

export interface PhotoAttachment {
  name: string;
  sizeBytes: number;
  mimeType: string;
  /** Contenu encodé en data URL (stockage local uniquement). */
  dataUrl: string;
}

export interface Contribution {
  id: string;
  userId: string;
  type: ContributionType;
  commune: CommuneId;
  description: string;
  position?: GeoPoint;
  photo?: PhotoAttachment;
  /** Date de création, ISO 8601. */
  createdAt: string;
  status: 'pending' | 'published' | 'rejected';
}

/* ---------------------------------------------------------------*/
/* Jeux de données JSON (public/data)                                  */
/* ---------------------------------------------------------------*/

/**
 * Alerte telle qu'elle est écrite dans alerts.json : la date de mise à jour
 * est exprimée en " minutes écoulées" pour que la démo paraisse toujours
 * à jour. Le service calcule `updatedAt` au chargement.
 */
export type TrafficAlertSeed = Omit<TrafficAlert, 'updatedAt'> & {
  updatedMinutesAgo: number;
};

/** Période de la journée qui change les durées (embouteillages). */
export interface TrafficPeriod {
  id: string;
  label: string;
  /** Début de la période, " HH:MM". */
  from: string;
  /** Fin de la période, " HH:MM" ; peut passer minuit. */
  to: string;
  /** Multiplicateur appliqué aux durées (1 = normal). */
  factor: number;
}

/** Offre d'un mode de transport sur un axe, hors embouteillage. */
export interface AxisModeOffer {
  mode: TransportModeId;
  costMinFcfa: number;
  costMaxFcfa: number;
  durationMin: number;
  transfers: number;
}

/** Axe entre deux communes, dans les deux sens. */
export interface RouteAxis {
  id: string;
  from: CommuneId;
  to: CommuneId;
  /** Communes traversées ; servent à relier les alertes aux itinéraires. */
  via: CommuneId[];
  /** Distance par la route, en km. */
  distanceKm: number;
  bidirectional: boolean;
  modes: AxisModeOffer[];
}

export interface RoutesDataset {
  meta: {
    simulated: true;
    description: string;
    durationFormula: string;
  };
  trafficPeriods: TrafficPeriod[];
  /** Multiplicateur des durées le samedi et le dimanche. */
  weekendFactor: number;
  /** Règles pour un trajet qui n'a pas d'axe défini. */
  fallback: {
    description: string;
    roadFactor: number;
    fareSpread: { min: number; max: number };
  };
  axes: RouteAxis[];
}
