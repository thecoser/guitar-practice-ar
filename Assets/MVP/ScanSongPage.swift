import AppKit
import CoreText
import Foundation
import ImageIO
import PDFKit
import UniformTypeIdentifiers
import Vision

struct ScanFailure: LocalizedError {
    let errorDescription: String?
    init(_ message: String) { errorDescription = message }
}

struct Token {
    let text: String
    let x: CGFloat
}

struct Row {
    var bounds: CGRect
    var tokens: [Token]
    var repeatCount = 1

    var words: String { tokens.map(\.text).joined(separator: " ") }
    var chords: [Token] {
        let filtered = tokens.filter { !["|", "||", "/"].contains($0.text) }
        return !filtered.isEmpty && filtered.allSatisfy {
            $0.text.range(of: #"^[A-G][#b♯♭]?(?:maj|min|sus|add|dim|aug|m|M|ø|°|Δ|-|\+)?\d*(?:[#b]\d+)*(?:/[A-G][#b♯♭]?)?$"#,
                          options: .regularExpression) != nil
        } ? filtered : []
    }
}

func pageImage(for url: URL) throws -> CGImage {
    if url.pathExtension.lowercased() == "pdf" {
        guard let document = PDFDocument(url: url), let page = document.page(at: 0) else {
            throw ScanFailure("The first PDF page could not be opened.")
        }
        let image = page.thumbnail(of: CGSize(width: 2200, height: 2800), for: .cropBox)
        guard let pageImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            throw ScanFailure("The first PDF page could not be read as an image.")
        }
        return pageImage
    }
    let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 2200]
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
        throw ScanFailure("Choose a readable image or a PDF.")
    }
    return image
}

func groupRows(_ observations: [VNRecognizedTextObservation]) throws -> [Row] {
    let tokenPattern = try NSRegularExpression(pattern: #"\S+"#)
    var rows: [Row] = []
    for observation in observations.sorted(by: { $0.boundingBox.midY > $1.boundingBox.midY }) {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let text = candidate.string
        let bounds = observation.boundingBox
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        let tokens = tokenPattern.matches(in: text, range: range).compactMap { match -> Token? in
            guard let indices = Range(match.range, in: text) else { return nil }
            let fallbackX = bounds.minX + bounds.width * CGFloat(match.range.location) / CGFloat(max(1, range.length))
            let tokenBounds = try? candidate.boundingBox(for: indices)
            return Token(text: String(text[indices]), x: tokenBounds?.boundingBox.minX ?? fallbackX)
        }
        if let index = rows.indices.last(where: {
            abs(rows[$0].bounds.midY - bounds.midY) < min(rows[$0].bounds.height, bounds.height) * 0.6
        }) {
            rows[index].bounds = rows[index].bounds.union(bounds)
            rows[index].tokens.append(contentsOf: tokens)
        } else {
            rows.append(Row(bounds: bounds, tokens: tokens))
        }
    }
    return rows.filter { !$0.tokens.isEmpty }.map {
        Row(bounds: $0.bounds, tokens: $0.tokens.sorted { $0.x < $1.x })
    }
}

func readIsolatedChords(_ crop: CGImage) throws -> [String] {
    let width = CGFloat(crop.width) * 30 / CGFloat(crop.height)
    guard width <= 195, let context = CGContext(data: nil, width: 450, height: 110, bitsPerComponent: 8,
        bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        return []
    }
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: 450, height: 110))
    context.draw(crop, in: CGRect(x: 153, y: 40, width: width, height: 30))
    let font = NSFont.systemFont(ofSize: 39)
    for (word, x) in [("Chord", CGFloat(30)), ("mark", 164 + width)] {
        let text = NSAttributedString(string: word,
            attributes: [.font: font, .foregroundColor: NSColor.black])
        context.textPosition = CGPoint(x: x, y: 40)
        CTLineDraw(CTLineCreateWithAttributedString(text), context)
    }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    guard let image = context.makeImage() else { return [] }
    try VNImageRequestHandler(cgImage: image).perform([request])
    let recognized = (request.results ?? [])
        .compactMap { $0.topCandidates(1).first?.string }.joined(separator: " ")
    let tokens = recognized.split(whereSeparator: { $0.isWhitespace || "-–—+….,:".contains($0) })
    return tokens.compactMap { value in
        let text = value.count == 1 ? value.uppercased() : String(value)
        let row = Row(bounds: .zero, tokens: [Token(text: text, x: 0)])
        return row.chords.first?.text
    }
}

