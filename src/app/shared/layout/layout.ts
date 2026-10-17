import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../components/header/header';
import { FullFooter } from '../components/footer/footer';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Header, FullFooter],
  templateUrl: "./layout.html",
  styleUrl: "./layout.scss"
})
export class Layout {}