package com.fets.live.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Event
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fets.live.data.CalendarSession
import com.fets.live.data.SessionManager
import com.fets.live.data.UiState
import com.fets.live.ui.components.EmptyState
import com.fets.live.ui.components.LoadingBlock
import com.fets.live.ui.components.SectionTitle
import com.fets.live.ui.theme.FetsDeepTeal
import com.fets.live.ui.theme.FetsDeepTealDark
import com.fets.live.ui.theme.FetsGold
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

private val DAY_LABELS = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

@Composable
fun CalendarScreen(session: SessionManager) {
    val branch by session.activeBranch.collectAsState()
    var month by remember { mutableStateOf(YearMonth.now()) }
    var selected by remember { mutableStateOf(LocalDate.now()) }
    var sessions by remember { mutableStateOf<UiState<List<CalendarSession>>>(UiState.Loading) }

    LaunchedEffect(month, branch) {
        sessions = UiState.Loading
        sessions = UiState.Ready(
            session.repository.loadSessionsForMonth(month.toString(), branch)
        )
    }

    val sessionsByDay = (sessions as? UiState.Ready)?.data
        ?.groupBy { it.date.take(10) } ?: emptyMap()

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SectionTitle(month.format(DateTimeFormatter.ofPattern("MMMM yyyy")))
                Row {
                    Text(
                        "‹",
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { month = month.minusMonths(1) }
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        color = FetsDeepTeal,
                    )
                    Text(
                        "›",
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { month = month.plusMonths(1) }
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        color = FetsDeepTeal,
                    )
                }
            }
        }

        item { MonthGrid(month, selected, sessionsByDay.keys) { day -> selected = day } }

        item { SectionTitle(selected.format(DateTimeFormatter.ofPattern("EEE, d MMM"))) }
        val daySessions = sessionsByDay[selected.toString()].orEmpty()
        if (sessions is UiState.Loading) {
            item { LoadingBlock("Loading sessions…") }
        } else if (daySessions.isEmpty()) {
            item { EmptyState(Icons.Outlined.Event, "No sessions", "Nothing scheduled at this centre on this day.") }
        } else {
            items(daySessions, key = { it.id }) { s ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(FetsGold.copy(alpha = 0.2f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Outlined.Event, contentDescription = null, tint = FetsDeepTeal)
                        }
                        Spacer(Modifier.padding(4.dp))
                        Column(Modifier.weight(1f).padding(start = 8.dp)) {
                            Text(
                                s.title,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.Bold,
                                color = FetsDeepTealDark,
                            )
                            Text(
                                listOfNotNull(s.startTime?.take(5), s.endTime?.take(5)).joinToString(" – ")
                                    .ifBlank { s.branchLocation ?: "" },
                                style = MaterialTheme.typography.bodySmall,
                                color = FetsDeepTealDark.copy(alpha = 0.5f),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MonthGrid(
    month: YearMonth,
    selected: LocalDate,
    busyDays: Set<String>,
    onSelect: (LocalDate) -> Unit,
) {
    val firstOfMonth = month.atDay(1)
    val offset = (firstOfMonth.dayOfWeek.value - 1) // Monday-first
    val daysInMonth = month.lengthOfMonth()
    val today = LocalDate.now()

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                DAY_LABELS.forEach { d ->
                    Text(
                        d.uppercase(),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = FetsDeepTeal.copy(alpha = 0.5f),
                        modifier = Modifier.weight(1f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            val cells = offset + daysInMonth
            val rows = (cells + 6) / 7
            for (row in 0 until rows) {
                Row(Modifier.fillMaxWidth()) {
                    for (col in 0 until 7) {
                        val idx = row * 7 + col - offset + 1
                        if (idx < 1 || idx > daysInMonth) {
                            Spacer(Modifier.weight(1f))
                        } else {
                            val day = month.atDay(idx)
                            val isSelected = day == selected
                            val isToday = day == today
                            val hasSessions = day.toString() in busyDays
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(0.9f)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isSelected -> FetsDeepTeal
                                            else -> androidx.compose.ui.graphics.Color.Transparent
                                        }
                                    )
                                    .clickable { onSelect(day) }
                                    .padding(4.dp),
                            ) {
                                Text(
                                    "$idx",
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = if (isToday) FontWeight.ExtraBold else FontWeight.Medium,
                                    color = when {
                                        isSelected -> FetsGold
                                        isToday -> FetsDeepTeal
                                        else -> FetsDeepTealDark.copy(alpha = 0.8f)
                                    },
                                )
                                Box(
                                    modifier = Modifier
                                        .size(4.dp)
                                        .clip(CircleShape)
                                        .background(
                                            when {
                                                hasSessions -> FetsGold
                                                else -> androidx.compose.ui.graphics.Color.Transparent
                                            }
                                        ),
                                )
                            }
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}
