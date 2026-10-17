import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Communaute } from './communaute';

describe('Communaute', () => {
  let component: Communaute;
  let fixture: ComponentFixture<Communaute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Communaute],
    }).compileComponents();

    fixture = TestBed.createComponent(Communaute);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
