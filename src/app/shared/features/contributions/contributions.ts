import { Component, computed, inject, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataService } from '../../../core/services/data';
import { AuthService } from '../../../core/services/auth';
import { ContributionService } from '../../../core/services/contribution';
import { ContributionType, CommuneId, Contribution } from '../../../core/models/models';

interface FilePreview {
  name: string;
  sizeBytes: number;
  mimeType: string;
  dataUrl: string;
}

type Tone = 'error' | 'secondary' | 'tertiary' | 'primary' | 'muted';

interface TypeOption {
  value: ContributionType;
  label: string;
  icon: string;
  tone: Tone;
}

const MAX_DESCRIPTION = 280;

const PHRASES: Partial<Record<ContributionType, string[]>> = {
  embouteillage: [
    'Circulation à l’arrêt',
    'Ça roule au ralenti',
    'Bouchon depuis plus de 30 min',
    'Ça commence à se dégager',
  ],
  accident: [
    'Accident sans blessé visible',
    'Véhicule en travers de la route',
    'Une voie est bloquée',
    'Les secours sont sur place',
  ],
  'prix-reel': [
    'Prix plus élevé que d’habitude',
    'Prix normal',
    'Prix majoré à cause de la pluie',
    'Prix majoré en heure de pointe',
  ],
  arret: ['Longue file d’attente', 'Peu de véhicules disponibles', 'Arrêt déplacé', 'Gare fermée'],
  autre: ['Route inondée', 'Feu tricolore en panne', 'Travaux en cours', 'Contrôle sur la route'],
};

@Component({
  selector: 'ui-contributions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contributions.html',
  styleUrl: './contributions.scss',
})
export class Contributions implements OnInit {
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly contributionService = inject(ContributionService);
  private readonly router = inject(Router);

  readonly loaded = this.data.loaded;
  readonly communes = this.data.communes;
  readonly popularCommunes = this.data.popularCommunes;
  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly currentUser = this.auth.currentUser;
  readonly pendingDelete = signal<Contribution | null>(null);

  readonly maxDescription = MAX_DESCRIPTION;

  // --- Formulaire ---
  readonly type = signal<ContributionType>('embouteillage');
  readonly commune = signal<CommuneId>('cocody');
  readonly description = signal('');

  // --- Édition ---
  readonly editingId = signal<string | null>(null);

  // --- Position ---
  readonly locating = signal(false);
  readonly geoError = signal('');

  // --- Upload ---
  readonly isDragging = signal(false);
  readonly photo = signal<FilePreview | null>(null);
  readonly fileError = signal('');

  // --- UI ---
  readonly isSubmitting = signal(false);
  readonly success = signal(false);
  readonly error = signal('');

  // --- Historique ---
  readonly myContributions = signal<Contribution[]>([]);

  // --- Modale de détail ---
  readonly selectedContribution = signal<Contribution | null>(null);

  readonly types: TypeOption[] = [
    { value: 'embouteillage', label: 'Embouteillage', icon: 'bi-cone-striped', tone: 'secondary' },
    { value: 'accident', label: 'Accident', icon: 'bi-exclamation-octagon-fill', tone: 'error' },
    { value: 'prix-reel', label: 'Prix réel', icon: 'bi-cash-coin', tone: 'primary' },
    { value: 'arret', label: 'Arrêt / Gare', icon: 'bi-signpost-2-fill', tone: 'tertiary' },
    { value: 'autre', label: 'Autre', icon: 'bi-three-dots', tone: 'muted' },
  ];

  // --- Valeurs dérivées ---
  readonly selectedType = computed(() => this.types.find((t) => t.value === this.type()));
  readonly tone = computed<Tone>(() => this.selectedType()?.tone ?? 'muted');
  readonly quickPhrases = computed(() => PHRASES[this.type()] ?? []);

  readonly otherCommunes = computed(() => this.communes().filter((c) => !c.popular));
  readonly otherValue = computed(() =>
    this.otherCommunes().some((c) => c.id === this.commune()) ? this.commune() : '',
  );
  readonly selectedCommuneName = computed(
    () => this.communes().find((c) => c.id === this.commune())?.name ?? '',
  );

  readonly remaining = computed(() => MAX_DESCRIPTION - this.description().length);
  readonly totalCount = computed(() => this.myContributions().length);
  readonly pendingCount = computed(
    () => this.myContributions().filter((c) => c.status === 'pending').length,
  );

  async ngOnInit(): Promise<void> {
    await this.data.load();
    this.refreshHistory();
  }

  refreshHistory(): void {
    const user = this.currentUser();
    if (user) {
      this.myContributions.set(this.contributionService.getUserContributions(user.id));
    }
  }

  // ============================================================
  // Modale Détail
  // ============================================================

  openDetail(c: Contribution): void {
    this.selectedContribution.set(c);
  }

  closeDetail(): void {
    this.selectedContribution.set(null);
  }

  // ============================================================
  // Édition et suppression
  // ============================================================

