import requests
from bs4 import BeautifulSoup
import re
import json

def format_id(name):
    if name == "A&W":
        return "aw"
    words = re.sub(r'[^a-zA-Z0-9\s]', '', name).strip().split()
    if not words:
        return "unknown"
    return words[0].lower() + ''.join(word.capitalize() for word in words[1:])

def scrape_birthday_freebies(url):
    try:
        response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching URL: {e}")
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    rows = soup.select('tr.post-row')
    print(f"Found {len(rows)} rows")

    entries = []

    for i, row in enumerate(rows):
        tds = row.find_all('td')
        if not tds or len(tds) < 1:
            continue

        name = tds[0].get_text(strip=True)
        link_tag = row.select_one('a.birthday-signup-button')
        signup_url = link_tag['href'] if link_tag and link_tag.has_attr('href') else None

        if name and signup_url:
            entries.append({
                'id': format_id(name),
                'name': name,
                'signupUrl': signup_url,
                'isCustom': False,
                'selectors': {}
            })
        else:
            print(f"❌ Skipping row {row.get('id')} - name: {name}, url: {signup_url}")

    return entries

if __name__ == "__main__":
    target_url = "https://www.heyitsfree.net/birthday-freebies/"
    data = scrape_birthday_freebies(target_url)

    with open("webscrapedRetailers.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"\n✅ Exported {len(data)} entries to webscrapedRetailers.json")
