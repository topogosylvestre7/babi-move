import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { HistoryService } from '../../../core/services/history';
import { DataService } from '../../../core/services/data';
import { HistoryEntry } from '../../../core/models/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History implements OnInit {
  private readonly historyService = inject(HistoryService);
  private readonly data = inject(DataService);
  private readonly router = inject(Router);

  readonly entries = this.historyService.entries;
  readonly modesById = this.data.modesById;

  readonly hasEntries = computed(() => this.entries().length > 0);

  async ngOnInit(): Promise<void> {
    await this.data.load();
  }

  clearAll(): void {
    if (confirm('Voulez-vous vraiment effacer tout votre historique ?')) {
      this.historyService.clearHistory();
    }
  }

  remove(entry: HistoryEntry, event: Event): void {
    event.stopPropagation();
    if (confirm('Supprimer ce trajet de votre historique ?')) {
      this.historyService.removeEntry(entry.id);
    }
  }

  relaunch(entry: HistoryEntry): void {
    this.router.navigate(['/resultats'], {
      queryParams: {
        fromLat: entry.origin.position.lat,
        fromLng: entry.origin.position.lng,
        fromLabel: entry.origin.label,
        toLat: entry.destination.position.lat,
        toLng: entry.destination.position.lng,
        toLabel: entry.destination.label,
      },
    });
  }

  // --- Helpers ---

  formatDate(iso: string): string {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();

    if (isToday) {
      return `Aujourd'hui à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
