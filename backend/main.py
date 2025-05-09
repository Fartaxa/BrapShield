from fastapi.middleware.cors import CORSMiddleware

# Existing imports here
from fastapi import FastAPI
from models import SessionLocal, Token
from fastapi.responses import JSONResponse
from sqlalchemy import func, asc, desc
from datetime import datetime, timedelta

app = FastAPI()

# Explicitly add CORS middleware immediately after app creation:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # explicitly allowing all origins for now (can be restricted later)
    allow_credentials=True,
    allow_methods=["*"],  # explicitly allowing all HTTP methods
    allow_headers=["*"],  # explicitly allowing all headers
)

@app.get("/api/v1/stats")
def get_stats():
    db = SessionLocal()
    total_creators = db.query(func.count(func.distinct(Token.creator_address))).scalar()
    total_tokens = db.query(func.count(Token.id)).scalar()
    total_market_cap = db.query(func.sum(Token.market_cap)).scalar()

    # explicitly count new tokens from last 24 hours
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    new_today = db.query(func.count(Token.id)).filter(
        Token.creation_date >= twenty_four_hours_ago.strftime("%Y-%m-%d %H:%M:%S")
    ).scalar()

    db.close()

    return {
        "total_creators": total_creators,
        "total_tokens": total_tokens,
        "total_market_cap": total_market_cap,
        "new_today": new_today
    }

@app.get("/api/v1/creators")
def get_creators(sort_by: str = "token_count", order: str = "desc"):
    db = SessionLocal()

    creators_query = db.query(
        Token.creator_address,
        func.count(Token.creator_address).label('token_count'),
        func.sum(Token.market_cap).label('total_market_cap'),
        func.max(Token.creation_date).label('latest_token_date'),
        func.min(Token.creation_date).label('first_token_date')
    ).group_by(Token.creator_address)

    if sort_by == "token_count":
        creators_query = creators_query.order_by(desc('token_count') if order == 'desc' else asc('token_count'))
    elif sort_by == "total_market_cap":
        creators_query = creators_query.order_by(desc('total_market_cap') if order == 'desc' else asc('total_market_cap'))
    elif sort_by == "latest_token_date":
        creators_query = creators_query.order_by(desc('latest_token_date') if order == 'desc' else asc('latest_token_date'))
    elif sort_by == "first_token_date":
        creators_query = creators_query.order_by(desc('first_token_date') if order == 'desc' else asc('first_token_date'))

    creators = creators_query.all()

    creators_list = []
    for creator in creators:
        tokens = db.query(Token).filter(Token.creator_address == creator.creator_address).all()
        total_replies = sum(token.comments for token in tokens)
        creators_list.append({
            "creator_address": creator.creator_address,
            "token_count": creator.token_count,
            "total_market_cap": creator.total_market_cap,
            "total_replies": total_replies,
            "first_token_date": creator.first_token_date,
            "latest_token_date": creator.latest_token_date
        })

    db.close()
    return creators_list

# Explicitly defined /tokens endpoint as you asked for
@app.get("/api/v1/tokens")
def tokens_api_v1():
    db = SessionLocal()
    tokens = db.query(Token).all()

    tokens_list = [{
        "name": token.name,
        "ticker": token.ticker,
        "url": token.url,
        "logo_url": token.logo_url,
        "creator_address": token.creator_address,
        "creator_name": token.creator_name,
        "creator_avatar_url": token.creator_avatar_url,
        "creation_date": token.creation_date,
        "market_cap": token.market_cap,
        "comments": token.comments
    } for token in tokens]

    db.close()
    return JSONResponse(tokens_list)

@app.get("/api/v1/stats/history")
def get_historical_stats():
    db = SessionLocal()
    tokens = db.query(Token).all()

    historical = {}
    for token in tokens:
        date = token.creation_date.split(' ')[0]
        if date not in historical:
            historical[date] = {
                "creators": set(),
                "tokens": 0,
                "market_cap": 0,
                "new_tokens": 0
            }
        historical[date]["creators"].add(token.creator_address)
        historical[date]["tokens"] += 1
        historical[date]["market_cap"] += token.market_cap
        historical[date]["new_tokens"] += 1

    sorted_dates = sorted(historical.keys())
    data = []
    cumulative_creators = set()
    cumulative_tokens = 0
    cumulative_market_cap = 0

    for date in sorted_dates:
        daily_data = historical[date]
        cumulative_creators.update(daily_data["creators"])
        cumulative_tokens += daily_data["tokens"]
        cumulative_market_cap = daily_data["market_cap"]

        data.append({
            "date": date,
            "total_creators": len(cumulative_creators),
            "total_tokens": cumulative_tokens,
            "market_cap": cumulative_market_cap,
            "new_tokens": daily_data["new_tokens"]
        })

    db.close()
    return data


import threading
from scraper import scrape_and_update
import time

def run_periodic_scraper():
    while True:
        print("🚀 Explicitly starting scraper.")
        scrape_and_update()  # Waits explicitly until this completes entirely
        print("✅ Scraper explicitly finished.")
        print("⏳ Explicitly waiting 30 seconds before next scrape.")
        time.sleep(30)  # Explicitly waits 30 seconds after scraping finishes

@app.on_event("startup")
async def startup_event():
    threading.Thread(target=run_periodic_scraper, daemon=True).start()