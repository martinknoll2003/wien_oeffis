import { Component, CSP_NONCE, Injectable, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule, JsonPipe, DatePipe} from '@angular/common';
import { interval, timer } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, JsonPipe, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('first-poc-oeffis-pi');

  constructor(private http: HttpClient) {}

  relevantStops: Map<string, number> = new Map<string, number>([
    ['Reumannplatz_U1_Oberlaa', 4128],
    ['Reumannplatz_U1_Leopoldau', 4101], 
    ['Schrankenbergasse_Richtung_Reumannplatz', 420],
    ['Schrankenbergasse_Richtung_U3', 406],
  ]);

  currentTime = signal(new Date());
  richtungReumannPlatz: {line:string; times: Date[]}[] = [];
  richtungGeiereckStrasse: {line:string; times: Date[]}[] = [];
  bufferItems: {line:string; times: Date[]}[] = [];
  data: any = null;
  error = "";
  loading = false;

  /*
    @if (this.loading) {
      <h1>LOADING DATA</h1>
  }

  @if (this.error) {
      <h1>ERROR: {{this.error}}</h1>
  }
  */
  
  ngOnInit() {
    
    interval(1000).subscribe(() => {
      this.currentTime.set(new Date());
    });
    

    this.fetchData(this.relevantStops.get('Schrankenbergasse_Richtung_Reumannplatz')!, this.richtungReumannPlatz);
    this.fetchData(this.relevantStops.get('Schrankenbergasse_Richtung_U3')!, this.richtungGeiereckStrasse);

    timer(0, 15000).subscribe(() => {
      this.fetchData(this.relevantStops.get('Schrankenbergasse_Richtung_Reumannplatz')!, this.richtungReumannPlatz);
      this.fetchData(this.relevantStops.get('Schrankenbergasse_Richtung_U3')!, this.richtungGeiereckStrasse);
    });
  }

  fetchData(stationNummer: number, woSpeichern: {line:string; times: Date[]}[]) {

    console.log("Fetching data for station number: " + stationNummer);

    this.error = "";
    this.data = null; 

    let params = new HttpParams().set('rbl', String(stationNummer));

    this.http.get<any>('/wl/monitor', { params, observe: 'response'}).subscribe({
      next: (response) => {
        console.log("Data fetched successfully:", response.body);
        const body = (response as any).body ?? response;
        this.data = response;
        this.error = "";
        this.bufferItems = this.getItems(body);
        woSpeichern.length = 0;
        woSpeichern.push(...this.bufferItems);
        this.loading = false; 
      },
      error: (err) => {
        console.error("Error fetching data:", err);
        this.error = "Error fetching data: " + err.message;
        this.loading = false;
      }
    });
  }

  normasileIso(t:string): string {
    return t.replace(/([+-]\d{2})(\d{2})$/,"$1:$2");
  }

  getItems(body: any) {
    console.log("Processing data to extract items:", body);

    /*
    if (!this.data) {
      console.log("No Data found");
      return [];
    } else {
      if (!this.data.data) {
        console.log("No data.data found");
        return [];
      } else {
        if (!this.data.data.monitors) {
          console.log("No data.data.monitors found");
          return [];
        }
      }
    }
    */

    const items: {line:string; times: Date[]}[] = [];
    for (const m of this.asArray(body?.data?.monitors)) {
      console.log("Processing monitor:", m);
      for (const line of this.asArray(m?.lines)) {
        console.log
        const times: Date[] = [];
        for (const dep of this.asArray(line?.departures?.departure)) {
          console.log("Processing departure:", dep);
          const t = dep?.departureTime?.timeReal ?? dep?.departureTime?.timePlanned;
          if (t) {
          console.log("Adding time:", t);
          if (this.getTimeDiff(new Date(this.normasileIso(t))).diffInS > 60) {
            times.push(new Date(this.normasileIso(t)));
          }
          }
        }
        console.log("Adding line with times:", line.name, times);
        items.push({line: line.name!, times});
      }
    }
    console.log("Extracted items:", items);
    return items;
  }

  private asArray<T>(v: T | T[] | null | undefined): T[] {
    return Array.isArray(v) ? v : v == null ? [] : [v];
  }

  getTimeDiff(t: Date) {
    const diffMs = Math.abs(this.currentTime()!.getTime() - t.getTime());
    const seconds = Math.floor(diffMs / 1000) % 60;
    const minutes = Math.floor(diffMs / (1000 * 60));
    return { diffInS: minutes * 60 + seconds, display: `${minutes}m ${seconds}s`};
  }

}