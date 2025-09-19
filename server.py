# server.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from collections import defaultdict
from datetime import datetime
import logging
import json

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("webrtc-signaling")

app = Flask(__name__, template_folder="templates")
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='eventlet', logger=False, engineio_logger=False)

# room membership
rooms = defaultdict(set)
# transcript store: rooms_transcripts[room] -> list of {sid, ts, text}
rooms_transcripts = defaultdict(list)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def on_connect():
    log.info(f"[CONNECT] sid={request.sid}")

@socketio.on('join')
def handle_join(data):
    room = data.get('room')
    sid = request.sid
    existing = list(rooms[room])
    join_room(room)
    rooms[room].add(sid)
    log.info(f"[JOIN] {sid} -> {room} (count={len(rooms[room])})")

    # send existing peers list to the joining client
    emit('existing-peers', {'peers': existing})

    # notify existing peers that a new peer joined
    for other in existing:
        socketio.emit('new-peer', {'peer': sid}, room=other)

@socketio.on('offer')
def handle_offer(data):
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"[SIGNAL] offer from {request.sid} -> to={target}")
    socketio.emit('offer', {'sdp': sdp, 'from': request.sid}, room=target)

@socketio.on('answer')
def handle_answer(data):
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"[SIGNAL] answer from {request.sid} -> to={target}")
    socketio.emit('answer', {'sdp': sdp, 'from': request.sid}, room=target)

@socketio.on('ice-candidate')
def handle_ice(data):
    target = data.get('to')
    candidate = data.get('candidate')
    log.info(f"[SIGNAL] ice-candidate from {request.sid} -> to={target}")
    socketio.emit('ice-candidate', {'candidate': candidate, 'from': request.sid}, room=target)

# --- transcription handlers ---
@socketio.on('transcript')
def handle_transcript(data):
    """
    data: { room, text, interim(bool), ts(optional ISO) }
    We'll store snippets; server also broadcasts live-transcript to room for live captions.
    """
    room = data.get('room')
    text = (data.get('text') or '').strip()
    sid = request.sid
    if not room or not text:
        return
    ts = data.get('ts') or datetime.utcnow().isoformat()
    rooms_transcripts[room].append({'sid': sid, 'ts': ts, 'text': text})
    # broadcast a live caption snippet to all in the room (optional)
    socketio.emit('live-transcript', {'sid': sid, 'ts': ts, 'text': text}, room=room)

def compile_transcript_for_room(room):
    items = rooms_transcripts.get(room, [])
    items_sorted = sorted(items, key=lambda x: x.get('ts') or '')
    lines = []
    for it in items_sorted:
        ts = it.get('ts', '')
        sid = it.get('sid', '')
        text = it.get('text', '')
        lines.append(f"[{ts}] ({sid}): {text}")
    return "\n".join(lines)

@socketio.on('leave')
def handle_leave(data):
    room = data.get('room')
    sid = request.sid
    leave_room(room)
    rooms[room].discard(sid)

    # compile transcript snapshot and send to the leaving socket (so they can download)
    transcript_text = compile_transcript_for_room(room)
    if transcript_text:
        try:
            # target the leaving socket by using room=sid
            socketio.emit('download-transcript', {'room': room, 'transcript': transcript_text}, room=sid)
        except Exception as e:
            log.warning("Failed to emit transcript to leaving socket: %s", e)

    # notify other peers about leave
    socketio.emit('peer-left', {'sid': sid}, room=room, include_self=False)
    log.info(f"[LEAVE] {sid} left {room} (count={len(rooms[room])})")

    # cleanup room if empty (also free transcript)
    if not rooms[room]:
        del rooms[room]
        if room in rooms_transcripts:
            del rooms_transcripts[room]

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    for room, sids in list(rooms.items()):
        if sid in sids:
            sids.remove(sid)
            # fallback: compile transcript and emit it to remaining peers (since disconnected socket can't receive)
            transcript_text = compile_transcript_for_room(room)
            if transcript_text:
                try:
                    socketio.emit('download-transcript', {'room': room, 'transcript': transcript_text}, room=room)
                except Exception as e:
                    log.warning("Failed to emit transcript on disconnect: %s", e)
            socketio.emit('peer-left', {'sid': sid}, room=room, include_self=False)
            log.info(f"[DISCONNECT] {sid} removed from {room} (count={len(sids)})")
            if not sids:
                del rooms[room]
                if room in rooms_transcripts:
                    del rooms_transcripts[room]

if __name__ == '__main__':
    log.info("Starting signaling server on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)
