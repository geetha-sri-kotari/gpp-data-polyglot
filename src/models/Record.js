const { query } = require('../config/database');

class Record {
  // Get a stream of records with cursor
  static async *getStream(batchSize = 10000) {
    let lastId = 0;
    let hasMore = true;

    while (hasMore) {
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
      } else {
        lastId = rows[rows.length - 1].id;
        yield rows;
      }
    }
  }

  // Get count of records
  static async getCount() {
    const result = await query('SELECT COUNT(*) as count FROM records');
    return parseInt(result.rows[0].count);
  }

  // Get sample records for testing
  static async getSample(limit = 10) {
    const result = await query('SELECT * FROM records LIMIT $1', [limit]);
    return result.rows;
  }
}

module.exports = Record;