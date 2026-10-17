import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.html',
  styleUrls: ['./about.scss'],
})
export class About {
  values = [
    {
      icon: 'transparency',
      title: 'Transparence des prix',
      desc: 'Fini les mauvaises surprises. Comparez les tarifs des gbakas, woro-woros et bus SOTRA en FCFA avant de partir.',
      active: false,
    },
    {
      icon: 'community',
      title: 'La force de la communauté',
      desc: 'Les alertes trafic sont créées et confirmées par les Abidjanais eux-mêmes. Une info fiable, en temps réel.',
      active: true,
    },
    {
      icon: 'multimodal',
      title: 'Le réflexe multimodal',
      desc: 'Pourquoi choisir entre la route et la lagune ? Babi Move combine marche, bus, gbaka et bateau-bus pour optimiser votre temps.',
      active: false,
    },
  ];

  checklistMission = [
    'Réduire le stress des trajets quotidiens.',
    'Donner accès à une information fiable sur les prix.',
    "Favoriser l'utilisation des transports en commun.",
  ];

  checklistVision = [
    "Devenir l'application de référence du Grand Abidjan.",
    'Valoriser le jargon et la culture locale (le "Babi").',
    'Créer un réseau de mobilité intelligent et connecté.',
  ];
}
