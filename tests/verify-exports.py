import json
import csv
import xml.etree.ElementTree as ET
import gzip
import os

print("Verifying REAL export files...")
print("=" * 50)

# 1. Verify CSV
print("\n1. Verifying CSV...")
try:
    with open('real-export.csv', 'r') as f:
        reader = csv.reader(f)
        headers = next(reader)
        rows = list(reader)
        print(f"    CSV valid: {len(rows)} rows")
        print(f"   Headers: {headers}")
        if rows:
            print(f"   First row: {rows[0]}")
except Exception as e:
    print(f"    CSV error: {e}")

# 2. Verify JSON
print("\n2. Verifying JSON...")
try:
    with open('real-export.json', 'r') as f:
        content = f.read()
        # Check if it starts with [ and ends with ]
        if content.strip().startswith('[') and content.strip().endswith(']'):
            data = json.loads(content)
            print(f"    JSON valid: {len(data)} objects")
            if data:
                print(f"   First record keys: {list(data[0].keys())}")
                if 'metadata' in data[0]:
                    print(f"   Metadata type: {type(data[0]['metadata'])}")
        else:
            print(f"    JSON not an array: {content[:100]}...")
except Exception as e:
    print(f"    JSON error: {e}")

# 3. Verify XML
print("\n3. Verifying XML...")
try:
    tree = ET.parse('real-export.xml')
    root = tree.getroot()
    records = root.findall('.//record')
    print(f"    XML valid: {len(records)} records")
    if records:
        print(f"   First record: {ET.tostring(records[0], encoding='unicode')[:200]}...")
except Exception as e:
    print(f"    XML error: {e}")

# 4. Verify Parquet (basic check - just see if file exists and has content)
print("\n4. Verifying Parquet...")
if os.path.exists('real-export.parquet'):
    size = os.path.getsize('real-export.parquet')
    print(f"    Parquet file exists: {size/1024:.2f} KB")
    # Parquet is binary, so just check it's not the error message
    with open('real-export.parquet', 'rb') as f:
        first_bytes = f.read(20)
        if b'error' not in first_bytes.lower():
            print(f"    Parquet appears valid (binary data)")
        else:
            print(f"    Parquet contains error")
else:
    print(f"    Parquet file not found")

# 5. Verify compressed
print("\n5. Verifying compressed CSV...")
try:
    with gzip.open('real-export.csv.gz', 'rt') as f:
        reader = csv.reader(f)
        rows = list(reader)
        print(f"    Compressed CSV valid: {len(rows)-1} rows")
        print(f"   Headers: {rows[0]}")
except Exception as e:
    print(f"    Compressed error: {e}")

# 6. File sizes
print("\n6. File sizes:")
files = ['real-export.csv', 'real-export.json', 'real-export.xml', 
         'real-export.parquet', 'real-export.csv.gz']
for file in files:
    if os.path.exists(file):
        size = os.path.getsize(file)
        print(f"   {file}: {size/1024:.2f} KB")
        if size < 100:  # Less than 100 bytes probably means error
            print(f"     Warning: {file} is very small - might contain error")

print("\n" + "=" * 50)
print("Verification complete!")

# Check if any files contain the error message
print("\nChecking for error messages...")
for file in files:
    if os.path.exists(file) and os.path.getsize(file) < 1000:
        try:
            with open(file, 'r') as f:
                content = f.read(200)
                if 'error' in content.lower():
                    print(f"     {file} contains error: {content[:100]}")
        except:
            pass