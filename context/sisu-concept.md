**My idea for Sisu**

The problem is that young adults have their bank transactions in one place and endless financial advice online, but still have to figure out what applies to them. If you get $1,000 for your birthday and Google “What should I do with $1,000?”, you’ll get plenty of links. Those links don’t know what you spend, what bills you have coming up, or what you’re saving for.

**Sisu is a proposed feature inside the banking section of S-mobiili.** You ask it a question by voice, and it uses your transaction history, current web research, or both to give you an answer that fits your situation. You can ask follow-up questions and see the numbers, assumptions and sources behind the answer.

**Example:** Jack is 18 and just got $1,000 for his birthday. He opens Sisu and asks, “I want to start investing, but I don’t have an emergency fund yet. Based on my spending, how much should I keep aside, and what could I change to build that fund faster?”

- **If the question is about Jack’s money**, Sisu uses S-Pankki data. If he asks, “What if I spend 20% less on food?”, it checks his actual grocery and restaurant spending and calculates what that change would save.
- **If the question needs outside information**, Sisu calls Exa to find current sources. If Jack asks, “Find me a cheaper phone plan that still meets my needs,” Exa finds public offers and their terms. Sisu compares those with his current bill, shows how much the switch could save, and prepares a message he can send to his provider.
- **If the question needs both**, Sisu combines them. His transactions show what he pays today. The web research shows what he could pay. The app does the math and explains how the difference affects his goal.

**The hands-off part:** Jack could save an ongoing project like “Keep me updated on student housing in my area.” Sisu could recheck the web and tell him when something relevant changes, such as a new listing within his budget. It could then show how the listed rent and deposit would affect his monthly budget and emergency fund.

**How the tools fit:** Gemini or ElevenLabs can handle the voice interaction. Sisu decides which tool it needs. Exa gets public search terms, and transaction data stays in our backend. If we use Verda, it can host that backend and run Nemotron. Nemotron could help decide what to simulate and explain the results. The calculator handles the actual numbers, including scenarios like “What if rent is €100 higher?”

**How this fits Junction:** S-Pankki is about helping Jack understand and act on his own money. Exa is about doing the research he would otherwise have to do himself and handing him something he can use. Verda fits if Nemotron actually powers part of the working flow.

**What the judges score**

- **S-Pankki (20% each)** — **Financial literacy** means Jack learns why the money in his account and what he can set aside are different. **AI originality** means Sisu understands follow-up questions and updates the scenario using his own data. **Mobile clarity** means he can see the answer and tap into the numbers. **Feasibility** means the calculations work on the supplied synthetic transactions. **S-mobiili integration** means the flow starts from the banking overview and connects back to the relevant transactions. [S-Pankki brief](https://hackjunction.app/participate/45/challenges/311)
- **Exa (20% each)** — **Use of Exa** means retrieving current facts that affect the answer, such as a setup fee or the price after a promotion. **Usefulness** means Jack gets a comparison and a message he can actually use. **Source clarity** means he can check where each key term came from. **Originality** comes from showing what a public offer means for Jack’s own budget and savings goal. **Working implementation** means a judge can change a requirement, run a fresh search, and get an updated answer. [Exa brief](https://hackjunction.app/participate/45/challenges/298)
- **Verda (25% each)** — **Ambition** means showing what the compute enabled, for example running Nemotron through a batch of realistic banking questions and measuring how often it picks the right tool. **Fit** means explaining why Verda is useful for running the model and where the data flows. **Working prototype** means showing Nemotron on Verda powering a real step and documenting the build. **Path to scale** means explaining how the system would handle more users while keeping their data separate. The brief also asks teams to share a process summary in Verda’s Discord. [Verda brief](https://hackjunction.app/participate/45/tech-challenges/56)

**What I’d build first:** One conversation where Jack asks about his birthday money, tests a savings change using his transactions, then asks Sisu to research one concrete way to save more. That lets us agree on the core product and test both S-Pankki and Exa in the same flow. The ongoing projects are the next feature I’d explore.
