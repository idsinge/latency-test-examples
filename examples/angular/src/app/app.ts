import { Component } from '@angular/core';
import { LatencyTesterComponent } from './latency-tester.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LatencyTesterComponent],
  template: `<app-latency-tester></app-latency-tester>`
})
export class App {}
