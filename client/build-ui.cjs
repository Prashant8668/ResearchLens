const fs = require('fs');
const path = require('path');

const files = {
  'tailwind.config.js': `export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#1E3A5F',
        brand: '#2563EB',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}`,
  'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ResearchLens</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body class="bg-slate-50 text-slate-900 font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
  'src/utils/mockData.js': `
export const mockProjects = [
  { id: '1', name: 'Quantum Network Security', domain: 'Computer Science', papers: 12, lastUpdated: '2025-09-10' },
  { id: '2', name: 'AI in Healthcare', domain: 'Medicine', papers: 45, lastUpdated: '2025-09-08' }
];

export const mockRecentFiles = [
  { id: 'f1', name: 'Quantum_Networking_Paper.pdf', size: '3.2 MB', date: '10 Sep 2025', status: 'COMPLETED' },
  { id: 'f2', name: 'AI_Research_Papers.pdf', size: '4.7 MB', date: '8 Sep 2025', status: 'COMPLETED' },
  { id: 'f3', name: 'Research_Topic_Quantum.pdf', size: '1.2 MB', date: '8 Sep 2025', status: 'PROCESSING' }
];

export const mockKeywords = [
  { term: 'Quantum', score: 0.92 },
  { term: 'Security', score: 0.87 },
  { term: 'Network', score: 0.79 },
  { term: 'Cryptography', score: 0.68 },
  { term: 'Repeater', score: 0.54 }
];

export const mockRelatedPapers = [
  { id: 'p1', title: 'AI in Quantum Key Distribution', similarity: 28 },
  { id: 'p2', title: 'Network Security for Quantum architectures', similarity: 24 },
  { id: 'p3', title: 'Quantum Repeater Architectures', similarity: 19 },
  { id: 'p4', title: 'Security in Quantum Networks', similarity: 16 },
  { id: 'p5', title: 'Machine Learning for QKD', similarity: 12 }
];

export const mockRecommendations = [
  { id: 'r1', title: 'Quantum Network Security', gap: 'High Gap', potential: 'High Potential', description: 'Limited research activity compared to related areas.' },
  { id: 'r2', title: 'AI-assisted Quantum Communication', gap: 'Medium Gap', potential: 'Medium Potential', description: 'Growing trend with opportunities for new approaches.' },
  { id: 'r3', title: 'Quantum Repeater Optimization', gap: 'High Gap', potential: 'High Potential', description: 'Less explored area with increasing interest.' },
  { id: 'r4', title: 'Hybrid Classical-Quantum Networks', gap: 'Medium Gap', potential: 'Medium Potential', description: 'Emerging field with strong future scope.' }
];
`,
  'src/layouts/PublicLayout.jsx': `
import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 w-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-navy font-bold text-xl">
            <Search className="w-6 h-6 text-brand" />
            ResearchLens
          </Link>
          <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-brand transition-colors">Home</Link>
            <Link to="/analyze" className="hover:text-brand transition-colors">Analyze</Link>
            <Link to="/projects/1/trends" className="hover:text-brand transition-colors">Trends</Link>
            <Link to="/about" className="hover:text-brand transition-colors">About</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand transition-colors">Log In</Link>
            <Link to="/dashboard" className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
              Get Started &rarr;
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col w-full">
        <Outlet />
      </main>
      <footer className="bg-white border-t border-slate-200 py-8 text-center text-sm text-slate-500 mt-auto">
        <p>ResearchLens &copy; 2026. AI-Powered Research Intelligence Platform.</p>
      </footer>
    </div>
  );
}
`,
  'src/layouts/SidebarLayout.jsx': `
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Search, LayoutDashboard, TrendingUp, AlertTriangle, Lightbulb, FileText, Upload, User, LogOut } from 'lucide-react';

export default function SidebarLayout() {
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);

  return (
    <div className="min-h-screen flex bg-slate-50 w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 z-50">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2 text-navy font-bold text-xl">
            <Search className="w-6 h-6 text-brand" />
            ResearchLens
          </Link>
        </div>
        <div className="p-4 flex-1 flex flex-col gap-1 overflow-y-auto">
          <Link to="/dashboard" className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3 hover:text-slate-600 transition-colors flex items-center justify-between">
            <span>Projects</span>
            <span className="text-[10px]">&larr; Back</span>
          </Link>
          
          <NavItem to="/projects/1/analysis" icon={LayoutDashboard} label="Dashboard" active={isActive('/analysis')} />
          <NavItem to="/projects/1/upload" icon={Upload} label="Upload / Analyze" active={isActive('/upload') || isActive('/analyze')} />
          <NavItem to="/projects/1/trends" icon={TrendingUp} label="Trend Analysis" active={isActive('/trends')} />
          <NavItem to="/projects/1/gaps" icon={AlertTriangle} label="Gap Analysis" active={isActive('/gaps')} />
          <NavItem to="/projects/1/novelty" icon={Lightbulb} label="Novelty Check" active={isActive('/novelty')} />
          <NavItem to="/projects/1/report" icon={FileText} label="Report" active={isActive('/report')} />
        </div>
        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">Dr. Researcher</p>
            </div>
            <Link to="/login" className="text-slate-400 hover:text-slate-600 shrink-0">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 shrink-0">
          <nav className="flex gap-6 text-sm font-medium text-slate-500 h-full">
            <Link to="/" className="flex items-center hover:text-slate-900">Home</Link>
            <Link to="/analyze" className={\`flex items-center hover:text-slate-900 \${isActive('/upload') || isActive('/analyze') ? 'text-brand border-b-2 border-brand font-semibold' : ''}\`}>Analyze</Link>
            <Link to="/projects/1/trends" className={\`flex items-center hover:text-slate-900 \${isActive('/trends') ? 'text-brand border-b-2 border-brand font-semibold' : ''}\`}>Trends</Link>
            <Link to="/about" className="flex items-center hover:text-slate-900">About</Link>
          </nav>
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <User size={16} />
          </div>
        </header>
        <div className="p-8 flex-1 w-full max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active }) {
  return (
    <Link to={to} className={\`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all \${active ? 'bg-blue-50 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}\`}>
      <Icon size={18} />
      {label}
    </Link>
  );
}
`,
  'src/pages/Home.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full text-center mb-16 mt-8">
        <h1 className="text-5xl font-bold text-navy mb-6 leading-tight">
          ResearchLens<br />
          <span className="text-slate-600 text-3xl font-semibold">AI Powered Research Intelligence System</span>
        </h1>
        <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
          Analyze research. Discover gaps. Find your next direction.<br />
          NLP &bull; Data Analytics &bull; Research Analysis
        </p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          Get Started &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
        <FeatureCard 
          icon={<TrendingUp className="text-blue-500" size={24} />}
          title="Trend Analysis"
          description="Visualize research growth and decline across topics."
          bg="bg-blue-50"
        />
        <FeatureCard 
          icon={<AlertTriangle className="text-green-500" size={24} />}
          title="Gap Analysis"
          description="Find less-explored areas in the research domain."
          bg="bg-green-50"
        />
        <FeatureCard 
          icon={<CheckCircle2 className="text-purple-500" size={24} />}
          title="Novelty Check"
          description="Check similarity with existing papers."
          bg="bg-purple-50"
        />
        <FeatureCard 
          icon={<Lightbulb className="text-orange-500" size={24} />}
          title="Research Recommendation"
          description="Get suggested topics and directions."
          bg="bg-orange-50"
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, bg }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-4 hover:shadow-md transition-shadow">
      <div className={\`w-12 h-12 rounded-xl flex items-center justify-center \${bg}\`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-navy mb-1">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
`,
  'src/pages/Login.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-navy mb-6 text-center">Log In to ResearchLens</h2>
        <form className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all" placeholder="name@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input type="password" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" />
          </div>
          <Link to="/dashboard" className="w-full py-2.5 bg-brand text-white font-medium rounded-xl text-center hover:bg-blue-700 transition-colors mt-2 shadow-sm">
            Log In
          </Link>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Don't have an account? <Link to="/register" className="text-brand hover:underline font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
`,
  'src/pages/Register.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';

export default function Register() {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-2xl font-bold text-navy mb-6 text-center">Create Account</h2>
        <form className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input type="text" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all" placeholder="Dr. Jane Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all" placeholder="name@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input type="password" className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" />
          </div>
          <Link to="/dashboard" className="w-full py-2.5 bg-brand text-white font-medium rounded-xl text-center hover:bg-blue-700 transition-colors mt-2 shadow-sm">
            Create Account
          </Link>
        </form>
        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account? <Link to="/login" className="text-brand hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
`,
  'src/pages/About.jsx': `
import React from 'react';

export default function About() {
  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-3xl font-bold text-navy mb-6">About ResearchLens</h1>
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm prose prose-slate max-w-none text-slate-600">
        <p className="mb-6 leading-relaxed">ResearchLens is an AI-powered research intelligence platform designed to help students, researchers, academic faculty, and mentors make sense of collections of research literature.</p>
        <h3 className="text-lg font-bold text-navy mb-3">Our Mission</h3>
        <p className="mb-6 leading-relaxed">To drastically reduce the cognitive load of manual literature review by combining NLP-based text processing, TF-IDF cosine similarity analysis, heuristic gap detection, and AI-generated structured summaries into one accessible application.</p>
        <h3 className="text-lg font-bold text-navy mb-3">Disclaimer</h3>
        <p className="text-slate-500 text-sm leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">Gap detection and similarity scores are based on heuristic signals from your uploaded corpus. They do not constitute proven academic gaps or plagiarism certifications. Researcher judgment is required.</p>
      </div>
    </div>
  );
}
`,
  'src/pages/Projects.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Folder } from 'lucide-react';
import { mockProjects } from '../utils/mockData';

export default function Projects() {
  return (
    <div className="flex-1 flex flex-col p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-navy">My Research Projects</h1>
        <button className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
          <Plus size={16} /> New Project
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockProjects.map(proj => (
          <div key={proj.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-blue-50 text-brand rounded-xl">
                <Folder size={24} />
              </div>
              <div className="pt-1">
                <h3 className="font-semibold text-navy leading-tight mb-1">{proj.name}</h3>
                <p className="text-xs text-slate-500">{proj.domain}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-500 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="font-medium text-slate-700">{proj.papers} Papers</span>
              <span>Updated {proj.lastUpdated}</span>
            </div>
            <Link to={\`/projects/\${proj.id}/analysis\`} className="mt-auto text-center w-full py-2.5 bg-white text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm">
              Open Project
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  'src/pages/UploadAnalyze.jsx': `
import React from 'react';
import { UploadCloud, FileText, ChevronRight } from 'lucide-react';
import { mockRecentFiles } from '../utils/mockData';

export default function UploadAnalyze() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-bold text-navy mb-2">Research Paper Analysis</h1>
      <p className="text-sm text-slate-500 mb-8">Upload a research paper (PDF) or enter a topic to get started.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="border-2 border-dashed border-brand/30 bg-blue-50/30 rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors hover:bg-blue-50/50 hover:border-brand/50 cursor-pointer">
          <div className="w-16 h-16 bg-white text-brand rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
            <UploadCloud size={32} />
          </div>
          <p className="font-semibold text-slate-700 mb-1">Drag & drop your PDF here</p>
          <p className="text-sm text-slate-500 mb-4">or</p>
          <button className="bg-brand text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">Choose File</button>
          <p className="text-xs text-slate-400 mt-4 font-medium">Supports PDF files only</p>
        </div>
        
        <div className="flex flex-col justify-center relative">
          <div className="absolute top-1/2 -left-6 -translate-y-1/2 bg-white text-xs font-bold text-slate-400 p-2 rounded-full border border-slate-100 z-10 hidden md:block">OR</div>
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col justify-center">
            <h3 className="font-semibold text-navy mb-4">Enter Research Topic</h3>
            <input type="text" className="w-full px-4 py-3 border border-slate-200 rounded-xl mb-4 focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all placeholder:text-slate-400" placeholder="e.g. Quantum Network Security" />
            <button className="w-full bg-brand text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors mt-auto">Check Novelty &rarr;</button>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="font-semibold text-navy mb-4">Recent Searches / Files</h3>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {mockRecentFiles.map(file => (
            <div key={file.id} className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-medium text-slate-700 text-sm mb-0.5">{file.name}</p>
                  <p className="text-xs text-slate-500">Uploaded on {file.date} &bull; {file.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={\`text-xs font-bold px-3 py-1 rounded-full \${file.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}\`}>
                  {file.status}
                </span>
                <ChevronRight className="text-slate-400" size={18} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`,
  'src/pages/AnalysisDashboard.jsx': `
import React from 'react';
import { FileText, Tag, Link as LinkIcon, Download, ArrowRight } from 'lucide-react';
import { mockKeywords, mockRelatedPapers } from '../utils/mockData';

export default function AnalysisDashboard() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Analysis Dashboard</h1>
          <p className="text-sm text-slate-500">Results for: <span className="font-medium text-slate-700">Quantum Network Security</span></p>
        </div>
        <button className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
          <Download size={16} /> Export Report
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-blue-50 text-brand rounded-2xl flex items-center justify-center shrink-0"><FileText size={24}/></div>
          <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Papers Analyzed</p><p className="text-3xl font-bold text-navy leading-none">125</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center shrink-0"><Tag size={24}/></div>
          <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Keywords Extracted</p><p className="text-3xl font-bold text-navy leading-none">18</p></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0"><LinkIcon size={24}/></div>
          <div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Similarity Score</p><p className="text-3xl font-bold text-navy leading-none">24%</p></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-navy">Important Keywords</h3>
            <span className="text-xs text-slate-400 font-medium">Similarity</span>
          </div>
          <div className="space-y-5 flex-1">
            {mockKeywords.map(kw => (
              <div key={kw.term} className="flex items-center gap-4">
                <span className="w-28 text-sm text-slate-700 font-medium truncate" title={kw.term}>{kw.term}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full transition-all duration-1000" style={{ width: \`\${kw.score * 100}%\` }}></div>
                </div>
                <span className="w-10 text-xs font-bold text-slate-500 text-right">{kw.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="font-semibold text-navy mb-6">Top Related Papers (by similarity)</h3>
          <div className="space-y-4 flex-1">
            {mockRelatedPapers.map((paper, idx) => (
              <div key={paper.id} className="flex items-start justify-between text-sm group cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="text-slate-400 font-mono font-medium pt-0.5">{idx + 1}</span>
                  <span className="text-slate-700 font-medium group-hover:text-brand transition-colors line-clamp-2 pr-4">{paper.title}</span>
                </div>
                <span className="font-bold text-navy shrink-0">{paper.similarity}%</span>
              </div>
            ))}
          </div>
          <button className="text-sm font-medium text-brand mt-6 flex items-center gap-1 hover:text-blue-800 transition-colors w-max">
            View All <ArrowRight size={14} />
          </button>
        </div>
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
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrendingUp } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const lineData = {
  labels: ['2021', '2022', '2023', '2024', '2025'],
  datasets: [
    {
      label: 'Papers',
      data: [20, 35, 52, 78, 110],
      borderColor: '#2563EB',
      backgroundColor: '#2563EB',
      tension: 0.1,
      borderWidth: 2,
      pointRadius: 4,
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
      grid: { color: '#f1f5f9' },
      border: { display: false }
    },
    x: {
      grid: { display: false },
      border: { display: false }
    }
  }
};

export default function Trends() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Research Trend Analysis</h1>
          <p className="text-sm text-slate-500">Year-wise analysis of research growth/decline across topics.</p>
        </div>
        <select className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium bg-white outline-none shadow-sm text-slate-700 focus:ring-2 focus:ring-brand/20">
          <option>Quantum Network Security</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 flex flex-col">
          <h3 className="font-semibold text-navy mb-6">Publication Trend (Last 5 Years)</h3>
          <div className="flex-1 relative w-full h-full pb-2">
            <Line options={lineOptions} data={lineData} />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-xl border border-blue-100 flex flex-col items-start shadow-sm justify-center">
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold mb-4">
            <TrendingUp size={14} /> Trend Insight
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">
            Research activity on <strong className="text-navy">Quantum Network Security</strong> is increasing steadily over the past 5 years.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-semibold text-navy mb-6">Topic-wise Trend</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-3 font-semibold">Topic</th>
                <th className="pb-3 font-semibold w-1/2">Growth Trend</th>
                <th className="pb-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: 'Quantum Cryptography', s: 'High', c: 'text-green-600', w: 'w-full', bg: 'bg-green-500' },
                { t: 'Quantum Communication', s: 'High', c: 'text-green-600', w: 'w-11/12', bg: 'bg-green-500' },
                { t: 'Quantum Network Security', s: 'Medium', c: 'text-orange-500', w: 'w-2/3', bg: 'bg-orange-400' },
                { t: 'Quantum Repeater Optimization', s: 'Low', c: 'text-red-500', w: 'w-1/3', bg: 'bg-red-500' }
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="py-4 text-slate-700 font-medium pr-4">{row.t}</td>
                  <td className="py-4 pr-8">
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div className={\`h-full \${row.w} \${row.bg} rounded-full\`}></div>
                    </div>
                  </td>
                  <td className={\`py-4 font-bold \${row.c}\`}>{row.s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`,
  'src/pages/GapAnalysis.jsx': `
import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

export default function GapAnalysis() {
  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Research Gap Analysis</h1>
        <p className="text-sm text-slate-500">Identifies less-explored areas within a research domain using data-analytics driven scoring.</p>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-3 font-semibold">Topic</th>
                <th className="pb-3 font-semibold">Research Level</th>
                <th className="pb-3 font-semibold w-1/3">Trend</th>
              </tr>
            </thead>
            <tbody>
              {[
                { t: 'Quantum Cryptography', l: 'High', c: 'text-green-600', bg: 'bg-green-500', w: 'w-11/12' },
                { t: 'Quantum Communication', l: 'High', c: 'text-green-600', bg: 'bg-green-500', w: 'w-10/12' },
                { t: 'Quantum Internet', l: 'Medium', c: 'text-orange-500', bg: 'bg-orange-400', w: 'w-2/3' },
                { t: 'Quantum Network Security', l: 'Low', c: 'text-red-600', bg: 'bg-red-500', w: 'w-1/3' },
                { t: 'Quantum Repeater Optimization', l: 'Low', c: 'text-red-600', bg: 'bg-red-500', w: 'w-1/4' }
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="py-4 text-slate-700 font-medium pr-4">{row.t}</td>
                  <td className={\`py-4 font-bold \${row.c}\`}>{row.l}</td>
                  <td className="py-4 flex items-center gap-3">
                    <div className="h-2.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className={\`h-full \${row.bg} \${row.w} rounded-full\`}></div>
                    </div>
                    {row.l === 'Low' && <TrendingDown size={16} className={row.c} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-red-50/50 border border-red-200 p-8 rounded-xl flex items-start gap-5 shadow-sm">
        <div className="bg-white p-3 rounded-xl border border-red-100 shadow-sm shrink-0">
          <AlertTriangle className="text-red-500" size={28} />
        </div>
        <div>
          <h3 className="text-red-600 font-bold text-sm tracking-wide uppercase mb-2 flex items-center gap-2">Potential Research Gap</h3>
          <p className="font-bold text-navy text-xl mb-2">Quantum Network Security</p>
          <p className="text-slate-700 text-sm leading-relaxed max-w-2xl">Low publication activity compared with related research topics. Heuristic signal analysis indicates substantial room for foundational models and framework development in this sector.</p>
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

export default function Novelty() {
  return (
    <div className="max-w-6xl mx-auto flex flex-col xl:flex-row gap-8 w-full">
      {/* Left Column: Novelty Check */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Novelty Check</h1>
          <p className="text-sm text-slate-500">Compares a new research topic with existing papers.</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full">
          <h3 className="font-semibold text-navy mb-3 text-sm">Your Research Topic</h3>
          <div className="flex gap-3 mb-8">
            <input type="text" className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none text-slate-700 font-medium" defaultValue="AI-based Quantum Network Security" />
            <button className="bg-brand text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 whitespace-nowrap shadow-sm transition-colors">Check Similarity</button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-28 h-28 rounded-full border-8 border-slate-200 border-t-brand border-r-brand flex items-center justify-center relative shrink-0 shadow-sm bg-white">
              <span className="text-3xl font-bold text-navy">18%</span>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-500 mb-2 text-sm font-bold uppercase tracking-wider"><Lightbulb size={16} className="text-brand" /> Interpretation</div>
              <p className="text-slate-700 text-sm mb-3 leading-relaxed">The topic shows low similarity with existing papers, indicating high novelty within the current corpus context.</p>
              <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider border border-green-200">LOW OVERLAP</span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-navy mb-4 text-sm">Most Similar Papers</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-2 font-semibold w-8">#</th>
                    <th className="pb-2 font-semibold">Paper Title</th>
                    <th className="pb-2 font-semibold text-right">Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {mockRelatedPapers.slice(0,3).map((p, i) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className="py-3.5 text-slate-400 font-medium">{i+1}</td>
                      <td className="py-3.5 text-slate-700 font-medium pr-4 line-clamp-1">{p.title}</td>
                      <td className="py-3.5 font-bold text-brand text-right">{p.similarity}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="text-sm font-medium text-brand mt-4 hover:text-blue-800 transition-colors flex items-center gap-1 w-full justify-end">View Details <ArrowRight size={14}/></button>
          </div>
        </div>
      </div>

      {/* Right Column: Recommendations */}
      <div className="flex-1 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Research Recommendations</h1>
          <p className="text-sm text-slate-500">Based on trends, gaps and novelty analysis.</p>
        </div>
        
        <div className="space-y-4">
          {mockRecommendations.map((rec, i) => (
            <div key={rec.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start gap-4 hover:shadow-md transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand flex items-center justify-center text-sm font-bold shrink-0">{i+1}</div>
              <div className="flex-1">
                <h3 className="font-semibold text-navy mb-2">{rec.title}</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={\`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border \${rec.gap.includes('High') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}\`}>{rec.gap}</span>
                  <span className={\`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border \${rec.potential.includes('High') ? 'bg-green-50 text-green-600 border-green-100' : 'bg-orange-50 text-orange-600 border-orange-100'}\`}>{rec.potential}</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">{rec.description}</p>
                <button className="text-xs font-medium text-slate-600 hover:text-brand hover:border-brand border border-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1">Explore Topic <ArrowRight size={12}/></button>
              </div>
            </div>
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

export default function Report() {
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy mb-1">Consolidated Report</h1>
          <p className="text-sm text-slate-500">Quantum Network Security Project</p>
        </div>
        <button className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 shadow-sm transition-colors">
          <Download size={16} /> Download PDF
        </button>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-xl border border-slate-200 shadow-sm mb-8 text-slate-600 text-sm leading-relaxed">
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-slate-100">
          <div className="p-3 bg-blue-50 text-brand rounded-xl"><FileText size={28}/></div>
          <div>
            <h2 className="text-xl font-bold text-navy">Research Intelligence Summary</h2>
            <p className="text-slate-500">Generated on Sep 11, 2025</p>
          </div>
        </div>

        <h3 className="text-base font-bold text-navy mb-3 uppercase tracking-wide">Executive Summary</h3>
        <p className="mb-8">This report compiles analysis across 125 papers related to <strong>Quantum Network Security</strong>. Data extraction successfully identified 18 key topics, uncovering clear potential research gaps in integration of AI models within repeater optimization.</p>
        
        <h3 className="text-base font-bold text-navy mb-3 uppercase tracking-wide">Gap Analysis Highlights</h3>
        <ul className="list-disc pl-5 mb-8 space-y-2">
          <li><strong>High Priority:</strong> Quantum Repeater Optimization shows low coverage (12 papers) despite high overall trend growth (+22% YoY).</li>
          <li><strong>Moderate Priority:</strong> Hybrid Classical-Quantum networks show emerging signals but lack definitive methodological frameworks.</li>
        </ul>

        <h3 className="text-base font-bold text-navy mb-3 uppercase tracking-wide">Recommended Directions</h3>
        <p className="mb-8">Based on the calculated similarity of proposed concepts against the current corpus, an investigation into <em>AI-based routing for Quantum Repeaters</em> is recommended. This yields a novelty score of 82% (18% similarity overlap).</p>
      </div>
    </div>
  );
}
`,
  'src/App.jsx': `
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import SidebarLayout from './layouts/SidebarLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import Projects from './pages/Projects';
import UploadAnalyze from './pages/UploadAnalyze';
import AnalysisDashboard from './pages/AnalysisDashboard';
import Trends from './pages/Trends';
import GapAnalysis from './pages/GapAnalysis';
import Novelty from './pages/Novelty';
import Report from './pages/Report';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
        </Route>

        {/* Dashboard Routes without sidebar context (just projects list) */}
        <Route element={<PublicLayout />}>
          <Route path="/dashboard" element={<Projects />} />
        </Route>

        {/* Project Specific Routes (Sidebar Layout) */}
        <Route path="/projects/:projectId" element={<SidebarLayout />}>
          <Route path="upload" element={<UploadAnalyze />} />
          <Route path="analysis" element={<AnalysisDashboard />} />
          <Route path="trends" element={<Trends />} />
          <Route path="gaps" element={<GapAnalysis />} />
          <Route path="novelty" element={<Novelty />} />
          <Route path="report" element={<Report />} />
        </Route>

        <Route path="/analyze" element={<SidebarLayout />}>
          <Route index element={<UploadAnalyze />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
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
console.log('UI files created successfully.');
