import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { StorageService } from './storage';
import { TransportModeId, Waypoint } from '../models/models';

export interface FavoriteTrip {
  id: string;
  userId: string;
  label: string; // ex: "Maison → Travail"
  origin: Waypoint;
  destination: Waypoint;
  bestMode: TransportModeId;
  costFcfa: number;
  durationMin: number;
  addedAt: string;
}

const STORAGE_KEY = 'favorites';

@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);

  private readonly _allFavorites = signal<FavoriteTrip[]>(
    this.storage.read<FavoriteTrip[]>(STORAGE_KEY) ?? [],
  );

  readonly favorites = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return [];
    return this._allFavorites()
      .filter((f) => f.userId === user.id)
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  });

  add(trip: Omit<FavoriteTrip, 'id' | 'userId' | 'addedAt' | 'label'> & { label?: string }): void {
    const user = this.auth.currentUser();
    if (!user) return;

    const newFav: FavoriteTrip = {
      ...trip,
      id: crypto.randomUUID(),
      userId: user.id,
      label: trip.label || `${trip.origin.label} → ${trip.destination.label}`,
      addedAt: new Date().toISOString(),
    };

    const updated = [newFav, ...this._allFavorites()];
    this._allFavorites.set(updated);
    this.storage.write(STORAGE_KEY, updated);
  }

  remove(id: string): void {
    const user = this.auth.currentUser();
    if (!user) return;

    const updated = this._allFavorites().filter((f) => !(f.id === id && f.userId === user.id));
    this._allFavorites.set(updated);
    this.storage.write(STORAGE_KEY, updated);
  }

  isFavorite(origin: Waypoint, destination: Waypoint): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    return this._allFavorites().some(
      (f) =>
        f.userId === user.id &&
        f.origin.label === origin.label &&
        f.destination.label === destination.label,
    );
  }

  toggle(
    origin: Waypoint,
    destination: Waypoint,
    mode: TransportModeId,
    cost: number,
    duration: number,
  ): void {
    const user = this.auth.currentUser();
    if (!user) return;

    const existing = this._allFavorites().find(
      (f) =>
        f.userId === user.id &&
        f.origin.label === origin.label &&
        f.destination.label === destination.label,
    );

    if (existing) {
      this.remove(existing.id);
    } else {
      this.add({ origin, destination, bestMode: mode, costFcfa: cost, durationMin: duration });
    }
  }
}
