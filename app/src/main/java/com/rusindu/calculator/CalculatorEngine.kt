package com.rusindu.calculator

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.roundToLong

/**
 * A small recursive-descent expression evaluator.
 *
 * Grammar:
 *   expression := term (('+' | '-') term)*
 *   term       := factor (('x' | '/') factor)*
 *   factor     := unary ('^' factor)?
 *   unary      := ('-' | '+')* primary ('%')*
 *   primary    := number | '(' expression ')'
 *
 * Supported display characters: 0-9 . + - × ÷ ( ) %
 */
object CalculatorEngine {

    const val PLUS = '+'
    const val MINUS = '−'
    const val TIMES = '×'
    const val DIVIDE = '÷'
    const val PERCENT = '%'

    private val operators = setOf(PLUS, MINUS, TIMES, DIVIDE, '^')

    class ExpressionException(message: String) : Exception(message)

    /**
     * Evaluates [expression] and returns the numeric result.
     * Throws [ExpressionException] when the expression is malformed
     * or the result is not a finite number (e.g. division by zero).
     */
    fun evaluate(expression: String): Double {
        val cleaned = expression.replace(" ", "").replace(",", "")
        if (cleaned.isEmpty()) throw ExpressionException("Empty expression")
        val parser = Parser(cleaned)
        val value = parser.parseExpression()
        parser.expectEnd()
        if (value.isNaN() || value.isInfinite()) throw ExpressionException("Can't divide by zero")
        return value
    }

    /** Evaluates but returns null instead of throwing. Handy for the live preview. */
    fun tryEvaluate(expression: String): Double? = try {
        evaluate(expression)
    } catch (e: Exception) {
        null
    }

    /** True when the expression is "complete enough" to show a live preview. */
    fun isPreviewable(expression: String): Boolean {
        val trimmed = expression.trim()
        if (trimmed.isEmpty()) return false
        // Needs at least one binary operator to be worth previewing.
        val hasOperator = trimmed.drop(1).any { it in operators }
        return hasOperator && trimmed.last() !in operators && trimmed.last() != '.'
    }

    /**
     * Formats a double for display: drops the trailing ".0" of whole numbers,
     * keeps up to 10 decimals and falls back to scientific notation for
     * very large / very small magnitudes.
     */
    fun format(value: Double): String {
        if (value.isNaN() || value.isInfinite()) return "Error"
        if (value == 0.0) return "0"

        val magnitude = abs(value)
        if (magnitude >= 1e12 || magnitude < 1e-9) {
            return String.format("%.6E", value)
                .replace("E", "e")
                .replace(Regex("0+e"), "e")
                .replace(Regex("\\.e"), "e")
        }

        val rounded = roundTo(value, 10)
        if (rounded == floor(rounded) && abs(rounded) < 1e15) {
            return groupThousands(rounded.roundToLong().toString())
        }

        var text = String.format("%.10f", rounded).trimEnd('0').trimEnd('.')
        val negative = text.startsWith("-")
        if (negative) text = text.substring(1)
        val parts = text.split(".")
        val grouped = groupThousands(parts[0]) + if (parts.size > 1) "." + parts[1] else ""
        return if (negative) "-$grouped" else grouped
    }

    private fun roundTo(value: Double, decimals: Int): Double {
        val factor = 10.0.pow(decimals)
        return Math.round(value * factor) / factor
    }

    private fun groupThousands(digits: String): String {
        val negative = digits.startsWith("-")
        val raw = if (negative) digits.substring(1) else digits
        val grouped = raw.reversed().chunked(3).joinToString(",").reversed()
        return if (negative) "-$grouped" else grouped
    }

    private class Parser(private val input: String) {
        private var pos = 0

        private fun peek(): Char? = input.getOrNull(pos)

        fun expectEnd() {
            if (pos != input.length) {
                throw ExpressionException("Unexpected '${input[pos]}'")
            }
        }

        fun parseExpression(): Double {
            var value = parseTerm()
            while (true) {
                when (peek()) {
                    PLUS, '+' -> { pos++; value += parseTerm() }
                    MINUS, '-' -> { pos++; value -= parseTerm() }
                    else -> return value
                }
            }
        }

        private fun parseTerm(): Double {
            var value = parseFactor()
            while (true) {
                when (peek()) {
                    TIMES, '*' -> { pos++; value *= parseFactor() }
                    DIVIDE, '/' -> {
                        pos++
                        val divisor = parseFactor()
                        if (divisor == 0.0) throw ExpressionException("Can't divide by zero")
                        value /= divisor
                    }
                    // Implicit multiplication: 2(3+4) or (1+2)(3+4)
                    '(' -> value *= parseFactor()
                    else -> return value
                }
            }
        }

        private fun parseFactor(): Double {
            val base = parseUnary()
            return if (peek() == '^') {
                pos++
                base.pow(parseFactor())
            } else {
                base
            }
        }

        private fun parseUnary(): Double {
            var sign = 1.0
            while (true) {
                when (peek()) {
                    MINUS, '-' -> { pos++; sign = -sign }
                    PLUS, '+' -> pos++
                    else -> break
                }
            }
            var value = sign * parsePrimary()
            while (peek() == PERCENT) {
                pos++
                value /= 100.0
            }
            return value
        }

        private fun parsePrimary(): Double {
            val c = peek() ?: throw ExpressionException("Unexpected end of expression")
            if (c == '(') {
                pos++
                val value = parseExpression()
                if (peek() != ')') throw ExpressionException("Missing ')'")
                pos++
                return value
            }
            if (c.isDigit() || c == '.') {
                val start = pos
                var seenDot = false
                while (true) {
                    val ch = peek() ?: break
                    if (ch.isDigit()) {
                        pos++
                    } else if (ch == '.' && !seenDot) {
                        seenDot = true
                        pos++
                    } else {
                        break
                    }
                }
                val text = input.substring(start, pos)
                return text.toDoubleOrNull()
                    ?: throw ExpressionException("Invalid number '$text'")
            }
            throw ExpressionException("Unexpected '$c'")
        }
    }
}
