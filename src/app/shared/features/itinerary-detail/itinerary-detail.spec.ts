import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItineraryDetail } from './itinerary-detail';

describe('ItineraryDetail', () => {
  let component: ItineraryDetail;
  let fixture: ComponentFixture<ItineraryDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItineraryDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(ItineraryDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
