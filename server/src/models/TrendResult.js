const mongoose = require('mongoose');
const trendResultSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  topic: { type: String, required: true },
  yearlyData: [{
    year: Number,
    count: Number
  }],
  growthTrend: { type: String },
  status: { type: String, enum: ['High', 'Medium', 'Low', 'Increasing', 'Stable', 'Decreasing', 'Newly Observed', 'Insufficient Data'] },
  insight: { type: String }
}, { timestamps: true });
module.exports = mongoose.model('TrendResult', trendResultSchema);
