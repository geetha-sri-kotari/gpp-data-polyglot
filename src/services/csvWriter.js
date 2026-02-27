const { Transform } = require('stream');

class CSVWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    
    this.columns = columns; // [{source: 'id', target: 'ID'}, ...]
    this.isFirstChunk = true;
    this.includeHeader = options.includeHeader !== false;
  }

  // Transform a chunk of rows to CSV
  _transform(chunk, encoding, callback) {
    try {
      let csvData = '';

      // Add header if this is the first chunk
      if (this.isFirstChunk && this.includeHeader) {
        const headers = this.columns.map(col => this.escapeCSV(col.target));
        csvData += headers.join(',') + '\n';
        this.isFirstChunk = false;
      }

      // Convert each row to CSV line
      for (const row of chunk) {
        const values = this.columns.map(col => {
          let value = row[col.source];
          
          // Handle JSON data for CSV (stringify nested objects)
          if (value && typeof value === 'object') {
            value = JSON.stringify(value);
          }
          
          return this.escapeCSV(value);
        });
        
        csvData += values.join(',') + '\n';
      }

      callback(null, csvData);
    } catch (err) {
      callback(err);
    }
  }

  // Escape CSV fields (handle commas, quotes, newlines)
  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);
    
    // Check if we need to quote the value
    if (stringValue.includes(',') || 
        stringValue.includes('"') || 
        stringValue.includes('\n') ||
        stringValue.includes('\r')) {
      // Escape quotes by doubling them
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    
    return stringValue;
  }
}

// Factory function to create CSV writer
const createCSVWriter = (columns) => {
  return new CSVWriter(columns);
};

module.exports = { CSVWriter, createCSVWriter };