func redChordMask(_ image: CGImage, chordsOnly: Bool = true) -> CGImage? {
    let width = image.width, height = image.height
    let bitmap = CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue
    guard let color = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: bitmap),
        let data = color.data else { return nil }
    color.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    let pixels = data.assumingMemoryBound(to: UInt8.self)
    var marked = 0
    for y in 0..<height {
        for x in 0..<width {
            let offset = y * color.bytesPerRow + x * 4
            let red = Int(pixels[offset]), green = Int(pixels[offset + 1]), blue = Int(pixels[offset + 2])
            let chord = red > 100 && red - green > 50 && red - blue > 50
            if chord { marked += 1 }
            if chordsOnly || chord {
                let value: UInt8 = chordsOnly && chord ? 0 : 255
                pixels[offset] = value; pixels[offset + 1] = value; pixels[offset + 2] = value; pixels[offset + 3] = 255
            }
        }
    }
    return marked >= 60 ? color.makeImage() : nil
}

func sparseChordRows(_ image: CGImage, known: [Row], colorIsolated: Bool = false) throws -> [Row] {
    let width = image.width, height = image.height
    guard let gray = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
        bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue),
        let data = gray.data else { return [] }
    gray.setFillColor(CGColor(gray: 1, alpha: 1))
    gray.fill(CGRect(x: 0, y: 0, width: width, height: height))
    gray.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    let pixels = data.assumingMemoryBound(to: UInt8.self)
    let stride = gray.bytesPerRow
    let ink: (Int, Int) -> Bool = { pixels[$1 * stride + $0] < 105 }
    var bands: [Range<Int>] = []
    var start: Int?
    for y in 0..<height {
        let hasInk = (0..<width).contains { ink($0, y) }
        if hasInk {
            if start == nil { start = y }
        } else if let from = start {
            bands.append(from..<y)
            start = nil
        }
    }
    var rows: [Row] = []
    for band in bands where band.count >= 6 {
        let rowY = 1 - CGFloat(band.lowerBound + band.upperBound) / (2 * CGFloat(height))
        let lineHeight = CGFloat(band.count) / CGFloat(height)
        let nearby = known.first { abs($0.bounds.midY - rowY) <= max($0.bounds.height, lineHeight) * 0.55 }
        if let nearby, nearby.chords.isEmpty && nearby.words.count > 3 { continue }
        if !colorIsolated && !known.contains(where: {
            $0.chords.isEmpty && $0.bounds.midY < rowY && rowY - $0.bounds.midY < $0.bounds.height * 3.4 && $0.words.count > 3
        }) { continue }

        // In a chord row, symbols are separated by more space than letters within a chord.
        var groups: [Range<Int>] = []
        var first: Int?
        var last = -1
        let gap = max(3, band.count / 2)
        for x in 0..<width {
            guard let top = band.first(where: { ink(x, $0) }) else { continue }
            if colorIsolated {
                let bottom = band.last(where: { ink(x, $0) }) ?? top
                // Horizontal dashes between chord names have little vertical ink.
                if bottom - top < band.count / 3 { continue }
            }
            if first != nil && x - last > gap {
                groups.append(first!..<(last + 1))
                first = nil
            }
            if first == nil { first = x }
            last = x
        }
        if let first { groups.append(first..<(last + 1)) }
        if groups.count > 12 || groups.isEmpty { continue }

        var tokens = nearby?.chords ?? []
        for group in groups where group.count >= 3 && group.count <= band.count * 5 {
            let x = CGFloat(group.lowerBound) / CGFloat(width)
            if tokens.contains(where: { abs($0.x - x) < CGFloat(band.count) / CGFloat(width) }) { continue }
            let rect = CGRect(x: group.lowerBound, y: band.lowerBound, width: group.count, height: band.count)
            guard let crop = image.cropping(to: rect) else { continue }
            let chords = try readIsolatedChords(crop)
            for (index, chord) in chords.enumerated() {
                let position = x + CGFloat(index * group.count) / CGFloat(max(1, chords.count) * width)
                tokens.append(Token(text: chord, x: position))
            }
        }
        if tokens.count > (nearby?.chords.count ?? 0) {
            rows.append(Row(bounds: CGRect(x: 0, y: rowY - lineHeight / 2, width: 1, height: lineHeight),
                            tokens: tokens.sorted { $0.x < $1.x }))
        }
    }
    return rows
}

