#!/bin/bash

echo "========================================="
echo "Creating Real Export Files"
echo "========================================="

# Function to create export and download
create_export() {
    local format=$1
    local filename=$2
    local columns=$3
    
    echo ""
    echo "Creating $format export..."
    
    # Create export job
    response=$(curl -s -X POST http://localhost:8080/exports \
        -H "Content-Type: application/json" \
        -d "{
            \"format\": \"$format\",
            \"columns\": $columns
        }")
    
    echo "Response: $response"
    export_id=$(echo $response | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$export_id" ]; then
        echo "Failed to get export ID"
        return 1
    fi
    
    echo "Export ID: $export_id"
    
    # Wait for processing
    echo "Waiting 5 seconds for export to process..."
    sleep 5
    
    # Check status
    status=$(curl -s http://localhost:8080/exports/$export_id/status)
    echo "Status: $status"
    
    # Download
    echo "Downloading to $filename..."
    curl -s -o "$filename" "http://localhost:8080/exports/$export_id/download"
    
    if [ -f "$filename" ]; then
        echo " Downloaded: $filename ($(wc -l < $filename) lines)"
        head -n 3 "$filename"
    else
        echo " Download failed"
    fi
}

# Columns definitions
CSV_COLUMNS='[
    {"source": "id", "target": "ID"},
    {"source": "name", "target": "Name"},
    {"source": "value", "target": "Value"}
]'

JSON_COLUMNS='[
    {"source": "id", "target": "id"},
    {"source": "name", "target": "name"},
    {"source": "value", "target": "value"}
]'

# Create exports
create_export "csv" "real-export.csv" "$CSV_COLUMNS"
create_export "json" "real-export.json" "$JSON_COLUMNS"
create_export "xml" "real-export.xml" "$JSON_COLUMNS"
create_export "parquet" "real-export.parquet" "$JSON_COLUMNS"

# Test compression
echo ""
echo "Testing compressed export..."
COMPRESS_RESPONSE=$(curl -s -X POST http://localhost:8080/exports \
    -H "Content-Type: application/json" \
    -d '{
        "format": "csv",
        "columns": [
            {"source": "id", "target": "ID"},
            {"source": "name", "target": "Name"}
        ],
        "compression": "gzip"
    }')
echo "Response: $COMPRESS_RESPONSE"
COMPRESS_ID=$(echo $COMPRESS_RESPONSE | grep -o '"exportId":"[^"]*"' | cut -d'"' -f4)

sleep 5
curl -s -o real-export.csv.gz "http://localhost:8080/exports/$COMPRESS_ID/download"
echo "Compressed file size: $(du -h real-export.csv.gz | cut -f1)"

# Run benchmark
echo ""
echo "Running benchmark..."
curl -s http://localhost:8080/exports/benchmark | python -m json.tool

echo ""
echo "========================================="
echo "All exports created!"
ls -la real-export.*