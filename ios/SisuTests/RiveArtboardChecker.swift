// Checks the artboards of a loaded Rive file against their entries in rive/contract.json.
import RiveRuntime
import XCTest

@MainActor
struct RiveArtboardChecker {
    let file: File
    let contract: ContractJSON
    /// The enums the Rive file defines, by name.
    let fileEnums: [String: [String]]

    /// The contract's rules: the artboard exists, has one state machine named Main, its default view model is
    /// `<Artboard>VM`, the default instance binds to the state machine, and every property is there with its type.
    func check(_ spec: ContractJSON.ArtboardSpec, report: inout ContractReport) async {
        let name = spec.name
        let artboard: Artboard
        do {
            artboard = try await file.createArtboard(name)
        } catch {
            report.fail(name, "the artboard is not in the file (\(error))")
            return
        }

        do {
            let machines = try await artboard.getStateMachineNames()
            if machines == ["Main"] {
                report.pass(name, "artboard found, one state machine named Main")
            } else {
                report.fail(name, "state machines are \(machines); the contract wants exactly one, named Main")
            }
        } catch {
            report.fail(name, "the state machines could not be listed (\(error))")
        }

        let instance: ViewModelInstance
        let stateMachine: StateMachine
        let properties: [String: ViewModelProperty.DataType]
        do {
            let viewModel = try await file.getDefaultViewModelInfo(for: artboard).viewModelName
            if viewModel == "\(name)VM" {
                report.pass(name, "default view model is \(viewModel)")
            } else {
                report.fail(name, "default view model is '\(viewModel)'; the contract wants \(name)VM")
            }
            instance = try await file.createViewModelInstance(.viewModelDefault(from: .artboardDefault(artboard)))
            stateMachine = try await artboard.createStateMachine(binding: instance)
            report.pass(name, "default instance created and bound to the default state machine")
            let list = try await file.getProperties(of: viewModel)
            properties = Dictionary(list.map { ($0.name, $0.type) }, uniquingKeysWith: { first, _ in first })
        } catch {
            report.fail(name, "the default view model could not be created, bound or listed (\(error))")
            return
        }

        for property in spec.properties {
            await check(property, of: name, on: instance, actual: properties[property.name], report: &report)
        }
        let unlisted = Set(properties.keys).subtracting(spec.properties.map(\.name)).sorted()
        if !unlisted.isEmpty {
            report.note(name, "the view model also has \(unlisted.joined(separator: ", ")), not in the contract")
        }
        // Keep the binding alive until every property has been written.
        withExtendedLifetime((artboard, stateMachine)) {}
    }

    /// Every enum the artboards use is defined in the file under the contract's name with the contract's cases.
    func checkEnums(usedBy artboards: [ContractJSON.ArtboardSpec], report: inout ContractReport) {
        let used = Set(artboards.flatMap(\.properties).compactMap(\.enumName)).sorted()
        for name in used {
            let subject = "enum \(name)"
            guard let wanted = contract.enums[name] else {
                report.fail(subject, "used by a property but not defined under \"enums\" in the contract")
                continue
            }
            guard let found = fileEnums[name] else {
                report.fail(subject, "the file defines no enum of that name (it has \(fileEnums.keys.sorted()))")
                continue
            }
            if found == wanted {
                report.pass(subject, "cases \(wanted.joined(separator: ", "))")
            } else if Set(found) == Set(wanted) {
                report.note(subject, "same cases as the contract, in another order: \(found.joined(separator: ", "))")
            } else {
                report.fail(subject, "cases are \(found); the contract wants \(wanted)")
            }
        }
    }

    // MARK: - One property

    private func check(
        _ property: ContractJSON.PropertySpec,
        of artboard: String,
        on instance: ViewModelInstance,
        actual: ViewModelProperty.DataType?,
        report: inout ContractReport
    ) async {
        let subject = "\(artboard).\(property.name)"
        let kind = "\(property.type), \(property.direction)"
        guard let wanted = Self.dataType(property.type) else {
            report.fail(subject, "the contract uses an unknown type '\(property.type)'")
            return
        }
        guard let actual else {
            report.fail(subject, "missing: the view model has no property of that name (\(kind))")
            return
        }
        guard actual == wanted else {
            report.fail(subject, "is a \(actual) in the file; the contract says \(property.type)")
            return
        }
        guard property.isWritten else {
            report.pass(subject, "\(kind): exists. The file fires it, so it is not exercised here")
            return
        }
        do {
            let detail = try await writeAndReadBack(property, on: instance)
            if let mismatch = detail.mismatch {
                report.fail(subject, "\(kind): \(mismatch)")
            } else {
                report.pass(subject, "\(kind): \(detail.done)")
            }
        } catch {
            report.fail(subject, "\(kind): could not be read back (\(error))")
        }
    }

    private struct Outcome {
        var done: String
        var mismatch: String?
    }

    private func writeAndReadBack(_ property: ContractJSON.PropertySpec, on instance: ViewModelInstance) async throws -> Outcome {
        let path = property.name
        switch property.type {
        case "string":
            // Finnish letters, a no-break space, a real minus sign and the euro sign must all survive.
            for text in ["Sisu contract test", "Säästö −1\u{00A0}234,50\u{00A0}€"] {
                instance.setValue(of: StringProperty(path: path), to: text)
                let read = try await instance.value(of: StringProperty(path: path))
                if read != text { return Outcome(done: "", mismatch: "wrote '\(text)', read back '\(read)'") }
            }
            return Outcome(done: "two strings written and read back")
        case "number":
            let numbers = property.range ?? [1, 2]
            for number in numbers {
                instance.setValue(of: NumberProperty(path: path), to: Float(number))
                let read = try await instance.value(of: NumberProperty(path: path))
                if abs(Double(read) - number) > 0.0001 { return Outcome(done: "", mismatch: "wrote \(number), read back \(read)") }
            }
            return Outcome(done: "\(numbers.map { String($0) }.joined(separator: " and ")) written and read back")
        case "boolean":
            for flag in [true, false] {
                instance.setValue(of: BoolProperty(path: path), to: flag)
                let read = try await instance.value(of: BoolProperty(path: path))
                if read != flag { return Outcome(done: "", mismatch: "wrote \(flag), read back \(read)") }
            }
            return Outcome(done: "true and false written and read back")
        case "enum":
            guard let name = property.enumName, let cases = contract.enums[name] else {
                return Outcome(done: "", mismatch: "the contract names no known enum for this property")
            }
            var rejected: [String] = []
            for caseName in cases {
                instance.setValue(of: EnumProperty(path: path), to: caseName)
                let read = try await instance.value(of: EnumProperty(path: path))
                if read != caseName { rejected.append("\(caseName) (read back '\(read)')") }
            }
            if !rejected.isEmpty { return Outcome(done: "", mismatch: "\(name) cases not accepted: \(rejected.joined(separator: ", "))") }
            return Outcome(done: "all \(cases.count) cases of \(name) written and read back")
        case "trigger":
            instance.fire(trigger: TriggerProperty(path: path))
            return Outcome(done: "exists and was fired (a trigger has no value to read back)")
        default:
            return Outcome(done: "", mismatch: "unknown contract type '\(property.type)'")
        }
    }

    private static func dataType(_ contractType: String) -> ViewModelProperty.DataType? {
        switch contractType {
        case "string": return .string
        case "number": return .number
        case "boolean": return .boolean
        case "enum": return .enum
        case "trigger": return .trigger
        default: return nil
        }
    }
}
