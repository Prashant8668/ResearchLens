# Implementation Plan

## Six Major Screens
1. **Landing Page (Home):** Hero section, value proposition, feature cards, navigation, and authentication CTAs.
2. **Upload / Analyze Page:** Drag-and-drop PDF upload zone, research topic input, recent uploads list, and processing status.
3. **Analysis Dashboard:** Overview metrics, top keywords, related papers, and AI-powered structured summaries per paper.
4. **Research Trend Analysis:** Publication count charts, topic distribution, keyword frequency, and emerging topics.
5. **Research Gap Analysis:** Gap score, heuristic signal breakdown (coverage, growth, overlap), under-explored areas.
6. **Novelty Check & Recommendations:** TF-IDF similarity score, matching papers, and AI-grounded research recommendations.

## Supporting Pages
* **Login & Register Pages:** JWT-based authentication flows.
* **Projects Dashboard:** Grid view of user's research projects.
* **Report Page:** Consolidated, downloadable summary of all analyses.
* **About Page:** Platform limitations, usage guides, and disclaimers.

## Frontend Architecture
* **Framework:** React.js via Vite.
* **Routing:** React Router v6.
* **Styling:** Tailwind CSS.
* **Charting:** Chart.js with react-chartjs-2.
* **State Management:** React Context API (for auth and project state).
* **HTTP Client:** Axios.

## Backend Architecture
* **Runtime:** Node.js + Express.js.
* **Middleware:** Helmet, CORS, express-rate-limit, Multer (for uploads).
* **Auth:** JWT (jsonwebtoken) + bcrypt.
* **Integration:** Communicates with the Python FastAPI service and OpenAI API.

## Python Architecture
* **Framework:** FastAPI.
* **Purpose:** Handles computationally heavy text extraction, NLP, and vector math.
* **Communication:** Internal REST API consumed by the Node.js backend.

## Database Architecture
* **Status:** [BLOCKED] Pending architecture decision (MongoDB vs. Supabase PostgreSQL).
* **Requirement:** Must support Users, Projects, Papers, Extracted Data, and Keywords schemas.

## API Architecture
* **Node.js REST API:** Handles client requests, auth, file uploads, and database CRUD.
* **Python FastAPI:** Internal microservice endpoint (/process-pdf, /calculate-similarity).
* **OpenAI API:** GPT-4o endpoints used purely server-side for summarization and text generation.

## PDF Processing Flow
1. Client uploads PDF via React UI.
2. Node.js receives file via Multer and stores it (local or Supabase Storage).
3. Node.js triggers Python FastAPI /process endpoint with file path/URL.
4. Python PyMuPDF extracts text and metadata.
5. Node.js updates paper status to COMPLETED or FAILED.

## NLP Flow
1. Python service receives extracted text.
2. NLTK/spaCy cleans, tokenizes, removes stop-words.
3. Term frequencies and keywords are extracted and scored.
4. Structured metadata (keywords, weights) returned to Node.js for database storage.

## AI Flow
1. Following NLP extraction, Node.js constructs a prompt containing paper content.
2. Node.js calls OpenAI GPT-4o API.
3. Receives structured JSON response (Problem, Objective, Methodology, Findings, Limitations).
4. Data is stored alongside the paper record.

## Similarity Flow
1. User submits research idea.
2. Node.js sends idea to Python FastAPI.
3. Python preprocesses idea text.
4. Python calculates TF-IDF vectors for the idea and the project's paper corpus.
5. Python computes Cosine Similarity.
6. Ranked results and score returned to Node.js, then to React client.

## Trend Flow
1. Client requests trends for a specific project.
2. Node.js queries database for paper metadata (years, topics, keywords).
3. Aggregates data into timeseries format and frequency counts.
4. Client renders Chart.js visualizations.

## Gap Flow
1. Client requests gap analysis.
2. Node.js triggers Python FastAPI heuristic scoring algorithm.
3. Python evaluates: Topic Coverage (40%), Recent Activity (25%), Keyword Coverage (20%), Overlap (15%).
4. Python returns gap score and reasons.
5. Node.js enriches with related paper metadata and serves to client.

## Recommendation Flow
1. Node.js gathers: user idea, similarity results, trends, and gap signals.
2. Constructs a prompt for OpenAI GPT-4o.
3. Requests suggested research directions grounded *only* in provided context.
4. Renders output as Recommendation Cards with supporting corpus evidence.

## Testing Strategy
* **Backend:** Unit tests for extraction logic, route integration tests.
* **Python:** NLP and similarity accuracy unit tests.
* **Frontend:** Component tests (upload UI, chart rendering) and E2E core flow tests.
* **Data:** Validation that AI outputs do not hallucinate external papers.

## Deployment Strategy
* **Frontend:** Vercel or Netlify.
* **Node.js Backend:** Render, Railway, or Heroku.
* **Python Service:** Render, Railway, or separate containerized instance.
* **Database:** Supabase or MongoDB Atlas (pending decision).

## Phase Dependencies
* **Phase 1 (Foundation):** Setup Repos, Auth, Database [BLOCKED].
* **Phase 2 (Core):** PDF Upload, Python Extraction Service.
* **Phase 3 (NLP/AI):** Keyword Extraction, OpenAI Summarization.
* **Phase 4 (Analytics):** Similarity, Trends, Gap Analysis.
* **Phase 5 (UI/UX):** Dashboard integration, Charting, Reporting.
