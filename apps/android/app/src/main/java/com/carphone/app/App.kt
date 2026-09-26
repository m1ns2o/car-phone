package com.carphone.app

import android.app.Application

class App : Application() {
    companion object {
        lateinit var ctx: App
            private set
    }

    override fun onCreate() {
        super.onCreate()
        ctx = this
        com.carphone.app.push.FirebaseSetup.init()
    }
}
