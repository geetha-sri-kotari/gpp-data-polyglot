# to generate 1000 rows
#        |
#        |
#        |
# #!/bin/bash
# set -e

# echo "Starting database initialization..."

# # Create table if not exists
# psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
#     CREATE TABLE IF NOT EXISTS records (
#         id BIGSERIAL PRIMARY KEY,
#         created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
#         name VARCHAR(255) NOT NULL,
#         value DECIMAL(18, 4) NOT NULL,
#         metadata JSONB DEFAULT '{}'::jsonb
#     );

#     -- Create index for better performance
#     CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
    
#     -- Check if we need to seed data
#     DO \$\$
#     DECLARE
#         record_count INTEGER;
#     BEGIN
#         SELECT COUNT(*) INTO record_count FROM records;
        
#         IF record_count = 0 THEN
#             RAISE NOTICE 'Seeding database with 1000 records...';
            
#             -- Insert 1000 records (easier for testing)
#             INSERT INTO records (name, value, metadata)
#             SELECT 
#                 'Record_' || generate_series,
#                 random() * 10000,
#                 jsonb_build_object(
#                     'category', CASE WHEN random() > 0.5 THEN 'A' ELSE 'B' END,
#                     'tags', jsonb_build_array(
#                         'tag_' || floor(random() * 10)::int,
#                         'tag_' || floor(random() * 10)::int
#                     ),
#                     'priority', floor(random() * 5)::int,
#                     'nested', jsonb_build_object(
#                         'key' || generate_series, 'value' || generate_series,
#                         'active', random() > 0.2
#                     ),
#                     'active', random() > 0.2
#                 )
#             FROM generate_series(1, 1000);
            
#             RAISE NOTICE 'Database seeding completed. Total records: %', (SELECT COUNT(*) FROM records);
#         ELSE
#             RAISE NOTICE 'Database already contains % records. Skipping seed.', record_count;
#         END IF;
#     END
#     \$\$;
# EOSQL

# echo "Database initialization completed successfully!"   








# to generate 10 million rows
#           |
#           |
#           |
#!/bin/bash
set -e

echo "Starting database initialization..."

# Create table if not exists
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE TABLE IF NOT EXISTS records (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        name VARCHAR(255) NOT NULL,
        value DECIMAL(18, 4) NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb
    );

    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at);
    
    -- Check if we need to seed data
    DO \$\$
    DECLARE
        record_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO record_count FROM records;
        
        IF record_count = 0 THEN
            RAISE NOTICE 'Seeding database with 10 million records... This may take a few minutes.';
            
            -- Insert 10 million records
            INSERT INTO records (name, value, metadata)
            SELECT 
                'Record_' || generate_series,
                random() * 10000,
                jsonb_build_object(
                    'category', CASE WHEN random() > 0.5 THEN 'A' ELSE 'B' END,
                    'tags', jsonb_build_array(
                        'tag_' || floor(random() * 10)::int,
                        'tag_' || floor(random() * 10)::int
                    ),
                    'priority', floor(random() * 5)::int,
                    'nested', jsonb_build_object(
                        'key', 'value',
                        'active', random() > 0.2
                    ),
                    'active', random() > 0.2
                )
            FROM generate_series(1, 10000000);
            
            RAISE NOTICE 'Database seeding completed. Total records: %', (SELECT COUNT(*) FROM records);
        ELSE
            RAISE NOTICE 'Database already contains % records. Skipping seed.', record_count;
        END IF;
    END
    \$\$;
EOSQL

echo "Database initialization completed successfully!"