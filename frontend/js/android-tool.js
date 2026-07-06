// Android Tool — API levels, alpha/opacity, dp/px, permissions, icon sizes, ADB and config refs.
var AndroidTool = (function () {
  function t(key) { return (window.__t && window.__t(key)) || key; }

  var API_LEVELS = [
    { ver: "17",  code: "Cinnamon Bun",         api: 37, year: 2026 },
    { ver: "16",  code: "Baklava",             api: 36, year: 2025 },
    { ver: "15",  code: "Vanilla Ice Cream",   api: 35, year: 2024 },
    { ver: "14",  code: "Upside Down Cake",    api: 34, year: 2023 },
    { ver: "13",  code: "Tiramisu",            api: 33, year: 2022 },
    { ver: "12L", code: "Snow Cone v2",        api: 32, year: 2022 },
    { ver: "12",  code: "Snow Cone",           api: 31, year: 2021 },
    { ver: "11",  code: "Red Velvet Cake",     api: 30, year: 2020 },
    { ver: "10",  code: "Quince Tart",         api: 29, year: 2019 },
    { ver: "9",   code: "Pie",                 api: 28, year: 2018 },
    { ver: "8.1", code: "Oreo MR1",            api: 27, year: 2017 },
    { ver: "8.0", code: "Oreo",                api: 26, year: 2017 },
    { ver: "7.1", code: "Nougat MR1",          api: 25, year: 2016 },
    { ver: "7.0", code: "Nougat",              api: 24, year: 2016 },
    { ver: "6.0", code: "Marshmallow",         api: 23, year: 2015 },
    { ver: "5.1", code: "Lollipop MR1",        api: 22, year: 2015 },
    { ver: "5.0", code: "Lollipop",            api: 21, year: 2014 },
    { ver: "4.4", code: "KitKat",              api: 19, year: 2013 },
    { ver: "4.3", code: "Jelly Bean MR2",      api: 18, year: 2013 },
    { ver: "4.2", code: "Jelly Bean MR1",      api: 17, year: 2012 },
    { ver: "4.1", code: "Jelly Bean",          api: 16, year: 2012 },
    { ver: "4.0", code: "Ice Cream Sandwich",  api: 15, year: 2011 },
    { ver: "2.3", code: "Gingerbread",         api: 10, year: 2011 },
  ];

  // 0% → 100% alpha channel
  var ALPHA_STEPS = [];
  for (var p = 100; p >= 0; p--) {
    var hex = Math.round(p * 255 / 100).toString(16).toUpperCase().padStart(2, "0");
    ALPHA_STEPS.push({ pct: p, hex: hex });
  }

  // Dangerous permissions
  var PERMISSIONS = [
    ["ACCESS_FINE_LOCATION",       "精确定位",        "Precise location",     "dangerous"],
    ["ACCESS_COARSE_LOCATION",     "粗略定位",        "Approximate location", "dangerous"],
    ["CAMERA",                     "相机",            "Camera",               "dangerous"],
    ["RECORD_AUDIO",               "录音",            "Microphone",           "dangerous"],
    ["READ_EXTERNAL_STORAGE",      "读取存储",        "Read storage",         "dangerous"],
    ["WRITE_EXTERNAL_STORAGE",     "写入存储",        "Write storage",        "dangerous"],
    ["READ_MEDIA_IMAGES",          "读取图片",        "Read images",          "dangerous(API33+)"],
    ["READ_MEDIA_VIDEO",           "读取视频",        "Read video",           "dangerous(API33+)"],
    ["READ_MEDIA_AUDIO",           "读取音频",        "Read audio",           "dangerous(API33+)"],
    ["READ_CONTACTS",              "读取联系人",      "Read contacts",        "dangerous"],
    ["WRITE_CONTACTS",             "写入联系人",      "Write contacts",       "dangerous"],
    ["READ_CALENDAR",              "读取日历",        "Read calendar",        "dangerous"],
    ["WRITE_CALENDAR",             "写入日历",        "Write calendar",       "dangerous"],
    ["READ_SMS",                   "读取短信",        "Read SMS",             "dangerous"],
    ["SEND_SMS",                   "发送短信",        "Send SMS",             "dangerous"],
    ["RECEIVE_SMS",                "接收短信",        "Receive SMS",          "dangerous"],
    ["READ_PHONE_STATE",           "读取电话状态",    "Phone state",          "dangerous"],
    ["CALL_PHONE",                 "拨打电话",        "Call phone",           "dangerous"],
    ["READ_CALL_LOG",              "读取通话记录",    "Read call log",        "dangerous"],
    ["WRITE_CALL_LOG",             "写入通话记录",    "Write call log",       "dangerous"],
    ["BODY_SENSORS",               "身体传感器",      "Body sensors",         "dangerous"],
    ["ACTIVITY_RECOGNITION",       "运动识别",        "Activity recognition", "dangerous"],
    ["BLUETOOTH_CONNECT",          "蓝牙连接",        "Bluetooth connect",    "dangerous(API31+)"],
    ["BLUETOOTH_SCAN",             "蓝牙扫描",        "Bluetooth scan",       "dangerous(API31+)"],
    ["POST_NOTIFICATIONS",         "通知权限",        "Notifications",        "dangerous(API33+)"],
    ["NEARBY_WIFI_DEVICES",        "WiFi 设备发现",   "Nearby WiFi",          "dangerous(API33+)"],
    ["READ_MEDIA_VISUAL_USER_SELECTED", "用户选择的媒体", "Selected media",    "dangerous(API34+)"],
    ["SCHEDULE_EXACT_ALARM",       "精确闹钟",        "Exact alarm",          "special(API31+)"],
    ["USE_EXACT_ALARM",            "精确闹钟",        "Exact alarm",          "normal(API33+)"],
    ["REQUEST_INSTALL_PACKAGES",   "安装未知来源应用", "Install packages",     "special"],
    ["SYSTEM_ALERT_WINDOW",        "悬浮窗",          "Draw over apps",       "special"],
    ["WRITE_SETTINGS",             "修改系统设置",    "Write settings",       "special"],
    ["MANAGE_EXTERNAL_STORAGE",    "所有文件访问",    "All files access",     "special(API30+)"],
    ["FOREGROUND_SERVICE",         "前台服务",        "Foreground service",   "normal(API28+)"],
    ["FOREGROUND_SERVICE_CAMERA",  "相机前台服务",    "FGS camera",           "normal(API34+)"],
    ["FOREGROUND_SERVICE_LOCATION","定位前台服务",    "FGS location",         "normal(API34+)"],
    ["FOREGROUND_SERVICE_MEDIA_PLAYBACK","媒体播放前台服务","FGS media playback","normal(API34+)"],
    ["USE_FULL_SCREEN_INTENT",     "全屏通知",        "Full-screen intent",   "special(API29+)"],
  ];

  // Icon sizes by density
  var ICON_SIZES = [
    { bucket: "ldpi", scale: "0.75x", launcher: 36, action: 24, notification: 18 },
    { bucket: "mdpi", scale: "1.0x",  launcher: 48, action: 24, notification: 24 },
    { bucket: "hdpi", scale: "1.5x",  launcher: 72, action: 36, notification: 36 },
    { bucket: "xhdpi", scale: "2.0x", launcher: 96, action: 48, notification: 48 },
    { bucket: "xxhdpi", scale: "3.0x", launcher: 144, action: 72, notification: 72 },
    { bucket: "xxxhdpi", scale: "4.0x", launcher: 192, action: 96, notification: 96 },
  ];

  // Common Implicit Intents
  var INTENTS = [
    ["ACTION_VIEW",             "打开链接",   "Open URL",         "https://...",                        ""],
    ["ACTION_VIEW",             "地图定位",   "Map location",     "geo:lat,lng?q=query",                ""],
    ["ACTION_VIEW",             "拨号盘",     "Show dialer",      "tel:123456",                         ""],
    ["ACTION_DIAL",             "拨号",       "Dial",             "tel:123456",                         ""],
    ["ACTION_CALL",             "直接通话",   "Call directly",    "tel:123456",                         "CALL_PHONE"],
    ["ACTION_SENDTO",           "发送短信",   "Send SMS",         "smsto:123456",                       ""],
    ["ACTION_SEND",             "分享文本",   "Share text",       "text/plain",                         ""],
    ["ACTION_SEND",             "分享图片",   "Share image",      "image/*",                            ""],
    ["ACTION_SEND_MULTIPLE",    "分享多文件", "Share multiple",   "image/*",                            ""],
    ["ACTION_IMAGE_CAPTURE",    "拍照",       "Take photo",       "output: URI",                        ""],
    ["ACTION_VIDEO_CAPTURE",    "录像",       "Record video",     "output: URI",                        ""],
    ["ACTION_PICK",             "选择联系人", "Pick contact",     "content://com.android.contacts/...", ""],
    ["ACTION_GET_CONTENT",      "选择文件",   "Pick file",        "image/*",                            ""],
    ["ACTION_OPEN_DOCUMENT",    "打开文档",   "Open document",    "*/*",                                ""],
    ["ACTION_CREATE_DOCUMENT",  "创建文档",   "Create document",  "application/pdf",                    ""],
    ["ACTION_WEB_SEARCH",       "网页搜索",   "Web search",       "query string",                       ""],
    ["ACTION_SET_ALARM",        "设置闹钟",   "Set alarm",        "hour:min",                           ""],
    ["ACTION_APPLICATION_DETAILS_SETTINGS", "应用详情页", "App settings", "package:com.example.app", ""],
    ["ACTION_REQUEST_SCHEDULE_EXACT_ALARM", "申请精确闹钟", "Request exact alarm", "package:com.example.app", "SCHEDULE_EXACT_ALARM"],
    ["ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION", "所有文件访问设置", "All files access settings", "package:com.example.app", "MANAGE_EXTERNAL_STORAGE"],
    ["ACTION_MANAGE_OVERLAY_PERMISSION", "悬浮窗设置", "Overlay settings", "package:com.example.app", "SYSTEM_ALERT_WINDOW"],
    ["ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", "忽略电池优化", "Ignore battery optimizations", "package:com.example.app", "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"],
    ["ACTION_MAIN",             "启动应用",   "Launch app",       "CATEGORY_LAUNCHER",                  ""],
    ["ACTION_INSTALL_PACKAGE",  "安装应用",   "Install APK",      "package: URI / file://",             "REQUEST_INSTALL_PACKAGES"],
    ["ACTION_UNINSTALL_PACKAGE","卸载应用",   "Uninstall",        "package:...",                        "REQUEST_DELETE_PACKAGES"],
  ];

  var ADB_COMMANDS = [
    ["设备连接", "List devices", "adb devices", "查看已连接设备与授权状态"],
    ["安装 APK", "Install APK", "adb install -r app-debug.apk", "-r 覆盖安装，-d 允许降级"],
    ["卸载应用", "Uninstall app", "adb uninstall com.example.app", "加 -k 可保留数据"],
    ["启动 Activity", "Start activity", "adb shell am start -n com.example/.MainActivity", "也可用 -a/-d 启动隐式 Intent"],
    ["清除数据", "Clear app data", "adb shell pm clear com.example.app", "等同系统设置里清除存储"],
    ["查看日志", "Logcat", "adb logcat -v time", "可追加 | grep 过滤标签"],
    ["过滤日志", "Filter logs", "adb logcat ActivityManager:I MyApp:D *:S", "*:S 静默其他标签"],
    ["清空日志", "Clear logs", "adb logcat -c", "重新抓问题前先清空缓冲区"],
    ["抓取崩溃日志", "Crash log", "adb logcat -b crash -d", "-d 输出后退出"],
    ["截图", "Screenshot", "adb exec-out screencap -p > screen.png", "保存当前屏幕 PNG"],
    ["录屏", "Screen record", "adb shell screenrecord /sdcard/demo.mp4", "结束后 adb pull 拉取文件"],
    ["查看进程", "List processes", "adb shell ps -A | grep com.example", "确认进程是否存活"],
    ["强制停止", "Force stop", "adb shell am force-stop com.example.app", "模拟用户手动停止应用"],
    ["拉取文件", "Pull file", "adb pull /sdcard/demo.mp4 .", "从设备复制到电脑"],
    ["推送文件", "Push file", "adb push local.txt /sdcard/Download/", "从电脑复制到设备"],
    ["查看包路径", "Package path", "adb shell pm path com.example.app", "定位已安装 APK"],
    ["列出包名", "List packages", "adb shell pm list packages | grep example", "查找已安装应用"],
    ["查看包详情", "Package dump", "adb shell dumpsys package com.example.app", "权限、组件、签名、安装信息"],
    ["查看 Activity", "Resolve activity", "adb shell cmd package resolve-activity --brief com.example.app", "确认默认入口"],
    ["查看当前页面", "Current activity", "adb shell dumpsys activity top | grep ACTIVITY", "定位当前 Activity"],
    ["查看任务栈", "Activity stack", "adb shell dumpsys activity activities", "排查启动模式和返回栈"],
    ["授权权限", "Grant permission", "adb shell pm grant com.example.app android.permission.CAMERA", "仅适用于运行时权限"],
    ["撤销权限", "Revoke permission", "adb shell pm revoke com.example.app android.permission.CAMERA", "调试权限流程"],
    ["重置权限", "Reset permissions", "adb shell pm reset-permissions", "恢复运行时权限状态"],
    ["查看屏幕参数", "Display info", "adb shell wm size; adb shell wm density", "分辨率与 dpi"],
    ["修改屏幕密度", "Set density", "adb shell wm density 420", "恢复用 adb shell wm density reset"],
    ["查看系统属性", "Get prop", "adb shell getprop ro.build.version.sdk", "常查 API、机型、ABI"],
    ["查看电池状态", "Battery info", "adb shell dumpsys battery", "调试充电、温度、电量状态"],
    ["模拟断电", "Unplug battery", "adb shell dumpsys battery unplug", "恢复用 adb shell dumpsys battery reset"],
    ["查看内存", "Memory info", "adb shell dumpsys meminfo com.example.app", "定位内存占用"],
    ["查看 CPU", "CPU info", "adb shell top -o PID,CPU,RES,ARGS", "部分设备字段参数可能不同"],
    ["查看网络", "Network stats", "adb shell dumpsys netstats", "粗略查看网络统计"],
    ["输入文本", "Input text", "adb shell input text hello", "空格写成 %s"],
    ["点击坐标", "Tap", "adb shell input tap 540 1200", "适合快速复现操作"],
    ["滑动手势", "Swipe", "adb shell input swipe 500 1600 500 400 300", "末尾是持续毫秒"],
    ["按键事件", "Key event", "adb shell input keyevent KEYCODE_BACK", "也可用 KEYCODE_HOME/ENTER"],
    ["网络端口转发", "Port forward", "adb forward tcp:8080 tcp:8080", "本机访问设备端口"],
    ["反向端口转发", "Reverse port", "adb reverse tcp:8080 tcp:8080", "设备访问电脑 localhost"],
    ["无线调试连接", "Wireless connect", "adb pair host:port; adb connect host:port", "Android 11+ 无线调试"],
    ["重启", "Reboot", "adb reboot", "也可 reboot bootloader"],
  ];

  var MANIFEST_REFS = [
    ["minSdk", "minSdk", "最低支持 API", "Minimum supported API", "defaultConfig { minSdk = 23 }"],
    ["targetSdk", "targetSdk", "适配行为目标 API，影响权限和系统兼容策略", "Behavior target API; affects permissions and platform changes", "defaultConfig { targetSdk = 35 }"],
    ["compileSdk", "compileSdk", "编译使用的 SDK，不等于最低支持版本", "SDK used to compile; not the minimum supported version", "android { compileSdk = 35 }"],
    ["namespace", "namespace", "R/BuildConfig 包名，AGP 8+ 必填", "Package for R/BuildConfig; required by AGP 8+", "android { namespace = \"com.example.app\" }"],
    ["applicationId", "applicationId", "应用安装包名，商店和设备识别用", "Install package id used by stores and devices", "defaultConfig { applicationId = \"com.example.app\" }"],
    ["versionCode", "versionCode", "整数版本号，上架时必须递增", "Integer release version; must increase for store uploads", "versionCode = 42"],
    ["versionName", "versionName", "展示给用户看的版本号", "User-facing version", "versionName = \"1.4.0\""],
    ["uses-permission", "uses-permission", "声明权限", "Declare permission", "<uses-permission android:name=\"android.permission.CAMERA\" />"],
    ["uses-feature", "uses-feature", "声明硬件/软件特性，可影响商店可见设备", "Declare features; can affect store device filtering", "<uses-feature android:name=\"android.hardware.camera\" android:required=\"false\" />"],
    ["android:exported", "exported", "带 intent-filter 的组件在 Android 12+ 必须显式声明", "Required on Android 12+ for components with intent filters", "android:exported=\"true\""],
    ["android:authorities", "authorities", "Provider 唯一标识，常用于 FileProvider", "Unique provider id, often used by FileProvider", "android:authorities=\"${applicationId}.fileprovider\""],
    ["queries", "queries", "Android 11+ 查询其他应用能力声明", "Android 11+ package visibility declaration", "<queries><package android:name=\"com.tencent.mm\" /></queries>"],
    ["networkSecurityConfig", "Network security", "明文 HTTP、证书 pinning、调试 CA 配置", "HTTP cleartext, pinning and debug CA config", "android:networkSecurityConfig=\"@xml/network_security_config\""],
    ["backup", "Backup", "控制自动备份与数据迁移", "Controls auto backup and restore", "android:allowBackup=\"false\""],
    ["theme", "Theme", "应用或 Activity 主题", "App or Activity theme", "android:theme=\"@style/Theme.App\""],
    ["label", "Label", "应用或组件名称", "App or component label", "android:label=\"@string/app_name\""],
  ];

  var RESOURCE_QUALIFIERS = [
    ["语言", "Language", "values-zh-rCN", "简体中文（中国）"],
    ["夜间模式", "Night mode", "values-night", "深色模式资源"],
    ["屏幕方向", "Orientation", "layout-land", "横屏布局"],
    ["最小宽度", "Smallest width", "layout-sw600dp", "平板/折叠屏常用"],
    ["可用宽度", "Available width", "layout-w840dp", "按当前可用宽度适配"],
    ["可用高度", "Available height", "layout-h480dp", "按当前可用高度适配"],
    ["密度", "Density", "drawable-xxhdpi", "位图按密度分桶"],
    ["任意密度", "Any density", "drawable-anydpi-v26", "矢量图/自适应图标常用"],
    ["API 版本", "API version", "values-v31", "特定 Android 版本资源"],
    ["圆形屏", "Round screen", "layout-round", "Wear OS 圆形屏"],
    ["触摸屏", "Touchscreen", "values-notouch", "少见，电视/车机可能用到"],
    ["键盘", "Keyboard", "values-keysexposed", "硬件键盘状态"],
  ];

  var LIFECYCLE_REFS = [
    ["Activity 启动", "Activity start", "onCreate → onStart → onResume", "首次进入前台"],
    ["Activity 退到后台", "Activity background", "onPause → onStop", "被其他页面完全遮挡"],
    ["Activity 回到前台", "Activity foreground", "onRestart → onStart → onResume", "从后台返回"],
    ["Activity 销毁", "Activity destroy", "onPause → onStop → onDestroy", "finish 或系统回收"],
    ["Fragment 创建视图", "Fragment view create", "onAttach → onCreate → onCreateView → onViewCreated → onStart → onResume", "绑定 View 生命周期"],
    ["Fragment 销毁视图", "Fragment view destroy", "onPause → onStop → onDestroyView", "释放 view binding"],
    ["Service 前台服务", "Foreground service", "startForegroundService → onCreate → onStartCommand → startForeground", "短时间内必须调用 startForeground"],
    ["BroadcastReceiver", "BroadcastReceiver", "onReceive", "不要在 onReceive 做长任务"],
  ];

  var DOC_LINKS = [
    ["Android 文档首页", "Android docs", "Android 开发者文档入口", "Android developer documentation index", "https://developer.android.com/docs"],
    ["API 版本常量", "API version codes", "Build.VERSION_CODES API 参考", "Build.VERSION_CODES API reference", "https://developer.android.com/reference/android/os/Build.VERSION_CODES"],
    ["ADB", "ADB", "Android Debug Bridge 命令行工具", "Android Debug Bridge command-line tool", "https://developer.android.com/tools/adb"],
    ["Platform Tools", "Platform Tools", "adb / fastboot 下载与版本说明", "adb / fastboot downloads and release notes", "https://developer.android.com/tools/releases/platform-tools"],
    ["真机调试", "Run on device", "配置设备、USB 调试和 ADB 连接", "Set up devices, USB debugging and ADB connections", "https://developer.android.com/studio/run/device"],
    ["开发者选项", "Developer options", "USB 调试、等待调试器、GPU/布局调试选项", "USB debugging, wait for debugger, GPU/layout debugging options", "https://developer.android.com/studio/debug/dev-options"],
    ["颜色 Color", "Color reference", "颜色与 alpha 通道 API 参考", "Color and alpha channel API reference", "https://developer.android.com/reference/android/graphics/Color"],
    ["屏幕密度", "Screen densities", "dp、px、dpi 与密度适配", "dp, px, dpi and density support", "https://developer.android.com/training/multiscreen/screendensities"],
    ["Activity 生命周期", "Activity lifecycle", "Activity 生命周期回调与状态", "Activity lifecycle callbacks and states", "https://developer.android.com/guide/components/activities/activity-lifecycle"],
    ["Fragment 生命周期", "Fragment lifecycle", "Fragment 与 View 生命周期", "Fragment and view lifecycle", "https://developer.android.com/guide/fragments/lifecycle"],
    ["权限概览", "Permissions overview", "权限类型、运行时权限和最佳实践", "Permission types, runtime permissions and best practices", "https://developer.android.com/guide/topics/permissions/overview"],
    ["申请运行时权限", "Request runtime permissions", "运行时权限请求流程", "Runtime permission request workflow", "https://developer.android.com/training/permissions/requesting"],
    ["权限常量", "Manifest.permission", "Android 权限常量 API 参考", "Android permission constants API reference", "https://developer.android.com/reference/android/Manifest.permission"],
    ["Intent 和过滤器", "Intents and filters", "Intent、隐式启动与 intent-filter", "Intents, implicit launch and intent filters", "https://developer.android.com/guide/components/intents-filters"],
    ["通用 Intent", "Common intents", "常用内置 Intent action 示例", "Common built-in Intent action examples", "https://developer.android.com/guide/components/intents-common"],
    ["Manifest 概览", "Manifest overview", "AndroidManifest.xml 结构与元素索引", "AndroidManifest.xml structure and element index", "https://developer.android.com/guide/topics/manifest/manifest-intro"],
    ["application 元素", "application element", "<application> 属性参考", "<application> attribute reference", "https://developer.android.com/guide/topics/manifest/application-element"],
    ["activity 元素", "activity element", "<activity> 属性参考", "<activity> attribute reference", "https://developer.android.com/guide/topics/manifest/activity-element"],
    ["queries 元素", "queries element", "Android 11+ 包可见性声明", "Android 11+ package visibility declaration", "https://developer.android.com/guide/topics/manifest/queries-element"],
    ["资源概览", "App resources", "资源目录、限定符和匹配规则", "Resource directories, qualifiers and matching rules", "https://developer.android.com/guide/topics/resources/providing-resources"],
    ["字符串资源", "String resources", "strings.xml、格式化和复数文本", "strings.xml, formatting and plurals", "https://developer.android.com/guide/topics/resources/string-resource"],
    ["应用图标", "App icons", "启动图标与自适应图标", "Launcher icons and adaptive icons", "https://developer.android.com/develop/ui/views/launch/icon_design_adaptive"],
    ["应用基础", "Application fundamentals", "组件、Manifest、资源和应用结构", "Components, Manifest, resources and app structure", "https://developer.android.com/guide/components/fundamentals"],
    ["命令行测试", "Command-line testing", "使用 adb 运行测试", "Run tests with adb", "https://developer.android.com/studio/test/command-line"],
  ];

  var SECTION_DOCS = {
    api: [1],
    docs: [0],
    adb: [2, 3],
    alpha: [6],
    dp: [7],
    lifecycle: [8, 9],
    perm: [10, 11, 12],
    icon: [21],
    intent: [13, 14],
    manifest: [15, 16, 17, 18],
    resources: [19, 20],
  };

  // AGP ↔ Gradle compatibility
  var AGP_VERSIONS = [
    ["8.9", "8.11.0+", "Ladybug | 2024.2"],
    ["8.8", "8.10.0+", "Ladybug | 2024.2"],
    ["8.7", "8.9+",    "Koala | 2024.1"],
    ["8.6", "8.7+",    "Koala | 2024.1"],
    ["8.5", "8.7+",    "Jellyfish | 2023.3"],
    ["8.4", "8.6+",    "Jellyfish | 2023.3"],
    ["8.3", "8.5+",    "Hedgehog | 2023.1"],
    ["8.2", "8.2+",    "Hedgehog | 2023.1"],
    ["8.1", "8.0+",    "Giraffe | 2022.3"],
    ["8.0", "8.0+",    "Giraffe | 2022.3"],
    ["7.4", "7.5+",    "Flamingo | 2022.2"],
    ["7.3", "7.4+",    "Flamingo | 2022.2"],
    ["7.2", "7.3.3+",  "Electric Eel | 2022.1"],
    ["7.1", "7.2+",    "Electric Eel | 2022.1"],
    ["7.0", "7.0+",    "Arctic Fox | 2020.3"],
    ["4.2", "6.7.1+",  "Arctic Fox | 2020.3"],
  ];

  var alphaMode = "transparency"; // "transparency" | "opacity"

  function init(parent) {
    parent.innerHTML =
      '<div class="android-tool">' +
      '  <div class="b64-tabs">' +
      '    <button class="b64-tab active" data-atab="api">' + t("android.apiLevels") + '</button>' +
      '    <button class="b64-tab" data-atab="docs">' + t("android.docs") + '</button>' +
      '    <button class="b64-tab" data-atab="adb">' + t("android.adb") + '</button>' +
      '    <button class="b64-tab" data-atab="alpha">' + t("android.alpha") + '</button>' +
      '    <button class="b64-tab" data-atab="dp">' + t("android.dpPx") + '</button>' +
      '    <button class="b64-tab" data-atab="lifecycle">' + t("android.lifecycle") + '</button>' +
      '    <button class="b64-tab" data-atab="perm">' + t("android.permissions") + '</button>' +
      '    <button class="b64-tab" data-atab="icon">' + t("android.iconSizes") + '</button>' +
      '    <button class="b64-tab" data-atab="intent">' + t("android.intents") + '</button>' +
      '    <button class="b64-tab" data-atab="manifest">' + t("android.manifest") + '</button>' +
      '    <button class="b64-tab" data-atab="resources">' + t("android.resources") + '</button>' +
      '  </div>' +
      '  <div id="atab-api" class="android-section">' + buildApiTable() + '</div>' +
      '  <div id="atab-docs" class="android-section hidden">' + buildDocsTable() + '</div>' +
      '  <div id="atab-adb" class="android-section hidden">' + buildAdbTable() + '</div>' +
      '  <div id="atab-alpha" class="android-section hidden">' + buildAlphaTable() + '</div>' +
      '  <div id="atab-dp" class="android-section hidden">' + buildDpSection() + '</div>' +
      '  <div id="atab-lifecycle" class="android-section hidden">' + buildLifecycleTable() + '</div>' +
      '  <div id="atab-perm" class="android-section hidden">' + buildPermTable() + '</div>' +
      '  <div id="atab-icon" class="android-section hidden">' + buildIconTable() + '</div>' +
      '  <div id="atab-intent" class="android-section hidden">' + buildIntentTable() + '</div>' +
      '  <div id="atab-manifest" class="android-section hidden">' + buildManifestTable() + '</div>' +
      '  <div id="atab-resources" class="android-section hidden">' + buildResourcesTable() + '</div>' +
      '</div>';

    document.querySelectorAll(".b64-tab[data-atab]").forEach(function (btn) {
      btn.addEventListener("click", function () { switchATab(this.dataset.atab); });
    });

    bindEvents();
    renderAlphaBody(); // ponytail: alpha table built dynamically, must render on init
  }

  function switchATab(name) {
    document.querySelectorAll(".b64-tab[data-atab]").forEach(function (b) {
      b.className = "b64-tab" + (b.dataset.atab === name ? " active" : "");
    });
    document.querySelectorAll(".android-section").forEach(function (s) {
      s.classList.toggle("hidden", s.id !== "atab-" + name);
    });
  }

  // ═══ API Levels ═══

  function buildApiTable() {
    var h = buildDocRefs("api");
    h += '<div class="at-search-wrap"><input id="at-search-api" class="search-input" type="text" placeholder="' + t("android.searchApi") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.version") + '</th><th>' + t("android.codename") + '</th><th>API</th><th>' + t("android.year") + '</th></tr></thead><tbody>';
    API_LEVELS.forEach(function (r) {
      h += '<tr data-search="' + r.ver + ' ' + r.code.toLowerCase() + ' ' + r.api + '"><td><code>' + r.ver + '</code></td><td>' + r.code + '</td><td><code>' + r.api + '</code></td><td>' + r.year + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Alpha / Opacity ═══

  function buildAlphaTable() {
    var h = buildDocRefs("alpha");
    h += '<div class="at-search-wrap" style="display:flex;gap:10px;align-items:center">';
    h += '<input id="at-search-alpha" class="search-input" type="text" placeholder="' + t("android.searchAlpha") + '" style="max-width:280px">';
    h += '<button id="at-toggle-alpha" class="jt-btn" style="font-size:0.8rem">' + t("android." + alphaMode) + ' → ' + t("android." + (alphaMode === "transparency" ? "opacity" : "transparency")) + '</button>';
    h += '</div>';
    h += '<div class="at-table-wrap"><table class="at-table at-table-grid"><thead><tr>';
    for (var c = 0; c < 4; c++) {
      h += '<th id="at-alpha-col-' + c + '">' + t("android." + alphaMode) + '</th><th>Hex</th>';
    }
    h += '</tr></thead><tbody id="at-alpha-body"></tbody></table></div>';
    return h;
  }

  function renderAlphaBody() {
    var body = document.getElementById("at-alpha-body");
    if (!body) return;
    var h = "";
    for (var i = 0; i < ALPHA_STEPS.length; i += 4) {
      h += '<tr>';
      for (var j = 0; j < 4 && (i + j) < ALPHA_STEPS.length; j++) {
        var a = ALPHA_STEPS[i + j];
        var display = alphaMode === "opacity" ? (100 - a.pct) : a.pct;
        h += '<td>' + display + '%</td><td><code>#' + a.hex + '</code></td>';
      }
      h += '</tr>';
    }
    body.innerHTML = h;

    // update headers
    for (var c = 0; c < 4; c++) {
      var th = document.getElementById("at-alpha-col-" + c);
      if (th) th.textContent = t("android." + alphaMode);
    }
  }

  function toggleAlpha() {
    alphaMode = alphaMode === "transparency" ? "opacity" : "transparency";
    renderAlphaBody();
    var btn = document.getElementById("at-toggle-alpha");
    if (btn) btn.textContent = t("android." + alphaMode) + ' → ' + t("android." + (alphaMode === "transparency" ? "opacity" : "transparency"));
  }

  // ═══ dp/px ═══

  function buildDpSection() {
    var h = buildDocRefs("dp");
    h += '<div class="at-converter">';
    h += '<div class="at-conv-row"><label class="crypto-inline"><span>dp</span><input id="at-dp" class="crypto-input" type="number" placeholder="' + t("android.dpPlaceholder") + '" style="width:120px"></label>';
    h += '<span style="color:var(--text-muted)">↔</span>';
    h += '<label class="crypto-inline"><span>px</span><input id="at-px" class="crypto-input" type="number" placeholder="' + t("android.pxPlaceholder") + '" style="width:120px"></label></div>';
    h += '<div class="at-conv-row" style="margin-top:10px"><label class="crypto-inline"><span>' + t("android.density") + '</span>';
    h += '<select id="at-density" class="settings-select" style="width:auto">';
    h += '<option value="0.75">ldpi (0.75x)</option><option value="1.0" selected>mdpi (1.0x)</option>';
    h += '<option value="1.5">hdpi (1.5x)</option><option value="2.0">xhdpi (2.0x)</option>';
    h += '<option value="3.0">xxhdpi (3.0x)</option><option value="4.0">xxxhdpi (4.0x)</option>';
    h += '</select></label></div></div>';

    var densities = [
      ["ldpi","0.75x","~120","低端旧设备"],["mdpi","1.0x","~160","早期 Android 手机"],
      ["hdpi","1.5x","~240","低端入门机"],["xhdpi","2.0x","~320","中端手机、小平板"],
      ["xxhdpi","3.0x","~480","高端手机"],["xxxhdpi","4.0x","~640","旗舰 / 4K 设备"],
      ["tvdpi","1.33x","~213","电视"],
    ];
    h += '<div class="at-table-wrap" style="margin-top:20px"><table class="at-table"><thead><tr><th>' + t("android.densityBucket") + '</th><th>' + t("android.density") + '</th><th>dpi</th><th>' + t("android.exampleDevices") + '</th></tr></thead><tbody>';
    densities.forEach(function (r) {
      h += '<tr><td><code>' + r[0] + '</code></td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Permissions ═══

  function buildPermTable() {
    var h = buildDocRefs("perm");
    h += '<div class="at-search-wrap"><input id="at-search-perm" class="search-input" type="text" placeholder="' + t("android.searchPerm") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Permission</th><th>' + t("android.description") + '</th><th>' + t("android.level") + '</th></tr></thead><tbody>';
    PERMISSIONS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r[0].toLowerCase() + ' ' + desc.toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Icon Sizes ═══

  function buildIconTable() {
    var h = buildDocRefs("icon");
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.densityBucket") + '</th><th>' + t("android.density") + '</th><th>Launcher (dp)</th><th>' + t("android.actionBar") + ' (dp)</th><th>' + t("android.notification") + ' (dp)</th></tr></thead><tbody>';
    ICON_SIZES.forEach(function (r) {
      h += '<tr><td><code>' + r.bucket + '</code></td><td>' + r.scale + '</td><td>' + r.launcher + '</td><td>' + r.action + '</td><td>' + r.notification + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Common Intents ═══

  function buildIntentTable() {
    var h = buildDocRefs("intent");
    h += '<div class="at-search-wrap"><input id="at-search-intent" class="search-input" type="text" placeholder="' + t("android.searchIntent") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>Action</th><th>' + t("android.description") + '</th><th>Data / MIME</th><th>' + t("android.permission") + '</th></tr></thead><tbody>';
    INTENTS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[2] : r[1];
      h += '<tr data-search="' + r[0].toLowerCase() + ' ' + desc.toLowerCase() + ' ' + r[3].toLowerCase() + '"><td><code>' + r[0] + '</code></td><td>' + desc + '</td><td><code>' + r[3] + '</code></td><td>' + (r[4] ? '<code>' + r[4] + '</code>' : '—') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ ADB Commands ═══

  function buildAdbTable() {
    var h = buildDocRefs("adb");
    h += '<div class="at-search-wrap"><input id="at-search-adb" class="search-input" type="text" placeholder="' + t("android.searchAdb") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.scenario") + '</th><th>' + t("android.command") + '</th><th>' + t("android.note") + '</th></tr></thead><tbody>';
    ADB_COMMANDS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + [r[0], r[1], r[2], r[3]].join(" ").toLowerCase() + '"><td>' + scenario + '</td><td><code>' + r[2] + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Manifest / Gradle Config ═══

  function buildManifestTable() {
    var h = buildDocRefs("manifest");
    h += '<div class="at-search-wrap"><input id="at-search-manifest" class="search-input" type="text" placeholder="' + t("android.searchManifest") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.item") + '</th><th>' + t("android.description") + '</th><th>' + t("android.example") + '</th></tr></thead><tbody>';
    MANIFEST_REFS.forEach(function (r) {
      var desc = currentLang() === "en" ? r[3] : r[2];
      h += '<tr data-search="' + [r[0], r[1], r[2], r[3], r[4]].join(" ").toLowerCase() + '"><td><code>' + r[1] + '</code></td><td>' + desc + '</td><td><code>' + escapeHtml(r[4]) + '</code></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Resource Qualifiers ═══

  function buildResourcesTable() {
    var h = buildDocRefs("resources");
    h += '<div class="at-search-wrap"><input id="at-search-resources" class="search-input" type="text" placeholder="' + t("android.searchResources") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.type") + '</th><th>' + t("android.qualifier") + '</th><th>' + t("android.note") + '</th></tr></thead><tbody>';
    RESOURCE_QUALIFIERS.forEach(function (r) {
      var type = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td>' + type + '</td><td><code>' + r[2] + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Lifecycle ═══

  function buildLifecycleTable() {
    var h = buildDocRefs("lifecycle");
    h += '<div class="at-search-wrap"><input id="at-search-lifecycle" class="search-input" type="text" placeholder="' + t("android.searchLifecycle") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.scenario") + '</th><th>' + t("android.sequence") + '</th><th>' + t("android.note") + '</th></tr></thead><tbody>';
    LIFECYCLE_REFS.forEach(function (r) {
      var scenario = currentLang() === "en" ? r[1] : r[0];
      h += '<tr data-search="' + r.join(" ").toLowerCase() + '"><td>' + scenario + '</td><td><code>' + r[2] + '</code></td><td>' + r[3] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ Common Docs ═══

  function buildDocsTable() {
    var h = buildDocRefs("docs");
    h += '<div class="at-search-wrap"><input id="at-search-docs" class="search-input" type="text" placeholder="' + t("android.searchDocs") + '"></div>';
    h += '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>' + t("android.item") + '</th><th>' + t("android.description") + '</th><th>URL</th></tr></thead><tbody>';
    DOC_LINKS.forEach(function (r) {
      var name = currentLang() === "en" ? r[1] : r[0];
      var desc = currentLang() === "en" ? r[3] : r[2];
      h += '<tr data-search="' + [r[0], r[1], r[2], r[3], r[4]].join(" ").toLowerCase() + '"><td>' + name + '</td><td>' + desc + '</td><td><a href="' + r[4] + '" target="_blank" rel="noopener noreferrer"><code>' + r[4] + '</code></a></td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  function buildDocRefs(section) {
    var indexes = SECTION_DOCS[section] || [];
    if (!indexes.length) return "";
    var h = '<div class="at-doc-refs"><span>' + t("android.relatedDocs") + '</span>';
    indexes.forEach(function (idx) {
      var r = DOC_LINKS[idx];
      var label = currentLang() === "en" ? r[1] : r[0];
      h += '<a href="' + r[4] + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
    });
    h += '</div>';
    return h;
  }

  // ═══ AGP ↔ Gradle ═══

  function buildAgpTable() {
    var h = '<div class="at-table-wrap"><table class="at-table"><thead><tr><th>AGP</th><th>Gradle</th><th>Android Studio</th></tr></thead><tbody>';
    AGP_VERSIONS.forEach(function (r) {
      h += '<tr><td><code>' + r[0] + '</code></td><td><code>' + r[1] + '</code></td><td>' + r[2] + '</td></tr>';
    });
    h += '</tbody></table></div>';
    return h;
  }

  // ═══ events ═══

  function currentLang() {
    return (window.__locale && window.__locale.menu && window.__locale.menu.home === "首页") ? "zh" : "en";
  }

  function bindEvents() {
    // dp/px
    var dpEl = document.getElementById("at-dp");
    var pxEl = document.getElementById("at-px");
    var densityEl = document.getElementById("at-density");
    function getDensity() { return densityEl ? parseFloat(densityEl.value) : 1; }
    if (dpEl && pxEl) {
      dpEl.addEventListener("input", function () {
        var dp = parseFloat(this.value);
        if (!isNaN(dp)) pxEl.value = Math.round(dp * getDensity());
      });
      pxEl.addEventListener("input", function () {
        var px = parseFloat(this.value);
        if (!isNaN(px)) dpEl.value = (px / getDensity()).toFixed(1);
      });
    }
    if (densityEl) {
      densityEl.addEventListener("change", function () {
        var dp = parseFloat(dpEl.value);
        if (!isNaN(dp)) pxEl.value = Math.round(dp * getDensity());
      });
    }

    // alpha toggle
    var alphaToggle = document.getElementById("at-toggle-alpha");
    if (alphaToggle) alphaToggle.addEventListener("click", toggleAlpha);

    // search: API
    bindSearch("at-search-api", "#atab-api tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: alpha
    bindSearch("at-search-alpha", "#atab-alpha tbody tr", function (tr, q) { tr.style.display = q && !tr.textContent.toLowerCase().includes(q) ? "none" : ""; });
    // search: permissions
    bindSearch("at-search-perm", "#atab-perm tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: intents
    bindSearch("at-search-intent", "#atab-intent tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: adb
    bindSearch("at-search-adb", "#atab-adb tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: manifest
    bindSearch("at-search-manifest", "#atab-manifest tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: resources
    bindSearch("at-search-resources", "#atab-resources tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: lifecycle
    bindSearch("at-search-lifecycle", "#atab-lifecycle tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
    // search: docs
    bindSearch("at-search-docs", "#atab-docs tbody tr", function (tr, q) { tr.style.display = q && !tr.dataset.search.includes(q) ? "none" : ""; });
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
