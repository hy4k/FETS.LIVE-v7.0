package com.fets.staffapp.ui.theme

import android.graphics.BlurMaskFilter
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * Kayal Relief depth.
 *
 * Every raised form carries a shadow below-right *and* a pale bloom above-left,
 * balanced so that neither is separately noticeable. One light source, high and
 * to the upper-left, with no exceptions anywhere in the app — that consistency
 * is what separates this from decoration.
 *
 * ## Where this may be used
 *
 * Hero surfaces only: the home banner, the dock, the Floor capture button, the
 * launch screen and the login card. Each of these draws once per frame and is
 * the thing the eye lands on first.
 *
 * **Not list items.** A hundred rows each running their own blurred double-draw
 * is where scroll performance dies, and at row scale the swell is invisible
 * anyway. Rows use [kayalRow], which is Material 3 tonal elevation and costs
 * nothing. If you are reaching for [kayalRaised] inside a `LazyColumn` item,
 * reach for [kayalRow] instead.
 */

// Tuned against the render plate, not guessed. The first pass used a 0.55 bloom
// over a 2.2x blur: on obsidian that produced a visible teal halo that read as a
// glow rather than as light catching an edge, and on ivory the shadow spread so
// far it went grey and muddy. Shadows here describe millimetres of elevation.
private const val SHADOW_ALPHA = 0.28f
private const val BLOOM_ALPHA = 0.30f
private const val BLUR_RATIO = 1.6f

/** The light sits upper-left, so depth offsets always run down and to the right. */
private val LIGHT_DIRECTION = Offset(-1f, -1f)

/**
 * Lifts [content]'s background out of the surface it sits on.
 *
 * @param elevation how many millimetres of relief to report. Shadows stay wide,
 *   soft and short-throw; this is not a drop shadow and should never read as one.
 * @param face the colour of the lifted form's own surface.
 * @param bloom the pale light catching the upper-left edge — usually a lightened
 *   face colour, never white in light mode or the form reads as glass.
 * @param shadow the colour cast below-right. A hue-matched dark, not black:
 *   black on ivory goes grey and kills the warmth.
 */
fun Modifier.kayalRaised(
    shape: Shape,
    elevation: Dp = 6.dp,
    face: Color,
    bloom: Color,
    shadow: Color,
): Modifier = this
    .drawBehind {
        val path = shape.outlinePath(size, layoutDirection, this)
        val throw_ = elevation.toPx()
        val blur = throw_ * BLUR_RATIO

        // bloom first, so the shadow can never be lightened by it
        drawBlurredPath(path, bloom.copy(alpha = BLOOM_ALPHA), blur, Offset(LIGHT_DIRECTION.x * throw_ * 0.7f, LIGHT_DIRECTION.y * throw_ * 0.7f))
        drawBlurredPath(path, shadow.copy(alpha = SHADOW_ALPHA), blur, Offset(-LIGHT_DIRECTION.x * throw_, -LIGHT_DIRECTION.y * throw_))
    }
    .clip(shape)
    .background(
        // The face is lit by the same source: a touch brighter at the upper-left
        // corner, a touch deeper at the lower-right. Two percent, not ten.
        Brush.linearGradient(
            colors = listOf(bloom.copy(alpha = 0.30f), face, shadow.copy(alpha = 0.06f)),
        )
    )

/**
 * Sinks [content]'s background into the surface — the shallow basin that a text
 * field or a segmented control sits in.
 *
 * This is the exact inverse of [kayalRaised]: Compose has no inner shadow, so
 * the illusion comes from a gradient running the other way plus a hairline
 * catching light along the lower-right lip.
 */
fun Modifier.kayalRecessed(
    shape: Shape,
    depth: Dp = 4.dp,
    face: Color,
    bloom: Color,
    shadow: Color,
): Modifier = this
    .clip(shape)
    .background(
        Brush.linearGradient(
            colors = listOf(shadow.copy(alpha = 0.14f), face, bloom.copy(alpha = 0.22f)),
        )
    )
    .drawBehind {
        val path = shape.outlinePath(size, layoutDirection, this)
        drawBlurredPath(path, bloom.copy(alpha = 0.35f), depth.toPx() * 1.6f, Offset(depth.toPx() * 0.5f, depth.toPx() * 0.5f))
    }

/**
 * The correct treatment for anything that repeats: list rows, grid tiles inside
 * a scrolling container, chips. Material 3 tonal elevation, one draw, no blur.
 */
@Composable
fun Modifier.kayalRow(shape: Shape, container: Color): Modifier =
    this.clip(shape).background(container)

/**
 * A hero surface with the depth already applied, so call sites cannot forget the
 * light direction or pass a white bloom.
 */
@Composable
fun KayalHero(
    modifier: Modifier = Modifier,
    shape: Shape = KayalHeroShape,
    elevation: Dp = 8.dp,
    palette: KayalDepth = KayalDepth.fromTheme(),
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier.kayalRaised(
            shape = shape,
            elevation = elevation,
            face = palette.face,
            bloom = palette.bloom,
            shadow = palette.shadow,
        ),
        content = content,
    )
}

/**
 * The three tones a relief needs, derived once from the active scheme so light
 * and dark both get a hue-matched shadow rather than black.
 */
data class KayalDepth(val face: Color, val bloom: Color, val shadow: Color) {
    companion object {
        @Composable
        fun fromTheme(): KayalDepth {
            val scheme = androidx.compose.material3.MaterialTheme.colorScheme
            val dark = relativeLuminance(scheme.background) < 0.2
            return if (dark) {
                KayalDepth(
                    face = scheme.surfaceContainerHigh,
                    // LagoonLight here halos. The bloom is a *lifted face*, not a
                    // light of its own, so it stays within a step of the face.
                    bloom = Color(0xFF1B4A50),
                    shadow = Color(0xFF020E10),
                )
            } else {
                KayalDepth(
                    // A hero on ivory must be lighter than the ground or the form
                    // reads as a shadow with nothing casting it.
                    face = scheme.surfaceContainerLowest,
                    bloom = Color(0xFFFFFFFF),
                    shadow = Lagoon,
                )
            }
        }
    }
}

// ---- internals -----------------------------------------------------------

private fun DrawScope.drawBlurredPath(path: Path, color: Color, blurPx: Float, offset: Offset) {
    if (blurPx <= 0f) return
    drawIntoCanvas { canvas ->
        val paint = Paint()
        paint.asFrameworkPaint().apply {
            isAntiAlias = true
            this.color = color.toArgb()
            maskFilter = BlurMaskFilter(blurPx, BlurMaskFilter.Blur.NORMAL)
        }
        canvas.save()
        canvas.translate(offset.x, offset.y)
        canvas.nativeCanvas.drawPath(path.asAndroidPath(), paint.asFrameworkPaint())
        canvas.restore()
    }
}

/** Any [Shape] reduced to a [Path] so it can be blurred and offset. */
fun Shape.outlinePath(size: Size, layoutDirection: LayoutDirection, density: Density): Path =
    when (val outline = createOutline(size, layoutDirection, density)) {
        is Outline.Rectangle -> Path().apply { addRect(outline.rect) }
        is Outline.Rounded -> Path().apply { addRoundRect(outline.roundRect) }
        is Outline.Generic -> outline.path
    }
