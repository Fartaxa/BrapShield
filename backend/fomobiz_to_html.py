import csv
import json
import time
import os
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import NoSuchElementException, TimeoutException, WebDriverException

def create_driver():
    """Create a new Chrome driver instance"""
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    return driver

def safe_find_element(driver, by, value, wait_time=5):
    """Safely find an element with timeout"""
    try:
        element = WebDriverWait(driver, wait_time).until(
            EC.presence_of_element_located((by, value))
        )
        return element
    except (TimeoutException, NoSuchElementException):
        return None

def extract_token_data(driver, url):
    """Extract comprehensive token data from the page"""
    token_info = {'url': url}
    
    try:
        # Wait for the main container to load
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.CLASS_NAME, '_tokenInfoContainer_z5b78_1')))
        
        # Extract token name and ticker
        token_name_element = safe_find_element(driver, By.CLASS_NAME, '_tokenName_z5b78_38')
        if token_name_element:
            full_name = token_name_element.text
            # Extract name and ticker separately
            if '(' in full_name and ')' in full_name:
                name_part = full_name.split('(')[0].strip()
                ticker_part = full_name.split('(')[1].replace(')', '').strip()
                token_info['name'] = name_part
                token_info['ticker'] = ticker_part
            else:
                token_info['name'] = full_name
                ticker_element = safe_find_element(driver, By.CLASS_NAME, '_ticker_z5b78_46')
                token_info['ticker'] = ticker_element.text.strip() if ticker_element else 'Unknown'
        else:
            token_info['name'] = 'Unknown'
            token_info['ticker'] = 'Unknown'
        
        # Extract logo URL
        logo_element = safe_find_element(driver, By.CSS_SELECTOR, 'img._tokenMedia_z5b78_23')
        token_info['logo_url'] = logo_element.get_attribute('src') if logo_element else 'Unknown'
        
        # Extract creator information
        creator_element = safe_find_element(driver, By.CLASS_NAME, '_creatorAddress_z5b78_60')
        if creator_element:
            token_info['creator_link'] = creator_element.get_attribute('href')
            token_info['creator_address'] = token_info['creator_link'].split('/')[-1]
            token_info['creator_name'] = creator_element.text.strip()
            
            # Get creator title attribute for full info
            creator_title = creator_element.get_attribute('title')
            if creator_title:
                token_info['creator_title'] = creator_title
        else:
            token_info['creator_address'] = 'Unknown'
            token_info['creator_link'] = 'Unknown'
            token_info['creator_name'] = 'Unknown'
            token_info['creator_title'] = 'Unknown'
        
        # Extract creator avatar
        creator_avatar_element = safe_find_element(driver, By.CSS_SELECTOR, '._userAvatar_z5b78_174 img')
        token_info['creator_avatar_url'] = creator_avatar_element.get_attribute('src') if creator_avatar_element else 'Unknown'
        
        # Extract creation time
        time_elements = driver.find_elements(By.CSS_SELECTOR, '._metaInfo_z5b78_51 span[title]')
        for time_element in time_elements:
            creation_time_str = time_element.get_attribute('title')
            if creation_time_str and '/' in creation_time_str:
                try:
                    creation_date = datetime.strptime(creation_time_str, "%d/%m/%Y, %H:%M:%S")
                    token_info['creation_date'] = creation_date.strftime("%Y-%m-%d %H:%M:%S")
                    token_info['creation_date_raw'] = creation_time_str
                    token_info['age'] = time_element.text.strip()
                    break
                except:
                    pass
        
        if 'creation_date' not in token_info:
            token_info['creation_date'] = 'Unknown'
            token_info['creation_date_raw'] = 'Unknown'
            token_info['age'] = 'Unknown'
        
        # Extract token stats
        stat_items = driver.find_elements(By.CLASS_NAME, '_statItem_z5b78_81')
        for stat_item in stat_items:
            label_element = stat_item.find_element(By.CLASS_NAME, '_statLabel_z5b78_90')
            value_element = stat_item.find_element(By.CLASS_NAME, '_statValue_z5b78_97')
            
            label = label_element.text.strip().lower()
            value = value_element.text.strip()
            
            if label == 'mc':
                token_info['market_cap'] = value
            elif label == 'supply':
                token_info['supply'] = value
            elif label == 'replies':
                token_info['replies'] = value
        
        # Extract description
        description_element = safe_find_element(driver, By.CLASS_NAME, '_tokenDescription_z5b78_105')
        token_info['description'] = description_element.text.strip() if description_element else 'Unknown'
        
        return token_info
        
    except Exception as e:
        token_info['error'] = str(e)[:200]
        return token_info

