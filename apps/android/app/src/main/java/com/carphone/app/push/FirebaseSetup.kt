package com.carphone.app.push

import com.carphone.app.App
import com.carphone.app.BuildConfig
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

// google-services.json 없이 수동 초기화.
// local.properties: firebase.apiKey / firebase.appId / firebase.projectId / firebase.senderId
// (Firebase 콘솔 → 프로젝트 설정 → 일반 → 웹 API 키·앱 ID·프로젝트 ID·발신자 ID)
object FirebaseSetup {
    fun init(): Boolean {
        if (FirebaseApp.getApps(App.ctx).isNotEmpty()) return true
        if (BuildConfig.FIREBASE_API_KEY.isBlank() || BuildConfig.FIREBASE_APP_ID.isBlank()) {
            android.util.Log.i("CarPhone", "FCM disabled (no firebase keys in local.properties)")
            return false
        }
        val opts = FirebaseOptions.Builder()
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
            .build()
        FirebaseApp.initializeApp(App.ctx, opts)
        return true
    }

    fun ready(): Boolean = FirebaseApp.getApps(App.ctx).isNotEmpty()
}
