const { Transform } = require('stream');
const xmlbuilder = require('xmlbuilder');

class XMLWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    
    this.columns = columns;
    this.rootName = options.rootName || 'records';
    this.recordName = options.recordName || 'record';
    this.isFirstChunk = true;
    this.xmlDeclWritten = false;
  }

  _transform(chunk, encoding, callback) {
    try {
      let xmlData = '';

      // Write XML declaration and root opening tag for first chunk
      if (!this.xmlDeclWritten) {
        xmlData += '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlData += `<${this.rootName}>\n`;
        this.xmlDeclWritten = true;
      }

      // Process each row in the chunk
      for (const row of chunk) {
        xmlData += `  <${this.recordName}>\n`;

        // Add each column as an element
        for (const col of this.columns) {
          let value = row[col.source];
          
          // Handle null/undefined
          if (value === null || value === undefined) {
            value = '';
          }
          
          // Handle objects (JSON) - convert to string for XML
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          }

          // Escape XML special characters
          const escapedValue = this.escapeXML(String(value));
          xmlData += `    <${col.target}>${escapedValue}</${col.target}>\n`;
        }

        xmlData += `  </${this.recordName}>\n`;
      }

      callback(null, xmlData);
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    // Close the root element
    callback(null, `</${this.rootName}>`);
  }

  // Escape XML special characters
  escapeXML(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Alternative using xmlbuilder for more complex XML
class XMLBuilderWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    this.columns = columns;
    this.rootName = options.rootName || 'records';
    this.recordName = options.recordName || 'record';
    this.doc = null;
    this.currentRecord = 0;
    this.buffer = '';
  }

  _transform(chunk, encoding, callback) {
    try {
      // Initialize XML document on first chunk
      if (!this.doc) {
        this.doc = xmlbuilder.create(this.rootName, { 
          version: '1.0', 
          encoding: 'UTF-8',
          standalone: true 
        });
      }

      // Add records
      for (const row of chunk) {
        const record = this.doc.ele(this.recordName);
        
        for (const col of this.columns) {
          let value = row[col.source];
          
          if (value && typeof value === 'object') {
            value = JSON.stringify(value);
          }
          
          record.ele(col.target, String(value || ''));
        }
      }

      // Convert to string periodically to avoid memory buildup
      if (++this.currentRecord % 1000 === 0) {
        const xml = this.doc.end({ pretty: true });
        this.push(xml);
        this.doc = null; // Reset to start new document (simplified approach)
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    if (this.doc) {
      const xml = this.doc.end({ pretty: true });
      callback(null, xml);
    } else {
      callback();
    }
  }
}

const createXMLWriter = (columns) => {
  return new XMLWriter(columns);
};

module.exports = { XMLWriter, createXMLWriter };