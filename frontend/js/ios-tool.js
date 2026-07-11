// iOS Tool — Versions, SwiftUI, UIKit, Swift, Xcode, Info.plist, HIG, Device Specs
var IosTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ iOS Versions ═══
  var IOS_VERSIONS = [
    { ver: "26", name: "Oak",             zh: "橡树",               year: 2026 },
    { ver: "25", name: "Warden",          zh: "守望者",             year: 2025 },
    { ver: "18", name: "",                zh: "",                   year: 2024 },
    { ver: "17", name: "Dawn",            zh: "黎明",               year: 2023 },
    { ver: "16", name: "Sydney",          zh: "悉尼",               year: 2022 },
    { ver: "15", name: "Sky",             zh: "天空",               year: 2021 },
    { ver: "14", name: "Azul",            zh: "蔚蓝",               year: 2020 },
    { ver: "13", name: "Yukon",           zh: "育空",               year: 2019 },
    { ver: "12", name: "Peace",           zh: "宁静",               year: 2018 },
    { ver: "11", name: "",                zh: "",                   year: 2017 },
    { ver: "10", name: "",                zh: "",                   year: 2016 },
    { ver: "9",  name: "Monarch",         zh: "帝王蝶",             year: 2015 },
    { ver: "8",  name: "Okemo",           zh: "奥克莫",             year: 2014 },
    { ver: "7",  name: "Innsbruck",       zh: "因斯布鲁克",         year: 2013 },
    { ver: "6",  name: "Sundance",        zh: "圣丹斯",             year: 2012 },
  ];

  // ═══ SwiftUI Views ═══ — [name, zhName, api, description, category, example]
  var SWIFTUI_VIEWS = [
    ["VStack", "垂直堆叠", "VStack", "Vertical stack of views", "layout", "VStack(alignment: .leading, spacing: 8) { Text(\"Title\").font(.headline); Text(\"Subtitle\").foregroundColor(.secondary) }"],
    ["HStack", "水平堆叠", "HStack", "Horizontal stack of views", "layout", "HStack(spacing: 12) { Image(systemName: \"star.fill\"); Text(\"Favorited\"); Spacer(); Button(\"Edit\") {} }"],
    ["ZStack", "层叠", "ZStack", "Overlay views on z-axis", "layout", "ZStack { Color.blue.ignoresSafeArea(); VStack { Text(\"On top\").foregroundColor(.white) } }"],
    ["LazyVStack", "懒加载垂直", "LazyVStack", "Vertical stack loaded on demand", "layout", "ScrollView { LazyVStack { ForEach(items) { item in ItemRow(item) } } }"],
    ["LazyHStack", "懒加载水平", "LazyHStack", "Horizontal stack loaded on demand", "layout", "ScrollView(.horizontal) { LazyHStack { ForEach(items) { ItemCard($0) } } }"],
    ["Spacer", "弹性空间", "Spacer", "Expand to fill available space", "layout", "HStack { Text(\"Left\"); Spacer(); Text(\"Right\") }"],
    ["Divider", "分割线", "Divider", "Horizontal or vertical line", "layout", "VStack { Text(\"Above\"); Divider(); Text(\"Below\") }"],
    ["GeometryReader", "几何读取", "GeometryReader", "Read parent size and position", "layout", "GeometryReader { geo in Color.clear.preference(key: SizeKey.self, value: geo.size) }.onPreferenceChange(SizeKey.self) { size = $0 }"],
    ["ScrollView", "滚动视图", "ScrollView", "Scrollable container", "scroll", "ScrollView { VStack(spacing: 16) { ForEach(0..<50) { Text(\"Item \\($0)\").frame(maxWidth: .infinity) } } }"],
    ["List", "列表", "List", "Platform-appropriate table view", "scroll", "List(items) { item in HStack { Text(item.name); Spacer(); Text(item.date, style: .date) } }.listStyle(.insetGrouped)"],
    ["ForEach", "循环", "ForEach", "Generate views from a collection", "scroll", "ForEach(items, id: \\.id) { item in Text(item.name) }"],
    ["LazyVGrid", "垂直网格", "LazyVGrid", "Vertical grid with lazy loading", "scroll", "LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))]) { ForEach(items) { Text($0).frame(height: 80) } }"],
    ["LazyHGrid", "水平网格", "LazyHGrid", "Horizontal grid with lazy loading", "scroll", "LazyHGrid(rows: [GridItem(.fixed(100))]) { ForEach(items) { Image(systemName: $0).font(.largeTitle) } }"],
    ["TabView", "标签页", "TabView", "Tab bar or page-style navigation", "structure", "TabView { ContentView().tabItem { Label(\"Home\", systemImage: \"house\") }; SettingsView().tabItem { Label(\"Settings\", systemImage: \"gear\") } }"],
    ["NavigationStack", "导航栈", "NavigationStack", "iOS 16+ push/pop navigation", "structure", "NavigationStack { List(items) { item in NavigationLink(item.name, value: item) }.navigationDestination(for: Item.self) { DetailView(item: $0) } }"],
    ["NavigationSplitView", "分栏导航", "NavigationSplitView", "Two/three-column iPad layout", "structure", "NavigationSplitView(sidebar: { List(selection: $sel) { ... } }, detail: { if let item = sel { DetailView(item: item) } else { Text(\"Select\") } })"],
    ["NavigationLink", "导航链接", "NavigationLink", "Push to a destination view", "structure", "NavigationLink(destination: DetailView(id: id)) { HStack { Text(\"Title\"); Spacer(); Image(systemName: \"chevron.right\").foregroundColor(.secondary) } }"],
    [".sheet", "弹出页", ".sheet(isPresented:)", "Present a modal sheet", "structure", "Button(\"Show\") { showSheet = true }.sheet(isPresented: $showSheet) { SheetView() }"],
    [".fullScreenCover", "全屏覆盖", ".fullScreenCover(...)", "Full-screen modal", "structure", ".fullScreenCover(isPresented: $showFull) { FullScreenView() }"],
    [".alert", "弹窗", ".alert(...)", "Present alert dialog", "structure", ".alert(\"Title\", isPresented: $show) { Button(\"OK\") {}; Button(\"Cancel\", role: .cancel) {} } message: { Text(\"Message\") }"],
    [".confirmationDialog", "确认对话框", ".confirmationDialog(...)", "Action sheet / context menu", "structure", ".confirmationDialog(\"Options\", isPresented: $show) { Button(\"Share\") {}; Button(\"Delete\", role: .destructive) {} }"],
    [".popover", "浮窗", ".popover(...)", "Popover on iPad, sheet on iPhone", "structure", ".popover(isPresented: $show, attachmentAnchor: .point(.bottom)) { Text(\"Popover content\").padding() }"],
    ["Group", "分组", "Group", "Group views for shared modifiers", "structure", "Group { if loading { ProgressView() } else { ContentView() } }.padding()"],
    ["GroupBox", "分组框", "GroupBox", "Grouped content with label", "structure", "GroupBox(label: Label(\"Account\", systemImage: \"person.circle\")) { Text(\"user@example.com\") }"],
    ["Form", "表单", "Form", "Platform-appropriate form sections", "input", "Form { Section(header: Text(\"Profile\")) { TextField(\"Name\", text: $name); TextField(\"Email\", text: $email).keyboardType(.emailAddress) }; Section { Toggle(\"Notifications\", isOn: $notify) } }"],
    ["Section", "分组", "Section", "Group rows with header/footer", "input", "List { Section(header: Text(\"General\"), footer: Text(\"Footer\")) { Toggle(\"Wi-Fi\", isOn: $wifi) } }"],
    ["TextField", "文本输入", "TextField", "Single-line text input", "input", "TextField(\"Email\", text: $email).textFieldStyle(.roundedBorder).keyboardType(.emailAddress).autocapitalization(.none)"],
    ["TextEditor", "多行文本", "TextEditor", "Multi-line text input", "input", "TextEditor(text: $bio).frame(minHeight: 100).padding(4).overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary))"],
    ["SecureField", "密码输入", "SecureField", "Password text input", "input", "SecureField(\"Password\", text: $password).textFieldStyle(.roundedBorder)"],
    ["Toggle", "开关", "Toggle", "On/off boolean toggle", "input", "Toggle(\"Notifications\", isOn: $enabled).tint(.blue)"],
    ["Slider", "滑块", "Slider", "Select value from a range", "input", "Slider(value: $volume, in: 0...100, step: 1) { Text(\"Volume\") }.tint(.blue)"],
    ["Stepper", "步进器", "Stepper", "Increment/decrement value", "input", "Stepper(value: $count, in: 0...10) { Text(\"Count: \\(count)\") }"],
    ["Picker", "选择器", "Picker", "Select from a list", "input", "Picker(\"Color\", selection: $color) { ForEach(colors, id: \\.self) { Text($0) } }.pickerStyle(.menu)"],
    ["DatePicker", "日期选择", "DatePicker", "Date and time picker", "input", "DatePicker(\"Date\", selection: $date, displayedComponents: .date).datePickerStyle(.graphical)"],
    ["ColorPicker", "颜色选择", "ColorPicker", "System color picker", "input", "ColorPicker(\"Accent\", selection: $accentColor)"],
    ["Text", "文本", "Text", "Display styled text", "display", "Text(\"Hello World\").font(.largeTitle).fontWeight(.bold).foregroundColor(.blue).multilineTextAlignment(.center)"],
    ["Label", "标签", "Label", "Icon + text pair", "display", "Label(\"Favorites\", systemImage: \"star.fill\").font(.headline)"],
    ["Image", "图片", "Image", "Display SF Symbol or asset image", "display", "Image(systemName: \"heart.fill\").font(.system(size: 40)).foregroundColor(.red)"],
    ["AsyncImage", "异步图片", "AsyncImage", "Load image from URL (iOS 15+)", "display", "AsyncImage(url: URL(string: \"https://example.com/photo.jpg\")) { phase in if let img = phase.image { img.resizable().aspectRatio(contentMode: .fill) } else { ProgressView() } }.frame(width: 200, height: 200).clipShape(RoundedRectangle(cornerRadius: 12))"],
    ["ProgressView", "进度视图", "ProgressView", "Spinner or progress bar", "display", "ProgressView(\"Loading...\", value: progress, total: 1.0).progressViewStyle(.linear).tint(.blue)"],
    ["Button", "按钮", "Button", "Tappable button", "input", "Button(action: { submit() }) { Text(\"Submit\").frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent).controlSize(.large)"],
    ["Menu", "菜单", "Menu", "Show a popup menu", "input", "Menu { Button(\"Edit\", action: edit); Button(\"Delete\", role: .destructive, action: remove) } label: { Label(\"Options\", systemImage: \"ellipsis.circle\") }"],
    ["Link", "链接", "Link", "Open URL in default browser", "input", "Link(destination: URL(string: \"https://apple.com\")!) { Label(\"Apple\", systemImage: \"safari\") }"],
    ["ShareLink", "分享", "ShareLink", "Share sheet (iOS 16+)", "input", "ShareLink(item: url, subject: Text(\"Check this out\"), message: Text(\"Sharing link...\")) { Label(\"Share\", systemImage: \"square.and.arrow.up\") }"],
  ];

  var SWIFTUI_PROPS = [
    ["@State", "本地状态", "Local state", "@State private var count = 0", "View-owned mutable state"],
    ["@Binding", "绑定", "Two-way binding", "@Binding var isPresented: Bool", "Read/write to parent state"],
    ["@StateObject", "状态对象", "Owned ObservableObject", "@StateObject var vm = MyVM()", "Create and own an ObservableObject"],
    ["@ObservedObject", "观察对象", "External ObservableObject", "@ObservedObject var vm: MyVM", "Observe from parent, don't own"],
    ["@EnvironmentObject", "环境对象", "Environment injection", "@EnvironmentObject var auth: AuthModel", "Injected via .environmentObject()"],
    ["@Environment", "环境值", "Environment value", "@Environment(\\.colorScheme) var scheme", "Read system environment values"],
    ["@AppStorage", "UserDefaults", "UserDefaults wrapper", "@AppStorage(\"key\") var value = 0", "Persist to UserDefaults, auto-refresh"],
    ["@SceneStorage", "场景存储", "Per-scene state", "@SceneStorage(\"scroll\") var offset = 0.0", "Restored per-scene (iOS 14+)"],
    ["@FocusState", "焦点状态", "Focus state", "@FocusState private var field: Field?", "Manage text field focus"],
    ["@FetchRequest", "Core Data", "Core Data fetch", "@FetchRequest(sortDescriptors: [...]) var items", "Fetch Core Data entities"],
    ["@Query", "SwiftData", "SwiftData query", "@Query(sort: \\...) var items: [Model]", "SwiftData fetch (iOS 17+)"],
    ["@Observable", "观察宏", "Observable macro", "@Observable class Model { var name = \"\" }", "iOS 17+ replacement for ObservableObject"],
  ];

  // ═══ UIKit Quick Ref ═══
  var UIKIT_CLASSES = [
    ["UIView", "视图基类", "Base view class", "All views inherit from UIView", "view"],
    ["UIViewController", "控制器基类", "Base VC", "Manages a view hierarchy", "vc"],
    ["UINavigationController", "导航控制器", "Nav controller", "Push/pop stack navigation", "vc"],
    ["UITabBarController", "标签控制器", "Tab bar controller", "Bottom tab navigation", "vc"],
    ["UISplitViewController", "分栏控制器", "Split VC", "Master-detail for iPad", "vc"],
    ["UIPageViewController", "翻页控制器", "Page VC", "Swipeable pages", "vc"],
    ["UITableView", "表格视图", "Table view", "Scrollable single-column list", "view"],
    ["UICollectionView", "集合视图", "Collection view", "Customizable grid/layout", "view"],
    ["UIStackView", "堆叠视图", "Stack view", "Auto-layout rows/columns", "view"],
    ["UILabel", "标签", "Label", "Single/multi-line text display", "view"],
    ["UIImageView", "图片视图", "Image view", "Display images", "view"],
    ["UIButton", "按钮", "Button", "Tappable button", "view"],
    ["UITextField", "文本输入", "Text field", "Single-line text input", "view"],
    ["UITextView", "文本视图", "Text view", "Multi-line / scrollable text", "view"],
    ["UISwitch", "开关", "Switch", "On/off toggle", "view"],
    ["UISlider", "滑块", "Slider", "Select value from range", "view"],
    ["UIStepper", "步进器", "Stepper", "Increment/decrement value", "view"],
    ["UIDatePicker", "日期选择", "Date picker", "Date/time selection", "view"],
    ["UIAlertController", "弹窗", "Alert controller", "Alert / action sheet", "vc"],
    ["WkWebView", "网页视图", "Web view", "In-app web browser", "view"],
    ["MKMapView", "地图视图", "Map view", "Embedded map", "view"],
    ["SFSafariViewController", "Safari 内嵌", "Safari VC", "In-app Safari browser", "vc"],
  ];

  var AUTOLAYOUT_SNIPPETS = [
    ["固定宽度", "Fixed width", "view.widthAnchor.constraint(equalToConstant: 200).isActive = true"],
    ["固定高度", "Fixed height", "view.heightAnchor.constraint(equalToConstant: 44).isActive = true"],
    ["宽高比", "Aspect ratio", "view.widthAnchor.constraint(equalTo: view.heightAnchor, multiplier: 16/9).isActive = true"],
    ["居中 X", "Center X", "view.centerXAnchor.constraint(equalTo: parent.centerXAnchor).isActive = true"],
    ["居中 Y", "Center Y", "view.centerYAnchor.constraint(equalTo: parent.centerYAnchor).isActive = true"],
    ["四边贴齐", "Pin edges", "NSLayoutConstraint.activate([view.topAnchor.constraint(equalTo: parent.topAnchor), view.leadingAnchor.constraint(equalTo: parent.leadingAnchor), view.trailingAnchor.constraint(equalTo: parent.trailingAnchor), view.bottomAnchor.constraint(equalTo: parent.bottomAnchor)])"],
    ["等宽", "Equal width", "viewA.widthAnchor.constraint(equalTo: viewB.widthAnchor).isActive = true"],
    ["安全区域", "Safe area", "view.topAnchor.constraint(equalTo: parent.safeAreaLayoutGuide.topAnchor).isActive = true"],
    ["Stack 内边距", "Stack padding", "stack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16); stack.isLayoutMarginsRelativeArrangement = true"],
  ];

  // ═══ Swift Language ═══
  var SWIFT_SNIPPETS = [
    ["var / let", "变量/常量", "var / let", "var count = 0; let name = \"iOS\"", "let is immutable"],
    ["Optional", "可选类型", "Type?", "var name: String? = nil", "nil-safe with ? and !"],
    ["guard let", "提前退出", "guard let", "guard let name = name else { return }", "Unwrap or early return"],
    ["if let", "可选绑定", "if let", "if let name = name { print(name) }", "Unwrap in scope"],
    ["??", "空合运算符", "Nil coalescing", "let display = name ?? \"Unknown\"", "Provide default for nil"],
    ["enum", "枚举", "enum", "enum State { case idle, loading, done }", "Can have associated values"],
    ["associated value", "关联值", "Associated value", "enum Result { case success(Data), failure(Error) }", "Enum cases with payloads"],
    ["struct", "结构体", "struct", "struct Point { var x, y: Double }", "Value type, default memberwise init"],
    ["class", "类", "class", "class Dog { var name = \"\" }", "Reference type, inheritance supported"],
    ["actor", "Actor", "actor", "actor Cache { var items: [String: Data] = [:] }", "Data-race safe (Swift 5.5+)"],
    ["protocol", "协议", "protocol", "protocol Identifiable { var id: String { get } }", "Interface / blueprint"],
    ["extension", "扩展", "extension", "extension String { var isEmail: Bool { ... } }", "Add functionality to existing types"],
    ["@MainActor", "主线程", "Main actor", "@MainActor class ViewModel { ... }", "Run on main thread (Swift 5.5+)"],
    ["async/await", "异步", "Async/await", "let data = try await URLSession.shared.data(from: url)", "Structured concurrency (Swift 5.5+)"],
    ["Task", "任务", "Task", "Task { await fetchData() }", "Create async context from sync code"],
    ["do/catch", "错误处理", "Error handling", "do { try riskyCall() } catch { print(error) }", "Swift error handling"],
    ["try?", "可选 try", "Optional try", "let result = try? riskyCall()", "Returns nil on error"],
    ["Result", "结果类型", "Result type", "Result<Data, Error>", "Functional error handling"],
    ["typealias", "类型别名", "Type alias", "typealias Callback = (Data) -> Void", "Name a type combo"],
    ["@propertyWrapper", "属性包装", "Property wrapper", "@propertyWrapper struct Clamped<T: Comparable> { ... }", "Custom wrapping logic"],
    ["@resultBuilder", "结果构建器", "Result builder", "@resultBuilder struct ViewBuilder { ... }", "DSL builder (used by SwiftUI)"],
  ];

  // ═══ Xcode ═══
  var XCODE_COMMANDS = [
    ["构建", "Build", "⌘B", "Build project"],
    ["运行", "Run", "⌘R", "Build and run on simulator/device"],
    ["测试", "Test", "⌘U", "Run unit/UI tests"],
    ["清理构建", "Clean", "⌘⇧K", "Clean build folder"],
    ["打开快速打开", "Quick Open", "⌘⇧O", "Open any file by name"],
    ["全局搜索", "Find in Project", "⌘⇧F", "Search across all files"],
    ["当前文件搜索", "Find in File", "⌘F", "Search in current file"],
    ["替换", "Find & Replace", "⌥⌘F", "Search and replace"],
    ["代码补全", "Autocomplete", "⌃Space", "Show completions"],
    ["格式化缩进", "Re-indent", "⌃I", "Re-indent selected lines"],
    ["注释/取消注释", "Comment", "⌘/", "Toggle line comment"],
    ["多光标", "Multi-cursor", "⌃⇧ + click", "Edit at multiple points"],
    ["打开/关闭调试区", "Debug area", "⌘⇧Y", "Toggle debug console"],
    ["打开/关闭导航", "Navigator", "⌘0", "Toggle left navigator"],
    ["打开/关闭检查器", "Inspector", "⌥⌘0", "Toggle right inspector"],
    ["打开/关闭画布", "Canvas", "⌥⌘↩", "Toggle SwiftUI preview"],
    ["设备管理器", "Devices", "⌘⇧2", "Devices and Simulators window"],
    ["Simulator 截图", "Screenshot", "⌘S (in Simulator)", "Save simulator screenshot"],
    ["Simulator 录屏", "Record", "xcrun simctl io booted recordVideo demo.mp4", "Record simulator video"],
    ["重置模拟器", "Reset", "xcrun simctl erase all", "Erase all simulators"],
    ["清理派生数据", "DerivedData", "rm -rf ~/Library/Developer/Xcode/DerivedData", "Fix mysterious build errors"],
  ];

  // ═══ Info.plist Keys ═══
  var PLIST_KEYS = [
    ["NSCameraUsageDescription", "相机权限说明", "Camera usage", "访问相机时显示的说明文字"],
    ["NSPhotoLibraryUsageDescription", "相册权限说明", "Photo library usage", "访问相册时显示的说明文字"],
    ["NSPhotoLibraryAddUsageDescription", "保存到相册说明", "Add to photo library", "保存图片到相册时显示的说明文字"],
    ["NSMicrophoneUsageDescription", "麦克风权限说明", "Microphone usage", "访问麦克风时显示的说明文字"],
    ["NSLocationWhenInUseUsageDescription", "前台定位说明", "Location in use", "使用中定位说明"],
    ["NSLocationAlwaysUsageDescription", "始终定位说明", "Location always", "始终定位说明"],
    ["NSUserTrackingUsageDescription", "跟踪权限说明", "Tracking usage", "App Tracking Transparency 使用说明"],
    ["NSFaceIDUsageDescription", "Face ID 说明", "Face ID usage", "使用 Face ID 原因说明"],
    ["NSCalendarsUsageDescription", "日历权限说明", "Calendar usage", "访问日历时显示的说明"],
    ["NSContactsUsageDescription", "通讯录权限说明", "Contacts usage", "访问通讯录时显示的说明"],
    ["NSBluetoothAlwaysUsageDescription", "蓝牙权限说明", "Bluetooth usage", "使用蓝牙原因说明"],
    ["CFBundleDisplayName", "应用显示名称", "Display name", "主屏幕和 App Store 显示的名称"],
    ["CFBundleShortVersionString", "版本号", "Version", "对外发布的版本号，如 1.2.0"],
    ["CFBundleVersion", "构建号", "Build number", "内部构建版本号，App Store 提交时递增"],
    ["CFBundleIdentifier", "Bundle ID", "Bundle identifier", "反向域名格式，如 com.example.app"],
    ["CFBundleURLTypes", "URL Schemes", "URL schemes", "注册自定义 URL scheme（如 myapp://）"],
    ["LSApplicationQueriesSchemes", "查询 URL Scheme", "Query schemes", "iOS 9+ 白名单要跳转的 app scheme"],
    ["UISupportedInterfaceOrientations", "支持方向", "Supported orientations", "应用支持的屏幕方向"],
    ["UIRequiresFullScreen", "全屏要求", "Requires full screen", "禁止 Slide Over / Split View（iPad）"],
    ["ITSAppUsesNonExemptEncryption", "加密声明", "Encryption exemption", "App 不使用加密或使用豁免加密"],
    ["UIApplicationSceneManifest", "Scene 配置", "Scene manifest", "iOS 13+ 多场景配置"],
    ["NSAppTransportSecurity", "ATS 配置", "App Transport Security", "控制 HTTP 明文请求和证书配置"],
  ];

  // ═══ HIG Quick Ref ═══
  var HIG_GUIDELINES = [
    ["触摸目标", "Tap target", "最小 44×44 pt", "按钮、列表行等交互元素的最小尺寸"],
    ["安全区域", "Safe area", "避开状态栏、刘海、底部指示条", "使用 safeAreaLayoutGuide 或 safeAreaInset"],
    ["间距", "Spacing", "常用 8、16、24 pt", "使用 8pt 网格系统，标准外边距 16pt"],
    ["导航栏高度", "Nav bar height", "44pt + 状态栏", "大标题模式下 96pt"],
    ["标签栏高度", "Tab bar height", "49pt + safe area", "底部标签栏标准高度"],
    ["表格行高", "Cell height", "默认 44pt", "可自定义但 44pt 是标准基础高度"],
    ["圆角", "Corner radius", "系统默认按钮 12-14pt", "卡片常用 10-16pt"],
    ["SF Symbols", "SF Symbols", "6,000+ 系统图标", "使用 SF Symbols app 浏览和导出名称"],
    ["字体大小", "Font sizes", "Large Title 34, Title1 28, Title2 22, Title3 20, Headline 17, Body 17, Callout 16, Subhead 15, Footnote 13, Caption1 12, Caption2 11", "Dynamic Type 自动缩放"],
    ["色彩空间", "Color space", "Display P3 (广色域)", "使用 Color(\"name\") 从 Asset Catalog 加载"],
    ["暗色模式", "Dark mode", "@Environment(\\.colorScheme)", "在 Asset Catalog 中为颜色和图片设置 Light/Dark 变体"],
    ["动态字体", "Dynamic Type", ".font(.body) 自动缩放", "支持用户系统字体大小偏好"],
    ["辅助功能", "Accessibility", "VoiceOver / Dynamic Type / Reduce Motion", "使用 .accessibilityLabel()"],
    ["触觉反馈", "Haptics", "UIImpactFeedbackGenerator", "轻/中/重三档，通知成功/警告/错误"],
    ["模态呈现", "Modal style", ".sheet / .fullScreenCover", "sheet 默认卡片式可下滑关闭"],
    ["导航模式", "Navigation", "层级：push/pop → 扁平：TabBar → 模态：sheet → 分栏：SplitView", "根据信息结构选模式"],
    ["加载指示", "Loading", "ProgressView()", "系统自带旋转菊花"],
  ];

  // ═══ Device Specs ═══
  var DEVICE_SPECS = [
    { name: "iPhone 17 Pro Max",     size: '6.9"',     res: "2868×1320", scale: "@3x", ppi: 460, chip: "A19 Pro",   ram: "12GB" },
    { name: "iPhone 17 Pro",         size: '6.3"',     res: "2622×1206", scale: "@3x", ppi: 460, chip: "A19 Pro",   ram: "12GB" },
    { name: "iPhone 17",             size: '6.3"',     res: "2622×1206", scale: "@3x", ppi: 460, chip: "A19",       ram: "8GB"  },
    { name: "iPhone 16 Pro Max",     size: '6.9"',     res: "2868×1320", scale: "@3x", ppi: 460, chip: "A18 Pro",   ram: "8GB"  },
    { name: "iPhone 16 Pro",         size: '6.3"',     res: "2622×1206", scale: "@3x", ppi: 460, chip: "A18 Pro",   ram: "8GB"  },
    { name: "iPhone 16 Plus",        size: '6.7"',     res: "2796×1290", scale: "@3x", ppi: 460, chip: "A18",       ram: "8GB"  },
    { name: "iPhone 16",             size: '6.1"',     res: "2556×1179", scale: "@3x", ppi: 460, chip: "A18",       ram: "8GB"  },
    { name: "iPhone 15 Pro Max",     size: '6.7"',     res: "2796×1290", scale: "@3x", ppi: 460, chip: "A17 Pro",   ram: "8GB"  },
    { name: "iPhone 15 Pro",         size: '6.1"',     res: "2556×1179", scale: "@3x", ppi: 460, chip: "A17 Pro",   ram: "8GB"  },
    { name: "iPhone 15 Plus",        size: '6.7"',     res: "2796×1290", scale: "@3x", ppi: 460, chip: "A16",       ram: "6GB"  },
    { name: "iPhone 15",             size: '6.1"',     res: "2556×1179", scale: "@3x", ppi: 460, chip: "A16",       ram: "6GB"  },
    { name: "iPhone 14 Pro Max",     size: '6.7"',     res: "2796×1290", scale: "@3x", ppi: 460, chip: "A16",       ram: "6GB"  },
    { name: "iPhone 14 Pro",         size: '6.1"',     res: "2556×1179", scale: "@3x", ppi: 460, chip: "A16",       ram: "6GB"  },
    { name: "iPhone SE (3rd gen)",   size: '4.7"',     res: "1334×750",   scale: "@2x", ppi: 326, chip: "A15",       ram: "4GB"  },
    { name: "iPad Pro 13-inch (M4)", size: '13.0"',    res: "2752×2064",  scale: "@2x", ppi: 264, chip: "M4",        ram: "8GB"  },
    { name: "iPad Pro 11-inch (M4)", size: '11.1"',    res: "2420×1668",  scale: "@2x", ppi: 264, chip: "M4",        ram: "8GB"  },
    { name: "iPad Air 13-inch (M3)", size: '12.9"',    res: "2732×2048",  scale: "@2x", ppi: 264, chip: "M3",        ram: "8GB"  },
    { name: "iPad Air 11-inch (M3)", size: '10.9"',    res: "2360×1640",  scale: "@2x", ppi: 264, chip: "M3",        ram: "8GB"  },
    { name: "iPad mini (7th gen)",   size: '8.3"',     res: "2266×1488",  scale: "@2x", ppi: 326, chip: "A17 Pro",   ram: "8GB"  },
    { name: "iPad (11th gen)",       size: '10.9"',    res: "2360×1640",  scale: "@2x", ppi: 264, chip: "A16",       ram: "6GB"  },
  ];

  // ═══ Reference Docs ═══
  var DOC_LINKS = [
    ["iOS Versions", "iOS Versions", "iOS release history", "iOS release history", "https://developer.apple.com/documentation/ios-ipados-release-notes"],
    ["SwiftUI", "SwiftUI", "SwiftUI framework docs", "SwiftUI documentation", "https://developer.apple.com/documentation/swiftui"],
    ["Swift Language", "Swift Language", "Swift 语言指南", "The Swift Programming Language", "https://docs.swift.org/swift-book/"],
    ["UIKit", "UIKit", "UIKit framework docs", "UIKit documentation", "https://developer.apple.com/documentation/uikit"],
    ["Xcode", "Xcode", "Xcode 文档", "Xcode documentation", "https://developer.apple.com/documentation/xcode"],
    ["Info.plist", "Info.plist", "Bundle Resources 参考", "Bundle Resources reference", "https://developer.apple.com/documentation/bundleresources/information_property_list"],
    ["HIG", "HIG", "Human Interface Guidelines", "Human Interface Guidelines", "https://developer.apple.com/design/human-interface-guidelines"],
    ["Device Specs", "Device Specs", "App Store Connect 设备兼容性", "Device compatibility", "https://developer.apple.com/help/app-store-connect/reference/device-compatibility/"],
  ];

  var SECTION_DOCS = {
    versions: [0],
    swiftui: [1],
    swift: [2],
    uikit: [3],
    xcode: [4],
    plist: [5],
    hig: [6],
    devices: [7],
  };

  var activeTab = "versions";

  function init(parent) {
    parent.innerHTML =
      '<div class="android-tool">' +
      '  <div class="platform-version-note"><strong>' + t("ios.versionBaseline") + '</strong><span>' + t("ios.versionNote") + '</span></div>' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-itab="versions">' + t("ios.versions") + '</button>' +
      '    <button class="b64-tab" data-itab="swiftui">' + t("ios.swiftui") + '</button>' +
      '    <button class="b64-tab" data-itab="swift">' + t("ios.swift") + '</button>' +
      '    <button class="b64-tab" data-itab="uikit">' + t("ios.uikit") + '</button>' +
      '    <button class="b64-tab" data-itab="xcode">' + t("ios.xcode") + '</button>' +
      '    <button class="b64-tab" data-itab="plist">' + t("ios.plist") + '</button>' +
      '    <button class="b64-tab" data-itab="hig">' + t("ios.hig") + '</button>' +
      '    <button class="b64-tab" data-itab="devices">' + t("ios.devices") + '</button>' +
      '  </div>' +
      '  <div id="itab-versions" class="android-section">' + buildVersionsTab() + '</div>' +
      '  <div id="itab-swiftui" class="android-section hidden">' + buildSwiftUITab() + '</div>' +
      '  <div id="itab-swift" class="android-section hidden">' + buildSwiftTab() + '</div>' +
      '  <div id="itab-uikit" class="android-section hidden">' + buildUIKitTab() + '</div>' +
      '  <div id="itab-xcode" class="android-section hidden">' + buildXcodeTab() + '</div>' +
      '  <div id="itab-plist" class="android-section hidden">' + buildPlistTab() + '</div>' +
      '  <div id="itab-hig" class="android-section hidden">' + buildHigTab() + '</div>' +
      '  <div id="itab-devices" class="android-section hidden">' + buildDevicesTab() + '</div>' +
      '</div>';

    document.querySelectorAll(".b64-tab[data-itab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchITab(this.dataset.itab); });
    });

    parent.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        showCopyToast("✓ " + t("ios.copied"));
      });
    });

    bindEvents();
    var requestedTab = { swiftui: "swiftui", uikit: "uikit", "info-plist": "plist", xcode: "xcode" }[window.__toolSubpage];
    if (requestedTab) switchITab(requestedTab);
  }

  function switchITab(name) {
    document.querySelectorAll(".b64-tab[data-itab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.itab === name ? " active" : "");
    });
    document.querySelectorAll("#itab-" + name).forEach(function (s) { s.classList.remove("hidden"); });
    document.querySelectorAll(".android-section:not(#itab-" + name + ")").forEach(function (s) { s.classList.add("hidden"); });
  }

  function buildVersionsTab() {
    var h = buildDocRefs("versions") + '<div class="at-search-wrap"><input id="it-search-versions" class="search-input" type="text" placeholder="' + t("ios.searchVersions") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>iOS</th><th>' + t("ios.codename") + '</th><th>' + t("ios.year") + '</th></tr></thead><tbody>';
    IOS_VERSIONS.forEach(function (r) {
      var codeName = r.name && r.zh ? r.name + "（" + r.zh + "）" : (r.name || r.zh || "—");
      h += '<tr data-search="' + [r.ver, r.name, r.zh].join(" ").toLowerCase() + '"><td><code>' + r.ver + '</code></td><td>' + codeName + '</td><td>' + r.year + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildSwiftUITab() {
    var h = buildDocRefs("swiftui") + '<div class="at-search-wrap"><input id="it-search-swiftui" class="search-input" type="text" placeholder="' + t("ios.searchSwiftUI") + '"></div>';
    h += '<h3 style="margin:16px 0 8px;font-size:0.9rem;color:var(--text-muted)">' + t("ios.views") + '</h3>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.name") + '</th><th>' + t("ios.description") + '</th><th>' + t("ios.example") + '</th></tr></thead><tbody>';
    SWIFTUI_VIEWS.forEach(function (r) {
      var name = currentLang() === "en" ? r[0] : r[1];
      h += '<tr data-search="' + escapeHtml(r.join(" ").toLowerCase()) + '" data-cat="' + r[4] + '"><td>' + name + '<small class="api-version">' + minimumIosVersion(r[0]) + '</small></td><td>' + r[3] + '</td><td data-copy="' + escapeHtml(r[5]) + '"><code class="ft-example-code">' + escapeHtml(r[5]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3 style="margin:20px 0 8px;font-size:0.9rem;color:var(--text-muted)">' + t("ios.propertyWrappers") + '</h3>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.name") + '</th><th>' + t("ios.description") + '</th><th>' + t("ios.example") + '</th></tr></thead><tbody>';
    SWIFTUI_PROPS.forEach(function (r) {
      var name = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td>' + name + '</td><td>' + r[4] + '</td><td><code>' + escapeHtml(r[3]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildSwiftTab() {
    var h = buildDocRefs("swift") + '<div class="platform-topic-note"><strong>' + t("ios.modernSwiftTitle") + '</strong> ' + t("ios.modernSwiftNote") + '</div><div class="at-search-wrap"><input id="it-search-swift" class="search-input" type="text" placeholder="' + t("ios.searchSwift") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.feature") + '</th><th>' + t("ios.name") + '</th><th>' + t("ios.example") + '</th><th>' + t("ios.note") + '</th></tr></thead><tbody>';
    SWIFT_SNIPPETS.forEach(function (r) {
      var feature = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[3]) + '"><td>' + feature + '</td><td><code>' + escapeHtml(r[3]) + '</code></td><td><code>' + escapeHtml(r[4]) + '</code></td><td>' + r[5] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildUIKitTab() {
    var h = buildDocRefs("uikit") + '<div class="at-search-wrap"><input id="it-search-uikit" class="search-input" type="text" placeholder="' + t("ios.searchUIKit") + '"></div>';
    h += '<h3 style="margin:16px 0 8px;font-size:0.9rem;color:var(--text-muted)">' + t("ios.classes") + '</h3>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.name") + '</th><th>' + t("ios.description") + '</th><th>Class</th></tr></thead><tbody>';
    UIKIT_CLASSES.forEach(function (r) {
      var name = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td>' + name + '<small class="api-version">iOS 2+</small></td><td>' + r[3] + '</td><td><code>' + r[0] + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3 style="margin:20px 0 8px;font-size:0.9rem;color:var(--text-muted)">' + t("ios.autolayout") + '</h3>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.scenario") + '</th><th>' + t("ios.command") + '</th></tr></thead><tbody>';
    AUTOLAYOUT_SNIPPETS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2]) + '"><td>' + scenario + '</td><td><code>' + escapeHtml(r[2]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildXcodeTab() {
    var h = buildDocRefs("xcode") + '<div class="at-search-wrap"><input id="it-search-xcode" class="search-input" type="text" placeholder="' + t("ios.searchXcode") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.scenario") + '</th><th>' + t("ios.shortcut") + '</th><th>' + t("ios.note") + '</th></tr></thead><tbody>';
    XCODE_COMMANDS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2]) + '"><td>' + scenario + '</td><td><code>' + escapeHtml(r[2]) + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildPlistTab() {
    var h = buildDocRefs("plist") + '<div class="platform-topic-note"><strong>' + t("ios.reviewGuidanceTitle") + '</strong> ' + t("ios.reviewGuidanceNote") + '</div><div class="at-search-wrap"><input id="it-search-plist" class="search-input" type="text" placeholder="' + t("ios.searchPlist") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Key</th><th>' + t("ios.description") + '</th><th>' + t("ios.note") + '</th></tr></thead><tbody>';
    PLIST_KEYS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildHigTab() {
    var h = buildDocRefs("hig") + '<div class="at-search-wrap"><input id="it-search-hig" class="search-input" type="text" placeholder="' + t("ios.searchHig") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.guideline") + '</th><th>' + t("ios.value") + '</th><th>' + t("ios.note") + '</th></tr></thead><tbody>';
    HIG_GUIDELINES.forEach(function (r) {
      var guideline = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2]) + '"><td>' + guideline + '</td><td><code>' + escapeHtml(r[2]) + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildDevicesTab() {
    var h = buildDocRefs("devices") + '<div class="platform-topic-note">' + t("ios.deviceSourceNote") + '</div><div class="at-search-wrap"><input id="it-search-devices" class="search-input" type="text" placeholder="' + t("ios.searchDevices") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("ios.device") + '</th><th>' + t("ios.size") + '</th><th>' + t("ios.resolution") + '</th><th>' + t("ios.scale") + '</th><th>PPI</th><th>Chip</th><th>RAM</th></tr></thead><tbody>';
    DEVICE_SPECS.forEach(function (r) {
      h += '<tr data-search="' + [r.name, r.chip, r.size].join(" ").toLowerCase() + '"><td>' + r.name + '</td><td>' + r.size + '</td><td>' + r.res + '</td><td><code>' + r.scale + '</code></td><td>' + r.ppi + '</td><td>' + r.chip + '</td><td>' + r.ram + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildDocRefs(section) {
    var indexes = SECTION_DOCS[section] || [];
    if (!indexes.length) return "";
    var h = '<div class="at-doc-refs"><span>' + t("ios.relatedDocs") + '</span>';
    indexes.forEach(function (idx) {
      var r = DOC_LINKS[idx];
      var label = currentLang() === "en" ? r[1] : r[0];
      h += '<a href="' + r[4] + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    h += '</div>';
    return h;
  }

  function currentLang() {
    return (window.__locale && window.__locale.menu && window.__locale.menu.home === "首页") ? "zh" : "en";
  }

  function minimumIosVersion(name) { var versions = { AsyncImage: "iOS 15+", ShareLink: "iOS 16+", ContentUnavailableView: "iOS 17+", NavigationStack: "iOS 16+", Grid: "iOS 16+" }; return versions[name] || "iOS 13+"; }

  function bindEvents() {
    bindSearch("it-search-versions", "#itab-versions tbody tr", defaultFilter);
    bindSearch("it-search-swiftui", "#itab-swiftui tbody tr", defaultFilter);
    bindSearch("it-search-swift", "#itab-swift tbody tr", defaultFilter);
    bindSearch("it-search-uikit", "#itab-uikit tbody tr", defaultFilter);
    bindSearch("it-search-xcode", "#itab-xcode tbody tr", defaultFilter);
    bindSearch("it-search-plist", "#itab-plist tbody tr", defaultFilter);
    bindSearch("it-search-hig", "#itab-hig tbody tr", defaultFilter);
    bindSearch("it-search-devices", "#itab-devices tbody tr", defaultFilter);
  }

  function defaultFilter(tr, q) {
    tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
  }

  function bindSearch(inputId, rowSelector, filterFn) {
    var input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", function () {
      var q = this.value.toLowerCase();
      document.querySelectorAll(rowSelector).forEach(function (tr) { filterFn(tr, q); });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  return { init: init };
})();
