# Dealer Empire

A browser-based dealership sim. You are the General Manager of a franchised dealer for the fictional Aurex brand, and you run every department: new and used vehicles, F&I, service, parts, people, finance, the manufacturer relationship and long-term customer retention.

The game is played on an animated isometric view of your dealership. Every car on the lot is a real unit of inventory, every person in the showroom is a real customer, and every car on a lift is a real repair order. Click a customer to sell to them face to face, click a car or a building to manage it, and open any department from the toolbar.

All brands, models, people and companies in the game are fictional.

## Story mode — Act 1: The Service Drive

For players who know nothing about dealerships. Aunt May leaves you her struggling Aurex store; Rosa, the service manager who is about to retire, teaches you how a service department makes money before the bank's deadline. Seven short chapters, one idea each:

| # | Chapter | What you learn |
|---|---|---|
| 1 | Your first customer | A quote is hours × labour rate + parts |
| 2 | Busy Saturday | Bays and techs limit how many cars you can fix; long waits lose customers |
| 3 | The corner garage | Your price vs. a cheaper competitor, and how trust changes it |
| 4 | Out of stock | No part, no repair — but stock is money already spent |
| 5 | The recall letter | The brand pays for recalls; honest inspections earn trust (and money) |
| 6 | Bring them back | Reminding happy customers brings them back |
| 7 | The bank's deadline | Profit = money in − wages, rent and parts |

You play on a close-up of the service building: tap a car at the service drive to write the quote, tap a waiting car to send it into a bay, tap the parts wall to order. Each chapter scores up to three stars and adds a card to your Playbook, with the real industry term for what you just learned. Free play (the whole dealership) is still on the title screen.

## Play

No build step and no dependencies. Serve the folder with any static web server and open `index.html`:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Start from the title screen: open a new dealership (name, sign colour, difficulty, save slot) or continue a saved one. There are no time controls: the dealership simply runs. Customers walk in, delivery trucks drop off cars, sold cars drive away, the shop works through its repair orders and the light changes toward closing. The game pauses by itself whenever you open a window, talk to a customer or have a decision to make. Twelve career goals guide you from stocking the lot to running a dealer group.

The game saves to one of three slots in your browser (IndexedDB) every week, at month-end, after decisions and when you leave the page.

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

## Department windows

| Window | What you manage |
|---|---|
| GM Office | Executive KPIs, urgent issues, today's events, sales pace |
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
- `js/world.js` — the isometric dealership: drawing, animation, camera, clicking
- `js/art.js` — character looks and expressive portraits
- `js/ui-deal.js` — the face-to-face deal scene
- `js/story.js` — story mode: chapters, the service scene, Rosa, the Playbook
- `js/ui-*.js` — management windows and charts
- `js/main.js` — title screen, save slots, HUD, toolbar, goals, time, input
- `css/styles.css` — theme tokens (light and dark) and window layout
- `css/game.css` — HUD, toolbar, title screen and deal scene
- `css/story.css` — story mode screens
