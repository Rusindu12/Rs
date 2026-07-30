package com.rusindu.calculator

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CalculatorEngineTest {

    private fun eval(expr: String) = CalculatorEngine.evaluate(expr)

    @Test
    fun `adds and subtracts`() {
        assertEquals(7.0, eval("3+4"), 1e-9)
        assertEquals(-1.0, eval("3−4"), 1e-9)
    }

    @Test
    fun `respects operator precedence`() {
        assertEquals(14.0, eval("2+3×4"), 1e-9)
        assertEquals(20.0, eval("(2+3)×4"), 1e-9)
    }

    @Test
    fun `handles division`() {
        assertEquals(2.5, eval("5÷2"), 1e-9)
    }

    @Test
    fun `handles percentages`() {
        assertEquals(0.5, eval("50%"), 1e-9)
        assertEquals(20.0, eval("200×10%"), 1e-9)
    }

    @Test
    fun `handles unary minus`() {
        assertEquals(-5.0, eval("−5"), 1e-9)
        assertEquals(8.0, eval("3−−5"), 1e-9)
    }

    @Test
    fun `handles implicit multiplication`() {
        assertEquals(14.0, eval("2(3+4)"), 1e-9)
    }

    @Test(expected = CalculatorEngine.ExpressionException::class)
    fun `division by zero throws`() {
        eval("1÷0")
    }

    @Test(expected = CalculatorEngine.ExpressionException::class)
    fun `unbalanced parenthesis throws`() {
        eval("(1+2")
    }

    @Test
    fun `tryEvaluate returns null on error`() {
        assertNull(CalculatorEngine.tryEvaluate("1+"))
    }

    @Test
    fun `formats whole numbers without decimals`() {
        assertEquals("144", CalculatorEngine.format(144.0))
        assertEquals("1,000", CalculatorEngine.format(1000.0))
        assertEquals("-42", CalculatorEngine.format(-42.0))
    }

    @Test
    fun `formats fractions`() {
        assertEquals("2.5", CalculatorEngine.format(2.5))
        assertEquals("0.3333333333", CalculatorEngine.format(1.0 / 3.0))
    }
}
