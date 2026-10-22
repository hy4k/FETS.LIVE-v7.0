package com.fets.live.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.live.ui.theme.FetsDeepTeal
import com.fets.live.ui.theme.FetsDeepTealDark
import com.fets.live.ui.theme.FetsGold

data class NavTab(val route: String, val label: String, val icon: ImageVector)

/** Floating sovereign bottom bar — matches the web mobile shell. */
@Composable
fun FetsBottomBar(
    tabs: List<NavTab>,
    currentRoute: String?,
    onSelect: (String) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(FetsDeepTealDark.copy(alpha = 0.96f))
            .border(1.dp, FetsGold.copy(alpha = 0.12f), RoundedCornerShape(24.dp)),
    ) {
        NavigationBar(
            containerColor = Color.Transparent,
            tonalElevation = 0.dp,
            modifier = Modifier.height(64.dp),
        ) {
            tabs.forEach { tab ->
                val selected = currentRoute == tab.route
                NavigationBarItem(
                    selected = selected,
                    onClick = { onSelect(tab.route) },
                    icon = {
                        Icon(
                            imageVector = tab.icon,
                            contentDescription = tab.label,
                            modifier = Modifier.size(22.dp),
                        )
                    },
                    label = {
                        Text(
                            text = tab.label.uppercase(),
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Clip,
                        )
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = FetsGold,
                        selectedTextColor = FetsGold,
                        unselectedIconColor = Color.White.copy(alpha = 0.38f),
                        unselectedTextColor = Color.White.copy(alpha = 0.38f),
                        indicatorColor = FetsGold.copy(alpha = 0.12f),
                    ),
                )
            }
        }
    }
}

@Composable
fun ScreenHeader(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.ExtraBold,
            color = FetsDeepTealDark,
        )
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = FetsDeepTealDark.copy(alpha = 0.6f),
        )
    }
}

@Composable
fun StatCard(
    label: String,
    value: String,
    icon: ImageVector,
    accent: Color = FetsGold,
    modifier: Modifier = Modifier,
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = FetsDeepTeal),
        modifier = modifier,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(accent.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
            )
            Text(
                text = label.uppercase(),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = Color.White.copy(alpha = 0.55f),
            )
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 1.6.sp,
        color = FetsDeepTeal.copy(alpha = 0.7f),
        modifier = modifier,
    )
}

@Composable
fun StatusChip(status: String) {
    val (bg, fg) = when (status.lowercase()) {
        "open" -> Color(0xFFFEE2E2) to Color(0xFFB91C1C)
        "in_progress", "assigned", "escalated" -> Color(0xFFFEF3C7) to Color(0xFFB45309)
        else -> Color(0xFFD1FAE5) to Color(0xFF047857)
    }
    Text(
        text = status.replace('_', ' ').uppercase(),
        fontSize = 8.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 1.sp,
        color = fg,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
fun LoadingBlock(message: String = "Loading…") {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        CircularProgressIndicator(color = FetsDeepTeal)
        Spacer(Modifier.height(12.dp))
        Text(message, color = FetsDeepTealDark.copy(alpha = 0.6f))
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, message: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = FetsDeepTeal.copy(alpha = 0.3f), modifier = Modifier.size(44.dp))
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.Bold, color = FetsDeepTealDark)
        Spacer(Modifier.height(4.dp))
        Text(
            message,
            style = MaterialTheme.typography.bodySmall,
            color = FetsDeepTealDark.copy(alpha = 0.55f),
        )
    }
}

/** Gold-on-teal brand monogram used on the sign-in screen. */
@Composable
fun FetsMonogram(size: Int = 96) {
    Box(
        modifier = Modifier
            .size(size.dp)
            .clip(RoundedCornerShape(size.dp / 4))
            .background(
                Brush.linearGradient(listOf(FetsDeepTeal, FetsDeepTealDark))
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "F",
            fontSize = (size * 0.52).sp,
            fontWeight = FontWeight.Black,
            color = FetsGold,
        )
    }
}
