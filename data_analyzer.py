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

def extract_cooccurrences(text_list, top_n=8, require_tech=True):
    core_techs = {'인공지능', 'ai', '빅데이터', '알고리즘', '딥러닝', '머신러닝'}
    stop_suffixes = ['에 관한', '에 대한', '을', '를', '의', '에', '는', '은', '이', '가', '와', '과', '로', '에서', '연구', '분석', '에', '으로', '과의']
    stop_words = {
        '연구', '분석', '동향', '사례', '사건', '중심으로', '관한', '대한', '및', '위한', '따른', '통한', 
        '기반', '활용한', '이용', '이용한', '개발', '구현', '모델', '시스템', '기반의', '미치는', '영향', 
        '여부', '해당하는지', '해당', '하고', '하는', '에서', '으로', '경우',
        # 추가된 stripped 불용어 및 무의미한 일반 명사
        '중심으', '미치', '활용', '시대', '대상', '과정', '현황', '과제', '방안', '의한', '일부', '관련',
        '작성', '쟁점', '이해', '필요', '대응', '최근', '주요', '역할', '의미', '적용', '제안'
    }
    
    pair_freq = Counter()
    for text in text_list:
        if not text: continue
        # Extract Korean words and case-insensitive 'ai'
        tokens = re.findall(r'[가-힣]+|ai', text.lower())
        cleaned = []
        for token in tokens:
            if len(token) <= 1 and token != 'ai': continue
            cleaned_token = token
            # Strip suffixes
            for suffix in stop_suffixes:
                if token.endswith(suffix) and len(token) > len(suffix):
                    cleaned_token = token[:-len(suffix)]
                    break
            if len(cleaned_token) > 1 and cleaned_token not in stop_words:
                cleaned.append(cleaned_token)
        
        cleaned = sorted(list(set(cleaned)))
        
        if require_tech:
            # Pair: (tech term, domain keyword)
            tech_words = [w for w in cleaned if w in core_techs]
            domain_words = [w for w in cleaned if w not in core_techs]
            for tech in tech_words:
                for dom in domain_words:
                    formatted_tech = 'AI' if tech == 'ai' else tech
                    pair_freq[(formatted_tech, dom)] += 1
        else:
            # Pair: any two meaningful keywords (used for legal case names)
            for i in range(len(cleaned)):
                for j in range(i+1, len(cleaned)):
                    w1, w2 = cleaned[i], cleaned[j]
                    pair_freq[(w1, w2)] += 1
                
    return [{"pair": f"{k[0]} + {k[1]}", "count": v} for k, v in pair_freq.most_common(top_n)]

def analyze_data():
    # Load data
    precedents = load_json('legal_data/raw/prec_list.json')
    papers = load_json('data/raw/kci_api_papers.json')
    
    total_papers = len(papers) if len(papers) > 0 else 1
    total_precedents = len(precedents) if len(precedents) > 0 else 1
    
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
    
    # 2. Keyword Gap & RVI (Research Void Index) Analysis
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
                
        # Calculate RVI
        academia_ratio = (k_count / total_papers) * 100
        law_ratio = (p_count / total_precedents) * 100
        rvi = law_ratio - academia_ratio
        
        keyword_stats[label] = {
            "academia": k_count, 
            "law": p_count,
            "academiaRatio": round(academia_ratio, 2),
            "lawRatio": round(law_ratio, 2),
            "rvi": round(rvi, 2)
        }

    # 3. Category Distribution (KCI)
    categories = [p.get('articleInfo', {}).get('article-categories', '기타') for p in papers]
    cat_counts = Counter(categories).most_common(10)
    
    # 4. Text Mining: Hot Topic N-Gram Co-occurrences
    kci_titles = []
    for p in papers:
        title_texts = p.get('articleInfo', {}).get('title-group', {}).get('article-title', [])
        if isinstance(title_texts, list):
            full_title = " ".join([t.get('#text', '') for t in title_texts if isinstance(t, dict)])
        else:
            full_title = str(title_texts)
        kci_titles.append(full_title)
        
    law_titles = [p.get('사건명', '') for p in precedents]
    
    kci_hot_topics = extract_cooccurrences(kci_titles, top_n=8, require_tech=True)
    law_hot_topics = extract_cooccurrences(law_titles, top_n=8, require_tech=False)
    
    # 5. Extract Normalized Raw Data for Client-Side Dynamic RVI calculation
    normalized_papers = []
    for p in papers:
        title_texts = p.get('articleInfo', {}).get('title-group', {}).get('article-title', [])
        if isinstance(title_texts, list):
            full_title = " ".join([t.get('#text', '') for t in title_texts if isinstance(t, dict)])
        else:
            full_title = str(title_texts)
        
        year = p.get('journalInfo', {}).get('pub-year')
        if not year or not ('2013' <= year <= '2026'):
            continue
            
        author_group = p.get('articleInfo', {}).get('author-group', {}) or {}
        author_data = author_group.get('author', '')
        if isinstance(author_data, list):
            author = ";".join([a.get('#text', '') if isinstance(a, dict) else str(a) for a in author_data])
        elif isinstance(author_data, dict):
            author = author_data.get('#text', '')
        else:
            author = str(author_data)
            
        category = p.get('articleInfo', {}).get('article-categories', '기타')
        
        matched_keys = []
        for label, keys in target_keywords.items():
            if any(k.lower() in full_title.lower() for k in keys):
                matched_keys.append(label)
                
        normalized_papers.append({
            "year": year,
            "title": full_title,
            "author": author,
            "category": category,
            "keywords": matched_keys
        })
        
    normalized_precedents = []
    for p in precedents:
        case_name = p.get('사건명', '')
        year = extract_year(p.get('선고일자'))
        if not year or not ('2013' <= year <= '2026'):
            continue
            
        matched_keys = []
        for label, keys in target_keywords.items():
            if any(k.lower() in case_name.lower() for k in keys):
                matched_keys.append(label)
                
        normalized_precedents.append({
            "year": year,
            "title": case_name,
            "keywords": matched_keys
        })

    # Find Highest RVI Area
    top_rvi_area = max(keyword_stats, key=lambda x: keyword_stats[x]['rvi'])
    
    # Final Dashboard Data
    dashboard_data = {
        "yearlyTrend": trend_data,
        "keywordGap": keyword_stats,
        "categories": [{"name": k, "value": v} for k, v in cat_counts],
        "hotTopicsKCI": kci_hot_topics,
        "hotTopicsLaw": law_hot_topics,
        "rawPapers": normalized_papers,
        "rawPrecedents": normalized_precedents,
        "summary": {
            "totalPapers": len(papers),
            "totalPrecedents": len(precedents),
            "topRiskArea": max(keyword_stats, key=lambda x: keyword_stats[x]['law']),
            "topRviArea": top_rvi_area,
            "topRviValue": keyword_stats[top_rvi_area]['rvi']
        }
    }
    
    # Save as JS to avoid CORS issues
    with open('dashboard_data.js', 'w', encoding='utf-8') as f:
        f.write(f"const dashboardData = {json.dumps(dashboard_data, ensure_ascii=False, indent=2)};")
    
    print("Analysis Complete. dashboard_data.js generated with RVI, Text Mining, and raw lists!")

if __name__ == "__main__":
    analyze_data()
