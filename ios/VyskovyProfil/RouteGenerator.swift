import CoreLocation
import Foundation

/// Synthetic route: 150 km, elevation profile with gradient highlights,
/// 40 stops (10 clustered). Targets: +5000 m / −3600 m, min 100 m, max 1600 m.
/// Port of `Web/route-data.js`.
enum RouteGenerator {
    static let routeKm: Double = 150
    static let sampleCount = 1501
    static let targetAscent: Double = 5000
    static let targetDescent: Double = 3600
    static let elevMin: Double = 100
    static let elevMax: Double = 1600

    enum SegmentKind: String, CaseIterable {
        case easyUp
        case steepUp
        case medDown
        case neutral
    }

    struct GeneratedRoute: Sendable {
        let distKm: [Double]
        let elev: [Double]
        let kinds: [SegmentKind]
        let stops: [Int]
        let iMin: Int
        let iMax: Int
        let ascentM: Double
        let descentM: Double
        let stepKm: Double
    }

    static func generate(seed: UInt32 = 20250326) -> GeneratedRoute {
        let n = sampleCount
        let m = n - 1
        let stepKm = routeKm / Double(m)
        let stepM = stepKm * 1000

        var rnd = Mulberry32(seed: seed)

        var diff = [Double](repeating: 0, count: m)
        for i in 0..<m {
            diff[i] = (rnd.next() - 0.48) * 3.2
        }
        for _ in 0..<4 {
            diff = smooth3(diff)
        }

        func setSegment(startIdx: Int, len: Int, gradientPercent: Double, kind: SegmentKind) {
            let dh = (gradientPercent / 100) * stepM
            for k in 0..<len where startIdx + k < m {
                diff[startIdx + k] = dh
            }
        }

        func idx(_ km: Double) -> Int {
            min(m - 1, max(0, Int(round((km / routeKm) * Double(n - 1)))))
        }

        setSegment(startIdx: idx(5), len: 35, gradientPercent: 6, kind: .easyUp)
        setSegment(startIdx: idx(28), len: 18, gradientPercent: 15, kind: .steepUp)
        setSegment(startIdx: idx(52), len: 28, gradientPercent: -10, kind: .medDown)
        setSegment(startIdx: idx(88), len: 40, gradientPercent: 6, kind: .easyUp)
        setSegment(startIdx: idx(118), len: 12, gradientPercent: 15, kind: .steepUp)
        setSegment(startIdx: idx(132), len: 22, gradientPercent: -10, kind: .medDown)

        var posSum = 0.0
        var negSum = 0.0
        for i in 0..<m {
            if diff[i] > 0 { posSum += diff[i] }
            else { negSum += -diff[i] }
        }
        let sp = targetAscent / posSum
        let sn = targetDescent / negSum
        for i in 0..<m {
            if diff[i] > 0 { diff[i] *= sp }
            else { diff[i] *= sn }
        }

        var elev = [Double](repeating: 0, count: n)
        elev[0] = 400 + rnd.next() * 100
        for i in 0..<m {
            elev[i + 1] = elev[i] + diff[i]
        }

        var lo = elev[0]
        var hi = elev[0]
        for i in 1..<n {
            if elev[i] < lo { lo = elev[i] }
            if elev[i] > hi { hi = elev[i] }
        }
        let span = hi - lo
        for i in 0..<n {
            elev[i] = elevMin + ((elev[i] - lo) / span) * (elevMax - elevMin)
        }

        var distKm = [Double](repeating: 0, count: n)
        for i in 0..<n {
            distKm[i] = (Double(i) / Double(n - 1)) * routeKm
        }

        var asc = 0.0
        var dsc = 0.0
        for i in 0..<m {
            let d = elev[i + 1] - elev[i]
            if d > 0 { asc += d }
            else { dsc += -d }
        }

        var kindsFinal = [SegmentKind](repeating: .neutral, count: m)
        for i in 0..<m {
            let dh = elev[i + 1] - elev[i]
            let g = (dh / stepM) * 100
            kindsFinal[i] = gradeToKind(grade: g)
        }

        let stops = buildStops(n: n, rnd: &rnd)

        var iMin = 0
        var iMax = 0
        for i in 1..<n {
            if elev[i] < elev[iMin] { iMin = i }
            if elev[i] > elev[iMax] { iMax = i }
        }

        return GeneratedRoute(
            distKm: distKm,
            elev: elev,
            kinds: kindsFinal,
            stops: stops,
            iMin: iMin,
            iMax: iMax,
            ascentM: asc,
            descentM: dsc,
            stepKm: stepKm
        )
    }

