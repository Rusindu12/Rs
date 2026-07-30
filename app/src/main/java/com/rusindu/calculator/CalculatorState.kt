package com.rusindu.calculator

/** A single finished calculation, shown in the history sheet. */
data class HistoryEntry(val expression: String, val result: String)

/** All the UI state the calculator screen needs. */
data class CalculatorState(
    val expression: String = "",
    val preview: String = "",
    val error: String? = null,
    val history: List<HistoryEntry> = emptyList()
)

/** Every button the user can press. */
sealed interface CalculatorAction {
    data class Digit(val value: Char) : CalculatorAction
    data class Operator(val symbol: Char) : CalculatorAction
    data object Decimal : CalculatorAction
    data object Parenthesis : CalculatorAction
    data object Percent : CalculatorAction
    data object ToggleSign : CalculatorAction
    data object Delete : CalculatorAction
    data object Clear : CalculatorAction
    data object Equals : CalculatorAction
    data object ClearHistory : CalculatorAction
    data class UseHistory(val entry: HistoryEntry) : CalculatorAction
}

/**
 * Pure state machine — no Android dependencies, so it is fully unit testable.
 */
object CalculatorReducer {

    private val operators = setOf(
        CalculatorEngine.PLUS,
        CalculatorEngine.MINUS,
        CalculatorEngine.TIMES,
        CalculatorEngine.DIVIDE
    )

    fun reduce(state: CalculatorState, action: CalculatorAction): CalculatorState =
        when (action) {
            is CalculatorAction.Digit -> withPreview(state.appendDigit(action.value))
            is CalculatorAction.Operator -> withPreview(state.appendOperator(action.symbol))
            CalculatorAction.Decimal -> withPreview(state.appendDecimal())
            CalculatorAction.Parenthesis -> withPreview(state.appendParenthesis())
            CalculatorAction.Percent -> withPreview(state.appendPercent())
            CalculatorAction.ToggleSign -> withPreview(state.toggleSign())
            CalculatorAction.Delete -> withPreview(
                state.copy(expression = state.expression.dropLast(1), error = null)
            )
            CalculatorAction.Clear -> state.copy(expression = "", preview = "", error = null)
            CalculatorAction.Equals -> state.evaluate()
            CalculatorAction.ClearHistory -> state.copy(history = emptyList())
            is CalculatorAction.UseHistory -> withPreview(
                state.copy(expression = action.entry.result, error = null)
            )
        }

    private fun withPreview(state: CalculatorState): CalculatorState {
        if (!CalculatorEngine.isPreviewable(state.expression)) {
            return state.copy(preview = "")
        }
        val value = CalculatorEngine.tryEvaluate(state.expression)
        return state.copy(preview = value?.let { CalculatorEngine.format(it) } ?: "")
    }

    private fun CalculatorState.appendDigit(digit: Char): CalculatorState {
        val base = if (expression == "0") "" else expression
        val separator = if (base.endsWith(")")) CalculatorEngine.TIMES.toString() else ""
        return copy(expression = base + separator + digit, error = null)
    }

    private fun CalculatorState.appendOperator(symbol: Char): CalculatorState {
        if (expression.isEmpty()) {
            // Only a leading minus makes sense.
            return if (symbol == CalculatorEngine.MINUS) copy(expression = symbol.toString(), error = null)
            else this
        }
        val last = expression.last()
        if (last == '(') {
            return if (symbol == CalculatorEngine.MINUS) copy(expression = expression + symbol, error = null)
            else this
        }
        // Replace a trailing operator instead of stacking them.
        val base = if (last in operators) expression.dropLast(1) else expression
        if (base.isEmpty()) {
            return if (symbol == CalculatorEngine.MINUS) copy(expression = symbol.toString(), error = null)
            else this
        }
        return copy(expression = base + symbol, error = null)
    }

    private fun CalculatorState.appendDecimal(): CalculatorState {
        val currentNumber = expression.takeLastWhile { it.isDigit() || it == '.' }
        if (currentNumber.contains('.')) return this
        val prefix = if (currentNumber.isEmpty()) "0" else ""
        return copy(expression = "$expression$prefix.", error = null)
    }

    private fun CalculatorState.appendParenthesis(): CalculatorState {
        val opened = expression.count { it == '(' }
        val closed = expression.count { it == ')' }
        val last = expression.lastOrNull()
        val canClose = opened > closed && last != null && last != '(' && last !in operators
        return if (canClose) {
            copy(expression = "$expression)", error = null)
        } else {
            val separator = if (last != null && (last.isDigit() || last == ')')) {
                CalculatorEngine.TIMES.toString()
            } else {
                ""
            }
            copy(expression = "$expression$separator(", error = null)
        }
    }

    private fun CalculatorState.appendPercent(): CalculatorState {
        val last = expression.lastOrNull() ?: return this
        if (!last.isDigit() && last != ')') return this
        return copy(expression = "$expression${CalculatorEngine.PERCENT}", error = null)
    }

    /** Flips the sign of the number currently being typed. */
    private fun CalculatorState.toggleSign(): CalculatorState {
        if (expression.isEmpty()) return copy(expression = CalculatorEngine.MINUS.toString())
        val numberStart = expression.indexOfLast { !it.isDigit() && it != '.' } + 1
        val number = expression.substring(numberStart)
        if (number.isEmpty()) return this
        val head = expression.substring(0, numberStart)
        return when {
            head.endsWith(CalculatorEngine.MINUS) && (head.length == 1 || head[head.length - 2] == '(') ->
                copy(expression = head.dropLast(1) + number, error = null)
            head.isEmpty() || head.last() == '(' ->
                copy(expression = head + CalculatorEngine.MINUS + number, error = null)
            else ->
                copy(expression = head + "(" + CalculatorEngine.MINUS + number, error = null)
        }
    }

    private fun CalculatorState.evaluate(): CalculatorState {
        if (expression.isBlank()) return this
        val balanced = expression + ")".repeat(
            (expression.count { it == '(' } - expression.count { it == ')' }).coerceAtLeast(0)
        )
        return try {
            val result = CalculatorEngine.format(CalculatorEngine.evaluate(balanced))
            copy(
                expression = result,
                preview = "",
                error = null,
                history = (listOf(HistoryEntry(balanced, result)) + history).take(50)
            )
        } catch (e: Exception) {
            copy(preview = "", error = e.message ?: "Invalid expression")
        }
    }
}
