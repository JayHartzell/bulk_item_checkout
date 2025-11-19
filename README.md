# Bulk Item Checkout

A cloud app for Ex Libris Alma that enables batch checkout of items to users.

## Description

This application allows library staff to perform bulk checkouts by uploading a file containing user primary identifiers and item barcodes. The app processes each checkout sequentially and provides real-time feedback on success or failure for each transaction.

## Features

- **File Upload**: Upload CSV or Excel files with user and item data
- **Real-time Processing**: View checkout status as each item is processed
- **Results Download**: Export detailed results to CSV
- **Return File Generation**: Generate a text file of successfully checked-out barcodes for use with the Bulk Scan-in app
- **Automatic Context Detection**: Uses your current library and circulation desk settings in Alma

## File Format

The upload file must contain two columns with the following headers:

- `PRIMARYIDENTIFIER` - The user's primary identifier
- `BARCODE` - The item barcode to checkout

### Example CSV:
```
PRIMARYIDENTIFIER,BARCODE
user123,1000123456
user456,1000789012
studentA,1000345678
```

### Example Excel:
| PRIMARYIDENTIFIER | BARCODE     |
|------------------|-------------|
| user123          | 1000123456  |
| user456          | 1000789012  |
| studentA         | 1000345678  |

## Usage

1. **Navigate to the app** in your Alma interface
2. **Select your file** - Click "Choose File" and select your CSV or Excel file (Max 250 rows)
3. **Click Next** - The app will validate your file format
4. **Start Processing** - Click "Start Processing" to begin batch checkouts
5. **Monitor Progress** - Watch real-time updates as items are processed
6. **Download Results** (optional) - Click "Download Results" to export a detailed CSV report
7. **Download Return File** (optional) - Click "Download Return File" to generate a text file of barcodes for bulk check-in using the Bulk Scan-In Cloud App.

## Results

After processing, you'll see:
- Total items processed
- Success count (green checkmarks)
- Error count (red exclamation marks)
- Detailed status message for each item

## Return Workflow

The "Download Return File" button generates a plain text file containing only the barcodes of successfully checked-out items. This file can be used with the Bulk Scan-in app to process returns efficiently.

## Technical Requirements

- A Circulation Desk Operator Role for the circ desk you want to loan from
- Items must be loanable and available

## License

BSD-3-Clause
