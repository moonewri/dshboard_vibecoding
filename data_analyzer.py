import json
import os
import re
from collections import Counter

def load_json(filepath):
    if not os.path.exists(filepath):
        return []
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except:
            return []

def extract_year(date_str):
    if not date_str: return None
    match = re.search(r'\d{4}', str(date_str))
    return match.group() if match else None

def analyze_data():
    # Load data
    precedents = load_json('legal_data/raw/prec_list.json')
    papers = load_json('data/raw/kci_api_papers.json')
    
    # Analysis targets
    target_keywords = {
        "저작권": ["저작권", "copyright"],
        "개인정보": ["개인정보", "privacy", "data protection"],
        "윤리/위험": ["윤리", "ethics", "위험", "risk"],
        "책임/배상": ["책임", "liability", "배상", "손해"],
        "알고리즘": ["알고리즘", "algorithm", "자동화"]
    }
    
    years = sorted(list(set(
        [extract_year(p.get('선고일자')) for p in precedents if extract_year(p.get('선고일자'))] +
        [p.get('journalInfo', {}).get('pub-year') for p in papers if p.get('journalInfo', {}).get('pub-year')]
    )))
    # Filter years from 2013 onwards
    years = [y for y in years if y and '2013' <= y <= '2026']
    
    # 1. Yearly Trend
    trend_data = []
    for year in years:
        p_count = sum(1 for p in precedents if extract_year(p.get('선고일자')) == year)
        k_count = sum(1 for p in papers if p.get('journalInfo', {}).get('pub-year') == year)
        trend_data.append({"year": year, "precedents": p_count, "papers": k_count})
    
    # 2. Keyword Gap Analysis (Academia vs Law)
    keyword_stats = {}
    for label, keys in target_keywords.items():
        # Count in papers
        k_count = 0
        for p in papers:
            title_texts = p.get('articleInfo', {}).get('title-group', {}).get('article-title', [])
            if isinstance(title_texts, list):
                full_title = " ".join([t.get('#text', '') for t in title_texts if isinstance(t, dict)])
            else:
                full_title = str(title_texts)
            
            if any(k.lower() in full_title.lower() for k in keys):
                k_count += 1
        
        # Count in precedents
        p_count = 0
        for p in precedents:
            case_name = p.get('사건명', '')
            if any(k.lower() in case_name.lower() for k in keys):
                p_count += 1
                
        keyword_stats[label] = {"academia": k_count, "law": p_count}

    # 3. Category Distribution (KCI)
    categories = [p.get('articleInfo', {}).get('article-categories', '기타') for p in papers]
    cat_counts = Counter(categories).most_common(10)
    
    # Final Dashboard Data
    dashboard_data = {
        "yearlyTrend": trend_data,
        "keywordGap": keyword_stats,
        "categories": [{"name": k, "value": v} for k, v in cat_counts],
        "summary": {
            "totalPapers": len(papers),
            "totalPrecedents": len(precedents),
            "topRiskArea": max(keyword_stats, key=lambda x: keyword_stats[x]['law'])
        }
    }
    
    # Save as JS to avoid CORS issues
    with open('dashboard_data.js', 'w', encoding='utf-8') as f:
        f.write(f"const dashboardData = {json.dumps(dashboard_data, ensure_ascii=False, indent=2)};")
    
    print("Analysis Complete. dashboard_data.js generated.")

if __name__ == "__main__":
    analyze_data()
