FROM python:3.11-slim

# All necessary dependencies explicitly added
RUN apt-get update && apt-get install -y \
    wget curl gnupg unzip xvfb libxi6 libgconf-2-4 \
    libgtk-3-0 libxss1 libasound2 fonts-liberation \
    libnss3 libnspr4 libatk-bridge2.0-0 libxkbcommon0 \
    libgbm1 libu2f-udev libvulkan1 xdg-utils

# Install Google Chrome explicitly (Stable)
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && dpkg -i google-chrome-stable_current_amd64.deb || apt-get -f install -y \
 && rm google-chrome-stable_current_amd64.deb

# Explicitly install correct matching ChromeDriver
ENV CHROME_DRIVER_VERSION=136.0.7103.0

RUN wget -q https://storage.googleapis.com/chrome-for-testing-public/${CHROME_DRIVER_VERSION}/linux64/chromedriver-linux64.zip \
    && unzip chromedriver-linux64.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/chromedriver-linux64/chromedriver \
    && ln -s /usr/local/bin/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver \
    && rm chromedriver-linux64.zip

# Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

WORKDIR /app
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]