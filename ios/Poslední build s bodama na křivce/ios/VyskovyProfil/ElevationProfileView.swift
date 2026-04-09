import SwiftUI

/// Elevation chart with colored gradient segments, min/max arrows, and stop markers (sheet style).
struct ElevationProfileView: View {
    let route: RouteGenerator.GeneratedRoute

    private let chartPad = EdgeInsets(top: 8, leading: 4, bottom: 8, trailing: 4)

    var body: some View {
        GeometryReader { geo in
            let inner = geo.size.inset(by: chartPad)
            Canvas { context, size in
                drawChart(context: &context, size: inner, offset: CGPoint(x: chartPad.leading, y: chartPad.top))
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
    }

    private func drawChart(context: inout GraphicsContext, size: CGSize, offset: CGPoint) {
        let w = size.width
        let h = size.height
        guard w > 1, h > 1 else { return }

        let n = route.distKm.count
        guard n >= 2 else { return }

        func xAt(_ i: Int) -> CGFloat {
            CGFloat(route.distKm[i] / RouteGenerator.routeKm) * w + offset.x
        }

        func yAt(_ i: Int) -> CGFloat {
            let e = route.elev[i]
            let t = (e - RouteGenerator.elevMin) / (RouteGenerator.elevMax - RouteGenerator.elevMin)
            return offset.y + h * (1 - CGFloat(t))
        }

        // Grid
        var grid = Path()
        for g in 0...4 {
            let gx = offset.x + CGFloat(g) / 4 * w
            grid.move(to: CGPoint(x: gx, y: offset.y))
            grid.addLine(to: CGPoint(x: gx, y: offset.y + h))
        }
        for g in 0...3 {
            let gy = offset.y + CGFloat(g) / 3 * h
            grid.move(to: CGPoint(x: offset.x, y: gy))
            grid.addLine(to: CGPoint(x: offset.x + w, y: gy))
        }
        context.stroke(grid, with: .color(Color(red: 0.004, green: 0.12, blue: 0.22).opacity(0.12)), lineWidth: 0.6)

        // Fill under curve
        var fill = Path()
        fill.move(to: CGPoint(x: xAt(0), y: offset.y + h))
        for i in 0..<n {
            fill.addLine(to: CGPoint(x: xAt(i), y: yAt(i)))
        }
        fill.addLine(to: CGPoint(x: xAt(n - 1), y: offset.y + h))
        fill.closeSubpath()

        let fillGradient = Gradient(colors: [
            Color(red: 26 / 255, green: 108 / 255, blue: 255 / 255).opacity(0.22),
            Color(red: 26 / 255, green: 108 / 255, blue: 255 / 255).opacity(0.02),
        ])
        context.fill(fill, with: .linearGradient(fillGradient, startPoint: offset, endPoint: CGPoint(x: offset.x, y: offset.y + h)))

        // Colored polyline segments
        for i in 0..<(n - 1) {
            var seg = Path()
            seg.move(to: CGPoint(x: xAt(i), y: yAt(i)))
            seg.addLine(to: CGPoint(x: xAt(i + 1), y: yAt(i + 1)))
            let k = route.kinds[i]
            let lw: CGFloat = k == .neutral ? 3.2 : 4
            let style = StrokeStyle(lineWidth: lw, lineCap: .round, lineJoin: .round)
            context.stroke(seg, with: .color(k.chartColor), style: style)
        }

        // Min / max arrows
        let xMax = xAt(route.iMax)
        let yMax = yAt(route.iMax)
        let xMin = xAt(route.iMin)
        let yMin = yAt(route.iMin)

        drawArrow(context: &context, up: true, at: CGPoint(x: xMax, y: yMax - 14))
        drawArrow(context: &context, up: false, at: CGPoint(x: xMin, y: yMin + 14))

        // Stops on profile (sheet icon: blue fill, white ring, white center — Figma)
        for si in route.stops {
            let cx = xAt(si)
            let cy = yAt(si)
            let outer = CGRect(x: cx - 6, y: cy - 6, width: 12, height: 12)
            context.fill(Path(ellipseIn: outer), with: .color(Color(red: 26 / 255, green: 108 / 255, blue: 255 / 255)))
            context.stroke(Path(ellipseIn: outer), with: .color(.white), lineWidth: 2)
            let inner = CGRect(x: cx - 2.5, y: cy - 2.5, width: 5, height: 5)
            context.fill(Path(ellipseIn: inner), with: .color(.white))
        }
    }

    private func drawArrow(context: inout GraphicsContext, up: Bool, at p: CGPoint) {
        var path = Path()
        if up {
            path.move(to: CGPoint(x: p.x, y: p.y + 10))
            path.addLine(to: CGPoint(x: p.x, y: p.y - 2))
            path.move(to: CGPoint(x: p.x - 5, y: p.y + 3))
            path.addLine(to: CGPoint(x: p.x, y: p.y - 4))
            path.addLine(to: CGPoint(x: p.x + 5, y: p.y + 3))
        } else {
            path.move(to: CGPoint(x: p.x, y: p.y - 10))
            path.addLine(to: CGPoint(x: p.x, y: p.y + 2))
            path.move(to: CGPoint(x: p.x - 5, y: p.y - 3))
            path.addLine(to: CGPoint(x: p.x, y: p.y + 4))
            path.addLine(to: CGPoint(x: p.x + 5, y: p.y - 3))
        }
        let c = up ? Color(red: 0.18, green: 0.49, blue: 0.20) : Color(red: 0.78, green: 0.16, blue: 0.16)
        let arrowStyle = StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round)
        context.stroke(path, with: .color(c), style: arrowStyle)
    }
}

private extension RouteGenerator.SegmentKind {
    var chartColor: Color {
        switch self {
        case .easyUp: return Color(red: 230 / 255, green: 194 / 255, blue: 0 / 255)
        case .steepUp: return Color(red: 229 / 255, green: 57 / 255, blue: 53 / 255)
        case .medDown: return Color(red: 251 / 255, green: 140 / 255, blue: 0 / 255)
        case .neutral: return Color(red: 26 / 255, green: 108 / 255, blue: 255 / 255)
        }
    }
}

private extension CGSize {
    func inset(by insets: EdgeInsets) -> CGSize {
        CGSize(width: width - insets.leading - insets.trailing, height: height - insets.top - insets.bottom)
    }
}
