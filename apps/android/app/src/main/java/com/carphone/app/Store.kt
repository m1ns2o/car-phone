package com.carphone.app

import android.content.Context
import androidx.core.content.edit

// 토큰·표시이름 저장 (TODO: EncryptedSharedPreferences로 승격)
object Store {
    private const val FILE = "carphone"
    private fun prefs(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var displayName: String
        get() = prefs(App.ctx).getString("displayName", null) ?: "guest"
        set(v) = prefs(App.ctx).edit { putString("displayName", v) }

    fun saveTokens(access: String, refresh: String) {
        prefs(App.ctx).edit {
            putString("accessToken", access)
            putString("refreshToken", refresh)
        }
    }

    fun accessToken(): String? = prefs(App.ctx).getString("accessToken", null)
    fun clearTokens() {
        prefs(App.ctx).edit { remove("accessToken"); remove("refreshToken") }
    }
}
