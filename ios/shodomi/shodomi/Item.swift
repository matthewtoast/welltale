//
//  Item.swift
//  shodomi
//
//  Created by Matthew Trost on 7/31/25.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
