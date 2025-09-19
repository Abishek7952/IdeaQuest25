// Dashboard JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let room = null;
  let sentimentChart = null;
  let updateInterval = null;

  // Get room from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  room = urlParams.get('room') || 'testroom';
  
  // Update room title
  document.getElementById('roomTitle').textContent = `Room: ${room}`;

  // Initialize dashboard
  initializeDashboard();
  
  // Set up auto-refresh
  updateInterval = setInterval(refreshDashboard, 5000); // Refresh every 5 seconds

  function initializeDashboard() {
    initializeSentimentChart();
    loadDashboardData();
  }

  function initializeSentimentChart() {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    
    sentimentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Sentiment Score',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#cbd5e1'
            }
          },
          y: {
            display: true,
            min: -1,
            max: 1,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#cbd5e1',
              callback: function(value) {
                if (value > 0.3) return 'Positive';
                if (value < -0.3) return 'Negative';
                return 'Neutral';
              }
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 8
          }
        }
      }
    });
  }

  async function loadDashboardData() {
    try {
      // Load engagement data
      await loadEngagementData();
      
      // Load sentiment data
      await loadSentimentData();
      
      // Load transcript data
      await loadTranscriptData();
      
      // Load meeting metrics
      await loadMeetingMetrics();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  async function loadEngagementData() {
    try {
      const response = await fetch(`/engagement/${room}`);
      const data = await response.json();
      
      if (data.leaderboard) {
        updateLeaderboard(data.leaderboard);
      }
      
      if (data.speaking_distribution) {
        updateSpeakingDistribution(data.speaking_distribution);
      }
      
      // Update metrics
      if (data.leaderboard.length > 0) {
        const avgEngagement = data.leaderboard.reduce((sum, p) => sum + p.engagement_score, 0) / data.leaderboard.length;
        const avgAttention = data.leaderboard.reduce((sum, p) => sum + p.avg_attention, 0) / data.leaderboard.length;
        
        document.getElementById('engagementScore').textContent = Math.round(avgEngagement * 100) + '%';
        document.getElementById('avgAttention').textContent = Math.round(avgAttention * 100) + '%';
        document.getElementById('participantCount').textContent = data.leaderboard.length;
      }
      
    } catch (error) {
      console.error('Error loading engagement data:', error);
    }
  }

  async function loadSentimentData() {
    try {
      const response = await fetch(`/sentiment/${room}`);
      const data = await response.json();
      
      if (data.sentiment_history && data.sentiment_history.length > 0) {
        updateSentimentChart(data.sentiment_history);
        updateSentimentStats(data);
      }
      
    } catch (error) {
      console.error('Error loading sentiment data:', error);
    }
  }

  async function loadTranscriptData() {
    try {
      const response = await fetch(`/transcript/${room}`);
      const data = await response.json();
      
      if (data.transcript && data.transcript.length > 0) {
        updateRecentTranscript(data.transcript.slice(-10)); // Show last 10 entries
      }
      
    } catch (error) {
      console.error('Error loading transcript data:', error);
    }
  }

  async function loadMeetingMetrics() {
    try {
      const response = await fetch(`/health`);
      const data = await response.json();
      
      // Update meeting duration (this would need to be tracked properly)
      // For now, we'll use a placeholder
      updateMeetingDuration();
      
    } catch (error) {
      console.error('Error loading meeting metrics:', error);
    }
  }

  function updateLeaderboard(leaderboard) {
    const container = document.getElementById('leaderboard');
    
    if (!leaderboard || leaderboard.length === 0) {
      container.innerHTML = `
        <div class="placeholder">
          <i class="fas fa-medal"></i>
          <p>No participant data available yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = leaderboard.map((participant, index) => `
      <div class="leaderboard-item">
        <div class="rank">${index + 1}</div>
        <div class="participant-info">
          <div class="participant-name">${participant.name}</div>
          <div class="participant-stats">
            Attention: ${Math.round(participant.avg_attention * 100)}% • 
            Speaking: ${formatTime(participant.speaking_time)}
          </div>
        </div>
        <div class="engagement-score">${Math.round(participant.engagement_score * 100)}%</div>
      </div>
    `).join('');
  }

  function updateSpeakingDistribution(distribution) {
    const container = document.getElementById('speakingDistribution');
    
    if (!distribution || distribution.length === 0) {
      container.innerHTML = `
        <div class="placeholder">
          <i class="fas fa-chart-bar"></i>
          <p>No speaking data available yet. Start the meeting to see distribution.</p>
        </div>
      `;
      return;
    }

    const totalTime = distribution.reduce((sum, item) => sum + item.speaking_time, 0);
    document.getElementById('totalSpeakingTime').textContent = formatTime(totalTime);

    container.innerHTML = distribution.map(item => {
      const percentage = totalTime > 0 ? (item.speaking_time / totalTime * 100) : 0;
      return `
        <div class="speaking-item">
          <div class="speaker-info">
            <div class="speaker-avatar">${item.name.charAt(0).toUpperCase()}</div>
            <div class="speaker-name">${item.name}</div>
          </div>
          <div class="speaking-bar">
            <div class="speaking-progress" style="width: ${percentage}%"></div>
          </div>
          <div class="speaking-percentage">${percentage.toFixed(1)}%</div>
        </div>
      `;
    }).join('');
  }

  function updateSentimentChart(sentimentHistory) {
    if (!sentimentChart || !sentimentHistory) return;

    const labels = sentimentHistory.map(item => {
      const date = new Date(item.timestamp * 1000);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const data = sentimentHistory.map(item => item.score);

    sentimentChart.data.labels = labels;
    sentimentChart.data.datasets[0].data = data;
    sentimentChart.update();
  }

  function updateSentimentStats(sentimentData) {
    const overall = sentimentData.overall_sentiment || 'neutral';
    const stats = sentimentData.sentiment_stats || { positive: 0, neutral: 0, negative: 0 };

    // Update overall sentiment
    document.getElementById('overallSentiment').textContent = overall.charAt(0).toUpperCase() + overall.slice(1);
    
    // Update emoji
    const emojiMap = {
      positive: '😊',
      neutral: '😐',
      negative: '😔'
    };
    document.getElementById('sentimentEmoji').textContent = emojiMap[overall] || '😐';

    // Update percentages
    const total = stats.positive + stats.neutral + stats.negative;
    if (total > 0) {
      document.getElementById('positivePercent').textContent = Math.round(stats.positive / total * 100) + '%';
      document.getElementById('neutralPercent').textContent = Math.round(stats.neutral / total * 100) + '%';
      document.getElementById('negativePercent').textContent = Math.round(stats.negative / total * 100) + '%';
    }
  }

  function updateRecentTranscript(transcript) {
    const container = document.getElementById('recentTranscript');
    
    if (!transcript || transcript.length === 0) {
      container.innerHTML = `
        <div class="placeholder">
          <i class="fas fa-microphone-slash"></i>
          <p>No transcript data available yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = transcript.map(entry => `
      <div class="transcript-entry">
        <div class="transcript-speaker">${entry.speaker || 'Unknown'}</div>
        <div class="transcript-text">${entry.text}</div>
      </div>
    `).join('');
  }

  function updateMeetingDuration() {
    // This would need to be properly implemented with actual meeting start time
    const startTime = Date.now() - (Math.random() * 3600000); // Random duration for demo
    const duration = Date.now() - startTime;
    document.getElementById('meetingDuration').textContent = formatTime(Math.floor(duration / 1000));
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Event handlers
  window.goBack = function() {
    window.history.back();
  };

  window.refreshDashboard = function() {
    loadDashboardData();
    
    // Add visual feedback
    const refreshBtn = document.querySelector('.refresh-btn');
    refreshBtn.style.transform = 'rotate(360deg)';
    setTimeout(() => {
      refreshBtn.style.transform = 'rotate(0deg)';
    }, 300);
  };

  window.downloadTranscript = async function() {
    try {
      const response = await fetch(`/transcript/${room}`);
      const data = await response.json();
      
      if (data.transcript && data.transcript.length > 0) {
        const transcriptText = data.transcript.map(entry => 
          `[${new Date(entry.ts * 1000).toLocaleTimeString()}] ${entry.speaker || 'Unknown'}: ${entry.text}`
        ).join('\n');
        
        const blob = new Blob([transcriptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${room}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading transcript:', error);
    }
  };

  // Generate summary handler
  document.getElementById('generateSummaryBtn').addEventListener('click', async function() {
    const button = this;
    const originalText = button.innerHTML;
    
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    button.disabled = true;
    
    try {
      const response = await fetch('/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ room })
      });
      
      const data = await response.json();
      
      if (data.result) {
        document.getElementById('summaryContent').innerHTML = `
          <div class="summary-result">
            <div class="summary-section">
              <h4><i class="fas fa-file-text"></i> Meeting Summary</h4>
              <p>${data.result.summary || 'No summary available'}</p>
            </div>
            <div class="summary-section">
              <h4><i class="fas fa-list-check"></i> Action Items</h4>
              <ul>
                ${(data.result.action_items || []).map(item => `<li>${item}</li>`).join('')}
              </ul>
            </div>
            <div class="summary-section">
              <h4><i class="fas fa-heart"></i> Overall Emotion</h4>
              <p>${data.result.overall_emotion || 'Neutral'}</p>
            </div>
          </div>
        `;
      }
      
    } catch (error) {
      console.error('Error generating summary:', error);
      document.getElementById('summaryContent').innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Error generating summary. Please try again.</p>
        </div>
      `;
    } finally {
      button.innerHTML = originalText;
      button.disabled = false;
    }
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });
});
