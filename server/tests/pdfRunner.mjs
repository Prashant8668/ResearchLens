import fs from 'fs';
import { generatePdfReport } from '../../client/src/utils/generatePdfReport.js';

try {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error('Input path required');
  }
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const report = JSON.parse(raw);
  const res = generatePdfReport(report);
  const buf = Buffer.from(res.doc.output('arraybuffer'));
  console.log(JSON.stringify({
    success: true,
    filename: res.filename,
    pages: res.doc.internal.getNumberOfPages(),
    header: buf.slice(0, 5).toString('ascii'),
    sizeBytes: buf.length
  }));
} catch (err) {
  console.log(JSON.stringify({
    success: false,
    error: err.message
  }));
}
