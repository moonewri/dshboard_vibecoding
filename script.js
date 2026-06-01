let trendChartInstance = null;
let gapChartInstance = null;
let currentData = null;
let activeTrendMode = 'freq'; // 'freq' or 'rvi'

document.addEventListener('DOMContentLoaded', () => {
    if (typeof dashboardData !== 'undefined') {
        currentData = dashboardData;
        initializeFilters();
        updateDashboard();
    } else {
        console.error('dashboardData is not defined. Make sure dashboard_data.js is loaded.');
    }
});

// Initialize year dropdowns and trend toggle buttons based on available data
function initializeFilters() {
    const kciStartSelect = document.getElementById('kci-start-year');
    const kciEndSelect = document.getElementById('kci-end-year');
    const lawStartSelect = document.getElementById('law-start-year');
    const lawEndSelect = document.getElementById('law-end-year');
    
    if (!kciStartSelect || !kciEndSelect || !lawStartSelect || !lawEndSelect) return;
    
    // Years to populate: 2013 to 2026
    const startYear = 2013;
    const endYear = 2026;
    
    const kciYears = [];
    const lawYears = [];
    for (let y = startYear; y <= endYear; y++) {
        kciYears.push(y);
        lawYears.push(y);
    }
    
    // Populate KCI select options
    kciYears.forEach(y => {
        kciStartSelect.add(new Option(`${y}년`, y));
        kciEndSelect.add(new Option(`${y}년`, y));
    });
    
    // Populate LAW select options
    lawYears.forEach(y => {
        lawStartSelect.add(new Option(`${y}년`, y));
        lawEndSelect.add(new Option(`${y}년`, y));
    });
    
    // Set default ranges
    kciStartSelect.value = "2022";
    kciEndSelect.value = "2026";
    lawStartSelect.value = "2016";
    lawEndSelect.value = "2026";
    
    // Bind change event listeners for year inputs
    const triggerUpdate = () => {
        // Enforce logical range constraints (start <= end)
        if (parseInt(kciStartSelect.value) > parseInt(kciEndSelect.value)) {
            kciEndSelect.value = kciStartSelect.value;
        }
        if (parseInt(lawStartSelect.value) > parseInt(lawEndSelect.value)) {
            lawEndSelect.value = lawStartSelect.value;
        }
        updateDashboard();
    };
    
    kciStartSelect.addEventListener('change', triggerUpdate);
    kciEndSelect.addEventListener('change', triggerUpdate);
    lawStartSelect.addEventListener('change', triggerUpdate);
    lawEndSelect.addEventListener('change', triggerUpdate);
    
    // Bind click event listeners for the Trend Chart Toggle buttons
    const btnFreq = document.getElementById('btn-trend-freq');
    const btnRvi = document.getElementById('btn-trend-rvi');
    
    if (btnFreq && btnRvi) {
        btnFreq.addEventListener('click', () => {
            btnFreq.classList.add('active');
            btnRvi.classList.remove('active');
            activeTrendMode = 'freq';
            updateDashboard();
        });
        
        btnRvi.addEventListener('click', () => {
            btnRvi.classList.add('active');
            btnFreq.classList.remove('active');
            activeTrendMode = 'rvi';
            updateDashboard();
        });
    }
}

