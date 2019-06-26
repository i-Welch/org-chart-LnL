import { Component } from '@angular/core';
import { ILayoutNode } from './org-chart/org-chart.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app works!';
  public layout: ILayoutNode[] = [
    {
      xPos: 10,
      yPos: 10,
      width: 18,
      height: 12,
      Id: "generic",
    },
  ];


}
