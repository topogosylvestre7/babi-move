import { Injectable } from '@angular/core';

/**
 * Wrapper safe de localStorage.
 * - Namespace toutes les clés sous "babi-move."
 * - Ne lève jamais d'erreur : renvoie null / ignore si indisponible
 *   (navigation privée, quota, JSON corrompu).
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly prefix = 'babi-move.';

  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  write(key: string, value: unknown): void {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Stockage indisponible : on ignore silencieusement.
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(this.prefix + key);
    } catch {
      // Rien à faire.
    }
  }

  /** Efface toutes les clés Babi Move (sans toucher au reste). */
  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(this.prefix));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Rien à faire.
    }
  }
}