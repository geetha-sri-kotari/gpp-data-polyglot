const ExportService = require('../services/exportService');

class ExportController {
  // POST /exports - Create new export job
  static async createExport(req, res) {
    try {
      const { format, columns, compression } = req.body;

      // Validate required fields
      if (!format || !columns || !Array.isArray(columns) || columns.length === 0) {
        return res.status(400).json({
          error: 'Invalid request. Format and columns array are required.'
        });
      }

      // Validate format
      const validFormats = ['csv', 'json', 'xml', 'parquet'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          error: `Invalid format. Must be one of: ${validFormats.join(', ')}`
        });
      }

      // Validate compression if provided
      if (compression && compression !== 'gzip') {
        return res.status(400).json({
          error: 'Invalid compression. Only gzip is supported.'
        });
      }

      // Validate each column has source and target
      for (const col of columns) {
        if (!col.source || !col.target) {
          return res.status(400).json({
            error: 'Each column must have source and target properties.'
          });
        }
      }

      // Create export job
      const job = ExportService.createExportJob(format, columns, compression);

      res.status(201).json({
        exportId: job.id,
        status: job.status
      });
    } catch (error) {
      console.error('Error creating export:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /exports/:exportId/download - Download export
  static async downloadExport(req, res) {
    try {
      const { exportId } = req.params;
      
      const job = ExportService.getExportJob(exportId);
      
      if (!job) {
        return res.status(404).json({ error: 'Export job not found' });
      }

      // Set content type based on format
      const contentTypes = {
        csv: 'text/csv',
        json: 'application/json',
        xml: 'application/xml',
        parquet: 'application/octet-stream'
      };

      const fileExtensions = {
        csv: '.csv',
        json: '.json',
        xml: '.xml',
        parquet: '.parquet'
      };

      // Set response headers
      res.setHeader('Content-Type', contentTypes[job.format]);
      res.setHeader(
        'Content-Disposition', 
        `attachment; filename="export-${exportId}${fileExtensions[job.format]}"`
      );

      // Add compression header if applicable
      if (job.compression === 'gzip') {
        res.setHeader('Content-Encoding', 'gzip');
      }

      // Create and pipe the export stream
      const stream = await ExportService.createExportStream(exportId);
      
      // Handle stream errors
      stream.on('error', (err) => {
        console.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error during export' });
        } else {
          res.end();
        }
      });

      // Pipe to response
      stream.pipe(res);
    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /exports/benchmark - Run performance benchmark
  static async runBenchmark(req, res) {
    try {
      const results = await ExportService.runBenchmark();
      
      res.json({
        timestamp: new Date().toISOString(),
        totalRows: 10000000,
        results
      });
    } catch (error) {
      console.error('Error running benchmark:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /exports/:exportId/status - Check export status
  static async getExportStatus(req, res) {
    try {
      const { exportId } = req.params;
      
      const job = ExportService.getExportJob(exportId);
      
      if (!job) {
        return res.status(404).json({ error: 'Export job not found' });
      }

      res.json({
        exportId: job.id,
        status: job.status,
        progress: job.progress,
        format: job.format,
        compression: job.compression,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        error: job.error
      });
    } catch (error) {
      console.error('Error getting export status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /health - Health check endpoint
  static async healthCheck(req, res) {
    try {
      const { query } = require('../config/database');
      await query('SELECT 1');
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error.message
      });
    }
  }
}

module.exports = ExportController;