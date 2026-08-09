# Bybit Fib Reversal Bot — Phone (Android) එකෙන් සම්පූර්ණයෙන්ම Setup කරන විදිය

⚠️ **වැදගත්:** මේක real money වලින් auto trade place කරන bot එකක්. Testnet එකේ දවස් ගානක් test කරලා, strategy එකේ result confirm වුනාට පස්සෙයි live (mainnet) money එකට යන්න. මුදල් අහිමි වෙන risk එක *ඔයාගේ* responsibility එකයි — මේක financial advice නෙවෙයි.

Computer එකක් ඕන නෑ. මේ ටික සම්පූර්ණයෙන්ම Android phone එකේ, browser එකයි Termux app එකයි විතරක් use කරලා කරන්න පුළුවන්.

---

## 0. මුලින්ම ඕන දේවල්

- Android phone එක
- Bybit account එකක් (Testnet + Mainnet දෙකම)
- GitHub account එකක්
- Netlify account එකක් (free)
- **Termux** app එක

---

## 1. Termux install කරන්න

Play Store එකේ Termux එක පරණයි, වැඩ කරන්නේ නෑ. මේකෙන් ගන්න:

👉 https://f-droid.org/en/packages/com.termux/ (F-Droid — recommend කරන්නේ මේක)

F-Droid app එක නැත්නම් download කරලා install කරන්න, ඊට පස්සේ ඒකෙන් Termux search කරලා install කරන්න.

## 2. Termux setup කරන්න

Termux open කරලා මේවා type කරලා (එකින් එක Enter එබලා) run කරන්න:

```
pkg update -y
pkg install git unzip nodejs -y
termux-setup-storage
```

Storage permission එකක් ask කරයි — **Allow** කරන්න.

## 3. Zip file එක Termux එකට ගන්න

Claude chat එකේ දුන්න `bybit-fib-bot.zip` file එක phone එකේ **Downloads** folder එකට download/save කරගන්න (Claude app එකේ file card එකේ share/save button එකෙන්).

ඊට පස්සේ Termux එකේ:

```
cd storage/downloads
unzip bybit-fib-bot.zip
cd bybit-fib-bot
```

`ls` type කරලා check කරන්න — `public`, `strategy`, `lib`, `netlify`, `README.md` වගේ files/folders පේනවා නම් හරි.

## 4. Git repo එකක් local ව හදන්න

```
git init
git add .
git commit -m "Initial commit"
```

## 5. GitHub එකේ empty repo එකක් හදන්න

Phone browser එකෙන් **github.com** → login → උඩ දකුණේ **+** icon → **New repository** → name එකක් දාන්න (`bybit-fib-bot`) → **Public** හෝ **Private** (දෙකම OK) → README/gitignore/license **add නොකර** → **Create repository**.

## 6. GitHub Personal Access Token එකක් හදන්න

Push කරන්න password එකෙන් වැඩ කරන්නේ නෑ, token එකක් ඕන:

GitHub → profile photo (උඩ දකුණේ) → **Settings** → පහළට scroll කරලා **Developer settings** → **Personal access tokens → Tokens (classic)** → **Generate new token (classic)** → note එකක් දාන්න → **repo** scope එක ✅ tick කරන්න → පහළට ගිහින් **Generate token** → token එක copy කරගන්න (mතක් තියාගන්න, ආයෙත් පේන්නේ නෑ).

## 7. Termux එකෙන් GitHub එකට push කරන්න

```
git remote add origin https://github.com/YOUR_USERNAME/bybit-fib-bot.git
git branch -M main
git push -u origin main
```

- `YOUR_USERNAME` තැනට ඔයාගේ GitHub username එක දාන්න.
- Username ඇහුවම → GitHub username එක.
- Password ඇහුවම → **step 6 එකේ token එක** paste කරන්න (GitHub password එක නෙවෙයි).

Push වුනාට පස්සේ GitHub repo page එක refresh කරලා බලන්න — files ඔක්කොම ඇවිත් තියේවි.

---

## 8. Netlify එකට deploy කරන්න (Free, phone browser එකෙන්ම)

1. **netlify.com** → GitHub account එකෙන්ම **Sign up**.
2. **Add new site → Import an existing project → Deploy with GitHub**.
3. `bybit-fib-bot` repo එක select කරන්න.
4. Settings default විදිහටම තියන්න (`netlify.toml` එකෙන් auto-configure වෙනවා).
5. **Deploy site** click කරන්න.

## 9. Environment variables දාන්න

Deploy වුනට පස්සේ: **Site configuration → Environment variables → Add a variable**

