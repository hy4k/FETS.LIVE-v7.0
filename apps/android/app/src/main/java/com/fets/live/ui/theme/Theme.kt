package com.fets.live.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// FETS LIVE "golden theme" — lifted from the web platform's design tokens:
// deep teal surfaces (#1A3A3D), warm gold accent (#FACC15), warm paper background.
val FetsDeepTeal = Color(0xFF1A3A3D)
val FetsDeepTealDark = Color(0xFF10272A)
val FetsTealSurface = Color(0xFF143336)
val FetsGold = Color(0xFFFACC15)
val FetsGoldSoft = Color(0xFFFDE68A)
val FetsPaper = Color(0xFFF5F2EA)
val FetsPaperCard = Color(0xFFFFFFFF)
val FetsInk = Color(0xFF1A2E30)
val FetsInkMuted = Color(0xFF5C6B6D)
val FetsOpen = Color(0xFFEF4444)
val FetsProgress = Color(0xFFF59E0B)
val FetsClosed = Color(0xFF10B981)

private val LightColors = lightColorScheme(
    primary = FetsDeepTeal,
    onPrimary = Color.White,
    primaryContainer = FetsGold,
    onPrimaryContainer = FetsDeepTealDark,
    secondary = FetsGold,
    onSecondary = FetsDeepTealDark,
    background = FetsPaper,
    onBackground = FetsInk,
    surface = FetsPaperCard,
    onSurface = FetsInk,
    surfaceVariant = Color(0xFFECE7DB),
    onSurfaceVariant = FetsInkMuted,
    error = FetsOpen,
)

private val DarkColors = darkColorScheme(
    primary = FetsGold,
    onPrimary = FetsDeepTealDark,
    primaryContainer = FetsGold,
    onPrimaryContainer = FetsDeepTealDark,
    secondary = FetsGold,
    onSecondary = FetsDeepTealDark,
    background = FetsDeepTealDark,
    onBackground = Color(0xFFE8F0F0),
    surface = FetsTealSurface,
    onSurface = Color(0xFFE8F0F0),
    surfaceVariant = Color(0xFF1C3F42),
    onSurfaceVariant = Color(0xFFB9CDCF),
    error = Color(0xFFF87171),
)

@Composable
fun FetsTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
