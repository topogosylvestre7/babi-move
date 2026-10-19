import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './legal.html',
  styleUrl: './legal.scss',
})
export class Legal implements OnInit {
  private readonly route = inject(ActivatedRoute);

  activeTab: 'confidentialite' | 'cgu' | 'cookies' | 'mentions' = 'confidentialite';

  ngOnInit(): void {
    // On écoute les paramètres de l'URL (ex: /legal?tab=cgu)
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab && ['confidentialite', 'cgu', 'cookies', 'mentions'].includes(tab)) {
        this.activeTab = tab as any;
      }
    });
  }
}
