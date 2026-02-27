const { Transform } = require('stream');

class JSONWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    
    this.columns = columns; // Column mapping
    this.isFirstChunk = true;
    this.recordCount = 0;
  }

  // Start the JSON array
  _transform(chunk, encoding, callback) {
    try {
      let jsonData = '';

      // Start JSON array if this is the first chunk
      if (this.isFirstChunk) {
        jsonData += '[\n';
        this.isFirstChunk = false;
      }

      // Process each row in the chunk
      for (let i = 0; i < chunk.length; i++) {
        const row = chunk[i];
        
        // Create object with mapped column names
        const obj = {};
        for (const col of this.columns) {
          obj[col.target] = row[col.source];
        }

        // Add comma between objects (except first in array)
        if (this.recordCount > 0) {
          jsonData += ',\n';
        }

        jsonData += JSON.stringify(obj, null, 2);
        this.recordCount++;
      }

      callback(null, jsonData);
    } catch (err) {
      callback(err);
    }
  }

  // End the JSON array
  _flush(callback) {
    // Close the JSON array
    callback(null, '\n]');
  }
}

// Streaming JSON array generator (more memory efficient)
class JSONArrayWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    this.columns = columns;
    this.isFirstChunk = true;
  }

  _transform(chunk, encoding, callback) {
    try {
      let output = '';

      for (const row of chunk) {
        const obj = {};
        for (const col of this.columns) {
          obj[col.target] = row[col.source];
        }

        if (this.isFirstChunk) {
          output += JSON.stringify(obj);
          this.isFirstChunk = false;
        } else {
          output += '\n' + JSON.stringify(obj);
        }
      }

      callback(null, output);
    } catch (err) {
      callback(err);
    }
  }

  // This produces newline-delimited JSON (not a single array)
  // More memory efficient for extremely large datasets
}

const createJSONWriter = (columns, useArray = true) => {
  return useArray ? new JSONWriter(columns) : new JSONArrayWriter(columns);
};

module.exports = { JSONWriter, JSONArrayWriter, createJSONWriter };