import Foundation

let SECOND = 1000
let MINUTE = SECOND * 60
let HOUR = MINUTE * 60
let DAY = HOUR * 24

func unixNow() -> Int {
    return Int(Date().timeIntervalSince1970 * 1000)
}

func wait(_ milliseconds: Int) async throws {
    let nanoseconds = UInt64(milliseconds) * 1_000_000
    try await Task.sleep(nanoseconds: nanoseconds)
}
