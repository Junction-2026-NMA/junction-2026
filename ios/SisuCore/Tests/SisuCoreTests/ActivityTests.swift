import XCTest
@testable import SisuCore

/// `Activity.nextActivity` and `nextPlanActivity`: the ports of lib/agent/activity.ts, case by case.
final class ActivityTests: XCTestCase {
    private func event(_ json: String) -> SisuEvent { SisuEvent.decode(json) ?? .unknown(type: "broken") }
    private func plan(_ json: String) -> PlanEvent { PlanEvent.decode(Data(json.utf8)) ?? .unknown(type: "broken") }

    func testPosesLabelsAndMoods() {
        let expected: [(SisuActivityState, LiitoPose, String)] = [
            (.idle, .sleepy, "Ready when you are"), (.listening, .curious, "Listening"), (.thinking, .curious, "Thinking"),
            (.readingAccount, .focused, "Reading your account"), (.searchingWeb, .gliding, "Searching the web"),
            (.readingPages, .focused, "Reading the pages"), (.calculating, .focused, "Doing the sums"),
            (.foundSomething, .foundSomething, "Found something"), (.settingUp, .focused, "Setting it up for you"),
            (.waitingForApproval, .foundSomething, "Waiting for your approval"), (.speaking, .curious, "Telling you what I found"),
            (.approved, .cheering, "Done"), (.declined, .cosy, "Left as it was"), (.error, .cosy, "Something went wrong"),
        ]
        XCTAssertEqual(expected.count, SisuActivityState.allCases.count)
        for (state, pose, label) in expected {
            let activity = SisuActivity(state)
            XCTAssertEqual(activity.liito, pose, state.rawValue)
            XCTAssertEqual(activity.label, label)
            XCTAssertNil(activity.detail)
        }
        XCTAssertEqual(SisuActivityState.allCases.map(\.rawValue), ["idle", "listening", "thinking", "reading_account", "searching_web", "reading_pages", "calculating",
                                                                      "found_something", "setting_up", "waiting_for_approval", "speaking", "approved", "declined", "error"])
        XCTAssertEqual(LiitoPose.allCases.map(\.rawValue), ["sleepy", "curious", "focused", "gliding", "found-something", "cheering", "proud", "cosy"])
        XCTAssertEqual(LiitoPose.allCases.map(\.mood), [.sleepy, .curious, .focused, .gliding, .found, .cheering, .proud, .cosy])
        XCTAssertEqual(SisuActivity(.thinking).mood, .thinking)
        XCTAssertEqual(SisuActivity(.listening).mood, .curious)
        XCTAssertEqual(SisuActivity(.waitingForApproval).mood, .found)
        XCTAssertEqual(SisuActivity(.approved).posed(.proud).mood, .proud)
        XCTAssertEqual(SisuActivity(.idle, label: ""), .idle)
    }

