package com.rusindu.calculator

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rusindu.calculator.ui.theme.RsCalculatorTheme

private enum class KeyStyle { Number, Function, Accent }

private data class Key(
    val label: String,
    val style: KeyStyle,
    val action: CalculatorAction,
    val weight: Float = 1f
)

private val keypad: List<List<Key>> = listOf(
    listOf(
        Key("AC", KeyStyle.Function, CalculatorAction.Clear),
        Key("( )", KeyStyle.Function, CalculatorAction.Parenthesis),
        Key("%", KeyStyle.Function, CalculatorAction.Percent),
        Key("÷", KeyStyle.Accent, CalculatorAction.Operator(CalculatorEngine.DIVIDE))
    ),
    listOf(
        Key("7", KeyStyle.Number, CalculatorAction.Digit('7')),
        Key("8", KeyStyle.Number, CalculatorAction.Digit('8')),
        Key("9", KeyStyle.Number, CalculatorAction.Digit('9')),
        Key("×", KeyStyle.Accent, CalculatorAction.Operator(CalculatorEngine.TIMES))
    ),
    listOf(
        Key("4", KeyStyle.Number, CalculatorAction.Digit('4')),
        Key("5", KeyStyle.Number, CalculatorAction.Digit('5')),
        Key("6", KeyStyle.Number, CalculatorAction.Digit('6')),
        Key("−", KeyStyle.Accent, CalculatorAction.Operator(CalculatorEngine.MINUS))
    ),
    listOf(
        Key("1", KeyStyle.Number, CalculatorAction.Digit('1')),
        Key("2", KeyStyle.Number, CalculatorAction.Digit('2')),
        Key("3", KeyStyle.Number, CalculatorAction.Digit('3')),
        Key("+", KeyStyle.Accent, CalculatorAction.Operator(CalculatorEngine.PLUS))
    ),
    listOf(
        Key("+/−", KeyStyle.Number, CalculatorAction.ToggleSign),
        Key("0", KeyStyle.Number, CalculatorAction.Digit('0')),
        Key(".", KeyStyle.Number, CalculatorAction.Decimal),
        Key("=", KeyStyle.Accent, CalculatorAction.Equals)
    )
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorScreen(
    state: CalculatorState,
    onAction: (CalculatorAction) -> Unit,
    modifier: Modifier = Modifier
) {
    var showHistory by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    Scaffold(
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = { showHistory = true }) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = stringResource(R.string.history),
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
                IconButton(onClick = { onAction(CalculatorAction.Delete) }) {
                    Icon(
                        imageVector = Icons.Default.Backspace,
                        contentDescription = "Delete",
                        tint = MaterialTheme.colorScheme.onBackground
                    )
                }
            }

            Display(
                state = state,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            )

            Keypad(onAction = onAction)

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showHistory) {
        ModalBottomSheet(
            onDismissRequest = { showHistory = false },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            HistorySheet(
                history = state.history,
                onEntryClick = {
                    onAction(CalculatorAction.UseHistory(it))
                    showHistory = false
                },
                onClear = { onAction(CalculatorAction.ClearHistory) }
            )
        }
    }
}

@Composable
private fun Display(state: CalculatorState, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Bottom,
        horizontalAlignment = Alignment.End
    ) {
        Text(
            text = state.expression.ifEmpty { "0" },
            style = MaterialTheme.typography.displayLarge,
            fontSize = if (state.expression.length > 12) 44.sp else 64.sp,
            color = MaterialTheme.colorScheme.onBackground,
            maxLines = 1,
            textAlign = TextAlign.End,
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState(), reverseScrolling = true)
        )

        Spacer(modifier = Modifier.height(8.dp))

        AnimatedVisibility(
            visible = state.preview.isNotEmpty() || state.error != null,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Text(
                text = state.error ?: "= ${state.preview}",
                style = MaterialTheme.typography.headlineMedium,
                color = if (state.error != null) {
                    MaterialTheme.colorScheme.error
                } else {
                    MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)
                },
                maxLines = 1
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun Keypad(onAction: (CalculatorAction) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        keypad.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                row.forEach { key ->
                    CalculatorButton(
                        key = key,
                        onClick = { onAction(key.action) },
                        modifier = Modifier.weight(key.weight)
                    )
                }
            }
        }
    }
}

@Composable
private fun CalculatorButton(
    key: Key,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MaterialTheme.colorScheme
    val background = when (key.style) {
        KeyStyle.Number -> colors.surfaceVariant
        KeyStyle.Function -> colors.secondary
        KeyStyle.Accent -> colors.primary
    }
    val contentColor = when (key.style) {
        KeyStyle.Number -> colors.onSurfaceVariant
        KeyStyle.Function -> colors.onSecondary
        KeyStyle.Accent -> colors.onPrimary
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clip(CircleShape)
            .background(background)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = key.label,
            color = contentColor,
            fontSize = if (key.label.length > 2) 22.sp else 30.sp
        )
    }
}

@Composable
private fun HistorySheet(
    history: List<HistoryEntry>,
    onEntryClick: (HistoryEntry) -> Unit,
    onClear: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .padding(bottom = 24.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.history),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface
            )
            if (history.isNotEmpty()) {
                TextButton(onClick = onClear) {
                    Text(stringResource(R.string.clear_history))
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        if (history.isEmpty()) {
            Text(
                text = stringResource(R.string.no_history),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                modifier = Modifier.padding(vertical = 32.dp)
            )
        } else {
            LazyColumn(modifier = Modifier.height(360.dp)) {
                items(history) { entry ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onEntryClick(entry) }
                            .padding(vertical = 12.dp, horizontal = 4.dp),
                        horizontalAlignment = Alignment.End
                    ) {
                        Text(
                            text = entry.expression,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Text(
                            text = "= ${entry.result}",
                            color = MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.titleLarge
                        )
                    }
                    HorizontalDivider(color = Color.Gray.copy(alpha = 0.2f))
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF101014)
@Composable
private fun CalculatorScreenPreview() {
    RsCalculatorTheme(dynamicColor = false, darkTheme = true) {
        Surface {
            CalculatorScreen(
                state = CalculatorState(expression = "12×(4+8)", preview = "144"),
                onAction = {}
            )
        }
    }
}
