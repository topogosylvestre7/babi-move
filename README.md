=> Babi Move

Babi Move est une application web progressive (PWA) conçue pour faciliter la mobilité urbaine dans le Grand Abidjan. Elle permet aux usagers de comparer les itinéraires multimodaux (Gbaka, Woro-woro, SOTRA, Bateau-bus, VTC, Marche) en fonction du coût en FCFA et de la durée estimée.

Le nom "Babi" est un clin d'oeil au jargon local pour désigner Abidjan. L'objectif : rendre le déplacement quotidien plus prévisible, plus serein et moins coûteux.

Pour l'heure, dans le cadre du projet, toutes les données de l'application sont simulés côté utilisateur.

=> Le Contexte & La Problématique

Se déplacer à Abidjan peut rapidement devenir un parcours du combattant : embouteillages légendaires sur les ponts (HKB, De Gaulle), tarifs des transports informels variables (gbakas, woro-woros) et manque d'informations en temps réel sur l'état du trafic.

La solution Babi Move : Une plateforme centralisée qui combine les modes de transport formels et informels, s'appuie sur une communauté active pour signaler les incidents, et calcule des itinéraires optimisés.

=> Composants LibraryUI intégrés

Nous avons utilisé et adapté avec soin les composants du catalogue LibraryUI en respectant notre charte graphique (`tokens.scss`).

Voici les composants identifiables intégrés dans l'application :

1.  Header (Navbar) : Barre de navigation principale avec gestion de l'authentification et menu déroulant utilisateur.
2.  Footer : Pied de page complet avec liens dynamiques et appel à la contribution.
3.  Notifications : Panneau déroulant connecté à la cloche du header, affichant l'état d'avancement des signalements de l'utilisateur.
4.  Connexion (Forms) : Formulaire de connexion avec gestion d'erreurs.
5.  Inscription (Forms) : Formulaire de création de compte avec indicateur de force du mot de passe.
6.  Mot de passe oublié (Forms) : Formulaire de réinitialisation avec simulation d'envoi de lien.
7.  Modal (Détail d'un signalement) : Fenêtre contextuelle pour afficher les détails d'une contribution.
8.  Modal (Suppression) : Fenêtre de confirmation (alert dialog) avant la suppression d'un signalement.
9.  Profil : Espace personnel "Mon Compte" avec onglets (Vue d'ensemble, Paramètres, Sécurité, Notifications).
10. Upload : Zone de glisser-déposer (drag & drop) intégrée au formulaire de contribution citoyenne.
11. About : Page de présentation du projet, de la vision et des valeurs.

=> Fonctionnalités Principales

- Recherche & Comparaison : Autocomplétion (Nominatim + lieux locaux), calcul d'itinéraires avec carte interactive (Leaflet + OSRM) et tri (le plus rapide, le moins cher).

- Alertes en temps réel : Visualisation des perturbations avec filtres par commune, catégorie et priorité.

- Contribution Citoyenne : Signalement d'incidents (accidents, travaux, prix réels) avec possibilité d'ajouter une photo.

- Espace Utilisateur : Historique des trajets, favoris, gestion des préférences (budget max, mode préféré).

- Données Locales : L'application est 100% front-end (sans backend) et utilise le `localStorage` pour simuler l'authentification et la persistance des données.

=> Stack Technique

- Framework : Angular (Standalone Components, Signals).
- Cartographie : Leaflet + OpenStreetMap.
- Routing : OSRM (Open Source Routing Machine) pour le tracé réel sur les routes.
- Géocodage : Nominatim (OpenStreetMap) avec fallback local.
- Design System : SCSS avec tokens personnalisés + Bootstrap 5 (re-thémé).

=> Données Simulées

Tous les fichiers de ce projet contiennent des données simulées. Les tarifs, durées, lignes de bateau-bus et alertes sont des estimations réalistes, mais non officielles. Les coordonnées géographiques sont également approximatives.

Fichiers de données (`public/data/`)

- `communes.json` : 13 communes du Grand Abidjan.
- `places.json` : 33 lieux connus pour l'autocomplétion.
- `transport-modes.json` : 6 modes de transport avec leurs caractéristiques.
- `routes.json` : 20 axes avec coûts/durées par mode et règles de calcul.
- `alerts.json` : 18 alertes réparties par priorité (critique, élevée, moyenne, info).

Calcul d'un itinéraire

1.  Recherche de l'axe : Si un axe existe entre la commune de départ et d'arrivée, on utilise ses offres de transport.

2.  Calcul de secours : Sinon, on utilise les règles `fallback` de `routes.json` (modes éligibles et distance maximale).

3.  Prise en compte de l'heure : Ajustement des durées selon l'heure de pointe et le week-end.
    "
    text
    durée = durationMin × (1 + (facteur de la période − 1) × trafficSensitivity)
    "

4.  Association des alertes : Une alerte est liée à un itinéraire si elle touche l'une des communes traversées.

=> Gestion dynamique des dates
Le fichier `alerts.json` utilise `updatedMinutesAgo` (au lieu d'une date fixe). Au chargement, `AlertService` calcule :

"updatedAt = maintenant − updatedMinutesAgo"

Cela garantit un affichage relatif crédible (ex: « Mise à jour il y a 12 min »).

Note importante : L'interface présente toujours les tarifs et durées comme des « estimations ».

=> Installation & Lancement

1. Cloner le dépôt

2. Installer les dépendances

3. Lancer le serveur de développement

4. Ouvrir votre navigateur à l'adresse `http://localhost:4200` ou autre selon le port choisit.

=> Roadmap (Évolutions futures)

L'architecture actuelle a été pensée pour être facilement connectée à une API réelle. Les services (`DataService`, `AlertService`, `ItineraryService`) isolent la source de données.

- Intégration API : Remplacer les fichiers JSON par des appels HTTP vers une base de données ou une API de transport réelle.

- Backend & Authentification : Migrer de la simulation `localStorage` vers un backend sécurisé (laravel).

- Temps réel : Intégrer WebSockets pour la mise à jour instantanée des alertes.

- PWA : Finaliser le service worker pour le mode hors-ligne complet.
