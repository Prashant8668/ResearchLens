const path = require('path');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    let connected = false;
    if (process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB via MONGODB_URI');
        connected = true;
      } catch (err) {
        console.warn('Failed to connect to MONGODB_URI, falling back to in-memory MongoDB:', err.message);
      }
    }

    if (!connected) {
      console.log('Starting mongodb-memory-server fallback...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log('Connected to in-memory MongoDB fallback');

      const fs = require('fs');
      const backupPath = path.resolve(__dirname, '../db_backup.json');
      if (fs.existsSync(backupPath)) {
        try {
          const raw = fs.readFileSync(backupPath, 'utf8');
          const backupData = JSON.parse(raw);
          const db = mongoose.connection.db;
          for (const [colName, docs] of Object.entries(backupData)) {
            if (Array.isArray(docs) && docs.length > 0) {
              const convertedDocs = docs.map(doc => {
                const copy = { ...doc };
                if (copy._id && typeof copy._id === 'string') copy._id = new mongoose.Types.ObjectId(copy._id);
                if (copy.userId && typeof copy.userId === 'string') copy.userId = new mongoose.Types.ObjectId(copy.userId);
                if (copy.projectId && typeof copy.projectId === 'string') copy.projectId = new mongoose.Types.ObjectId(copy.projectId);
                if (copy.paperId && typeof copy.paperId === 'string') copy.paperId = new mongoose.Types.ObjectId(copy.paperId);
                return copy;
              });
              await db.collection(colName).insertMany(convertedDocs);
            }
          }
          console.log('Restored user data into in-memory MongoDB fallback');

          // Periodic automatic persistence for in-memory MongoDB fallback
          setInterval(async () => {
            try {
              const db = mongoose.connection.db;
              if (!db) return;
              const cols = await db.listCollections().toArray();
              const dump = {};
              for (const col of cols) {
                dump[col.name] = await db.collection(col.name).find({}).toArray();
              }
              fs.writeFileSync(backupPath, JSON.stringify(dump, null, 2));
            } catch (e) {
              // ignore background backup error
            }
          }, 30000);
        } catch (restoreErr) {
          console.warn('Backup restore warning:', restoreErr.message);
        }
      }
    }
    
    app.listen(PORT, () => {
      console.log('Server is running on port ' + PORT);
    });
  } catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  }
};

startServer();
