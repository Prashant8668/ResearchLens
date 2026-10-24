# Architecture Decisions

## Database Architecture Conflict

### Conflict Overview
There is a conflicting database architecture requirement between the original Complete Project Source and the current Product Requirements Document (PRD).

### Original Approved Architecture
* **Database:** MongoDB
* **ORM/ODM:** Mongoose

### Current PRD Architecture
* **Database:** Supabase PostgreSQL (Managed Relational Database)
* **File Storage:** Supabase Storage (replacing local uploads/ directory)
* **Authentication:** Supabase Auth (optional supplement to JWT)

### Technical Implications
* **Data Modeling:** MongoDB is a NoSQL document database, allowing flexible schema design which is often easier for varied AI extracted document structures. PostgreSQL is a strict relational database requiring predefined schemas, migrations, and joins (e.g., mapping projects to papers to extracted keywords).
* **Storage:** Mongoose typically pairs well with local or AWS S3 storage. Supabase provides an integrated storage solution (Supabase Storage) with its PostgreSQL instance, changing how file uploads and paths are managed.
* **Backend Integration:** Using MongoDB requires the mongoose package and MongoDB connection strings. Using Supabase requires the @supabase/supabase-js client, and interactions are done via Supabase's PostgREST API or custom SQL queries.
* **Current PRD Contradiction:** The Tech Stack section in the PRD lists "Mongoose" as the Database ORM under Back-End, while the primary database is listed as Supabase (PostgreSQL). Mongoose *cannot* be used with PostgreSQL. If Supabase PostgreSQL is chosen, an ORM like Prisma or Drizzle, or just the Supabase client, must be used instead.

### Recommended Choice
**Supabase (PostgreSQL + Storage)** is recommended for this project.
* **Why:** The integrated nature of Supabase (Auth, Postgres, Storage) simplifies infrastructure management compared to hosting MongoDB and a separate file storage solution (like S3). Relational data is well-suited for structured project-paper relationships and user management.
* **Caveat:** The backend ORM must be updated. Mongoose should be removed from the stack, and Prisma, Drizzle, or the native @supabase/supabase-js client should be adopted.

### Decision Required
**[BLOCKER] Explicit resolution is required before database-dependent functionality can be implemented.** 
Please confirm whether to proceed with:
1. **Option A:** MongoDB + Mongoose + Local/S3 Storage (Original Architecture).
2. **Option B:** Supabase PostgreSQL + Supabase Storage + Supabase Client/Prisma (Current PRD Architecture).
