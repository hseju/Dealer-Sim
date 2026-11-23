# Dealer Empire

A browser-based dealership management simulation. You are the General Manager of **Lakeshore Aurex**, a franchised dealer for the fictional Aurex brand, and you run every department: new and used vehicles, F&I, service, parts, people, finance, the manufacturer relationship and long-term customer retention.

All brands, models, people and companies in the game are fictional.

## Play

No build step and no dependencies. Serve the folder with any static web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Time runs on its own from the moment you start: each business day goes from 9 AM to 8 PM, customers walk in as the clock moves, and the day closes out at 8. Pause or switch between three speeds at the top (space bar pauses, 1–3 set the speed). Decisions, the month-end report, the deal desk and other windows pause the clock and it resumes when you close them. The calendar button skips ahead a day, a week or to month-end.

The game saves automatically in your browser (IndexedDB) at the end of each week, at month-end and when you leave the page. Use **New game** in the sidebar to start over.

To produce a single self-contained HTML file:

```sh
node tools/build.mjs        # writes dist/dealer-empire.html
```

## The core loop

1. **Inventory acquisition** — order units against your monthly Aurex allocation; buy used units at the weekly dealer auction. Every new unit is floorplanned and costs interest each day it sits.
2. **Customer arrival** — showroom traffic depends on advertising, season, the economy, interest rates, your CSI, your inventory and competitor campaigns. Existing customers come back when their lease ends, their equity turns positive or their vehicle gets old — if they still trust you.
3. **Negotiation** — the deal desk is a four-square worksheet: price, trade allowance, down payment and payment (finance, lease or cash, term, APR markup, accessories and protection products). The customer's read is shown as *Very interested → Ready to walk*, never as a number. They accept, counter, ask for another vehicle, leave, or buy from a competitor.
4. **Sale** — front gross, holdback, doc fee, F&I reserve and product gross, commissions, the trade-in at actual cash value, delivery CSI.
5. **Service relationship** — the customer's car accrues kilometres daily, comes due for maintenance, breaks, gets recalled and needs seasonal tire changes. Each time, they choose you or an independent shop based on price, availability, satisfaction, warranty, loyalty and your retention programs.
6. **Retention** — measured by ownership-year cohorts. Programs (reminders, free first oil change, prepaid maintenance, loyalty points, pickup & delivery, extended hours, mobile service, preferred pricing) each carry a real monthly cost and an attributed return.
7. **Monthly results** — a full income statement by department, operating expenses, cash flow and an Aurex evaluation that moves your standing, allocation and stair-step bonus.

Important events pause the clock: resignation threats, recon surprises, fleet inquiries, competitor campaigns, recalls, OEM offers, customer complaints and the month-end close.

## Sections

| Section | What you manage |
|---|---|
| Dashboard | Executive KPIs, urgent issues, today's events, sales pace |
| Showroom | Waiting customers, the deal desk, desk policy, sales team, recent deals |
| Vehicle Inventory | New units, aging, floorplan, model mix, ordering, dealer trades |
| Used Vehicles | Trade-in disposition (recon, retail as-is, wholesale, auction), pricing, auction buying |
| Customers | The persistent customer database, equity mining, profiles and history |
| Service | Bays, repair orders, technicians, appointment load, labour rate, loaners |
| Parts | Stock levels, min/max, auto-replenishment, special orders, obsolescence |
| Retention | Cohorts, retention drivers, programs, overdue customers, campaigns |
| Employees | Hire, fire, train, promote, change pay; morale, skill and experience |
| Finance | Income statement vs prior month and 3-month average, trends, cash |
| OEM | Standing, objectives, stair-step bonus, allocation, incentives, facility |
| Market | Rates, fuel, confidence, EV demand, used prices, events, competitors, news |
| Dealer Group | Expansion projects and additional rooftops |

## Code layout

Plain classic scripts sharing one global scope, loaded in order by `index.html`:

- `js/core.js` — seeded RNG, calendar, formatting, icons
- `js/data.js` — models, parts, jobs, roles, programs, competitors, expansions
- `js/sim-setup.js` — new-game generation (customers, staff, inventory, history)
- `js/sim-sales.js` — valuation, deal math, customer psychology, showroom, trades
- `js/sim-service.js` — scheduling, repair orders, technicians, parts
- `js/sim-people.js` — customer lifecycle, retention, employees
- `js/sim-world.js` — market events, competitors, OEM, finance, decisions, the daily tick
- `js/ui-*.js`, `js/main.js` — views, charts, input handling, saves
- `css/styles.css` — theme tokens (light and dark) and layout
