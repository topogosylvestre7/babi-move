import { TestBed } from '@angular/core/testing';

import { Itinerary } from './itinerary';

describe('Itinerary', () => {
  let service: Itinerary;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Itinerary);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
