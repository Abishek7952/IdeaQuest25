// static/main.js — multi-peer mesh client
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const pcs = {};              // map: remoteSid -> RTCPeerConnection
  let localStream = null;
  let joined = false;
  let room = null;
  let statsInterval = null;
  let prevPacketsReceived = 0;
  let prevPacketsLost = 0;

  // ICE config: STUN + TURN (replace with your reliable TURN)
  const config = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // replace below with your TURN provider credentials (Xirsys or relay)
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
  const remotesContainer = document.getElementById('remotesContainer');
  const rttEl = document.getElementById('rtt');
  const plEl = document.getElementById('pl');
  const debugEl = document.getElementById('debug');

  // helper logs
  function clog(...a){ console.log('[APP]', ...a); }

  socket.on('connect', () => {
    clog('socket connected', socket.id);
    joinBtn.disabled = false;
  });

  socket.on('existing-peers', (data) => {
    // optional: list of peers already in room
    clog('existing peers', data.peers);
  });

  socket.on('new-peer', async (data) => {
    // Another peer joined — create a pc and send offer to them
    const newSid = data.peer;
    clog('new-peer -> create offer to', newSid);
    await createPeerAndOffer(newSid);
  });

  socket.on('offer', async (data) => {
    const from = data.from;
    const sdp = data.sdp;
    clog('offer received from', from);
    // create pc if not exists
    if (!pcs[from]) createPeerConnectionFor(from);
    const pc = pcs[from];
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));

    // ensure local stream present
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

    // add local tracks (if not already)
    const existingTracks = pc.getSenders().map(s => s.track).filter(Boolean);
    localStream.getTracks().forEach(t => {
      if (!existingTracks.includes(t)) pc.addTrack(t, localStream);
    });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { to: from, sdp: pc.localDescription });
    clog('sent answer to', from);
  });

  socket.on('answer', async (data) => {
    const from = data.from;
    const sdp = data.sdp;
    clog('answer received from', from);
    const pc = pcs[from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } else {
      console.warn('No pc for', from);
    }
  });

  socket.on('ice-candidate', async (data) => {
    const from = data.from;
    const candidate = data.candidate;
    const pc = pcs[from];
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Failed to add ICE', e);
      }
    }
  });

  socket.on('peer-left', (data) => {
    const sid = data.sid;
    clog('peer-left', sid);
    // remove video + close pc
    removePeer(sid);
  });

  // join / leave
  joinBtn.onclick = async () => {
    if (joined) return;
    room = (roomInput.value || 'default').trim();

    // get local stream proactively
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
  };

  leaveBtn.onclick = () => {
    if (!joined) return;
    socket.emit('leave', { room });
    // cleanup all
    Object.keys(pcs).forEach(removePeer);
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    localVideo.srcObject = null;
    joined = false;
    joinBtn.disabled = false;
    leaveBtn.disabled = true;
  };

  // helper: create pc for remote sid and set event handlers
  function createPeerConnectionFor(remoteSid) {
    const pc = new RTCPeerConnection(config);
    pcs[remoteSid] = pc;

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socket.emit('ice-candidate', { to: remoteSid, candidate: ev.candidate });
      }
    };

    pc.ontrack = (ev) => {
      clog('ontrack from', remoteSid);
      attachRemoteStream(remoteSid, ev.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      clog('pc state', remoteSid, pc.connectionState);
      if (pc.connectionState === 'connected') {
        startStatsFor(remoteSid);
      }
      if (['disconnected','failed','closed'].includes(pc.connectionState)) {
        removePeer(remoteSid);
      }
    };

    // add local tracks if available
    if (localStream) {
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    return pc;
  }

  // create pc then offer to target
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

  // create UI video element for remote peer
  function attachRemoteStream(remoteSid, stream) {
    let vid = document.getElementById('remote_' + remoteSid);
    if (!vid) {
      vid = document.createElement('video');
      vid.id = 'remote_' + remoteSid;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.width = 320;
      vid.height = 240;
      // optional label
      const wrapper = document.createElement('div');
      wrapper.id = 'wrap_' + remoteSid;
      wrapper.appendChild(vid);
      const label = document.createElement('div');
      label.innerText = 'Peer: ' + remoteSid;
      wrapper.appendChild(label);
      remotesContainer.appendChild(wrapper);
    }
    vid.srcObject = stream;
  }

  // remove peer UI and close pc
  function removePeer(remoteSid) {
    const pc = pcs[remoteSid];
    if (pc) {
      try { pc.close(); } catch(e) {}
      delete pcs[remoteSid];
    }
    const wrapper = document.getElementById('wrap_' + remoteSid);
    if (wrapper) wrapper.remove();
  }

  // --------- Basic stats per connection (optional) ----------
  const statsIntervals = {}; // map remoteSid -> interval

  function startStatsFor(remoteSid) {
    if (statsIntervals[remoteSid]) return;
    const pc = pcs[remoteSid];
    statsIntervals[remoteSid] = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;
      const stats = await pc.getStats();
      // parse inbound-rtp / candidate-pair similar to earlier single-pc logic
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
      // update a simple global debug (for demo we show last seen values)
      rttEl.innerText = rttMs ? Math.round(rttMs) : '—';
      // delta packet loss approach (global simple)
      // note: to be robust track by remoteSid; omitted for brevity
      debugEl.innerText = `peer ${remoteSid} inbound:${packetsReceived} lost:${packetsLost}`;
    }, 1000);
  }

});
