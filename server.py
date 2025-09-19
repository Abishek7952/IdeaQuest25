# server.py (multi-peer signaling)
import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, leave_room, emit
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("webrtc-signaling")

app = Flask(__name__, template_folder="templates")
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='eventlet', logger=False, engineio_logger=False)

rooms = defaultdict(set)

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
    # Send list of existing peers to the joining client (optional)
    existing = list(rooms[room])
    join_room(room)
    rooms[room].add(sid)
    log.info(f"[JOIN] {sid} -> {room} (count={len(rooms[room])})")

    # Tell the joining client the list of existing peers (so it can show UI if desired)
    emit('existing-peers', {'peers': existing})

    # Notify existing peers that a new peer joined (they should create an offer to this sid)
    for other in existing:
        # send to each existing peer the new peer's sid
        socketio.emit('new-peer', {'peer': sid}, room=other)

@socketio.on('offer')
def handle_offer(data):
    # data: { to: target_sid, sdp: { ... } }
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"[SIGNAL] offer from {request.sid} -> to={target}")
    socketio.emit('offer', {'sdp': sdp, 'from': request.sid}, room=target)

@socketio.on('answer')
def handle_answer(data):
    # data: { to: target_sid, sdp: { ... } }
    target = data.get('to')
    sdp = data.get('sdp')
    log.info(f"[SIGNAL] answer from {request.sid} -> to={target}")
    socketio.emit('answer', {'sdp': sdp, 'from': request.sid}, room=target)

@socketio.on('ice-candidate')
def handle_ice(data):
    # data: { to: target_sid, candidate: {...} }
    target = data.get('to')
    candidate = data.get('candidate')
    log.info(f"[SIGNAL] ice-candidate from {request.sid} -> to={target}")
    socketio.emit('ice-candidate', {'candidate': candidate, 'from': request.sid}, room=target)

@socketio.on('leave')
def handle_leave(data):
    room = data.get('room')
    sid = request.sid
    leave_room(room)
    rooms[room].discard(sid)
    # notify other peers
    socketio.emit('peer-left', {'sid': sid}, room=room)
    log.info(f"[LEAVE] {sid} left {room} (count={len(rooms[room])})")
    if not rooms[room]:
        del rooms[room]

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    for room, sids in list(rooms.items()):
        if sid in sids:
            sids.remove(sid)
            socketio.emit('peer-left', {'sid': sid}, room=room)
            log.info(f"[DISCONNECT] {sid} removed from {room} (count={len(sids)})")
            if not sids:
                del rooms[room]

if __name__ == '__main__':
    log.info("Starting signaling server on http://0.0.0.0:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, use_reloader=False)