    private static func gradeToKind(grade: Double) -> SegmentKind {
        if grade > 0, abs(grade - 6) <= 2.2 { return .easyUp }
        if grade > 0, abs(grade - 15) <= 3 { return .steepUp }
        if grade < 0, abs(grade - (-10)) <= 2.5 { return .medDown }
        return .neutral
    }

    private static func smooth3(_ arr: [Double]) -> [Double] {
        var out = arr
        guard out.count > 2 else { return out }
        for i in 1..<(out.count - 1) {
            out[i] = (arr[i - 1] + arr[i] * 2 + arr[i + 1]) / 4
        }
        return out
    }

    private static func buildStops(n: Int, rnd: inout Mulberry32) -> [Int] {
        var out = Set<Int>()
        let clusterStart = 200 + Int(rnd.next() * 120)
        for j in 0..<10 {
            out.insert(min(n - 2, max(2, clusterStart + j)))
        }
        while out.count < 40 {
            let i = 2 + Int(rnd.next() * Double(n - 4))
            out.insert(i)
        }
        return out.sorted()
    }
}

// MARK: - PRNG (mulberry32)

private struct Mulberry32 {
    private var a: UInt32

    init(seed: UInt32) {
        a = seed
    }

    mutating func next() -> Double {
        var t = a &+ 0x6D2B79F5
        a = t
        t = imul32(t ^ (t >> 15), t | 1)
        t ^= t &+ imul32(t ^ (t >> 7), t | 61)
        return Double(UInt64(t ^ (t >> 14))) / Double(UInt64(1) << 32)
    }
}

@inline(__always)
private func imul32(_ a: UInt32, _ b: UInt32) -> UInt32 {
    let a32 = Int32(bitPattern: a)
    let b32 = Int32(bitPattern: b)
    let p = Int64(a32) * Int64(b32)
    return UInt32(bitPattern: Int32(truncatingIfNeeded: p))
}

// MARK: - Map geometry (same curve as Web/app.js `mapPointAlongRoute`)

enum RouteMapGeometry {
    /// Normalized SVG control polyline (viewBox 360×400).
    private static let svgPoints: [(x: Double, y: Double)] = [
        (32, 28), (72, 52), (120, 78), (168, 118), (210, 168),
        (248, 218), (278, 268), (300, 318),
    ]

    /// Center of the synthetic map (Czech Republic–like).
    private static let baseLat = 49.92
    private static let baseLon = 15.05
    private static let latSpan = 1.28
    private static let lonSpan = 1.65

    static func coordinateAlongRoute(t: Double) -> CLLocationCoordinate2D {
        let tClamped = min(1, max(0, t))
        let pts = svgPoints
        let segCount = Double(pts.count - 1)
        let seg = segCount * tClamped
        let i = min(pts.count - 2, Int(floor(seg)))
        let u = seg - Double(i)
        let p0 = pts[i]
        let p1 = pts[i + 1]
        let x = p0.x + (p1.x - p0.x) * u
        let y = p0.y + (p1.y - p0.y) * u

        let lat = baseLat + (1.0 - y / 400.0) * latSpan - latSpan / 2
        let lon = baseLon + (x / 360.0 - 0.5) * lonSpan
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    static func polylineCoordinates(for route: RouteGenerator.GeneratedRoute) -> [CLLocationCoordinate2D] {
        let n = route.distKm.count
        var coords: [CLLocationCoordinate2D] = []
        coords.reserveCapacity(n)
        for i in 0..<n {
            let t = route.distKm[i] / RouteGenerator.routeKm
            coords.append(coordinateAlongRoute(t: t))
        }
        return coords
    }

    static func coordinate(atKm km: Double) -> CLLocationCoordinate2D {
        coordinateAlongRoute(t: km / RouteGenerator.routeKm)
    }
}
