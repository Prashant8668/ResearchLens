import { jsPDF } from 'jspdf';

export const cleanPaperTitle = (paper) => {
  if (!paper) return 'Untitled Document';
  const raw = (paper.title || paper.name || '').trim();
  if (raw && !['(anonymous)', 'anonymous', 'untitled', 'unknown'].includes(raw.toLowerCase())) {
    return raw;
  }
  return paper.originalFilename || 'Untitled Document';
};

export const stripPhaseAnnotation = (text) => {
  if (typeof text !== 'string') return text;
  return text.replace(/\s*\((?:NLP\s+)?Phase\s*\d+\)/gi, '').trim();
};

const formatGroundingLevel = (level) => {
  if (!level) return 'Corpus-Inferred';
  const norm = String(level).toUpperCase();
  if (norm.includes('EXPLICIT')) return 'Evidence-Grounded (Author Limitations)';
  if (norm.includes('CORPUS')) return 'Corpus-Inferred Synthesis';
  if (norm.includes('HYPOTHESIS')) return 'Hypothesis for Investigation';
  return level;
};

/**
 * Generates and triggers download of a genuine academic PDF research report using jsPDF.
 * Output has application/pdf MIME type and .pdf file extension.
 * Formatted as a professional academic research report with clean, standard
 * scholarly headings and zero internal development phase labels.
 *
 * @param {Object} report Report payload matching /api/projects/:id/report schema
 * @returns {{ doc: jsPDF, blob: Blob, filename: string }}
 */
