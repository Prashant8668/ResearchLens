const mongoose = require('mongoose');
const User = require('./src/models/User');
const Project = require('./src/models/Project');
const Paper = require('./src/models/Paper');
const PaperAnalysis = require('./src/models/PaperAnalysis');
const SimilarityResult = require('./src/models/SimilarityResult');
const TrendResult = require('./src/models/TrendResult');
const GapResult = require('./src/models/GapResult');
const Recommendation = require('./src/models/Recommendation');

async function run() {
  console.log("Model loading: PASS");
  console.log("All 8 models are defined and can be loaded.");
}
run();
