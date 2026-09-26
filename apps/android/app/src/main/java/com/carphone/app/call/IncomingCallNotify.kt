package com.carphone.app.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.carphone.app.MainActivity

// 백그라운드 수신 통화 알림 (수락/거절 액션)
object IncomingCallNotify {
    const val CH = "incoming"
    const val ID = 2
    const val ACTION_ACCEPT = "com.carphone.app.ACCEPT_CALL"
    const val ACTION_REJECT = "com.carphone.app.REJECT_CALL"
    const val EXTRA_ROOM = "room"
    const val EXTRA_FROM = "from"
    const val EXTRA_FROM_ID = "fromId"

    // 잠금화면 오버레이 액티비티로 연결되는 풀스크린 알림 (FCM/인앱 공용)
    fun showFullScreen(ctx: Context, roomId: String, from: String, fromUserId: String?) {
        nm(ctx).createNotificationChannel(
            NotificationChannel(CH, "수신 통화", NotificationManager.IMPORTANCE_HIGH),
        )
        val overlay = PendingIntent.getActivity(
            ctx, 10,
            Intent(ctx, IncomingCallActivity::class.java)
                .putExtra(EXTRA_ROOM, roomId).putExtra(EXTRA_FROM, from).putExtra(EXTRA_FROM_ID, fromUserId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val reject = PendingIntent.getActivity(
            ctx, 11,
            Intent(ctx, MainActivity::class.java).setAction(ACTION_REJECT)
                .putExtra(EXTRA_ROOM, roomId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val n = NotificationCompat.Builder(ctx, CH)
            .setContentTitle("수신 통화")
            .setContentText("${from}님이 통화를 요청합니다")
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(overlay, true)
            .setContentIntent(overlay)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "거절", reject)
            .addAction(android.R.drawable.ic_menu_call, "수락", overlay)
            .setAutoCancel(true)
            .build()
        nm(ctx).notify(ID, n)
    }

    // 구 경로 호환 (인앱 감시용 — 오버레이로 통일)
    fun show(ctx: Context, roomId: String, from: String, fromUserId: String?) =
        showFullScreen(ctx, roomId, from, fromUserId)

    fun dismiss(ctx: Context) {
        nm(ctx).cancel(ID)
    }

    private fun nm(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
}