export function generatePdfReport(report) {
  if (!report) {
    throw new Error('Report data is required to generate PDF');
  }

  const paper = report.selectedPaper;
  const isCorpusReport = !paper;
  const projectName = report.projectName || 'Research Project';
  const domain = report.domain || 'General Research';
  const title = paper ? cleanPaperTitle(paper) : `${projectName} (Corpus Overview)`;
  const keywords = Array.isArray(report.keywords) ? report.keywords : [];
  const summary = report.structuredSummary;
  const similarity = report.similarityScreening;
  const trends = Array.isArray(report.trends) ? report.trends : [];
  const gaps = Array.isArray(report.gaps) ? report.gaps : [];
  const recommendations = Array.isArray(report.recommendations) ? report.recommendations : [];
  const corpusPapers = Array.isArray(report.corpusPapers)
    ? report.corpusPapers
    : (Array.isArray(report.availablePapers) ? report.availablePapers : []);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageOverflow = (neededHeight = 24) => {
    if (y + neededHeight > pageHeight - margin - 25) {
      doc.addPage();
      y = margin + 10;
      return true;
    }
    return false;
  };

  const renderSectionHeader = (titleText) => {
    checkPageOverflow(40);
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(titleText, margin, y);
    y += 5;
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(1);
    doc.line(margin, y, margin + contentWidth, y);
    y += 14;
  };

  // -------------------------------------------------------------
  // Header Banner
  // -------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('ResearchLens Academic Research Report', margin + 14, y + 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  const genDateStr = report.generatedAt ? new Date(report.generatedAt).toLocaleString() : new Date().toLocaleString();
  const headerMeta = `Project: ${projectName}${domain ? ` (${domain})` : ''}   |   Generated: ${genDateStr}`;
  doc.text(headerMeta, margin + 14, y + 41);
  y += 68;

  // -------------------------------------------------------------
  // 1. Research Overview
  // -------------------------------------------------------------
  renderSectionHeader('Research Overview');

  if (paper) {
    const authorsStr = Array.isArray(paper.authors) && paper.authors.length > 0
      ? paper.authors.join(', ')
      : 'Not detected';
    const totalCorpusCount = report.totalCompletedPapers ?? (report.availablePapers?.length || 1);

    const metaRows = [
      ['Document Title:', title],
      ['Original Filename:', paper.originalFilename || 'N/A'],
      ['Authors:', authorsStr],
      ['Publication Year:', String(paper.publicationYear || 'Not detected')],
      ['Status:', paper.status || 'Analyzed'],
      ['Corpus Scope:', `${totalCorpusCount} paper(s) analyzed in project corpus`],
    ];

    metaRows.forEach(([label, val]) => {
      checkPageOverflow(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const splitVal = doc.splitTextToSize(val, contentWidth - 130);
      doc.text(splitVal, margin + 130, y);
      y += splitVal.length * 12 + 3;
    });
  } else {
    // Empty Corpus State
    const metaRows = [
      ['Project Name:', projectName],
      ['Research Domain:', domain],
      ['Analyzed Documents:', '0 documents'],
      ['Corpus Status:', 'Empty Research Corpus — No papers have been uploaded to this project yet.'],
      ['Guidance:', 'Upload research papers via Upload & Analyze to enable automated text analysis, trends discovery, research gaps identification, and research ideas synthesis.'],
    ];

    metaRows.forEach(([label, val]) => {
      checkPageOverflow(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const splitVal = doc.splitTextToSize(val, contentWidth - 130);
      doc.text(splitVal, margin + 130, y);
      y += splitVal.length * 12 + 3;
    });
  }

  y += 4;

  // -------------------------------------------------------------
  // 2. Papers Analyzed (Corpus Overview if multiple papers)
  // -------------------------------------------------------------
  if (corpusPapers && corpusPapers.length > 1) {
    checkPageOverflow(30);
    renderSectionHeader(`Papers Analyzed (${corpusPapers.length} Total)`);

    corpusPapers.forEach((p, idx) => {
      checkPageOverflow(16);
      const pTitle = cleanPaperTitle(p);
      const authors = Array.isArray(p.authors) && p.authors.length > 0 ? p.authors.join(', ') : 'Authors not detected';
      const year = p.publicationYear ? `(${p.publicationYear})` : '(n.d.)';
      const line = `${idx + 1}. ${pTitle} ${year} — ${authors}`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const splitLine = doc.splitTextToSize(line, contentWidth);
      splitLine.forEach((l) => {
        checkPageOverflow(11);
        doc.text(l, margin, y);
        y += 10.5;
      });
      y += 2;
    });
    y += 4;
  }

  // -------------------------------------------------------------
  // 3. Research Keywords (only when supported by project data)
  // -------------------------------------------------------------
  if (keywords.length > 0) {
    renderSectionHeader(`Research Keywords (${keywords.length} Extracted)`);

    let kwX = margin;
    const topKeywords = keywords.slice(0, 30);
    topKeywords.forEach((kw, idx) => {
      const rankNum = kw.rank || idx + 1;
      const scoreVal = kw.score ?? kw.totalScore ?? 0;
      const scoreStr = typeof scoreVal === 'number' ? scoreVal.toFixed(2) : String(scoreVal);
      const termText = `#${rankNum} ${kw.term} (${scoreStr})`;
      const textWidth = doc.getTextWidth(termText) + 12;

      if (kwX + textWidth > margin + contentWidth) {
        kwX = margin;
        y += 18;
        checkPageOverflow(22);
      }
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(kwX, y - 9, textWidth, 14, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(kwX, y - 9, textWidth, 14, 2, 2, 'S');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(termText, kwX + 6, y + 1);
      kwX += textWidth + 4;
    });
    y += 20;
  }

  // -------------------------------------------------------------
  // 4. Structured Research Summary (only when supported by data)
  // -------------------------------------------------------------
  if (summary) {
    renderSectionHeader('Structured Research Summary');

    const summarySections = [
      { title: 'Research Problem:', content: summary.researchProblem },
      { title: 'Objective:', content: summary.objective },
      { title: 'Methodology:', content: summary.methodology },
    ];

    summarySections.forEach(({ title: secTitle, content: secContent }) => {
      checkPageOverflow(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(secTitle, margin, y);
      y += 11;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const splitContent = doc.splitTextToSize(secContent || 'N/A', contentWidth);
      splitContent.forEach((line) => {
        checkPageOverflow(12);
        doc.text(line, margin, y);
        y += 11;
      });
      y += 4;
    });

    // Key Findings
    checkPageOverflow(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text('Key Findings:', margin, y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const findings = Array.isArray(summary.keyFindings) && summary.keyFindings.length > 0
      ? summary.keyFindings
      : ['None reported'];
    findings.forEach((finding) => {
      const splitFinding = doc.splitTextToSize(`• ${finding}`, contentWidth);
      splitFinding.forEach((line) => {
        checkPageOverflow(12);
        doc.text(line, margin, y);
        y += 11;
      });
    });
    y += 4;

    // Limitations
    checkPageOverflow(24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text('Limitations:', margin, y);
    y += 11;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const limitations = Array.isArray(summary.limitations) && summary.limitations.length > 0
      ? summary.limitations
      : ['None reported'];
    limitations.forEach((limit) => {
      const splitLimit = doc.splitTextToSize(`• ${limit}`, contentWidth);
      splitLimit.forEach((line) => {
        checkPageOverflow(12);
        doc.text(line, margin, y);
        y += 11;
      });
    });
    y += 6;
  }

  // -------------------------------------------------------------
  // 5. Corpus Similarity Analysis (only when supported by data)
  // -------------------------------------------------------------
  if (similarity) {
    renderSectionHeader('Corpus Similarity Analysis');

    checkPageOverflow(70);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 5, contentWidth, 54, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y - 5, contentWidth, 54, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Candidate Research Idea:', margin + 10, y + 10);
    doc.setFont('helvetica', 'normal');
    const ideaTruncated = (similarity.researchIdea || 'N/A').length > 100
      ? similarity.researchIdea.slice(0, 97) + '...'
      : similarity.researchIdea;
    doc.text(doc.splitTextToSize(ideaTruncated, contentWidth - 160), margin + 145, y + 10);

    doc.setFont('helvetica', 'bold');
    doc.text('Similarity Score:', margin + 10, y + 25);
    doc.setFont('helvetica', 'normal');
    const pctVal = similarity.similarityPercentage ?? ((similarity.similarityScore || 0) * 100);
    const pctDisplay = typeof pctVal === 'number' ? pctVal.toFixed(1) : String(pctVal);
    const simScoreText = `${pctDisplay}% (${similarity.interpretation || 'Low'} Overlap — ${similarity.statusBadge || 'LOW OVERLAP'})`;
    doc.text(simScoreText, margin + 145, y + 25);

    if (similarity.updatedAt) {
      doc.setFont('helvetica', 'bold');
      doc.text('Screening Date:', margin + 10, y + 39);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(similarity.updatedAt).toLocaleString(), margin + 145, y + 39);
    }

    y += 62;

    checkPageOverflow(20);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const disclaimerLines = doc.splitTextToSize(
      '"This score reflects textual similarity to the available project corpus. It does not measure plagiarism or guarantee originality."',
      contentWidth
    );
    disclaimerLines.forEach((dLine) => {
      checkPageOverflow(11);
      doc.text(dLine, margin, y);
      y += 10.5;
    });
    y += 6;

    if (Array.isArray(similarity.similarPapers) && similarity.similarPapers.length > 0) {
      checkPageOverflow(30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Ranked Papers in Corpus by Textual Similarity:', margin, y);
      y += 13;

      similarity.similarPapers.slice(0, 5).forEach((sp, idx) => {
        checkPageOverflow(15);
        const rank = sp.rank || idx + 1;
        const spPctVal = sp.similarity_percentage ?? ((sp.similarity_score || 0) * 100);
        const spPct = typeof spPctVal === 'number' ? spPctVal.toFixed(1) : String(spPctVal);
        const spTitle = sp.title || sp.original_filename || 'Untitled Document';
        const line = `#${rank}. ${spTitle} — ${spPct}% similarity`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const splitSpLine = doc.splitTextToSize(line, contentWidth - 10);
        splitSpLine.forEach((spL) => {
          checkPageOverflow(11);
          doc.text(spL, margin + 10, y);
          y += 10.5;
        });
      });
      y += 6;
    }
  }

  // -------------------------------------------------------------
  // 6. Research Trends (only when supported by data)
  // -------------------------------------------------------------
  if (trends.length > 0) {
    renderSectionHeader('Research Trends');

    trends.slice(0, 8).forEach((t) => {
      checkPageOverflow(34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const trendHeader = `• Topic: ${stripPhaseAnnotation(t.topic)}   [Status: ${t.status || 'Stable'} | Velocity: ${t.growthTrend || 'N/A'}]`;
      doc.text(trendHeader, margin, y);
      y += 11;

      if (t.insight) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitInsight = doc.splitTextToSize(`  ${t.insight}`, contentWidth - 10);
        splitInsight.forEach((line) => {
          checkPageOverflow(11);
          doc.text(line, margin + 6, y);
          y += 10.5;
        });
      }
      y += 3;
    });
    y += 4;
  }

  // -------------------------------------------------------------
  // 7. Research Gaps (only when supported by data)
  // -------------------------------------------------------------
  if (gaps.length > 0) {
    renderSectionHeader('Research Gaps');

    gaps.slice(0, 6).forEach((g, idx) => {
      checkPageOverflow(46);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const confPct = typeof g.confidenceScore === 'number' ? Math.round(g.confidenceScore * 100) : 75;
      const gapTitleLine = `${idx + 1}. [${g.category || 'Methodological'}] ${stripPhaseAnnotation(g.title || 'Identified Research Gap')} (${g.gapType || 'Explicit Gap'} · ${confPct}% Confidence)`;
      const splitTitle = doc.splitTextToSize(gapTitleLine, contentWidth);
      splitTitle.forEach((line) => {
        checkPageOverflow(12);
        doc.text(line, margin, y);
        y += 11.5;
      });

      if (g.description || g.whyItMatters) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const descText = g.description || g.whyItMatters;
        const splitDesc = doc.splitTextToSize(`Why it matters: ${descText}`, contentWidth - 12);
        splitDesc.forEach((line) => {
          checkPageOverflow(11);
          doc.text(line, margin + 10, y);
          y += 10.5;
        });
      }

      if (g.suggestedDirection) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(79, 70, 229); // indigo
        const splitDir = doc.splitTextToSize(`Suggested direction: ${g.suggestedDirection}`, contentWidth - 12);
        splitDir.forEach((line) => {
          checkPageOverflow(11);
          doc.text(line, margin + 10, y);
          y += 10.5;
        });
      }

      // Supporting Paper Citations
      if (Array.isArray(g.supportingPapers) && g.supportingPapers.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        g.supportingPapers.slice(0, 2).forEach((sp) => {
          const citeTitle = sp.title || sp.paperTitle || sp.originalFilename || 'Corpus Source';
          const citeYear = sp.publicationYear ? ` (${sp.publicationYear})` : '';
          const sec = sp.sourceSection ? ` [Section: ${sp.sourceSection}]` : '';
          const quote = sp.evidenceExcerpt ? ` — "${sp.evidenceExcerpt.slice(0, 140)}..."` : '';
          const citeLine = `Citation Evidence: ${citeTitle}${citeYear}${sec}${quote}`;
          const splitCite = doc.splitTextToSize(citeLine, contentWidth - 16);
          splitCite.forEach((cLine) => {
            checkPageOverflow(10);
            doc.text(cLine, margin + 12, y);
            y += 9.5;
          });
        });
      }
      y += 5;
    });
    y += 4;
  }

  // -------------------------------------------------------------
  // 8. Suggested Research Ideas (only when supported by data)
  // -------------------------------------------------------------
  if (recommendations.length > 0) {
    renderSectionHeader('Suggested Research Ideas');

    recommendations.slice(0, 6).forEach((r, idx) => {
      checkPageOverflow(50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const prio = r.priority ? `[${r.priority} Priority] ` : '';
      const groundingLabel = formatGroundingLevel(r.groundingLevel);
      const cleanRecTitle = stripPhaseAnnotation(r.title || 'Research Direction');
      const recHeader = `${idx + 1}. ${prio}${cleanRecTitle} (${groundingLabel})`;
      const splitHeader = doc.splitTextToSize(recHeader, contentWidth);
      splitHeader.forEach((hLine) => {
        checkPageOverflow(12);
        doc.text(hLine, margin, y);
        y += 11.5;
      });

      // Researchable Question
      if (r.researchQuestion) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        const splitQ = doc.splitTextToSize(`Question: ${r.researchQuestion}`, contentWidth - 12);
        splitQ.forEach((qLine) => {
          checkPageOverflow(11);
          doc.text(qLine, margin + 10, y);
          y += 10.5;
        });
      }

      // Methodology & Contribution
      const meth = r.possibleMethodology || r.methodologyDetails?.studyDesign;
      if (meth) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitMeth = doc.splitTextToSize(`Proposed Methodology: ${meth}`, contentWidth - 12);
        splitMeth.forEach((mLine) => {
          checkPageOverflow(11);
          doc.text(mLine, margin + 10, y);
          y += 10.5;
        });
      }

      if (r.expectedContribution) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitContrib = doc.splitTextToSize(`Expected Contribution: ${r.expectedContribution}`, contentWidth - 12);
        splitContrib.forEach((cLine) => {
          checkPageOverflow(11);
          doc.text(cLine, margin + 10, y);
          y += 10.5;
        });
      }

      // Supporting Paper Reference
      if (Array.isArray(r.supportingPapers) && r.supportingPapers.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const sp = r.supportingPapers[0];
        const spTitle = sp.title || sp.paperTitle || sp.originalFilename || 'Corpus Source';
        const spYear = sp.publicationYear ? ` (${sp.publicationYear})` : '';
        const spRel = sp.relevanceExplanation ? ` — ${sp.relevanceExplanation}` : '';
        const spLine = `Backing Evidence: ${spTitle}${spYear}${spRel}`;
        const splitSp = doc.splitTextToSize(spLine, contentWidth - 16);
        splitSp.forEach((sLine) => {
          checkPageOverflow(10);
          doc.text(sLine, margin + 12, y);
          y += 9.5;
        });
      }
      y += 5;
    });
    y += 4;
  }

  // -------------------------------------------------------------
  // 9. References (only when actual references are available)
  // -------------------------------------------------------------
  if (corpusPapers && corpusPapers.length > 0) {
    renderSectionHeader('References');

    corpusPapers.forEach((p, idx) => {
      checkPageOverflow(22);
      const pTitle = cleanPaperTitle(p);
      const authors = Array.isArray(p.authors) && p.authors.length > 0 ? p.authors.join(', ') : 'Authors not detected';
      const year = p.publicationYear ? String(p.publicationYear) : 'n.d.';
      const filename = p.originalFilename ? ` [File: ${p.originalFilename}]` : '';
      const citeText = `[${idx + 1}] ${authors} (${year}). "${pTitle}".${filename}`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      const splitCite = doc.splitTextToSize(citeText, contentWidth);
      splitCite.forEach((line) => {
        checkPageOverflow(11);
        doc.text(line, margin, y);
        y += 10.5;
      });
      y += 3;
    });
  }

  // -------------------------------------------------------------
  // Page Numbering Footer across all pages
  // -------------------------------------------------------------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `ResearchLens Academic Platform · Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  const safeFilename = isCorpusReport
    ? `${projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_corpus`
    : (title.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'document');
  const filename = `researchlens_report_${safeFilename}.pdf`;

  // Output as an explicit application/pdf Blob and trigger browser download if in browser
  const pdfBlob = doc.output('blob'); // MIME type is application/pdf
  if (typeof window !== 'undefined' && window.document) {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  return { doc, blob: pdfBlob, filename };
}
