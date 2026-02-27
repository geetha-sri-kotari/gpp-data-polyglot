const express = require('express');
const ExportController = require('../controllers/exportController');

const router = express.Router();

// Create export job
router.post('/exports', ExportController.createExport);

// Download export
router.get('/exports/:exportId/download', ExportController.downloadExport);

// Get export status
router.get('/exports/:exportId/status', ExportController.getExportStatus);

// Run benchmark
router.get('/exports/benchmark', ExportController.runBenchmark);

// Health check
router.get('/health', ExportController.healthCheck);

module.exports = router;