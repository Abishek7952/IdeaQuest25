// static/main.js — multi-peer mesh client with browser STT + download transcript
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const pcs = {};              // map: remoteSid -> RTCPeerConnection
  let localStream = null;
  let joined = false;
  let room = null;
  let prevPacketsReceived = 0;
  let prevPacketsLost = 0;

  // ICE config: STUN + TURN (replace with your TURN provider)
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // Example public relay (for testing) - replace with real TURN credentials.
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ]
  };

  // DOM
  const joinBtn = document.getElementById('joinBtn');
  const leaveBtn = document.getElementById('leaveBtn');
  const roomInput = document.getElementById('roomInput');
  const localVideo = document.getElementById('localVideo');
  const remotesGrid = document.getElementById('remotesGrid');
  const participantsList = document.getElementById('participantsList');
  const rttEl = document.getElementById('rtt');
  const plEl = document.getElementById('pl');
  const debugEl = document.getElementById('debug');

  // logs
  function clog(...a){ console.log('[APP]', ...a); }

  // --- Socket handlers ---
  socket.on('connect', () => {
    clog('socket connected', socket.id);
    joinBtn.disabled = false;
  });

  socket.on('existing-peers', (data) => {
    clog('existing peers', data.peers);
    if (Array.isArray(data.peers)) {
      data.peers.forEach(p => addParticipant(p));
    }
  });

  socket.on('new-peer', async (data) => {
    const newSid = data.peer;
    clog('new-peer -> create offer to', newSid);
    addParticipant(newSid);
    await createPeerAndOffer(newSid);
  });

  socket.on('offer', async (data) => {
    const from = data.from;
    const sdp = data.sdp;
    clog('offer received from', from);
    if (!pcs[from]) createPeerConnectionFor(from);
    const pc = pcs[from];
    try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }
    catch (e) { console.error('setRemoteDescription failed', e); return; }

    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
        localVideo.srcObject = localStream;
        leaveBtn.disabled = false;
      } catch(e) {
        alert('Camera/mic permission needed: ' + e.message);
        return;
      }
    }

    const existingTracks = pc.getSenders().map(s => s.track).filter(Boolean);
    localStream.getTracks().forEach(t => {
      if (!existingTracks.includes(t)) pc.addTrack(t, localStream);
    });

    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, sdp: pc.localDescription });
      clog('sent answer to', from);
    } catch (err) {
      console.error('Error creating/sending answer', err);
    }
  });

  socket.on('answer', async (data) => {
    const from = data.from;
    const sdp = data.sdp;
    clog('answer received from', from);
    const pc = pcs[from];
    if (pc) {
      try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)); }
      catch (e) { console.warn('setRemoteDescription (answer) failed', e); }
    } else {
      console.warn('No pc for', from);
    }
  });

  socket.on('ice-candidate', async (data) => {
    const from = data.from;
    const candidate = data.candidate;
    const pc = pcs[from];
    if (pc && candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { console.warn('Failed to add ICE', e); }
    }
  });

  socket.on('peer-left', (data) => {
    const sid = data.sid;
    clog('peer-left', sid);
    removePeer(sid);
    removeParticipant(sid);
  });

  // live transcript snippets (optional UI use)
  socket.on('live-transcript', (data) => {
    // data: { sid, ts, text } - can be used to show live captions
    // Example (not shown by default): console.log('live-caption', data);
  });

  // server sends compiled transcript for download
  socket.on('download-transcript', (data) => {
    try {
      const txt = data.transcript || '';
      const roomName = (data.room || room || 'meeting').replace(/\s+/g,'_');
      const filename = `transcript_${roomName}_${(new Date()).toISOString().replace(/[:.]/g,'-')}.txt`;
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      console.log('[TRANSCRIPT] download triggered', filename);
    } catch (e) {
      console.error('Failed to create transcript download', e);
    }
  });

  // --- UI handlers ---
  joinBtn.onclick = async () => {
    if (joined) return;
    room = (roomInput.value || 'default').trim();

    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true });
      localVideo.srcObject = localStream;
      leaveBtn.disabled = false;
    } catch (e) {
      alert('Camera/mic required: ' + e.message);
      return;
    }

    socket.emit('join', { room });
    joined = true;
    joinBtn.disabled = true;
    clog('joined', room);

    addParticipant('you', { label: 'You', self: true });

    // start speech recognition if available
    if (recognition) {
      try { recognition.start(); } catch(e){ console.warn('STT start err', e); }
    }
  };

  leaveBtn.onclick = () => {
    if (!joined) return;
    // stop recognition before leaving
    if (recognition) {
      try { recognition.stop(); } catch(e){ /* ignore */ }
    }
    socket.emit('leave', { room });
    Object.keys(pcs).forEach(removePeer);
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    localVideo.srcObject = null;
    joined = false;
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
    clearParticipants();
  };

  // --- Peer connection helpers ---
  function createPeerConnectionFor(remoteSid) {
    const pc = new RTCPeerConnection(config);
    pcs[remoteSid] = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) socket.emit('ice-candidate', { to: remoteSid, candidate: ev.candidate });
    };

    pc.ontrack = (ev) => {
      clog('ontrack from', remoteSid);
      attachRemoteStream(remoteSid, ev.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      clog('pc state', remoteSid, pc.connectionState);
      if (pc.connectionState === 'connected') startStatsFor(remoteSid);
      if (['disconnected','failed','closed'].includes(pc.connectionState)) {
        removePeer(remoteSid);
        removeParticipant(remoteSid);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    return pc;
  }

  async function createPeerAndOffer(targetSid) {
    const pc = createPeerConnectionFor(targetSid);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('offer', { to: targetSid, sdp: pc.localDescription });
      clog('offer sent to', targetSid);
    } catch (e) {
      console.error('Offer error', e);
    }
  }

  // --- UI: create tiles & participants list ---
  function attachRemoteStream(remoteSid, stream) {
    let wrapper = document.getElementById('wrap_' + remoteSid);
    let vid;
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = 'wrap_' + remoteSid;
      wrapper.className = 'video-tile';

      vid = document.createElement('video');
      vid.id = 'remote_' + remoteSid;
      vid.autoplay = true;
      vid.playsInline = true;
      wrapper.appendChild(vid);

      const footer = document.createElement('div');
      footer.className = 'tile-footer';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'name';
      nameDiv.innerText = `Peer: ${shortId(remoteSid)}`;
      const metaDiv = document.createElement('div');
      metaDiv.className = 'meta';
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.innerText = 'Remote';
      metaDiv.appendChild(badge);

      footer.appendChild(nameDiv);
      footer.appendChild(metaDiv);
      wrapper.appendChild(footer);

      remotesGrid.appendChild(wrapper);
      addParticipant(remoteSid);
    } else {
      vid = document.getElementById('remote_' + remoteSid);
    }

    try {
      vid.srcObject = stream;
    } catch (e) {
      vid.src = URL.createObjectURL(stream);
    }
  }

  function removePeer(remoteSid) {
    const pc = pcs[remoteSid];
    if (pc) { try { pc.close(); } catch(e){} delete pcs[remoteSid]; }
    if (statsIntervals[remoteSid]) { clearInterval(statsIntervals[remoteSid]); delete statsIntervals[remoteSid]; }
    const wrapper = document.getElementById('wrap_' + remoteSid);
    if (wrapper) wrapper.remove();
  }

  // --- participants utilities ---
  function addParticipant(id, opts = {}) {
    if (!participantsList) return;
    const placeholder = participantsList.querySelector('.placeholder');
    if (placeholder) placeholder.remove();
    if (document.getElementById('part_' + id)) return;

    const li = document.createElement('li');
    li.id = 'part_' + id;
    const dot = document.createElement('span'); dot.className = 'dot';
    li.appendChild(dot);

    const txt = document.createElement('div');
    txt.style.display = 'flex';
    txt.style.flexDirection = 'column';
    const title = document.createElement('strong');
    title.style.fontSize = '13px';
    title.innerText = opts.label || (id === 'you' ? 'You' : shortId(id));
    const sub = document.createElement('span');
    sub.style.fontSize = '12px';
    sub.style.color = 'rgba(230,238,248,0.6)';
    sub.innerText = opts.self ? 'Local' : 'Remote';
    txt.appendChild(title); txt.appendChild(sub);

    li.appendChild(txt);
    participantsList.appendChild(li);
  }

  function removeParticipant(id) {
    const el = document.getElementById('part_' + id);
    if (el) el.remove();
    if (participantsList.children.length === 0) {
      const p = document.createElement('li'); p.className = 'placeholder'; p.innerText = 'No participants yet'; participantsList.appendChild(p);
    }
  }

  function clearParticipants() {
    participantsList.innerHTML = '';
    const p = document.createElement('li'); p.className = 'placeholder'; p.innerText = 'No participants yet'; participantsList.appendChild(p);
  }

  function shortId(id) { if (!id) return ''; return id.length > 8 ? id.slice(0,8) : id; }

  // --- Basic per-connection stats (for demo) ---
  const statsIntervals = {}; // map remoteSid -> interval

  function startStatsFor(remoteSid) {
    if (statsIntervals[remoteSid]) return;
    const pc = pcs[remoteSid];
    statsIntervals[remoteSid] = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;
      const stats = await pc.getStats();
      let rttMs = null, packetsReceived = 0, packetsLost = 0;
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.selected)) {
          if (report.currentRoundTripTime) rttMs = report.currentRoundTripTime * 1000;
          else if (report.roundTripTime) rttMs = report.roundTripTime * 1000;
        }
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || !report.kind)) {
          packetsReceived = report.packetsReceived || packetsReceived;
          packetsLost = report.packetsLost || packetsLost;
        }
      });
      rttEl.innerText = rttMs ? Math.round(rttMs) : '—';
      debugEl.innerText = `peer ${shortId(remoteSid)} inbound:${packetsReceived} lost:${packetsLost}`;
    }, 1000);
  }

  // -------------------- SpeechRecognition (browser) --------------------
  let recognition = null;
  let lastTranscriptEmit = 0;
  const TRANSCRIPT_SEND_INTERVAL_MS = 600;

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
      return null;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => { console.log('[STT] started'); };
    rec.onend = () => { console.log('[STT] ended'); /* do not auto-restart to avoid loops */ };
    rec.onerror = (e) => { console.warn('[STT] error', e); };

    rec.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      const now = new Date().toISOString();
      if (final && final.trim()) {
        socket.emit('transcript', { room: room, text: final.trim(), interim: false, ts: now });
      }
      if (interim && interim.trim()) {
        const t = Date.now();
        if (t - lastTranscriptEmit > TRANSCRIPT_SEND_INTERVAL_MS) {
          lastTranscriptEmit = t;
          socket.emit('transcript', { room: room, text: interim.trim(), interim: true, ts: now });
        }
      }
    };
    return rec;
  }

  recognition = setupSpeechRecognition();

  // Ensure recognition stops when the page unloads
  window.addEventListener('beforeunload', () => { if (recognition) try { recognition.stop(); } catch(e){} });

});
