package com.fets.staffapp.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import kotlin.math.pow

/**
 * Kayal Relief — the FETS palette.
 *
 * The pigments are fixed brand values. What is *not* obvious, and what this file
 * encodes, is that the two schemes are not inversions of each other: they swap
 * which pigment is allowed to carry meaning.
 *
 *   champagne on ivory     1.38:1   decoration only
 *   champagne on obsidian  9.56:1   AAA
 *   lagoon on ivory        8.45:1   AAA
 *   lagoon on obsidian     1.56:1   decoration only
 *
 * So in light, lagoon speaks and gold ornaments. In dark, gold speaks and lagoon
 * ornaments. Every ratio in the comments below is measured, not estimated, and
 * ContrastTest holds them.
 */

// ---- Pigments -------------------------------------------------------------

val Ivory = Color(0xFFF1ECE3)
val WarmAsh = Color(0xFFE2DACB)
val Obsidian = Color(0xFF08282C)

val Lagoon = Color(0xFF0D4A50)
val LagoonLight = Color(0xFF1E787E)

val Champagne = Color(0xFFE9C779)
val Bronze = Color(0xFF7A540F)

val Coral = Color(0xFFC45C4A)
val Amber = Color(0xFFC6891E)

// ---- Derived tones --------------------------------------------------------

internal val IvoryRaised = Color(0xFFF6F2EB)
internal val IvorySunk = Color(0xFFE8E1D4)

internal val ObsidianRaised = Color(0xFF0D3338)
internal val ObsidianRaisedHigh = Color(0xFF113C42)
internal val ObsidianRaisedHighest = Color(0xFF16464C)

private val CoralDeep = Color(0xFFA8412F)   // 5.16:1 on ivory
private val CoralError = Color(0xFF9E3B2B)  // 5.73:1 on ivory
private val CoralLight = Color(0xFFE89486)  // 6.67:1 on obsidian
private val BronzeDeep = Color(0xFF523709)  // carries champagne at 6.76:1

/**
 * Dark-mode error.
 *
 * Material's usual pale dark-mode red (#FFB4AB) is legible on obsidian but sits
 * only 1.44:1 away from ivory body text, so a failed upload reads as *text that
 * happens to be warm* rather than as an alarm. In light mode the error is
 * naturally darker than body text and earns 2.31:1 of separation for free; this
 * value is chosen to earn the same 2.32:1 in dark while still clearing AA on
 * both the background and the raised surface.
 */
private val ErrorLight = Color(0xFFF97463)

private val OutlineLight = Color(0xFF7C7264)        // 4.01:1 on ivory
private val OutlineVariantLight = Color(0xFFD6CDBB) // decorative hairline
private val OutlineDark = Color(0xFF5A8C92)         // 4.15:1 on obsidian
private val OutlineVariantDark = Color(0xFF1C4349)  // decorative hairline

private val LagoonPale = Color(0xFFD4E0E0)
private val MistOnDark = Color(0xFFC9D4D2)

/**
 * Champagne is deliberately absent from both colour schemes.
 *
 * At 1.38:1 on ivory it cannot be text, and the moment it is available as a
 * `ColorScheme` role someone will eventually assign it to one. Keeping it here
 * means a decorative pigment can only ever be reached decoratively — for the
 * Ascendant bead, hairlines, and the gold edge on a raised hero surface.
 */
object KayalAccent {
    val bead = Champagne
    val beadDeep = Bronze
    val hairlineOnDark = Champagne.copy(alpha = 0.22f)
    val hairlineOnLight = Bronze.copy(alpha = 0.14f)
}

// ---- Schemes --------------------------------------------------------------

val LightColors = lightColorScheme(
    primary = Lagoon,                       // 8.45:1 on ivory
    onPrimary = Ivory,
    primaryContainer = LagoonPale,
    onPrimaryContainer = Lagoon,

    secondary = Bronze,                     // 5.75:1 — the legible gold
    onSecondary = Ivory,
    secondaryContainer = WarmAsh,
    onSecondaryContainer = Bronze,          // 4.87:1 on WarmAsh

    tertiary = CoralDeep,                   // 5.16:1
    onTertiary = Ivory,

    background = Ivory,
    onBackground = Obsidian,                // 13.22:1
    surface = IvoryRaised,
    onSurface = Obsidian,                   // 13.94:1
    surfaceVariant = IvorySunk,
    onSurfaceVariant = Obsidian,            // 11.96:1

    surfaceContainerLowest = Color(0xFFFAF7F2),
    surfaceContainerLow = IvoryRaised,
    surfaceContainer = Ivory,
    surfaceContainerHigh = IvorySunk,
    surfaceContainerHighest = WarmAsh,

    error = CoralError,                     // 5.73:1
    onError = Ivory,

    outline = OutlineLight,                 // 4.01:1 — borders and focus rings
    outlineVariant = OutlineVariantLight,   // decorative dividers only
)

