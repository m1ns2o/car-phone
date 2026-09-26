package com.carphone.app.net

import com.carphone.app.Config
import com.carphone.app.Store
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

// REST 클라이언트 (서버 routes/* 와 1:1 대응). JSON 파싱은 org.json (무의존성).
object Api {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    data class User(val id: String, val username: String, val email: String?)
    data class Friend(val id: String, val username: String, val online: Boolean)
    data class FriendRequest(val id: String, val fromUsername: String)
    data class CallRecord(
        val id: String, val roomId: String, val otherUsername: String?,
        val status: String, val durationSec: Int, val startedAt: String,
    )

    class ApiError(message: String) : Exception(message)

    private suspend fun call(
        path: String, method: String = "GET", body: JSONObject? = null, auth: Boolean = true,
    ): JSONObject = withContext(Dispatchers.IO) {
        val b = Request.Builder().url(Config.API_BASE + path)
        Store.accessToken()?.takeIf { auth }?.let { b.header("Authorization", "Bearer $it") }
        when (method) {
            "POST" -> b.post((body?.toString() ?: "{}").toRequestBody(JSON))
            "DELETE" -> b.delete()
            else -> b.get()
        }
        client.newCall(b.build()).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val msg = try { JSONObject(text).optString("error", "HTTP ${resp.code}") }
                catch (_: Exception) { "HTTP ${resp.code}" }
                throw ApiError(msg)
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        }
    }

    suspend fun loginGoogle(idToken: String): Triple<String, String, User> {
        val j = call("/api/auth/google", "POST", JSONObject().put("idToken", idToken), auth = false)
        val u = j.getJSONObject("user")
        return Triple(
            j.getString("accessToken"), j.getString("refreshToken"),
            User(u.getString("id"), u.getString("username"), u.optString("email", null)),
        )
    }

    suspend fun me(): User {
        val u = call("/api/auth/me")
        return User(u.getString("id"), u.getString("username"), u.optString("email", null))
    }

    suspend fun friends(): List<Friend> {
        val arr = callArray("/api/friends")
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            Friend(o.getString("id"), o.getString("username"), o.optBoolean("online", false))
        }
    }

    suspend fun requestFriend(username: String) {
        call("/api/friends/request", "POST", JSONObject().put("username", username))
    }

    suspend fun incomingRequests(): List<FriendRequest> {
        val arr = callArray("/api/friends/requests")
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            // 서버 스키마: { id, fromUserId, fromUsername, ... } (부재 시 tolerant)
            FriendRequest(o.getString("id"), o.optString("fromUsername", o.optString("fromUserId", "?")))
        }
    }

    suspend fun acceptRequest(id: String) {
        call("/api/friends/requests/$id/accept", "POST")
    }

    suspend fun rejectRequest(id: String) {
        call("/api/friends/requests/$id/reject", "POST")
    }

    suspend fun removeFriend(id: String) {
        call("/api/friends/$id", "DELETE")
    }

    suspend fun recordCall(roomId: String, otherUserId: String?, status: String, durationSec: Int) {
        val b = JSONObject().put("roomId", roomId).put("status", status).put("durationSec", durationSec)
        if (otherUserId != null) b.put("otherUserId", otherUserId)
        call("/api/calls", "POST", b)
    }

    suspend fun history(): List<CallRecord> {
        val arr = callArray("/api/calls/history")
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            CallRecord(
                o.getString("id"), o.optString("roomId", ""), o.optString("otherUsername", null),
                o.optString("status", "ended"), o.optInt("durationSec", 0), o.optString("startedAt", ""),
            )
        }
    }

    // FCM 토큰 등록 (서버 POST /api/push/token 추가 후 연결)
    suspend fun registerPushToken(token: String) {
        // TODO: 서버 엔드포인트 추가 시 연결
    }

    private suspend fun callArray(path: String): JSONArray = withContext(Dispatchers.IO) {
        val b = Request.Builder().url(Config.API_BASE + path).get()
        Store.accessToken()?.let { b.header("Authorization", "Bearer $it") }
        client.newCall(b.build()).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw ApiError("HTTP ${resp.code}")
            JSONArray(text)
        }
    }
}
