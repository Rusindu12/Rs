import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen } from '../components/ui';
import { colors } from '../theme';

/**
 * 📖 සිංහල උපදෙස් — the full app guide in Sinhala, so everything about the
 * bot is understandable without any English.
 */
export function GuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <Card>
        <Text style={styles.h1}>📖 AI Trading Bot — සිංහල උපදෙස්</Text>
        <Text style={styles.p}>
          මේ app එකෙන් Binance crypto වෙළඳපොළ AI බුද්ධියෙන් trade කරනවා. පහළින් සියලුම දේ සිංහලෙන්
          පැහැදිලි කරලා තියෙනවා.
        </Text>
      </Card>

      <Card>
        <Text style={styles.h2}>🚀 පටන් ගන්නේ කොහොමද?</Text>
        <Bullet t="Setup screen එකේ Skip → demo mode" d="API keys අවශ්‍ය නෑ. $10,000 simulated funds වලින් paper trading එකේම bot එක තනියෙම start වෙනවා." />
        <Bullet t="API keys දාන්න ඕන නම්" d="Binance → API Management → Create API (Spot & Margin Trading enable) → Testnet පළවෙනියටම try කරන්න." />
        <Bullet t="▶ Start" d="Dashboard එකේ Start ඔබලා bot එක run කරන්න (demo එකේ auto)." />
      </Card>

      <Card>
        <Text style={styles.h2}>💹 BUY / SELL වෙන විදිහ</Text>
        <Bullet t="🟢 BUY" d="AI එකට මිල නැගිටියි වගේ පේනවා නම් coin එකක් ගන්නවා. ⚡ Signals tab එකෙන්ම 'Buy now' ඔබලා manually ද ගන්න පුළුවන්." />
        <Bullet t="⚪ HOLD" d="Market එක neutral — AI එක බලාගෙන ඉන්නවා. Score ≥ 20 ගියොත් (Normal mode) BUY වෙනවා." />
        <Bullet t="🔴 SELL — විදිහ 5ක්" d="🎯 take-profit · 🛑 stop-loss · 🔻 AI sell signal · 🔄 AI bearish උනාම · ⏱ max hold කාලය ඉවර වුණාම. ගත්ත හැම coin එකක්ම කවදාහරි විකුණෙනවා." />
        <Bullet t="💹 Activity tab" d="හැම buy/sell එකක්ම ක්ෂණිකම මෙතන පේනවා — PnL සහ හේතුව සමඟ." />
      </Card>

      <Card>
        <Text style={styles.h2}>⚙️ Trade Frequency (Settings → Bot)</Text>
        <Bullet t="🧊 Chill" d="Score ≥ 30 — ආරක්ෂිත, ට්‍රේඩ් අඩුවෙන්." />
        <Bullet t="⚖️ Normal" d="Score ≥ 20 — recommended. හොඳ සමතුලිතයක්." />
        <Bullet t="🚀 Turbo" d="Score ≥ 8 — ගොඩක් ට්‍රේඩ්, noise ද එනවා." />
        <Bullet t="⏱ Close trades after" d="පැය ගණනකට පස්සේ position එකක් තියෙනවා නම් market එකට විකුණනවා (0 = off)." />
      </Card>

      <Card>
        <Text style={styles.h2}>📴 Offline වුණොත්?</Text>
        <Bullet t="Demo mode" d="Simulated prices වලින් trading එක continue වෙනවා — නවතින්නේ නෑ." />
        <Bullet t="Live mode" d="හැම position එකකම SL/TP **Binance server එකේ** තියෙනවා (OCO). Phone එක off වුණත්, internet නැතුළත් Binance එකේම sell වෙනවා. ආපහු online ආවම auto-sync." />
        <Bullet t="Background (Android)" d="App එක close කරලා දාපුවත් ~15 min පාවෙන් bot එක scan කරනවා. Phone reboot වුණත් ආයෙත් පටන් ගන්නවා." />
      </Card>

      <Card>
        <Text style={styles.h2}>🔔 Notifications</Text>
        <Text style={styles.p}>Settings → 🔔 Trade alerts ON නම්, bot එක buy/sell කරපු ගමන්ම phone එකට notification එනවා.</Text>
      </Card>

      <Card>
        <Text style={styles.h2}>🩺 ගැටලු තිබ්බොත්</Text>
        <Bullet t="Trades වෙන්නේ නැත්නම්" d="1️⃣ Settings → 🩺 Engine Diagnostics බලන්න (data host, failures). 2️⃣ Trade frequency → Normal හෝ Turbo. 3️⃣ Dashboard එකේ ▶ Start ඔබලාද බලන්න." />
        <Bullet t="වැරදි වුණොත්" d="🚨 Emergency Stop එකෙන් හැම position එකක්ම ක්ෂණිකම close කරන්න පුළුවන්." />
      </Card>

      <Card>
        <Text style={styles.h2}>⚠️ අවදානම් අනතුරු ඇඟවීම</Text>
        <Text style={styles.p}>
          Crypto trading වල ලාභයත් අලාභයත් තියෙනවා. AI එක 100% නිවැරදි නෑ — මේක මූල්‍ය උපදෙසක් නෙවෙයි.
          Testnet / demo වලින් පළවෙනියටම පුහුණු වෙන්න, live ගියොත් පොඩි මුදල් වලින් පටන් ගන්න, නැති වෙත්නම්
          නැති වෙන සල්ලි කවදාවත් දාන්නේ නෑ.
        </Text>
      </Card>

      <Button label="← ආපසු" tone="ghost" onPress={onBack} />
    </Screen>
  );
}

function Bullet({ t, d }: { t: string; d: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletTitle}>• {t}</Text>
      <Text style={styles.bulletBody}>{d}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.gold, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  h2: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  p: { color: colors.textDim, fontSize: 12, lineHeight: 20 },
  bullet: { marginBottom: 9 },
  bulletTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  bulletBody: { color: colors.textDim, fontSize: 11, lineHeight: 18, marginTop: 2, paddingLeft: 12 },
});
