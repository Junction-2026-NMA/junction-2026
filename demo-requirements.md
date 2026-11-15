# Sisu demo scenarios and implementation requirements

Prepared for Mark, Ariste and Nicholas. This brief describes intended demo behaviour and requirements to verify against the current app. There are three videos using two scenarios. Context.dev and Exa share the housing story and have different technical explanations.

## Video scene overview

| Scene | S-Pankki | Context.dev and Exa |
| --- | --- | --- |
| Real-life opening, already filmed | Jack enjoys himself on his phone. Red lighting signals that he is running short before payday. He searches for spending advice, gets overwhelmed and opens Sisu. | Jack feels cramped in his room, wonders whether he can afford a larger home in Espoo and opens Sisu. |
| App question | “Hey Sisu, I’m running short before payday. How much can I spend until my next paycheck, and what could I cut back on?” | Use the recorded housing question below. |
| Initial response | Sisu checks available money and upcoming commitments, clarifies missing inputs and gives one practical suggestion. | Sisu clarifies renting and requirements, then offers Make this a project. Jack accepts. |
| Outcome | Jack asks about spending 20% less at restaurants. Show the revised saving and Show the maths. Include a relevant Path lesson if time allows. | Jack locks his phone. Research continues. A notification arrives and opens the housing project summary. |
| Technical explanation | Show how transaction data supports the calculation and how the lesson helps Jack understand his decision. | Context.dev shows source checks, a detected change and its impact. Exa shows sources discovered and facts used to assess listings against Jack’s requirements. |

## Demo preparation prompt

Use this scene overview to prepare the remaining app screen recordings and assemble three Junction demo videos. Use existing real-life footage for the openings. Transition into Sisu when Jack picks up his phone. Preserve recorded dialogue. Reuse the housing story for Context.dev and Exa, then use the respective technical ending. Populate the walkthrough with the selected synthetic demo profile’s actual calculations and retrieved listing information. Use placeholders for missing footage. Label simulated source changes and cached research accurately.

## 1. S-Pankki demo — helping Jack reach payday

Jack asks how much he can spend before his next paycheck and what he could cut back on.

Use the demo profile’s current balance, expected payday, upcoming bills and essential spending to calculate what remains. Ask for missing information that materially affects the answer.

Give a short response showing the available amount, the period it covers and one practical suggestion. Put detailed calculations and assumptions behind **Show the maths**.

If only historical averages are available, label the result **Estimated budget**. Changing payday or adding a bill must update the calculation.

When Jack asks, “What if I spent 20% less at restaurants?”, calculate the saving using his transaction baseline. Preserve that baseline during follow-up questions. Asking about 10% should halve the saving.

Keep amounts consistent across the conversation and result cards. Offer a relevant Path lesson that helps Jack understand the calculation and apply it himself.

## 2. Housing demo — conversation to project

Support this exact recorded question.

> Hey, I'm wondering if I am able to afford a larger house in Espoo as a student. Could you find me some possible listings for me? Thank you.

Clarify that Jack wants to rent. Collect essential missing requirements, including minimum size, commute destination and limit, move date and savings goal. Use his financial context to help establish an affordable budget.

Offer **Make this a project** when continued research or monitoring would help. After Jack accepts, save the conversation context, requirements, progress and findings.

The project must remain available after closing and reopening Sisu. Jack should be able to open it from conversation history or a project list and edit its requirements.

## 3. Background research and phone notifications

Research must continue on the server after Jack locks his phone.

When initial findings are ready, or a meaningful listing change is detected, send a phone push notification. Tapping it must open the correct project summary.

Provide notification permission setup and show whether notifications are enabled. Keep detailed financial information inside the app. Suggested notification text is “Your Espoo housing search has an update.”

Show project status, last successful check and next scheduled check when monitoring is active. Distinguish initial research completion from ongoing monitoring.

Allow Jack to pause or stop monitoring. Avoid duplicate notifications for the same finding. Show failed checks and retry recoverable failures.

Test on the exact phone used for filming, including locking the phone, receiving the notification and opening the result.

## 4. Housing results and affordability

Show each listing’s source, size, location, rent and relevant recurring costs. Display the deposit and moving costs separately as upfront expenses.

Explain the estimated effect on Jack’s monthly budget and savings goal. Flag unknown costs and make assumptions visible.

Apply confirmed requirements to both the written answer and the result cards. A listing that fails a requirement must not appear as the best match.

If nothing qualifies, explain that and offer to adjust the search or continue monitoring. Include a short explanation of why unsuitable listings were excluded.

Keep the first result screen concise, with expandable sources, calculations and additional listings.

## 5. Context.dev and Exa evidence

For Context.dev, show the monitored source, check times, detected change and how that change updates the project.

For Exa, show sources found and facts used to compare listings against Jack’s requirements.

The backend coordinates discovery, structured extraction, monitoring, filtering and financial calculations. The explanation must follow the actual implemented role of each tool.

Use the same housing conversation and results for both videos. Each technical walkthrough should show its respective tool’s contribution.

Label cached results with retrieval time and simulated updates clearly. Keep raw transaction history within the backend. Send external research tools only the minimum search information needed.

## 6. Verification before recording

- Changing payday or adding a bill updates the budget.
- A 10% spending reduction produces half the saving of 20%.
- Figures agree across the response, calculations and result cards.
- Projects survive closing and reopening the app.
- Background research continues with the phone locked.
- A phone notification arrives and opens the correct result.
- Editing requirements changes which listings qualify.
- Pausing monitoring stops subsequent scheduled checks.
- Sources, timestamps and assumptions support conclusions.
- The Context.dev walkthrough shows a detected change and its effect.
- The Exa walkthrough shows research and comparison against requirements.

## Scope and status

This is a planning brief. Verify feature availability in the current build. The team’s earlier build plan prioritised the electricity comparison flow and treated housing as stretch scope. These payday and housing scenarios reflect Mark’s subsequent demo direction and should be reconciled with the team’s latest implementation plan.
