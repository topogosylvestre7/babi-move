import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { FavoriteService, FavoriteTrip } from '../../../core/services/favorite';
import { DataService } from '../../../core/services/data';

@Component({
  selector: 'app-favorites',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorites.html',
  styleUrl: './favorites.scss',
})
export class Favorites implements OnInit {
  private readonly favoriteService = inject(FavoriteService);
  private readonly data = inject(DataService);
  private readonly router = inject(Router);

  readonly favorites = this.favoriteService.favorites;
  readonly modesById = this.data.modesById;
  readonly hasFavorites = computed(() => this.favorites().length > 0);

  async ngOnInit(): Promise<void> {
    await this.data.load();
  }

  remove(fav: FavoriteTrip, event: Event): void {
    event.stopPropagation();
    if (confirm('Retirer ce trajet de vos favoris ?')) {
      this.favoriteService.remove(fav.id);
    }
  }

  relaunch(fav: FavoriteTrip): void {
    this.router.navigate(['/resultats'], {
      queryParams: {
        fromLat: fav.origin.position.lat,
        fromLng: fav.origin.position.lng,
        fromLabel: fav.origin.label,
        toLat: fav.destination.position.lat,
        toLng: fav.destination.position.lng,
        toLabel: fav.destination.label,
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  modeLabel(mode: string): string {
    return this.modesById()[mode]?.label ?? mode;
  }

  modeIcon(mode: string): string {
    return this.modesById()[mode]?.icon ?? 'bi-question';
  }

  modeColor(mode: string): string {
    return this.modesById()[mode]?.color ?? 'var(--em-muted)';
  }
}
