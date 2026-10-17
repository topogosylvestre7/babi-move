import { TestBed } from '@angular/core/testing';

import { Contribution } from './contribution';

describe('Contribution', () => {
  let service: Contribution;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Contribution);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
