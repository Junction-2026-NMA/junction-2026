# Innovative Finance Plan

## User

Okay so this is the phase where we ideate. | I gave you a link to all the challenge tracks. We are planning on doing the exa, S-Pankki, and maybe context.dev challenges for one project (centred around the S-Pankki personal economic trainer. [https://hackjunction.app/participate/45/challenges](https://hackjunction.app/participate/45/challenges) | Along with the challenge tracks, there are also technology challenges like the tech tracks, and I think we can implement some APIs. For example, we can use the API from Nvidia or Gemini to act as the inference layer for the exa and Aspunky, like the personal economic assistant. We can use that API as inference there. We can also use Eleven Labs and maybe Verda for the cloud, so it's always on 24/7 rather than just running on your laptop.\
\
Go through all of these, all of the things that I've given you, and I want you to give me a concise plan: what you think, if you think some other challenge tracks are better, and how we could model this. We need to be super innovative. We need to be something never made before, and it needs to be just a super wow factor.

---

## ChatGPT

I’ll compare the actual challenge briefs and tech prizes, then narrow this to one standout concept with a demo, technical stack, and clear path to multiple prizes. I’ll also challenge whether combining all three tracks helps or weakens the idea.

---

## ChatGPT

## My recommendation: Build a financial digital twin, not another AI finance chatbot.

The strongest direction is **S-Pankki + Exa + Gemini + ElevenLabs + Verda**, with Context.dev added only if it provides a genuinely useful capability.

The idea: an AI that doesn't just explain where your money went. It **simulates your financial future, discovers opportunities, and lets you experience the consequences of decisions before making them.**

That fits Junction's *European Tech Renaissance* theme: shifting financial intelligence from banks and expensive advisers into the hands of ordinary Europeans.

### 1. The concept: ATLAS — Your Financial Future, Simulated

<box gap={2}>
  <row align="center" justify="between">
    **Personal Economic Trainer 2.0**
    <badge color="success">My top concept</badge>
  </row>
  <text color="secondary" size="sm">Not just conversational banking. A living, interactive model of your financial life.</text>
</box>

Imagine a user asks:

> "What happens if I move to Helsinki, earn €3,500 a month, and want to buy an apartment in five years?"

Instead of responding with paragraphs, the product generates an interactive simulation of that person's life.

It shows their projected cash flow, savings, housing affordability, and financial risks. Then the user can modify assumptions live, through voice or sliders, and watch their future change.

The wow factor comes from showing **multiple possible futures side by side**, with an AI trainer explaining what actions would improve the outcome.

### 2. How I'd combine the challenges and APIs

| Partner | Role in our project | Priority |
|---|---|---|
| **S-Pankki** | Core challenge: personal financial coaching with synthetic transaction data | Essential |
| **Exa** | Search for real financial information, housing costs, savings products, and supporting sources | Essential |
| **Gemini** | AI reasoning, tool orchestration, and conversational explanations | Essential |
| **ElevenLabs** | Real-time voice interaction with the financial trainer | High |
| **Verda** | European cloud hosting and optional model inference | High |
| **Context.dev** | Optional extraction of structured financial data from websites | Conditional |
| **NVIDIA** | Alternative inference provider or a specialized model capability | Optional |

Exa is primarily a search and retrieval layer, not the main language-model inference engine. <Cite refs={["turn490232search0","turn490232search10"]}/> Verda actually offers an inference API as well as cloud infrastructure, and its best-use prize is open to projects in other tracks. <Cite ref="turn323012search2"/>

I couldn't access the full authenticated Junction challenge briefs from your link, so the exact Exa and Context.dev judging requirements still need verification.

### 3. The wow-factor demo

<box border radius="xl" padding={3} gap={3}>
  <text weight="medium" size="sm">Conceptual interface — financial future simulator</text>
  {@body const [rent,setRent] = DIL.useState(1100)}
  {@body const [dining,setDining] = DIL.useState(300)}
  {@body const [income,setIncome] = DIL.useState(3500)}
  {@body const savings = income-rent-dining-1150}
  <row align="center" justify="between">
    <box gap="2px">
      <text color="secondary" size="xs">Projected savings over 5 years</text>
      <title size="2xl" color="default" tabularNums>{(savings*60).toLocaleString("en-US",{style:"currency",currency:"EUR",maximumFractionDigits:0})}</title>
    </box>
    <icon name="orbit" color="secondary" size="2xl"/>
  </row>
  <Chart content={{"chartType":"line","meta":{"footer":"Illustrative linear projections, excluding investment returns and inflation"},"xKey":"year","series":[{"dataKey":"baseline","label":"Baseline","valuePrefix":"€"},{"dataKey":"optimized","label":"With €200/month improvement","valuePrefix":"€"}],"data":[{"year":"Now","baseline":0,"optimized":0},{"year":"Year 1","baseline":11400,"optimized":13800},{"year":"Year 2","baseline":22800,"optimized":27600},{"year":"Year 3","baseline":34200,"optimized":41400},{"year":"Year 4","baseline":45600,"optimized":55200},{"year":"Year 5","baseline":57000,"optimized":69000}]}}/>
  <divider color="subtle"/>
  <row align="center" justify="between">
    **Monthly take-home income**
    <text weight="medium" tabularNums>€{income.toLocaleString("en-US")}</text>
  </row>
  <slider min={2500} max={5000} step={100} value={income} onChange={setIncome}/>
  <row align="center" justify="between">
    **Monthly rent**
    <text weight="medium" tabularNums>€{rent.toLocaleString("en-US")}</text>
  </row>
  <slider min={600} max={1800} step={50} value={rent} onChange={setRent}/>
  <row align="center" justify="between">
    **Dining and entertainment**
    <text weight="medium" tabularNums>€{dining.toLocaleString("en-US")}</text>
  </row>
  <slider min={0} max={700} step={25} value={dining} onChange={setDining}/>
  <box background="surface-secondary" radius="lg" padding={3} gap={1}>
    <row align="center" gap={2}>
      <icon name="sparkles"/>
      **AI economic trainer**
    </row>
    <text size="sm">Your simulated monthly savings are €{savings.toLocaleString("en-US")}. {savings>0 ? `Reducing your dining budget by €100 per month would add €6,000 to your five-year savings.`:"Your current assumptions imply negative monthly savings. Try adjusting housing or discretionary spending."}</text>
  </box>
  <caption>Interactive illustration of the proposed product, not a live banking or AI integration. The graph uses a fixed example; the controls update the savings estimate.</caption>
</box>

For the live hackathon pitch, I'd make the AI generate these simulations through voice, with sourced assumptions and a visible explanation of its calculations.

### 4. What makes this genuinely different?

The differentiator should be a **Financial Decision Engine** rather than a conventional AI assistant.

- **Counterfactual simulation:** Compare several financial life decisions at once.
- **Opportunity discovery:** Exa finds relevant external information that changes your financial options.
- **Proactive coaching:** The trainer identifies risks and proposes concrete actions, not merely answers questions.
- **Explainable intelligence:** Every projection shows its assumptions and sources.

I wouldn't claim nobody has built anything similar. Financial planning simulators exist. Your opportunity is to combine personal transaction intelligence, real-world retrieval, conversational interaction, and live scenario generation into an unusually polished experience.

### 5. The execution strategy

<box gap={2}>
  <row align="start" gap={3}>
    <box background="surface-secondary" radius="lg" padding={2}>
      <icon name="lightbulb"/>
    </box>
    <box flex="1" gap={1}>
      **Friday: Idea and architecture**

      Finalize the differentiator, storyboard the demo, verify sponsor requirements, and submit the preliminary entry by 23:55.
    </box>
  </row>
  <row align="start" gap={3}>
    <box background="surface-secondary" radius="lg" padding={2}>
      <icon name="code-2"/>
    </box>
    <box flex="1" gap={1}>
      **Saturday: Build the complete experience**

      Start with transaction analysis and deterministic financial calculations, then add simulations, Exa retrieval, Gemini and voice. Deploy the backend to Verda if practical.
    </box>
  </row>
  <row align="start" gap={3}>
    <box background="surface-secondary" radius="lg" padding={2}>
      <icon name="trophy"/>
    </box>
    <box flex="1" gap={1}>
      **Sunday: Win the demo**

      Freeze features, test realistic scenarios, record a backup demo, and polish a 90-second pitch before the 10:00 final submission deadline. <Cite ref="turn953956search1"/>
    </box>
  </row>
</box>

### 6. My verdict on the challenge tracks

I'd prioritize **S-Pankki as the primary track, Exa as the strongest secondary integration, and Verda/ElevenLabs as technology-prize opportunities.**

I would not add Context.dev or NVIDIA simply to accumulate sponsors. Each integration needs to visibly improve the product and meet the relevant challenge criteria.

The main risk is building a very attractive chatbot that looks like every other AI fintech hack. The financial simulator needs to be the centerpiece.

**One improvement I'd explore before committing:** make the digital twin *adversarial*—let users pit two financial futures against each other while the AI actively searches for ways to improve each one. That creates a memorable, interactive demonstration rather than another dashboard.

The winning story is simple: **"Banks tell you what happened to your money. We show you what could happen next—and how to change it."**

---

## User

Okay first. We need to get a concrete connection between the exa and S pankki ones:&#x20;

# The Internet Butler / Your Personal Assistant

by Exa

## The Challenge

Build an agent that takes tedious tasks in people’s lives off their hands.

**Introduction:** Everyone has pain points in their day to day which require hours of digging and research like checking whether a rent increase is legal, or finding out which benefits a family qualifies for, which vegan restaurant to pick for an anniversary date, and more. The answers exist, but they are buried across the web. Exa is the search engine built for AI. It can find, read and compare information from across the web and pull it back as structured data, so your agent can do the digging and the task can be handed off completely.

**The challenge:** Develop a personal agent that helps people get stuff done. Your agent should find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case.

**Areas of interest:** General tasks. Examples: planning special occasions, handling daily living errands, rent, missed benefits, business information, travel disruption, etc.

**How we judge:** We will judge projects on how well they use Exa to get information that could not have come from a model's training data alone, how useful they are to a specific group of real people, and how clearly they show their sources. We will also look at originality and at whether the demo works on live queries, including ones the judges try themselves.

The winning team will receive [cash amount] and [Exa API credits per member], and the two runner-up teams will receive [amounts]. Every team that submits a working project built on Exa will receive [API credits] to keep building after the event. [Consider a mentoring session or visibility on Exa's channels for the winners.]

**About Exa:** Exa is a search engine built for AI. We index the web by meaning, so AI applications can find information by describing what they need, and we return clean, structured content that models can use directly. Companies such as Cursor, Cognition, HubSpot and AWS use Exa to connect their products to the web. We are joining Junction to meet builders, see new ideas for what AI can do with access to the whole web, and keep supporting promising teams after the event.

## Resources

**What we'll bring:** Every participant will get $50 in Exa Credits and access to our full API for the event. This includes the Search API with fast, balanced and deep research modes, and the Contents API for full page text, highlights, summaries and crawling a site's subpages.

Teams can filter results by date, domain and category (such as news, research papers, companies, people and personal websites), request results as structured JSON, and retrieve past versions of web pages.

We will also provide Websets for building verified lists of people, companies and opportunities, Monitors for recurring searches, our hosted MCP server, and Python and JavaScript SDKs. Our demo gallery at [**demos.exa.ai**](https://demos.exa.ai/) has working examples teams can build from.

Exa engineers will be on site throughout the event to help with technical questions and project ideas, and there will also be a Discord channel to receive asynchronous advice.

Free $50 Exa Credits: EXA50JUNCTION (Redeem it at [**dashboard.exa.ai/billing**](https://dashboard.exa.ai/billing))

Company Info

## Exa

Website: [https://exa.ai/](https://exa.ai/)

## Judging Criteria

- **Use of Exa**(20%)

  Use of Exa to retrieve information that could not have come from a model’s training data alone
- **Usefulness**(20%)

  Usefulness to a specific group of real people
- **Clarity**(20%)

  Clarity in showing sources
- **Originality**(20%)

  How original the idea is?
- **Working Implementation**(20%)

  Whether the demo works on live queries, including ones the judges try themselves

## Prizes

- **1st Place**

  $2,500 Cash, $5,000 in Exa credits, Exa hoodie per person & Exa branded TRMNL dashboard

- **2nd Place**

  $1500 cash, $3,000 in Exa credits, Exa hoodie per person & Exa branded macropad

- **3rd Place**

  $500 Cash, $1k Exa credits & Exa hoodie per person

- **Participation Trophy**

  Every Junction participant get free $50 Exa Credits |&#x20;

  # Personal Economic Trainer

  by S-Pankki

  ## The Challenge

  Explore how AI can turn personal banking data into a trusted financial coach for everyday life.

  S-Bank is Finland’s fourth-largest bank, with 3.5 million customers, and its S-mobiili app is used weekly by one in three Finnish adults. We want to reimagine personal finance by letting people talk with their own financial data through AI. Banking today often stops at statements and transaction lists. We want to make it conversational, insightful, and personalised. At Junction, we invite you to help us build the next generation of AI-driven personal economic trainers that make money matters simple and engaging for everyone.

  Using a large synthetic transaction dataset modelled on real S-Bank data, build an AI experience that lets people chat with their own money, from simple questions like “How much did I spend on taxis last month?” to deeper ones like “What kind of spender am I?”, “What is safe for me to spend this week?” or “How much could I save if I reduced dining out by 20%?”.

  We value a pedagogical angle: everyone’s spending falls into three baskets:

  1. mandatory and regular (e.g. rent)
  2. mandatory and irregular (e.g. a broken washing machine), and
  3. everyday spending that slips through your fingers (e.g. coffees) — and solutions that help people understand where their money really goes will go far with us.

  Think in the spirit of MyData: let users explore their own data freely rather than showing fixed charts the bank has picked for them. You can enhance these insights with open data sources (e.g., Statistics Finland) to offer meaningful benchmarks.

  **Recommended output:** a mobile app, or a web app that can be embedded in a mobile app — our customers are on mobile.

  **Extra details:** To our knowledge, no Finnish bank yet lets customers chat with their own financial data, making this a first-of-its-kind opportunity in Finnish banking. The challenge ties directly to S- Bank’s strategy of serving customers increasingly digitally and to our vision for S-mobiili. One of the top-rated finance apps on both Google Play and the App Store, so a winning idea could reach millions of people. Money matters touch everyone, and we believe AI can play a key role in improving financial literacy — especially among young adults.

  **About the Company** S-Bank is Finland’s fourth-largest bank, serving 3.5 million customers nationwide. Our mission is to make everyday banking simple, rewarding, and accessible to everyone. We believe in combining strong financial expertise with innovative technology to create solutions that genuinely improve people’s lives. Junction offers us a unique opportunity to co-create with some of the world’s brightest developers and to explore new ways AI can reshape personal finance.

  ## Insight

  We are especially interested in conversational AI that explains financial concepts in plain language, simulates “what if” scenarios, and guides users toward healthier money habits, for example through safe-to-spend and safe-to-save guidance. Benchmarking personal data against open population data is encouraged but not mandatory.

  Optional bonus angle (not required, the challenge is fully solvable with the provided data and open data):

  - Multi-bank view: under PSD2, customers can let their bank fetch account data from other banks. How could an AI coach use the customer’s full financial picture?

  ## Resources

  **Data**

  Using a large synthetic transaction dataset modelled on the structure of S-Bank data

  **Mentors**

  - Carl-Edvard (Calle) Holmberg – Chief Innovation Officer
  - Representative from S-Bank IT / AI development
  - Data Scientist (transaction data expert)
  - 1–2 business representatives who own the customer problem

  Main contact: Carl-Edvard (Calle) Holmberg

  You may find the data through [**here**](https://github.com/hackjunction/Junction-2026-S-pankki)

  Company Info

  ## S-Pankki

  Website: [https://www.s-pankki.fi/](https://www.s-pankki.fi/)

  ## Judging Criteria

  - **Impact on financial literacy (including the pedagogical angle)**(20%)
  - **Originality of AI integration**(20%)
  - **Clarity of the mobile user experience**(20%)
  - **Feasibility**(20%)
  - **Potential to integrate into S-mobiili**(20%)

  ## Prizes

  - **1st Prize**

    2000€ Airbnb Gift Card
  - **2nd Prize**

    1000€ Airbnb Gift Card
  - **3rd Prize**

    500€ Airbnb Gift Card

---

## ChatGPT

## The connection: Turn financial insights into real-world actions.

I think we've found a much stronger combination than simply using Exa to look up financial information.

**S-Pankki understands your money. Exa discovers opportunities to improve your financial situation. The AI agent turns those opportunities into actions.**

That's a genuinely unified product, not two unrelated challenge submissions.

### My proposed concept: Sisu — The AI That Fights for Your Finances

> "Your bank tells you where your money went. Sisu goes out into the world to help you keep more of it."

Imagine opening your banking app and seeing:

<box border radius="xl" padding={3} gap={3}>
  <row align="center" justify="between">
    <row align="center" gap={2}>
      <box background="surface-secondary" radius="lg" padding={2}>
        <icon name="sparkles"/>
      </box>
      <box gap="1px">
        **Sisu**
        <text color="secondary" size="xs">Your personal economic trainer</text>
      </box>
    </row>
    <badge color="success">Demo concept</badge>
  </row>
  <text color="secondary" size="xs">Good evening! I've analyzed your spending and found opportunities worth investigating.</text>
  <box background="surface-secondary" padding={3} radius="lg" gap={2}>
    <row align="center" justify="between">
      <text weight="medium">Potential yearly savings</text>
      <title size="lg" color="success">€1,240</title>
    </row>
    <caption>Illustrative only — requires live research and verification</caption>
  </box>
  <row align="start" gap={3}>
    <icon name="house" color="secondary"/>
    <box flex="1" gap={1}>
      **Your rent may be above comparable properties**

      <text size="sm" color="secondary">Research local listings and rental rules to check whether you have a practical way to reduce housing costs.</text>
      <button block size="md" color="primary" onClick={()=>GenUI.issueNewTurn("Design the rent research agent for Sisu using Exa, including verified citations and a user-approved negotiation draft.")}>Investigate rent</button>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="start" gap={3}>
    <icon name="wallet" color="secondary"/>
    <box flex="1" gap={1}>
      **You could qualify for financial support**

      <text size="sm" color="secondary">Research public benefits based on your circumstances, then prepare the relevant application checklist.</text>
      <button block color="secondary" onClick={()=>GenUI.issueNewTurn("Design Sisu's Exa-powered Finnish benefits eligibility workflow, with evidence requirements and user approval.")}>Check eligibility</button>
    </box>
  </row>
</box>

*This is a proposed interface, not an analysis of a real account.*

The innovation isn't the savings estimate. It's the ability to move from **detecting a problem → researching a solution → preparing the action → obtaining user approval**.

## The biggest opportunity is actually hidden in S-Pankki's dataset

I inspected the <Link url="https://github.com/hackjunction/Junction-2026-S-pankki" title="official GitHub repository"/>. Besides transactions, it includes **mortgage negotiation histories and final mortgage application outcomes**.

That gives us three possible flagship experiences:

| Experience | S-Pankki contribution | Exa contribution | My rating |
|---|---|---|---|
| **Mortgage Negotiator** | Understands mortgage history and affordability | Researches current mortgage offers and refinancing options; prepares a negotiation brief | 9.5/10 |
| **Benefits Hunter** | Recognizes income and spending patterns | Searches current Finnish benefits and eligibility rules; prepares application steps | 9/10 |
| **Subscription & Bills Optimizer** | Finds recurring expenses | Researches available alternatives and prepares switching actions | 8/10 |

<text color="secondary" size="xs">Ratings are my assessment of concept strength, not predicted judging scores.</text>

### The demonstration I'd build

<box gap={2} align="center">
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="landmark" size="lg"/>
    **1. Understand my finances**
    <text size="xs" color="secondary" textAlign="center">S-Pankki transactions + mortgage history</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="brain-circuit" size="lg"/>
    **2. Identify an opportunity**
    <text size="xs" color="secondary" textAlign="center">AI detects an expensive recurring obligation or cash-flow problem</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="search" size="lg"/>
    **3. Research the real world**
    <text size="xs" color="secondary" textAlign="center">Exa retrieves current offers, relevant rules, comparisons and cited sources</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="chart-no-axes-combined" size="lg"/>
    **4. Simulate my options**
    <text size="xs" color="secondary" textAlign="center">Compare savings, fees, risks and cash-flow outcomes</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="check-circle-2" size="lg"/>
    **5. Prepare the action**
    <text size="xs" color="secondary" textAlign="center">Generate a negotiation email or application checklist for approval</text>
  </box>
</box>

For example, a judge asks:

> "Could I save money by renegotiating my mortgage?"

Sisu identifies the user's simulated financial position, uses Exa to retrieve current relevant offers, calculates whether switching would be beneficial after fees, and prepares a personalized negotiation email.

The judge can change the mortgage amount or interest rate and see the recommendation update live. The AI explains *why* the decision makes sense, not just what to do.

This satisfies both briefs:

- **S-Pankki:** conversational banking, financial literacy, personalized simulations, mobile experience and realistic integration potential.
- **Exa:** live searches, up-to-date information, visible sources, meaningful task completion and a real practical problem.

One important constraint: the provided data doesn't necessarily include current mortgage balances, interest rates or eligibility details for every customer. We should use the supplied records where available and clearly label any additional demo assumptions.

## My recommendation

Build **one unified financial action agent** with three capabilities: understand spending, research opportunities, and prepare real-world actions. Make **mortgage negotiation the flagship demo**, with benefits discovery as a second live-query workflow if time permits.

The distinctive feature I would prioritize is a **financial opportunity feed** that continuously surfaces researched, sourced actions with estimated impact and confidence levels.

That creates a product S-Pankki could plausibly embed into S-mobiili, while making Exa central to its intelligence rather than a decorative API integration.

The question guiding the entire build should be: **Can we turn someone's banking history into a concrete, verified opportunity they can act on today?**

---

## User

Okay, I like your idea. What I'm thinking right now is that we have this conversational layer where we have Eleven Labs connected to inference through maybe Nemo from Nvidia. It can constantly train itself because it's open source. We can constantly have it tune itself.

In addition to that, we can develop a layer where you have the context dev. I'm not sure about the context dev system, but we can have that basically use context from your last conversation and always connect it, because context is a massive problem if it keeps forgetting, obviously.

Then we have these layers, and like you said, with the agent, there's the layer that does the inference. It uses Exa to get information about comparable rent listings, comparable mortgages, everything like that.

---

## ChatGPT

The layered architecture makes sense. I’m checking what Context.dev and NVIDIA NeMo actually provide, because I’d separate long-term memory from model training—and avoid making live fine-tuning a dependency for the hackathon demo.

---

## ChatGPT

I like this architecture. You're essentially proposing an **AI financial agent with voice, memory, reasoning, live research, and the ability to take action.** That's much more ambitious than a conversational banking app.

But I'd make two important adjustments: **Context.dev isn't a conversational memory system**, and **NVIDIA NeMo isn't itself an inference model**.

## The architecture I'd build

<box border radius="xl" padding={3} gap={2} align="center">
  <box background="surface-secondary" radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="smartphone" size="xl"/>
    **Mobile banking interface**
    <text color="secondary" size="xs">Chat, interactive visualizations, approvals</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="mic" size="lg"/>
    **ElevenLabs — Voice**
    <text color="secondary" size="xs">Natural speech input and output</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box background="rgba(40,110,210,0.07)" border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="brain-circuit" size="xl"/>
    **NVIDIA Nemotron / Gemini — Reasoning**
    <text color="secondary" size="xs">Intent recognition, planning, tool calling</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <grid columns={2} gap={2}>
    {#each [{name:"Financial Engine",desc:"S-Pankki data, exact calculations",ic:"landmark"},{name:"Exa",desc:"Discover live opportunities and sources",ic:"search"},{name:"Context.dev",desc:"Extract structured website information",ic:"file-search"},{name:"Memory",desc:"Remember goals, preferences, past decisions",ic:"database"}] as item}
      <grid-item>
        <box border radius="lg" padding={3} align="center" gap={2} height="100%">
          <icon name={item.ic} color="secondary" size="lg"/>
          <text weight="medium" size="sm" textAlign="center">{item.name}</text>
          <text color="secondary" size="xs" textAlign="center">{item.desc}</text>
        </box>
      </grid-item>
    {/each}
  </grid>
  <icon name="arrow-down" color="tertiary"/>
  <box background="surface-secondary" radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="check-check" size="lg"/>
    **Action Agent**
    <text color="secondary" size="xs">Simulates decisions, prepares actions, requests approval</text>
  </box>
  <caption>Proposed modular architecture. Services communicate through a backend hosted on Verda or another cloud provider.</caption>
</box>

## Three technical decisions

**1. NVIDIA NeMo vs Nemotron**

NeMo is a framework for training and customizing models. Nemotron is a model family that could power your agent.

NeMo fine-tuning is possible, but it isn't instantaneous self-learning. Furthermore, NVIDIA's older NeMo Microservices offering was sunset on October 1, 2026. <Cite refs={["turn191597search0","turn191597search9"]}/>

For Junction, I'd use a hosted Nemotron model or Gemini for inference, and improve the agent through memory and feedback instead of continuously retraining its weights.

**2. Context.dev vs memory**

Context.dev collects and structures live web information. It does not primarily remember previous conversations. <Cite ref="turn191597search14"/>

We should use:
- **Exa:** Find opportunities and relevant websites.
- **Context.dev:** Extract structured information from complex pages.
- **Supabase + vector search:** Store and retrieve conversation history, user goals, and approved preferences.

That last component gives us persistent personalization without retraining anything.

**3. ElevenLabs**

ElevenLabs supports custom LLM endpoints, so connecting it to a Nemotron-powered backend is feasible. <Cite ref="turn191597search1"/>

This could make the experience feel like talking to a financial adviser rather than operating a banking app.

## The feature I'd make the centerpiece

<box gap={2}>
  <text weight="medium">The agent learns from every approved decision.</text>
  <blockquote>
    **User:** "Find me a cheaper apartment, but I don't want to leave Helsinki."

    **Agent:** "I remember you want to stay near the metro and keep your commute under 30 minutes. I've found three potential options. The most promising could save you €180 a month. Want me to compare them?"
  </blockquote>
</box>

The agent remembers constraints, searches current listings, calculates financial consequences using S-Pankki data, and prepares inquiries or negotiation messages.

Next time, it remembers the user's preferences and previous decisions. That's **continuous personalization without constant model training**.

My strongest recommendation is to make **this persistent, proactive financial agent** the core innovation. The technology stack should serve that experience, rather than become the main attraction.

And critically, financial calculations should use deterministic code, not LLM guesses; sources should be visible; and external actions should require user approval.

The ultimate pitch:

**"The first banking assistant that remembers your goals, understands your finances, researches the real world, and works to improve your financial future."**

---

## User

I think we can also focus it around connecting it to investing as well, because right now we're thinking about budgeting and spending habits. I feel like we can also connect it to investing, the stock market, and other stuff like that. Also, we need a financial literacy layer, right? How do you think we can fold that in?

---

## ChatGPT

**Yes. Investing and financial literacy could turn Sisu from a budgeting assistant into a complete personal financial coach.** But I wouldn't build a separate stock-picking chatbot. I'd connect investing directly to someone's everyday financial decisions.

The central idea becomes:

**Understand your money → Improve your finances → Build wealth → Learn along the way.**

## 1. Four connected layers

<box border radius="xl" padding={3} gap={2} align="center">
  <grid columns={2} gap={2}>
    {#each [{icon:"wallet",title:"01. Understand",desc:"Spending, income, recurring bills, financial health"},{icon:"search",title:"02. Optimize",desc:"Exa finds better deals, benefits, and opportunities"},{icon:"chart-no-axes-combined",title:"03. Grow",desc:"Investing simulations, risk, long-term wealth"},{icon:"graduation-cap",title:"04. Learn",desc:"AI teaches concepts using your own decisions"}] as item}
      <grid-item>
        <box background="surface-secondary" radius="lg" padding={3} gap={2} height="100%">
          <icon name={item.icon} size="lg"/>
          <text weight="medium">{item.title}</text>
          <text color="secondary" size="xs">{item.desc}</text>
        </box>
      </grid-item>
    {/each}
  </grid>
  <text color="secondary" size="xs" textAlign="center">One agent, four capabilities — not four separate applications.</text>
</box>

## 2. The flagship feature: Financial Futures

Imagine the user says:

> "I spend €250 a month eating out. What if I invested half of that instead?"

Sisu analyzes the actual spending history, shows the trade-off between spending and investing, and teaches compound interest and market risk.

Here's the kind of interactive feature I'd put directly into the mobile app.

{@body const [monthly,setMonthly] = DIL.useState(125)}
{@body const [years,setYears] = DIL.useState(20)}
{@body const [annual,setAnnual] = DIL.useState(5)}
{@body const r=annual/1200}
{@body const fv=r===0?monthly*years*12:monthly*(Math.pow(1+r,years*12)-1)/r}
{@body const principal=monthly*years*12}
<box border radius="xl" padding={3} gap={3}>
  <row justify="between" align="center">
    <text weight="medium">Your financial future</text>
    <badge>Illustrative simulation</badge>
  </row>
  <box gap={1}>
    <text color="secondary" size="xs">Potential portfolio value</text>
    <title size="2xl" tabularNums>€{Math.round(fv).toLocaleString("en-US")}</title>
    <row align="center" gap={2}>
      <icon name="trending-up" color="success"/>
      <text color="success" size="sm">€{Math.round(fv-principal).toLocaleString("en-US")} projected growth</text>
    </row>
  </box>
  <box gap={1}>
    <row justify="between">
      <text color="secondary" size="xs">Contributions</text>
      <text color="secondary" size="xs">Growth</text>
    </row>
    <row height="16px" radius="full" clip>
      <box background="#64748b" width={`${principal/fv*100}%`}/>
      <box background="#16a34a" flex="1"/>
    </row>
  </box>
  <divider color="subtle"/>
  <row align="center" justify="between">
    **Monthly investment**
    <text weight="medium" tabularNums>€{monthly}</text>
  </row>
  <slider value={monthly} onChange={setMonthly} min={25} max={500} step={25}/>
  <row align="center" justify="between">
    **Investment horizon**
    <text weight="medium" tabularNums>{years} years</text>
  </row>
  <slider value={years} onChange={setYears} min={1} max={40}/>
  <row align="center" justify="between">
    **Assumed annual return**
    <text weight="medium" tabularNums>{annual}%</text>
  </row>
  <slider value={annual} onChange={setAnnual} min={-2} max={10}/>
  <text color="secondary" size="xs">Assumes monthly contributions and a constant nominal annual return, compounded monthly. Excludes taxes, fees and inflation. Actual investments fluctuate and can lose value.</text>
</box>

## 3. How financial literacy becomes the differentiator

**Don't build a separate education tab. Make education contextual.**

For example, Sisu discovers someone has €3,000 sitting in their account. Instead of simply recommending an investment, it asks whether they have enough emergency savings.

Then it explains liquidity, risk, inflation and diversification using that person's actual circumstances.

The really interesting mechanic is **"Predict before you reveal."**

Before displaying the result of an investment scenario, Sisu asks the user to predict what happens. The user makes a choice, sees the simulation, and receives a 15-second explanation.

That makes financial learning interactive and measurable, directly targeting S-Pankki's 20% financial-literacy criterion.

## 4. What Exa adds to investing

Exa shouldn't just retrieve stock prices. Give it meaningful research tasks.

| User request | What Exa researches |
|---|---|
| "Can I afford to start investing?" | Current savings-account rates and deposit terms |
| "Should I invest or pay down debt?" | Relevant loan rates and repayment conditions |
| "What does this ETF actually hold?" | Fund factsheets, holdings, fees and risks |
| "How would inflation affect my goal?" | Latest inflation data from official sources |

Sisu combines the results with verified calculations, cites the sources, and prepares an action plan.

## 5. What I'd actually ship at Junction

I'd prioritize three impressive, fully working journeys rather than trying to build a complete wealth-management platform.

1. **Money X-Ray:** Conversational AI analyzes real synthetic banking transactions, identifies spending patterns, and explains the three spending baskets.
2. **Opportunity Hunter:** Exa researches a live opportunity to save money and prepares a concrete action for approval.
3. **Financial Futures:** The user reallocates money from spending to saving or investing and watches alternative futures develop, while the AI teaches the underlying economics.

I'd leave autonomous trading, individual stock recommendations, and continuous model fine-tuning out of the MVP. They add risk and complexity without strengthening S-Pankki's main judging criteria.

**My strongest idea:** Make Sisu an AI that doesn't just manage your finances, but progressively makes you better at managing them yourself.

That's the connection between the agentic Exa challenge and S-Pankki's educational mission — and it's a much stronger story than an AI-powered budgeting dashboard.

---

## User

Just outline the layers that we have right now, all the tools that we have, and whether we need Verda to run as the cloud. I'm sure S-Pankki could partner with Verda to develop the cloud infrastructure that their models depend on. Also, they could use the Nvidia Nemo from open source, which is also super important because they need proprietary knowledge. They can't just use Claude's or OpenAI's models because they need proprietary knowledge, and they can run open source on Vera's infrastructure.

---

## ChatGPT

## Sisu — Current technology architecture

**My recommendation: build Sisu around an open-weight NVIDIA Nemotron model, hosted on Verda, with S-Pankki's financial data kept in a separate secure layer.**

This gives us a strong story for the *European Tech Renaissance*: a Finnish bank using European AI infrastructure to deliver a private, personalized financial agent.

| Layer | Technology | Purpose |
|---|---|---|
| 1. Interface | React / Next.js | Mobile-first banking experience, dashboards, simulations |
| 2. Voice | ElevenLabs | Natural, real-time conversations |
| 3. AI reasoning | NVIDIA Nemotron | Open-weight LLM for reasoning, conversation and tool use |
| 4. Model customization | NVIDIA NeMo | Fine-tuning models on approved, bank-specific data |
| 5. Memory | Supabase + vector search | Remember goals, conversations, preferences and decisions |
| 6. Financial intelligence | S-Pankki dataset + Python | Spending analysis, budgeting, mortgage and investment calculations |
| 7. Live research | Exa | Find mortgages, rent listings, benefits, financial products and sources |
| 8. Web extraction | Context.dev | Extract structured information from external websites, if supported by its API |
| 9. Action engine | Custom agent workflows | Compare options, prepare negotiations and applications, obtain user approval |
| 10. Infrastructure | Verda | Host inference, backend services and potentially persistent workloads |

**Important distinction:** Nemotron is the model family; NeMo is the framework for training and customizing models. Keeping private financial data separate from the model weights is essential. Proprietary intelligence can come from securely retrieved bank data, not necessarily from retraining the model.

## Do we actually need Verda?

**No, but I strongly recommend it.** It strengthens both the architecture and the hackathon story.

Verda supports European GPU instances, serverless containers, and managed inference. You can deploy your own Nemotron model on its GPU infrastructure rather than depending on proprietary model APIs. <Cite refs={["turn672100search0","turn672100search3"]}/>

<box gap={2}>
  <row align="center" justify="between">
    **Hackathon MVP**
    <badge color="success">Recommended</badge>
  </row>
  <text size="sm">Verda-hosted open model + S-Pankki synthetic data + Exa + ElevenLabs + Supabase.</text>
  <divider color="subtle"/>
  **Potential S-Pankki deployment**
  <text size="sm">Dedicated European infrastructure, private model deployment, secure banking-data access, audit logs, controlled fine-tuning and bank-grade security.</text>
</box>

There is one important distinction in Verda's services: its managed Inference API doesn't currently support custom fine-tuned models. Those require serverless containers or dedicated GPU instances. <Cite refs={["turn672100search2","turn672100search6"]}/>

### Why this is strategically compelling

S-Pankki could develop proprietary financial expertise using its own approved datasets, model customization, retrieval systems and evaluation procedures, while retaining more control over infrastructure and inference.

But using OpenAI or Claude wouldn't automatically mean losing proprietary knowledge. Banks can also keep sensitive information in their own systems and retrieve it securely when needed.

The advantage of Nemotron + NeMo + Verda is **greater deployment control and the option to customize and operate the entire model stack**, subject to appropriate licensing, security and regulatory review.

My recommendation is to demonstrate an open-weight model running on Verda for Junction, then present bank-specific fine-tuning as the future architecture—not claim we've trained a proprietary banking model over the weekend.

**Our pitch:** *European banking data. European AI infrastructure. Open models. A financial agent that teaches, researches and acts on the customer's behalf.*

---

## User

Okay can we centre this around a specific problem so we make it clear what the problem we aresolving is and who the stakeholders are

---

## ChatGPT

## The problem: Young Europeans don't know what to do with their money.

I'd center Sisu on **helping young adults make their first major financial decisions**—moving out, managing expenses, building emergency savings, and starting to invest.

The problem isn't that they can't see their transactions. It's that **they don't know what decisions to make based on them, or how to act on those decisions.**

## 1. Define the problem precisely

<box background="surface-secondary" radius="lg" padding={3} gap={2}>
  <text color="secondary" weight="medium" size="xs">PROBLEM STATEMENT</text>
  <title size="lg">Young adults have access to their financial data and an internet full of financial information, but lack the knowledge, time and personalized guidance to turn either into better financial decisions.</title>
</box>

Traditional banking apps show what happened. Financial education teaches generic concepts. Search engines provide fragmented information.

**None of these, individually, connects a person's actual finances to a verified, actionable decision.**

## 2. The stakeholders

| Stakeholder | Problem | Value Sisu delivers |
|---|---|---|
| **Young adults (18–30)** | Limited financial literacy, unfamiliar financial decisions | Personalized coaching and concrete next steps |
| **S-Pankki** | Banking data is underused as a tool for financial guidance | More engaging S-mobiili experience and customer loyalty |
| **Exa** | Information exists online but is difficult to turn into useful actions | A real-world demonstration of agentic research |
| **Verda + NVIDIA** | Need credible applications of sovereign/open-weight AI | A European banking AI deployment use case |

The **primary customer is the young adult**. Everyone else enables or benefits from serving that person.

## 3. Our flagship use case: "Can I afford to move out?"

This is ideal because it combines every important component without feeling forced.

<box gap={2} align="center">
  <box border radius="lg" padding={3} width="100%" gap={1}>
    <row align="center" gap={2}>
      <icon name="message-circle" color="secondary"/>
      **1. The user asks**
    </row>
    "I want to move into my own apartment in Helsinki. Can I afford it while still saving and investing?"
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" gap={1}>
    <row align="center" gap={2}>
      <icon name="landmark" color="secondary"/>
      **2. S-Pankki understands**
    </row>
    The agent examines income, recurring costs, discretionary spending, savings patterns and financial stability.
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" gap={1}>
    <row align="center" gap={2}>
      <icon name="search" color="secondary"/>
      **3. Exa investigates**
    </row>
    It researches live apartment listings, rental conditions, local living costs and potentially relevant public benefits—with visible sources.
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" gap={1}>
    <row align="center" gap={2}>
      <icon name="chart-no-axes-combined" color="secondary"/>
      **4. Sisu simulates**
    </row>
    The user compares several apartments and sees their effects on monthly cash flow, emergency savings and long-term investing.
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" gap={1}>
    <row align="center" gap={2}>
      <icon name="graduation-cap" color="secondary"/>
      **5. Sisu teaches and acts**
    </row>
    It explains affordability and opportunity cost, then prepares apartment inquiries or a realistic savings plan for the user's approval.
  </box>
</box>

## 4. Why this is a strong hackathon concept

<grid columns={2} gap={2}>
  {#each [{v:"20%",t:"S-Pankki financial literacy",d:"Learn through an actual life decision"},{v:"20%",t:"S-Pankki AI originality",d:"Personalized simulations plus an agent"},{v:"20%",t:"Exa usefulness",d:"Solve a concrete housing problem"},{v:"20%",t:"Exa live retrieval",d:"Research real listings and conditions"}] as item}
    <grid-item>
      <box border radius="lg" padding={3} gap={1} height="100%">
        <title size="xl" color="default">{item.v}</title>
        <text weight="medium" size="sm">{item.t}</text>
        <text size="xs" color="secondary">{item.d}</text>
      </box>
    </grid-item>
  {/each}
</grid>

These are the relevant judging weights, not a forecast of your score. The project would still need a convincing mobile experience, functioning implementation, strong source citations and evidence that the recommendations are financially sound.

## 5. How I'd pitch it

> **"Your first big financial decisions shouldn't be your first big financial mistakes."**
>
> Sisu is a personal financial agent that combines your banking data with real-world research to help you afford life's biggest milestones—starting with moving out. It doesn't just tell you what you can afford. It finds your options, simulates your future, teaches you the trade-offs, and helps you take action.

**My recommendation:** Build the entire hackathon demonstration around this one experience. Keep mortgages, refinancing and investment research as future applications of the same underlying technology.

This gives us a specific user, a recognizable problem, an emotional story, and a technically impressive solution that directly connects S-Pankki and Exa.

---

## User

I like the concept but I want to make it more clear and more compelling. How? Because we have a peer-reviewing injunction. I want it so the user or the peer reviewer can come up to our booth, and we'll be like, "Wow, how did it do that?" What is the exact thing that we can show them? Maybe it's a visual, maybe it's using data that they wouldn't otherwise see. I don't know.

---

## ChatGPT

**The wow factor should be that Sisu discovers something about your finances that you didn't know, finds a real-world solution, and visually changes your financial future in front of you.**

Not another chatbot. Not another budgeting dashboard.

I would build the entire booth demo around one feature:

# Sisu: Find Your Hidden Money

**The premise:** *What if your bank could find money you didn't know you were losing—and show you exactly how to get it back?*

## The 90-second booth demonstration

<box gap={3}>
  <row align="start" gap={3}>
    <AsyncImage query="premium fintech mobile banking app dark interface glowing transaction network data visualization" aspectRatio="4:3" maxWidth="144px"/>
    <box flex="1" gap={1}>
      <text weight="medium">1. The Financial X-Ray</text>
      <text color="secondary" size="sm">The reviewer selects a simulated customer profile. Hundreds of transactions animate into three spending baskets. Sisu identifies financial inefficiencies and unexpected patterns.</text>
      <text weight="medium" size="sm">"We found three opportunities you might be missing."</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="start" gap={3}>
    <AsyncImage query="futuristic financial assistant interface with floating research source cards magnifying glass dark navy fintech dashboard" aspectRatio="4:3" maxWidth="144px"/>
    <box flex="1" gap={1}>
      <text weight="medium">2. The Internet Investigation</text>
      <text color="secondary" size="sm">The reviewer picks one opportunity. Exa searches live websites and produces source-backed alternatives, including costs, conditions and estimated savings.</text>
      <text weight="medium" size="sm">"Here's a real alternative we found just now."</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="start" gap={3}>
    <AsyncImage query="interactive futuristic personal finance dashboard glowing branching pathways financial future projection graph sophisticated dark UI" aspectRatio="4:3" maxWidth="144px"/>
    <box flex="1" gap={1}>
      <text weight="medium">3. The Future Splits in Two</text>
      <text color="secondary" size="sm">A dramatic animated visualization branches into two futures: doing nothing versus taking the proposed action. The reviewer sees the effect on savings, lifestyle and investment goals.</text>
      <text weight="medium" size="sm">"This single decision could change your financial future."</text>
    </box>
  </row>
  <divider color="subtle"/>
  <row align="start" gap={3}>
    <AsyncImage query="modern mobile fintech interface artificial intelligence assistant with approval card document ready to send sleek dark UI" aspectRatio="4:3" maxWidth="144px"/>
    <box flex="1" gap={1}>
      <text weight="medium">4. One-Click Action</text>
      <text color="secondary" size="sm">Sisu prepares the actual next step—an email, application checklist or negotiation request—with a source-backed explanation. The reviewer can approve or modify it.</text>
      <text weight="medium" size="sm">"We didn't just find the opportunity. We prepared the solution."</text>
    </box>
  </row>
</box>

## The visual I'd make unforgettable

An interactive **Financial Multiverse**.

Instead of a conventional line chart, give the reviewer three different financial futures they can explore.

{@body const [scenario,setScenario]=DIL.useState("optimized")}
{@body const scenarios=[{id:"current",label:"Do nothing",monthly:0},{id:"optimized",label:"Recover €150/mo",monthly:150},{id:"invest",label:"Invest €150/mo",monthly:150}]}
{@body const selected=scenarios.find(x=>x.id===scenario)}
{@body const growth=selected.id==="invest" ? 150*((Math.pow(1+0.05/12,120)-1)/(0.05/12)) : selected.monthly*120}
<box border radius="2xl" padding={3} gap={3}>
  <row align="center" justify="between">
    <text weight="medium">Your financial multiverse</text>
    <badge>Concept demo</badge>
  </row>
  <segmented-control block={false} size="md" value={scenario} onChange={setScenario} options={[{"label":"Current","value":"current"},{"label":"Save","value":"optimized"},{"label":"Invest","value":"invest"}]}/>
  <box align="center" gap={1}>
    <text size="xs" color="secondary">Additional wealth after 10 years</text>
    <title size="2xl" color="success" tabularNums>+€{Math.round(growth).toLocaleString("en-US")}</title>
    <text color="secondary" size="xs">{scenario==="invest"?"Hypothetical 5% annual return":scenario==="optimized"?"Assumes €150 monthly savings are retained":"No change to current habits"}</text>
  </box>
  <svg viewBox="0 0 340 154" width="100%" xmlns="http://www.w3.org/2000/svg">
    {#each [30,65,100,135] as y}
      <line x1="8" y1={y} x2="332" y2={y} stroke="currentColor" opacity=".09" strokeDasharray="3 4"/>
    {/each}
    <path d="M10 137 L330 137" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="5 5" fill="none"/>
    <path d="M10 137 Q155 117 330 51" stroke="#0d9488" strokeWidth={scenario==="optimized"?4:2} opacity={scenario==="optimized"?1:.3} fill="none"/>
    <path d="M10 137 Q170 126 330 15" stroke="#16a34a" strokeWidth={scenario==="invest"?4:2} opacity={scenario==="invest"?1:.3} fill="none"/>
    <circle cx="330" cy={scenario==="current"?137:scenario==="optimized"?51:15} r="5" fill={scenario==="current"?"#94a3b8":scenario==="optimized"?"#0d9488":"#16a34a"}/>
    <text x="9" y="151" fill="currentColor" opacity=".6" fontSize="10">Today</text>
    <text x="292" y="151" fill="currentColor" opacity=".6" fontSize="10">Year 10</text>
  </svg>
  <text color="secondary" size="xs">Illustrative gains relative to the current baseline, excluding taxes, fees and inflation. The investment scenario is not a forecast.</text>
</box>

The real application would automatically generate these scenarios from transaction data and researched opportunities, not from predefined numbers.

## The detail that makes judges say "How did it do that?"

**Let them interrupt the demonstration and challenge the agent.**

A reviewer asks through ElevenLabs:

> "What if I lose my job for three months?"

Sisu immediately recalculates cash flow, shows how long their emergency fund lasts, searches relevant Finnish financial-support resources through Exa, and suggests a revised plan.

Then another reviewer asks:

> "What if my rent increases by 15%?"

The simulation updates again.

This is where voice, bank data, live research, persistent context and financial literacy converge into a single experience.

## What I would prioritize

The real technical achievement is **a reliable, live financial decision engine**. The animation simply makes that achievement visible.

For Junction, build three exceptionally reliable capabilities: transaction analysis, live opportunity research, and scenario simulations. Make the reviewer able to choose their own question instead of watching a scripted video.

And keep an evidence drawer showing which numbers came from banking data, which came from Exa, and which are assumptions. That directly strengthens Exa's source-clarity score and S-Pankki's trust requirements.

**The one-line pitch I'd put above your booth:**

# "Your bank knows your past. Sisu changes your future."

The strongest possible moment is when the reviewer says, **"Wait, can you check my situation instead?"** And your agent actually can.

---

## User

Okay, I also want to center this around Aspunc's data because they have a shit ton of data that goes underused, right? It can be super personalized. Also, because it's so personalized, they need to run these models open source, and they need to run them on their own infrastructure. They can't run this shit. They can't run it on Claude's API because it's going to give this super sensitive information to Claude.

Also, I think this can help us win the Nvidia one because it's a super good use of their open source tech.

Secondly, about the agent, I think Exa explicitly said to use an agent that actually does something. We can make it not only be conversational but also do things inside the app, maybe do some things that the user doesn't want to do themselves.

---

## ChatGPT

I agree with the direction: the bank’s underused transaction data should be the competitive advantage, and the agent needs to complete real tasks rather than just answer questions. I’m checking the NVIDIA angle and then I’ll pin down the exact in-app actions worth demonstrating.

---

## ChatGPT

I think this is the strongest direction so far. **Sisu should become an autonomous financial agent built on S-Pankki's underused banking data—not simply a conversational financial coach.**

And we have a compelling technical story: **Finnish banking intelligence, NVIDIA open models, European infrastructure, and an Exa-powered agent that actually gets things done.**

## 1. The architecture

<box border radius="xl" padding={3} gap={2} align="center">
  <box background="surface-secondary" radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="smartphone" size="lg"/>
    **S-mobiili Interface + ElevenLabs**
    <text color="secondary" size="xs">Voice, chat, visualizations, user approvals</text>
  </box>
  <icon name="arrow-down" color="tertiary"/>
  <box border={{size:1,color:"default"}} radius="lg" padding={3} width="100%" align="center" gap={1}>
    **NVIDIA Nemotron + NeMo**
    <text color="secondary" size="xs">Open-model reasoning, tool calling, model evaluation and customization</text>
  </box>
  <grid columns={2} gap={2}>
    {#each [{name:"S-Pankki data",desc:"Transaction patterns, cash flow, mortgage history",icon:"landmark"},{name:"Exa",desc:"Live financial research and sourced opportunities",icon:"search"},{name:"Financial engine",desc:"Exact calculations and simulations",icon:"calculator"},{name:"Memory",desc:"Customer goals, preferences and past decisions",icon:"brain"}] as item}
      <grid-item>
        <box radius="lg" background="surface-secondary" padding={3} align="center" gap={2} height="100%">
          <icon name={item.icon} size="lg"/>
          <text weight="medium" size="sm" textAlign="center">{item.name}</text>
          <text size="xs" color="secondary" textAlign="center">{item.desc}</text>
        </box>
      </grid-item>
    {/each}
  </grid>
  <icon name="arrow-down" color="tertiary"/>
  <box border radius="lg" padding={3} width="100%" align="center" gap={1}>
    <icon name="bot" size="lg"/>
    **Autonomous Action Engine**
    <text color="secondary" size="xs">Research → Compare → Simulate → Prepare → Approve → Execute</text>
  </box>
  <box background="surface-tertiary" radius="lg" padding={2} width="100%" align="center">
    <row align="center" gap={2}>
      <icon name="server" color="secondary"/>
      <text weight="medium" size="sm">Verda — European GPU and cloud infrastructure</text>
    </row>
  </box>
</box>

NVIDIA supports running Nemotron models on self-managed infrastructure, and NeMo supports specialization and evaluation. <Cite refs={["turn482340search1","turn482340search4","turn482340search9"]}/>

## 2. What should the agent actually do?

This is where we can win Exa's challenge.

I'd implement three concrete actions.

| Agent capability | What it actually completes |
|---|---|
| **Expense Negotiator** | Identifies a potentially expensive recurring bill, finds alternatives using Exa, and prepares a personalized cancellation or negotiation message |
| **Benefits Hunter** | Researches relevant Finnish benefits, checks eligibility requirements, gathers missing information, and prepares an application checklist |
| **Financial Goal Executor** | Calculates an affordable savings target and, in a simulated banking environment, creates or modifies a recurring savings instruction |

The distinction is important: **the agent doesn't just recommend an action. It carries the workflow as far as its permissions allow.**

For the hackathon, banking actions should run against a simulated environment. We shouldn't claim live S-Pankki account integration.

## 3. The booth moment I'd engineer

<box border radius="xl" padding={3} gap={3}>
  <row align="center" justify="between">
    **Sisu Opportunity Engine**
    <badge color="success">Illustrative demo</badge>
  </row>
  <box gap={1}>
    <text color="secondary" size="xs">Identified from transaction history</text>
    <title size="lg">Your monthly expenses may be unnecessarily high.</title>
  </box>
  <box background="surface-secondary" radius="lg" padding={3} gap={2}>
    <row justify="between" align="center">
      <text weight="medium">Recurring telecom expense</text>
      <title size="lg">€39.90/mo</title>
    </row>
    <row justify="between" align="center">
      <text color="secondary" size="sm">Potential alternative</text>
      <text color="success" weight="medium">€24.90/mo</text>
    </row>
    <divider color="subtle"/>
    <row justify="between" align="center">
      **Potential annual saving**
      <title color="success">€180</title>
    </row>
  </box>
  <text size="sm" color="secondary">The actual app would verify an available offer, contract conditions and any switching fees before calculating savings.</text>
  <button block color="primary" onClick={()=>GenUI.issueNewTurn("Design the exact hackathon implementation of Sisu's Expense Negotiator: S-Pankki transaction detection, Exa live comparison, verified sources, drafting and simulated action execution.")}>
    Design the autonomous switching workflow
  </button>
</box>

The reviewer says:

> "Can you find me a better deal?"

Sisu searches the live web, identifies a suitable alternative, explains the trade-off and prepares the switch. The reviewer approves, and the simulated recurring expense changes.

**Then the financial-future visualization updates automatically.**

That's the wow moment: research, execution and financial impact connected in one continuous interaction.

## 4. Your NVIDIA and privacy argument

Your instinct is strategically right, with one qualification.

Using a proprietary external API doesn't automatically mean losing ownership of the data or violating privacy requirements. That depends on contractual terms, processing arrangements, security, retention and regulation.

However, for a bank, a self-hosted open-weight model offers meaningful advantages:

- Control over inference and where sensitive data is processed.
- Ability to customize models using approved proprietary banking knowledge.
- Greater independence from a single external model provider.
- More control over monitoring, security and costs.

**One architectural rule:** customer transaction data should remain in a protected database. The model retrieves only authorized information when needed. We should not train the model continuously on individual customers' raw financial transactions.

Also, I haven't verified the exact NVIDIA Junction prize criteria, so we shouldn't assume that merely using Nemotron qualifies us. A demonstrable NeMo customization, evaluation or agent capability would make a stronger NVIDIA submission.

## 5. The big idea

I'd position Sisu as:

**"The first financial agent that turns your bank's knowledge into actions that improve your life."**

S-Pankki provides deep personalization, NVIDIA provides controllable AI, Verda provides European infrastructure, and Exa gives the agent access to the real world.

My recommendation for the hackathon is to perfect **one end-to-end autonomous workflow**—expense detection, live comparison, user approval, simulated execution and recalculated financial future—before building additional agent capabilities.

That single sequence is more likely to impress peer reviewers than ten impressive-looking features that don't work together.

---

## User

All right, look at all the context in this conversation, and I want you to output a full document outlining what we're doing. Don't leave out what I said. Leave out all the stages and what we've ended at, so I can give it to Claude. Give me a Google Doc. Also, I have a lot more information from the Discord, which I'll attach to this chat, and you can add to the document with links as well. Synthetic dataset is available here: https\://github.com/hackjunction/Junction-2026-S-pankki | s-pankki challenge:&#x20;

1. Explore how AI can turn personal banking data into a trusted financial coach for everyday life.  S-Bank is Finland’s fourth-largest bank, with 3.5 million customers, and its S-mobiili app is used weekly by one in three Finnish adults. We want to reimagine personal finance by letting people talk with their own financial data through AI. Banking today often stops at statements and transaction lists. We want to make it conversational, insightful, and personalised. At Junction, we invite you to help us build the next generation of AI-driven personal economic trainers that make money matters simple and engaging for everyone.  Using a large synthetic transaction dataset modelled on real S-Bank data, build an AI experience that lets people chat with their own money, from simple questions like “How much did I spend on taxis last month?” to deeper ones like “What kind of spender am I?”, “What is safe for me to spend this week?” or “How much could I save if I reduced dining out by 20%?”.  We value a pedagogical angle: everyone’s spending falls into three baskets:  mandatory and regular (e.g. rent) mandatory and irregular (e.g. a broken washing machine), and everyday spending that slips through your fingers (e.g. coffees) — and solutions that help people understand where their money really goes will go far with us. Think in the spirit of MyData: let users explore their own data freely rather than showing fixed charts the bank has picked for them. You can enhance these insights with open data sources (e.g., Statistics Finland) to offer meaningful benchmarks.  Recommended output: a mobile app, or a web app that can be embedded in a mobile app — our customers are on mobile.

2. Extra details: To our knowledge, no Finnish bank yet lets customers chat with their own financial data, making this a first-of-its-kind opportunity in Finnish banking. The challenge ties directly to S- Bank’s strategy of serving customers increasingly digitally and to our vision for S-mobiili. One of the top-rated finance apps on both Google Play and the App Store, so a winning idea could reach millions of people. Money matters touch everyone, and we believe AI can play a key role in improving financial literacy — especially among young adults.  We are especially interested in conversational AI that explains financial concepts in plain language, simulates “what if” scenarios, and guides users toward healthier money habits, for example through safe-to-spend and safe-to-save guidance. Benchmarking personal data against open population data is encouraged but not mandatory.  Optional bonus angle (not required, the challenge is fully solvable with the provided data and open data): Multi-bank view: under PSD2, customers can let their bank fetch account data from other banks. How could an AI coach use the customer’s full financial picture?  Data: We will provide large synthetic transaction dataset modelled on the structure of S-Bank data |||&#x20;

   # The Internet Butler / Your Personal Assistant

   by Exa

   ## The Challenge

   Build an agent that takes tedious tasks in people’s lives off their hands.

   **Introduction:** Everyone has pain points in their day to day which require hours of digging and research like checking whether a rent increase is legal, or finding out which benefits a family qualifies for, which vegan restaurant to pick for an anniversary date, and more. The answers exist, but they are buried across the web. Exa is the search engine built for AI. It can find, read and compare information from across the web and pull it back as structured data, so your agent can do the digging and the task can be handed off completely.

   **The challenge:** Develop a personal agent that helps people get stuff done. Your agent should find what matters across the web, work out what needs to happen and get the task as close to done as it can, leaving the final approval to the user if needed. Demo on a real case.

   **Areas of interest:** General tasks. Examples: planning special occasions, handling daily living errands, rent, missed benefits, business information, travel disruption, etc.

   **How we judge:** We will judge projects on how well they use Exa to get information that could not have come from a model's training data alone, how useful they are to a specific group of real people, and how clearly they show their sources. We will also look at originality and at whether the demo works on live queries, including ones the judges try themselves.

   The winning team will receive [cash amount] and [Exa API credits per member], and the two runner-up teams will receive [amounts]. Every team that submits a working project built on Exa will receive [API credits] to keep building after the event. [Consider a mentoring session or visibility on Exa's channels for the winners.]

   **About Exa:** Exa is a search engine built for AI. We index the web by meaning, so AI applications can find information by describing what they need, and we return clean, structured content that models can use directly. Companies such as Cursor, Cognition, HubSpot and AWS use Exa to connect their products to the web. We are joining Junction to meet builders, see new ideas for what AI can do with access to the whole web, and keep supporting promising teams after the event.

   ## Resources

   **What we'll bring:** Every participant will get $50 in Exa Credits and access to our full API for the event. This includes the Search API with fast, balanced and deep research modes, and the Contents API for full page text, highlights, summaries and crawling a site's subpages.

   Teams can filter results by date, domain and category (such as news, research papers, companies, people and personal websites), request results as structured JSON, and retrieve past versions of web pages.

   We will also provide Websets for building verified lists of people, companies and opportunities, Monitors for recurring searches, our hosted MCP server, and Python and JavaScript SDKs. Our demo gallery at [**demos.exa.ai**](https://demos.exa.ai/) has working examples teams can build from.

   Exa engineers will be on site throughout the event to help with technical questions and project ideas, and there will also be a Discord channel to receive asynchronous advice.

   Free $50 Exa Credits: EXA50JUNCTION (Redeem it at [**dashboard.exa.ai/billing**](https://dashboard.exa.ai/billing)) |||&#x20;

   # Verda Compute Track

   by Verda

   ## The Challenge

   ### INTRODUCTION

   From electron to token, it takes decades of progress to run AI. Add scale, efficiency, and sustainability, and AI becomes a monumental achievement.

   Verda brings everything together.

   We make compute, storage, and networking work in unison to squeeze peak performance, hosted in European data centers and utilizing 100% renewable energy. We develop services for you to utilize computational power most efficiently, no matter your use case.

   The end result is a cloud platform trusted by the world's leading AI labs and frontier researchers. The best thing is you get to use the same next-gen compute for free at Junction 2026.

   ### BOUNTY: BEST USE OF VERDA

   Pick any challenge at Junction and use Verda products to build something you couldn't build on a laptop. Then show us how far it goes.

   - **Teach a humanoid to move**. Train locomotion or manipulation policies for Aalto's Unitree G1 in simulation, at scale, before your shot at the real robot.
   - **Turn demonstrations into a brain**. Train imitation-learning or VLA policies from robot-arm demos in the Ignite × Intel challenge, or from Rokoko motion-capture teleoperation data.
   - **Make an agent stronger than it was on Friday.** Run thousands of rollouts in your AfterQuery RL environment and fine-tune a smaller model on the experience.
   - **Read the whole internet's encyclopedia.** Embed MariaDB's full Wikipedia dataset with batch jobs and serve a RAG assistant on top.
   - **Keep sensitive data in Europe.** Run open-weight models for a banking coach or a recruitment tool on infrastructure you control, instead of sending data to someone else's API.

   **Or surprise us.** Anything that needs serious compute counts. (Anything except crypto mining. We've seen it, and it gets you banned.)

   **What we're looking for**

   - An ambitious idea where compute is what makes it possible
   - The right Verda product for the job, and a clear reason why you chose it
   - Your path from first idea to working prototype
   - Bonus points: show how your solution would scale from a hackathon demo to real users

   **Minimum Requirements**

   - Document your process
   - Share a link to a summary → Post it in our Discord channel

   **The Technology**

   - Inference API for serving out-of-the-box open-weight models within your application.
   - GPU instances or Instant clusters for training or fine-tuning tasks.
   - CPU instances for hosting agentic applications.
   - Auto-scaling containers for hosting models where scale and costs matter.
   - Batch jobs for long-running tasks in the background.

   **Prizes and Judging**

   The winning team gets 10,000 USD in cloud credits and Verda hoodies. Runner-up teams in second and third places get 2,500 USD in cloud credits.

   ## Resources

   ### What we'll bring

   - **Inference API:** serve open-weight models in your app with zero setup
   - **GPU instances and Instant Clusters:** for training and fine-tuning when one GPU isn't enough
   - **CPU instances:** to host your agents and backends
   - **Auto-scaling containers:** deploy models where scale and cost matter
   - **Batch jobs:** run long jobs in the background while you sleep (or don't)
   - **NVIDIA Nemotron endpoint:** hosted by Verda together with NVIDIA
   - **Free credits for every team:** scan the QR code on your table or go to [**verda.com/blog/junction-2026**](https://hackjunction.app/participate/45/tech-challenges/verda.com/blog/junction-2026)

   **Mentors on-site during the entire weekend**, meet us on the third floor at Booth 6! Start with the **"Getting started with Verda"** workshop on Friday at 20:30, right after the opening ceremony: sign-up, credits, every product, and how to use them.

   Ambition: how much did compute let you do that you otherwise couldn't? Fit: did you pick the right Verda services and use them well? Working prototype: does it run, and is the process documented? Path to scale: is there a credible way from demo to real users?

   Company Info

   ## Verda

   Website: [http://verda.com/](http://verda.com/)

   ## Judging Criteria

   - **Ambition**(25%)

     How much did compute let you do that you otherwise couldn't?
   - **Fit**(25%)

     Did you pick the right Verda services and use them well?
   - **Working prototype**(25%)

     Does it run, and is the process documented?
   - **Path To Scale**(25%)

     Is there a credible way from demo to real users?

   ## Prizes

   - **1st Place**

     $10,000 in Verda cloud credits + Verda hoodies

   - **2nd Place**

     $2,500 in cloud credits

   - **3rd Place**

     $2,500 in cloud credits ||| Also, a quick note: can you make a visualizer in the doc of the whole stack, layer by layer, of what we'll have? |||&#x20;

     # Best Use of ElevenLabs

     by Major League Hacking

     ## The Challenge

     Deploy natural, human-sounding audio with ElevenLabs. Create realistic, dynamic, and emotionally expressive voices for any project, from interactive AI companions to narrated stories and voice-enabled apps. ElevenLabs will empower you to build rich, immersive experiences without the need for actors or complex audio production, using simply the power of AI.

     Integrate fully autonomous audio experiences into your hack with ElevenLabs and give your project a voice, along with giving your team the chance to win some wireless earbuds!

     ## Resources

     Claim your code at [**https://mlh.link/junction-26**](https://mlh.link/junction-26) and check how to build with ElevenLabs at [**https://mlh.link/elevenlabs**](https://mlh.link/elevenlabs)

     Company Info

     ## Major League Hacking

     Major League Hacking (MLH) is a community-focused organization that empowers student developers through hackathons, technical workshops, and hands-on learning experiences. Serving as the official student hackathon league, MLH supports events around the world by providing resources, mentorship, and a platform for students to collaborate, build innovative projects, and strengthen their technical skills. By fostering an inclusive and enthusiastic environment, MLH helps students grow as developers, leaders, and creators while connecting them with a global network of peers and industry partners.

     ## Prizes

     - **Best Overall**

       Wireless Earbuds |||&#x20;

       # Best Use of Nemotron

       by NVIDIA

       ## The Challenge

       Build a project powered by NVIDIA Nemotron that solves a real problem through reasoning, tool use, or coordinated workflows. Applies to: Any track.

       ### INTRODUCTION

       What can you build when AI moves beyond answering questions and starts getting things done? NVIDIA invites you to use Nemotron to build a project that tackles a real problem for a clear audience. Connect it to tools, ground it in useful data, or combine it with other models to turn an idea into a working solution. Show us what Nemotron enables and why it matters to the people using your project.

       ### THE TECHNOLOGY

       Meet Nemotron 3.5 Super VL, NVIDIA's newest open model, and it's yours to build with this weekend. It has 120B parameters but only wakes up 12B per token, so it runs fast for its size, and it can read text, images, documents and even video in a single workflow. That means your agent can look at a screenshot, read a PDF, watch a clip, call a tool and write the code to act on it, all with one model.

       ### THE CHALLENGE

       Build a project where Nemotron plays a meaningful role in doing real work. Use it on its own or alongside other models, tools, and data sources to solve a problem for a clear audience. Nemotron must contribute directly to the project's core functionality, and your demo should make that contribution visible. The solution is open-ended: choose the problem, design the workflow, and show what your approach enables.

       **Minimum Requirements:**

       - Use NVIDIA Nemotron 3.5 Super VL model in the working solution.
       - Demonstrate its contribution to the project's core functionality.
       - Submit a short explanation identifying the model used, what it does, why it matters, and how you improved its outputs.
         - This should be done as text input into the submission form.

       ### GETTING STARTED

       - **NVIDIA Build:** Free hosted APIs to explore, test, and prototype with NVIDIA and community AI models.
         - Note: The API is OpenAI-compatible with base URL [**https://integrate.api.nvidia.com/v1**](https://integrate.api.nvidia.com/v1) (for example, model **`"nvidia/nemotron-3.5-lightning-30b-a3b"`**). The free tier is rate-limited (developer forums report about 40 requests per minute per key), so agent loops should use retries with backoff and each teammate should use their own key.
       - **OpenRouter API:** Serverless path with a unified API across providers.
         - Note: Free variants (ending in **`:free`**) are capped at 20 requests per minute and 50 requests per day, or 1,000 per day once the account has bought at least 10 credits.
       - **Hugging Face:** Open weights for local runs, fine-tuning or deployment on Brev.

       ### RESOURCES AND SUPPORT

       - **Support Channel:** Nvidia Discord channel and at the NVIDIA table

       ### PRIZES AND JUDGING

       ### PRIZE

       2 winners of 1x RTX 5080

       ### JUDGING CRITERIA

       - **Meaningful Nemotron Usage:** Nemotron is central to the project's value. The team clearly explains what it does and why it matters.
       - **Technical Execution:** The demo works reliably and shows thoughtful implementation choices around architecture, data flow, tool use, latency, or error handling.
       - **Quality of AI Output:** Outputs are useful, relevant, and grounded where appropriate. The team demonstrates efforts to improve quality through prompting, evaluation, or feedback loops.
       - **Creativity and Differentiation:** The team uses Nemotron thoughtfully or inventively, with a distinct approach to the problem.

       ### COMPANY AND CONTACTS

       #### About NVIDIA

       NVIDIA builds accelerated computing technologies and AI software that help developers turn ideas into applications. At Junction, we're inviting teams to explore NVIDIA Nemotron open models and build useful agents around real-world needs. Start with a problem you care about and show what you can do over the weekend.

       #### Contacts

       - **Main Contact:** Elliot Winch, Community Program Manager, EMEA, [**ewinch@nvidia.com**](mailto:ewinch@nvidia.com)
       - **Technical Contact:**
       - **Mentors Attending:** Maxime Pariente and Ryan Reese
       - **Judges:** NVIDIA Team

       Company Info

       ## NVIDIA

       Website: [https://www.nvidia.com/en-us/](https://www.nvidia.com/en-us/)

       ## Judging Criteria

       - **Meaningful Nemotron Usage**(25%)

         Nemotron is central to the project's value. The team clearly explains what it does and why it matters.
       - **Technical Execution**(25%)

         The demo works reliably and shows thoughtful implementation choices around architecture, data flow, tool use, latency, or error handling.
       - **Quality of AI Output**(25%)

         Outputs are useful, relevant, and grounded where appropriate. The team demonstrates efforts to improve quality through prompting, evaluation, or feedback loops.
       - **Creativity and Differentiation**(25%)

         The team uses Nemotron thoughtfully or inventively, with a distinct approach to the problem.

       ## Prizes

       - **Two best teams**

         1x NVIDIA RTX 5080 |||&#x20;

         # Best use of Modal

         by Modal

         ## The Challenge

         ## Take your Junction project from laptop to production AI on Modal.

         ### Description

         Every Junction team is building with AI, and most hit the same wall: the model runs on a laptop, but too slowly, not on a GPU, and not behind a URL the judges can open. Modal gets you past that wall. Use Modal to power the project you're already building for your main Junction challenge: serve an open model on a GPU, run your agent's code in secure Sandboxes, fine-tune a model on your own data, or fan out a big batch job, all in plain Python with no Dockerfiles, Kubernetes or YAML. We're looking for the most ambitious working AI system built on Modal, where Modal does the heavy lifting and the team spends its 48 hours on the problem. Inference, agents, sandboxes and training: your whole AI stack on one platform.

         ### Mentors:

         Engineers and Developer Relations from Modal with experience in inference, AI agents and code-execution sandboxes, fine-tuning and reinforcement learning, and real-time audio and video pipelines. We'll be at the Modal booth throughout the event and on the Junction Discord for debugging help.

         Main contact person: Filip Makraduli, Developer Relations Engineer

         ## Insight

         Modal was built so that a single developer can do what used to take a platform team, which makes it a natural fit for a 48-hour hackathon. Best use of Modal is a tech challenge, so you compete in it on top of your main challenge: use Modal to power the project you're already building and you can enter. The same project can enter other tech challenges too.

         ### What we’ll bring:

         Every participant gets $100 in Modal credits for CPUs and GPUs, up to the latest NVIDIA B300s, billed per second and scaling to zero when idle. Modal is Python-native: decorate a function, run modal run, and it executes in the cloud in seconds; modal deploy turns it into an autoscaling web endpoint with a public URL ready for your demo. Teams can serve open-weight LLMs, vision-language and speech models; run untrusted, LLM-generated code in isolated Sandboxes; fine-tune or RL post-train models on one GPU or a multi-node cluster with Modal Dojo, our open-source training library; and store weights and datasets in Volumes. We'll provide a Junction starter kit of ready-to-run examples. The kick-off workshop will be at the Modal booth and announced on Discord, and Modal engineers will be on site all weekend.

         ## Resources

         ### Access and list of technologies we are bringing:

         • Modal compute credits ($100 per participant) for CPUs and GPUs: T4, L4, A10, L40S, A100 (40 and 80 GB), RTX PRO 6000, H100, H200, B200 and B300 • Modal Python SDK and CLI (pip install modal), plus JavaScript and Go SDKs for Sandboxes • Modal Sandboxes: secure, on-demand containers for agents, code interpreters and evals • Web endpoints (FastAPI, WebSockets, WebRTC) with autoscaling and public URLs • Volumes, Dicts and Queues for model weights, datasets and shared state • Modal Dojo: open-source library for fine-tuning and RL post-training open models on Modal GPUs • Starter examples: LLM serving with vLLM and SGLang, speech-to-text, text-to-speech, vision, RAG, agents and RL • On-site mentors from Modal engineering and Developer Relations

         To claim $100 in Modal credits you need to sign up for a Modal account, then redeem the credits via the link ([**https://modal.fillout.com/t/qMXCmRGseUus?code=VVX-2QX-8HW**](https://modal.fillout.com/t/qMXCmRGseUus?code=VVX-2QX-8HW)) using the code VVX-2QX-8HW.

         The credits are valid for one year from redemption, so everyone can keep building well after the hackathon wraps up.

         Company Info

         ## Modal

         Website: [https://modal.com/](https://modal.com/)

         ## Judging Criteria

         - **Effective use of Modal**(40%)

           how central Modal is to the project and how well you use it, from GPU inference to Sandboxes, training and scaling out
         - **Technical ambition**(25%)

           how hard the build is and how far you pushed it in 48 hours
         - **Impact**(20%)

           how well it solves a real problem from your main challenge
         - **Demo**(15%)

           a live, deployed app the judges can actually use

         ## Prizes

         - **1st team**

           $2000 in cash prize & $3000 in Modal credits |||&#x20;

           # Best Use of Context.dev: Fully Structured Web

           by Context.dev

           ## The Challenge

           Plug the Context.dev API into whatever you're building and give it the live web: pages, brands, companies, people and news as clean structured data in one API call.

           ## The Challenge

           Whatever you're building, use the **Context.dev API** to extract exactly what you need from the web and nothing more.

           Live web data lets your project check facts against current sources, react when a page or news story changes, brand itself from a customer's email, or enrich a company or person in one call instead of relying on stale data.

           To count, your project must call **at least one Context.dev endpoint in its core flow**, not just as a side feature.

           ### Minimum requirements

           - Use **at least one Context.dev API endpoint** in the submitted project.
           - The data from Context.dev must **visibly drive something in the demo**.

           ### What to submit

           Submit a **GitHub repository and a demo of your project**, plus a short note on **which Context.dev endpoints you used and why**.

           ## Resources

           ## What we'll bring

           Every team gets **50,000 Context.dev API credits that don't expire**, plus documentation, SDKs, an MCP server, live example projects and **Context.dev engineers on site** to help.

           **No credit card needed.** There is no rate limit, with a maximum of **50 concurrent requests per organisation**. No special hardware is needed; the live web is your dataset.

           ## The Technology

           Context.dev is a **web data API**. You send it a URL, a domain, a company or a search query, and it returns clean, structured data — markdown, JSON, screenshots, logos, colours, company facts and news — that your app or model can use right away. No scrapers, proxies or parsers to maintain.

           **Key capabilities:**

           - **Search and scrape:** turn pages into markdown, HTML, screenshots or images, or crawl and map a whole site.
           - **Structured extraction:** extract JSON with your own schema, or get researched answers to a question.
           - **Brand data:** get logos, colours, fonts and a style guide from a domain or email.
           - **Search and enrichment:** search and enrich companies, people and news.
           - **Monitors and webhooks:** react when a page or topic changes.
           - **Batch processing:** process thousands of URLs.
           - **File parsing:** parse PDFs and documents.
           - **Social media:** scrape feeds such as TikTok and Instagram.

           ## Getting started

           1. **Create an account** at [**context.dev/signup**](https://context.dev/signup). Coding agents can use [**context.dev/auth.md**](https://context.dev/auth.md).
           2. **Redeem code `JUNCTION26`** at [**Redeem credits**](https://context.dev/dashboard/redeem-credits) to receive **50,000 API credits per team, with no expiry**.
           3. **Copy a secret key** from the [**API keys page**](https://context.dev/dashboard/api-keys).
           4. **Install the SDK:** **`npm install context.dev`** or **`pip install context.dev`**.
           5. **Scrape your first page** using the code in the [**Quickstart**](https://docs.context.dev/quickstart). You should see the Junction homepage printed as Markdown. Swap in any URL, or try brand, search, news or monitors. Start building!

           **Using a coding agent?** Point it at the [**Agent quickstart**](https://docs.context.dev/agent-quickstart), or connect the MCP server at [**https://mcp.context.dev/mcp**](https://mcp.context.dev/mcp) ([**setup guide**](https://docs.context.dev/install-mcp)).

           **Example requests and responses:**

           - **Scrape the Junction website to Markdown:** [**request + response**](https://gist.github.com/contextualbeer/c602446780d9270a4d817a4a677c6317).
           - **Extract this event's details as JSON:** [**request + response**](https://gist.github.com/contextualbeer/d2a016dcd6c535e4eeffa4d6988bd403).

           ## Recommended setup

           Use **any language over HTTP**. SDKs are available for **TypeScript/Node, Python, Ruby and Go**. If you can call an API, you can use Context.dev, whether you're building a web app, backend or something else that can make an HTTP request.

           Bring any laptop with **Node.js 20+ or Python 3.9+** (Ruby 3.2+ and Go 1.22+ are also supported), or just curl. **Internet access is required.**

           Optional tools: the [**context-dev CLI**](https://docs.context.dev/install-cli), the [**agent skill**](https://docs.context.dev/install-skill), or the [**MCP server**](https://docs.context.dev/install-mcp). To try requests without code, use the [**Playground**](https://www.context.dev/playground/scrape).

           ## Tips and common pitfalls

           - **Check each output's `success` flag.** A 200 response can still contain a failed output.
           - **Set `maxAgeMs: 0` when you need fresh data.** Results are cached for up to 3 days by default, and cached results cost the same credits as fresh ones. Store results in your own app to avoid paying for repeat calls.
           - **Crawls, batches and monitors are asynchronous.** Poll the job or receive a webhook; use a service such as Cloudflare Tunnel for local webhooks.
           - **Some sites block automated access.** Teams are responsible for respecting the terms of the sites they use.

           ## Documentation and examples

           - **Documentation:** [**docs.context.dev**](https://docs.context.dev/)
           - **Guides:** [**Quickstart**](https://docs.context.dev/quickstart), [**Agent quickstart**](https://docs.context.dev/agent-quickstart), [**Recipes**](https://docs.context.dev/use-cases/live-web-context-for-agents)
           - **API reference:** [**Web scraping API**](https://docs.context.dev/api-reference/web-scraping/scrape)
           - **Operation costs:** [**Credits and pricing**](https://docs.context.dev/account/credits)
           - **Live examples:** [**GPU rental price tracker**](https://gpu.context.dev/) ([**source**](https://github.com/context-dot-dev/gpu-terminal)) and [**Yapper leaderboard**](https://yappers.context.dev/)
           - **SDKs and integrations:** [**github.com/context-dot-dev**](https://github.com/context-dot-dev)

           There is no starter repository; start with the **Quickstart guide**.

           ## Mentors and support

           Context.dev engineers will help with **web data extraction, search, LLM apps and large-scale data pipelines**:

           - **Beer van der Drift** — CTO, challenge lead and lead judge
           - **Yahia Bakour** — Founder & CEO
           - **Thomas Oomens** — Engineer

           **On-site availability:**

           - **Friday:** until 23:00
           - **Saturday:** from 09:00 until Sunday 02:00
           - **Sunday:** from 07:00 until the end

           Come visit the **Context.dev booth**. Main and technical contact: **Beer van der Drift**, CTO, [**beer@context.dev**](mailto:beer@context.dev). Service status: [**status.context.dev**](https://status.context.dev/).

           Company Info

           ## Context.dev

           Context.dev provides the web-data layer for AI: APIs that turn websites, brands, companies, people and news into structured, real-time context for software and agents. Teams like Supermemory, Mintlify and Upstash build on it. We went through YC S26 and raised a $9M seed led by General Catalyst, with investors like Paul Graham and Theo of T3. We're coming to Junction to see what the next generation of builders creates when the whole web is one API call away.

           ## Judging Criteria

           - **Creative use of Context.dev**(40%)

             Unusual sources, combining several endpoints.
           - **How central live web data is to the product**(30%)
           - **Technical execution**(30%)

             Accuracy, latency, handling of change over time.

           ## Prizes

           - **1st Place**

             €750 + swag
           - **2nd Place**

             €250 + swag
           - **3rd Place**

             Swag

---

## ChatGPT

I’ll turn this into a single Claude-ready project specification, using the challenge briefs and attached S-Pankki PDF as the source material. I’ll include the complete architecture diagram, dataset schema, product workflows, judging requirements, deployment choices, and source links—without the back-and-forth ideation history.

---

## ChatGPT

The brief now has a clear center: an S-Pankki data-powered financial agent that finds overlooked opportunities, researches them live, teaches the user the trade-offs, and prepares approved actions. I also found that the supplied dataset includes mortgage-process events, not just transactions, so I’m preserving that as a distinct capability rather than treating it as ordinary spending data.

---

## User

While you're building this document, I want you to also develop a plan on how we can delegate tasks across the three team members. We can have one guy on frontend design, one guy on the backend, and one doing something else. We each have something that we can work on and something that we can all bring together and build in the same repo, but just in different branches. Then we can push to main.

---

## ChatGPT

I’ll add a three-person ownership plan to the same Google Doc, with separate branches, shared API contracts, integration checkpoints, and a clean pull-request process. The key is to give each person work that can progress independently without creating merge chaos.

---

## ChatGPT

I've created the Google Doc and added the **three-person development plan** alongside the complete Sisu specification.

<box border radius="xl" padding={3} gap={2}>
  <row align="center" gap={2}>
    <icon name="file-text" color="info" size="lg"/>
    <box flex="1" gap={1}>
      **Sisu — Junction 2026 Complete Project Specification**
      <text color="secondary" size="xs">Google Doc · Claude-ready project brief</text>
    </box>
  </row>
  <button block onClick={()=>GenUI.openUrl("https://docs.google.com/document/d/1j89FAXhVkswDenSQbanF0HTxCT9sf2OSnPzA4ophhYM/edit")}>
    <icon name="external-link" size="sm"/> Open Google Doc
  </button>
</box>

It includes the full product concept, technical stack visualization, S-Pankki dataset schemas, Exa agent workflows, financial literacy and investing features, NVIDIA/Verda architecture, sponsor criteria, and implementation requirements.

## Three-person division

| Person | Ownership | Branch |
|---|---|---|
| **1 — Frontend** | Mobile UI, animations, Financial Multiverse, dashboards | `feature/frontend` |
| **2 — Backend & Data** | S-Pankki datasets, transaction analytics, financial calculations, APIs | `feature/financial-engine` |
| **3 — AI & Agents** | Nemotron, Exa, Context.dev, ElevenLabs, Verda, action workflows | `feature/agent-orchestration` |

**The most important rule:** agree on shared API contracts first. Then everyone can build independently, submit pull requests, and merge into `main` without constantly breaking each other's work.

I also included integration checkpoints, testing responsibilities, repository structure, and a definition of a successful live demonstration.

The document is written as a consolidated specification rather than a history of our brainstorming, so you can give it directly to Claude Code.