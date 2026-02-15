🚀 Scrummer OS
Know what's happening. Know what to do next.
Scrummer OS is a premium, no-database delivery intelligence dashboard designed for modern Agile teams. It converts raw sprint metrics into actionable risk signals, helping teams anticipate slippage before it happens.

✨ Key Features
Launchpad (Step 1): Fast, deterministic setup for sprint commitment and historical performance.

Intelligence (Step 2): Automated calculation of Risk Scores, Delivery Confidence, and Focus Factors.

Actions (Step 3): Context-aware suggestions to mitigate scope creep and capacity shortfalls.

AI Ceremony Copilot: A real-time command center for Daily Scrums, Planning, and Retrospectives.

Zero-Database Architecture: Runs entirely in the browser using localStorage. Your data never leaves your machine.

Modern Joy UI: A high-end hybrid of Google Material 3 and minimalist SaaS aesthetics.

🏗️ Project Structure
Plaintext
Scrummer/
│
├── index.html              # Launchpad (Sprint Setup)
├── intelligence.html       # Insights & Signal Dashboard
├── suggestions.html        # Actionable Next Steps
├── workspace.html          # AI Ceremony Copilot
│
├── css/
│   └── style.css           # Premium Material Hybrid System
│
├── js/
│   ├── shell.js            # Core engine, math logic, and navigation
│   ├── theme.js            # Light/Dark mode smoothing
│   ├── metrics.js          # Statistical calculations (StDev, Mean, Risk)
│   ├── intelligence.js     # Insights rendering logic
│   ├── suggestions.js      # Action engine and tone mapping
│   ├── workspace.js        # Real-time notes and data sync
│   └── copilot.js          # Ceremony guidance logic
🧮 How it Works: The Math
Scrummer uses a deterministic algorithm to calculate delivery risk based on three primary pillars:

Scope Pressure: The ratio of committed story points to the team's rolling 3-sprint average velocity.

Capacity Health: Available person-days (adjusted for leave/holidays) converted into an "Effective Velocity."

Predictability: Statistical volatility derived from historical performance (Standard Deviation).

🚀 Getting Started
Clone the Repo:

Bash
git clone https://github.com/yourusername/scrummer-os.git
Run Locally:
Since this is a static frontend application, you can simply open index.html in any modern web browser. No npm install or server setup required.

Deploy:
Perfect for hosting on GitHub Pages, Netlify, or Vercel as a static site.

🎨 Customization
The theme is controlled via CSS variables in css/style.css. You can easily tweak the --accent or --radius-lg variables to match your team's branding.

CSS
:root {
  --accent: #0b57d0; /* Change this to your brand color */
  --radius-lg: 24px; /* Adjust for more/less rounding */
}
🛡️ Privacy & Security
Scrummer is built with a Privacy-First mindset.

No API calls: Data stays in your browser's localStorage.

No Tracking: No analytics or third-party cookies are included by default.

No Backend: No server-side vulnerabilities to worry about.
