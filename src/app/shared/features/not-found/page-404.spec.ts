import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Page404Component } from './page-404';

describe('Page404Component', () => {
  let component: Page404Component;
  let fixture: ComponentFixture<Page404Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Page404Component],
    }).compileComponents();

    fixture = TestBed.createComponent(Page404Component);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
