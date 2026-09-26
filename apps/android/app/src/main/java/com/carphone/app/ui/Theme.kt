package com.carphone.app.ui

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// 웹 원본 테마 (index.css): night-950 bg, night-800 card, mint-400 accent
object Night {
    val Bg = Color(0xFF070B16)
    val Card = Color(0xFF101828)
    val Card2 = Color(0xFF1A2440)
    val Mint = Color(0xFF34D399)
    val MintDark = Color(0xFF10B981)
    val Mist300 = Color(0xFFC3CAD9)
    val Mist500 = Color(0xFF8B94A7)
    val Rose = Color(0xFFFB4D6D)
    val Amber = Color(0xFFFBBF24)
}

private val DarkScheme = darkColorScheme(
    primary = Night.Mint,
    onPrimary = Color(0xFF052E1B),
    background = Night.Bg,
    onBackground = Color.White,
    surface = Night.Card,
    onSurface = Night.Mist300,
    surfaceVariant = Night.Card2,
    onSurfaceVariant = Night.Mist500,
    secondary = Night.Mist300,
    error = Night.Rose,
    onError = Color.White,
)

@Composable
fun CarPhoneTheme(content: @Composable () -> Unit) {
    androidx.compose.material3.MaterialTheme(
        colorScheme = DarkScheme,
        content = content,
    )
}