// Perform client-side dynamic recalculation and redraw UI elements
function updateDashboard() {
    if (!currentData) return;
    
    const kciStart = parseInt(document.getElementById('kci-start-year').value);
    const kciEnd = parseInt(document.getElementById('kci-end-year').value);
    const lawStart = parseInt(document.getElementById('law-start-year').value);
    const lawEnd = parseInt(document.getElementById('law-end-year').value);
    
    // 1. Filter raw lists
    const filteredPapers = currentData.rawPapers.filter(p => {
        const y = parseInt(p.year);
        return y >= kciStart && y <= kciEnd;
    });
    
    const filteredPrecedents = currentData.rawPrecedents.filter(pr => {
        const y = parseInt(pr.year);
        return y >= lawStart && y <= lawEnd;
    });
    
    // 2. Calculate dynamic summary counts
    const totalPapers = filteredPapers.length;
    const totalPrecedents = filteredPrecedents.length;
    
    // 3. Re-calculate RVI & Keyword Gap
    const targetKeywords = {
        "저작권": ["저작권", "copyright"],
        "개인정보": ["개인정보", "privacy", "data protection"],
        "윤리/위험": ["윤리", "ethics", "위험", "risk"],
        "책임/배상": ["책임", "liability", "배상", "손해"],
        "알고리즘": ["알고리즘", "algorithm", "자동화"]
    };
    
    const paperDenom = totalPapers || 1;
    const precedentDenom = totalPrecedents || 1;
    
    const keywordGap = {};
    for (const label in targetKeywords) {
        const k_count = filteredPapers.filter(p => p.keywords.includes(label)).length;
        const p_count = filteredPrecedents.filter(pr => pr.keywords.includes(label)).length;
        
        const academiaRatio = (k_count / paperDenom) * 100;
        const lawRatio = (p_count / precedentDenom) * 100;
        const rvi = lawRatio - academiaRatio;
        
        keywordGap[label] = {
            academia: k_count,
            law: p_count,
            academiaRatio: parseFloat(academiaRatio.toFixed(2)),
            lawRatio: parseFloat(lawRatio.toFixed(2)),
            rvi: parseFloat(rvi.toFixed(2))
        };
    }
    
    const topRviArea = Object.keys(keywordGap).reduce((a, b) => keywordGap[a].rvi > keywordGap[b].rvi ? a : b);
    const topRviValue = keywordGap[topRviArea].rvi;
    
    // Update summary counters on UI
    document.getElementById('total-papers').textContent = totalPapers.toLocaleString();
    document.getElementById('total-precedents').textContent = totalPrecedents.toLocaleString();
    document.getElementById('top-rvi-area').textContent = topRviArea;
    document.getElementById('top-rvi-val').textContent = topRviValue > 0 ? `+${topRviValue}%` : `${topRviValue}%`;
    
    // 4. Update 6-Line Trend Chart (Dynamic Frequency or RVI Gaps)
    renderTrendChart(kciStart, kciEnd, lawStart, lawEnd, activeTrendMode);
    
    // 5. Update Hot Topics co-occurrence lists
    const kciTitles = filteredPapers.map(p => p.title);
    const lawTitles = filteredPrecedents.map(pr => pr.title);
    
    const kciHot = extractCooccurrencesJS(kciTitles, true);
    const lawHot = extractCooccurrencesJS(lawTitles, false);
    renderHotTopics(kciHot, lawHot);
    
    // 6. Update Gap Chart
    renderGapChart(keywordGap);
    
    // 7. Update Agendas & Recommendations
    renderInsights({ keywordGap: keywordGap });
}

