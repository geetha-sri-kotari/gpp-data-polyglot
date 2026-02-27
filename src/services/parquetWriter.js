const parquet = require('parquetjs');
const { Transform } = require('stream');
const { PassThrough } = require('stream');

class ParquetWriter extends Transform {
  constructor(columns, options = {}) {
    super({ objectMode: true, ...options });
    
    this.columns = columns;
    this.schema = this.buildSchema();
    this.writer = null;
    this.buffer = Buffer.alloc(0);
    this.rowGroupSize = options.rowGroupSize || 10000;
  }

  buildSchema() {
    const schemaDefinition = {};
    
    for (const col of this.columns) {
      // Determine Parquet data type based on column name/content
      // This is simplified - in production you'd want actual type detection
      if (col.source === 'id') {
        schemaDefinition[col.target] = { type: 'INT64' };
      } else if (col.source === 'value') {
        schemaDefinition[col.target] = { type: 'DOUBLE' };
      } else if (col.source === 'created_at') {
        schemaDefinition[col.target] = { type: 'TIMESTAMP_MILLIS' };
      } else if (col.source === 'metadata') {
        // For JSON, we'll store as string in Parquet (simplified)
        schemaDefinition[col.target] = { type: 'UTF8' };
      } else {
        schemaDefinition[col.target] = { type: 'UTF8' };
      }
    }
    
    return new parquet.ParquetSchema(schemaDefinition);
  }

  async _transform(chunk, encoding, callback) {
    try {
      // Create writer if not exists
      if (!this.writer) {
        // Use a PassThrough stream to capture Parquet output
        this.outputStream = new PassThrough();
        this.writer = await parquet.ParquetWriter.openStream(
          this.schema, 
          this.outputStream
        );
        
        // Set row group size for memory efficiency
        this.writer.setRowGroupSize(this.rowGroupSize);
        
        // Pipe output to our buffer collector
        this.outputStream.on('data', (data) => {
          this.buffer = Buffer.concat([this.buffer, data]);
          this.push(data);
        });
      }

      // Write each row
      for (const row of chunk) {
        const parquetRow = {};
        
        for (const col of this.columns) {
          let value = row[col.source];
          
          // Handle special types
          if (col.source === 'created_at' && value) {
            value = new Date(value).getTime(); // Convert to timestamp
          }
          
          if (col.source === 'metadata' && value) {
            value = JSON.stringify(value); // Store JSON as string
          }
          
          parquetRow[col.target] = value;
        }
        
        await this.writer.write(parquetRow);
      }
      
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async _flush(callback) {
    try {
      if (this.writer) {
        await this.writer.close();
      }
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

// Simple streaming Parquet writer factory
const createParquetWriter = (columns) => {
  return new ParquetWriter(columns);
};

module.exports = { ParquetWriter, createParquetWriter };