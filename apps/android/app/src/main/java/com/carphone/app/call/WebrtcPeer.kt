package com.carphone.app.call

import android.content.Context
import com.carphone.app.Config
import com.carphone.app.audio.CallAudio
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule
import org.json.JSONObject

// WebRTC 음성 피어 (오디오만, STUN-only)
class WebrtcPeer(
    ctx: Context,
    private val cb: Callback,
) {
    interface Callback {
        fun onLocalSdp(sdp: String, type: String) // "offer" | "answer"
        fun onCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?)
        fun onConnected()
        fun onFailed()
        fun onRemoteAudio()
    }

    private val appCtx = ctx.applicationContext
    private val egl = EglBase.create()
    private val adm = JavaAudioDeviceModule.builder(appCtx)
        .setAudioAttributes(CallAudio.mediaAttributes()) // 출력=미디어 경로
        .setAudioSource(android.media.MediaRecorder.AudioSource.VOICE_RECOGNITION) // 입력=가공 없는 폰 마이크 (통화 경로 아님)
        .setUseHardwareAcousticEchoCanceler(false) // WebRTC 내장 AEC/NS 사용
        .setUseHardwareNoiseSuppressor(false)
        .createAudioDeviceModule()
    private val factory: PeerConnectionFactory
    private var pc: PeerConnection? = null
    private var audioTrack: AudioTrack? = null

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appCtx).createInitializationOptions(),
        )
        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(adm)
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
            .createPeerConnectionFactory()
    }

    private fun buildPc(): PeerConnection {
        try { pc?.close() } catch (_: Exception) { }
        pc = null
        val rtcConfig = PeerConnection.RTCConfiguration(
            listOf(PeerConnection.IceServer.builder(Config.STUN_URL).createIceServer()),
        )
        val constraints = MediaConstraints()
        val audioSource: AudioSource = factory.createAudioSource(constraints)
        audioTrack = factory.createAudioTrack("audio0", audioSource)
        val p = factory.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onIceCandidate(c: IceCandidate) {
                cb.onCandidate(c.sdp, c.sdpMid, c.sdpMLineIndex)
            }
            override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
                when (state) {
                    PeerConnection.PeerConnectionState.CONNECTED -> cb.onConnected()
                    PeerConnection.PeerConnectionState.FAILED -> cb.onFailed()
                    else -> {}
                }
            }
            override fun onAddStream(stream: MediaStream) = cb.onRemoteAudio()
            override fun onSignalingChange(s: PeerConnection.SignalingState) {}
            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState) {}
            override fun onIceConnectionReceivingChange(b: Boolean) {}
            override fun onIceGatheringChange(s: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(c: Array<out IceCandidate>) {}
            override fun onRemoveStream(s: MediaStream) {}
            override fun onDataChannel(d: DataChannel) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(r: RtpReceiver, s: Array<out MediaStream>) = cb.onRemoteAudio()
        }) ?: throw IllegalStateException("pc create failed")
        audioTrack?.let { p.addTrack(it, listOf("stream0")) }
        pc = p
        return p
    }

    fun startAsCaller() {
        val p = buildPc()
        p.createOffer(SimpleSdp { cb.onLocalSdp(it.description, "offer"); p.setLocalDescription(SimpleSdp {}, it) },
            MediaConstraints())
    }

    fun handleOffer(sdp: String) {
        val p = buildPc()
        p.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                p.createAnswer(SimpleSdp { a -> cb.onLocalSdp(a.description, "answer"); p.setLocalDescription(SimpleSdp {}, a) },
                    MediaConstraints())
            }
            override fun onSetFailure(e: String) {}
            override fun onCreateSuccess(s: SessionDescription) {}
            override fun onCreateFailure(e: String) {}
        }, SessionDescription(SessionDescription.Type.OFFER, sdp))
    }

    fun handleAnswer(sdp: String) {
        pc?.setRemoteDescription(SimpleSdp {}, SessionDescription(SessionDescription.Type.ANSWER, sdp))
    }

    fun handleCandidate(candidate: String, sdpMid: String?, sdpMLineIndex: Int?) {
        try {
            pc?.addIceCandidate(IceCandidate(sdpMid, sdpMLineIndex ?: 0, candidate))
        } catch (_: Exception) { }
    }

    fun setMuted(muted: Boolean) {
        audioTrack?.setEnabled(!muted)
    }

    fun restartIce() {
        pc?.restartIce()
    }

    fun close() {
        try { pc?.close() } catch (_: Exception) { }
        pc = null
    }

    fun dispose() {
        close()
        try { factory.dispose() } catch (_: Exception) { }
        try { adm.release() } catch (_: Exception) { }
        try { egl.release() } catch (_: Exception) { }
    }

    private class SimpleSdp(val onOk: (SessionDescription) -> Unit = {}) : SdpObserver {
        override fun onCreateSuccess(s: SessionDescription) = onOk(s)
        override fun onSetSuccess() {}
        override fun onCreateFailure(e: String) {}
        override fun onSetFailure(e: String) {}
    }
}
