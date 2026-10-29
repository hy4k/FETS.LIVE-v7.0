package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.School
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
import com.fets.staffapp.data.Candidate
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.data.UiState
import com.fets.staffapp.ui.components.EmptyState
import com.fets.staffapp.ui.components.LoadingBlock
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import java.time.LocalDate

@Composable
fun CandidatesScreen(session: SessionManager) {
    val branch by session.activeBranch.collectAsState()
    var date by remember { mutableStateOf(LocalDate.now()) }
    var candidates by remember { mutableStateOf<UiState<List<Candidate>>>(UiState.Loading) }

    LaunchedEffect(date, branch) {
        candidates = UiState.Loading
        candidates = UiState.Ready(session.repository.loadCandidatesFor(date, branch))
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
                "Candidate Register",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.ExtraBold,
                color = FetsDeepTealDark,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    date.toString(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = FetsDeepTealDark.copy(alpha = 0.6f),
                )
                Row {
                    Text(
                        "‹ Prev",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = FetsDeepTeal,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { date = date.minusDays(1) }
                            .padding(6.dp),
                    )
                    Text(
                        "Next ›",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = FetsDeepTeal,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .clickable { date = date.plusDays(1) }
                            .padding(6.dp),
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
        }

        when (val s = candidates) {
            UiState.Loading -> item { LoadingBlock("Loading the register…") }
            is UiState.Error -> item { EmptyState(Icons.Outlined.School, "Could not load", s.message) }
            is UiState.Ready -> {
                if (s.data.isEmpty()) {
                    item { EmptyState(Icons.Outlined.School, "No candidates", "No exams scheduled at this centre on this day.") }
                } else {
                    items(s.data, key = { it.id }) { c ->
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
                                androidx.compose.foundation.layout.Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(FetsGold.copy(alpha = 0.25f)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Text(
                                        c.name.trim().take(1).uppercase().ifBlank { "?" },
                                        color = FetsDeepTeal,
                                        fontWeight = FontWeight.ExtraBold,
                                    )
                                }
                                Spacer(Modifier.padding(6.dp))
                                Column(Modifier.padding(start = 8.dp)) {
                                    Text(
                                        c.name,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = FetsDeepTealDark,
                                    )
                                    Text(
                                        listOfNotNull(c.module, c.status).joinToString(" · ")
                                            .ifBlank { c.examDate?.take(16) ?: "" },
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
