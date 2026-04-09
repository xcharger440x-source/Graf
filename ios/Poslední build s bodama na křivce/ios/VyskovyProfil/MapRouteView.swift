import MapKit
import SwiftUI
import UIKit

final class StopAnnotation: NSObject, MKAnnotation {
    let coordinate: CLLocationCoordinate2D
    let stopIndex: Int

    init(coordinate: CLLocationCoordinate2D, stopIndex: Int) {
        self.coordinate = coordinate
        self.stopIndex = stopIndex
    }
}

struct MapRouteView: UIViewRepresentable {
    let route: RouteGenerator.GeneratedRoute

    func makeCoordinator() -> Coordinator {
        Coordinator(route: route)
    }

    func makeUIView(context: Context) -> MKMapView {
        let map = MKMapView()
        map.delegate = context.coordinator
        map.pointOfInterestFilter = .excludingAll
        map.showsUserLocation = false
        map.isRotateEnabled = false
        map.isPitchEnabled = false
        return map
    }

    func updateUIView(_ map: MKMapView, context: Context) {
        context.coordinator.route = route
        map.removeOverlays(map.overlays)
        map.removeAnnotations(map.annotations)

        let coords = RouteMapGeometry.polylineCoordinates(for: route)
        guard coords.count >= 2 else { return }

        let poly = MKPolyline(coordinates: coords, count: coords.count)
        map.addOverlay(poly)

        for (idx, si) in route.stops.enumerated() {
            let km = route.distKm[si]
            let c = RouteMapGeometry.coordinate(atKm: km)
            map.addAnnotation(StopAnnotation(coordinate: c, stopIndex: idx))
        }

        let r = poly.boundingMapRect
        map.setVisibleMapRect(r, edgePadding: UIEdgeInsets(top: 80, left: 40, bottom: 200, right: 40), animated: false)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        var route: RouteGenerator.GeneratedRoute

        init(route: RouteGenerator.GeneratedRoute) {
            self.route = route
        }

        func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
            guard let poly = overlay as? MKPolyline else {
                return MKOverlayRenderer(overlay: overlay)
            }
            let r = MKPolylineRenderer(polyline: poly)
            r.strokeColor = UIColor(red: 26 / 255, green: 108 / 255, blue: 255 / 255, alpha: 1)
            r.lineWidth = 5
            r.lineCap = .round
            r.lineJoin = .round
            return r
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            guard let stop = annotation as? StopAnnotation else { return nil }
            let id = "stop"
            let v = mapView.dequeueReusableAnnotationView(withIdentifier: id)
                ?? MKAnnotationView(annotation: annotation, reuseIdentifier: id)
            v.annotation = annotation
            v.canShowCallout = false
            let pin = MapPinImages.mapStopImage()
            v.image = pin
            let h = pin.size.height > 0 ? pin.size.height : 28
            v.centerOffset = CGPoint(x: 0, y: -h / 2)
            return v
        }
    }
}

// MARK: - Map pin (Figma-inspired red marker)

enum MapPinImages {
    static func mapStopImage(size: CGFloat = 28) -> UIImage {
        let cfg = UIImage.SymbolConfiguration(pointSize: size * 0.55, weight: .semibold)
        let img = UIImage(systemName: "mappin.circle.fill", withConfiguration: cfg)?
            .withTintColor(UIColor(red: 0.78, green: 0.16, blue: 0.16, alpha: 1), renderingMode: .alwaysOriginal)
        return img ?? UIImage()
    }
}