මේවා එකින් එක දාන්න (Name / Value):

| Name | Value (මුලින්ම — testnet/dry-run) |
|---|---|
| `BYBIT_API_KEY` | testnet key එක |
| `BYBIT_API_SECRET` | testnet secret එක |
| `BYBIT_TESTNET` | `true` |
| `AUTO_TRADE` | `false` |
| `SCAN_INTERVAL` | `15m` |
| `TOP_N` | `30` |
| `POSITION_SIZE_USDT` | `20` |
| `LEVERAGE` | `3` |
| `MAX_NEW_TRADES_PER_RUN` | `3` |
| `MANUAL_SCAN_TOKEN` | ඕන random string එකක් (උදා `myS3cret123`) |

Bybit testnet API key එකක් ගන්න: **testnet.bybit.com** → වෙනම account එක → **API Management → Create New Key → HMAC → Trade permission විතරයි → Withdraw permission කවදාවත් on කරන්න එපා**.

Variables ඔක්කොම දාලා ඉවර උනාම: **Deploys → Trigger deploy → Clear cache and deploy site**.

## 10. Test කරන්න (Dry run)

- Netlify එකෙන් දෙන site URL එක (`https://xxxx.netlify.app`) phone browser එකෙන් open කරන්න.
- **Admin token** field එකේ `MANUAL_SCAN_TOKEN` value එකම type කරන්න.
- **Scan Now** click කරන්න.
- Signal එකක් ආවොත් log එකේ `[DRY RUN] ... SELL signal` කියලා පේනවා — real order එකක් Bybit එකේ place වෙන්නේ නෑ.
- `netlify.toml` එකේ තියෙන schedule එකට (default: හැම විනාඩි 15කටම) automatic ව scan වෙනවා, browser එක open කරලා නොසිටියත්.

## 11. Live (real money) trading on කරන්න

**Testnet එකේ දවස් ගාණක් signals හරි විදිහට ආවා කියලා confirm උනාට පස්සේ විතරයි:**

1. Bybit mainnet account එකේ අලුත් API key එකක් හදන්න (Trade permission විතරයි).
2. Netlify env vars වල `BYBIT_API_KEY` / `BYBIT_API_SECRET` → mainnet key වලට මාරු කරන්න, `BYBIT_TESTNET` → `false`, `AUTO_TRADE` → `true`.
3. Redeploy කරන්න (step 9 අන්තිමේ කිව්ව විදිහට).
4. `POSITION_SIZE_USDT` සහ `MAX_NEW_TRADES_PER_RUN` කුඩා value එකකින් පටන් ගන්න (උදා `10`, `1`).

---

## 12. පස්සේ දවසක code එකක් වෙනස් කරන්න ඕන උනොත් (Termux එකෙන්ම)

`strategy/strategy.js` file එක Termux එකේම nano එකෙන් edit කරන්න පුළුවන්:

```
cd storage/downloads/bybit-fib-bot
nano strategy/strategy.js
```

වෙනස් කරලා ඉවර උනාම `Ctrl+O` (save), `Enter`, `Ctrl+X` (exit). ඊට පස්සේ:

```
git add .
git commit -m "tune strategy"
git push
```

Push උනාම Netlify එකෙන් ඔටෝ redeploy වෙනවා.

## File structure එක (short reference)

```
strategy/strategy.js       ← 🎯 signal detect + TP/SL logic — වෙනස්කම් ඕන දෙයම මෙතන
lib/bybit.js                ← Bybit API signing + order placement
lib/runScan.js              ← scan flow (symbols → signal → trade)
lib/store.js                ← scan results save කරන තැන (Netlify Blobs)
netlify/functions/scan.js       ← auto-scan (cron schedule)
netlify/functions/scan-now.js   ← "Scan Now" button
netlify/functions/status.js     ← dashboard එකට data දෙන endpoint
public/index.html            ← dashboard UI
netlify.toml                 ← Netlify config + cron schedule
.env.example                 ← env vars list (reference විතරයි, values Netlify site එකේ settings වලට දාන්න)
```

## Free tier limitation එකක්

Netlify free plan එකේ function timeout එක තත්පර 10ක්. `TOP_N` loku ගානක් (100+) දැම්මොත් scan එක 10s ඇතුලට ඉවර නොවෙන්න පුළුවන්. `TOP_N=30-50` range එකේ තියන්න. Timeout errors log එකේ පේනවනම් `TOP_N` හෝ `SCAN_CONCURRENCY` අඩු කරන්න.