def main():
    # Load meme URLs
    with open("meme_urls.json", "r") as file:
        meme_urls = json.load(file)
    
    # Initialize driver
    driver = create_driver()
    tokens_data = []
    
    # Process each URL
    for idx, url in enumerate(meme_urls):
        try:
            driver.get(url)
            time.sleep(2)  # Allow page to load
            
            token_info = extract_token_data(driver, url)
            tokens_data.append(token_info)
            
            print(f"[{idx + 1}/{len(meme_urls)}] ✅ Extracted: {token_info.get('name', 'Unknown')} ({token_info.get('ticker', 'Unknown')})")
            
        except Exception as e:
            print(f"[{idx + 1}/{len(meme_urls)}] ❌ Error processing {url}: {str(e)[:100]}")
            tokens_data.append({'url': url, 'error': str(e)[:200]})
            
            # Restart driver on error
            try:
                driver.quit()
            except:
                pass
            driver = create_driver()
        
        time.sleep(1)  # Rate limiting
    
    # Save detailed token data
    with open("fomo_tokens_comprehensive.csv", "w", newline='', encoding='utf-8') as csvfile:
        fieldnames = ['name', 'ticker', 'creator_name', 'creator_address', 'creator_link', 
                      'creator_title', 'creator_avatar_url', 'logo_url', 'market_cap', 
                      'supply', 'replies', 'creation_date', 'creation_date_raw', 'age', 
                      'description', 'url', 'error']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for token in tokens_data:
            writer.writerow(token)
    
    # Create creator summary with comprehensive data
    from collections import defaultdict
    creator_summary = defaultdict(lambda: {
        'tokens': [], 
        'count': 0, 
        'total_market_cap': 0,
        'total_replies': 0,
        'creator_name': '',
        'creator_avatar_url': ''
    })
    
    for token in tokens_data:
        if 'creator_address' in token and token['creator_address'] != 'Unknown':
            creator = creator_summary[token['creator_address']]
            creator['tokens'].append(token)
            creator['count'] += 1
            
            # Set creator name and avatar
            if not creator['creator_name'] and token.get('creator_name'):
                creator['creator_name'] = token['creator_name']
                creator['creator_avatar_url'] = token.get('creator_avatar_url', '')
            
            # Calculate totals
            if 'market_cap' in token and token['market_cap'] != 'Unknown':
                try:
                    cap_str = token['market_cap'].replace('$', '').replace(',', '')
                    if 'K' in cap_str:
                        cap_value = float(cap_str.replace('K', '')) * 1000
                    elif 'M' in cap_str:
                        cap_value = float(cap_str.replace('M', '')) * 1000000
                    else:
                        cap_value = float(cap_str)
                    creator['total_market_cap'] += cap_value
                except:
                    pass
            
            if 'replies' in token and token['replies'] != 'Unknown':
                try:
                    creator['total_replies'] += int(token['replies'])
                except:
                    pass
    
    # Write comprehensive creator summary
    with open("creator_summary_comprehensive.csv", "w", newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['Creator Name', 'Creator Address', 'Number of Tokens', 'Token Names/Tickers', 
                        'Total Market Cap', 'Total Replies', 'First Token Date', 'Latest Token Date', 
                        'Creator Avatar URL', 'All Token Links'])
        
        for address, data in sorted(creator_summary.items(), key=lambda x: x[1]['count'], reverse=True):
            tokens = data['tokens']
            token_names = [f"{t.get('name', 'Unknown')} ({t.get('ticker', 'Unknown')})" for t in tokens]
            
            # Format total market cap
            if data['total_market_cap'] > 1000000:
                total_cap_str = f"${data['total_market_cap']/1000000:.2f}M"
            elif data['total_market_cap'] > 1000:
                total_cap_str = f"${data['total_market_cap']/1000:.2f}K"
            else:
                total_cap_str = f"${data['total_market_cap']:.2f}" if data['total_market_cap'] > 0 else "Unknown"
            
            # Get first and latest token dates
            dates = [t['creation_date'] for t in tokens if t.get('creation_date') and t['creation_date'] not in ["Unknown", "Parse Error"]]
            if dates:
                first_date = min(dates)
                latest_date = max(dates)
            else:
                first_date = "Unknown"
                latest_date = "Unknown"
            
            # Create hyperlinks for all tokens
            token_links = []
            for t in tokens:
                ticker = t.get('ticker', 'Unknown')
                url = t.get('url', '#')
                # Create hyperlink format: "TICKER (link)"
                token_links.append(f'{ticker} ({url})')
            
            writer.writerow([
                data['creator_name'],
                address,
                data['count'],
                "; ".join(token_names),
                total_cap_str,
                data['total_replies'],
                first_date,
                latest_date,
                data['creator_avatar_url'],
                "; ".join(token_links)  # All token links in one cell
            ])
    
    # Create an HTML version for better hyperlink visualization
    with open("creator_summary_with_links.html", "w", encoding='utf-8') as htmlfile:
        htmlfile.write("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Fomo.biz Creator Summary</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4CAF50; color: white; }
                tr:nth-child(even) { background-color: #f2f2f2; }
                tr:hover { background-color: #ddd; }
                .token-links { max-width: 300px; overflow-x: auto; white-space: nowrap; }
                .token-link { margin-right: 10px; }
                .avatar { width: 40px; height: 40px; border-radius: 20px; }
            </style>
        </head>
        <body>
            <h1>Fomo.biz Creator Summary</h1>
            <table>
                <tr>
                    <th>Avatar</th>
                    <th>Creator</th>
                    <th>Address</th>
                    <th>Tokens</th>
                    <th>All Tokens</th>
                    <th>Total MC</th>
                    <th>Replies</th>
                    <th>First Token</th>
                    <th>Latest Token</th>
                </tr>
        """)
        
        for address, data in sorted(creator_summary.items(), key=lambda x: x[1]['count'], reverse=True):
            tokens = data['tokens']
            
            # Format market cap
            if data['total_market_cap'] > 1000000:
                total_cap_str = f"${data['total_market_cap']/1000000:.2f}M"
            elif data['total_market_cap'] > 1000:
                total_cap_str = f"${data['total_market_cap']/1000:.2f}K"
            else:
                total_cap_str = f"${data['total_market_cap']:.2f}" if data['total_market_cap'] > 0 else "Unknown"
            
            # Get dates
            dates = [t['creation_date'] for t in tokens if t.get('creation_date') and t['creation_date'] not in ["Unknown", "Parse Error"]]
            first_date = min(dates) if dates else "Unknown"
            latest_date = max(dates) if dates else "Unknown"
            
            # Create token links
            token_links_html = []
            for t in tokens:
                ticker = t.get('ticker', 'Unknown')
                url = t.get('url', '#')
                token_links_html.append(f'<a href="{url}" target="_blank" class="token-link">{ticker}</a>')
            
            # Avatar
            avatar_html = f'<img src="{data["creator_avatar_url"]}" class="avatar" alt="{data["creator_name"]}">' if data['creator_avatar_url'] and data['creator_avatar_url'] != 'Unknown' else ''
            
            htmlfile.write(f"""
                <tr>
                    <td>{avatar_html}</td>
                    <td>{data['creator_name']}</td>
                    <td>{address}</td>
                    <td>{data['count']}</td>
                    <td class="token-links">{''.join(token_links_html)}</td>
                    <td>{total_cap_str}</td>
                    <td>{data['total_replies']}</td>
                    <td>{first_date}</td>
                    <td>{latest_date}</td>
                </tr>
            """)
        
        htmlfile.write("""
            </table>
        </body>
        </html>
        """)
    
    print(f"\n✅ Finished! Total tokens processed: {len(tokens_data)}")
    print(f"Unique creators: {len(creator_summary)}")
    print(f"Successful extractions: {len([t for t in tokens_data if 'error' not in t])}")
    print(f"Failed extractions: {len([t for t in tokens_data if 'error' in t])}")
    
    print("\nTop 5 most active creators:")
    for address, data in sorted(creator_summary.items(), key=lambda x: x[1]['count'], reverse=True)[:5]:
        print(f"{data['creator_name']} ({address}): {data['count']} tokens")
    
    print("\nFiles created:")
    print("1. fomo_tokens_comprehensive.csv - All token data")
    print("2. creator_summary_comprehensive.csv - Summary with token links")
    print("3. creator_summary_with_links.html - Interactive HTML with clickable links")
    
    try:
        driver.quit()
    except:
        pass

if __name__ == "__main__":
    main()