package com.carphone.app.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Binder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.carphone.app.Config
import com.carphone.app.MainActivity
import com.carphone.app.audio.CallAudio
import com.carphone.app.net.Api
import com.carphone.app.net.Signaling
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// 통화 유지용 포그라운드 서비스: 시그널링 + WebRTC + 오디오 세션 소유.
// 상태는 StateFlow로 UI(폰 화면·AA 화면)가 구독.
class CallService : Service() {

    enum class Status { IDLE, JOINING, WAITING, CONNECTING, CONNECTED, FAILED, CLOSED }

    data class Invite(
        val roomId: String, val from: String, val fromUserId: String?,
    )

    data class State(
        val status: Status = Status.IDLE,
        val roomId: String = "",
        val name: String = "",
        val peerName: String? = null,
        val peerDisplayName: String? = null, // 친구 호출 시 표시명
        val peerJoined: Boolean = false,
        val pcState: String = "-",
        val iceState: String = "-",
        val rttMs: Double? = null,
        val muted: Boolean = false,
        val seconds: Int = 0,
        val logs: List<String> = emptyList(),
        val error: String? = null,
    )

    companion object {
        const val CH = "call"
        const val ACTION_JOIN = "JOIN"
        const val ACTION_LEAVE = "LEAVE"
        const val ACTION_MUTE = "MUTE"
        const val EXTRA_ROOM = "room"
        const val EXTRA_NAME = "name"
        const val EXTRA_INVITE_TO = "inviteTo"
        const val EXTRA_INVITE_FROM = "inviteFrom"
        const val EXTRA_PEER_ID = "peerId"
        const val EXTRA_PEER_NAME = "peerName"

        fun join(
            ctx: Context, room: String, name: String, inviteTo: String? = null,
            inviteFrom: String? = null, peerId: String? = null, peerName: String? = null,
        ) {
            val i = Intent(ctx, CallService::class.java).setAction(ACTION_JOIN)
                .putExtra(EXTRA_ROOM, room).putExtra(EXTRA_NAME, name)
            inviteTo?.let { i.putExtra(EXTRA_INVITE_TO, it) }
            inviteFrom?.let { i.putExtra(EXTRA_INVITE_FROM, it) }
            peerId?.let { i.putExtra(EXTRA_PEER_ID, it) }
            peerName?.let { i.putExtra(EXTRA_PEER_NAME, it) }
            ctx.startForegroundService(i)
        }

        fun control(ctx: Context, action: String) {
            ctx.startService(Intent(ctx, CallService::class.java).setAction(action))
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state
    private val binder = LocalBinder()

    private var signaling: Signaling? = null
    private var peer: WebrtcPeer? = null
    private var inviteTo: String? = null
    private var inviteFrom: String? = null
    private var peerId: String? = null
    private var ticker: android.os.Handler? = null
    private var statsTicker: android.os.Handler? = null

    inner class LocalBinder : Binder() {
        fun service() = this@CallService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= 26) {
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(
                NotificationChannel(CH, "통화", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_JOIN -> {
                val room = intent.getStringExtra(EXTRA_ROOM).orEmpty()
                val name = intent.getStringExtra(EXTRA_NAME).orEmpty()
                inviteTo = intent.getStringExtra(EXTRA_INVITE_TO)
                inviteFrom = intent.getStringExtra(EXTRA_INVITE_FROM)
                peerId = intent.getStringExtra(EXTRA_PEER_ID)
                val peerName = intent.getStringExtra(EXTRA_PEER_NAME)
                startCall(room, name, peerName)
            }
            ACTION_MUTE -> toggleMute()
            ACTION_LEAVE -> {
                endCall(record = true)
                stopSelf()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun startCall(roomId: String, name: String, peerDisplayName: String? = null) {
        if (_state.value.status != Status.IDLE) return
        update {
            copy(
                status = Status.JOINING, roomId = roomId, name = name,
                peerDisplayName = peerDisplayName, peerJoined = false,
                pcState = "-", iceState = "-", rttMs = null,
                logs = emptyList(), seconds = 0, error = null,
            )
        }
        log("joining $roomId as $name")
        startForegroundNotif()
        try {
            CallAudio.acquire(this)
            log("audio: MODE_NORMAL + USAGE_MEDIA (media path)")
        } catch (e: Exception) {
            update { copy(error = "오디오 실패: ${e.message}") }
        }
        val p = WebrtcPeer(this, object : WebrtcPeer.Callback {
            override fun onLocalSdp(sdp: String, type: String) {
                if (type == "offer") signaling?.sendOffer(sdp) else signaling?.sendAnswer(sdp)
            }
            override fun onCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
                signaling?.sendCandidate(candidate, sdpMid, sdpMLineIndex)
            }
            override fun onConnectionState(state: String) {
                update { copy(pcState = state) }
                log("connectionState=$state")
                signaling?.sendCallState(state)
                when (state) {
                    "connected" -> { /* onConnected에서 처리 */ }
                    "failed" -> { update { copy(status = Status.FAILED) }; log("connection failed") }
                    "closed" -> { update { copy(status = Status.CLOSED) }; log("connection closed") }
                }
            }
            override fun onIceState(state: String) {
                update { copy(iceState = state) }
                log("iceState=$state")
            }
            override fun onConnected() { update { copy(status = Status.CONNECTED) }; log("connected") }
            override fun onFailed() { update { copy(status = Status.FAILED) }; log("connection failed") }
            override fun onRemoteAudio() { log("remote audio attached") }
        })
        peer = p
        signaling = Signaling(roomId, name, inviteTo, inviteFrom, object : Signaling.Callback {
            override fun onOpen() = log("ws open")
            override fun onPeerJoined(n: String?) {
                signaling?.markPeerSeen()
                update { copy(peerName = n, peerJoined = true) }
                log("peer joined: ${n ?: "?"} — 통화 시작 버튼을 누르세요")
            }
            override fun onPeerLeft() {
                update { copy(peerJoined = false) }
                log("peer left")
            }
            override fun onCallEnd() {
                update { copy(status = Status.CLOSED) }
                log("peer hung up")
                teardownPeer()
            }
            override fun onOffer(sdp: String) { log("got offer"); p.handleOffer(sdp) }
            override fun onAnswer(sdp: String) { log("got answer"); p.handleAnswer(sdp) }
            override fun onCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) =
                p.handleCandidate(candidate, sdpMid, sdpMLineIndex)
            override fun onInvite(r: String, f: String, fu: String?) = log("invite from $f")
            override fun onError(msg: String) = log("ERR $msg")
            override fun onClosed() = log("ws closed")
        })
        signaling?.connect()
        update { copy(status = Status.WAITING) }
        val h = android.os.Handler(mainLooper)
        ticker = h
        h.post(object : Runnable {
            override fun run() {
                if (_state.value.status == Status.CONNECTED) {
                    update { copy(seconds = seconds + 1) }
                }
                h.postDelayed(this, 1000)
            }
        })
        // getStats 폴링 (5초) — 안정성 검증용
        val sh = android.os.Handler(mainLooper)
        statsTicker = sh
        sh.post(object : Runnable {
            override fun run() {
                if (_state.value.status == Status.CONNECTED) {
                    peer?.collectStats { st ->
                        update { copy(rttMs = st.rttMs) }
                        log(
                            "stats rtt=${st.rttMs?.let { "%.0f".format(it) } ?: "-"}ms " +
                                "jitter=${st.jitterMs?.let { "%.1f".format(it) } ?: "-"}ms " +
                                "lost=${st.lost ?: 0}",
                        )
                    }
                }
                sh.postDelayed(this, 5000)
            }
        })
    }

    fun beginCall() {
        if (_state.value.status != Status.WAITING) return
        update { copy(status = Status.CONNECTING) }
        log("sending offer…")
        peer?.startAsCaller()
        signaling?.sendCallRequest(_state.value.name)
    }

    fun restartIce() {
        log("ICE restart offer sent")
        peer?.restartIce()
    }

    // offer 무응답/실패 시 재시도 (상대가 뒤늦게 입장한 경우)
    fun retryOffer() {
        if (_state.value.status != Status.CONNECTING && _state.value.status != Status.FAILED) return
        update { copy(status = Status.CONNECTING) }
        log("re-sending offer…")
        peer?.startAsCaller()
    }

    fun toggleMute() {
        val m = !_state.value.muted
        peer?.setMuted(m)
        update { copy(muted = m) }
        log(if (m) "muted" else "unmuted")
        startForegroundNotif()
    }

    private fun teardownPeer() {
        try { signaling?.disconnect() } catch (_: Exception) { }
        try { peer?.dispose() } catch (_: Exception) { }
        signaling = null; peer = null
        ticker?.removeCallbacksAndMessages(null)
        statsTicker?.removeCallbacksAndMessages(null)
        CallAudio.release(this)
    }

    private fun endCall(record: Boolean, notify: Boolean = true) {
        if (notify) {
            try { signaling?.sendCallEnd() } catch (_: Exception) { }
        }
        val s = _state.value
        if (record && s.roomId.isNotEmpty()) {
            scope.launch {
                try {
                    Api.recordCall(s.roomId, peerId, if (s.status == Status.CONNECTED) "ended" else "failed", s.seconds)
                } catch (_: Exception) { }
            }
        }
        log("leave")
        teardownPeer()
        update { copy(status = Status.IDLE) }
    }

    override fun onDestroy() {
        endCall(record = false)
        scope.cancel()
        super.onDestroy()
    }

    private fun update(f: State.() -> State) {
        _state.value = _state.value.f()
        startForegroundNotif()
    }

    private fun log(s: String) {
        val t = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
        update { copy(logs = logs + "$t $s") }
    }

    private fun startForegroundNotif() {
        val s = _state.value
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val mute = PendingIntent.getService(
            this, 1, Intent(this, CallService::class.java).setAction(ACTION_MUTE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val leave = PendingIntent.getService(
            this, 2, Intent(this, CallService::class.java).setAction(ACTION_LEAVE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notif: Notification = NotificationCompat.Builder(this, CH)
            .setContentTitle("CarPhone ${s.roomId}")
            .setContentText(if (s.muted) "음소거 중" else s.status.name)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_lock_silent_mode_off, if (s.muted) "해제" else "음소거", mute)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "종료", leave)
            .setOngoing(true)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(1, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(1, notif)
        }
    }

    fun inviteUrl(roomId: String) = Config.WEB_INVITE_BASE + roomId
}