// Word co-occurrence calculation in pure JS
function extractCooccurrencesJS(texts, requireTech) {
    const coreTechs = new Set(['인공지능', 'ai', '빅데이터', '알고리즘', '딥러닝', '머신러닝']);
    const stopWords = new Set([
        '연구', '분석', '동향', '사례', '사건', '중심으로', '관한', '대한', '및', '위한', '따른', '통한', 
        '기반', '활용한', '이용', '이용한', '개발', '구현', '모델', '시스템', '기반의', '미치는', '영향', 
        '여부', '해당하는지', '해당', '하고', '하는', '에서', '으로', '경우',
        '중심으', '미치', '활용', '시대', '대상', '과정', '현황', '과제', '방안', '의한', '일부', '관련',
        '작성', '쟁점', '이해', '필요', '대응', '최근', '주요', '역할', '의미', '적용', '제안'
    ]);
    const stopSuffixes = ['에 관한', '에 대한', '을', '를', '의', '에', '는', '은', '이', '가', '와', '과', '로', '에서', '연구', '분석', '에', '으로', '과의'];
    
    const pairFreq = {};
    texts.forEach(text => {
        if (!text) return;
        const tokens = text.toLowerCase().match(/[가-힣]+|ai/g) || [];
        const cleaned = [];
        tokens.forEach(token => {
            if (token.length <= 1 && token !== 'ai') return;
            let cleanedToken = token;
            for (const suffix of stopSuffixes) {
                if (token.endsWith(suffix) && token.length > suffix.length) {
                    cleanedToken = token.slice(0, -suffix.length);
                    break;
                }
            }
            if (cleanedToken.length > 1 && !stopWords.has(cleanedToken)) {
                cleaned.push(cleanedToken);
            }
        });
        
        const uniqueTokens = Array.from(new Set(cleaned)).sort();
        
        if (requireTech) {
            const techWords = uniqueTokens.filter(w => coreTechs.has(w));
            const domainWords = uniqueTokens.filter(w => !coreTechs.has(w));
            techWords.forEach(tech => {
                domainWords.forEach(dom => {
                    const formattedTech = tech === 'ai' ? 'AI' : tech;
                    const pair = `${formattedTech} + ${dom}`;
                    pairFreq[pair] = (pairFreq[pair] || 0) + 1;
                });
            });
        } else {
            for (let i = 0; i < uniqueTokens.length; i++) {
                for (let j = i + 1; j < uniqueTokens.length; j++) {
                    const pair = `${uniqueTokens[i]} + ${uniqueTokens[j]}`;
                    pairFreq[pair] = (pairFreq[pair] || 0) + 1;
                }
            }
        }
    });
    
    return Object.entries(pairFreq)
        .map(([pair, count]) => ({ pair, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

// 6-Line dynamic trend chart renderer supporting both Frequency count and RVI Gaps
function renderTrendChart(kciStart, kciEnd, lawStart, lawEnd, mode) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    const years = [];
    for (let y = 2013; y <= 2026; y++) {
        years.push(String(y));
    }
    
    const topics = ["저작권", "개인정보", "윤리/위험", "책임/배상", "알고리즘", "기타"];
    const topicColors = {
        "저작권": "#38bdf8",     // Sky Blue
        "개인정보": "#4ade80",   // Emerald Green
        "윤리/위험": "#a78bfa",   // Purple Accent
        "책임/배상": "#f43f5e",   // Crimson Red
        "알고리즘": "#fb923c",   // Orange Accent
        "기타": "#94a3b8"       // Muted Slate
    };
    
    const datasets = topics.map(topic => {
        const dataPoints = years.map(yr => {
            const yInt = parseInt(yr);
            const isKciInScope = (yInt >= kciStart && yInt <= kciEnd);
            const isLawInScope = (yInt >= lawStart && yInt <= lawEnd);
            
            // Total KCI papers in yr
            const papersInYr = currentData.rawPapers.filter(p => p.year === yr);
            const totalPapersYr = isKciInScope ? papersInYr.length : 0;
            const k_count = isKciInScope ? papersInYr.filter(p => topic === "기타" ? p.keywords.length === 0 : p.keywords.includes(topic)).length : 0;
            
            // Total LAW precedents in yr
            const precedentsInYr = currentData.rawPrecedents.filter(pr => pr.year === yr);
            const totalPrecedentsYr = isLawInScope ? precedentsInYr.length : 0;
            const p_count = isLawInScope ? precedentsInYr.filter(pr => topic === "기타" ? pr.keywords.length === 0 : pr.keywords.includes(topic)).length : 0;
            
            if (mode === 'rvi') {
                const academiaRatio = totalPapersYr > 0 ? (k_count / totalPapersYr) * 100 : 0;
                const lawRatio = totalPrecedentsYr > 0 ? (p_count / totalPrecedentsYr) * 100 : 0;
                return parseFloat((lawRatio - academiaRatio).toFixed(2));
            } else {
                // Freq mode: combined raw count of academic papers + legal precedents in scope
                return k_count + p_count;
            }
        });
        
        return {
            label: topic,
            data: dataPoints,
            borderColor: topicColors[topic],
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.38,
            pointRadius: 3,
            pointHoverRadius: 6
        };
    });
    
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years.map(y => `${y}년`),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'top',
                    labels: { color: '#f1f5f9', font: { size: 11, weight: '600' } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#38bdf8',
                    bodyColor: '#f1f5f9',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const label = context.dataset.label;
                            if (mode === 'rvi') {
                                return ` ${label} RVI 격차: ${val > 0 ? '+' : ''}${val}%`;
                            } else {
                                return ` ${label} 빈도수합: ${val}건`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: 'rgba(255,255,255,0.06)' }, 
                    ticks: { 
                        color: '#94a3b8',
                        callback: value => mode === 'rvi' ? value + '%' : value + '건'
                    },
                    title: {
                        display: true,
                        text: mode === 'rvi' ? '연구 격차 지수 RVI (%)' : '총 출현 수량 (학술+판례)',
                        color: '#94a3b8',
                        font: { size: 11 }
                    }
                },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderHotTopics(kciHot, lawHot) {
    const kciList = document.getElementById('kci-hot-list');
    const lawList = document.getElementById('law-hot-list');
    
    if (kciList) {
        kciList.innerHTML = kciHot.length > 0 ? kciHot.map(item => `
            <li>
                <span class="pair-text">${escapeHtml(item.pair)}</span>
                <span class="pair-count">${item.count}건</span>
            </li>
        `).join('') : '<li style="color: var(--text-secondary); font-size: 0.8rem; justify-content: center;">선택 기간 내 매칭 데이터 없음</li>';
    }
    
    if (lawList) {
        lawList.innerHTML = lawHot.length > 0 ? lawHot.map(item => `
            <li>
                <span class="pair-text">${escapeHtml(item.pair)}</span>
                <span class="pair-count">${item.count}건</span>
            </li>
        `).join('') : '<li style="color: var(--text-secondary); font-size: 0.8rem; justify-content: center;">선택 기간 내 매칭 데이터 없음</li>';
    }
}

function renderGapChart(gapData) {
    const canvas = document.getElementById('gapChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (gapChartInstance) {
        gapChartInstance.destroy();
    }
    
    const labels = Object.keys(gapData).sort((a, b) => gapData[b].rvi - gapData[a].rvi);
    const rviValues = labels.map(l => gapData[l].rvi);
    
    const backgroundColors = rviValues.map(v => v > 0 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(56, 189, 248, 0.7)');
    const borderColors = rviValues.map(v => v > 0 ? '#f43f5e' : '#38bdf8');
    
    gapChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '연구 공백 지수 (RVI)',
                    data: rviValues,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 6
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const rviVal = context.raw;
                            const desc = rviVal > 0 
                                ? '🚨 소송 대비 연구 부족 (사각지대)' 
                                : '🏛️ 이론적 학술 집중 영역';
                            return ` RVI 지수: ${rviVal > 0 ? '+' : ''}${rviVal}% (${desc})`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: { color: 'rgba(255,255,255,0.1)' }, 
                    ticks: { color: '#94a3b8' },
                    title: {
                        display: true,
                        text: '연구 격차 지수 (%)',
                        color: '#94a3b8',
                        font: { size: 12 }
                    }
                },
                y: { grid: { display: false }, ticks: { color: '#f1f5f9', font: { size: 12, weight: 'bold' } } }
            }
        }
    });
}

