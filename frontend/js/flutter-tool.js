// Flutter Tool — Widgets, CLI, Packages, Layout, Theming, Navigation, State, Responsive
var FlutterTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  // ═══ Common Widgets ═══ — [enName, zhName, api, description, category, example]
  var WIDGETS = [
    ["Container", "容器", "Container", "Box with padding, margin, decoration", "layout", "Container(padding: EdgeInsets.all(16), margin: EdgeInsets.symmetric(horizontal: 8), decoration: BoxDecoration(color: Colors.blue, borderRadius: BorderRadius.circular(12)), child: Text('Hello'))"],
    ["Row", "行布局", "Row", "Horizontal array of children", "layout", "Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Icon(Icons.star), Text('Title'), Icon(Icons.more)])"],
    ["Column", "列布局", "Column", "Vertical array of children", "layout", "Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Title'), SizedBox(height: 8), Text('Subtitle')])"],
    ["Stack", "层叠布局", "Stack", "Overlay children on top of each other", "layout", "Stack(children: [Image.asset('bg.jpg'), Positioned(bottom: 16, right: 16, child: Text('Overlay'))])"],
    ["Expanded", "弹性扩展", "Expanded", "Fill available space in Row/Column", "layout", "Row(children: [Expanded(flex: 2, child: Container(color: Colors.red)), Expanded(flex: 1, child: Container(color: Colors.blue))])"],
    ["Flexible", "弹性空间", "Flexible", "Similar to Expanded with flex fit control", "layout", "Row(children: [Flexible(fit: FlexFit.loose, child: Text('Wraps content but can shrink'))])"],
    ["SizedBox", "固定尺寸", "SizedBox", "Fixed width/height box or spacing", "layout", "SizedBox(height: 16) // vertical spacing\nSizedBox(width: 200, height: 100, child: Card(...))"],
    ["Wrap", "自动换行", "Wrap", "Wraps children to next line when overflowing", "layout", "Wrap(spacing: 8, runSpacing: 4, children: tags.map((t) => Chip(label: Text(t))).toList())"],
    ["Align", "对齐", "Align", "Align a child within itself", "layout", "Align(alignment: Alignment.topRight, child: Text('Top Right'))"],
    ["Center", "居中", "Center", "Center child (Align subclass)", "layout", "Center(child: CircularProgressIndicator())"],
    ["Padding", "内边距", "Padding", "Add padding around child", "layout", "Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 8), child: Text('Padded'))"],
    ["AspectRatio", "宽高比", "AspectRatio", "Constrain child to a specific aspect ratio", "layout", "AspectRatio(aspectRatio: 16 / 9, child: Container(color: Colors.grey))"],
    ["ConstrainedBox", "约束盒", "ConstrainedBox", "Impose min/max constraints on child", "layout", "ConstrainedBox(constraints: BoxConstraints(maxWidth: 300, minHeight: 100), child: Text('Constrained'))"],
    ["FittedBox", "自适应盒", "FittedBox", "Scale child to fit within constraints", "layout", "FittedBox(fit: BoxFit.contain, child: Text('This text scales down to fit one line'))"],
    ["Text", "文本", "Text", "Display styled text", "display", "Text('Hello World', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.blue))"],
    ["RichText", "富文本", "RichText", "Text with multiple styles via TextSpan", "display", "RichText(text: TextSpan(style: DefaultTextStyle.of(context).style, children: [TextSpan(text: 'Bold', style: TextStyle(fontWeight: FontWeight.bold)), TextSpan(text: ' normal')]))"],
    ["Icon", "图标", "Icon", "Material icon glyph", "display", "Icon(Icons.star, color: Colors.amber, size: 28)"],
    ["Image", "图片", "Image", "Display image from asset, network, file", "display", "Image.network('https://example.com/img.jpg', width: 200, fit: BoxFit.cover)"],
    ["CircleAvatar", "圆形头像", "CircleAvatar", "Circular image often used for profile", "display", "CircleAvatar(radius: 30, backgroundImage: NetworkImage(url), child: Text('AB'))"],
    ["ClipRRect", "圆角裁剪", "ClipRRect", "Clip child with rounded corners", "display", "ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.asset('photo.jpg'))"],
    ["DecoratedBox", "装饰盒", "DecoratedBox", "Paint a decoration on child", "display", "DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [Colors.blue, Colors.purple]), borderRadius: BorderRadius.circular(8)), child: Padding(padding: EdgeInsets.all(16), child: Text('Gradient')))"],
    ["Opacity", "透明度", "Opacity", "Make child partially transparent", "display", "Opacity(opacity: 0.5, child: Text('Half transparent'))"],
    ["Transform", "变换", "Transform", "Apply matrix transform", "display", "Transform.rotate(angle: pi / 4, child: Text('Rotated 45°'))"],
    ["ListView", "列表", "ListView", "Scrollable linear list of widgets", "scroll", "ListView.builder(itemCount: items.length, itemBuilder: (ctx, i) => ListTile(title: Text(items[i].name)))"],
    ["GridView", "网格", "GridView", "Scrollable 2D grid of widgets", "scroll", "GridView.builder(gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3), itemBuilder: (ctx, i) => Card(child: Center(child: Text('$i'))))"],
    ["SingleChildScrollView", "单子滚动", "SingleChildScrollView", "Scroll a single large child", "scroll", "SingleChildScrollView(child: Column(children: [/* many widgets */]))"],
    ["PageView", "页面视图", "PageView", "Swipeable pages", "scroll", "PageView(children: [OnboardingPage1(), OnboardingPage2(), OnboardingPage3()])"],
    ["SliverList", "Sliver 列表", "SliverList", "Scrollable list inside CustomScrollView", "scroll", "CustomScrollView(slivers: [SliverAppBar(title: Text('Title')), SliverList(delegate: SliverChildBuilderDelegate((ctx, i) => ListTile(title: Text('Item $i'))))])"],
    ["SliverAppBar", "Sliver 顶栏", "SliverAppBar", "Collapsible app bar", "scroll", "SliverAppBar(expandedHeight: 200, flexibleSpace: FlexibleSpaceBar(title: Text('Collapse Me'), background: Image.asset('header.jpg')))"],
    ["TextField", "文本输入", "TextField", "Material text input field", "input", "TextField(decoration: InputDecoration(labelText: 'Email', hintText: 'user@example.com', prefixIcon: Icon(Icons.email)), onChanged: (v) => email = v)"],
    ["TextFormField", "表单输入", "TextFormField", "TextField with Form validation", "input", "TextFormField(validator: (v) => v!.isEmpty ? 'Required' : null, decoration: InputDecoration(labelText: 'Name'))"],
    ["ElevatedButton", "凸起按钮", "ElevatedButton", "Material elevated button", "input", "ElevatedButton(onPressed: () => submit(), style: ElevatedButton.styleFrom(backgroundColor: Colors.blue), child: Text('Submit'))"],
    ["OutlinedButton", "描边按钮", "OutlinedButton", "Material outlined button", "input", "OutlinedButton(onPressed: () => cancel(), child: Text('Cancel'))"],
    ["TextButton", "文字按钮", "TextButton", "Material text-only button", "input", "TextButton(onPressed: () => showMore(), child: Text('See More'))"],
    ["IconButton", "图标按钮", "IconButton", "Icon-only button", "input", "IconButton(icon: Icon(Icons.delete), color: Colors.red, onPressed: () => remove())"],
    ["FloatingActionButton", "悬浮按钮", "FloatingActionButton", "Circular FAB", "input", "FloatingActionButton(onPressed: () => addItem(), child: Icon(Icons.add))"],
    ["InkWell", "水波纹", "InkWell", "Material ink splash on tap", "input", "InkWell(onTap: () => navigate(), borderRadius: BorderRadius.circular(8), child: Padding(padding: EdgeInsets.all(12), child: Text('Tap me')))"],
    ["GestureDetector", "手势检测", "GestureDetector", "Detect taps, drags, scales", "input", "GestureDetector(onTap: () => print('tapped'), onDoubleTap: () => zoom(), onLongPress: () => showMenu(), child: Container(color: Colors.transparent, child: Text('Gesture area')))"],
    ["Dismissible", "滑动删除", "Dismissible", "Swipe-to-dismiss list items", "input", "Dismissible(key: Key(item.id), onDismissed: (_) => delete(item), background: Container(color: Colors.red), child: ListTile(title: Text(item.name)))"],
    ["Checkbox", "复选框", "Checkbox", "Material checkbox", "input", "Checkbox(value: isChecked, onChanged: (v) => setState(() => isChecked = v!))"],
    ["Switch", "开关", "Switch", "Material on/off toggle", "input", "Switch(value: isOn, onChanged: (v) => setState(() => isOn = v))"],
    ["Slider", "滑块", "Slider", "Select a value from a range", "input", "Slider(value: volume, min: 0, max: 100, divisions: 10, label: '$volume%', onChanged: (v) => setState(() => volume = v))"],
    ["DropdownButton", "下拉按钮", "DropdownButton", "Select from a list of options", "input", "DropdownButton<String>(value: selected, items: options.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(), onChanged: (v) => setState(() => selected = v!))"],
    ["PopupMenuButton", "弹出菜单", "PopupMenuButton", "Show a popup menu on tap", "input", "PopupMenuButton<String>(onSelected: (v) => handle(v), itemBuilder: (ctx) => [PopupMenuItem(value: 'edit', child: Text('Edit')), PopupMenuItem(value: 'delete', child: Text('Delete'))])"],
    ["SnackBar", "提示条", "SnackBar", "Brief message at screen bottom", "feedback", "ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved!'), action: SnackBarAction(label: 'Undo', onPressed: () => undo())))"],
    ["AlertDialog", "弹窗", "AlertDialog", "Material dialog", "feedback", "showDialog(context: context, builder: (_) => AlertDialog(title: Text('Confirm'), content: Text('Are you sure?'), actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text('Cancel')), ElevatedButton(onPressed: () => confirm(), child: Text('OK'))]))"],
    ["BottomSheet", "底部抽屉", "BottomSheet", "Panel sliding up from bottom", "feedback", "showModalBottomSheet(context: context, builder: (_) => Padding(padding: EdgeInsets.all(16), child: Column(mainAxisSize: MainAxisSize.min, children: [Text('Options'), ListTile(title: Text('Share'), leading: Icon(Icons.share)), ListTile(title: Text('Delete'), leading: Icon(Icons.delete))])))"],
    ["LinearProgressIndicator", "线性进度", "LinearProgressIndicator", "Horizontal progress bar", "feedback", "LinearProgressIndicator(value: progress, backgroundColor: Colors.grey[200], color: Colors.blue)"],
    ["CircularProgressIndicator", "圆形进度", "CircularProgressIndicator", "Spinning progress indicator", "feedback", "CircularProgressIndicator(color: Colors.blue, strokeWidth: 3)"],
    ["Chip", "标签", "Chip", "Compact element", "feedback", "Chip(avatar: CircleAvatar(child: Text('A')), label: Text('Tag'), deleteIcon: Icon(Icons.close), onDeleted: () => removeTag())"],
    ["FutureBuilder", "Future 构建", "FutureBuilder", "Build UI based on Future snapshot", "async", "FutureBuilder<List<Item>>(future: fetchItems(), builder: (ctx, snap) => snap.hasData ? ListView(children: snap.data!.map((i) => ListTile(title: Text(i.name))).toList()) : CircularProgressIndicator())"],
    ["StreamBuilder", "Stream 构建", "StreamBuilder", "Build UI based on Stream snapshot", "async", "StreamBuilder<int>(stream: counterStream, builder: (ctx, snap) => Text('Count: ${snap.data ?? 0}'))"],
    ["Scaffold", "脚手架", "Scaffold", "Page shell", "structure", "Scaffold(appBar: AppBar(title: Text('Page')), body: Center(child: Text('Content')), floatingActionButton: FloatingActionButton(onPressed: () {}, child: Icon(Icons.add)), bottomNavigationBar: BottomNavigationBar(items: [...])"],
    ["AppBar", "顶栏", "AppBar", "Material top app bar", "structure", "AppBar(title: Text('Title'), actions: [IconButton(icon: Icon(Icons.search), onPressed: () {})])"],
    ["Drawer", "侧边栏", "Drawer", "Slide-in navigation panel", "structure", "Scaffold(drawer: Drawer(child: ListView(children: [DrawerHeader(child: Text('Menu')), ListTile(title: Text('Settings'), onTap: () {})])))"],
    ["BottomNavigationBar", "底部导航", "BottomNavigationBar", "Bottom tab navigation", "structure", "BottomNavigationBar(currentIndex: _index, onTap: (i) => setState(() => _index = i), items: [BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'), BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings')])"],
    ["TabBar", "标签栏", "TabBar", "Horizontal tab row with TabBarView", "structure", "DefaultTabController(length: 3, child: Column(children: [TabBar(tabs: [Tab(text: 'Chats'), Tab(text: 'Status'), Tab(text: 'Calls')]), Expanded(child: TabBarView(children: [ChatsPage(), StatusPage(), CallsPage()]))]))"],
    ["Card", "卡片", "Card", "Material card with rounded corners", "structure", "Card(elevation: 2, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), child: Padding(padding: EdgeInsets.all(16), child: Column(children: [Text('Title', style: Theme.of(context).textTheme.titleLarge), Text('Description')])))"],
    ["ListTile", "列表项", "ListTile", "Single fixed-height row", "structure", "ListTile(leading: CircleAvatar(child: Text('A')), title: Text('Title'), subtitle: Text('Subtitle'), trailing: Icon(Icons.chevron_right), onTap: () => navigate())"],
    ["Divider", "分割线", "Divider", "Horizontal line separator", "structure", "Divider(height: 1, color: Colors.grey[300])"],
  ];

  // ═══ Reference Docs ═══
  var DOC_LINKS = [
    ["Flutter Widgets", "Flutter Widgets", "Widget 目录和 API", "Widget catalog and API reference", "https://docs.flutter.dev/ui/widgets"],
    ["Flutter CLI", "Flutter CLI", "命令行工具参考", "CLI tool reference", "https://docs.flutter.dev/reference/flutter-cli"],
    ["pub.dev", "pub.dev", "Dart/Flutter 包仓库", "Dart/Flutter package repository", "https://pub.dev"],
    ["Theming", "Theming", "主题和 Material Design", "Themes and Material Design", "https://docs.flutter.dev/cookbook/design/themes"],
    ["Navigation", "Navigation", "导航和路由", "Navigation and routing", "https://docs.flutter.dev/ui/navigation"],
    ["State Mgmt", "State Mgmt", "状态管理概览", "State management overview", "https://docs.flutter.dev/data-and-backend/state-mgmt"],
    ["Responsive", "Responsive", "自适应和响应式布局", "Adaptive & responsive design", "https://docs.flutter.dev/ui/layout/adaptive-responsive"],
    ["Flutter Docs", "Flutter Docs", "Flutter 官方文档首页", "Flutter official documentation", "https://docs.flutter.dev"],
  ];

  var SECTION_DOCS = {
    widgets: [0],
    cli: [1],
    packages: [2],
    theme: [3],
    nav: [4],
    state: [5],
    responsive: [6],
    androidConfig: [7],
    iosConfig: [7],
  };

  var WIDGET_CATEGORIES = [
    ["all", "全部", "All"],
    ["layout", "布局", "Layout"],
    ["display", "显示", "Display"],
    ["scroll", "滚动", "Scroll"],
    ["input", "输入与交互", "Input & Interaction"],
    ["feedback", "反馈", "Feedback"],
    ["async", "异步", "Async"],
    ["structure", "结构", "Structure"],
  ];

  // ═══ CLI Commands ═══
  var CLI_COMMANDS = [
    ["创建项目", "Create project", "flutter create my_app", "在当前目录创建新 Flutter 项目"],
    ["创建项目(平台)", "Create with platforms", "flutter create --platforms ios,android my_app", "指定目标平台，默认全平台"],
    ["运行应用", "Run app", "flutter run", "在已连接的设备上运行，-d 指定设备"],
    ["热重载", "Hot reload", "r (在运行终端中按 r)", "热重载保留状态"],
    ["热重启", "Hot restart", "R (在运行终端中按 R)", "热重启丢弃状态"],
    ["查看设备", "List devices", "flutter devices", "列出已连接设备"],
    ["模拟器列表", "List emulators", "flutter emulators", "列出可用模拟器"],
    ["启动模拟器", "Launch emulator", "flutter emulators --launch Pixel_8", "启动指定模拟器"],
    ["构建 APK", "Build APK", "flutter build apk --release", "生成 release APK"],
    ["构建 AppBundle", "Build app bundle", "flutter build appbundle --release", "Google Play 上架使用"],
    ["构建 IPA", "Build iOS", "flutter build ipa --release", "iOS App Store 上架（需 macOS）"],
    ["构建 Web", "Build web", "flutter build web", "生成 web/ 构建产物"],
    ["分析代码", "Analyze", "flutter analyze", "Dart 静态分析，检查错误和警告"],
    ["格式化代码", "Format code", "dart format lib/", "格式化 Dart 代码"],
    ["运行测试", "Run tests", "flutter test", "运行项目中的测试"],
    ["查看依赖", "List deps", "flutter pub deps", "查看依赖树"],
    ["添加依赖", "Add package", "flutter pub add http", "添加 pub.dev 包"],
    ["升级依赖", "Upgrade packages", "flutter pub upgrade", "升级到兼容的最新版本"],
    ["降级依赖", "Downgrade packages", "flutter pub downgrade", "降到最低兼容版本"],
    ["清理构建", "Clean", "flutter clean", "删除 build/ 和 .dart_tool/"],
    ["查看医生", "Doctor", "flutter doctor", "检查 Flutter 环境配置"],
    ["查看频道", "Channel list", "flutter channel", "查看 Flutter SDK 频道（stable/beta/master）"],
    ["切换频道", "Switch channel", "flutter channel stable", "切换到稳定版"],
    ["升级 SDK", "Upgrade SDK", "flutter upgrade", "升级 Flutter SDK"],
    ["生成国际化", "Gen l10n", "flutter gen-l10n", "从 .arb 文件生成本地化代码"],
    ["生成代码", "Build runner", "dart run build_runner build", "运行代码生成器（freezed, json_serializable 等）"],
    ["Web 调试端口", "Web debug port", "flutter run -d chrome --web-port 8080", "指定 Web 调试端口"],
    ["性能分析", "Profile mode", "flutter run --profile", "性能分析模式（接近 release 性能）"],
  ];

  // ═══ Popular Packages ═══
  var PACKAGES = [
    ["http", "网络请求", "HTTP client", "pub.dev/packages/http", "Dart 官方 HTTP 客户端", "core"],
    ["dio", "网络请求", "HTTP client (advanced)", "pub.dev/packages/dio", "拦截器、FormData、超时", "core"],
    ["provider", "状态管理", "State management", "pub.dev/packages/provider", "InheritedWidget 封装，官方推荐", "state"],
    ["riverpod", "状态管理", "State management", "pub.dev/packages/riverpod", "Provider 的改进版，编译安全", "state"],
    ["flutter_bloc", "状态管理", "State management", "pub.dev/packages/flutter_bloc", "BLoC 模式，事件驱动", "state"],
    ["get", "状态管理/路由", "State + nav + DI", "pub.dev/packages/get", "状态、路由、依赖注入一体化", "state"],
    ["go_router", "路由", "Declarative routing", "pub.dev/packages/go_router", "Flutter 官方推荐路由方案", "nav"],
    ["auto_route", "路由", "Code-gen routing", "pub.dev/packages/auto_route", "代码生成路由，类型安全", "nav"],
    ["shared_preferences", "本地存储", "KV storage", "pub.dev/packages/shared_preferences", "简单键值对持久化", "storage"],
    ["hive", "本地存储", "NoSQL storage", "pub.dev/packages/hive", "纯 Dart 的高性能本地数据库", "storage"],
    ["sqflite", "本地存储", "SQLite", "pub.dev/packages/sqflite", "SQLite 数据库", "storage"],
    ["drift", "本地存储", "SQLite ORM", "pub.dev/packages/drift", "类型安全的 SQLite ORM（原 moor）", "storage"],
    ["floor", "本地存储", "SQLite ORM", "pub.dev/packages/floor", "Room 风格的 SQLite ORM", "storage"],
    ["flutter_secure_storage", "安全存储", "Secure storage", "pub.dev/packages/flutter_secure_storage", "Keychain/Keystore 加密存储", "storage"],
    ["cached_network_image", "图片", "Image caching", "pub.dev/packages/cached_network_image", "网络图片缓存与占位图", "ui"],
    ["flutter_svg", "图片", "SVG rendering", "pub.dev/packages/flutter_svg", "渲染 SVG 文件", "ui"],
    ["lottie", "动画", "Lottie animations", "pub.dev/packages/lottie", "播放 After Effects 动画", "ui"],
    ["shimmer", "动画", "Shimmer effect", "pub.dev/packages/shimmer", "闪光骨架屏效果", "ui"],
    ["intl", "国际化", "i18n formatting", "pub.dev/packages/intl", "日期、数字、货币格式化", "util"],
    ["freezed", "代码生成", "Immutable models", "pub.dev/packages/freezed", "不可变数据类 + JSON 序列化", "util"],
    ["json_annotation", "代码生成", "JSON serialization", "pub.dev/packages/json_annotation", "与 json_serializable 配合", "util"],
    ["equatable", "工具", "Value equality", "pub.dev/packages/equatable", "简化 Dart 对象相等性比较", "util"],
    ["url_launcher", "平台交互", "URL launcher", "pub.dev/packages/url_launcher", "打开浏览器、电话、短信、邮件", "platform"],
    ["image_picker", "平台交互", "Image picker", "pub.dev/packages/image_picker", "从相册或相机选取图片/视频", "platform"],
    ["permission_handler", "平台交互", "Permissions", "pub.dev/packages/permission_handler", "运行时权限请求与检查", "platform"],
    ["path_provider", "平台交互", "File paths", "pub.dev/packages/path_provider", "获取常用目录路径", "platform"],
    ["firebase_core", "Firebase", "Firebase core", "pub.dev/packages/firebase_core", "Firebase 基础库（必需）", "firebase"],
    ["cloud_firestore", "Firebase", "Firestore", "pub.dev/packages/cloud_firestore", "Firebase 实时 NoSQL 数据库", "firebase"],
    ["firebase_auth", "Firebase", "Auth", "pub.dev/packages/firebase_auth", "Firebase 身份认证", "firebase"],
    ["firebase_messaging", "Firebase", "FCM", "pub.dev/packages/firebase_messaging", "Firebase Cloud Messaging", "firebase"],
  ];

  var PACKAGE_CATEGORIES = [
    ["all", "全部", "All"],
    ["core", "基础", "Core"],
    ["state", "状态管理", "State"],
    ["nav", "路由导航", "Navigation"],
    ["storage", "本地存储", "Storage"],
    ["ui", "UI / 图片 / 动画", "UI / Images / Anim"],
    ["util", "工具 / 代码生成", "Utils / Code Gen"],
    ["platform", "平台交互", "Platform"],
    ["firebase", "Firebase", "Firebase"],
  ];

  // ═══ Theming ═══
  var THEME_PROPS = [
    ["primaryColor", "主色", "Primary color", "Color(0xFF6750A4)"],
    ["colorScheme", "配色方案", "Color scheme", "ColorScheme.fromSeed(Colors.blue)"],
    ["scaffoldBackgroundColor", "页面背景", "Scaffold bg", "Colors.grey[50]"],
    ["appBarTheme", "顶栏主题", "AppBar theme", "AppBarTheme(centerTitle: true, elevation: 0)"],
    ["textTheme", "文字主题", "Text theme", "Theme.of(context).textTheme"],
    ["elevatedButtonTheme", "按钮主题", "Button theme", "ElevatedButtonThemeData(style: ElevatedButton.styleFrom(...))"],
    ["inputDecorationTheme", "输入框主题", "Input theme", "InputDecorationTheme(border: OutlineInputBorder(...))"],
    ["cardTheme", "卡片主题", "Card theme", "CardTheme(elevation: 2, shape: RoundedRectangleBorder(...))"],
    ["iconTheme", "图标主题", "Icon theme", "IconThemeData(color: Colors.blue, size: 24)"],
    ["bottomNavigationBarTheme", "底部导航主题", "Bottom nav theme", "BottomNavigationBarThemeData(selectedItemColor: Colors.blue)"],
    ["switchTheme", "开关主题", "Switch theme", "SwitchThemeData(thumbColor: ...)"],
    ["checkboxTheme", "复选框主题", "Checkbox theme", "CheckboxThemeData(fillColor: ...)"],
    ["dialogTheme", "对话框主题", "Dialog theme", "DialogTheme(shape: RoundedRectangleBorder(...))"],
    ["fontFamily", "字体", "Font family", "\"Roboto\""],
    ["useMaterial3", "Material 3", "Use Material 3", "useMaterial3: true"],
  ];

  var DARK_THEME_SNIPPET =
    'ThemeData(\n' +
    '  brightness: Brightness.dark,\n' +
    '  colorSchemeSeed: Colors.blue,\n' +
    '  useMaterial3: true,\n' +
    ')';

  var LIGHT_THEME_SNIPPET =
    'ThemeData(\n' +
    '  brightness: Brightness.light,\n' +
    '  colorSchemeSeed: Colors.blue,\n' +
    '  useMaterial3: true,\n' +
    ')';

  // ═══ Navigation ═══
  var NAV_SNIPPETS = [
    ["普通跳转", "Basic push", "Navigator.push(context, MaterialPageRoute(builder: (_) => NextPage()));", "跳转到新页面，可返回"],
    ["返回", "Pop", "Navigator.pop(context);", "返回上一页"],
    ["带结果返回", "Pop with result", "Navigator.pop(context, \"result\");", "返回并传递数据"],
    ["替换当前页", "Push replacement", "Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => HomePage()));", "替换当前路由"],
    ["清除栈跳转", "Push and remove until", "Navigator.pushAndRemoveUntil(context, MaterialPageRoute(builder: (_) => HomePage()), (_) => false);", "清空所有历史路由"],
    ["命名路由跳转", "Named route push", "Navigator.pushNamed(context, \"/detail\");", "使用预定义路由名跳转"],
    ["命名路由(带参)", "Named route with args", "Navigator.pushNamed(context, \"/detail\", arguments: {\"id\": 42});", "传递参数给目标页面"],
    ["取路由参数", "Get route args", "final args = ModalRoute.of(context)!.settings.arguments;", "在目标页面获取参数"],
    ["go_router 跳转", "go_router push", "context.go(\"/detail/42\");", "声明式跳转"],
    ["go_router 返回", "go_router pop", "context.pop();", "返回"],
    ["go_router 定义", "go_router routes", "GoRouter(routes: [GoRoute(path: \"/\", builder: ...), GoRoute(path: \"/detail/:id\", builder: ...)])", "路由定义"],
    ["go_router 重定向", "go_router redirect", "GoRouter(routes: [...], redirect: (context, state) { ... })", "登录守卫等重定向"],
    ["onGenerateRoute", "onGenerateRoute", "MaterialApp(onGenerateRoute: (settings) { ... })", "动态路由生成"],
    ["未知路由", "Unknown route", "MaterialApp(onUnknownRoute: (settings) => MaterialPageRoute(...))", "404 路由降级"],
  ];

  // ═══ State Management ═══
  var STATE_SOLUTIONS = [
    ["StatefulWidget", "有状态组件", "setState", "轻量页面级状态", "Flutter 内置"],
    ["InheritedWidget", "继承组件", "of(context)", "跨组件共享数据", "Flutter 内置，基础但繁琐"],
    ["Provider", "Provider", "context.watch<Model>()", "ChangeNotifier + InheritedWidget", "官方推荐，适合中小项目"],
    ["Riverpod", "Riverpod", "ref.watch(provider)", "编译安全，支持自动销毁", "Provider 替代，独立于 Widget 树"],
    ["BLoC", "flutter_bloc", "BlocBuilder<Bloc, State>", "事件驱动，Stream 模式", "大型项目"],
    ["Cubit", "flutter_bloc", "BlocBuilder<Cubit, State>", "BLoC 简化版", "中小型 BLoC 场景"],
    ["GetX", "GetX", "Obx(() => ...)", "路由 + 状态 + DI 一体化", "快速开发，社区大但争议多"],
    ["MobX", "mobx", "Observer(builder: ...)", "响应式，Observable/Action", "小型到中型项目"],
    ["Redux", "flutter_redux", "StoreConnector<State, ViewModel>", "单向数据流，纯函数 Reducer", "熟悉 Redux 生态的团队"],
    ["ValueNotifier", "ValueNotifier", "ValueListenableBuilder", "单个值变化通知", "Flutter 内置，简单场景"],
  ];

  // ═══ Responsive ═══
  var RESPONSIVE_SNIPPETS = [
    ["屏幕宽度", "Screen width", "MediaQuery.of(context).size.width", "屏幕逻辑像素宽度"],
    ["屏幕高度", "Screen height", "MediaQuery.of(context).size.height", "屏幕逻辑像素高度"],
    ["设备像素比", "Device pixel ratio", "MediaQuery.of(context).devicePixelRatio", "逻辑像素与物理像素比"],
    ["方向判断", "Orientation", "MediaQuery.of(context).orientation == Orientation.portrait", "竖屏 / 横屏"],
    ["安全区域", "Safe area", "MediaQuery.of(context).padding", "异形屏安全区域"],
    ["LayoutBuilder", "LayoutBuilder", "LayoutBuilder(builder: (context, constraints) { ... })", "根据父组件约束构建 UI"],
    ["断点判断", "Breakpoint", "LayoutBuilder(builder: (context, constraints) {\n  if (constraints.maxWidth < 600) return mobileLayout;\n  if (constraints.maxWidth < 900) return tabletLayout;\n  return desktopLayout;\n})", "600 平板 / 900 桌面"],
    ["OrientationBuilder", "OrientationBuilder", "OrientationBuilder(builder: (context, orientation) { ... })", "横竖屏切换布局"],
    ["FractionallySizedBox", "按比例", "FractionallySizedBox(widthFactor: 0.5)", "按父组件百分比尺寸"],
    ["Flex 布局", "Flex layout", "Row(children: [Expanded(flex: 3, child: left), Expanded(flex: 7, child: right)])", "按比例分配宽度"],
    ["SafeArea", "SafeArea", "SafeArea(child: ...)", "避开状态栏、底部指示条"],
  ];

  // ═══ Flutter Android Config ═══
  var FLUTTER_ANDROID_CONFIG = [
    ["compileSdk", "compileSdk", "编译 SDK 版本", "Build SDK version", "android/app/build.gradle: compileSdk = flutter.compileSdkVersion"],
    ["minSdk", "minSdk", "最低支持 API", "Minimum supported API", "android/app/build.gradle: minSdk = 21 (Flutter 默认)"],
    ["targetSdk", "targetSdk", "适配行为目标 API", "Behavior target API", "android/app/build.gradle: targetSdk = flutter.targetSdkVersion"],
    ["Kotlin 版本", "Kotlin version", "Kotlin 版本", "Kotlin version", "android/settings.gradle: id \"org.jetbrains.kotlin.android\" version \"...\""],
    ["AGP 版本", "AGP version", "AGP 版本", "AGP version", "android/settings.gradle: id \"com.android.application\" version \"...\""],
    ["Gradle 版本", "Gradle version", "Gradle 版本", "Gradle version", "android/gradle/wrapper/gradle-wrapper.properties"],
    ["FlutterActivity", "FlutterActivity", "Android 入口", "Android entry point", "MainActivity.kt: class MainActivity: FlutterActivity()"],
    ["namespace", "namespace", "应用 namespace", "Application namespace", "android/app/build.gradle: namespace = \"com.example.app\""],
    ["applicationId", "applicationId", "应用包名", "App package ID", "android/app/build.gradle: applicationId = \"com.example.app\""],
  ];

  // ═══ Flutter iOS Config ═══
  var FLUTTER_IOS_CONFIG = [
    ["iOS Deployment Target", "deploymentTarget", "iOS 最低部署版本", "Minimum iOS version", "ios/Podfile: platform :ios, '13.0' / Xcode → Runner → Deployment Target"],
    ["Bundle Identifier", "bundleId", "iOS 应用包名", "Bundle identifier", "Xcode → Runner → Signing & Capabilities → Bundle Identifier"],
    ["Display Name", "displayName", "应用显示名称", "App display name", "ios/Runner/Info.plist: CFBundleDisplayName"],
    ["Version", "version", "应用版本号", "Version string", "ios/Runner/Info.plist: CFBundleShortVersionString"],
    ["Build Number", "buildNumber", "构建号", "Build number", "ios/Runner/Info.plist: CFBundleVersion"],
    ["App Icon", "appIcon", "应用图标", "App icon", "ios/Runner/Assets.xcassets/AppIcon.appiconset"],
    ["Launch Screen", "launchScreen", "启动画面", "Launch screen", "ios/Runner/Base.lproj/LaunchScreen.storyboard"],
    ["Swift Version", "swiftVersion", "Swift 版本", "Swift version", "ios/Podfile: config.build_settings['SWIFT_VERSION']"],
    ["CocoaPods", "cocoaPods", "依赖管理", "Dependency manager", "ios/Podfile: 运行 pod install --repo-update 更新 iOS 依赖"],
    ["Pods target", "podTarget", "最低 pod 平台版本", "Min Pod platform version", "ios/Podfile: platform :ios, '13.0' 控制 pod 最低平台"],
    ["Entitlements", "entitlements", "权限与能力配置 (Capability)", "Capabilities & permissions", "Xcode → Runner → Signing & Capabilities → + Capability (Push/HealthKit/...)"],
    ["Info.plist", "infoPlist", "权限描述等 plist 配置", "Info.plist config", "ios/Runner/Info.plist: NSCameraUsageDescription 等权限描述"],
    ["Scheme", "scheme", "编译 Scheme (Debug/Release/Profile)", "Build scheme", "Xcode toolbar → Runner → Edit Scheme → Build Configuration"],
    ["Signing Team", "signingTeam", "签名团队", "Signing team", "Xcode → Runner → Signing & Capabilities → Team"],
    ["Bitcode", "bitcode", "已废弃 (Xcode 14+)", "Deprecated in Xcode 14+", "Xcode → Build Settings → Enable Bitcode → No"],
    ["Flutter.framework", "flutterFramework", "Flutter 引擎嵌入方式", "Engine embedding method", "Xcode → Runner → General → Frameworks: 确保 Flutter.framework 已嵌入"],
    ["App Thinning", "appThinning", "应用瘦身 (Slicing)", "App thinning", "Xcode → Build Settings → Enable Bitcode / App Thinning: 自动为不同设备裁剪二进制"],
  ];

  var activeTab = "widgets";
  var activeWidgetCat = "all";
  var activePackageCat = "all";

  function init(parent) {
    parent.innerHTML =
      '<div class="android-tool">' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-ftab="widgets">' + t("flutter.widgets") + '</button>' +
      '    <button class="b64-tab" data-ftab="cli">' + t("flutter.cli") + '</button>' +
      '    <button class="b64-tab" data-ftab="packages">' + t("flutter.packages") + '</button>' +
      '    <button class="b64-tab" data-ftab="theme">' + t("flutter.theme") + '</button>' +
      '    <button class="b64-tab" data-ftab="nav">' + t("flutter.nav") + '</button>' +
      '    <button class="b64-tab" data-ftab="state">' + t("flutter.state") + '</button>' +
      '    <button class="b64-tab" data-ftab="responsive">' + t("flutter.responsive") + '</button>' +
      '    <button class="b64-tab" data-ftab="androidConfig">' + t("flutter.androidConfig") + '</button>' +
      '    <button class="b64-tab" data-ftab="iosConfig">' + t("flutter.iosConfig") + '</button>' +
      '  </div>' +
      '  <div id="ftab-widgets" class="android-section">' + buildWidgetsTab() + '</div>' +
      '  <div id="ftab-cli" class="android-section hidden">' + buildCliTab() + '</div>' +
      '  <div id="ftab-packages" class="android-section hidden">' + buildPackagesTab() + '</div>' +
      '  <div id="ftab-theme" class="android-section hidden">' + buildThemeTab() + '</div>' +
      '  <div id="ftab-nav" class="android-section hidden">' + buildNavTab() + '</div>' +
      '  <div id="ftab-state" class="android-section hidden">' + buildStateTab() + '</div>' +
      '  <div id="ftab-responsive" class="android-section hidden">' + buildResponsiveTab() + '</div>' +
      '  <div id="ftab-androidConfig" class="android-section hidden">' + buildAndroidConfigTab() + '</div>' +
      '  <div id="ftab-iosConfig" class="android-section hidden">' + buildIosConfigTab() + '</div>' +
      '</div>';

    document.querySelectorAll(".b64-tab[data-ftab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchFTab(this.dataset.ftab); });
    });

    parent.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var el = e.target.closest("[data-copy]");
      if (!el) return;
      navigator.clipboard.writeText(el.dataset.copy).then(function () {
        showCopyToast("✓ " + t("flutter.copied"));
      });
    });

    bindEvents();
  }

  function switchFTab(name) {
    document.querySelectorAll(".b64-tab[data-ftab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.ftab === name ? " active" : "");
    });
    document.querySelectorAll("#ftab-" + name).forEach(function (s) { s.classList.remove("hidden"); });
    document.querySelectorAll(".android-section:not(#ftab-" + name + ")").forEach(function (s) { s.classList.add("hidden"); });
  }

  function buildWidgetsTab() {
    var h = buildDocRefs("widgets") + '<div class="at-search-wrap">';
    h += '<div class="at-cat-bar">';
    WIDGET_CATEGORIES.forEach(function (cat) {
      h += '<button class="ft-cat-filter' + (activeWidgetCat === cat[0] ? ' active' : '') + '" data-wcat="' + cat[0] + '">' + (currentLang() === "en" ? cat[2] : cat[1]) + '</button>';
    });
    h += '</div>';
    h += '<input id="ft-search-widgets" class="search-input" type="text" placeholder="' + t("flutter.searchWidgets") + '" style="margin-top:8px">';
    h += '</div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.widget") + '</th><th>' + t("flutter.description") + '</th><th>' + t("flutter.example") + '</th></tr></thead><tbody>';
    WIDGETS.forEach(function (r) {
      var name = r[0];
      var desc = currentLang() === "en" ? r[3] : r[2];
      h += '<tr data-search="' + [r[0], r[1], r[2], r[3], r[5]].join(" ").toLowerCase() + '" data-cat="' + r[4] + '"><td><code>' + name + '</code></td><td>' + desc + '</td><td data-copy="' + escapeHtml(r[5]) + '"><code class="ft-example-code">' + escapeHtml(r[5]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildCliTab() {
    var h = buildDocRefs("cli") + '<div class="at-search-wrap"><input id="ft-search-cli" class="search-input" type="text" placeholder="' + t("flutter.searchCli") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.scenario") + '</th><th>' + t("flutter.command") + '</th><th>' + t("flutter.note") + '</th></tr></thead><tbody>';
    CLI_COMMANDS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2].replace(" (在运行终端中按 r)", "").replace(" (在运行终端中按 R)", "")) + '"><td>' + scenario + '</td><td><code>' + r[2] + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildPackagesTab() {
    var h = buildDocRefs("packages") + '<div class="at-search-wrap">';
    h += '<div class="at-cat-bar">';
    PACKAGE_CATEGORIES.forEach(function (cat) {
      h += '<button class="ft-cat-filter' + (activePackageCat === cat[0] ? ' active' : '') + '" data-pcat="' + cat[0] + '">' + (currentLang() === "en" ? cat[2] : cat[1]) + '</button>';
    });
    h += '</div>';
    h += '<input id="ft-search-packages" class="search-input" type="text" placeholder="' + t("flutter.searchPackages") + '" style="margin-top:8px">';
    h += '</div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Package</th><th>' + t("flutter.description") + '</th><th>pub.dev</th><th>' + t("flutter.note") + '</th></tr></thead><tbody>';
    PACKAGES.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-cat="' + r[5] + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td><a href="https://' + r[3] + '" target="_blank" rel="noopener noreferrer"><code>' + r[3] + '</code></a></td><td>' + r[4] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildThemeTab() {
    var h = buildDocRefs("theme") + '<div class="at-search-wrap"><input id="ft-search-theme" class="search-input" type="text" placeholder="' + t("flutter.searchTheme") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Property</th><th>' + t("flutter.description") + '</th><th>' + t("flutter.example") + '</th></tr></thead><tbody>';
    THEME_PROPS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td><code>' + escapeHtml(r[3]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    h += '<h3 style="margin:16px 0 8px">' + t("flutter.themeSnippets") + '</h3>';
    h += '<pre class="ft-code-block"><code>' + escapeHtml(DARK_THEME_SNIPPET) + '</code></pre>';
    h += '<pre class="ft-code-block" style="margin-top:8px"><code>' + escapeHtml(LIGHT_THEME_SNIPPET) + '</code></pre>';
    return h;
  }

  function buildNavTab() {
    var h = buildDocRefs("nav") + '<div class="at-search-wrap"><input id="ft-search-nav" class="search-input" type="text" placeholder="' + t("flutter.searchNav") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.scenario") + '</th><th>' + t("flutter.command") + '</th></tr></thead><tbody>';
    NAV_SNIPPETS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2]) + '"><td>' + scenario + '</td><td><code>' + escapeHtml(r[2]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildStateTab() {
    var h = buildDocRefs("state") + '<div class="at-search-wrap"><input id="ft-search-state" class="search-input" type="text" placeholder="' + t("flutter.searchState") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.solution") + '</th><th>Package</th><th>' + t("flutter.api") + '</th><th>' + t("flutter.description") + '</th><th>' + t("flutter.note") + '</th></tr></thead><tbody>';
    STATE_SOLUTIONS.forEach(function (r) {
      var solution = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td>' + solution + '</td><td><code>' + r[1] + '</code></td><td><code>' + escapeHtml(r[2]) + '</code></td><td>' + r[3] + '</td><td>' + r[4] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildResponsiveTab() {
    var h = buildDocRefs("responsive") + '<div class="at-search-wrap"><input id="ft-search-responsive" class="search-input" type="text" placeholder="' + t("flutter.searchResponsive") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.scenario") + '</th><th>' + t("flutter.command") + '</th><th>' + t("flutter.note") + '</th></tr></thead><tbody>';
    RESPONSIVE_SNIPPETS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '" data-copy="' + escapeHtml(r[2]) + '"><td>' + scenario + '</td><td><code>' + escapeHtml(r[2]) + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildAndroidConfigTab() {
    var h = buildDocRefs("androidConfig") + '<div class="at-search-wrap"><input id="ft-search-android" class="search-input" type="text" placeholder="' + t("flutter.searchAndroidConfig") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.item") + '</th><th>' + t("flutter.description") + '</th><th>' + t("flutter.example") + '</th></tr></thead><tbody>';
    FLUTTER_ANDROID_CONFIG.forEach(function (r) {
      var itemName = r[0];
      var desc = currentLang() === "en" ? r[3] : r[2];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td><code>' + itemName + '</code></td><td>' + desc + '</td><td><code>' + escapeHtml(r[4]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildIosConfigTab() {
    var h = buildDocRefs("iosConfig") + '<div class="at-search-wrap"><input id="ft-search-ios" class="search-input" type="text" placeholder="' + t("flutter.searchIosConfig") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("flutter.item") + '</th><th>' + t("flutter.description") + '</th><th>' + t("flutter.example") + '</th></tr></thead><tbody>';
    FLUTTER_IOS_CONFIG.forEach(function (r) {
      var itemName = r[0];
      var desc = currentLang() === "en" ? r[3] : r[2];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td><code>' + itemName + '</code></td><td>' + desc + '</td><td><code>' + escapeHtml(r[4]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildDocRefs(section) {
    var indexes = SECTION_DOCS[section] || [];
    if (!indexes.length) return "";
    var h = '<div class="at-doc-refs"><span>' + t("flutter.relatedDocs") + '</span>';
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

  function bindEvents() {
    document.querySelectorAll(".ft-cat-filter[data-wcat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeWidgetCat = this.dataset.wcat;
        document.querySelectorAll(".ft-cat-filter[data-wcat]").forEach(function (b) { b.classList.toggle("active", b.dataset.wcat === activeWidgetCat); });
        filterWidgetRows();
      });
    });

    document.querySelectorAll(".ft-cat-filter[data-pcat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        activePackageCat = this.dataset.pcat;
        document.querySelectorAll(".ft-cat-filter[data-pcat]").forEach(function (b) { b.classList.toggle("active", b.dataset.pcat === activePackageCat); });
        filterPackageRows();
      });
    });

    bindSearch("ft-search-widgets", "#ftab-widgets tbody tr", function (tr, q) {
      var match = !q || tr.dataset.search.includes(q);
      var catMatch = activeWidgetCat === "all" || tr.dataset.cat === activeWidgetCat;
      tr.style.display = match && catMatch ? "" : "none";
    });

    bindSearch("ft-search-cli", "#ftab-cli tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });

    bindSearch("ft-search-packages", "#ftab-packages tbody tr", function (tr, q) {
      var match = !q || tr.dataset.search.includes(q);
      var catMatch = activePackageCat === "all" || tr.dataset.cat === activePackageCat;
      tr.style.display = match && catMatch ? "" : "none";
    });

    bindSearch("ft-search-theme", "#ftab-theme tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });

    bindSearch("ft-search-nav", "#ftab-nav tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });

    bindSearch("ft-search-state", "#ftab-state tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });

    bindSearch("ft-search-responsive", "#ftab-responsive tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });

    bindSearch("ft-search-android", "#ftab-androidConfig tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });
    bindSearch("ft-search-ios", "#ftab-iosConfig tbody tr", function (tr, q) {
      tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : "";
    });
  }

  function filterWidgetRows() {
    document.querySelectorAll("#ftab-widgets tbody tr").forEach(function (tr) {
      tr.style.display = (activeWidgetCat === "all" || tr.dataset.cat === activeWidgetCat) ? "" : "none";
    });
  }

  function filterPackageRows() {
    document.querySelectorAll("#ftab-packages tbody tr").forEach(function (tr) {
      tr.style.display = (activePackageCat === "all" || tr.dataset.cat === activePackageCat) ? "" : "none";
    });
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
