FROM python:3.11-slim

# Essential dependencies including curl
RUN apt-get update && apt-get install -y \
    wget curl gnupg unzip xvfb libxi6 libgconf-2-4 \
    libgtk-3-0 libxss1 libasound2 fonts-liberation \
    libnss3 libnspr4 libatk-bridge2.0-0 libxkbcommon0 libgbm1 libu2f-udev

# Install stable Google Chrome explicitly
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && dpkg -i google-chrome-stable_current_amd64.deb || apt-get -f install -y \
 && rm google-chrome-stable_current_amd64.deb

# Install stable ChromeDriver explicitly (matching Chrome version above)
ENV CHROME_DRIVER_VERSION=124.0.6367.91

RUN wget -q https://chromedriver.storage.googleapis.com/${CHROME_DRIVER_VERSION}/chromedriver_linux64.zip \
    && unzip chromedriver_linux64.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver \
    && rm chromedriver_linux64.zip

# Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]