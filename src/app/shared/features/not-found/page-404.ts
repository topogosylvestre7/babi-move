import { Component, inject, ViewEncapsulation } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

interface UsefulLink {
  label: string;
  path: string;
  icon: string;
}

@Component({
  selector: 'ui-page-404',
  imports: [RouterLink],
  templateUrl: './page-404.html',
  styleUrls: ['./page-404.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class Page404Component {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly usefulLinks: UsefulLink[] = [
    { label: 'Accueil', path: '/', icon: 'bi-house' },
    { label: 'Alertes', path: '/alertes', icon: 'bi-bell' },
    { label: 'Contribuer', path: '/contribuer', icon: 'bi-megaphone' },
    { label: 'Connexion', path: '/connexion', icon: 'bi-box-arrow-in-right' },
  ];

  /** Envoie la destination saisie vers la page des résultats. */
  onSearch(query: string): void {
    const destination = query.trim();
    if (!destination) return;
    this.router.navigate(['/resultats'], { queryParams: { vers: destination } });
  }

  goHome(): void {
    this.router.navigateByUrl('/');
  }

  /** Revient en arrière ; sans historique (lien ouvert directement), va à l'accueil. */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.goHome();
    }
  }
}
