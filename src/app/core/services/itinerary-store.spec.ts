import { TestBed } from '@angular/core/testing';

import { ItineraryStore } from './itinerary-store';

describe('ItineraryStore', () => {
  let service: ItineraryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ItineraryStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
