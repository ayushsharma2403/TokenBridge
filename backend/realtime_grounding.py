import urllib.request
import urllib.parse
import json
import re
from datetime import datetime
from typing import Optional, List, Dict


TEMPORAL_KEYWORDS = [
    "latest", "today", "current", "news", "now", "recent", "recently", 
    "price", "weather", "stock", "update", "updates", "who is", "what is happening",
    "2025", "2026", "this year", "this month", "current time", "current date"
]


def needs_realtime_context(query: str) -> bool:
    """Determine if a query asks for current, real-time, or temporal information."""
    if not query:
        return False
    q = query.lower()
    return any(keyword in q for keyword in TEMPORAL_KEYWORDS)


def get_current_temporal_anchor() -> str:
    """Returns dynamic temporal anchor based on local/system time."""
    now = datetime.now()
    date_str = now.strftime("%A, %B %d, %Y")
    time_str = now.strftime("%I:%M %p")
    year_str = str(now.year)
    return (
        f"TEMPORAL GROUNDING & CURRENT TIME:\n"
        f"- Current Date: {date_str}\n"
        f"- Current Time: {time_str}\n"
        f"- Current Year: {year_str}\n"
        f"- You must always answer from the perspective of {year_str} as the current present year.\n"
        f"- Do NOT state that your knowledge cut off is in past years when asked about current dates or time."
    )


def fetch_news_rss(query: str, max_items: int = 4) -> List[str]:
    """Fetch live news from Google News RSS search."""
    try:
        clean_q = re.sub(r'[^a-zA-Z0-9\s]', '', query).strip()
        if not clean_q:
            clean_q = "latest news"
        url = "https://news.google.com/rss/search?q=" + urllib.parse.quote(clean_q) + "&hl=en-US&gl=US&ceid=US:en"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=4) as response:
            xml = response.read().decode("utf-8", errors="ignore")
            # Extract item titles and pubDates
            items = re.findall(r'<item>.*?<title>(.*?)</title>.*?<pubDate>(.*?)</pubDate>', xml, re.DOTALL)
            results = []
            for title, pub_date in items[:max_items]:
                # unescape html entities if any
                clean_title = title.replace("&quot;", '"').replace("&amp;", "&").replace("&#39;", "'")
                results.append(f"• {clean_title} ({pub_date})")
            return results
    except Exception:
        return []


def fetch_wiki_summary(query: str) -> Optional[str]:
    """Fetch factual background or entity extract from Wikipedia API."""
    try:
        clean_q = re.sub(r'^(who is|what is|tell me about|explain|who was|who currently is)\s+', '', query, flags=re.IGNORECASE).strip()
        if not clean_q:
            clean_q = query
        # 1. Search for title
        search_url = (
            "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="
            + urllib.parse.quote(clean_q)
            + "&format=json"
        )
        req = urllib.request.Request(search_url, headers={"User-Agent": "TokenBridgeBot/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
            search_results = data.get("query", {}).get("search", [])
            if not search_results:
                return None
            top_title = search_results[0].get("title")

        # 2. Get extract
        extract_url = (
            "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles="
            + urllib.parse.quote(top_title)
            + "&format=json"
        )
        req2 = urllib.request.Request(extract_url, headers={"User-Agent": "TokenBridgeBot/1.0"})
        with urllib.request.urlopen(req2, timeout=4) as res2:
            data2 = json.loads(res2.read().decode("utf-8"))
            pages = data2.get("query", {}).get("pages", {})
            for page_id, page_info in pages.items():
                extract = page_info.get("extract", "")
                if extract:
                    return f"**{top_title} (Overview)**: {extract[:600]}..."
    except Exception:
        pass
    return None


def fetch_crypto_price(query: str) -> Optional[str]:
    """Fetch live crypto price if queried."""
    q = query.lower()
    crypto_map = {
        "bitcoin": "bitcoin",
        "btc": "bitcoin",
        "ethereum": "ethereum",
        "eth": "ethereum",
        "solana": "solana",
        "sol": "solana"
    }
    found = [cid for key, cid in crypto_map.items() if key in q]
    if not found:
        return None
    try:
        ids = ",".join(list(set(found))[:3])
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={ids}&vs_currencies=usd"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            lines = [f"{coin.title()}: ${val.get('usd'):,}" for coin, val in data.items()]
            return "Live Crypto Prices: " + ", ".join(lines)
    except Exception:
        pass
    return None


def get_realtime_context(user_query: str) -> str:
    """
    Assembles real-time context snippets (news, wiki, prices, current date/time)
    to inject into the LLM prompt when latest data is required.
    """
    snippets = []
    
    # Check crypto
    crypto_data = fetch_crypto_price(user_query)
    if crypto_data:
        snippets.append(crypto_data)

    # Check news or search query if temporal keywords present
    if any(k in user_query.lower() for k in ["news", "latest", "update", "happening", "today", "recent"]):
        news_items = fetch_news_rss(user_query, max_items=4)
        if news_items:
            snippets.append("Latest News Headings:\n" + "\n".join(news_items))

    # Wikipedia extract for entity lookups
    if any(k in user_query.lower() for k in ["who is", "who are", "what is", "president", "prime minister", "ceo"]):
        wiki_info = fetch_wiki_summary(user_query)
        if wiki_info:
            snippets.append(wiki_info)

    if not snippets:
        # Fallback to general latest headlines if user simply asks 'what is the latest news' or 'latest updates'
        if any(k in user_query.lower() for k in ["news", "latest", "what is new"]):
            general_news = fetch_news_rss("world news", max_items=3)
            if general_news:
                snippets.append("Latest Live Headlines:\n" + "\n".join(general_news))

    return "\n\n".join(snippets)
