// Liste des comptes inscrits, côté Angular, sans API.
// Les comptes créés par l'inscription sont ajoutés à cette liste puis
// conservés dans le stockage local de l'appareil.
// ATTENTION : simulation non sécurisée (mots de passe en clair).
// Ne jamais saisir un vrai mot de passe dans la démo.

import { RegisteredAccount } from '../models/models';

export const REGISTER_STORAGE_KEY = 'babi-move.register';
export const SESSION_STORAGE_KEY = 'babi-move.session';

// Durée d'une session simulée : 7 jours.
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Durée de validité d'un lien « mot de passe oublié » : 30 minutes.
export const RESET_DURATION_MS = 30 * 60 * 1000;

//  présents au premier lancement, pour la démo.
export const REGISTER_SEED: RegisteredAccount[] = [
  {
    id: 'u-demo-001',
    firstName: 'Awa',
    lastName: 'Kouassi',
    email: 'demo@babimove.ci',
    password: 'demo1234',
    createdAt: '2026-10-01T08:00:00.000Z',
    preferences: {
      preferredMode: 'sotra',
      maxBudgetFcfa: 1500,
      avoidedModes: [],
      notifications: { email: true, push: true, trafficAlerts: true },
    },
  },
];
