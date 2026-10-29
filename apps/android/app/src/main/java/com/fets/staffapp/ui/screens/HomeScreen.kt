package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Work
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.staffapp.data.CASE_CATEGORIES
import com.fets.staffapp.data.HomeSnapshot
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.StaffProfile
import com.fets.staffapp.data.UiState
import com.fets.staffapp.ui.components.EmptyState
import com.fets.staffapp.ui.components.LoadingBlock
import com.fets.staffapp.ui.components.SectionTitle
import com.fets.staffapp.ui.components.StatCard
import com.fets.staffapp.ui.components.StatusChip
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import java.time.LocalTime

@Composable
fun HomeScreen(
    session: SessionManager,
    profile: StaffProfile,
    onOpenCase: () -> Unit,
    onOpenOnDuty: () -> Unit,
    onOpenCandidates: () -> Unit,
    onOpenAi: () -> Unit,
    onOpenCases: () -> Unit,
) {
    val branch by session.activeBranch.collectAsState()
    var snapshot by remember { mutableStateOf<UiState<HomeSnapshot>>(UiState.Loading) }

    LaunchedEffect(branch) {
        snapshot = UiState.Loading
        snapshot = UiState.Ready(session.repository.loadHomeSnapshot(branch))
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { GreetingHeader(profile, branch) }

        when (val s = snapshot) {
            UiState.Loading -> item { LoadingBlock("Loading live centre data…") }
            is UiState.Error -> item { EmptyState(Icons.Outlined.Notifications, "Could not load", s.message) }
            is UiState.Ready -> {
                val data = s.data
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(
                            label = "Candidates Today",
                            value = "${data.candidatesToday}",
                            icon = Icons.Outlined.School,
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            label = "Open Cases",
                            value = "${data.openCases}",
                            icon = Icons.Outlined.Notifications,
                            accent = androidx.compose.ui.graphics.Color(0xFFF87171),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCard(
                            label = "Staff Present",
                            value = "${data.staffPresent}",
                            icon = Icons.Outlined.People,
                            accent = androidx.compose.ui.graphics.Color(0xFF34D399),
                            modifier = Modifier.weight(1f),
                        )
                        StatCard(
                            label = "Sessions Today",
                            value = "${data.sessionsToday}",
                            icon = Icons.Outlined.Work,
                            accent = androidx.compose.ui.graphics.Color(0xFF60A5FA),
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                if (data.news.isNotEmpty()) {
                    item { SectionTitle("Centre Wire") }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            items(data.news, key = { it.id }) { item ->
                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = FetsGold.copy(alpha = 0.16f)
                                    ),
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Icon(
                                            Icons.Outlined.Newspaper,
                                            contentDescription = null,
                                            tint = FetsDeepTeal,
                                            modifier = Modifier.size(16.dp),
                                        )
                                        Spacer(Modifier.width(8.dp))
                                        Text(
                                            item.text,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = FetsDeepTealDark,
                                            modifier = Modifier.widthIn(max = 260.dp),
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                item { SectionTitle("Quick Actions") }
                item {
                    QuickActions(
                        onOpenCase = onOpenCase,
                        onOpenOnDuty = onOpenOnDuty,
                        onOpenCandidates = onOpenCandidates,
                        onOpenAi = onOpenAi,
                    )
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        SectionTitle("Open Cases")
                        Text(
                            "View all",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = FetsDeepTeal,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable(onClick = onOpenCases)
                                .padding(4.dp),
                        )
                    }
                }
                if (data.recentCases.isEmpty()) {
                    item { EmptyState(Icons.Outlined.Notifications, "No open cases", "The floor is clear. Nice work.") }
                } else {
                    items(data.recentCases, key = { it.id }) { incident ->
                        IncidentRow(incident)
                    }
                }
                item { Spacer(Modifier.height(8.dp)) }
            }
        }
    }
}

@Composable
private fun GreetingHeader(profile: StaffProfile, branch: String) {
    val greeting = when (LocalTime.now().hour) {
        in 5..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        else -> "Good evening"
    }
    val firstName = profile.fullName.trim().split(" ").firstOrNull().orEmpty()
    val branchLabel = when (branch) {
        "calicut" -> "Calicut HQ"
        "cochin" -> "Cochin Center"
        else -> "Global View"
    }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = "$greeting, $firstName",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.ExtraBold,
                color = FetsDeepTealDark,
            )
            Text(
                text = branchLabel,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.Bold,
                color = FetsDeepTeal.copy(alpha = 0.6f),
            )
        }
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(FetsDeepTeal),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                (firstName.take(1) + profile.fullName.trim().split(" ").getOrNull(1)?.take(1)).uppercase(),
                color = FetsGold,
                fontWeight = FontWeight.ExtraBold,
            )
        }
    }
}

@Composable
private fun QuickActions(
    onOpenCase: () -> Unit,
    onOpenOnDuty: () -> Unit,
    onOpenCandidates: () -> Unit,
    onOpenAi: () -> Unit,
) {
    val actions = listOf(
        Quad("Open Case", Icons.Outlined.Add, FetsDeepTeal, FetsGold, onOpenCase),
        Quad("On Duty", Icons.Outlined.Groups, FetsDeepTeal, androidx.compose.ui.graphics.Color(0xFF34D399), onOpenOnDuty),
        Quad("Candidates", Icons.Outlined.School, FetsDeepTeal, androidx.compose.ui.graphics.Color(0xFF60A5FA), onOpenCandidates),
        Quad("AI Desk", Icons.Outlined.Psychology, FetsDeepTeal, androidx.compose.ui.graphics.Color(0xFFA78BFA), onOpenAi),
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        actions.forEach { (label, icon, bg, fg, onClick) ->
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = bg),
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onClick),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(fg.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        label.uppercase(),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = 1.sp,
                        color = androidx.compose.ui.graphics.Color.White,
                    )
                }
            }
        }
    }
}

private data class Quad(
    val label: String,
    val icon: ImageVector,
    val bg: androidx.compose.ui.graphics.Color,
    val fg: androidx.compose.ui.graphics.Color,
    val onClick: () -> Unit,
)

@Composable
fun IncidentRow(incident: com.fets.staffapp.data.Incident) {
    val category = CASE_CATEGORIES.find { it.id == incident.category }
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(
                        androidx.compose.ui.graphics.Color(category?.color ?: 0xFF94A3B8)
                    ),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    incident.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = FetsDeepTealDark,
                    maxLines = 1,
                )
                Text(
                    "${category?.label ?: incident.category} · ${incident.reporter}",
                    style = MaterialTheme.typography.bodySmall,
                    color = FetsDeepTealDark.copy(alpha = 0.5f),
                )
            }
            StatusChip(incident.status)
        }
    }
}
