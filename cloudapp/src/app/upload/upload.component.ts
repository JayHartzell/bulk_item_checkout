import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { AlertService, CloudAppEventsService, InitData, MaterialModule } from '@exlibris/exl-cloudapp-angular-lib';
import * as XLSX from 'xlsx';
import { CommonModule } from '@angular/common';

interface CircDeskConfig {
  library: string;
  circDesk: string;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss'
})
export class UploadComponent implements OnInit {
  file: File | null = null;
  @Output() fileProcessed = new EventEmitter<any>();
  readonly MAX_ITEMS = 250;
  
  circDeskConfig: CircDeskConfig = {
    library: '',
    circDesk: ''
  };

  constructor(
    private alert: AlertService,
    private eventsService: CloudAppEventsService
  ) { }

  ngOnInit() {
    this.loadContextInfo();
  }

  loadContextInfo() {
    this.eventsService.getInitData().subscribe((initData: InitData) => {
      if (initData?.user?.currentlyAtLibCode) {
        this.circDeskConfig.library = initData.user.currentlyAtLibCode;
      }
      if (initData?.user?.currentlyAtCircDesk) {
        this.circDeskConfig.circDesk = initData.user.currentlyAtCircDesk;
      }
    });
  }

  onFileSelected(event: any) {
    this.file = event.target.files[0];
  }

  processFile() {
    if (!this.file) {
      this.alert.error('Please select a file');
      return;
    }

    // Validate context before processing
    if (!this.circDeskConfig.library || !this.circDeskConfig.circDesk) {
      this.alert.error('Unable to detect your library and circulation desk. Please ensure you have selected an appropriate circulation desk for these loans.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb: XLSX.WorkBook = XLSX.read(data, { type: 'array' });
        const wsname: string = wb.SheetNames[0];
        const ws: XLSX.WorkSheet = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (jsonData.length < 2) {
          this.alert.error('File is empty or missing headers');
          return;
        }

        const headers = (jsonData[0] as string[]).map(h => h ? h.toString().toUpperCase().trim() : '');
        const primaryIdIndex = headers.indexOf('PRIMARYIDENTIFIER');
        const barcodeIndex = headers.indexOf('BARCODE');

        if (primaryIdIndex === -1 || barcodeIndex === -1) {
          this.alert.error('File must contain PRIMARYIDENTIFIER and BARCODE columns');
          return;
        }

        const items = jsonData.slice(1).map((row: any) => ({
          primaryId: row[primaryIdIndex]?.toString().trim(),
          barcode: row[barcodeIndex]?.toString().trim()
        })).filter(item => item.primaryId && item.barcode);

        if (items.length === 0) {
          this.alert.error('No valid rows found');
          return;
        }

        // Validate file size
        if (items.length > this.MAX_ITEMS) {
          this.alert.error(`File contains ${items.length} items. Maximum allowed is ${this.MAX_ITEMS}.`);
          return;
        }

        // Validate data quality
        const validationResult = this.validateItems(items);
        if (!validationResult.valid) {
          this.alert.error(validationResult.message);
          return;
        }

        this.alert.success(`File validated successfully. ${items.length} items ready to process at ${this.circDeskConfig.library} - ${this.circDeskConfig.circDesk}.`);
        this.fileProcessed.emit({ items, config: this.circDeskConfig });
      } catch (e) {
        console.error(e);
        this.alert.error('Error parsing file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(this.file);
  }

  private validateItems(items: any[]): { valid: boolean, message: string } {
    // Check for duplicates
    const barcodes = items.map(i => i.barcode);
    const duplicateBarcodes = barcodes.filter((b, index) => barcodes.indexOf(b) !== index);
    if (duplicateBarcodes.length > 0) {
      return {
        valid: false,
        message: `Duplicate barcodes found: ${[...new Set(duplicateBarcodes)].join(', ')}`
      };
    }

    // Check for empty or invalid values
    const invalidItems = items.filter(item => 
      !item.primaryId || 
      !item.barcode || 
      item.primaryId.length === 0 || 
      item.barcode.length === 0
    );
    if (invalidItems.length > 0) {
      return {
        valid: false,
        message: `Found ${invalidItems.length} items with empty primary ID or barcode`
      };
    }

    // Basic format validation for barcodes (alphanumeric, no special chars except dash/underscore)
    const invalidFormat = items.filter(item => 
      !/^[a-zA-Z0-9_-]+$/.test(item.barcode)
    );
    if (invalidFormat.length > 0) {
      const examples = invalidFormat.slice(0, 3).map(i => i.barcode).join(', ');
      return {
        valid: false,
        message: `Invalid barcode format detected (use alphanumeric, dash, underscore only). Examples: ${examples}`
      };
    }

    return { valid: true, message: '' };
  }
}
