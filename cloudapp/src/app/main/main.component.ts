import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {
  items: any[] | null = null;
  config: any = null;

  constructor() { }

  ngOnInit() {
  }

  onFileProcessed(data: any) {
    this.items = data.items;
    this.config = data.config;
  }

  onBack() {
    this.items = null;
    this.config = null;
  }
}