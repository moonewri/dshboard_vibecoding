document.addEventListener('DOMContentLoaded', () => {
    if (typeof dashboardData !== 'undefined') {
        renderSummary(dashboardData.summary);
        renderTrendChart(dashboardData.yearlyTrend);
        renderCategoryChart(dashboardData.categories);
        renderGapChart(dashboardData.keywordGap);
        renderInsights(dashboardData);
    } else {
        console.error('dashboardData is not defined. Make sure dashboard_data.js is loaded.');
    }
});

function renderSummary(summary) {
    document.getElementById('total-papers').textContent = summary.totalPapers.toLocaleString();
    document.getElementById('total-precedents').textContent = summary.totalPrecedents.toLocaleString();
    document.getElementById('top-risk-area').textContent = summary.topRiskArea;
}

function renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // Normalize data (0-100% of maximum value for each dataset)
    const maxPapers = Math.max(...trendData.map(d => d.papers), 1);
    const maxPrecedents = Math.max(...trendData.map(d => d.precedents), 1);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(d => d.year),
            datasets: [
                {
                    label: 'Academic Papers (KCI)',
                    data: trendData.map(d => (d.papers / maxPapers) * 100),
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Precedents (Law)',
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
                            label += `${originalVal.toLocaleString()}건 (상대 비중: ${Math.round(context.raw)}%)`;
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
                        text: '상대적 성장 추세 (Normalized to Max 100%)',
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

function renderCategoryChart(catData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: catData.map(d => d.name),
            datasets: [{
                data: catData.map(d => d.value),
                backgroundColor: [
                    '#38bdf8', '#818cf8', '#6366f1', '#a855f7', '#ec4899',
                    '#f43f5e', '#fb923c', '#facc15', '#4ade80', '#2dd4bf'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: { color: '#f1f5f9', padding: 20, font: { size: 10 } } 
                }
            }
        }
    });
}

function renderGapChart(gapData) {
    const ctx = document.getElementById('gapChart').getContext('2d');
    const labels = Object.keys(gapData);
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Academia Interest',
                    data: labels.map(l => gapData[l].academia),
                    backgroundColor: '#38bdf8'
                },
                {
                    label: 'Law Enforcement/Conflict',
                    data: labels.map(l => gapData[l].law),
                    backgroundColor: '#f43f5e'
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#f1f5f9' } }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#94a3b8' } },
                y: { grid: { display: false }, ticks: { color: '#f1f5f9' } }
            }
        }
    });
}

function renderInsights(data) {
    const box = document.getElementById('insight-text');
    const topLaw = data.summary.topRiskArea;
    const yearTrend = data.yearlyTrend[data.yearlyTrend.length - 2]; // 2025 data
    
    box.innerHTML = `
        <p style="margin-bottom: 1rem; line-height: 1.6;">
            현재 가장 주의 깊게 살펴봐야 할 분야는 <strong>"${topLaw}"</strong>입니다. 
            학술 연구에서는 <strong>개인정보</strong>와 <strong>윤리</strong>를 주로 다루고 있지만, 
            실제 법원에서는 <strong>손해배상 및 책임 소재</strong>에 대한 판결이 급증하고 있습니다.
        </p>
        <p style="line-height: 1.6;">
            <strong>Trend Check:</strong> 2022년을 기점으로 AI 관련 논문이 폭발적으로 증가했으며, 
            약 2~3년의 시차를 두고 2025년부터 관련 판례가 본격적으로 형성되는 <strong>'Tech-Legal Lag'</strong> 현상이 관찰됩니다.
        </p>
    `;
}
