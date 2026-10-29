package com.fets.staffapp.ui.theme

import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * The squircle is drawn by hand rather than with RoundedCornerShape, so the
 * geometry needs holding.
 *
 * These test [squircleOps], not [squirclePath]. android.graphics.Path is stubbed
 * in JVM unit tests, so assertions on a built Path's bounds pass regardless of
 * the arithmetic — an earlier version of this file did exactly that and reported
 * green for geometry it never evaluated.
 */
class SquircleTest {

    private val size = Size(400f, 200f)

    private fun points(span: Float, smoothing: Float): List<Pair<Float, Float>> =
        squircleOps(size, span, smoothing).flatMap {
            when (it) {
                is SquircleOp.MoveTo -> listOf(it.x to it.y)
                is SquircleOp.LineTo -> listOf(it.x to it.y)
                is SquircleOp.CubicTo -> listOf(it.c1x to it.c1y, it.c2x to it.c2y, it.x to it.y)
            }
        }

    // ---- the anchor ------------------------------------------------------

    @Test
    fun `at zero smoothing the diagonal point lands on the circle`() {
        // If this holds, the control-point arithmetic reproduces a true quarter
        // circle, and the smoothing term is only bending a known-good curve.
        val span = 100f
        val d = span * SquircleShape.DIAGONAL_45
        val exact = span - span / sqrt(2f)
        assertEquals(exact.toDouble(), d.toDouble(), 0.05)
    }

    @Test
    fun `at zero smoothing the handle is the known 45 degree kappa`() {
        assertEquals(0.2654, SquircleShape.KAPPA_45.toDouble(), 0.0005)
    }

    // ---- bounds ----------------------------------------------------------

    @Test
    fun `every control point stays inside the shape`() {
        val p = points(span = 60f, smoothing = 0.6f)
        assertTrue(p.all { it.first >= -0.01f && it.first <= size.width + 0.01f })
        assertTrue(p.all { it.second >= -0.01f && it.second <= size.height + 0.01f })
    }

    @Test
    fun `the outline reaches all four edges`() {
        val p = points(span = 60f, smoothing = 0.6f)
        assertEquals(0.0, p.minOf { it.first }.toDouble(), 0.01)
        assertEquals(0.0, p.minOf { it.second }.toDouble(), 0.01)
        assertEquals(size.width.toDouble(), p.maxOf { it.first }.toDouble(), 0.01)
        assertEquals(size.height.toDouble(), p.maxOf { it.second }.toDouble(), 0.01)
    }

    @Test
    fun `a span larger than the shape is clamped rather than inverted`() {
        val small = Size(100f, 40f)
        val p = squircleOps(small, span = 500f, smoothing = 0.6f).flatMap {
            when (it) {
                is SquircleOp.MoveTo -> listOf(it.x to it.y)
                is SquircleOp.LineTo -> listOf(it.x to it.y)
                is SquircleOp.CubicTo -> listOf(it.c1x to it.c1y, it.c2x to it.c2y, it.x to it.y)
            }
        }
        assertTrue(p.all { it.first in -0.01f..(small.width + 0.01f) })
        assertTrue(p.all { it.second in -0.01f..(small.height + 0.01f) })
    }

    // ---- continuity — the whole point of the shape ------------------------

    @Test
    fun `the outline is closed and every segment joins the last`() {
        val ops = squircleOps(size, span = 60f, smoothing = 0.6f)
        var cx = 0f
        var cy = 0f
        ops.forEachIndexed { i, op ->
            when (op) {
                is SquircleOp.MoveTo -> { cx = op.x; cy = op.y }
                is SquircleOp.LineTo -> { cx = op.x; cy = op.y }
                is SquircleOp.CubicTo -> { cx = op.x; cy = op.y }
            }
            if (i == ops.lastIndex) {
                val start = ops.first() as SquircleOp.MoveTo
                assertEquals(start.x.toDouble(), cx.toDouble(), 0.01)
                assertEquals(start.y.toDouble(), cy.toDouble(), 0.01)
            }
        }
    }

    @Test
    fun `the first cubic leaves the top edge horizontally`() {
        // A tangent that is not flat at the edge is the curvature seam the whole
        // shape exists to avoid.
        val ops = squircleOps(size, span = 60f, smoothing = 0.6f)
        val lineTo = ops[1] as SquircleOp.LineTo
        val cubic = ops[2] as SquircleOp.CubicTo
        assertEquals(
            "control point must sit on the top edge, y=0",
            lineTo.y.toDouble(), cubic.c1y.toDouble(), 0.001,
        )
        assertTrue("control point must run along the edge", cubic.c1x > lineTo.x)
    }

    @Test
    fun `the two cubics of a corner meet at 45 degrees`() {
        val ops = squircleOps(size, span = 60f, smoothing = 0.6f)
        val first = ops[2] as SquircleOp.CubicTo   // ends at the diagonal point
        val second = ops[3] as SquircleOp.CubicTo  // leaves it

        val inDx = first.x - first.c2x
        val inDy = first.y - first.c2y
        val outDx = second.c1x - first.x
        val outDy = second.c1y - first.y

        assertEquals("incoming tangent is 45 degrees", abs(inDx).toDouble(), abs(inDy).toDouble(), 0.01)
        assertEquals("outgoing tangent is 45 degrees", abs(outDx).toDouble(), abs(outDy).toDouble(), 0.01)
        // same direction on both sides of the join, so no kink
        assertTrue(inDx * outDx > 0f && inDy * outDy > 0f)
    }

    // ---- the smoothing parameter -----------------------------------------

    @Test
    fun `smoothing pulls the corner outward, toward the square`() {
        val circular = squircleOps(size, 80f, 0f)[2] as SquircleOp.CubicTo
        val squircled = squircleOps(size, 80f, 0.6f)[2] as SquircleOp.CubicTo
        // the diagonal point moves closer to the corner as smoothing rises
        assertTrue(
            "smoothing must move the 45 degree point outward",
            squircled.x > circular.x,
        )
    }

    @Test
    fun `zero smoothing and default smoothing are genuinely different shapes`() {
        assertTrue(squircleOps(size, 80f, 0f) != squircleOps(size, 80f, SquircleShape.DEFAULT_SMOOTHING))
    }
}
