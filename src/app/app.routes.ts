import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { Layout } from './shared/layout/layout';

export const routes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      {
        path: '',
        loadComponent: () => import('./shared/features/home/home').then((c) => c.Home),
        title: 'Bienvenue sur Babi Move',
      },
      {
        path: 'a-propos',
        loadComponent: () => import('./shared/features/about/about').then((c) => c.About),
        title: 'Tout savoir sur Babi move',
      },
      {
        path: 'resultats',
        loadComponent: () => import('./shared/features/result/result').then((c) => c.Result),
        title: 'Les résultats',
      },
      {
        path: 'itineraire/:id',
        loadComponent: () =>
          import('./shared/features/itinerary-detail/itinerary-detail').then(
            (c) => c.ItineraryDetail,
          ),
        title: "Détail de l'itinéraire",
      },
      {
        path: 'alertes',
        loadComponent: () => import('./shared/features/alerts/alerts').then((c) => c.Alerts),
        title: 'Les alertes',
      },
      // Pages réservées aux comptes connectés
      {
        path: 'mon-espace',
        canActivate: [authGuard],
        loadComponent: () => import('./shared/features/account/account').then((c) => c.Account),
        title: 'Mon espace',
      },
      {
        path: 'historique',
        canActivate: [authGuard],
        loadComponent: () => import('./shared/features/history/history').then((c) => c.History),
        title: 'Mon historique',
      },
      {
        path: 'favoris',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./shared/features/favorites/favorites').then((c) => c.Favorites),
        title: 'Mes favoris',
      },
      {
        path: 'contribuer',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./shared/features/contributions/contributions').then((c) => c.Contributions),
        title: 'Faire un signalement',
      },
      {
        path: 'notre-communaute',
        // canActivate: [authGuard],
        loadComponent: () =>
          import('./shared/features/communaute/communaute').then((c) => c.Communaute),
        title: 'Voir tous les signalements citoyens',
      },
    ],
  },

  // Authentification
  {
    path: 'inscription',
    loadComponent: () =>
      import('./shared/features/auth/register/register').then((c) => c.RegisterComponent),
    title: 'Inscris-toi !',
  },

  {
    path: 'connexion',
    loadComponent: () => import('./shared/features/auth/login/login').then((c) => c.LoginComponent),
    title: 'Connecte-toi !',
  },

  {
    path: 'mot-de-passe-oublie',
    loadComponent: () =>
      import('./shared/features/auth/password-reset/password-reset').then((c) => c.PasswordReset),
    title: 'Mot de passe oublié',
  },

  // Pages non prévues
  {
    path: '**',
    loadComponent: () =>
      import('./shared/features/not-found/page-404').then((c) => c.Page404Component),
    title: 'Page non trouvée',
  },
];
