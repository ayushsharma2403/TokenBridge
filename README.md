# TokenBridge

A token-efficient AI proxy for students and developers.

## What it does

- Prompt Engineering: rewrites raw prompts to save tokens
- Context Compression: summarizes history to cut usage 40-70 percent
- Checkpoint System: saves sessions to MySQL for resume
- TokenVault: tracks token usage and cost per provider
- Multi-Provider: Claude, OpenAI, Google Gemini
- Authentication: email, Google OAuth, Firebase Phone OTP

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, FastAPI |
| Database | MySQL 8.0 |
| Auth | JWT, Google OAuth, Firebase |
| AI | Claude, OpenAI, Gemini |
| Frontend | HTML, CSS, JavaScript |

## Setup

1. Clone the repo
2. Create venv and install requirements
3. Create MySQL database: CREATE DATABASE tokenbridge;
4. Copy .env.example to .env and fill in credentials
5. Run: python test_connection.py
6. Start backend: cd backend && python main.py
7. Start frontend: cd frontend && python -m http.server 5500
8. Open: http://localhost:5500/login.html

## Built by

Ayush Sharma - B.Tech CSE AI, AKTU, Graduating August 2026
