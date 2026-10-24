const path = require('path');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());
if(process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const paperRoutes = require('./routes/papers');
const healthRoutes = require('./routes/health');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/projects', projectRoutes);
app.use('/api/papers', paperRoutes);
app.use('/api', healthRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} not found` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