function renderInsights(data) {
    const box = document.getElementById('insight-text');
    if (!box) return;
    
    const gapData = data.keywordGap;
    const labels = Object.keys(gapData).sort((a, b) => gapData[b].rvi - gapData[a].rvi);
    
    let html = `
        <p style="margin-bottom: 1.5rem; line-height: 1.7; font-size: 0.95rem; color: var(--text-secondary);">
            설정한 KCI 및 LAW 필터 조건에 대응하여, **실시간 연동 연산된 RVI 정량 분석**과 텍스트 마이닝 트렌드를 융합한 결과입니다. 
            최고 격차 지수를 나타내는 영역을 중심으로 동적 도출된 **실행형 테크-레갈 연구 아젠다** 카드 그리드입니다.
        </p>
        <div class="agenda-grid">
    `;
    
    const templates = {
        "책임/배상": {
            title: "AI 시스템 오작동 및 손해 발생에 따른 책임 귀속 법제화",
            priority: "critical",
            priorityText: "🚨 최우선 (RVI 위험)",
            desc: "판례 소송 대비 학계 연구 비중이 극도로 낮은 실무형 최대 연구 공백 지대입니다. 자율주행 사고나 의료 AI 오류 등 법률상 책임주체 정립이 대단히 시급합니다.",
            tasks: [
                "인공지능 알고리즘 결함에 대한 제조물책임법(PL법)의 한계 분석 및 개정안 제안",
                "생성형 AI 서비스 오작동 시 개발사-운영사-사용자 간 책임 분담 요건 수립",
                "인공지능 사고 전담 국가 배상 기금 및 강제가입 책임보험 제도 연구"
            ]
        },
        "저작권": {
            title: "AI 학습용 데이터셋 공정이용 및 창작물 저작권 가이드라인",
            priority: "high",
            priorityText: "⚠️ 긴급 (연구 필요)",
            desc: "생성형 AI의 등장으로 소송 위협이 폭발한 두 번째 격차 지대입니다. 웹 크롤링 한도와 인공지능 창작물의 법적 주체성 논의를 규정해야 합니다.",
            tasks: [
                "대규모 언어 모델(LLM) 학습용 데이터셋 구축 시 저작권법상 '공정이용' 판단 한계",
                "인간과 인공지능 공동 저작물의 저작자 지위 인정 범위 및 로열티 배분 모델",
                "AI 생성 콘텐츠 불법 복제 방지를 위한 워터마크 기술적 규제 효력 분석"
            ]
        },
        "개인정보": {
            title: "AI 학습 데이터 가명정보 결합 및 정보주체 동의권 보장",
            priority: "academic",
            priorityText: "🏛️ 학술 심화 (균형 영역)",
            desc: "학계와 사법계의 리스크 인식이 균형을 이룬 영역입니다. 맞춤형 AI 서비스에서 개인정보 보호법(PIPA)의 가명처리 실무 기준을 고도화해야 합니다.",
            tasks: [
                "오픈마켓 및 소셜 빅데이터 학습 시 비식별 조치의 법적 적정성 검증",
                "생성형 AI 프롬프트 입력 정보를 통한 개인정보 유출 방지 시스템 구축 연구",
                "정보주체의 'AI 자동화 결정에 거부할 권리(설명요구권)' 실효적 실현 방안"
            ]
        },
        "알고리즘": {
            title: "알고리즘 블랙박스 설명가능성 및 사회적 편향 방지 매트릭스",
            priority: "academic",
            priorityText: "🏛️ 학술 심화 (이론 선행)",
            desc: "학계의 알고리즘 평가 연구가 사법 소송 리스크보다 선행하고 있는 분야입니다. 알고리즘 차별 방지를 규율할 실무 평가 시스템을 구축해야 합니다.",
            tasks: [
                "고위험 AI 채용/신용평가 알고리즘의 공정성(Fairness) 계량화 평가 매트릭스 설계",
                "인공지능 결정 과정의 투명성 확보를 위한 '설명 가능한 AI(XAI)' 법률적 요구수준 정립",
                "알고리즘 담합(Collusion) 및 시장지배력 남용 방지를 위한 독점규제법상 감시 모델"
            ]
        },
        "윤리/위험": {
            title: "선언적 AI 윤리 원칙의 기술적 정렬(Alignment) 실증",
            priority: "academic",
            priorityText: "🏛️ 학술 심화 (이론 선행)",
            desc: "선언적 이론 연구가 사법상 갈등(소송) 빈도보다 월등히 크게 성행하고 있는 분야입니다. 규범적 명제를 프로그램 코드로 구현하는 실증 연구가 필요합니다.",
            tasks: [
                "OECD 및 정부 AI 윤리 강령을 실제 인공지능 모델 소프트웨어 코드로 정렬하는 프로토콜",
                "AI 에이전트의 오프라인 통제권 이탈 방지를 위한 긴급 정지(Kill-Switch) 설계 표준화",
                "소셜 네트워크 내 인공지능 챗봇의 인간 지배/정서적 결착 위험에 대한 심리학적 규범"
            ]
        }
    };
    
    labels.forEach(l => {
        const item = templates[l];
        if (item) {
            const gap = gapData[l];
            const rviText = gap.rvi > 0 ? `+${gap.rvi}%` : `${gap.rvi}%`;
            html += `
                <div class="agenda-card priority-${item.priority}">
                    <div>
                        <div class="agenda-header">
                            <h3 class="agenda-title">${item.title}</h3>
                            <span class="agenda-badge ${item.priority}">${item.priorityText}</span>
                        </div>
                        <div class="agenda-meta">
                            🔍 <b>대비 분석:</b> 학술 비중 ${gap.academiaRatio}% | 판례 비중 ${gap.lawRatio}%<br/>
                            📈 <b>연구 격차 (RVI):</b> <span style="color: ${gap.rvi > 0 ? '#f43f5e' : '#38bdf8'}; font-weight: bold;">${rviText}</span>
                        </div>
                        <p class="agenda-desc">${item.desc}</p>
                    </div>
                    <div>
                        <h4 class="agenda-tasks-title">📋 추천 세부 연구 과제:</h4>
                        <ul class="agenda-tasks" style="margin-bottom: 1rem;">
                            ${item.tasks.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                        </ul>
                        <button class="copy-agenda-btn" onclick="copyAgendaTemplate('${escapeHtml(item.title)}', '${escapeHtml(item.desc)}', '${escapeHtml(item.tasks.join('\\n'))}')">
                            📋 연구 계획서 양식 복사
                        </button>
                    </div>
                </div>
            `;
        }
    });
    
    html += `</div>`;
    box.innerHTML = html;
}

// Agenda template copy to clipboard helper
window.copyAgendaTemplate = function(title, desc, tasksStr) {
    const tasks = tasksStr.split('\n');
    const formattedTasks = tasks.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n');
    
    const textToCopy = `[테크-레갈 연구 계획 아젠다 템플릿]\n\n` +
        `■ 연구 주제: ${title}\n` +
        `■ 연구 필요성 및 RVI 분석 배경:\n  ${desc}\n\n` +
        `■ 추천 세부 실행 과제:\n${formattedTasks}\n\n` +
        `--- \n본 내용은 'AI 테크-레갈 인사이트 대시보드 v3.5'에서 자동 생성된 연구 계획서 양식입니다.`;

    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('📋 연구 계획서 템플릿이 클립보드에 성공적으로 복사되었습니다! 필요한 곳에 붙여넣어 사용하세요.');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
};

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
