package com.fets.staffapp.ui.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp

/**
 * A superelliptical ("squircle") corner.
 *
 * `RoundedCornerShape` draws a circular arc, which meets the straight edge with
 * an abrupt jump in curvature — the seam the Kayal Relief philosophy refuses.
 * This shape instead swells outward before it turns: the corner occupies a span
 * of `radius * (1 + smoothing)`, and each corner is drawn as two mirrored cubic
 * Béziers meeting on the 45° diagonal, with tangents pinned flat at the edges
 * and diagonal at the join. The eye never catches a seam.
 *
 * `smoothing` 0f reduces exactly to a circular arc, so the shape degrades
 * gracefully and the arithmetic can be checked against a known value — which is
 * what SquircleTest does.
 *
 * It extends [CornerBasedShape] rather than plain `Shape` because Material 3's
 * shape scale requires that type. Kayal uses uniform corners, so where the four
 * corner sizes differ the smallest wins; nothing in the design asks for mixed
 * corners, and silently drawing one would be worse than normalising.
 */
class SquircleShape(
    topStart: CornerSize,
    topEnd: CornerSize,
    bottomEnd: CornerSize,
    bottomStart: CornerSize,
    val smoothing: Float = DEFAULT_SMOOTHING,
) : CornerBasedShape(topStart, topEnd, bottomEnd, bottomStart) {

    constructor(radius: Dp, smoothing: Float = DEFAULT_SMOOTHING) : this(
        CornerSize(radius), CornerSize(radius), CornerSize(radius), CornerSize(radius), smoothing,
    )

    override fun createOutline(
        size: Size,
        topStart: Float,
        topEnd: Float,
        bottomEnd: Float,
        bottomStart: Float,
        layoutDirection: LayoutDirection,
    ): Outline {
        val radius = minOf(topStart, topEnd, bottomEnd, bottomStart)
        if (radius <= 0f) return Outline.Rectangle(Rect(Offset.Zero, size))
        val span = (radius * (1f + smoothing)).coerceAtMost(minOf(size.width, size.height) / 2f)
        if (span <= 0f) return Outline.Rectangle(Rect(Offset.Zero, size))
        return Outline.Generic(squirclePath(size, span, smoothing))
    }

    override fun copy(
        topStart: CornerSize,
        topEnd: CornerSize,
        bottomEnd: CornerSize,
        bottomStart: CornerSize,
    ): CornerBasedShape = SquircleShape(topStart, topEnd, bottomEnd, bottomStart, smoothing)

    override fun toString() = "SquircleShape(topStart=$topStart, smoothing=$smoothing)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SquircleShape) return false
        return topStart == other.topStart &&
            topEnd == other.topEnd &&
            bottomEnd == other.bottomEnd &&
            bottomStart == other.bottomStart &&
            smoothing == other.smoothing
    }

    override fun hashCode(): Int {
        var result = topStart.hashCode()
        result = 31 * result + topEnd.hashCode()
        result = 31 * result + bottomEnd.hashCode()
        result = 31 * result + bottomStart.hashCode()
        result = 31 * result + smoothing.hashCode()
        return result
    }

    companion object {
        /** Tuned by eye against the Kayal plate. 0f is a plain circular arc. */
        const val DEFAULT_SMOOTHING = 0.6f

        /** Cubic handle length for a 45° circular arc of unit radius. */
        const val KAPPA_45 = 0.2654f

        /** Where the 45° point of a unit circular arc sits, measured from the corner. */
        const val DIAGONAL_45 = 0.2929f
    }
}

/** One step of the outline. Pure data, so the geometry can be tested on the JVM. */
sealed interface SquircleOp {
    data class MoveTo(val x: Float, val y: Float) : SquircleOp
    data class LineTo(val x: Float, val y: Float) : SquircleOp
    data class CubicTo(
        val c1x: Float, val c1y: Float,
        val c2x: Float, val c2y: Float,
        val x: Float, val y: Float,
    ) : SquircleOp
}

/**
 * The outline as control points, with no Android dependency.
 *
 * `android.graphics.Path` is stubbed in JVM unit tests, so a test that builds a
 * [Path] and inspects its bounds passes whatever the arithmetic does — which is
 * exactly how two earlier geometry tests came to pass vacuously. Keeping the
 * maths here, and leaving [squirclePath] as a thin adapter, means the part that
 * can be wrong is the part that is tested.
 */
fun squircleOps(size: Size, span: Float, smoothing: Float): List<SquircleOp> {
    val w = size.width
    val h = size.height
    val s = span.coerceAtMost(minOf(w, h) / 2f)

    val d = s * SquircleShape.DIAGONAL_45 * (1f - 0.25f * smoothing)
    val e = s * SquircleShape.KAPPA_45 * (1f + 0.35f * smoothing)
    val g = (s * SquircleShape.KAPPA_45 * (1f - 0.20f * smoothing)) / 1.41421356f

    return listOf(
        SquircleOp.MoveTo(s, 0f),
        SquircleOp.LineTo(w - s, 0f),
        SquircleOp.CubicTo(w - s + e, 0f, w - d - g, d - g, w - d, d),
        SquircleOp.CubicTo(w - d + g, d + g, w, s - e, w, s),

        SquircleOp.LineTo(w, h - s),
        SquircleOp.CubicTo(w, h - s + e, w - d + g, h - d - g, w - d, h - d),
        SquircleOp.CubicTo(w - d - g, h - d + g, w - s + e, h, w - s, h),

        SquircleOp.LineTo(s, h),
        SquircleOp.CubicTo(s - e, h, d + g, h - d + g, d, h - d),
        SquircleOp.CubicTo(d - g, h - d - g, 0f, h - s + e, 0f, h - s),

        SquircleOp.LineTo(0f, s),
        SquircleOp.CubicTo(0f, s - e, d - g, d + g, d, d),
        SquircleOp.CubicTo(d + g, d - g, s - e, 0f, s, 0f),
    )
}

/** Thin adapter: replays [squircleOps] into a [Path]. */
fun squirclePath(size: Size, span: Float, smoothing: Float): Path = Path().apply {
    for (op in squircleOps(size, span, smoothing)) {
        when (op) {
            is SquircleOp.MoveTo -> moveTo(op.x, op.y)
            is SquircleOp.LineTo -> lineTo(op.x, op.y)
            is SquircleOp.CubicTo -> cubicTo(op.c1x, op.c1y, op.c2x, op.c2y, op.x, op.y)
        }
    }
    close()
}

/**
 * Material 3 shape scale, squircled.
 *
 * `extraSmall` stays a plain rounded rectangle: below roughly 8dp the swell is
 * smaller than a pixel on most screens, so paying for a generic outline there
 * buys nothing. Everything the user actually reads as a *form* is a squircle.
 */
val KayalShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = SquircleShape(10.dp),
    medium = SquircleShape(18.dp),
    large = SquircleShape(26.dp),
    extraLarge = SquircleShape(36.dp),
)

/** The dock, the banner and the capture button are the largest forms in the app. */
val KayalHeroShape = SquircleShape(32.dp)

/** Degenerate by design: the span clamps to half the shorter side, giving a capsule. */
val KayalBeadShape = SquircleShape(999.dp)
