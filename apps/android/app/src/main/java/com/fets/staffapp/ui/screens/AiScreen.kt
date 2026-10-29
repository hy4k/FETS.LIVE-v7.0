package com.fets.staffapp.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.fets.staffapp.data.SessionManager
import com.fets.staffapp.ui.theme.FetsDeepTeal
import com.fets.staffapp.ui.theme.FetsDeepTealDark
import com.fets.staffapp.ui.theme.FetsGold
import kotlinx.coroutines.launch
import java.util.UUID

private data class ChatMessage(val id: String, val role: String, val text: String)

@Composable
fun AiScreen(session: SessionManager) {
    val branch by session.activeBranch.collectAsState()
    val messages = remember { mutableStateListOf<ChatMessage>() }
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .imePadding(),
    ) {
        Text(
            "FETS Intelligence",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.ExtraBold,
            color = FetsDeepTealDark,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )

        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (messages.isEmpty()) {
                item {
                    Card(
                        shape = RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(containerColor = FetsGold.copy(alpha = 0.16f)),
                    ) {
                        Text(
                            "Ask about today's roster, candidate counts, shift handovers, or any centre operations. I answer from the live FETS knowledge base.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = FetsDeepTealDark,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                }
            }
            items(messages, key = { it.id }) { m ->
                val isUser = m.role == "user"
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
                ) {
                    Card(
                        shape = RoundedCornerShape(
                            topStart = 18.dp, topEnd = 18.dp,
                            bottomStart = if (isUser) 18.dp else 4.dp,
                            bottomEnd = if (isUser) 4.dp else 18.dp,
                        ),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isUser) FetsDeepTeal else MaterialTheme.colorScheme.surface,
                        ),
                        modifier = Modifier.widthIn(max = 300.dp),
                    ) {
                        Text(
                            m.text,
                            style = MaterialTheme.typography.bodyMedium,
                            color = if (isUser) FetsGold else FetsDeepTealDark,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }
            }
            notice?.let {
                item {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(horizontal = 8.dp),
                    )
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it; notice = null },
                placeholder = { Text("Ask FETS Intelligence…") },
                shape = RoundedCornerShape(22.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = FetsDeepTeal,
                    cursorColor = FetsDeepTeal,
                ),
                modifier = Modifier.weight(1f),
                maxLines = 4,
            )
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .background(FetsDeepTeal, RoundedCornerShape(18.dp)),
            ) {
                IconButton(
                    onClick = {
                        val text = input.trim()
                        if (text.isBlank() || busy) return@IconButton
                        input = ""
                        busy = true
                        notice = null
                        messages.add(ChatMessage(UUID.randomUUID().toString(), "user", text))
                        scope.launch {
                            val history = messages.takeLast(8).map { it.role to it.text }
                            session.repository.askAgent(branch, "ai", text, history)
                                .onSuccess { reply ->
                                    messages.add(ChatMessage(UUID.randomUUID().toString(), "assistant", reply))
                                }
                                .onFailure { notice = it.message ?: "Could not reach the assistant." }
                            busy = false
                        }
                    },
                    enabled = !busy && input.isNotBlank(),
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Send",
                        tint = FetsGold,
                    )
                }
            }
        }
    }
}
