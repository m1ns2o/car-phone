package com.carphone.app.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build

// 미디어 경로 오디오: Telecom/통화 경로를 쓰지 않는다.
// - 출력: STREAM_MUSIC → 차량 스피커 (A2DP), 내비 안내에 duck 허용
// - 입력: 폰 마이크 (VOICE_COMMUNICATION 소스·SCO 사용 금지)
object CallAudio {
    private var focusRequest: AudioFocusRequest? = null

    fun acquire(ctx: Context) {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        // 혹시 켜진 SCO가 있으면 끈다 (통화 경로 방지)
        try {
            if (am.isBluetoothScoOn) { am.stopBluetoothSco(); am.isBluetoothScoOn = false }
        } catch (_: Exception) { }
        am.mode = AudioManager.MODE_NORMAL
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
        if (Build.VERSION.SDK_INT >= 26) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(attrs)
                .setWillPauseWhenDucked(false) // 내비 안내에 양보(duck)하되 끊지 않음
                .setOnAudioFocusChangeListener({ _ -> }, android.os.Handler(android.os.Looper.getMainLooper()))
                .build()
            focusRequest = req
            am.requestAudioFocus(req)
        } else {
            @Suppress("DEPRECATION")
            am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
        }
    }

    fun release(ctx: Context) {
        val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        focusRequest?.let {
            if (Build.VERSION.SDK_INT >= 26) am.abandonAudioFocusRequest(it)
            focusRequest = null
        }
        am.mode = AudioManager.MODE_NORMAL
    }

    // WebRTC 출력용 AudioAttributes (JavaAudioDeviceModule에 주입)
    fun mediaAttributes(): AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
}