func recognizeRows(_ url: URL) throws -> [Row] {
    let accurate = VNRecognizeTextRequest()
    accurate.recognitionLevel = .accurate
    accurate.usesLanguageCorrection = false
    accurate.minimumTextHeight = 0.005
    let fast = VNRecognizeTextRequest()
    fast.recognitionLevel = .fast
    fast.usesLanguageCorrection = false
    fast.minimumTextHeight = 0.005
    let image = try pageImage(for: url)
    let redMask = redChordMask(image)
    let words = redMask == nil ? image : redChordMask(image, chordsOnly: false) ?? image
    try VNImageRequestHandler(cgImage: words).perform([accurate, fast])
    var rows = try groupRows(accurate.results ?? [])
    // The fast pass can recognize isolated symbols missed by the word-oriented pass.
    for row in try groupRows(fast.results ?? []) where !row.chords.isEmpty {
        if let index = rows.firstIndex(where: {
            abs($0.bounds.midY - row.bounds.midY) < min($0.bounds.height, row.bounds.height) * 0.6
        }) {
            if row.chords.count > rows[index].chords.count &&
                (!rows[index].chords.isEmpty || rows[index].words.count <= 3) {
                rows[index] = row
            }
        } else {
            rows.append(row)
        }
    }
    rows.sort { $0.bounds.midY > $1.bounds.midY }
    if let mask = redMask {
        var redRows = try sparseChordRows(mask, known: [], colorIsolated: true)
        if redRows.count >= 2 {
            for index in redRows.indices {
                let row = redRows[index]
                let sameLine = rows.filter {
                    abs($0.bounds.midY - row.bounds.midY) < max($0.bounds.height, row.bounds.height) * 0.55
                }
                let inline = sameLine.flatMap(\.tokens).sorted { $0.x < $1.x }
                let repeats = inline.compactMap { token -> Int? in
                    guard token.text.lowercased().range(of: #"^\(?[2-4]x\)?$"#, options: .regularExpression) != nil else { return nil }
                    return token.text.first(where: \.isNumber).flatMap { Int(String($0)) }
                }
                redRows[index].repeatCount = repeats.first ?? 1
                if let end = row.tokens.last?.x {
                    let trailing = inline.filter { token in
                        token.x > end + 0.012 && !Row(bounds: .zero, tokens: [token]).chords.isEmpty
                    }
                    redRows[index].tokens.append(contentsOf: trailing)
                }
            }
            return (rows.filter { original in !redRows.contains {
                abs(original.bounds.midY - $0.bounds.midY) < max(original.bounds.height, $0.bounds.height) * 0.65
            } } + redRows).sorted { $0.bounds.midY > $1.bounds.midY }
        }
    }
    for row in try sparseChordRows(image, known: rows) {
        if let index = rows.firstIndex(where: {
            abs($0.bounds.midY - row.bounds.midY) < max($0.bounds.height, row.bounds.height) * 0.6
        }) {
            rows[index] = row
        } else {
            rows.append(row)
        }
    }
    return rows.sorted { $0.bounds.midY > $1.bounds.midY }
}

func chordLine(_ chords: [Token], lyrics: [Token]) -> String {
    var starts: [Int] = []
    for chord in chords {
        let next = lyrics.indices.min { abs(lyrics[$0].x - chord.x) < abs(lyrics[$1].x - chord.x) }
        starts.append(max(starts.last ?? 0, next ?? 0))
    }
    if !starts.isEmpty { starts[0] = 0 }
    return chords.enumerated().map { index, chord in
        let end = index + 1 < starts.count ? starts[index + 1] : lyrics.count
        let phrase = lyrics[starts[index]..<end].map(\.text).joined(separator: " ")
        return "[\(chord.text)]" + phrase
    }.joined(separator: " ")
}

func readChart(_ url: URL) throws -> String {
    let rows = try recognizeRows(url).filter { !$0.chords.isEmpty || $0.words.rangeOfCharacter(from: .letters) != nil }
    guard let first = rows.firstIndex(where: { !$0.chords.isEmpty || $0.words.range(of: #"\[[A-G][^\]]*\]"#, options: .regularExpression) != nil }) else {
        throw ScanFailure("No chord symbols were found. Try a straight, well-lit image with chords printed above the lyrics.")
    }

    let heading = rows[..<first].first?.words ?? url.deletingPathExtension().lastPathComponent
    let title = heading.replacingOccurrences(of: #"\s*\((?:video|intro|midi)\)"#, with: "", options: [.regularExpression, .caseInsensitive])
        .replacingOccurrences(of: "}", with: "").replacingOccurrences(of: ";", with: " ")
    var lines = ["{title: \(title)}"]
    var index = first
    while index < rows.count {
        let row = rows[index]
        let chords = row.chords
        if chords.isEmpty {
            if !row.words.hasPrefix("(") && !row.words.lowercased().contains("repeat verse") {
                lines.append(row.words)
            }
        } else {
            let next = index + 1 < rows.count ? rows[index + 1] : nil
            if let next, next.chords.isEmpty,
               next.words.range(of: #"^(verse|chorus|bridge|intro|outro)(?:\s+\d+)?\s*:?$"#,
                                options: [.regularExpression, .caseInsensitive]) == nil,
               !next.words.contains("["), !next.words.hasPrefix("("),
               next.words.rangeOfCharacter(from: .letters) != nil,
               !next.words.lowercased().contains("repeat verse"),
               row.bounds.midY - next.bounds.midY < max(row.bounds.height, next.bounds.height) * 3.4 {
                let lyricTokens = next.tokens.drop(while: { $0.text == "+" || $0.text.range(of: #"^\d+\.$"#, options: .regularExpression) != nil })
                lines.append(chordLine(chords, lyrics: Array(lyricTokens)))
                index += 1
            } else {
                lines.append(contentsOf: Array(repeating: chordLine(chords, lyrics: []), count: row.repeatCount))
            }
        }
        index += 1
    }
    return lines.map { $0.replacingOccurrences(of: ";", with: ",") }.joined(separator: "\n")
}

func choosePage() -> URL? {
    NSApplication.shared.setActivationPolicy(.accessory)
    NSApplication.shared.activate(ignoringOtherApps: true)
    let panel = NSOpenPanel()
    panel.title = "Scan Song Page"
    panel.message = "Choose a photo or PDF with chords above the lyrics."
    panel.prompt = "Scan"
    panel.allowedContentTypes = [.image, .pdf]
    panel.allowsMultipleSelection = false
    return panel.runModal() == .OK ? panel.url : nil
}

func showMessage(_ title: String, _ detail: String) {
    let dialog = NSAlert()
    dialog.messageText = title
    dialog.informativeText = detail
    dialog.runModal()
}

let arguments = Array(CommandLine.arguments.dropFirst())
let usePicker = arguments.isEmpty
let scripts = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("Scripts")
let handoff = scripts.appendingPathComponent("GuitarScannedPage.ts")

do {
    let chart: String
    if arguments == ["--clear"] {
        chart = ""
    } else if arguments.count == 2 && arguments[0] == "--stdout" {
        print(try readChart(URL(fileURLWithPath: arguments[1])))
        exit(0)
    } else {
        guard usePicker || arguments.count == 1 else {
            throw ScanFailure("Usage: Scan Song Page.command [image-or-PDF | --clear | --stdout image-or-PDF]")
        }
        guard let url = usePicker ? choosePage() : URL(fileURLWithPath: arguments[0]) else { exit(0) }
        chart = try readChart(url)
    }
    let literal = try JSONSerialization.data(withJSONObject: chart, options: [.fragmentsAllowed, .withoutEscapingSlashes])
    let text = String(decoding: literal, as: UTF8.self)
    let source = "// Desktop Preview handoff written by Scan Song Page.\nexport const SCANNED_CHART = \(text);\n"
    try source.write(to: handoff, atomically: true, encoding: .utf8)
    if usePicker {
        showMessage("Page scanned", "In Lens Studio, choose Add my own, then Import chart and Use scanned page. Check the timing before saving.")
    } else {
        print(chart.isEmpty ? "Scan handoff cleared." : "Scan ready in Lens Studio Preview.")
    }
} catch {
    if usePicker { showMessage("Could not scan page", error.localizedDescription) }
    else { FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8)) }
    exit(1)
}
