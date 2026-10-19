import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage';
import { AuthService } from './auth';
import { Contribution, ContributionType, CommuneId } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ContributionService {
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);
  private readonly STORAGE_KEY = 'contributions';

  save(input: {
    type: ContributionType;
    commune: CommuneId;
    description: string;
    photo?: { name: string; sizeBytes: number; mimeType: string; dataUrl: string };
  }): Contribution {
    const user = this.auth.currentUser();
    const contribution: Contribution = {
      id: crypto.randomUUID(),
      userId: user?.id ?? 'anonyme',
      type: input.type,
      commune: input.commune,
      description: input.description.trim(),
      photo: input.photo,
      createdAt: new Date().toISOString(),
      status: 'pending', // On simule une modération
    };

    const all = this.getAll();
    this.storage.write(this.STORAGE_KEY, [contribution, ...all]);
    return contribution;
  }

  update(
    id: string,
    input: {
      type: ContributionType;
      commune: CommuneId;
      description: string;
      photo?: { name: string; sizeBytes: number; mimeType: string; dataUrl: string };
    },
  ): void {
    const all = this.getAll();
    const updated = all.map((c) =>
      c.id === id
        ? {
            ...c,
            type: input.type,
            commune: input.commune,
            description: input.description.trim(),
            photo: input.photo,
            status: 'pending' as const, // Repasse en modération après édition
          }
        : c,
    );
    this.storage.write(this.STORAGE_KEY, updated);
  }

  delete(id: string): void {
    const all = this.getAll().filter((c) => c.id !== id);
    this.storage.write(this.STORAGE_KEY, all);
  }

  getAll(): Contribution[] {
    return this.storage.read<Contribution[]>(this.STORAGE_KEY) ?? [];
  }

  getUserContributions(userId: string): Contribution[] {
    return this.getAll().filter((c) => c.userId === userId);
  }

  // Dans contribution.service.ts
  getAllContributions(): Contribution[] {
    return this.storage.read<Contribution[]>('contributions') ?? [];
  }
}
