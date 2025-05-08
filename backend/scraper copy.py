import logging
import json
from models import SessionLocal, Token, ScrapedURL
from fomobiz_to_html import create_driver, extract_token_data
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

logging.basicConfig(level=logging.INFO)

def infinite_scroll(driver, pause_time=2, max_scrolls=30):
    last_height = driver.execute_script("return document.body.scrollHeight")
    for _ in range(max_scrolls):
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(pause_time)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height

def extract_and_save_token_links(filename="token_urls.json"):
    driver = create_driver()
    driver.get('https://fomo.biz')  # Explicitly navigate to the correct URL
    infinite_scroll(driver)
    links = driver.find_elements(By.CSS_SELECTOR, 'a[href*="/token/"]')
    urls = list(set([link.get_attribute('href') for link in links]))
    with open(filename, 'w') as f:
        json.dump(urls, f)
    logging.info(f"Saved {len(urls)} token URLs to {filename}")
    driver.quit()
    return urls

def load_token_links(filename="token_urls.json"):
    with open(filename, 'r') as f:
        urls = json.load(f)
    logging.info(f"Loaded {len(urls)} token URLs from {filename}")
    return urls

def scrape_and_update():
    logging.info("Starting scrape_and_update")

    extract_and_save_token_links()

    db = SessionLocal()
    token_links = load_token_links()
    scraped_urls = set(url.url for url in db.query(ScrapedURL.url).all())
    new_links = [link for link in token_links if link not in scraped_urls]

    logging.info(f"{len(new_links)} new tokens to scrape this round.")

    driver = create_driver()
    wait = WebDriverWait(driver, 20)

    for idx, link in enumerate(new_links, start=1):
        logging.info(f"Scraping token {idx}/{len(new_links)}: {link}")
        successful_scrape = False

        for attempt in range(2):
            try:
                driver.get(link)
                wait.until(EC.presence_of_element_located((By.CLASS_NAME, '_tokenInfoContainer_z5b78_1')))
                token_info = extract_token_data(driver, link)

                if token_info and token_info.get('name') != 'Unknown':
                    successful_scrape = True
                    break
                else:
                    logging.warning(f"[Retry {attempt + 1}/2] incomplete data for {link}, retrying after delay...")
                    time.sleep(3)
            except Exception as e:
                logging.error(f"Error scraping {link}: {e}")
                time.sleep(3)

        if not successful_scrape:
            logging.error(f"Completely failed to scrape {link} after retries, skipping.")
            continue

        try:
            token = Token(
                name=token_info['name'],
                ticker=token_info.get('ticker', 'Unknown'),
                url=token_info.get('url', link),
                logo_url=token_info.get('logo_url', 'Unknown'),
                creator_address=token_info.get('creator_address', 'Unknown'),
                creator_name=token_info.get('creator_name', 'Unknown'),
                creator_avatar_url=token_info.get('creator_avatar_url', 'Unknown'),
                creation_date=token_info.get('creation_date', 'Unknown'),
                market_cap=float(token_info.get('market_cap', '0').replace('$','').replace(',','')),
                comments=int(token_info.get('replies', '0'))
            )
            db.add(token)
            db.add(ScrapedURL(url=link))
            logging.info(f"Added new token: {token.ticker}")
        except Exception as e:
            logging.error(f"Unexpected error adding token {link}: {e}, data: {token_info}")

    driver.quit()
    db.commit()
    db.close()
    logging.info("Scraping completed and data committed.")