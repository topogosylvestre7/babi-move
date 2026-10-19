import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

export interface FooterLink {
  label: string;
  routerLink?: string;
  href?: string;
  badge?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface SocialLink {
  icon: string;
  href: string;
  label: string;
}

@Component({
  selector: 'ui-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class FullFooter {
  private readonly auth = inject(AuthService);

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly brandLetter = 'B';
  readonly brandName = 'Babi Move';
  readonly description =
    "Compare les trajets du Grand Abidjan en FCFA et en minutes : gbaka, woro-woro, SOTRA, bateau-bus et VTC. Des estimations pour t'aider à choisir, pas des tarifs officiels.";

  readonly socialLinks: SocialLink[] = [
    { icon: 'bi-whatsapp', href: '#', label: 'WhatsApp' },
    { icon: 'bi-twitter-x', href: '#', label: 'X (Twitter)' },
    { icon: 'bi-github', href: '#', label: 'GitHub' },
    { icon: 'bi-envelope', href: '#', label: 'Email' },
  ];

  readonly columns = computed<FooterColumn[]>(() => {
    const loggedIn = this.isLoggedIn();

    const navLinks: FooterLink[] = [
      { label: 'Accueil', routerLink: '/' },
      { label: 'Alertes', routerLink: '/alertes' },
      { label: 'Recherche', routerLink: '/resultats' },
    ];

    if (loggedIn) {
      navLinks.push({ label: 'Contribuer', routerLink: '/contribuer', badge: 'Nouveau' });
    }

    return [
      {
        title: 'Naviguer',
        links: navLinks,
      },
      {
        title: 'Mon espace',
        links: loggedIn
          ? [
              { label: 'Mon compte', routerLink: '/mon-espace' },
              { label: 'Mon historique', routerLink: '/historique' },
              { label: 'Mes favoris', routerLink: '/favoris' },
              { label: 'Mes contributions', routerLink: '/contribuer' },
            ]
          : [
              { label: 'Se connecter', routerLink: '/connexion' },
              { label: "S'inscrire", routerLink: '/inscription' },
            ],
      },
      {
        title: 'À propos',
        links: [
          { label: 'Le projet', routerLink: '/a-propos' }, 
          { label: 'Sources des données', href: 'https://www.openstreetmap.org/' }, 
          { label: 'Confidentialité', routerLink: '/legal' }, 
          { label: 'Contact', href: 'mailto:contact@babimove.ci' }, 
        ],
      },
    ];
  });

  readonly bottomLinks: FooterLink[] = [
    { label: 'Confidentialité', routerLink: '/legal' },
    { label: 'CGU', routerLink: '/legal' },
    { label: 'Cookies', routerLink: '/legal' },
    { label: 'Mentions légales', routerLink: '/legal' },
  ];

  readonly currentYear = new Date().getFullYear();
}
