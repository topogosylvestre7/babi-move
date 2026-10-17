import { Injectable } from '@angular/core';

export type GeolocationError = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'unknown';

export type GeolocationResult =
  { ok: true; position: { lat: number; lng: number } } | { ok: false; error: GeolocationError };

/**
 * Wrapper safe de navigator.geolocation.
 * Ne lève jamais d'erreur : renvoie un résultat typé.
 * Ne demande JAMAIS la position automatiquement : à appeler sur action utilisateur.
 */
@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /**
   * Demande la position courante.
   * @param options.timeoutMs délai max en ms (défaut 10s)
   */
  getCurrentPosition(options?: { timeoutMs?: number }): Promise<GeolocationResult> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return Promise.resolve({ ok: false, error: 'unsupported' });
    }

    const timeout = options?.timeoutMs ?? 10_000;

    return new Promise<GeolocationResult>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            ok: true,
            position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          }),
        (err) => {
          let mapped: GeolocationError = 'unknown';
          switch (err.code) {
            case err.PERMISSION_DENIED:
              mapped = 'denied';
              break;
            case err.POSITION_UNAVAILABLE:
              mapped = 'unavailable';
              break;
            case err.TIMEOUT:
              mapped = 'timeout';
              break;
          }
          resolve({ ok: false, error: mapped });
        },
        {
          enableHighAccuracy: true,
          timeout,
          maximumAge: 30_000,
        },
      );
    });
  }

  /** Message utilisateur en français pour chaque code d'erreur. */
  messageFor(error: GeolocationError): string {
    switch (error) {
      case 'unsupported':
        return 'Ton navigateur ne supporte pas la géolocalisation.';
      case 'denied':
        return 'Tu as refusé la géolocalisation. Autorise-la dans les réglages du navigateur ou saisis ton départ à la main.';
      case 'unavailable':
        return 'Position introuvable. Vérifie que le GPS ou le Wi-Fi est activé.';
      case 'timeout':
        return 'La localisation a pris trop de temps. Réessaie.';
      default:
        return "Impossible de te localiser pour l'instant.";
    }
  }
}
