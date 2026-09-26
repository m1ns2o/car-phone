plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.carphone.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.carphone.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.3.0-android"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.10.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // 네트워킹 (REST + WS)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // WebRTC (음성만 사용)
    implementation("io.github.webrtc-sdk:android:150.7871.01")

    // Android Auto: 미디어 템플릿 (통화=재생으로 노출)
    implementation("androidx.car.app:app:1.7.0")

    // Google 로그인 (런타임 설정 후 활성화)
    implementation("com.google.android.gms:play-services-auth:21.2.0")
}