  startEdit(c: Contribution): void {
    this.closeDetail(); // Ferme la modale si elle est ouverte
    this.editingId.set(c.id);
    this.type.set(c.type);
    this.commune.set(c.commune);
    this.description.set(c.description);
    this.photo.set(c.photo ?? null);

    // Remonte en haut pour voir le formulaire
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.description.set('');
    this.photo.set(null);
    this.type.set('embouteillage');
    this.commune.set('cocody');
  }

  askDelete(c: Contribution): void {
    this.pendingDelete.set(c);
  }

  cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  confirmDelete(): void {
    const c = this.pendingDelete();
    if (!c) return;

    this.contributionService.delete(c.id);
    this.refreshHistory();

    if (this.editingId() === c.id) {
      this.cancelEdit();
    }
    if (this.selectedContribution()?.id === c.id) {
      this.closeDetail();
    }

    this.pendingDelete.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.pendingDelete()) this.cancelDelete();
    else if (this.selectedContribution()) this.closeDetail();
  }

  // ============================================================
  // Formulaire
  // ============================================================

  selectType(value: ContributionType): void {
    this.type.set(value);
  }

  selectCommune(id: CommuneId): void {
    this.commune.set(id);
    this.geoError.set('');
  }

  onOtherCommune(value: string): void {
    if (value) this.selectCommune(value as CommuneId);
  }

  onDescription(value: string): void {
    this.description.set(value.slice(0, MAX_DESCRIPTION));
  }

  addPhrase(phrase: string): void {
    const current = this.description().trim();
    if (current.includes(phrase)) return;
    const separator = current === '' ? '' : /[.!?]$/.test(current) ? ' ' : '. ';
    this.description.set(`${current}${separator}${phrase}`.slice(0, MAX_DESCRIPTION));
  }

  isPhraseUsed(phrase: string): boolean {
    return this.description().includes(phrase);
  }

  useMyPosition(): void {
    this.geoError.set('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.geoError.set('La localisation n’est pas disponible sur cet appareil.');
      return;
    }

    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        const { latitude, longitude } = pos.coords;
        let best: { id: CommuneId; dist: number } | null = null;
        for (const c of this.communes()) {
          const dist = this.haversineKm(latitude, longitude, c.center.lat, c.center.lng);
          if (!best || dist < best.dist) best = { id: c.id, dist };
        }
        if (best && best.dist <= 25) {
          this.commune.set(best.id);
        } else {
          this.geoError.set('Tu sembles hors du Grand Abidjan. Choisis la commune à la main.');
        }
      },
      () => {
        this.locating.set(false);
        this.geoError.set('Position refusée ou indisponible. Choisis la commune à la main.');
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  // ============================================================
  // Upload
  // ============================================================

  triggerInput(): void {
    document.getElementById('photo-input')?.click();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  private handleFile(file: File): void {
    this.fileError.set('');

    if (!file.type.startsWith('image/')) {
      this.fileError.set('Seules les images sont acceptées (JPG, PNG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.fileError.set('Cette image dépasse 2 Mo. Choisis-en une plus légère.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.photo.set({
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        dataUrl: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photo.set(null);
  }

  // ============================================================
  // Envoi
  // ============================================================

  submit(): void {
    if (this.isSubmitting()) return;

    const description = this.description().trim();
    if (!description) {
      this.error.set('Décris la situation en une phrase, ou touche une phrase rapide.');
      return;
    }

    this.isSubmitting.set(true);
    this.error.set('');
    this.success.set(false);

    setTimeout(() => {
      if (this.editingId()) {
        this.contributionService.update(this.editingId()!, {
          type: this.type(),
          commune: this.commune(),
          description,
          photo: this.photo() ?? undefined,
        });
      } else {
        this.contributionService.save({
          type: this.type(),
          commune: this.commune(),
          description,
          photo: this.photo() ?? undefined,
        });
      }

      this.isSubmitting.set(false);
      this.success.set(true);
      this.editingId.set(null);
      this.description.set('');
      this.photo.set(null);
      this.refreshHistory();

      setTimeout(() => this.success.set(false), 5000);
    }, 600);
  }

  // ============================================================
  // Helpers
  // ============================================================

  typeLabel(t: ContributionType): string {
    return this.types.find((x) => x.value === t)?.label ?? t;
  }

  typeIcon(t: ContributionType): string {
    return this.types.find((x) => x.value === t)?.icon ?? 'bi-question';
  }

  typeTone(t: ContributionType): Tone {
    return this.types.find((x) => x.value === t)?.tone ?? 'muted';
  }

  communeName(id: CommuneId): string {
    return this.data.getCommuneById(id)?.name ?? id;
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'En attente';
      case 'published': 
        return 'Confirmé';
      case 'rejected':
        return 'Refusé';
      default:
        return status;
    }
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  login(): void {
    this.router.navigate(['/connexion'], { queryParams: { redirect: '/contribuer' } });
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
