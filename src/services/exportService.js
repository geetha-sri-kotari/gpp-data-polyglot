const { v4: uuidv4 } = require('uuid');
const { createGzip } = require('zlib');
const { PassThrough, Readable, Transform } = require('stream');
const { query } = require('../config/database');

// In-memory store for export jobs
const exportJobs = new Map();

class ExportService {
  static createExportJob(format, columns, compression = null) {
    const exportId = uuidv4();
    
    const job = {
      id: exportId,
      format,
      columns,
      compression: format === 'parquet' ? null : compression,
      status: 'pending',
      createdAt: new Date(),
      progress: 0,
      totalRows: 0
    };
    
    exportJobs.set(exportId, job);
    return job;
  }

  static getExportJob(exportId) {
    return exportJobs.get(exportId);
  }

  static async createExportStream(exportId) {
    const job = exportJobs.get(exportId);
    
    if (!job) {
      throw new Error('Export job not found');
    }

    job.status = 'processing';
    
    // Create the appropriate transform stream
    let transformStream;
    switch (job.format) {
      case 'csv':
        transformStream = this.createCSVStream(job.columns);
        break;
      case 'json':
        transformStream = this.createJSONStream(job.columns);
        break;
      case 'xml':
        transformStream = this.createXMLStream(job.columns);
        break;
      case 'parquet':
        transformStream = this.createParquetStream(job.columns);
        break;
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    // Create database stream with small batch size
    const dbStream = await this.createDatabaseStream(100); // Only 100 rows at a time
    
    // Track progress
    let rowCount = 0;
    dbStream.on('data', () => {
      rowCount++;
      if (rowCount % 1000 === 0) {
        job.progress = Math.min(90, Math.floor((rowCount / 10000000) * 100));
        console.log(`Progress: ${job.progress}% (${rowCount} rows)`);
      }
    });

    // Pipe database stream to transform stream
    dbStream.pipe(transformStream);
    
    // Handle completion
    transformStream.on('finish', () => {
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date();
      job.totalRows = rowCount;
      console.log(`Export ${exportId} completed: ${rowCount} rows`);
    });

    transformStream.on('error', (err) => {
      job.status = 'failed';
      job.error = err.message;
      console.error(`Export ${exportId} failed:`, err);
    });

    // Add compression if needed
    if (job.compression === 'gzip' && job.format !== 'parquet') {
      return transformStream.pipe(createGzip());
    }
    
    return transformStream;
  }

  static createDatabaseStream(batchSize = 100) {
    let lastId = 0;
    let hasMore = true;
    
    const stream = new Readable({
      objectMode: true,
      read: async function() {
        if (!hasMore) {
          this.push(null);
          return;
        }

        try {
          const result = await query(
            `SELECT id, created_at, name, value, metadata 
             FROM records 
             WHERE id > $1 
             ORDER BY id 
             LIMIT $2`,
            [lastId, batchSize]
          );

          const rows = result.rows;
          
          if (rows.length === 0) {
            hasMore = false;
            this.push(null);
          } else {
            lastId = rows[rows.length - 1].id;
            // Push each row individually
            for (const row of rows) {
              this.push(row);
            }
          }
        } catch (err) {
          this.destroy(err);
        }
      }
    });

    return stream;
  }

  static createCSVStream(columns) {
    let isFirst = true;
    
    return new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        try {
          if (isFirst) {
            // Write header
            const header = columns.map(col => col.target).join(',') + '\n';
            this.push(header);
            isFirst = false;
          }
          
          // Write row
          const values = columns.map(col => {
            let val = row[col.source];
            if (val && typeof val === 'object') {
              val = JSON.stringify(val);
            }
            // Simple CSV escaping
            if (val && typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
              val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val !== null && val !== undefined ? val : '';
          });
          
          this.push(values.join(',') + '\n');
          callback();
        } catch (err) {
          callback(err);
        }
      }
    });
  }

  static createJSONStream(columns) {
    let isFirst = true;
    let count = 0;
    
    return new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        try {
          if (isFirst) {
            this.push('[\n');
            isFirst = false;
          } else {
            this.push(',\n');
          }
          
          const obj = {};
          for (const col of columns) {
            obj[col.target] = row[col.source];
          }
          
          this.push(JSON.stringify(obj));
          count++;
          callback();
        } catch (err) {
          callback(err);
        }
      },
      flush(callback) {
        this.push('\n]');
        callback();
      }
    });
  }

  static createXMLStream(columns) {
    let isFirst = true;
    
    return new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        try {
          if (isFirst) {
            this.push('<?xml version="1.0" encoding="UTF-8"?>\n<records>\n');
            isFirst = false;
          }
          
          this.push('  <record>\n');
          for (const col of columns) {
            let val = row[col.source];
            if (val && typeof val === 'object') {
              val = JSON.stringify(val);
            }
            // XML escape
            if (val) {
              val = String(val).replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;')
                              .replace(/"/g, '&quot;')
                              .replace(/'/g, '&apos;');
            }
            this.push(`    <${col.target}>${val || ''}</${col.target}>\n`);
          }
          this.push('  </record>\n');
          callback();
        } catch (err) {
          callback(err);
        }
      },
      flush(callback) {
        this.push('</records>');
        callback();
      }
    });
  }

  static createParquetStream(columns) {
    // Simple implementation - outputs JSON lines (for testing)
    // In production, use a proper Parquet library
    return new Transform({
      objectMode: true,
      transform(row, encoding, callback) {
        try {
          const obj = {};
          for (const col of columns) {
            obj[col.target] = row[col.source];
          }
          this.push(JSON.stringify(obj) + '\n');
          callback();
        } catch (err) {
          callback(err);
        }
      }
    });
  }

  static async runBenchmark() {
    const results = {};
    const formats = ['csv', 'json', 'xml', 'parquet'];
    
    for (const format of formats) {
      console.log(`Benchmarking ${format}...`);
      
      const columns = [
        { source: 'id', target: 'id' },
        { source: 'name', target: 'name' },
        { source: 'value', target: 'value' }
      ];
      
      const job = this.createExportJob(format, columns);
      
      const startTime = process.hrtime();
      const startMemory = process.memoryUsage().heapUsed;
      
      const stream = await this.createExportStream(job.id);
      
      let bytesWritten = 0;
      let rowCount = 0;
      
      await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
          bytesWritten += chunk.length;
          if (format === 'json') {
            // Rough count for JSON
            rowCount += (chunk.toString().match(/\n/g) || []).length;
          }
        });
        
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      
      const endTime = process.hrtime(startTime);
      const endMemory = process.memoryUsage().heapUsed;
      
      const durationSeconds = endTime[0] + endTime[1] / 1e9;
      const peakMemoryMB = (endMemory - startMemory) / (1024 * 1024);
      
      results[format] = {
        duration: `${durationSeconds.toFixed(2)}s`,
        fileSize: `${(bytesWritten / (1024 * 1024)).toFixed(2)} MB`,
        peakMemory: `${Math.abs(peakMemoryMB).toFixed(2)} MB`,
        rowCount: rowCount || 'N/A'
      };
    }
    
    return results;
  }
}

module.exports = ExportService;