import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CloudAppRestService, HttpMethod, Request, AlertService, MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';
import { CommonModule } from '@angular/common';
import { catchError, concatMap, finalize, from, map, mergeMap, of, retry, Subscription, takeUntil, tap, timer, Subject } from 'rxjs';
import * as XLSX from 'xlsx';

interface CheckoutItem {
  primaryId: string;
  barcode: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

@Component({
  selector: 'app-processing',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './processing.component.html',
  styleUrl: './processing.component.scss'
})
export class ProcessingComponent implements OnInit, OnDestroy {
  @Input() set items(value: any[]) {
    this._items = value.map((i: any) => ({ ...i, status: 'pending', message: '' }));
  }
  get items(): CheckoutItem[] {
    return this._items;
  }
  private _items: CheckoutItem[] = [];

  @Input() config: any;
  @Output() back = new EventEmitter<void>();

  processedCount = 0;
  successCount = 0;
  errorCount = 0;
  isProcessing = false;
  maxConcurrentRequests = 10; // Alma's concurrent request limit per user session
  private cancelSubject = new Subject<void>();
  private processingSubscription?: Subscription;
  startTime?: number;

  get progressPercentage(): number {
    return this.items.length > 0 ? (this.processedCount / this.items.length) * 100 : 0;
  }

  get estimatedTimeRemaining(): string {
    if (!this.isProcessing || !this.startTime || this.processedCount === 0) {
      return '--';
    }
    const elapsed = Date.now() - this.startTime;
    const avgTimePerItem = elapsed / this.processedCount;
    const remainingItems = this.items.length - this.processedCount;
    const remainingMs = avgTimePerItem * remainingItems;
    
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  constructor(
    private restService: CloudAppRestService,
    private alert: AlertService
  ) { }

  ngOnInit() {
  }

  ngOnDestroy() {
    this.cancelProcessing();
  }

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: any): void {
    if (this.isProcessing) {
      $event.returnValue = 'Processing is in progress. Are you sure you want to leave?';
    }
  }

  process() {
    this.isProcessing = true;
    this.processedCount = 0;
    this.successCount = 0;
    this.errorCount = 0;
    this.cancelSubject = new Subject<void>();
    this.startTime = Date.now();
    
    // Reset statuses if re-running
    this.items.forEach(i => {
        i.status = 'pending';
        i.message = '';
    });

    // Use mergeMap with maxConcurrentRequests to control concurrent API calls
    // CloudAppRestService queues requests internally, but we can optimize by controlling concurrency
    this.processingSubscription = from(this.items).pipe(
      mergeMap(item => this.processItem(item), this.maxConcurrentRequests),
      takeUntil(this.cancelSubject),
      finalize(() => {
        this.isProcessing = false;
        const message = this.cancelSubject.closed 
          ? `Processing cancelled. Success: ${this.successCount}, Errors: ${this.errorCount}, Pending: ${this.items.length - this.processedCount}`
          : `Processing complete. Success: ${this.successCount}, Errors: ${this.errorCount}`;
        this.alert.success(message);
      })
    ).subscribe();
  }

  cancelProcessing() {
    if (this.isProcessing) {
      this.cancelSubject.next();
      this.cancelSubject.complete();
      // Mark remaining pending items as cancelled
      this.items.forEach(item => {
        if (item.status === 'pending') {
          item.status = 'error';
          item.message = 'Cancelled by user';
        }
      });
      this.isProcessing = false;
    }
  }

  private processItem(item: CheckoutItem) {
    const requestBody: any = {
      circ_desk: {
        value: this.config?.circDesk
      },
      library: {
        value: this.config?.library
      }
    };

    const request: Request = {
      url: `/users/${item.primaryId}/loans`,
      method: HttpMethod.POST,
      queryParams: { 
        item_barcode: item.barcode
      },
      requestBody: requestBody,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    return this.restService.call(request).pipe(
      retry({
        count: 2,
        delay: (error, retryCount) => {
          // Retry on server errors (5xx) or network errors
          if (error.status >= 500 || error.status === 0) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000); // Exponential backoff: 1s, 2s, max 5s
            return timer(delay);
          }
          // Don't retry on client errors (4xx)
          throw error;
        }
      }),
      map(() => {
        item.status = 'success';
        item.message = 'Checked out successfully';
        this.successCount++;
        return item;
      }),
      catchError(err => {
        item.status = 'error';
        if (err.status === 400) {
          item.message = err.error?.errorList?.error?.[0]?.errorMessage || 'Invalid request - check user ID and barcode';
        } else if (err.status === 401 || err.status === 403) {
          item.message = 'Authentication error - insufficient permissions';
        } else if (err.status === 404) {
          item.message = 'User or item not found';
        } else if (err.status >= 500) {
          item.message = 'Server error - please try again later';
        } else if (err.status === 0) {
          item.message = 'Network error - check your connection';
        } else {
          item.message = err.message || 'Error checking out';
        }
        this.errorCount++;
        return of(item);
      }),
      tap(() => this.processedCount++)
    );
  }

  download() {
    const data = this.items.map(i => ({
      'Primary Identifier': i.primaryId,
      'Barcode': i.barcode,
      'Status': i.status,
      'Message': i.message
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Results');
    XLSX.writeFile(wb, 'checkout_results.csv');
  }

  downloadReturnFile() {
    const successfulBarcodes = this.items
      .filter(i => i.status === 'success')
      .map(i => i.barcode)
      .join('\n');
    
    if (successfulBarcodes.length === 0) {
      this.alert.info('No successful checkouts to include in return file');
      return;
    }

    const blob = new Blob([successfulBarcodes], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'return_barcodes.txt';
    link.click();
    window.URL.revokeObjectURL(url);
    
    this.alert.info('Return file downloaded. Use the Bulk Scan-in app to process returns.');
  }
}
