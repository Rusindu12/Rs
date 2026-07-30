package com.rusindu.calculator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CalculatorReducerTest {

    private fun state(vararg actions: CalculatorAction): CalculatorState =
        actions.fold(CalculatorState()) { acc, action -> CalculatorReducer.reduce(acc, action) }

    @Test
    fun `typing digits builds the expression`() {
        val s = state(
            CalculatorAction.Digit('1'),
            CalculatorAction.Digit('2'),
            CalculatorAction.Digit('3')
        )
        assertEquals("123", s.expression)
    }

    @Test
    fun `operator replaces a trailing operator`() {
        val s = state(
            CalculatorAction.Digit('5'),
            CalculatorAction.Operator(CalculatorEngine.PLUS),
            CalculatorAction.Operator(CalculatorEngine.TIMES)
        )
        assertEquals("5×", s.expression)
    }

    @Test
    fun `leading decimal gets a zero prefix`() {
        assertEquals("0.", state(CalculatorAction.Decimal).expression)
    }

    @Test
    fun `only one decimal point per number`() {
        val s = state(
            CalculatorAction.Digit('1'),
            CalculatorAction.Decimal,
            CalculatorAction.Digit('5'),
            CalculatorAction.Decimal
        )
        assertEquals("1.5", s.expression)
    }

    @Test
    fun `parenthesis opens then closes`() {
        var s = state(CalculatorAction.Parenthesis)
        assertEquals("(", s.expression)
        s = CalculatorReducer.reduce(s, CalculatorAction.Digit('2'))
        s = CalculatorReducer.reduce(s, CalculatorAction.Parenthesis)
        assertEquals("(2)", s.expression)
    }

    @Test
    fun `equals computes result and records history`() {
        val s = state(
            CalculatorAction.Digit('6'),
            CalculatorAction.Operator(CalculatorEngine.TIMES),
            CalculatorAction.Digit('7'),
            CalculatorAction.Equals
        )
        assertEquals("42", s.expression)
        assertEquals(1, s.history.size)
        assertEquals("6×7", s.history.first().expression)
    }

    @Test
    fun `equals auto balances parentheses`() {
        val s = state(
            CalculatorAction.Digit('2'),
            CalculatorAction.Operator(CalculatorEngine.TIMES),
            CalculatorAction.Parenthesis,
            CalculatorAction.Digit('3'),
            CalculatorAction.Operator(CalculatorEngine.PLUS),
            CalculatorAction.Digit('4'),
            CalculatorAction.Equals
        )
        assertEquals("14", s.expression)
    }

    @Test
    fun `live preview appears for complete expressions`() {
        val s = state(
            CalculatorAction.Digit('8'),
            CalculatorAction.Operator(CalculatorEngine.PLUS),
            CalculatorAction.Digit('2')
        )
        assertEquals("10", s.preview)
    }

    @Test
    fun `division by zero surfaces an error`() {
        val s = state(
            CalculatorAction.Digit('1'),
            CalculatorAction.Operator(CalculatorEngine.DIVIDE),
            CalculatorAction.Digit('0'),
            CalculatorAction.Equals
        )
        assertNotNull(s.error)
        assertTrue(s.history.isEmpty())
    }

    @Test
    fun `clear resets the expression but keeps history`() {
        var s = state(
            CalculatorAction.Digit('9'),
            CalculatorAction.Operator(CalculatorEngine.PLUS),
            CalculatorAction.Digit('1'),
            CalculatorAction.Equals
        )
        s = CalculatorReducer.reduce(s, CalculatorAction.Clear)
        assertEquals("", s.expression)
        assertEquals(1, s.history.size)
    }

    @Test
    fun `delete removes the last character`() {
        val s = state(
            CalculatorAction.Digit('1'),
            CalculatorAction.Digit('2'),
            CalculatorAction.Delete
        )
        assertEquals("1", s.expression)
    }

    @Test
    fun `toggle sign flips the current number`() {
        var s = state(CalculatorAction.Digit('5'), CalculatorAction.ToggleSign)
        assertEquals("−5", s.expression)
        s = CalculatorReducer.reduce(s, CalculatorAction.ToggleSign)
        assertEquals("5", s.expression)
    }

    @Test
    fun `history entry can be reused`() {
        val entry = HistoryEntry("2+2", "4")
        val s = CalculatorReducer.reduce(CalculatorState(), CalculatorAction.UseHistory(entry))
        assertEquals("4", s.expression)
    }
}
