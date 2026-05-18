import urllib.request
import urllib.parse
import json
import os
import time
import xml.etree.ElementTree as ET

# API Key Loader
def get_api_key(service):
    try:
        with open('api_key.txt', 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                if line.strip() == service:
                    return lines[i+1].strip()
    except FileNotFoundError:
        return None
    return None

def xml_to_dict(xml_str):
    try:
        root = ET.fromstring(xml_str)
        def etree_to_dict(t):
            d = {t.tag: {} if t.attrib else None}
            children = list(t)
            if children:
                dd = {}
                for dc in map(etree_to_dict, children):
                    for k, v in dc.items():
                        if k in dd:
                            if isinstance(dd[k], list):
                                dd[k].append(v)
                            else:
                                dd[k] = [dd[k], v]
                        else:
                            dd[k] = v
                d = {t.tag: dd}
            if t.attrib:
                d[t.tag].update(('@' + k, v) for k, v in t.attrib.items())
            if t.text:
                text = t.text.strip()
                if children or t.attrib:
                    if text:
                        d[t.tag]['#text'] = text
                else:
                    d[t.tag] = text
            return d
        return etree_to_dict(root)
    except Exception as e:
        return {"error": str(e)}

class LawAPIFetcher:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_search_url = "http://www.law.go.kr/DRF/lawSearch.do"

    def fetch_list(self, target, query, page=1):
        params = {
            "OC": self.api_key,
            "target": target,
            "type": "JSON",
            "query": query,
            "search": "2", # 2: Full-text search
            "page": page,
            "display": 100
        }
        encoded_params = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
        url = f"{self.base_search_url}?{encoded_params}"
        print(f"  [Law] Fetching {target}: {query} (Page {page})...")
        
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                content = response.read().decode('utf-8', errors='ignore')
                return json.loads(content)
        except Exception as e:
            return {"error": str(e)}

class KCIApiFetcher:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://open.kci.go.kr/po/openapi/openApiSearch.kci"

    def fetch_papers(self, query, page=1):
        params = {
            "key": self.api_key,
            "apiCode": "articleSearch",
            "title": query,
            "displayCount": 100,
            "page": page
        }
        url = f"{self.base_url}?{urllib.parse.urlencode(params)}"
        print(f"  [KCI] Fetching: {query} (Page {page})...")
        
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                content = response.read().decode('utf-8')
                return xml_to_dict(content)
        except Exception as e:
            return {"error": str(e)}

def main():
    # 1. Collect Law Data
    law_key = get_api_key('law')
    if law_key:
        print("Starting Law API Collection...")
        fetcher = LawAPIFetcher(law_key)
        targets = {
            "prec": ["인공지능", "빅데이터", "AI", "알고리즘", "딥러닝", "머신러닝"], 
            "expc": ["인공지능", "빅데이터", "AI", "알고리즘", "딥러닝", "머신러닝", "저작권", "개인정보"]
        }
        os.makedirs("legal_data/raw", exist_ok=True)

        for target, queries in targets.items():
            all_items = []
            seen_ids = set()
            
            for query in queries:
                page = 1
                while True:
                    data = fetcher.fetch_list(target, query, page)
                    if "error" in data: 
                        print(f"  Error for {query} page {page}: {data['error']}")
                        break
                    
                    search_root = "PrecSearch" if target == "prec" else "ExpcSearch"
                    if search_root not in data: 
                        break
                    
                    root_data = data[search_root]
                    item_key = 'prec' if target == "prec" else 'expc'
                    items = root_data.get(item_key, [])
                    if not items:
                        break
                        
                    if not isinstance(items, list): 
                        items = [items]
                        
                    new_count = 0
                    for item in items:
                        if target == "prec":
                            item_id = item.get("판례일련번호") or item.get("사건번호")
                        else:
                            item_id = item.get("법령해석일련번호") or item.get("안건번호") or str(item)
                            
                        if item_id and item_id not in seen_ids:
                            seen_ids.add(item_id)
                            all_items.append(item)
                            new_count += 1
                            
                    print(f"  [Law] {target} - {query} (Page {page}): Added {new_count} unique items (Total: {len(all_items)})")
                    
                    if len(items) < 100 or page >= 5:
                        break
                    page += 1
                    time.sleep(0.5)
                
            with open(f"legal_data/raw/{target}_list.json", 'w', encoding='utf-8') as f:
                json.dump(all_items, f, ensure_ascii=False, indent=2)
            print(f"Saved {len(all_items)} unique Law items to {target}_list.json")
    
    # 2. Collect KCI Data
    kci_key = get_api_key('kci')
    if kci_key:
        print("\nStarting KCI API Collection...")
        kci_fetcher = KCIApiFetcher(kci_key)
        queries = ["인공지능", "빅데이터"]
        os.makedirs("data/raw", exist_ok=True)

        all_papers = []
        for query in queries:
            for page in range(1, 6):
                data = kci_fetcher.fetch_papers(query, page)
                if "error" in data: 
                    print(f"Error for {query} page {page}: {data['error']}")
                    break
                
                try:
                    # KCI response structure: MetaData -> outputData -> record
                    meta = data.get('MetaData', {})
                    output = meta.get('outputData', {})
                    articles = output.get('record', [])
                    
                    if not articles:
                        print(f"  No more records found for {query} at page {page}")
                        break
                        
                    if not isinstance(articles, list): articles = [articles]
                    all_papers.extend(articles)
                    print(f"  Added {len(articles)} papers for {query} (Page {page})")
                    
                    # Respectful rate limiting
                    time.sleep(0.5)
                except Exception as e:
                    print(f"  Parsing error for {query} page {page}: {e}")
                    break
        
        with open("data/raw/kci_api_papers.json", 'w', encoding='utf-8') as f:
            json.dump(all_papers, f, ensure_ascii=False, indent=2)
        print(f"Saved {len(all_papers)} KCI papers to kci_api_papers.json")

if __name__ == "__main__":
    main()
