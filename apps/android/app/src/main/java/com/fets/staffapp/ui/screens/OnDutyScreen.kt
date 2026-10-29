package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import com.fets.staffapp.data.StaffAttendance
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.UiState
import com.fets.staffapp.ui.components.EmptyState
import com.fets.staffapp.ui.components.LoadingBlock
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import java.time.LocalTime
import java.time.format.DateTimeFormatter

@Composable
fun OnDutyScreen(session: SessionManager) {
    val branch by session.activeBranch.collectAsState()
    var staff by remember { mutableStateOf<UiState<List<StaffAttendance>>>(UiState.Loading) }

    LaunchedEffect(branch) {
        staff = UiState.Loading
        staff = UiState.Ready(session.repository.loadOnDutyToday(branch))
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "On Duty Today",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold,
                color = FetsDeepTealDark,
            )
            Text(
                "Staff who checked in at this centre today.",
                style = MaterialTheme.typography.bodyMedium,
                color = FetsDeepTealDark.copy(alpha = 0.6f),
            )
            Spacer(Modifier.height(4.dp))
        }

        when (val s = staff) {
            UiState.Loading -> item { LoadingBlock("Checking who's in…") }
            is UiState.Error -> item { EmptyState(Icons.Outlined.Groups, "Could not load", s.message) }
            is UiState.Ready -> {
                val present = s.data.filter { !it.checkIn.isNullOrBlank() }
                if (present.isEmpty()) {
                    item { EmptyState(Icons.Outlined.Groups, "Nobody checked in yet", "Check-ins for today will appear here.") }
                } else {
                    items(present, key = { "${it.staffId}-${it.checkIn}" }) { a ->
                        val initials = (a.staffId ?: "?").take(2).uppercase()
                        Card(
                            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                androidx.compose.foundation.layout.Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(FetsDeepTeal),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(initials, color = FetsGold, fontWeight = FontWeight.ExtraBold)
                                }
                                Spacer(Modifier.padding(6.dp))
                                Column(Modifier.padding(start = 8.dp)) {
                                    Text(
                                        "Staff · ${a.branchLocation ?: "—"}",
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = FetsDeepTealDark,
                                    )
                                    val checkIn = a.checkIn?.take(5) ?: ""
                                    val label = if (checkIn.isNotBlank()) {
                                        "Checked in $checkIn"
                                    } else ""
                                    Text(
                                        label,
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
    }
}
