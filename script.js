document.addEventListener('DOMContentLoaded', () => {
    if (typeof dashboardData !== 'undefined') {
        renderSummary(dashboardData.summary);
        renderTrendChart(dashboardData.yearlyTrend);
        renderHotTopics(dashboardData.hotTopicsKCI, dashboardData.hotTopicsLaw);
        renderGapChart(dashboardData.keywordGap);
        renderInsights(dashboardData);
    } else {
        console.error('dashboardData is not defined. Make sure dashboard_data.js is loaded.');
    }
});

function renderSummary(summary) {
    const papersEl = document.getElementById('total-papers');
    const precedentsEl = document.getElementById('total-precedents');
    const rviAreaEl = document.getElementById('top-rvi-area');
    const rviValEl = document.getElementById('top-rvi-val');
    
    if (papersEl) papersEl.textContent = summary.totalPapers.toLocaleString();
    if (precedentsEl) precedentsEl.textContent = summary.totalPrecedents.toLocaleString();
    if (rviAreaEl) rviAreaEl.textContent = summary.topRviArea;
    if (rviValEl) rviValEl.textContent = summary.topRviValue > 0 ? `+${summary.topRviValue}%` : `${summary.topRviValue}%`;
}

function renderTrendChart(trendData) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Normalize data (0-100% of maximum value for each dataset)
    const maxPapers = Math.max(...trendData.map(d => d.papers), 1);
    const maxPrecedents = Math.max(...trendData.map(d => d.precedents), 1);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(d => d.year),
            datasets: [
                {
                    label: 'KCI 학술 논문 수',
                    data: trendData.map(d => (d.papers / maxPapers) * 100),
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '사법 판례 수',
                    data: trendData.map(d => (d.precedents / maxPrecedents) * 100),
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f1f5f9' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const index = context.dataIndex;
                            const originalVal = context.datasetIndex === 0 
                                ? trendData[index].papers 
                                : trendData[index].precedents;
                            label += `${originalVal.toLocaleString()}건 (상대 성장률: ${Math.round(context.raw)}%)`;
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: { 
                    grid: { color: 'rgba(255,255,255,0.1)' }, 
                    ticks: { 
                        color: '#94a3b8',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    title: {
                        display: true,
                        text: '상대적 성장 추세 (최댓값 대비 0-100% 정규화)',
                        color: '#94a3b8',
                        font: {
                            size: 11
                        }
                    },
                    min: 0,
                    max: 100
                },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function renderHotTopics(kciHot, lawHot) {
    const kciList = document.getElementById('kci-hot-list');
    const lawList = document.getElementById('law-hot-list');
    
    if (kciList && kciHot) {
        kciList.innerHTML = kciHot.map(item => `
            <li>
                <span class="pair-text">${escapeHtml(item.pair)}</span>
                <span class="pair-count">${item.count}건</span>
            </li>
        `).join('');
    }
    
    if (lawList && lawHot) {
        lawList.innerHTML = lawHot.map(item => `
            <li>
                <span class="pair-text">${escapeHtml(item.pair)}</span>
                <span class="pair-count">${item.count}건</span>
            </li>
        `).join('');
    }
}

function renderGapChart(gapData) {
    const canvas = document.getElementById('gapChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Sort labels in descending order based on RVI value (highest first)
    const labels = Object.keys(gapData).sort((a, b) => gapData[b].rvi - gapData[a].rvi);
    const rviValues = labels.map(l => gapData[l].rvi);
    
    // Dynamic coloring: positive is danger pink/red, negative is cool blue
    const backgroundColors = rviValues.map(v => v > 0 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(56, 189, 248, 0.7)');
    const borderColors = rviValues.map(v => v > 0 ? '#f43f5e' : '#38bdf8');
    
    new Chart(ctx, {
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
            정량 분석 데이터(KCI OpenAPI 1,000건 & 대법원 판례 API 190건)와 텍스트 마이닝 트렌드를 동적 융합한 결과, 
            <strong>최우선 연구 공백 영역(Critical Research Void)</strong>을 식별하고 다음과 같은 <strong>실행형 테크-레갈 연구 아젠다</strong>를 도출했습니다.
        </p>
        <div class="agenda-grid">
    `;
    
    const templates = {
        "책임/배상": {
            title: "AI 시스템 오작동 및 손해 발생에 따른 책임 귀속 법제화",
            priority: "critical",
            priorityText: "🚨 최우선 (RVI 위험)",
            desc: "판례 소송 비중(6.84%) 대비 학계 연구 비중(1.6%)이 극도로 낮은 최대 연구 공백 지대입니다. 자율주행 사고나 의료 AI 오류 등 구체적 분쟁 해결이 시급합니다.",
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
            desc: "생성형 AI 기술의 도래로 소송 리스크가 높아진 두 번째 격차 지대입니다. 데이터 크롤링의 한계와 AI 생성물에 대한 권리 주체를 규정해야 합니다.",
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
            desc: "선언적 이론 연구(15.9%)가 소송 빈도(11.58%)에 비해 대단히 크게 활성화된 분야입니다. 선언적 강령을 기술 코드로 변환하는 실증적 설계 연구가 필요합니다.",
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
                        <ul class="agenda-tasks">
                            ${item.tasks.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        }
    });
    
    html += `</div>`;
    box.innerHTML = html;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
