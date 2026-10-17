import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth';
import { StorageService } from './storage';
import { HistoryEntry, TransportModeId, Waypoint } from '../models/models';

const STORAGE_KEY = 'history';
const MAX_VISITOR_ENTRIES = 3;

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);

  /** Toutes les entrées brutes, stockées dans le localStorage. */
  private readonly _allEntries = signal<HistoryEntry[]>(
    this.storage.read<HistoryEntry[]>(STORAGE_KEY) ?? [],
  );

  /** L'historique spécifique à l'utilisateur actuel (ou visiteur). */
  readonly entries = computed<HistoryEntry[]>(() => {
    const userId = this.auth.currentUser()?.id ?? null;
    return this._allEntries()
      .filter((e) => e.userId === userId)
      .sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime());
  });

  addSearch(
    origin: Waypoint,
    destination: Waypoint,
    bestMode: TransportModeId,
    bestCost: number,
    bestDuration: number,
    chosenItineraryId?: string,
  ): void {
    const userId = this.auth.currentUser()?.id ?? null;

    const newEntry: HistoryEntry = {
      id: crypto.randomUUID(),
      userId,
      origin,
      destination,
      searchedAt: new Date().toISOString(),
      best: {
        mode: bestMode,
        costFcfa: bestCost,
        durationMin: bestDuration,
      },
      chosenItineraryId,
    };

    let updated = [newEntry, ...this._allEntries()];

    if (userId === null) {
      const visitorEntries = updated.filter((e) => e.userId === null).slice(0, MAX_VISITOR_ENTRIES);
      const otherEntries = updated.filter((e) => e.userId !== null);
      updated = [...visitorEntries, ...otherEntries];
    }

    this._allEntries.set(updated);
    this.storage.write(STORAGE_KEY, updated);
  }

  removeEntry(id: string): void {
    const userId = this.auth.currentUser()?.id ?? null;
    const updated = this._allEntries().filter((e) => !(e.id === id && e.userId === userId));
    this._allEntries.set(updated);
    this.storage.write(STORAGE_KEY, updated);
  }

  clearHistory(): void {
    const userId = this.auth.currentUser()?.id ?? null;
    const updated = this._allEntries().filter((e) => e.userId !== userId);
    this._allEntries.set(updated);
    this.storage.write(STORAGE_KEY, updated);
  }
}
