package com.fets.staffapp.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The palette is shown to exam partners and government officers, and used by
 * staff in dim exam halls. These tests are the contract that it stays legible
 * in both places — and specifically that the decorative gold never quietly
 * becomes a text colour.
 */
class ContrastTest {

    private val AA = 4.5
    private val AA_LARGE = 3.0

    // ---- the formula itself ----------------------------------------------

    @Test
    fun `contrast of a colour with itself is one`() {
        assertEquals(1.0, contrastRatio(Ivory, Ivory), 0.001)
    }

    @Test
    fun `black on white is the known maximum`() {
        assertEquals(21.0, contrastRatio(Color.Black, Color.White), 0.01)
    }

    @Test
    fun `argument order does not matter`() {
        assertEquals(
            contrastRatio(Obsidian, Ivory),
            contrastRatio(Ivory, Obsidian),
            0.0001,
        )
    }

    // ---- body text, both schemes -----------------------------------------

    @Test
    fun `light scheme body text on background meets AA`() {
        assertTrue(contrastRatio(LightColors.onBackground, LightColors.background) >= AA)
    }

    @Test
    fun `light scheme body text on surface meets AA`() {
        assertTrue(contrastRatio(LightColors.onSurface, LightColors.surface) >= AA)
    }

    @Test
    fun `dark scheme body text on background meets AA`() {
        assertTrue(contrastRatio(DarkColors.onBackground, DarkColors.background) >= AA)
    }

    @Test
    fun `dark scheme body text on surface meets AA`() {
        assertTrue(contrastRatio(DarkColors.onSurface, DarkColors.surface) >= AA)
    }

    @Test
    fun `every on-colour pairing in both schemes meets AA`() {
        for ((name, scheme) in listOf("light" to LightColors, "dark" to DarkColors)) {
            for ((role, pair) in scheme.onPairings()) {
                val ratio = contrastRatio(pair.second, pair.first)
                assertTrue(
                    "$name scheme: $role is ${"%.2f".format(ratio)}:1, needs $AA:1",
                    ratio >= AA,
                )
            }
        }
    }

    @Test
    fun `every surface container tier carries body text in both schemes`() {
        val light = listOf(
            LightColors.surfaceContainerLowest, LightColors.surfaceContainerLow,
            LightColors.surfaceContainer, LightColors.surfaceContainerHigh,
            LightColors.surfaceContainerHighest,
        )
        for (tier in light) {
            assertTrue(contrastRatio(LightColors.onSurface, tier) >= AA)
        }
        val dark = listOf(
            DarkColors.surfaceContainerLowest, DarkColors.surfaceContainerLow,
            DarkColors.surfaceContainer, DarkColors.surfaceContainerHigh,
            DarkColors.surfaceContainerHighest,
        )
        for (tier in dark) {
            assertTrue(contrastRatio(DarkColors.onSurface, tier) >= AA)
        }
    }

    // ---- borders and focus rings -----------------------------------------

    @Test
    fun `outline reaches the three to one needed for borders and focus`() {
        assertTrue(contrastRatio(LightColors.outline, LightColors.background) >= AA_LARGE)
        assertTrue(contrastRatio(DarkColors.outline, DarkColors.background) >= AA_LARGE)
    }

    @Test
    fun `outlineVariant stays subtle enough to read as a hairline`() {
        // Decorative dividers only. If this ever rises past 3:1 someone has
        // started using it as a border, which belongs to `outline`.
        assertTrue(contrastRatio(LightColors.outlineVariant, LightColors.background) < AA_LARGE)
        assertTrue(contrastRatio(DarkColors.outlineVariant, DarkColors.background) < AA_LARGE)
    }

    // ---- the gold trap ----------------------------------------------------

    @Test
    fun `champagne on ivory is far below legibility`() {
        // Measured 1.38:1. This test documents *why* champagne is not a role.
        assertTrue(contrastRatio(Champagne, Ivory) < 2.0)
    }

    @Test
    fun `champagne is never a text role in the light scheme`() {
        for (role in LightColors.textRoles()) {
            assertFalse(
                "champagne must not be a light-scheme text colour",
                role == Champagne,
            )
        }
    }

    @Test
    fun `the legible gold is bronze and it is the one used in light`() {
        assertTrue(contrastRatio(Bronze, Ivory) >= AA)
        assertEquals(Bronze, LightColors.secondary)
    }

    @Test
    fun `champagne is legible on obsidian and is used there`() {
        assertTrue(contrastRatio(Champagne, Obsidian) >= AA)
        assertEquals(Champagne, DarkColors.primary)
    }

    @Test
    fun `lagoon inverts the gold - strong in light, decorative in dark`() {
        assertTrue(contrastRatio(Lagoon, Ivory) >= AA)
        assertTrue(contrastRatio(Lagoon, Obsidian) < AA_LARGE)
        assertEquals(Lagoon, LightColors.primary)
    }

    // ---- error states -----------------------------------------------------

    @Test
    fun `error text is legible in both schemes`() {
        assertTrue(contrastRatio(LightColors.error, LightColors.background) >= AA)
        assertTrue(contrastRatio(DarkColors.error, DarkColors.background) >= AA)
        assertTrue(contrastRatio(LightColors.onError, LightColors.error) >= AA)
        assertTrue(contrastRatio(DarkColors.onError, DarkColors.error) >= AA)
    }

    @Test
    fun `error is distinguishable from the plain surface, not just legible`() {
        // A staff member glancing at a failed upload must see *red*, not dark text.
        assertTrue(contrastRatio(LightColors.error, LightColors.onSurface) >= 1.5)
        assertTrue(contrastRatio(DarkColors.error, DarkColors.onSurface) >= 1.5)
    }
}

// ---- helpers -------------------------------------------------------------

/** The role pairs Material 3 guarantees are used as background-to-foreground. */
private fun ColorScheme.onPairings(): List<Pair<String, Pair<Color, Color>>> = listOf(
    "primary/onPrimary" to (primary to onPrimary),
    "primaryContainer/onPrimaryContainer" to (primaryContainer to onPrimaryContainer),
    "secondary/onSecondary" to (secondary to onSecondary),
    "secondaryContainer/onSecondaryContainer" to (secondaryContainer to onSecondaryContainer),
    "tertiary/onTertiary" to (tertiary to onTertiary),
    "background/onBackground" to (background to onBackground),
    "surface/onSurface" to (surface to onSurface),
    "surfaceVariant/onSurfaceVariant" to (surfaceVariant to onSurfaceVariant),
    "error/onError" to (error to onError),
)

/** Every role in the scheme that text is ever painted in. */
private fun ColorScheme.textRoles(): List<Color> = listOf(
    onBackground, onSurface, onSurfaceVariant, onPrimary, onSecondary, onTertiary,
    onPrimaryContainer, onSecondaryContainer, onError,
    primary, secondary, tertiary, error,
)
