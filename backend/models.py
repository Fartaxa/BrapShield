from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./fomo.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Token(Base):
    __tablename__ = "tokens"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    ticker = Column(String)
    url = Column(String, unique=True)
    logo_url = Column(String)
    creator_address = Column(String)
    creator_name = Column(String)
    creator_avatar_url = Column(String)
    creation_date = Column(String)
    market_cap = Column(Float, default=0.0)
    comments = Column(Integer, default=0)

class ScrapedURL(Base):
    __tablename__ = "scraped_urls"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True)

Base.metadata.create_all(bind=engine)