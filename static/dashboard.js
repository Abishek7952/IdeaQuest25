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
      // First check if we have any data, if not, populate with test data
      const engagementResponse = await fetch(`/engagement/${room}`);
      const engagementData = await engagementResponse.json();

      // If no participants, add test data
      if (!engagementData.leaderboard || engagementData.leaderboard.length === 0) {
        console.log('No data found, populating with test data...');
        await populateTestData();
        // Wait a moment for data to be processed
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Load all dashboard data
      await loadEngagementData();
      await loadSentimentData();
      await loadTranscriptData();
      await loadMeetingMetrics();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Try to populate test data as fallback
      try {
        await populateTestData();
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadEngagementData();
        await loadSentimentData();
        await loadTranscriptData();
        await loadMeetingMetrics();
      } catch (fallbackError) {
        console.error('Fallback data loading failed:', fallbackError);
      }
    }
  }

  async function populateTestData() {
    try {
      const response = await fetch(`/test-data/${room}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Test data populated:', data);
        return true;
      } else {
        console.error('Failed to populate test data:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Error populating test data:', error);
      return false;
    }
  }

  async function loadEngagementData() {
    try {
      const response = await fetch(`/engagement/${room}`);
      const data = await response.json();

      console.log('Engagement data received:', data);

      if (data.leaderboard) {
        updateLeaderboard(data.leaderboard);
      }

      if (data.speaking_distribution) {
        updateSpeakingDistribution(data.speaking_distribution);
      }

      // Update metrics with proper error checking
      const participantCountEl = document.getElementById('participantCount');
      const engagementScoreEl = document.getElementById('engagementScore');
      const avgAttentionEl = document.getElementById('avgAttention');

      if (data.leaderboard && data.leaderboard.length > 0) {
        const avgEngagement = data.leaderboard.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / data.leaderboard.length;
        const avgAttention = data.leaderboard.reduce((sum, p) => sum + (p.avg_attention || 0), 0) / data.leaderboard.length;

        if (engagementScoreEl) engagementScoreEl.textContent = Math.round(avgEngagement * 100) + '%';
        if (avgAttentionEl) avgAttentionEl.textContent = Math.round(avgAttention * 100) + '%';
        if (participantCountEl) participantCountEl.textContent = data.leaderboard.length;

        console.log(`Metrics updated: ${data.leaderboard.length} participants, ${Math.round(avgEngagement * 100)}% engagement, ${Math.round(avgAttention * 100)}% attention`);
      } else {
        // Set default values when no data
        if (participantCountEl) participantCountEl.textContent = data.total_participants || 0;
        if (engagementScoreEl) engagementScoreEl.textContent = '—';
        if (avgAttentionEl) avgAttentionEl.textContent = '—';
      }

      // Update meeting duration
      if (data.meeting_duration) {
        const durationEl = document.getElementById('meetingDuration');
        if (durationEl) {
          durationEl.textContent = formatTime(data.meeting_duration);
        }
      }

    } catch (error) {
      console.error('Error loading engagement data:', error);
      // Set error state for metrics
      const participantCountEl = document.getElementById('participantCount');
      const engagementScoreEl = document.getElementById('engagementScore');
      const avgAttentionEl = document.getElementById('avgAttention');

      if (participantCountEl) participantCountEl.textContent = '—';
      if (engagementScoreEl) engagementScoreEl.textContent = '—';
      if (avgAttentionEl) avgAttentionEl.textContent = '—';
    }
  }

  async function loadSentimentData() {
    try {
      const response = await fetch(`/sentiment/${room}`);
      const data = await response.json();

      console.log('Sentiment data received:', data);

      if (data.sentiment_history && data.sentiment_history.length > 0) {
        updateSentimentChart(data.sentiment_history);
        updateSentimentStats(data);
      } else {
        console.log('No sentiment data available yet');
        // Set default values
        const positiveEl = document.getElementById('positivePercent');
        const neutralEl = document.getElementById('neutralPercent');
        const negativeEl = document.getElementById('negativePercent');

        if (positiveEl) positiveEl.textContent = '0%';
        if (neutralEl) neutralEl.textContent = '0%';
        if (negativeEl) negativeEl.textContent = '0%';
      }

    } catch (error) {
      console.error('Error loading sentiment data:', error);
      // Set error state
      const positiveEl = document.getElementById('positivePercent');
      const neutralEl = document.getElementById('neutralPercent');
      const negativeEl = document.getElementById('negativePercent');

      if (positiveEl) positiveEl.textContent = '—';
      if (neutralEl) neutralEl.textContent = '—';
      if (negativeEl) negativeEl.textContent = '—';
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
      // Get meeting metrics from engagement endpoint which has duration
      const response = await fetch(`/engagement/${room}`);
      const data = await response.json();

      console.log('Meeting metrics data:', data);

      // Update meeting duration
      if (data.meeting_duration) {
        const durationEl = document.getElementById('meetingDuration');
        if (durationEl) {
          durationEl.textContent = formatTime(data.meeting_duration);
        }
      }

      // Update participant count
      if (data.total_participants !== undefined) {
        const participantCountEl = document.getElementById('participantCount');
        if (participantCountEl) {
          participantCountEl.textContent = data.total_participants;
        }
      }

    } catch (error) {
      console.error('Error loading meeting metrics:', error);
      // Set default values on error
      const durationEl = document.getElementById('meetingDuration');
      if (durationEl) {
        durationEl.textContent = '—';
      }
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
    console.log('Updating sentiment stats with data:', sentimentData);

    const overall = sentimentData.overall_sentiment || 'neutral';
    const history = sentimentData.sentiment_history || [];

    // Calculate stats from sentiment history
    let positive = 0, neutral = 0, negative = 0;

    history.forEach(entry => {
      const score = entry.score || 0;
      if (score > 0.2) positive++;
      else if (score < -0.2) negative++;
      else neutral++;
    });

    const total = history.length;
    console.log(`Sentiment analysis: ${positive} positive, ${neutral} neutral, ${negative} negative out of ${total} total`);

    // Update overall sentiment
    const overallEl = document.getElementById('overallSentiment');
    if (overallEl) {
      overallEl.textContent = overall.charAt(0).toUpperCase() + overall.slice(1);
    }

    // Update emoji
    const emojiMap = {
      positive: '😊',
      neutral: '😐',
      negative: '😔'
    };
    const emojiEl = document.getElementById('sentimentEmoji');
    if (emojiEl) {
      emojiEl.textContent = emojiMap[overall] || '😐';
    }

    // Update percentages - ALWAYS update, even if total is 0
    const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const neutralPercent = total > 0 ? Math.round((neutral / total) * 100) : 0;
    const negativePercent = total > 0 ? Math.round((negative / total) * 100) : 0;

    const positiveEl = document.getElementById('positivePercent');
    const neutralEl = document.getElementById('neutralPercent');
    const negativeEl = document.getElementById('negativePercent');

    if (positiveEl) {
      positiveEl.textContent = `${positivePercent}%`;
      console.log(`Set positive percentage to: ${positivePercent}%`);
    }
    if (neutralEl) {
      neutralEl.textContent = `${neutralPercent}%`;
      console.log(`Set neutral percentage to: ${neutralPercent}%`);
    }
    if (negativeEl) {
      negativeEl.textContent = `${negativePercent}%`;
      console.log(`Set negative percentage to: ${negativePercent}%`);
    }

    console.log(`Sentiment percentages updated: ${positivePercent}% positive, ${neutralPercent}% neutral, ${negativePercent}% negative`);
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

  window.populateTestData = async function() {
    const button = event.target;
    const originalText = button.innerHTML;

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    button.disabled = true;

    try {
      const success = await populateTestData();
      if (success) {
        // Refresh dashboard data
        await loadDashboardData();

        // Show success message
        button.innerHTML = '<i class="fas fa-check"></i> Added!';
        setTimeout(() => {
          button.innerHTML = originalText;
          button.disabled = false;
        }, 2000);
      } else {
        throw new Error('Failed to populate test data');
      }
    } catch (error) {
      console.error('Error populating test data:', error);
      button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
    }
  };

  // Utility function to format time
  function formatTime(seconds) {
    if (!seconds || seconds < 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  window.downloadTranscript = async function() {
    try {
      console.log('Downloading transcript for room:', room);
      const response = await fetch(`/transcript/${room}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Transcript data received:', data);

      if (data.transcript && data.transcript.length > 0) {
        const transcriptText = data.transcript.map(entry => {
          const timestamp = entry.ts ? new Date(entry.ts * 1000).toLocaleTimeString() : 'Unknown time';
          const speaker = entry.speaker || 'Unknown Speaker';
          const text = entry.text || '';
          return `[${timestamp}] ${speaker}: ${text}`;
        }).join('\n');

        // Add header to transcript
        const header = `Meeting Transcript - Room: ${room}\nGenerated: ${new Date().toLocaleString()}\nTotal Entries: ${data.transcript.length}\n\n`;
        const fullTranscript = header + transcriptText;

        const blob = new Blob([fullTranscript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${room}-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Transcript downloaded successfully');
        alert('Transcript downloaded successfully!');
      } else {
        alert('No transcript data available to download. Please ensure there is conversation data in the meeting.');
        console.log('No transcript data available');
      }
    } catch (error) {
      console.error('Error downloading transcript:', error);
      alert(`Failed to download transcript: ${error.message}. Please try again.`);
    }
  };

  // Generate summary handler
  document.getElementById('generateSummaryBtn').addEventListener('click', async function() {
    const button = this;
    const originalText = button.innerHTML;

    console.log('Generate summary button clicked for room:', room);

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

      console.log('Summary response status:', response.status);
      const data = await response.json();
      console.log('Summary response data:', data);

      if (response.ok && data.result) {
        // Format the result text for display
        const resultText = data.result;
        const formattedResult = resultText.replace(/\n/g, '<br>');

        document.getElementById('summaryContent').innerHTML = `
          <div class="summary-result">
            <div class="summary-section">
              <h4><i class="fas fa-file-text"></i> AI-Generated Meeting Summary</h4>
              <div class="summary-text">${formattedResult}</div>
            </div>
            ${data.stats ? `
            <div class="summary-section">
              <h4><i class="fas fa-chart-bar"></i> Meeting Statistics</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-label">Word Count:</span>
                  <span class="stat-value">${data.stats.word_count || 0}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Duration:</span>
                  <span class="stat-value">${data.stats.estimated_duration ? Math.round(data.stats.estimated_duration) + ' min' : 'N/A'}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">Transcript Entries:</span>
                  <span class="stat-value">${data.transcript_length || 0}</span>
                </div>
              </div>
            </div>
            ` : ''}
            <div class="summary-section">
              <h4><i class="fas fa-info-circle"></i> Summary Details</h4>
              <p><small>Generated on ${new Date(data.timestamp || Date.now()).toLocaleString()}</small></p>
              <p><small>AI Backend: ${data.ai_backend || 'Unknown'}</small></p>
            </div>
          </div>
        `;
        console.log('Summary content updated successfully');
      } else {
        // Handle error response
        console.error('Summary generation failed:', data);
        document.getElementById('summaryContent').innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${data.error || 'Failed to generate summary. Please try again.'}</p>
          </div>
        `;
      }

    } catch (error) {
      console.error('Error generating summary:', error);
      document.getElementById('summaryContent').innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Network error: ${error.message}. Please check your connection and try again.</p>
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
