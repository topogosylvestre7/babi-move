import { Injectable, signal } from '@angular/core';
import { Itinerary } from '../models/models';

/**
 * Petit cache en mémoire qui permet de retrouver un itinéraire calculé
 * depuis la page /resultats vers la page /itineraire/:id, sans tout
 * faire passer par l'URL (les étapes seraient trop volumineuses).
 *
 * Le cache survit uniquement à la session en cours :
 * un rechargement direct de /itineraire/:id retombe sur un fallback.
 */
@Injectable({ providedIn: 'root' })
export class ItineraryStoreService {
  private readonly map = new Map<string, Itinerary>();

  /** Dernier itinéraire mis en avant (utile si l'id est inconnu). */
  readonly lastItinerary = signal<Itinerary | null>(null);

  save(itinerary: Itinerary): void {
    this.map.set(itinerary.id, itinerary);
    this.lastItinerary.set(itinerary);
    // Petite limite pour ne pas gonfler la mémoire inutilement.
    if (this.map.size > 20) {
      const firstKey = this.map.keys().next().value;
      if (firstKey) this.map.delete(firstKey);
    }
  }

  get(id: string): Itinerary | null {
    return this.map.get(id) ?? null;
  }

  clear(): void {
    this.map.clear();
    this.lastItinerary.set(null);
  }
}
