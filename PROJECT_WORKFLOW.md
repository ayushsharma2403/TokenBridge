# TokenBridge ⚡ — Architecture, Workflow & Technical Specification

> **Comprehensive Technical Handbook & System Blueprint**  
> *Author: Ayush Sharma*  
> *Project Version: 3.0.0*

---

## Table of Contents
1. [Project Purpose & Core Vision](#1-project-purpose--core-vision)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Tools, Technologies & Libraries Detailed Breakdown](#3-tools-technologies--libraries-detailed-breakdown)
4. [Backend Directory & File-by-File Breakdown](#4-backend-directory--file-by-file-breakdown)
5. [Frontend Directory & File-by-File Breakdown](#5-frontend-directory--file-by-file-breakdown)
6. [Database Schema & Migration Pipeline](#6-database-schema--migration-pipeline)
7. [Complete User Journey & Runtime Workflows](#7-complete-user-journey--runtime-workflows)
   - [7.1 Authentication & Registration Flow](#71-authentication--registration-flow)
   - [7.2 AI Inference & Prompt Engineering Flow](#72-ai-inference--prompt-engineering-flow)
   - [7.3 Real-Time Factual Grounding Flow](#73-real-time-factual-grounding-flow)
   - [7.4 Token Optimization & Context Compression Flow](#74-token-optimization--context-compression-flow)
   - [7.5 Automatic File Generation & Conversion Flow](#75-automatic-file-generation--conversion-flow)
8. [Production Deployment Architecture & Cloud Tools](#8-production-deployment-architecture--cloud-tools)
9. [Key Architectural Decisions & Rationale](#9-key-architectural-decisions--rationale)
10. [Future Scope & Roadmap](#10-future-scope--roadmap)

---

## 1. Project Purpose & Core Vision

**TokenBridge** is an enterprise-grade, token-efficient AI proxy and obsidian liquid-glass workspace designed to solve three fundamental challenges in generative AI applications:

1. **Token Inefficiency & Skyrocketing LLM Costs**: Modern multi-turn conversational agents resend the entire message history on every prompt. As conversations grow, token consumption scales quadratically, burning through API quotas and multiplying costs. TokenBridge implements intelligent **context compression**, **sliding-window retention**, and **prompt optimization** to slash token usage by 40% to 70% without sacrificing conversational quality or key factual memory.
2. **Knowledge Cutoffs & Hallucinations**: Standard LLM APIs operate with static weights cut off at a past date. TokenBridge introduces **Temporal Synchronicity & Multi-Source Grounding**, retrieving real-time news, encyclopedic data, and crypto prices to inject grounded, dynamic context into prompts before inference.
3. **Fragmented Workspaces**: Most AI interfaces require external converters and third-party tools to create documents, extract files, or monitor token budgets. TokenBridge integrates on-demand document generation (`.pdf`, `.docx`, `.pptx`, `.xlsx`, `.png`/`.jpg`), real-time token tracking (`TokenVault`), and persistent checkpointing into a unified obsidian liquid-glass user interface.

---

## 2. End-to-End System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT BROWSER                                     |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  |   auth.js / login  |   |    app.js / Chat    |   |     tb-calendar.js Widget     |  |
|  +--------------------+   +---------------------+   +-------------------------------+  |
|  +---------------------------------------------------------------------------------+  |
|  |             Obsidian Liquid-Glass Design System (CSS3 Backdrop Refraction)       |  |
+-------------------------------------------|-------------------------------------------+
                                            | HTTPS / REST Calls
                                            v
+---------------------------------------------------------------------------------------+
|                          FASTAPI APPLICATION SERVER (backend)                         |
|  +---------------------------------------------------------------------------------+  |
|  |  main.py (Static File Mount, Router Dispatcher, CORS, Exception Handling)       |  |
|  +---------------------------------------------------------------------------------+  |
|            |                        |                        |                        |
|            v                        v                        v                        v
|    +---------------+        +---------------+        +---------------+        +---------------+
|    | auth.py /     |        | optimizer.py  |        | realtime_     |        | file_gen.py / |
|    | oauth.py /    |        | & prompt_     |        | grounding.py  |        | file_conv.py  |
|    | firebase.py   |        | engineer.py   |        | (News, Crypto,|        | (PDF, Word,   |
|    | (JWT & RBAC)  |        | (Compression) |        |  Wikipedia)   |        |  PPTX, Excel) |
|    +---------------+        +---------------+        +---------------+        +---------------+
|            |                        |                        |                        |
|            +------------------------+-----------+------------+------------------------+
|                                                 |
|                                                 v
|                                      +---------------------+
|                                      |      router.py      |
|                                      +---------------------+
|                                      /          |          \
|                                     /           |           \
|                                    v            v            v
|                              [ Anthropic ]  [ OpenAI ]   [ Gemini ]
|                              Claude 3.5     GPT-4o-mini  Flash 3.6
|                                    \            |            /
|                                     \           |           /
|                                      v          v          v
|                                    +-----------------------+
|                                    | tokenvault.py Log &   |
|                                    | Cost Metrics Tracking |
|                                    +-----------------------+
+-------------------------------------------------|-------------------------------------+
                                                  | SSL Connection (PyMySQL)
                                                  v
+---------------------------------------------------------------------------------------+
|                             CLOUD DATABASE (TiDB / MySQL)                             |
|  Tables: users, sessions, usage_log, tokenvault                                       |
+---------------------------------------------------------------------------------------+
```

---

## 3. Tools, Technologies & Libraries Detailed Breakdown

### 3.1 Backend & Runtime
- **Python 3.11+**: Core programming language, chosen for high performance, mature async ecosystem, and native binary wheel compatibility across cloud operating systems.
- **FastAPI (`0.115.0`)**: High-performance, asynchronous web framework built on Starlette and Pydantic. Handles REST API routing, request validation, static file mounting, and OpenAPI documentation generation.
- **Uvicorn (`0.32.0`)**: Lightning-fast ASGI web server implementation based on `uvloop` and `httptools`.
- **Pydantic (`2.10.3`)**: Data validation and type settings enforcement using Python type annotations.
- **mysql-connector-python (`9.1.0`)**: Official Oracle MySQL driver providing native connection pooling, SSL verification, and transaction management.
- **python-jose (`3.5.0`)**: Javascript Object Signing and Encryption implementation used for creating and verifying stateless JWT auth tokens.
- **passlib (`1.7.4`) with bcrypt (`4.0.1`)**: Industry-standard cryptographic password hashing library with salt stretching.
- **HTTPX (`0.28.1`)**: Next-generation asynchronous HTTP client for fetching external grounding APIs and communicating with AI endpoints.
- **python-dotenv (`1.0.1`)**: Automatic loading of environment variables from `.env` files into `os.environ`.

### 3.2 AI Providers & SDKs
- **anthropic (`0.40.0`)**: Official Anthropic Python client for interacting with Claude 3.5 Haiku.
- **openai (`1.57.0`)**: Official OpenAI Python client for interacting with GPT-4o-mini and completions.
- **google-generativeai (`0.8.3`)**: Google Gemini API client for interacting with Gemini 3.6 Flash.

### 3.3 Document Generation & Image Processing
- **ReportLab (`5.0.1`)**: Industrial-strength PDF generation library for rendering structured documents, headers, and formatted tables.
- **python-docx (`1.2.0`)**: Creates and updates Microsoft Word (`.docx`) files.
- **python-pptx (`1.0.2`)**: Builds dynamic PowerPoint slide decks (`.pptx`) with custom titles, content cards, and theme layouts.
- **openpyxl (`3.1.5`)**: Excel spreadsheet generator (`.xlsx`) supporting data grids, headers, formulas, and auto-styling.
- **Pillow (`12.3.0`)**: Python Imaging Library (PIL fork) for programmatic canvas image drawing, text rendering, and PNG/JPEG conversion.
- **PyMuPDF / fitz (`1.28.2`)**: Ultra-fast PDF parser used for text extraction and document format conversion.

### 3.4 Frontend & UI Design
- **Vanilla HTML5 & ES6 JavaScript**: Pure native browser implementation with zero bulky node_modules or front-end build steps. Guarantees instant load times and long-term maintainability.
- **Obsidian Liquid-Glass CSS3**: Custom design system featuring CSS backdrop filters (`backdrop-filter: blur()`), specular border lighting, radial ambient glows, and dark/light themes.
- **Marked.js (`v9.1.6`)**: Client-side Markdown parser converting LLM stream responses to formatted HTML.
- **DOMPurify (`v3.0.6`)**: Security sanitizer protecting against Cross-Site Scripting (XSS) in parsed Markdown and user messages.
- **Firebase Auth Web SDK (`v10.8.0`)**: Client-side reCAPTCHA verification and phone OTP dispatch.

---

## 4. Backend Directory & File-by-File Breakdown

### `backend/main.py`
- **Role**: Application entry point and primary HTTP router.
- **Key Functions**:
  - Initializes FastAPI application instance with metadata.
  - Mounts the `/` route to serve static files from `../frontend`.
  - Configures CORS middleware via dynamic `ALLOWED_ORIGINS` allowlist.
  - Establishes HTTP cache control middleware (`no-cache` for HTML/JS/CSS to prevent stale browser assets).
  - Exposes all authentication endpoints (`/auth/register`, `/auth/login`, `/auth/google`, `/auth/firebase-phone`, `/auth/forgot-password`, `/auth/reset-password`).
  - Exposes core AI endpoints (`/chat`, `/optimize-prompt`, `/validate-key`).
  - Exposes session management endpoints (`/sessions`, `/session/{session_id}`, `/session/{session_id}/rename`).
  - Exposes document generation & conversion endpoints (`/generate-file`, `/convert-file`, `/download-file/{file_id}`).
  - Exposes TokenVault analytics endpoints (`/tokenvault`, `/tokenvault/{session_id}`).

### `backend/config.py`
- **Role**: Centralized environment variable parser and configuration loader.
- **Key Functions**:
  - Parses cloud `DATABASE_URL` / `MYSQL_URL` into host, port, user, password, and database dictionary.
  - Automatically enables `ssl_verify_cert=True` when running on remote cloud hosts.
  - Reads AI model identifiers (`CLAUDE_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL`) and automatically migrates discontinued Gemini model strings to `gemini-3.6-flash`.
  - Defines context compression thresholds (`COMPRESS_AT = 2500`, `KEEP_LAST_N = 6`, `RESPONSE_BUFFER = 600`).
  - Sets host, port, debug mode, and application public base URL (`APP_URL`).

### `backend/database.py`
- **Role**: MySQL connection manager and idempotent database setup migration runner.
- **Key Functions**:
  - `connect()`: Opens and returns a connection to MySQL using `DB_CONFIG`.
  - `setup()`: Automatically runs on application startup to create all required tables (`users`, `sessions`, `usage_log`, `tokenvault`) and idempotently adds missing columns (`phone`, `dob`, `age`, `subscription_tier`, `language`) using error-tolerant migrations.

### `backend/auth.py`
- **Role**: User authentication, password hashing, and JWT token management.
- **Key Functions**:
  - `hash_password()` & `verify_password()`: Uses `passlib[bcrypt]` to securely hash passwords.
  - `create_token()` & `get_user_from_token()`: Signs and verifies stateless JWT tokens using HMAC-SHA256 (`HS256`).
  - `register_user()` & `login_user()`: Validates input, checks database duplicates, verifies age restriction (minimum 18 years), and returns session tokens.
  - `update_user_profile()` & `change_user_password()`: Updates profile details, avatar preferences, and credentials.

### `backend/oauth.py`
- **Role**: Google OAuth 2.0 flow implementation.
- **Key Functions**:
  - `get_google_login_url()`: Constructs the official Google OAuth authorization URL with `state` protection and scope requests (`openid`, `email`, `profile`).
  - `handle_google_callback()`: Exchanges authorization codes for Google access tokens, retrieves the user profile from Google's userinfo API, links or creates the local user record, and issues a JWT token.

### `backend/firebase_auth.py`
- **Role**: Firebase Phone OTP verification and account provisioning.
- **Key Functions**:
  - Safely initializes the Firebase Admin SDK using local file `firebase_key.json` or `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable.
  - `verify_firebase_token()`: Verifies incoming Firebase phone ID tokens against Google servers.
  - `login_with_phone()`: Finds or creates user accounts tied to verified mobile phone numbers and issues JWT session tokens.

### `backend/email_service.py`
- **Role**: Transactional email notification and OTP service.
- **Key Functions**:
  - `send_reset_email()`: Sends HTML password reset emails containing signed cryptographic reset tokens via Google Gmail SMTP (Port 587 with TLS).
  - `send_otp_email()`: Dispatches 6-digit verification codes for password recovery.

### `backend/router.py`
- **Role**: Multi-model AI dispatch and API key validation.
- **Key Functions**:
  - `detect_provider()`: Determines whether a model name belongs to Anthropic, OpenAI, or Google Gemini.
  - `call_api()`: Normalizes request payloads, routes execution to the chosen provider client, handles error responses, and returns structured outputs with token usage.
  - `validate_api_key()`: Verifies whether a user-provided API key is valid by making a lightweight test call.

### `backend/optimizer.py`
- **Role**: Context window compression and token conservation engine.
- **Key Functions**:
  - `count_tokens()`: Estimates token counts across messages.
  - `compress_history()`: Evaluates conversation length against `COMPRESS_AT` (2500 tokens). If exceeded, compresses older exchanges into a concise factual summary while retaining the most recent `KEEP_LAST_N` messages untouched.

### `backend/prompt_engineer.py`
- **Role**: Prompt enhancement engine.
- **Key Functions**:
  - `engineer_prompt()`: Uses an LLM pass to rewrite ambiguous or verbose prompts into structured, high-clarity instructions, stripping out unnecessary filler to maximize output accuracy while saving tokens.

### `backend/realtime_grounding.py`
- **Role**: Real-time factual context injection and temporal synchronization.
- **Key Functions**:
  - Detects time-sensitive or real-time queries (news, current date, weather, stock/crypto prices).
  - Fetches live data asynchronously via Google News RSS, CoinGecko API, and Wikipedia Search API.
  - Synthesizes a factual grounding snippet injected into the system prompt prior to inference.

### `backend/file_generator.py`
- **Role**: Multi-format programmatic document generation engine.
- **Key Functions**:
  - `generate_pdf()`: Builds clean PDF documents using ReportLab.
  - `generate_docx()`: Constructs Microsoft Word documents using `python-docx`.
  - `generate_pptx()`: Builds slide decks with title and card layouts using `python-pptx`.
  - `generate_xlsx()`: Generates structured Excel spreadsheets using `openpyxl`.
  - `generate_image()`: Generates canvas graphics and saves as PNG or JPEG using `Pillow`.

### `backend/file_converter.py`
- **Role**: In-memory document conversion engine.
- **Key Functions**:
  - Converts between formats (e.g. DOCX to PDF, PDF to TXT, image format conversions) with file validation and size checks.

### `backend/checkpoint.py`
- **Role**: Conversational state persistence and checkpoint manager.
- **Key Functions**:
  - `save()`: Stores serialized message histories in MySQL.
  - `load()`: Retrieves chat histories by session ID with user authorization validation.
  - `delete()`: Clears chat sessions, returning explicit boolean confirmation.
  - `list_sessions()`: Lists all sessions for a user ordered by last update.

### `backend/tokenvault.py`
- **Role**: Token logging and cost estimation analytics engine.
- **Key Functions**:
  - `log()`: Records every inference call with input tokens, output tokens, provider, and model.
  - `session_stats()`: Calculates total tokens, estimated USD cost, and tokens saved for a specific session.
  - `global_stats()`: Computes aggregate token metrics across all sessions.

### `backend/budget.py`
- **Role**: Token budget quota monitoring and alerts.
- **Key Functions**:
  - Checks user token usage against configured daily or monthly thresholds to prevent budget overruns.

### `backend/models.py`
- **Role**: Pydantic request and response schemas.
- **Key Classes**:
  - `ChatRequest`, `ChatResponse`, `PromptEngineerRequest`, `PromptEngineerResponse`, `KeyValidationRequest`, `RegisterRequest`, `LoginRequest`, `PhoneAuthRequest`, `ResetPasswordRequest`.

---

## 5. Frontend Directory & File-by-File Breakdown

### `frontend/index.html`
- **Role**: Main single-page application (SPA) layout for the chat workspace.
- **Structure**:
  - Sidebar: Session lists, new chat button, TokenVault metrics summary, user profile button.
  - Header: Active model selector (Claude, GPT, Gemini), temporal grounding status indicator, efficiency mode toggle (Low, Medium, High).
  - Main Area: Conversational stream container, message cards, code blocks with copy buttons, typing indicator orb canvas (`#typing-orb`).
  - Action Bar: Multi-modal file attachment upload, voice recording button, prompt input textarea, prompt optimization button, and send button.
  - Drawers & Modals: TokenVault full-screen drawer, Settings & API Key modal, Calendar widget modal, User Profile modal.

### `frontend/login.html`
- **Role**: Dedicated authentication portal.
- **Structure**:
  - Obsidian liquid-glass card with tab switcher for **Sign In** and **Sign Up**.
  - Form fields for Email, Password, Name, Date of Birth (Age restriction verification), and Mobile Number.
  - **Google One-Click OAuth** button.
  - **Firebase Phone OTP** modal with container for reCAPTCHA and 6-digit SMS verification code.
  - **Forgot Password / Reset OTP** flow drawer.

### `frontend/style.css`
- **Role**: Complete Obsidian Liquid-Glass Design System stylesheet.
- **Features**:
  - Root CSS variables for dark and light theme palettes (`--bg-primary`, `--surface-glass`, `--accent-glow`, `--text-primary`).
  - High-performance GPU-accelerated backdrop blur filters (`backdrop-filter: blur(24px)`).
  - Dynamic specular borders (`glassBorderRefract`) mimicking refraction optics on card edges.
  - Responsive layouts with flexbox and CSS grid adapting to mobile, tablet, and widescreen monitors.
  - Polished micro-animations: slide-in drawers, fading tooltips, pulse animations, and button hover states.

### `frontend/app.js`
- **Role**: Main workspace client-side controller.
- **Key Functions**:
  - `initApp()`: Checks authentication token; redirects to `login.html` if unauthenticated.
  - Dynamic API base routing: Automatically detects host port, using relative URLs in production and `:8000` during local dev.
  - Message rendering: Streams assistant responses, parsing Markdown using Marked.js and sanitizing through DOMPurify.
  - File upload handling: Encodes user-uploaded documents and images for multi-modal analysis.
  - HorizonX Orb: Animates canvas particle system reflecting LLM thinking states.
  - Prompt Engineering: Triggers optimization preview allowing users to inspect rewritten prompts before sending.

### `frontend/auth.js`
- **Role**: Authentication client-side controller.
- **Key Functions**:
  - Manages tab switching between Login, Registration, and Forgot Password.
  - Validates user input (email regex, password complexity, age validation).
  - Dispatches AJAX calls to `/auth/login`, `/auth/register`, and `/auth/forgot-password`.
  - Manages Firebase phone authentication lifecycle (reCAPTCHA rendering, SMS dispatch, code verification).
  - Handles theme toggling (Dark/Light mode) and saves preference to `localStorage`.

### `frontend/firebase_config.js`
- **Role**: Firebase Web Client configuration.
- **Key Functions**:
  - Initializes the Firebase JavaScript SDK with project configuration.
  - Exports auth instance for phone verification.

### `frontend/tb-calendar.js`
- **Role**: Liquid-glass interactive calendar and event scheduler widget.
- **Key Functions**:
  - Renders month/week/day calendar grid inside the workspace.
  - Integrates temporal synchronicity with user scheduling and notes.

---

## 6. Database Schema & Migration Pipeline

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    email             VARCHAR(150) NULL UNIQUE,
    password_hash     VARCHAR(255),
    google_id         VARCHAR(100),
    phone             VARCHAR(30)  NULL,
    dob               DATE         NULL,
    age               INT          NULL,
    subscription_tier VARCHAR(50)  DEFAULT 'Free',
    language          VARCHAR(20)  DEFAULT 'en',
    reset_token       VARCHAR(100),
    reset_expires     DATETIME,
    created_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    is_active         BOOLEAN      DEFAULT TRUE
);

-- 2. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    session_id  VARCHAR(150) NOT NULL,
    user_id     INT,
    messages    LONGTEXT     NOT NULL,
    provider    VARCHAR(50)  DEFAULT 'claude',
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Usage Log Table
CREATE TABLE IF NOT EXISTS usage_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    session_id  VARCHAR(150) NOT NULL,
    user_id     INT,
    provider    VARCHAR(50)  DEFAULT 'claude',
    tokens_used INT          NOT NULL,
    call_type   VARCHAR(50)  DEFAULT 'chat',
    logged_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id),
    INDEX idx_user_id    (user_id),
    INDEX idx_provider   (provider)
);

-- 4. TokenVault Analytics Table
CREATE TABLE IF NOT EXISTS tokenvault (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    session_id    VARCHAR(150) NOT NULL,
    user_id       INT,
    provider      VARCHAR(50)  NOT NULL,
    call_type     VARCHAR(50)  DEFAULT 'chat',
    input_tokens  INT          DEFAULT 0,
    output_tokens INT          DEFAULT 0,
    total_tokens  INT          DEFAULT 0,
    cost_usd      FLOAT        DEFAULT 0.0,
    tokens_saved  INT          DEFAULT 0,
    saving_source VARCHAR(50)  DEFAULT 'none',
    logged_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session  (session_id),
    INDEX idx_provider (provider),
    INDEX idx_user     (user_id)
);
```

---

## 7. Complete User Journey & Runtime Workflows

### 7.1 Authentication & Registration Flow
1. User visits `/login.html`.
2. Chooses **Email/Password**, **Google OAuth**, or **Phone OTP**.
3. For Email/Password:
   - Form checks minimum age requirement (18+).
   - Password is encrypted with Bcrypt.
   - An account record is written to MySQL.
   - Backend issues a signed JWT token containing `user_id`.
4. For Google OAuth:
   - User is redirected to Google Cloud Identity.
   - On consent, Google redirects to `/auth/google/callback`.
   - Backend links `google_id` and sets browser session token.
5. Client stores JWT in `localStorage` and redirects to the main chat workspace (`/`).

### 7.2 AI Inference & Prompt Engineering Flow
1. User types a prompt into `app.js` and optionally clicks **"Optimize Prompt"**.
2. If optimized, `backend/prompt_engineer.py` clarifies the prompt structure.
3. User selects their desired AI provider (Anthropic, OpenAI, or Google Gemini).
4. User clicks **Send**.

### 7.3 Real-Time Factual Grounding Flow
1. `backend/realtime_grounding.py` analyzes the prompt for temporal or real-time keywords ("today", "latest news", "Bitcoin price", "who won").
2. Fetches fresh live information via Google News RSS or CoinGecko APIs.
3. Injects a system header into the prompt context:
   `[Real-Time Context: Oct 6, 2026 | News: ...]`.

### 7.4 Token Optimization & Context Compression Flow
1. `backend/optimizer.py` checks total token volume of the conversation history.
2. If `< 2500 tokens`, messages are forwarded directly.
3. If `> 2500 tokens`, the earliest messages are summarized by an LLM pass into key points while the last 6 messages (`KEEP_LAST_N`) remain verbatim.
4. Tokens saved are calculated and logged into the `tokenvault` database table.

### 7.5 Automatic File Generation & Conversion Flow
1. If user requests a document (e.g., "Create a summary PDF" or "Generate an Excel budget sheet"):
2. Model outputs structured data payload.
3. `backend/file_generator.py` invokes ReportLab, `python-docx`, `openpyxl`, or `python-pptx`.
4. File is generated on the server and returned with a direct download link in the chat.

---

## 8. Production Deployment Architecture & Cloud Tools

TokenBridge is architected to run **100% free with zero monthly cost** and no credit card required:

```
+-----------------------------------------------------------------------------------+
|                                  Render.com (Free)                                |
|  - Web Service running Linux Docker container                                     |
|  - Automatic Git deployment from GitHub branch 'main'                             |
|  - Environment: Python 3.11.9 (pinned via .python-version)                        |
|  - Build Command: pip install -r requirements.txt                                 |
|  - Start Command: uvicorn backend.main:app --host 0.0.0.0 --port $PORT            |
|  - Automatic HTTPS SSL Certificate provided                                       |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Encrypted MySQL Protocol (Port 4000)
                                          v
+-----------------------------------------------------------------------------------+
|                             TiDB Cloud Serverless (Free)                          |
|  - 100% MySQL-compatible distributed relational database                          |
|  - 5 GB free storage forever (No credit card required)                            |
|  - Automated failover, multi-region clustering, and TLS encryption                |
+-----------------------------------------------------------------------------------+
```

### Deployment Configuration Files
- **`render.yaml`**: Infrastructure-as-code blueprint declaring service type, runtime, build command, and environment specifications for Render.
- **`Procfile`**: Process definition file specifying Uvicorn startup commands for container platforms.
- **`.python-version`**: Enforces Python `3.11.9` across all cloud builders.

---

## 9. Key Architectural Decisions & Rationale

| Decision | Alternative Considered | Rationale |
|---|---|---|
| **FastAPI Static Mount** | Separate Frontend (Vercel/Netlify) | Consolidates both frontend and backend into a single Web Service. Eliminates cross-origin CORS latency, simplifies environment variables, and enables 1-click free deployment. |
| **Vanilla JS & CSS3** | React / Next.js | Eliminates heavy build pipelines (`node_modules`, Webpack/Vite), prevents hydration lag, guarantees sub-second page loads, and yields long-term maintenance stability. |
| **TiDB Cloud Serverless** | Railway / Supabase | Railway now requires credit card subscriptions. TiDB Cloud offers 5 GB free MySQL hosting forever with zero credit card requirements. |
| **Stateless JWT Tokens** | Server-side Redis Sessions | Reduces server memory overhead and allows horizontal scaling without needing a centralized session cache. |
| **In-Memory History Compression** | Vector RAG Embeddings | RAG embeddings introduce query latency and database complexity. Rolling summary compression preserves full conversational flow and tone at near-zero compute cost. |

---

## 10. Future Scope & Roadmap

1. **Multi-Agent Orchestration**: Enable autonomous AI agent pipelines where Claude drafts content, OpenAI reviews logic, and Gemini performs factual validation concurrently.
2. **End-to-End Encrypted Checkpoints**: Encrypt chat session histories with user-derived client keys before writing to the database (Zero-Knowledge Architecture).
3. **Voice-to-Voice Streaming**: Integrate real-time WebRTC audio streaming for hands-free conversational voice dialogues.
4. **Custom Workspace Plugins**: Provide an extension marketplace allowing users to integrate Notion, Google Drive, and GitHub directly into the chat interface.
5. **Local LLM Interoperability**: Add native connectors for Ollama and vLLM for running private models on local hardware.
