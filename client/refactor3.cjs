const fs = require('fs');
const path = require('path');

const files = {
  'src/pages/Projects.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { mockProjects } from '../utils/mockData';

export default function Projects() {
  return (
    <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
        <h1 className="text-3xl font-bold text-navy tracking-tight">My Research Projects</h1>
        <Button variant="primary" className="flex items-center gap-2 w-max">
          <Plus size={18} /> New Project
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {mockProjects.map(proj => (
          <Card key={proj.id} className="p-6 flex flex-col hover:-translate-y-1 transition-all duration-300 hover:shadow-lg border-slate-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3.5 bg-blue-50 text-brand rounded-2xl border border-blue-100 shadow-sm">
                <Folder size={28} />
              </div>
              <div className="pt-1">
                <h3 className="font-bold text-navy text-lg leading-tight mb-1">{proj.name}</h3>
                <p className="text-sm font-medium text-slate-500">{proj.domain}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-600 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <span className="font-bold text-navy">{proj.papers} Papers</span>
              <span className="font-medium text-slate-500">Updated {proj.lastUpdated}</span>
            </div>
            <Link to={\`/projects/\${proj.id}/analysis\`} className="mt-auto">
              <Button variant="secondary" className="w-full font-bold">Open Project</Button>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
`,
  'src/pages/AnalysisDashboard.jsx': `
import React from 'react';
import { FileText, Tag, Link as LinkIcon, Download, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ui/ProgressBar';
import { mockKeywords, mockRelatedPapers } from '../utils/mockData';

export default function AnalysisDashboard() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Analysis Dashboard</h1>
          <p className="text-base text-slate-500 font-medium">Results for: <span className="font-bold text-navy">Quantum Network Security</span></p>
        </div>
        <Button variant="primary" className="flex items-center gap-2 w-max">
          <Download size={18} /> Export Report
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard title="Total Papers Analyzed" value="125" icon={FileText} bgClass="bg-blue-50 border border-blue-100" colorClass="text-brand" />
        <MetricCard title="Keywords Extracted" value="18" icon={Tag} bgClass="bg-green-50 border border-green-100" colorClass="text-green-600" />
        <MetricCard title="Similarity Score" value="24%" icon={LinkIcon} bgClass="bg-purple-50 border border-purple-100" colorClass="text-purple-600" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-8 flex flex-col shadow-md">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-navy text-xl">Important Keywords</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Similarity</span>
          </div>
          <div className="space-y-6 flex-1">
            {mockKeywords.map(kw => (
              <div key={kw.term} className="flex items-center gap-5">
                <span className="w-32 text-sm font-bold text-slate-700 truncate" title={kw.term}>{kw.term}</span>
                <ProgressBar progress={kw.score * 100} />
                <span className="w-12 text-sm font-black text-slate-500 text-right">{kw.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
        
        <Card className="p-8 flex flex-col shadow-md">
          <h3 className="font-bold text-navy text-xl mb-8">Top Related Papers</h3>
          <div className="space-y-5 flex-1">
            {mockRelatedPapers.map((paper, idx) => (
              <div key={paper.id} className="flex items-start justify-between text-sm group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <span className="text-slate-400 font-mono font-bold pt-0.5 w-4">{idx + 1}</span>
                  <span className="font-bold text-slate-700 group-hover:text-brand transition-colors line-clamp-2 pr-4 leading-relaxed">{paper.title}</span>
                </div>
                <span className="font-black text-navy shrink-0 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100">{paper.similarity}%</span>
              </div>
            ))}
          </div>
          <button className="text-sm font-bold text-brand mt-6 flex items-center gap-1 hover:text-blue-800 transition-colors w-max uppercase tracking-wider">
            View All <ArrowRight size={16} />
          </button>
        </Card>
      </div>
    </div>
  );
}
`,
  'src/pages/Trends.jsx': `
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Select';
import { ProgressBar } from '../components/ui/ProgressBar';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

const lineData = {
  labels: ['2021', '2022', '2023', '2024', '2025'],
  datasets: [
    {
      fill: true,
      label: 'Papers',
      data: [20, 35, 52, 78, 110],
      borderColor: '#2563EB',
      backgroundColor: 'rgba(37, 99, 235, 0.1)',
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 5,
      pointBackgroundColor: '#FFFFFF',
      pointBorderColor: '#2563EB',
      pointBorderWidth: 2,
    },
  ],
};

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { 
    y: { 
      beginAtZero: true, 
      grid: { color: '#f8fafc' },
      border: { display: false },
      ticks: { font: { family: 'Inter', weight: '500' }, color: '#64748b' }
    },
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { font: { family: 'Inter', weight: '500' }, color: '#64748b' }
    }
  }
};

export default function Trends() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Research Trend Analysis</h1>
          <p className="text-base text-slate-500 font-medium">Year-wise analysis of research growth/decline across topics.</p>
        </div>
        <Select className="w-full sm:w-64 border-slate-200">
          <option>Quantum Network Security</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 p-8 h-96 flex flex-col shadow-md border-slate-200">
          <h3 className="font-bold text-navy text-xl mb-6">Publication Trend (Last 5 Years)</h3>
          <div className="flex-1 relative w-full h-full pb-2">
            <Line options={lineOptions} data={lineData} />
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50/50 to-white p-8 flex flex-col items-start justify-center shadow-md border-blue-100">
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider mb-6 border border-green-200">
            <TrendingUp size={16} /> Trend Insight
          </div>
          <p className="text-slate-700 text-base leading-relaxed font-medium">
            Research activity on <strong className="text-navy font-bold">Quantum Network Security</strong> is increasing steadily over the past 5 years, marking a positive growth sector.
          </p>
        </Card>
      </div>

      <Card className="p-8 shadow-md">
        <h3 className="font-bold text-navy text-xl mb-6">Topic-wise Trend</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs font-black text-slate-400 uppercase tracking-wider border-b-2 border-slate-100">
                <th className="pb-4">Topic</th>
                <th className="pb-4 w-1/2">Growth Trend</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: 'Quantum Cryptography', s: 'High', c: 'text-green-600', w: 90, bg: 'bg-green-500' },
                { t: 'Quantum Communication', s: 'High', c: 'text-green-600', w: 85, bg: 'bg-green-500' },
                { t: 'Quantum Network Security', s: 'Medium', c: 'text-orange-500', w: 60, bg: 'bg-orange-500' },
                { t: 'Quantum Repeater Optimization', s: 'Low', c: 'text-red-600', w: 25, bg: 'bg-red-500' }
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 text-slate-700 font-bold pr-4">{row.t}</td>
                  <td className="py-5 pr-8">
                    <ProgressBar progress={row.w} colorClass={row.bg} />
                  </td>
                  <td className={\`py-5 font-black uppercase tracking-wider text-xs \${row.c}\`}>{row.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
`,
  'src/pages/GapAnalysis.jsx': `
import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';

export default function GapAnalysis() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Research Gap Analysis</h1>
        <p className="text-base text-slate-500 font-medium">Identifies less-explored areas within a research domain using heuristic signals.</p>
      </div>

      <Card className="p-8 shadow-md mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs font-black text-slate-400 uppercase tracking-wider border-b-2 border-slate-100">
                <th className="pb-4">Topic</th>
                <th className="pb-4">Research Level</th>
                <th className="pb-4 w-1/3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: 'Quantum Cryptography', l: 'High', c: 'text-green-600', bg: 'bg-green-500', w: 90 },
                { t: 'Quantum Communication', l: 'High', c: 'text-green-600', bg: 'bg-green-500', w: 80 },
                { t: 'Quantum Internet', l: 'Medium', c: 'text-orange-500', bg: 'bg-orange-500', w: 55 },
                { t: 'Quantum Network Security', l: 'Low', c: 'text-red-600', bg: 'bg-red-500', w: 30 },
                { t: 'Quantum Repeater Optimization', l: 'Low', c: 'text-red-600', bg: 'bg-red-500', w: 20 }
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-5 text-slate-700 font-bold pr-4">{row.t}</td>
                  <td className={\`py-5 font-black uppercase tracking-wider text-xs \${row.c}\`}>{row.l}</td>
                  <td className="py-5 flex items-center gap-4">
                    <ProgressBar progress={row.w} colorClass={row.bg} />
                    {row.l === 'Low' && <TrendingDown size={18} className={row.c} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="bg-red-50/50 border border-red-200 p-8 md:p-10 rounded-2xl flex flex-col md:flex-row items-start gap-6 shadow-sm">
        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm shrink-0">
          <AlertTriangle className="text-red-600" size={32} />
        </div>
        <div>
          <h3 className="text-red-600 font-black text-xs tracking-wider uppercase mb-3 flex items-center gap-2">Potential Research Gap</h3>
          <p className="font-bold text-navy text-2xl mb-3">Quantum Network Security</p>
          <p className="text-slate-700 text-base font-medium leading-relaxed max-w-3xl">Low publication activity compared with related research topics. Heuristic signal analysis indicates substantial room for foundational models and framework development in this sector.</p>
        </div>
      </div>
    </div>
  );
}
`,
  'src/pages/Novelty.jsx': `
import React from 'react';
import { mockRelatedPapers, mockRecommendations } from '../utils/mockData';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export default function Novelty() {
  return (
    <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8 w-full">
      <div className="flex-1 flex flex-col gap-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Novelty Check</h1>
          <p className="text-base text-slate-500 font-medium">Compares a new research topic with existing papers.</p>
        </div>
        
        <Card className="p-8 h-full shadow-md flex flex-col">
          <h3 className="font-bold text-navy mb-4 text-lg">Your Research Topic</h3>
          <div className="flex flex-col sm:flex-row gap-4 mb-10">
            <Input defaultValue="AI-based Quantum Network Security" className="flex-1" />
            <Button variant="primary" className="whitespace-nowrap">Check Similarity</Button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-8 mb-10 p-8 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-32 h-32 rounded-full border-8 border-slate-200 border-t-brand border-r-brand flex items-center justify-center relative shrink-0 shadow-sm bg-white">
              <span className="text-4xl font-black text-navy">18%</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-400 mb-3 text-xs font-black uppercase tracking-wider"><Lightbulb size={16} className="text-brand" /> Interpretation</div>
              <p className="text-slate-700 text-base font-medium mb-4 leading-relaxed">The topic shows low similarity with existing papers, indicating high novelty within the current corpus context.</p>
              <Badge variant="success">LOW OVERLAP</Badge>
            </div>
          </div>

          <div className="flex-1">
            <h3 className="font-bold text-navy mb-5 text-lg">Most Similar Papers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs font-black text-slate-400 uppercase tracking-wider border-b-2 border-slate-100">
                    <th className="pb-3 w-10">#</th>
                    <th className="pb-3">Paper Title</th>
                    <th className="pb-3 text-right">Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRelatedPapers.slice(0,3).map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-slate-400 font-bold">{i+1}</td>
                      <td className="py-4 text-slate-700 font-bold pr-4 line-clamp-1">{p.title}</td>
                      <td className="py-4 font-black text-brand text-right">{p.similarity}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="text-sm font-bold text-brand mt-6 hover:text-blue-800 transition-colors flex items-center gap-1 w-full justify-end uppercase tracking-wider">View Details <ArrowRight size={16}/></button>
          </div>
        </Card>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Research Recommendations</h1>
          <p className="text-base text-slate-500 font-medium">Based on trends, gaps and novelty analysis.</p>
        </div>
        
        <div className="space-y-5">
          {mockRecommendations.map((rec, i) => (
            <Card key={rec.id} className="p-6 flex flex-col sm:flex-row items-start gap-5 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand flex items-center justify-center text-base font-black shrink-0 border border-blue-100">{i+1}</div>
              <div className="flex-1">
                <h3 className="font-bold text-navy mb-3 text-lg leading-tight">{rec.title}</h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant={rec.gap.includes('High') ? 'error' : 'warning'}>{rec.gap}</Badge>
                  <Badge variant={rec.potential.includes('High') ? 'success' : 'warning'}>{rec.potential}</Badge>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed mb-5">{rec.description}</p>
                <Button variant="outline" className="w-full sm:w-auto">Explore Topic <ArrowRight size={16} className="ml-2"/></Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
`,
  'src/pages/Report.jsx': `
import React from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Report() {
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Consolidated Report</h1>
          <p className="text-base text-slate-500 font-medium">Quantum Network Security Project</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2 w-max">
          <Download size={18} /> Download PDF
        </Button>
      </div>

      <Card className="p-8 md:p-12 shadow-md text-slate-700 text-base font-medium leading-relaxed">
        <div className="flex items-center gap-5 mb-10 pb-10 border-b border-slate-100">
          <div className="p-4 bg-blue-50 text-brand rounded-2xl border border-blue-100 shadow-sm"><FileText size={32}/></div>
          <div>
            <h2 className="text-2xl font-bold text-navy mb-1 tracking-tight">Research Intelligence Summary</h2>
            <p className="text-sm font-semibold text-slate-400">Generated on Sep 11, 2026</p>
          </div>
        </div>

        <h3 className="text-sm font-black text-navy mb-4 uppercase tracking-widest bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">Executive Summary</h3>
        <p className="mb-10 text-slate-600">This report compiles analysis across 125 papers related to <strong className="text-navy">Quantum Network Security</strong>. Data extraction successfully identified 18 key topics, uncovering clear potential research gaps in integration of AI models within repeater optimization.</p>
        
        <h3 className="text-sm font-black text-navy mb-4 uppercase tracking-widest bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">Gap Analysis Highlights</h3>
        <ul className="list-disc pl-5 mb-10 space-y-3 text-slate-600">
          <li><strong className="text-navy">High Priority:</strong> Quantum Repeater Optimization shows low coverage (12 papers) despite high overall trend growth (+22% YoY).</li>
          <li><strong className="text-navy">Moderate Priority:</strong> Hybrid Classical-Quantum networks show emerging signals but lack definitive methodological frameworks.</li>
        </ul>

        <h3 className="text-sm font-black text-navy mb-4 uppercase tracking-widest bg-slate-50 inline-block px-3 py-1.5 rounded-lg border border-slate-100">Recommended Directions</h3>
        <p className="mb-10 text-slate-600">Based on the calculated similarity of proposed concepts against the current corpus, an investigation into <em className="text-navy font-semibold italic">AI-based routing for Quantum Repeaters</em> is recommended. This yields a novelty score of 82% (18% similarity overlap).</p>
      </Card>
    </div>
  );
}
`,
  'src/pages/About.jsx': `
import React from 'react';
import { Card } from '../components/ui/Card';

export default function About() {
  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-4xl font-bold text-navy mb-8 tracking-tight text-center mt-8">About ResearchLens</h1>
      <Card className="p-10 shadow-lg text-slate-600 font-medium leading-relaxed">
        <p className="mb-8 text-lg text-slate-700">ResearchLens is an AI-powered research intelligence platform designed to help students, researchers, academic faculty, and mentors make sense of collections of research literature.</p>
        
        <h3 className="text-xl font-bold text-navy mb-4">Our Mission</h3>
        <p className="mb-10">To drastically reduce the cognitive load of manual literature review by combining NLP-based text processing, TF-IDF cosine similarity analysis, heuristic gap detection, and AI-generated structured summaries into one accessible application.</p>
        
        <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl">
          <h3 className="text-sm font-black text-orange-800 mb-3 uppercase tracking-wider">Disclaimer</h3>
          <p className="text-orange-700 text-sm leading-relaxed">Gap detection and similarity scores are based on heuristic signals from your uploaded corpus. They do not constitute proven academic gaps or plagiarism certifications. Researcher judgment is always required.</p>
        </div>
      </Card>
    </div>
  );
}
`
};

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
}
console.log('Advanced pages refactored successfully.');
