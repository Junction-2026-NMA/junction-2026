import XCTest
@testable import SisuCore

/// `LiveAPI`: how an HTTP answer becomes a model or a `SisuError`. No network: the status and body are given.
final class LiveAPITests: XCTestCase {
    private func response(_ status: Int) -> URLResponse {
        HTTPURLResponse(url: URL(string: "http://localhost:3000/x")!, statusCode: status, httpVersion: nil, headerFields: nil)!
    }

    func testKindAndTimeout() {
        let api = LiveAPI(baseURL: URL(string: "http://localhost:3000")!)
        XCTAssertEqual(api.kind, .live)
        XCTAssertEqual(api.timeout, 5)
    }

    func testSuccessDecodes() throws {
        let body = Data(#"[{"customerId":"C1","displayName":"Aino","age":24,"postalCode":"33100","area":"Tampere","extra":1}]"#.utf8)
        let customers = try LiveAPI.decode(data: body, response: response(200), as: [DemoCustomer].self)
        XCTAssertEqual(customers.first?.displayName, "Aino")
    }

    func testBadBodyIsInvalidResponse() {
        XCTAssertThrowsError(try LiveAPI.decode(data: Data("nope".utf8), response: response(200), as: [DemoCustomer].self)) {
            XCTAssertEqual($0 as? SisuError, .invalidResponse)
        }
    }

    func testServerErrorCarriesTheSentence() {
        let body = Data(#"{"error":"We could not find that customer."}"#.utf8)
        XCTAssertThrowsError(try LiveAPI.decode(data: body, response: response(404), as: Overview.self)) {
            XCTAssertEqual($0 as? SisuError, .server(status: 404, message: "We could not find that customer."))
        }
        XCTAssertThrowsError(try LiveAPI.decode(data: Data("<html>".utf8), response: response(500), as: Overview.self)) {
            XCTAssertEqual($0 as? SisuError, .server(status: 500, message: ""))
        }
    }

    func testTransportFailureIsOffline() async {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FailingProtocol.self]
        let api = LiveAPI(baseURL: URL(string: "http://sisu.invalid")!, session: URLSession(configuration: configuration))
        do {
            _ = try await api.demoCustomers()
            XCTFail("expected an error")
        } catch {
            XCTAssertEqual(error as? SisuError, .offline)
        }
    }
}

/// Fails every request before it leaves the process.
private final class FailingProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
    }
    override func stopLoading() {}
}
