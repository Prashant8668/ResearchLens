const fs = require('fs');
const path = require('path');

const files = {
  'src/pages/Home.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="max-w-4xl w-full text-center mb-16 mt-8">
        <h1 className="text-5xl md:text-6xl font-bold text-navy mb-6 leading-tight tracking-tight">
          ResearchLens<br />
          <span className="text-slate-500 text-3xl md:text-4xl font-semibold">AI Powered Research Intelligence System</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto font-medium">
          Analyze research. Discover gaps. Find your next direction.<br />
          <span className="text-brand">NLP &bull; Data Analytics &bull; Research Analysis</span>
        </p>
        <Link to="/dashboard">
          <Button variant="primary" className="text-base px-8 py-3.5 font-bold shadow-md shadow-blue-200">
            Get Started &rarr;
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl w-full pb-16">
        <FeatureCard 
          icon={<TrendingUp className="text-blue-600" size={28} />}
          title="Trend Analysis"
          description="Visualize research growth and decline across topics."
          bg="bg-blue-50 border-blue-100"
        />
        <FeatureCard 
          icon={<AlertTriangle className="text-green-600" size={28} />}
          title="Gap Analysis"
          description="Find less-explored areas in the research domain."
          bg="bg-green-50 border-green-100"
        />
        <FeatureCard 
          icon={<CheckCircle2 className="text-purple-600" size={28} />}
          title="Novelty Check"
          description="Check similarity with existing papers."
          bg="bg-purple-50 border-purple-100"
        />
        <FeatureCard 
          icon={<Lightbulb className="text-orange-600" size={28} />}
          title="Research Recommendation"
          description="Get suggested topics and directions."
          bg="bg-orange-50 border-orange-100"
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, bg }) {
  return (
    <Card className="p-8 flex flex-col items-start gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
      <div className={\`w-14 h-14 rounded-2xl flex items-center justify-center border \${bg} shadow-sm\`}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-navy mb-2 text-lg">{title}</h3>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">{description}</p>
      </div>
    </Card>
  );
}
`,
  'src/pages/Login.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function Login() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md p-8 md:p-10 shadow-lg">
        <h2 className="text-3xl font-bold text-navy mb-8 text-center tracking-tight">Log In</h2>
        <form className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">Password</label>
            <Input type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" />
          </div>
          <Link to="/dashboard" className="mt-2 w-full">
            <Button variant="primary" className="w-full py-3 text-base">Log In</Button>
          </Link>
        </form>
        <p className="text-center text-sm font-medium text-slate-500 mt-8">
          Don't have an account? <Link to="/register" className="text-brand hover:text-blue-800 transition-colors">Sign up</Link>
        </p>
      </Card>
    </div>
  );
}
`,
  'src/pages/Register.jsx': `
import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function Register() {
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-50">
      <Card className="w-full max-w-md p-8 md:p-10 shadow-lg">
        <h2 className="text-3xl font-bold text-navy mb-8 text-center tracking-tight">Create Account</h2>
        <form className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Full Name</label>
            <Input type="text" placeholder="Dr. Jane Doe" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Email</label>
            <Input type="email" placeholder="name@example.com" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Password</label>
            <Input type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" />
          </div>
          <Link to="/dashboard" className="mt-2 w-full">
            <Button variant="primary" className="w-full py-3 text-base">Create Account</Button>
          </Link>
        </form>
        <p className="text-center text-sm font-medium text-slate-500 mt-8">
          Already have an account? <Link to="/login" className="text-brand hover:text-blue-800 transition-colors">Log in</Link>
        </p>
      </Card>
    </div>
  );
}
`,
  'src/pages/UploadAnalyze.jsx': `
import React from 'react';
import { UploadCloud, FileText, ChevronRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { mockRecentFiles } from '../utils/mockData';

export default function UploadAnalyze() {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-navy mb-2 tracking-tight">Research Paper Analysis</h1>
        <p className="text-base text-slate-500 font-medium">Upload a research paper (PDF) or enter a topic to get started.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="border-2 border-dashed border-brand/30 bg-blue-50/40 rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors hover:bg-blue-50/70 hover:border-brand/60 cursor-pointer min-h-[300px]">
          <div className="w-16 h-16 bg-white text-brand rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
            <UploadCloud size={32} />
          </div>
          <p className="font-bold text-navy mb-2 text-lg">Drag & drop your PDF here</p>
          <p className="text-sm font-medium text-slate-500 mb-6">or</p>
          <Button variant="primary" className="px-8 shadow-sm">Choose File</Button>
          <p className="text-xs text-slate-400 mt-6 font-semibold uppercase tracking-wider">Supports PDF files only</p>
        </div>
        
        <div className="flex flex-col justify-center relative">
          <div className="absolute top-1/2 -left-8 -translate-y-1/2 bg-slate-100 text-xs font-black text-slate-400 p-2.5 rounded-full border border-slate-200 z-10 hidden md:block uppercase shadow-sm">OR</div>
          <Card className="p-8 md:p-10 h-full flex flex-col justify-center border-slate-200 shadow-md">
            <h3 className="font-bold text-navy mb-5 text-xl">Enter Research Topic</h3>
            <Input type="text" className="mb-6 py-3.5 text-base" placeholder="e.g. Quantum Network Security" />
            <Button variant="primary" className="w-full py-3.5 text-base mt-auto">Check Novelty &rarr;</Button>
          </Card>
        </div>
      </div>
      
      <div>
        <h3 className="font-bold text-navy mb-5 text-xl">Recent Searches / Files</h3>
        <Card className="overflow-hidden border-slate-200">
          {mockRecentFiles.map(file => (
            <div key={file.id} className="flex items-center justify-between p-5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
                  <FileText size={24} />
                </div>
                <div>
                  <p className="font-bold text-navy text-sm mb-1 group-hover:text-brand transition-colors">{file.name}</p>
                  <p className="text-xs font-medium text-slate-500">Uploaded on {file.date} &bull; {file.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <Badge variant={file.status === 'COMPLETED' ? 'success' : 'warning'}>{file.status}</Badge>
                <ChevronRight className="text-slate-300 group-hover:text-brand transition-colors" size={20} />
              </div>
            </div>
          ))}
        </Card>
      </div>
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
console.log('Pages refactored successfully.');
