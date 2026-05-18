import pandas as pd
import json
import collections
import re

def process_data():
    # Load data
    try:
        df = pd.read_csv('merged_kci_data.csv', encoding='utf-8-sig')
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return

    # KCI export columns are often renamed during export.
    # We will try to find them by index or common keywords if possible.
    # Based on observation:
    # 2: Author, 5: Title, 13: Keywords, 26: Year
    
    col_author = df.columns[2]
    col_title = df.columns[5]
    col_keywords = df.columns[13]
    col_year = df.columns[26]
    
    print(f"Using columns: Author={col_author}, Title={col_title}, Keywords={col_keywords}, Year={col_year}")

    # 1. Year Count
    year_counts = df[col_year].value_counts().sort_index().to_dict()
    # Convert keys to strings for JSON
    year_counts = {str(k): int(v) for k, v in year_counts.items() if pd.notnull(k)}

    # 2. Keywords Processing (Humanistic Focus)
    # Technical jargon to filter out
    tech_jargon = [
        '알고리즘', '딥러닝', '머신러닝', '인공신경망', '데이터마이닝', '학습', '예측', '정확도', 
        '모델', '시스템', '플랫폼', '프레임워크', '인프라', '웨어러블', 'IoT', '사물인터넷', 
        '클라우드', '블록체인', '데이터베이스', '토픽 모델링', '네트워크 분석', '최적화',
        'Artificial Intelligence', 'Big Data', 'Machine Learning', 'Deep Learning', 'Algorithm'
    ]
    
    all_keywords = []
    for val in df[col_keywords].dropna():
        # Split by comma or semicolon
        kws = re.split(r'[,;]', str(val))
        for kw in kws:
            kw = kw.strip()
            if len(kw) > 1:
                # Basic jargon filtering
                is_tech = any(tech in kw for tech in tech_jargon)
                # We want to keep "인공지능" and "빅데이터" as they are the main topics
                if not is_tech or kw in ['인공지능', '빅데이터', 'AI']:
                    all_keywords.append(kw)
    
    keyword_counts = collections.Counter(all_keywords)
    top_keywords = [{"text": k, "count": v} for k, v in keyword_counts.most_common(15)]

    # 3. Co-occurrence (Radar Chart)
    # We'll pick some humanistic/social labels
    radar_labels = ["윤리", "저작권", "개인정보", "교육", "사회적", "법적", "인간", "문화"]
    ai_co = {label: 0 for label in radar_labels}
    bd_co = {label: 0 for label in radar_labels}
    
    for val in df[col_keywords].dropna():
        kws = str(val).lower()
        has_ai = '인공지능' in kws or 'ai' in kws
        has_bd = '빅데이터' in kws or 'big data' in kws
        
        if has_ai or has_bd:
            for label in radar_labels:
                if label in kws:
                    if has_ai: ai_co[label] += 1
                    if has_bd: bd_co[label] += 1
                    
    co_occurrence = {
        "labels": radar_labels,
        "aiData": [ai_co[l] for l in radar_labels],
        "bigdataData": [bd_co[l] for l in radar_labels]
    }

    # 4. Top Papers (Recent and relevant)
    # Sort by year descending and take top 50
    sorted_df = df.sort_values(by=col_year, ascending=False).head(50)
    top_papers = []
    for _, row in sorted_df.iterrows():
        top_papers.append({
            "title": str(row[col_title]),
            "author": str(row[col_author]),
            "year": str(int(row[col_year])) if pd.notnull(row[col_year]) else "N/A"
        })

    # Final JSON structure
    dashboard_data = {
        "yearCount": year_counts,
        "topKeywords": top_keywords,
        "coOccurrence": co_occurrence,
        "topPapers": top_papers
    }

    # Final structure for JS file
    js_content = f"window.KCI_DATA = {json.dumps(dashboard_data, ensure_ascii=False, indent=4)};"

    with open('dashboard_data.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print("Successfully saved data to dashboard_data.js")

if __name__ == "__main__":
    process_data()