    func testAChatTurn() {
        let idle = SisuActivity.idle
        XCTAssertEqual(Activity.nextActivity(idle, event(#"{"type":"start","turnId":"t","provider":"p","model":"m","mock":true}"#)), SisuActivity(.thinking))
        XCTAssertEqual(Activity.nextActivity(idle, event(#"{"type":"transcript","text":"Hi","tookMs":1}"#)), SisuActivity(.thinking))
        let tools: [(String, SisuActivityState)] = [
            ("get_spending", .readingAccount), ("list_bills", .readingAccount), ("get_cash_flow", .readingAccount), ("find_patterns", .readingAccount),
            ("check_affordability", .calculating), ("get_mortgage", .readingAccount), ("show_chart", .readingAccount), ("run_scenario", .calculating),
            ("calculate", .calculating), ("search_offers", .searchingWeb), ("web_search", .searchingWeb), ("prepare_action", .settingUp),
            ("explain_concept", .thinking), ("remember", .thinking), ("something_new", .thinking),
        ]
        for (name, state) in tools {
            XCTAssertEqual(Activity.nextActivity(idle, .toolStart(id: "1", name: name, args: nil, label: nil)), SisuActivity(state), name)
        }
        XCTAssertEqual(Activity.nextActivity(idle, .toolStart(id: "1", name: "web_search", args: nil, label: "Searching the web with Exa: rents")),
                       SisuActivity(.searchingWeb, label: "Searching the web with Exa: rents"))
        XCTAssertEqual(Activity.nextActivity(idle, .sentence(index: 0, text: "Hello.")), SisuActivity(.speaking))
        let waiting = SisuActivity(.waitingForApproval, label: "Move €500", detail: "warning")
        XCTAssertEqual(Activity.nextActivity(waiting, .sentence(index: 0, text: "Hello.")), waiting)
        XCTAssertEqual(Activity.nextActivity(idle, .error(message: "Sorry.")), SisuActivity(.error, label: "Sorry."))
        for same in [SisuEvent.delta("x"), .filler("x"), .unknown(type: "x"), .replace(text: "x"), .done(text: "x", citations: [], timings: nil)] {
            XCTAssertEqual(Activity.nextActivity(waiting, same), waiting)
        }
    }

    func testARecordedInvestigationWalksThroughTheStates() {
        var activity = SisuActivity.idle
        var states: [SisuActivityState] = []
        var labels: [String] = []
        for event in CoachSamples.events(turn: "investigate") {
            let next = Activity.nextActivity(activity, event)
            if next.state != activity.state { states.append(next.state); labels.append(next.label) }
            activity = next
        }
        XCTAssertEqual(states.first, .thinking)
        XCTAssertTrue(states.contains(.readingAccount))
        XCTAssertTrue(states.contains(.foundSomething))
        XCTAssertTrue(states.contains(.searchingWeb))
        XCTAssertTrue(states.contains(.readingPages))
        XCTAssertTrue(states.contains(.calculating))
        XCTAssertTrue(states.contains(.settingUp))
        XCTAssertEqual(states.last, .waitingForApproval)
        XCTAssertEqual(activity.label, "Switch electricity contract to Example Energia (Fixed 24)")
        XCTAssertTrue(labels.contains("Scanning twelve months of your transactions for what stands out"))
        XCTAssertTrue(labels.contains("Best offer: Example Energia"))
    }

    func testThePlan() {
        let idle = SisuActivity.idle
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"plan_start","planId":"p","customerName":"Aino","provider":"mock","model":"mock","mock":true}"#)),
                       SisuActivity(.thinking, label: "Opening your account"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"scan","transactions":172,"months":12,"from":"a","to":"b","rows":[],"categories":[],"tookMs":1}"#)),
                       SisuActivity(.readingAccount, label: "Reading 172 transactions", detail: "12 months"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"finding","id":"f","role":"habit","title":"Restaurants","detail":"d","yearlyEur":768}"#)),
                       SisuActivity(.foundSomething, label: "Restaurants"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"finding","id":"f","role":"bill","title":"Electricity","detail":"d","yearlyEur":null}"#)), idle)
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"search_start","billType":"electricity","query":"cheapest","engine":"exa"}"#)),
                       SisuActivity(.searchingWeb, label: "Searching the web with Exa", detail: "cheapest"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"check_start","id":"c","title":"Housing allowance?","query":"q","engine":"exa"}"#)),
                       SisuActivity(.searchingWeb, label: "Researching what is worth checking", detail: "Housing allowance?"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"search_pages","billType":"electricity","pages":[],"tookMs":0}"#)),
                       SisuActivity(.readingPages, label: "Reading the pages with Context.dev"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"page_read","billType":"electricity","url":"u","host":"example.com","ok":true,"offers":3,"reader":"exa","ageMs":null,"tookMs":1}"#)),
                       SisuActivity(.readingPages, label: "Reading the pages with Exa", detail: "example.com"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"page_read","billType":"electricity","url":"u","host":"example.com","ok":true,"offers":3,"reader":"context.dev","ageMs":null,"tookMs":1}"#)),
                       SisuActivity(.readingPages, label: "Reading the pages with Context.dev", detail: "example.com"))
        let offer = #"{"provider":"Example Tel","plan":"Basic","sourceUrl":"u","comparable":true}"#
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"offers","billType":"mobile","ok":true,"best":\#(offer),"yearlySavingEur":83,"currentMonthlyEur":20,"offersFound":2,"live":true,"note":null}"#)),
                       SisuActivity(.foundSomething, label: "Best mobile offer: Example Tel"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"offers","billType":"mobile","ok":true,"best":\#(offer),"yearlySavingEur":null,"currentMonthlyEur":20,"offersFound":2,"live":true,"note":"Nothing cheaper"}"#)), idle)
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"offers","billType":"mobile","ok":false,"best":null,"yearlySavingEur":null,"currentMonthlyEur":null,"offersFound":0,"live":true,"note":null}"#)), idle)
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"calc","steps":[],"totalYearlyEur":10,"effortlessYearlyEur":4}"#)), SisuActivity(.calculating, label: "Adding it up"))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"error","message":"No."}"#)), SisuActivity(.error, label: "No."))
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"summary","text":"t","by":"code","tookMs":0}"#)), idle)
        XCTAssertEqual(Activity.nextPlanActivity(idle, plan(#"{"type":"hologram"}"#)), idle)

        var activity = idle
        var last: [String: SisuActivity] = [:]
        for event in PlanEvent.events(in: ReplayTransport.fixture("coach/stream-plan-CUST04974.sse") ?? Data()) {
            activity = Activity.nextPlanActivity(activity, event)
            last[event.type] = activity
        }
        XCTAssertEqual(last["check_done"]?.state, .foundSomething)
        XCTAssertEqual(last["action"], SisuActivity(.settingUp, label: "Move €126 to savings each payday"))
        XCTAssertEqual(activity, SisuActivity(.waitingForApproval, label: "4 things set up"))
    }
}
