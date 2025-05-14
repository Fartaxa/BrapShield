FROM python:3.11-slim

# Essential dependencies for Chrome headless and ChromeDriver
RUN apt-get update && apt-get install -y \
    wget gnupg unzip xvfb libxi6 libgconf-2-4 \
    libgtk-3-0 libxss1 libasound2 fonts-liberation \
    libnss3 libnspr4 libatk-bridge2.0-0 libxkbcommon0 libgbm1 libu2f-udev

# Install Google Chrome (stable)
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && dpkg -i google-chrome-stable_current_amd64.deb || apt-get -f install -y

# Explicitly install matching ChromeDriver
RUN CHROME_VERSION=$(google-chrome --version | grep -o '[0-9.]*' | head -n1) \
 && CHROMEDRIVER_VERSION=$(curl -s "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}") \
 && wget -q https://chromedriver.storage.googleapis.com/${CHROMEDRIVER_VERSION}/chromedriver_linux64.zip \
 && unzip chromedriver_linux64.zip -d /usr/local/bin/ \
 && chmod +x /usr/local/bin/chromedriver

# Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]