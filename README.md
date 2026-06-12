# 🔗 TokenBridge

A token-efficient AI proxy that helps students and developers get more out of their free API credits. TokenBridge compresses conversation history to save tokens and automatically checkpoints your session so you can resume right where you left off — even after your credits run out.

---

## The problem it solves

When you use Claude or OpenAI's API, every message you send includes the **entire conversation history**. A 30-message chat might burn 4,000 tokens just to send one reply. TokenBridge:

- Summarizes old messages to reduce token usage by 40–70%
- Tracks your token budget in real time
- Saves a checkpoint when you're low on credits
- Lets you resume from that exact point whenever you top up

---

## Tech stack

| Layer    | Technology                       |
|----------|----------------------------------|
| Backend  | Python, FastAPI, Uvicorn         |
| AI       | Anthropic Claude / OpenAI GPT    |
| Database | SQLite (via Python's built-in)   |
| Frontend | HTML, CSS, Vanilla JS            |

---

## Setup

**1. Clone the repo**
```bash
git clone https://github.com/YOUR_USERNAME/TokenBridge.git
cd TokenBridge
```

**2. Create a virtual environment**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Mac / Linux
source venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Add your API keys**
```bash
# Copy the example file
cp .env.example .env

# Then open .env and paste in your API key
```

**5. Run the server**
```bash
cd backend
python main.py
```

The API will be live at `http://localhost:8000`

---

## How to get API keys (free)

- **Claude (Anthropic):** Sign up at [console.anthropic.com](https://console.anthropic.com) → new accounts get $5 free credit
- **OpenAI:** Sign up at [platform.openai.com](https://platform.openai.com) → new accounts get free trial credits

---

## API endpoints

| Method | Endpoint              | What it does                              |
|--------|-----------------------|-------------------------------------------|
| POST   | `/chat`               | Send a message (auto-optimizes history)   |
| GET    | `/session/{id}`       | Load a saved checkpoint                   |
| GET    | `/usage/{id}`         | Check token usage and remaining budget    |
| DELETE | `/session/{id}`       | Clear a session and start fresh           |

Full interactive docs: `http://localhost:8000/docs`

---

## Project structure

```
TokenBridge/
├── backend/
│   ├── main.py         ← FastAPI server & all routes
│   ├── database.py     ← SQLite setup and connection
│   ├── checkpoint.py   ← Save / load conversation state
│   ├── budget.py       ← Token usage tracking
│   ├── optimizer.py    ← Conversation compression logic
│   └── router.py       ← Routes requests to Claude / OpenAI
├── frontend/           ← Chat UI (Phase 5)
├── requirements.txt
├── .env.example
└── README.md
```

---

## Roadmap

- [x] Phase 1 — Project setup & structure
- [x] Phase 2 — Core FastAPI backend
- [x] Phase 3 — Token optimizer (compression + summarization)
- [x] Phase 4 — Checkpoint engine (save / resume)
- [ ] Phase 5 — Frontend chat UI
- [ ] Phase 6 — Multi-provider support (Gemini)
- [ ] Phase 7 — Deployment on Railway

---

## Built by

Ayush — CSE (AI) student, AKTU · Graduating August 2026  
Contact: ayush240304@gmail.com
