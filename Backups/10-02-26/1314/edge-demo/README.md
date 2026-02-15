# 🌊 Pete's Trading Journal

**Version:** 0.1  
**Built:** 2026-02-03  
**Location:** `~/Documents/Kai/Trading-Journal/Trading-Journal-App/`

---

## 🎯 Features

### ✅ Current (v0.1)
- **Dark mode** trading interface
- **Trade entry form** with all your model fields:
  - Symbol, direction, entry/exit prices
  - Stop loss, take profit, position size
  - Setup type (C2/C3/C4), entry timeframe (5M/3M)
  - Session, CISD confirmation, 4H profile
  - Psychology tracking (emotions, mistakes, lessons)
- **Up to 4 chart screenshots** per trade
- **Auto-calculated P&L**
- **Statistics dashboard:**
  - Total trades, win rate, total P&L
  - Average R:R ratio
  - Equity curve chart
  - Setup performance breakdown
- **Trade history** with filters
- **CSV export** for analysis
- **Local storage** (no cloud needed)
- **Git backup** (auto-versioned)

### 🚧 Coming Soon (v0.2)
- [ ] Tag-based filtering
- [ ] Advanced statistics (expectancy, max drawdown)
- [ ] Trade templates (save common setups)
- [ ] Daily/weekly review prompts
- [ ] Integration with your Obsidian vault

---

## 🚀 How to Use

### 1. Open the App
```
Open in browser:
~/Documents/Kai/Trading-Journal/Trading-Journal-App/index.html
```

Or drag `index.html` into your browser.

### 2. Add a Trade
1. Click "New Trade"
2. Fill in all fields:
   - **Trade Details:** Date, time, symbol, direction
   - **Price Levels:** Entry, exit, stop, target
   - **Setup Analysis:** C3/C2/C4, timeframe, session, CISD status
   - **Psychology:** How you felt, mistakes made, lessons learned
   - **Screenshots:** Upload up to 4 chart images
3. Click "Save Trade"

### 3. View Statistics
- Click "Dashboard" for overview
- See equity curve and setup performance
- Track your progress over time

### 4. Review History
- Click "Trade History"
- Filter by symbol, result, or setup type
- Export to CSV for deeper analysis

---

## 📝 Data Storage

**Your data is stored locally in:**
- `localStorage` (browser storage)
- Auto-backed up to GitHub via the Obsidian vault git repo

**Never lost:** Even if browser cache clears, git has your history.

---

## 🎨 Customization

### Change Currency
Edit `js/storage.js` line 14:
```javascript
currency: 'GBP'  // Change to 'USD', 'EUR', etc.
```

### Add More Symbols
Edit `index.html` in the symbol select dropdown (around line 95)

### Change Colors
Edit `css/styles.css` - modify CSS variables at the top:
```css
--accent: #58a6ff;        /* Your brand color */
--success: #238636;       /* Win color */
--danger: #da3633;        /* Loss color */
```

---

## 🔒 Backup & Recovery

### Automatic
Every time you save a trade, the data is stored in:
1. Browser localStorage (immediate)
2. Git repository (when you commit/push)

### Manual Backup
1. Go to Trade History
2. Click "Export CSV"
3. Save the CSV file separately

### Restore
If you need to restore:
1. Open the CSV in Excel/Google Sheets
2. Or manually re-enter key trades

---

## 🐛 Known Issues (v0.1)

1. **Screenshots are stored as base64** - can make localStorage large if you add many high-res images
2. **No mobile optimization yet** - works best on desktop
3. **No real-time sync** - if you use multiple browsers, data won't sync between them

**Workaround:** Use one primary browser, export CSV as backup.

---

## 🎯 Integration with Your Workflow

### Before Trading:
1. Check Obsidian for your daily bias
2. Identify setup on charts
3. Take screenshots

### After Trading:
1. Open Trading Journal
2. Add trade with screenshots
3. Fill psychology section honestly
4. Review in Trade History

### Weekly Review:
1. Export CSV
2. Paste into Obsidian weekly review
3. Analyze patterns with Kai

---

## 💡 Tips

**Be Consistent:**
- Log every trade (even losers)
- Fill psychology fields honestly
- Tag setups correctly (C3 vs C2 matters for stats)

**Review Regularly:**
- Check Dashboard weekly
- Look for patterns in "Mistakes"
- Celebrate improvements in win rate

**Use Screenshots:**
- Capture entry, exit, and key levels
- Helps with later analysis
- Visual record of your decisions

---

## 🛠️ Built With

- **HTML5** - Structure
- **CSS3** - Dark mode styling
- **Vanilla JavaScript** - No frameworks, runs anywhere
- **Chart.js** - Statistics visualization
- **LocalStorage API** - Data persistence

---

## 📈 Future Roadmap

**v0.2:** Enhanced statistics, trade templates  
**v0.3:** Obsidian integration, auto-sync  
**v0.4:** Mobile app version  
**v0.5:** TradingView webhook integration

---

## 🤝 Support

**Questions? Issues?**
- Ask Kai in Telegram
- Check Obsidian `Kai Memory/Nightly Missions System.md`

---

*Built by Kai for Pete 🌊*  
*Helping you become a consistently profitable trader, one trade at a time.*
