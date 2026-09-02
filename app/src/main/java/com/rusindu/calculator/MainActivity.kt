package com.rusindu.calculator

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rusindu.calculator.ui.theme.RsCalculatorTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            RsCalculatorTheme {
                val viewModel: CalculatorViewModel = viewModel()
                val state by viewModel.state.collectAsState()
                Surface(modifier = Modifier.fillMaxSize()) {
                    CalculatorScreen(
                        state = state,
                        onAction = viewModel::onAction
                    )
                }
            }
        }
    }
}
