import React from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, FileText, BarChart2, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col items-center bg-dark-bg overflow-x-hidden">
      {/* TWO-COLUMN HERO SECTION */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 lg:pt-16 pb-12 lg:pb-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* LEFT COLUMN: TEXT & CTA */}
        <div className="flex flex-col items-start text-left">
          <h1 className="text-4xl lg:text-5xl font-black text-text-primary mb-4 tracking-tight leading-tight">
            ResearchLens
          </h1>
          <h2 className="text-xl lg:text-2xl font-bold text-text-muted mb-6 tracking-tight">
            AI Powered Research Intelligence System
          </h2>
          <p className="text-base lg:text-lg font-medium text-text-secondary mb-6 max-w-lg leading-relaxed">
            Analyze research. Discover gaps. Find your next direction.
          </p>
          <div className="flex items-center gap-2 mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 shadow-sm">NLP</span>
            <span className="text-dark-border">&bull;</span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 shadow-sm">Data Analytics</span>
            <span className="text-dark-border">&bull;</span>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 shadow-sm">Research Analysis</span>
          </div>
          <Link to="/dashboard">
            <Button variant="primary" className="text-base px-8 py-3.5 font-bold shadow-md shadow-brand-primary/20">
              Get Started &rarr;
            </Button>
          </Link>
        </div>

        {/* RIGHT COLUMN: VISUAL COMPOSITION */}
        <div className="relative w-full flex items-center justify-center min-h-[350px]">
          {/* Decorative blurred background element */}
          <div className="absolute w-72 h-72 bg-brand-primary/20 rounded-full blur-3xl"></div>
          
          {/* Main Document Card */}
          <div className="relative z-10 w-72 bg-dark-card border border-dark-border rounded-2xl shadow-xl p-6 flex flex-col transform -rotate-3 transition-transform hover:rotate-0 duration-500">
            <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center mb-5 border border-brand-primary/20">
              <FileText size={24}/>
            </div>
            <div className="h-3.5 bg-dark-elevated rounded-full w-3/4 mb-4"></div>
            <div className="space-y-2.5 mb-8">
              <div className="h-2.5 bg-dark-secondary rounded-full w-full"></div>
              <div className="h-2.5 bg-dark-secondary rounded-full w-5/6"></div>
              <div className="h-2.5 bg-dark-secondary rounded-full w-full"></div>
              <div className="h-2.5 bg-dark-secondary rounded-full w-4/5"></div>
            </div>
            <div className="mt-auto flex items-center justify-between border-t border-dark-border pt-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-secondary border border-dark-border"></div>
                <div className="h-2.5 bg-dark-elevated rounded-full w-16"></div>
              </div>
              <div className="h-6 w-16 bg-brand-primary/10 rounded-lg border border-brand-primary/20"></div>
            </div>
          </div>

          {/* Floating Metric Card (Overlap Bottom Right) */}
          <div className="absolute z-20 bottom-8 -right-2 md:right-8 lg:-right-4 w-52 bg-dark-card border border-dark-border rounded-xl shadow-lg p-5 transform rotate-3 transition-transform hover:rotate-6 duration-500">
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-status-success/10 text-status-success border border-status-success/20 rounded-xl flex items-center justify-center shrink-0">
                 <BarChart2 size={20}/>
               </div>
               <div>
                 <div className="text-[10px] font-black text-text-muted uppercase tracking-wider mb-0.5">Similarity</div>
                 <div className="text-xl font-black text-text-primary leading-none">18%</div>
               </div>
            </div>
            <div className="h-2 w-full bg-dark-secondary rounded-full overflow-hidden">
               <div className="h-full bg-brand-primary w-1/5 rounded-full"></div>
            </div>
          </div>

          {/* Floating Search/Analyze Icon (Overlap Top Left) */}
          <div className="absolute z-20 top-4 -left-2 md:left-12 lg:-left-4 w-14 h-14 bg-dark-card border border-dark-border rounded-2xl shadow-lg flex items-center justify-center text-brand-primary transform -rotate-12">
             <Search size={24} />
          </div>
        </div>
      </div>

      {/* 4-COLUMN FEATURE CARDS */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24 z-10 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon={<TrendingUp className="text-brand-primary" size={24} />}
            title="Trend Analysis"
            description="Visualize research growth and decline across topics."
            bg="bg-brand-primary/10 border-brand-primary/20"
          />
          <FeatureCard 
            icon={<AlertTriangle className="text-status-success" size={24} />}
            title="Gap Analysis"
            description="Find less-explored areas in the research domain."
            bg="bg-status-success/10 border-status-success/20"
          />
          <FeatureCard 
            icon={<CheckCircle2 className="text-brand-purple" size={24} />}
            title="Novelty Check"
            description="Check similarity with existing papers."
            bg="bg-brand-purple/10 border-brand-purple/20"
          />
          <FeatureCard 
            icon={<Lightbulb className="text-status-warning" size={24} />}
            title="Research Recommendation"
            description="Get suggested topics and directions."
            bg="bg-status-warning/10 border-status-warning/20"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, bg }) {
  return (
    <Card className="p-6 flex flex-col items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${bg} shadow-sm`}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-text-primary mb-1.5 text-base">{title}</h3>
        <p className="text-sm font-medium text-text-muted leading-relaxed">{description}</p>
      </div>
    </Card>
  );
}
