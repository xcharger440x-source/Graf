import SwiftUI
import UIKit
import WebKit

/// Načte HTML/CSS/JS prototyp z `Web/` (stejné chování jako ve Figma guideline layoutu).
struct WebPrototypeView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = true
        webView.backgroundColor = .black
        // Bez více dotyků iOS nepředá druhý prst → pinch v JS (graf) nefunguje (Sweetpad / simulátor).
        webView.isMultipleTouchEnabled = true
        webView.scrollView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.scrollView.isMultipleTouchEnabled = true
        // Nativní pinch na scroll view může konkurovat touchmove v HTML; zoom řešíme v app.js (viewBox).
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.delaysContentTouches = false

        if let webRoot = Bundle.main.url(forResource: "Web", withExtension: nil) {
            let indexURL = webRoot.appendingPathComponent("index.html")
            webView.loadFileURL(indexURL, allowingReadAccessTo: webRoot)
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            #if DEBUG
            print("WebView navigation error: \(error.localizedDescription)")
            #endif
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            #if DEBUG
            print("WebView provisional error: \(error.localizedDescription)")
            #endif
        }
    }
}
