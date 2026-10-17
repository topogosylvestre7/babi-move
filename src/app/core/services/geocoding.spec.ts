import { TestBed } from '@angular/core/testing';

import { Geocoding } from './geocoding';

describe('Geocoding', () => {
  let service: Geocoding;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Geocoding);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