val DarkColors = darkColorScheme(
    primary = Champagne,                    // 9.56:1 on obsidian
    onPrimary = Obsidian,
    primaryContainer = BronzeDeep,          // plain Bronze holds champagne at
    onPrimaryContainer = Champagne,         // only 4.16:1 — deepened to 6.76:1

    secondary = Amber,                      // 5.18:1
    onSecondary = Obsidian,
    secondaryContainer = ObsidianRaisedHighest,
    onSecondaryContainer = Champagne,       // 6.41:1

    tertiary = CoralLight,                  // 6.67:1
    onTertiary = Obsidian,

    background = Obsidian,
    onBackground = Ivory,                   // 13.22:1
    surface = ObsidianRaised,
    onSurface = Ivory,                      // 11.53:1
    surfaceVariant = ObsidianRaisedHighest,
    onSurfaceVariant = MistOnDark,

    surfaceContainerLowest = Color(0xFF051E21),
    surfaceContainerLow = Obsidian,
    surfaceContainer = ObsidianRaised,
    surfaceContainerHigh = ObsidianRaisedHigh,
    surfaceContainerHighest = ObsidianRaisedHighest,

    error = ErrorLight,
    onError = Obsidian,

    outline = OutlineDark,                  // 4.15:1
    outlineVariant = OutlineVariantDark,
)

// ---- Contrast -------------------------------------------------------------

private fun channel(c: Float): Double {
    val v = c.toDouble()
    return if (v <= 0.03928) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4)
}

/** WCAG 2.1 relative luminance. */
fun relativeLuminance(c: Color): Double =
    0.2126 * channel(c.red) + 0.7152 * channel(c.green) + 0.0722 * channel(c.blue)

/**
 * WCAG 2.1 contrast ratio, 1.0..21.0. Order of arguments does not matter.
 * Body text needs 4.5, large text and UI borders need 3.0.
 */
fun contrastRatio(a: Color, b: Color): Double {
    val la = relativeLuminance(a)
    val lb = relativeLuminance(b)
    return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
}

// ---- Legacy aliases -------------------------------------------------------
//
// The scaffold's screens paint themselves with these constants directly rather
// than reading MaterialTheme.colorScheme — 160 call sites across nine files.
// Remapping the names onto Kayal pigments reskins every one of them at once
// without touching a screen, which is why they survive this commit.
//
// They are a migration aid, not part of the palette. Each later plan deletes
// the ones belonging to the screens it rewrites, and the last one deletes this
// block. Do not reach for them in new code: use MaterialTheme.colorScheme.

@Deprecated("Use MaterialTheme.colorScheme.primary", ReplaceWith("MaterialTheme.colorScheme.primary"))
val FetsDeepTeal = Lagoon

@Deprecated("Use MaterialTheme.colorScheme.background in dark, or Obsidian")
val FetsDeepTealDark = Obsidian

@Deprecated("Use MaterialTheme.colorScheme.surface")
val FetsTealSurface = ObsidianRaised

/** Was #FACC15 — a harsh yellow that also leaked into the status bar. */
@Deprecated("Decorative only. For text use MaterialTheme.colorScheme.secondary")
val FetsGold = Champagne

@Deprecated("Decorative only.")
val FetsGoldSoft = Color(0xFFF2DCA8)

@Deprecated("Use MaterialTheme.colorScheme.background")
val FetsPaper = Ivory

@Deprecated("Use MaterialTheme.colorScheme.surface")
val FetsPaperCard = IvoryRaised

@Deprecated("Use MaterialTheme.colorScheme.onBackground")
val FetsInk = Obsidian

@Deprecated("Use MaterialTheme.colorScheme.onSurfaceVariant")
val FetsInkMuted = Color(0xFF7C7264)

@Deprecated("Use MaterialTheme.colorScheme.error")
val FetsOpen = Color(0xFF9E3B2B)

@Deprecated("Use MaterialTheme.colorScheme.secondary")
val FetsProgress = Amber

/** Kayal carries no green. Resolved state reads as lagoon, which the palette owns. */
@Deprecated("Use MaterialTheme.colorScheme.primary")
val FetsClosed = LagoonLight
